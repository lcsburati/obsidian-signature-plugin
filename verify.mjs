#!/usr/bin/env node
/**
 * verify.mjs — Obsidian Signature Plugin: external signature validator
 *
 * Validates signatures in one or more Markdown files without needing Obsidian.
 * Uses the same FNV-1a 32-bit hash and content-stripping logic as the plugin.
 *
 * Usage:
 *   node verify.mjs <file.md> [file2.md ...]
 *   node verify.mjs --dir <folder>        # validate all .md files in a folder
 *   node verify.mjs --hash <idHash.contentHash> <file.md>  # validate single sig hash
 *   node verify.mjs --help
 *
 * Exit codes:
 *   0 — all signatures valid (or no signatures found)
 *   1 — one or more tampered signatures
 *   2 — only legacy signatures (no content hash to verify)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, extname, join } from 'path';

// ── Algorithm (must match main.ts exactly) ────────────────────────────────────

/** FNV-1a 32-bit hash → 8 lowercase hex chars */
function shortHash(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Strip all signature blocks and placeholder tags, normalize whitespace. */
function stripSigs(text) {
  return text
    .replace(/\[(ASSINADO|SIGNED|已签名|BLOQUEADO|LOCKED|已锁定): [^\]]+\]/g, '')
    .replace(/\[(assinatura|signature|签名)\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeIdHash(name, role, ts) {
  return shortHash(name + '|' + role + '|' + ts);
}

function makeContentHash(docText) {
  return shortHash(stripSigs(docText));
}

// ── Signature parsing ─────────────────────────────────────────────────────────

const SIGNED_RE =
  /\[(ASSINADO|SIGNED|已签名|BLOQUEADO|LOCKED|已锁定): ([^\]|]+?) - ([^\]|]+?) \| ([^\]|]+?) \| ([a-f0-9]{8}(?:\.[a-f0-9]{8})?)\]/g;

const LOCK_PREFIXES = new Set(['LOCKED', 'BLOQUEADO', '已锁定']);

function parseSigs(text) {
  const results = [];
  SIGNED_RE.lastIndex = 0;
  let m;
  while ((m = SIGNED_RE.exec(text)) !== null) {
    const hashField = m[5];
    const dotIdx = hashField.indexOf('.');
    const idHash = dotIdx >= 0 ? hashField.slice(0, dotIdx) : hashField;
    const contentHash = dotIdx >= 0 ? hashField.slice(dotIdx + 1) : '';
    results.push({
      raw: m[0],
      prefix: m[1],
      name: m[2].trim(),
      role: m[3].trim(),
      ts: m[4].trim(),
      idHash,
      contentHash,
      isLock: LOCK_PREFIXES.has(m[1]),
    });
  }
  return results;
}

/**
 * Verify a single signature against the full document text.
 * Returns: 'valid' | 'tampered-id' | 'tampered-content' | 'tampered' | 'legacy'
 *   tampered-id      — só o hash de identidade (nome/cargo/ts) não confere
 *   tampered-content — só o hash de conteúdo não confere (documento foi alterado)
 *   tampered         — ambos os hashes não conferem
 */
function verifySig(sig, fullText) {
  if (!sig.contentHash) return 'legacy';
  const expectedId = makeIdHash(sig.name, sig.role, sig.ts);
  const expectedContent = makeContentHash(fullText);
  const idOk      = sig.idHash      === expectedId;
  const contentOk = sig.contentHash === expectedContent;
  if (idOk && contentOk) return 'valid';
  if (!idOk && !contentOk) return 'tampered';
  if (!idOk) return 'tampered-id';
  return 'tampered-content';
}

// ── Output helpers ────────────────────────────────────────────────────────────

const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const GRAY   = '\x1b[90m';

const c = (color, text) => `${color}${text}${RESET}`;

// ── Validator ─────────────────────────────────────────────────────────────────

function validateFile(filePath) {
  let text;
  try {
    text = readFileSync(filePath, 'utf-8');
  } catch (e) {
    console.error(c(RED, `  ✗ Cannot read file: ${filePath}`));
    return { valid: 0, tampered: 0, legacy: 0, error: true };
  }

  const sigs = parseSigs(text);
  if (!sigs.length) return { valid: 0, tampered: 0, legacy: 0, noSigs: true };

  let valid = 0, tampered = 0, legacy = 0;

  console.log(`\n${c(BOLD, filePath)}`);

  for (const sig of sigs) {
    const result = verifySig(sig, text);
    const lock = sig.isLock ? ' 🔐' : '';
    const label = `${sig.name} — ${sig.role} | ${sig.ts}${lock}`;

    if (result === 'valid') {
      console.log(`  ${c(GREEN, '✓')} ${label}`);
      if (sig.isLock) console.log(`    ${c(CYAN, '→ Lock signature — document was read-only when signed')}`);
      valid++;
    } else if (result.startsWith('tampered')) {
      const expId      = makeIdHash(sig.name, sig.role, sig.ts);
      const expContent = makeContentHash(text);
      const idFailed      = result === 'tampered-id'      || result === 'tampered';
      const contentFailed = result === 'tampered-content' || result === 'tampered';

      const reason =
        result === 'tampered-id'      ? 'identity hash mismatch'          :
        result === 'tampered-content' ? 'content hash mismatch'           :
                                        'both hashes mismatched';

      console.log(`  ${c(RED, '✗ TAMPERED')} ${label}`);
      console.log(`    ${c(RED, `→ ${reason}`)}`);
      console.log(`    ${c(GRAY, 'id hash   expected :')} ${expId}${idFailed      ? c(RED, ` ← stored: ${sig.idHash}`)      : c(GREEN, ' ✓')}`);
      console.log(`    ${c(GRAY, 'content   expected :')} ${expContent}${contentFailed ? c(RED, ` ← stored: ${sig.contentHash}`) : c(GREEN, ' ✓')}`);
      tampered++;
    } else {
      console.log(`  ${c(YELLOW, '?')} ${label} ${c(GRAY, '(legacy format — no content hash)')}`);
      legacy++;
    }
  }

  return { valid, tampered, legacy };
}

