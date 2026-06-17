# Obsidian Signature

> ⚠️ **AI-generated project** — This plugin was built entirely by an AI assistant (Claude, by Anthropic), guided by human direction and requirements only. No code was written manually. The concept, feature decisions, and testing were provided by the human author.

Sign notes inline with tamper-proof hashes. Detects tampering with precision — pointing out exactly which signature failed and why.

---

## Why this plugin exists

Our team is going through a period of documentation standardization. As part of that process, we needed a reliable way to track **who wrote what, whether leadership reviewed it, and who refactored the documentation** when changes were required.

We use Obsidian as our shared knowledge base because it maps naturally to a folder on a shared server — everyone on the team can read and edit notes without friction, and it plays well with AI-assisted workflows.

The problem was accountability: a Markdown file tells you what changed, but not *who approved it* or *whether it went through review*. Traditional solutions (PDF exports, Word with tracked changes, external signing tools) are too heavy for a fast-moving documentation workflow.

This plugin solves that by embedding lightweight inline signatures directly in the note. Each signature captures the signer's identity, timestamp, and a hash of the document content at the time of signing. If the document is modified after signing, the hash no longer matches — making any post-signature change immediately visible.

**These signatures carry no legal weight.** Their value is practical: they create a lightweight audit trail directly inside the documentation, making it clear at a glance who touched a document, in what role, and whether the content has changed since they signed off on it.

---

## Installation via BRAT

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) from the Obsidian community store.
2. Open BRAT settings → **Add Beta Plugin**.
3. Paste: `https://github.com/lcsburati/obsidian-sinature-plugin`
4. Click **Add Plugin** — BRAT will install and keep it updated automatically.

---

## How it works

### Signing a note

Type one of the placeholder tags anywhere in the document:

| Language | Tag |
|----------|-----|
| Portuguese | `[assinatura]` |
| English | `[signature]` |
| Chinese | `[签名]` |

Click the tag. If more than one signer is configured, the picker appears. The tag is replaced by a block like:

```
[SIGNED: Lucas Burati - Manager | 2026-06-15 14:32 | a3f2b1c4.e8d9f7a2]
```

The block contains two FNV-1a 32-bit hashes:
- **idHash** (`a3f2b1c4`) — identity hash: `fnv32a(name + "|" + role + "|" + timestamp)`
- **contentHash** (`e8d9f7a2`) — content hash: `fnv32a(document text with all signatures stripped)`

Any change to the document after signing invalidates the `contentHash`.

### LOCK mode

If the signer has **"Lock document on sign"** enabled, the block uses the `[LOCKED: ...]` prefix. A document with any valid LOCK signature becomes completely read-only — no edits are possible until the signature is removed.

---

## Commands

| Command | What it does |
|---------|-------------|
| `Verify signatures in current note` | Checks all signatures and reports **which** one failed and **why** (identity hash? content hash? both?) |
| `Remove signature at cursor` | Removes the signature under the cursor. Prompts for password if the signer is protected. |
| `Open Signature Dashboard` | Opens the sidebar panel listing all signatures across the vault with their status |
| `Validate signature by hash` | Opens a modal to manually validate a hash pair against pasted content |

---

## Signature Dashboard

Click the 🖊 ribbon icon or use **"Open Signature Dashboard"** to open the sidebar panel.

The panel scans all Markdown files in the vault and lists each signature with:

| Column | Content |
|--------|---------|
| Icon | ✅ Valid · ❌ Tampered · ⚠️ Legacy · 🔒 Locked |
| Name & role | From the signer |
| Date | Signature timestamp |
| Status | Text label |

**Click any row** → opens the corresponding note and shows a detail modal with all signature info (hashes, file, full status).

**Status filter** at the top lets you view only tampered, legacy, etc.

**↺ button** refreshes the vault scan.

---

## Tamper report

When verification detects tampering, the notice shows exactly what failed for each signature:

