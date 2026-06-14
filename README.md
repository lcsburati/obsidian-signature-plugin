# Obsidian Signature Plugin

> ⚠️ **AI-generated project** — Built entirely by an AI assistant (Claude, by Anthropic), guided only by human direction and requirements. No manual code was written. The concept, feature decisions, and testing were provided by the human author.

Sign notes inline with name, role, timestamp and a verifiable hash — for internal control and accountability. Signatures are cryptographically tied to the document content: any external edit is automatically detected.

---

## Features

- **Multilingual trigger tags** — each language has its own tag:
  - English: `[signature]` → `[SIGNED: Name - Role | 2026-06-14 10:30 | a1b2c3d4.e5f67890]`
  - Portuguese: `[assinatura]` → `[ASSINADO: Nome - Cargo | 2026-06-14 10:30 | a1b2c3d4.e5f67890]`
  - Chinese: `[签名]` → `[已签名: 姓名 - 职位 | 2026-06-14 10:30 | a1b2c3d4.e5f67890]`
- **All tags detected universally** — any tag works regardless of language setting
- **Content-aware hash** — signature hash commits to the document content; any edit after signing is detectable
- **Tamper detection** — visual indicators on signatures (green = valid, red = tampered, yellow = legacy)
- **Auto-verify on file open** — detects tampering as soon as you open a note in Obsidian
- **Lock mode per signer** — a lock signer makes the entire document read-only in Obsidian
- **External validation** — standalone `verify.mjs` script to validate signatures outside Obsidian
- **Password protection per signer** — optional; stored as FNV-1a hash (not recoverable)
- **Email notifications via SMTP** — on signature applied and/or on tamper detected
- **3-language interface** — English, Português (pt-BR), 中文

---

## Signature Format

```
[SIGNED: Name - Role | 2026-06-14 10:30 | idHash.contentHash]
```

| Field | Value |
|-------|-------|
| `idHash` | `FNV-1a32(name + "\|" + role + "\|" + timestamp)` — commits to the signer identity |
| `contentHash` | `FNV-1a32(docText with all signatures stripped, whitespace normalized)` — commits to the document content |

**Lock signatures** use the `LOCKED` prefix and make the document read-only:
```
[LOCKED: Name - Role | 2026-06-14 10:30 | idHash.contentHash]
```

---

## Visual Indicators (in Obsidian editor)

| Color | Meaning |
|-------|---------|
| 🟢 Green | Signature valid — document unchanged since signing |
| 🔵 Purple/underline | Lock signature active — document is read-only |
| 🔴 Red + strikethrough | **Tampered** — document was edited after signing |
| 🟡 Yellow/dashed | Legacy format — no content hash, cannot verify |

Hover over any signature to see a tooltip with the status.

---

## External Validation

Validate signatures from the command line — no Obsidian needed:

```bash
# Single file
node verify.mjs note.md

# Multiple files
node verify.mjs doc1.md doc2.md doc3.md

# Entire folder
node verify.mjs --dir /path/to/vault
```

**Output:**
```
note.md
  ✓ Lucas Burati — Developer | 2026-06-14 10:30
  ✗ TAMPERED Alice — Manager | 2026-06-13 09:00
    Expected content hash: 2963b0de
    Stored  content hash : cefeb018 ← mismatch

─── Summary ───
  Files with signatures : 1
  ✓ Valid              : 1
  ✗ Tampered           : 1
```

**Exit codes:** `0` = all valid · `1` = tampered found · `2` = only legacy (unverifiable)

### How to verify manually

The algorithm is simple enough to implement in any language:

```js
// FNV-1a 32-bit
function shortHash(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// Strip signature blocks and normalize whitespace
function stripSigs(text) {
  return text
    .replace(/\[(ASSINADO|SIGNED|已签名|BLOQUEADO|LOCKED|已锁定): [^\]]+\]/g, '')
    .replace(/\[(assinatura|signature|签名)\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Given a signature and the full document text:
const expectedIdHash      = shortHash(name + '|' + role + '|' + timestamp);
const expectedContentHash = shortHash(stripSigs(fullDocumentText));
const isValid = storedIdHash === expectedIdHash && storedContentHash === expectedContentHash;
```

---

## Lock Mode

Enable **"Lock file on sign"** for a signer in Settings. When that signer applies a signature:
- The prefix becomes `LOCKED` instead of `SIGNED`
- The entire document becomes **read-only** in Obsidian's editor (CM6 transaction filter blocks all changes)
- To edit again: **Command Palette → "Remove signature at cursor"** (requires password if set)
- External edits to the `.md` file are still detectable via tamper detection

---

## Installation (manual)

1. Download or build `main.js`, `manifest.json`, and `styles.css`
2. Copy to `<your-vault>/.obsidian/plugins/obsidian-signature/`
3. In Obsidian: **Settings → Community plugins → turn off Restricted mode → enable Signature**

### Build from source

```bash
npm install --legacy-peer-deps
npm run build
```

> ⚠️ The `node_modules` directory is platform-specific. If you move files between Windows and macOS/Linux, run `npm install --legacy-peer-deps` again on the destination machine before building.

---

## Usage

1. Write `[signature]` anywhere in a note
2. Click the highlighted text in the editor
3. If multiple signers are configured, select one
4. If the signer has a password, confirm it (max 3 attempts)
5. The tag is replaced inline with the full signature block

To **remove** a signature: place cursor on the signature line → **Command Palette → "Remove signature at cursor"**

To **verify**: **Command Palette → "Verify signatures in current note"**

---

## Settings

Open **Settings → Signature**:

| Section | What it does |
|---------|-------------|
| Language | Switch interface: English, pt-BR, 中文 |
| Verify on open | Auto-check signatures every time a note is opened |
| Signers | Add name, role, optional password, lock mode toggle |
| Email Notifications | SMTP config, recipients, tamper alerts |

---

## Email Notifications

- Sends email on signature applied (if enabled)
- Sends tamper alert email on file open if tampering is detected (separate toggle)
- Supports any SMTP server (Gmail, Outlook, custom)
- For Gmail: use an **App Password** at `myaccount.google.com → Security → App passwords`
- Test connection with **"Send test email"** — automatically enables notifications on success

> ⚠️ SMTP password stored as plain text in `data.json`. Use an App Password. `data.json` is in `.gitignore`.

---

## Security Notes

- Signer passwords: **FNV-1a 32-bit hashes** — not reversible, not recoverable
- Signature hashes: FNV-1a 32-bit — lightweight, not cryptographically strong (suitable for internal control, not legal/forensic use)
- Lock mode blocks edits **within Obsidian** only — external `.md` edits are possible but detectable via content hash
- This plugin provides **internal control and accountability**, not legally valid signatures

---

## Tech Stack

TypeScript · esbuild · CodeMirror 6 (via Obsidian) · nodemailer

---

## Other Languages

- [Português (pt-BR)](README.pt-BR.md)
- [中文](README.zh.md)

---

## AI Attribution

This plugin was conceived and directed by **Lucas Burati** and implemented entirely by **Claude** (Anthropic's AI assistant). All code, architecture, and documentation were AI-generated based on human requirements and feedback. No line of code was written manually.