// ── CLI ───────────────────────────────────────────────────────────────────────

const HELP = `
${c(BOLD, 'Obsidian Signature Validator')}

Verifies the integrity of signatures in Markdown files.
Uses the same FNV-1a 32-bit algorithm as the Obsidian Signature plugin.

${c(BOLD, 'Usage:')}
  node verify.mjs <file.md> [file2.md ...]
  node verify.mjs --dir <folder>
  node verify.mjs --hash <idHash.contentHash> <file.md>
  node verify.mjs --help

${c(BOLD, 'Output legend:')}
  ${c(GREEN, '✓')}  Valid — document not modified after signing
  ${c(RED, '✗')}  Tampered — identity or content hash mismatch (detail shown per sig)
  ${c(YELLOW, '?')}  Legacy — no content hash (cannot verify integrity)

${c(BOLD, 'Exit codes:')}
  0 — all signatures valid (or none found)
  1 — tampered signatures detected
  2 — only legacy signatures (cannot verify)

${c(BOLD, 'Validate a specific hash (--hash):')}
  Checks whether a given idHash.contentHash is consistent with a file's content.
  Useful for verifying a signature you copied without loading Obsidian.

  Example:
    node verify.mjs --hash a3f2b1c4.e8d9f7a2 nota.md

${c(BOLD, 'Algorithm:')}
  id hash      = FNV-1a32(name + "|" + role + "|" + timestamp)
  content hash = FNV-1a32(docText with all [SIG:...] blocks and placeholders stripped)
  signature    = [PREFIX: name - role | timestamp | idHash.contentHash]
`;

function collectFiles(paths) {
  const files = [];
  for (const p of paths) {
    const abs = resolve(p);
    const stat = statSync(abs, { throwIfNoEntry: false });
    if (!stat) { console.error(c(RED, `Not found: ${p}`)); continue; }
    if (stat.isDirectory()) {
      readdirSync(abs).filter(f => extname(f) === '.md').forEach(f => files.push(join(abs, f)));
    } else {
      files.push(abs);
    }
  }
  return files;
}

const args = process.argv.slice(2);

if (!args.length || args[0] === '--help' || args[0] === '-h') {
  console.log(HELP);
  process.exit(0);
}

// ── Subcomando --hash ─────────────────────────────────────────────────────────

if (args[0] === '--hash') {
  const hashArg = args[1];
  const filePath = args[2];
  if (!hashArg || !filePath) {
    console.error(c(RED, 'Usage: node verify.mjs --hash <idHash.contentHash> <file.md>'));
    process.exit(1);
  }
  const parts = hashArg.split('.');
  if (parts.length !== 2 || !/^[a-f0-9]{8}$/.test(parts[0]) || !/^[a-f0-9]{8}$/.test(parts[1])) {
    console.error(c(RED, `Invalid hash format: "${hashArg}". Expected: xxxxxxxx.xxxxxxxx`));
    process.exit(1);
  }
  const [storedId, storedContent] = parts;
  let text;
  try { text = readFileSync(resolve(filePath), 'utf-8'); }
  catch (e) { console.error(c(RED, `Cannot read file: ${filePath}`)); process.exit(1); }

  const actualContent = makeContentHash(text);
  console.log(`\n${c(BOLD, 'Hash Validation')}`);
  console.log(`  File            : ${filePath}`);
  console.log(`  Input hash      : ${hashArg}`);
  console.log(`  Content hash    : ${storedContent}  →  computed: ${actualContent}`);

  if (actualContent === storedContent) {
    console.log(`\n  ${c(GREEN, '✅ Content hash matches — document is authentic.')}\n`);
    process.exit(0);
  } else {
    console.log(`\n  ${c(RED, '❌ Content hash MISMATCH — document may have been altered.')}\n`);
    process.exit(1);
  }
}

// ── Modos normais ─────────────────────────────────────────────────────────────

let targets = [];
if (args[0] === '--dir') {
  if (!args[1]) { console.error(c(RED, 'Missing directory path after --dir')); process.exit(1); }
  targets = collectFiles([args[1]]);
} else {
  targets = collectFiles(args);
}

if (!targets.length) {
  console.error(c(RED, 'No Markdown files found.'));
  process.exit(0);
}

let totalValid = 0, totalTampered = 0, totalLegacy = 0, totalFiles = 0;

for (const file of targets) {
  const { valid, tampered, legacy, noSigs, error } = validateFile(file);
  if (noSigs) {
    console.log(`\n${c(GRAY, file + ' — no signatures')}`);
    continue;
  }
  if (error) continue;
  totalFiles++;
  totalValid += valid; totalTampered += tampered; totalLegacy += legacy;
}

// Summary
console.log(`\n${c(BOLD, '─── Summary ───────────────────────────────────')}`);
console.log(`  Files with signatures : ${totalFiles}`);
console.log(`  ${c(GREEN, '✓ Valid              :')} ${totalValid}`);
if (totalTampered > 0) console.log(`  ${c(RED, '✗ Tampered           :')} ${totalTampered}`);
if (totalLegacy > 0) console.log(`  ${c(YELLOW, '? Legacy (unverifiable):')} ${totalLegacy}`);
console.log();

if (totalTampered > 0) process.exit(1);
if (totalLegacy > 0 && totalValid === 0) process.exit(2);
process.exit(0);