```
❌ 2 tampered signature(s)!
  • Lucas Burati (Manager): content hash mismatch
  • Maria Santos (Director): both hashes mismatched
```

Possible failure types:
- **identity hash mismatch** — name/role/timestamp was altered inside the block
- **content hash mismatch** — document body was changed after signing
- **both hashes mismatched** — both the block and the content were modified

---

## Hash validation

Use **"Validate signature by hash"** to verify a signature outside the original note context.

**Inputs:**
1. The hash pair: `xxxxxxxx.xxxxxxxx` (copied directly from the `[SIGNED: ...]` block)
2. The document content **without** signatures (paste the plain text)

The plugin recomputes `fnv32a(stripSignatures(content))` and compares it to the stored `contentHash`.

**CLI alternative** — use `verify.mjs` without opening Obsidian:
```bash
node verify.mjs note.md
node verify.mjs --dir ./vault
node verify.mjs --hash a3f2b1c4.e8d9f7a2 note.md
```

---

## Settings

Settings are split into two tabs:

### ✍️ Signers tab

Each signer has a collapsible card (closed by default). Click to expand:

| Field | Description |
|-------|-------------|
| Name | Displayed in the signature block |
| Role | Displayed in the signature block |
| Password (optional) | If set, required to remove the signature |
| **Administrator** | Access to the Dashboard and permission to remove any signature |
| **Lock on sign** | Uses LOCKED prefix and makes the document read-only |

Password management uses separate modals: Set / Change (requires current password) / Remove (requires current password).

### ⚙️ Manager tab

- **Language** — pt-BR / English / 中文
- **Verify on open** — automatically check signatures when opening any note
- **Email notifications** — SMTP config with individual recipient rows (add/remove per address) and tamper alert toggle

---

## Signature block format

```
[SIGNED: Name - Role | YYYY-MM-DD HH:MM | idHash.contentHash]
[LOCKED: Name - Role | YYYY-MM-DD HH:MM | idHash.contentHash]
```

**Backward compatibility:** blocks in the old format (no `contentHash`) are recognized as `⚠️ Legacy` — displayed without error but without integrity verification.

---

## Hash algorithm

```
fnv32a(str):
  hash = 2166136261       // FNV offset basis
  for each char:
    hash ^= charCode
    hash *= 16777619      // FNV prime
    hash &= 0xFFFFFFFF
  return hash.toString(16).padStart(8, '0')

idHash      = fnv32a(name + "|" + role + "|" + timestamp)
contentHash = fnv32a(document with all signature blocks and placeholders stripped)
```

> FNV-1a 32-bit is fast and sufficient for informal tamper detection. For legal or security-critical use, consider SHA-256.

---

## Language support

Recognized prefixes in parsing:

| Prefix | Language |
|--------|----------|
| `ASSINADO` / `BLOQUEADO` | Portuguese |
| `SIGNED` / `LOCKED` | English |
| `已签名` / `已锁定` | Chinese |

The language for new blocks follows the **Language** setting.

---

## Changelog

### v2.0.0
- **Signature Dashboard** — sidebar panel scanning the entire vault, status filter, click to navigate and view details
- **Precise tamper report** — points to which hash failed (identity, content, or both) per signer
- **Admin concept** — per-signer toggle; admins access the dashboard and can remove any signature
- **Signer detail modal** — compact picker with `···` button to view details without cluttering the list
- **"Validate by hash" command** — validate a signature by pasting hashes and content manually
- **Detailed verify-on-open** — same precise report when opening notes automatically
- **Settings tabs** — Signers / Manager split; signers use collapsible cards with status badges
- **Email recipients** — individual rows with remove button, restored from v1
- **verify.mjs** — new `--hash` subcommand, distinguishes tampered-id vs tampered-content
- Ribbon icon for quick Dashboard access

### v1.0.0
- Inline signing with FNV-1a (idHash + contentHash)
- LOCK mode (document read-only after signing)
- Manual verify command
- pt-BR, en, zh support
