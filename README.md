# Obsidian Signature Plugin

> ⚠️ **AI-generated project** — This plugin was built entirely by an AI assistant (Claude, by Anthropic), guided only by human direction and requirements. No manual code was written. The concept, feature decisions, and testing were provided by the human author.

Sign notes inline with name, role, timestamp and a unique hash — for internal control and accountability, without any official legal value.

---

## Features

- **Multilingual trigger tags** — each language has its own tag:
  - English: `[signature]` → `[SIGNED: Name - Role | 2026-06-12 14:32 | a1b2c3d4]`
  - Portuguese: `[assinatura]` → `[ASSINADO: Nome - Cargo | 2026-06-12 14:32 | a1b2c3d4]`
  - Chinese: `[签名]` → `[已签名: 姓名 - 职位 | 2026-06-12 14:32 | a1b2c3d4]`
- **All tags are detected universally** — you can use any tag regardless of the active language setting
- **Password protection per signer** — optional; stored as an FNV-1a hash (not recoverable)
- **Protected signatures** — direct text editing of `[SIGNED: ...]` blocks is blocked by a CM6 transaction filter
- **Remove signature command** — `Ctrl+P` → *Remove signature at cursor* — requires password if set
- **Email notifications via SMTP** — optional; fires after each signature is applied
- **3-language interface** — English, Português (pt-BR), 中文

---

## Installation (manual)

1. Download or build `main.js`, `manifest.json`, and `styles.css`
2. Copy them to `<your-vault>/.obsidian/plugins/obsidian-signature/`
3. In Obsidian: **Settings → Community plugins → turn off Restricted mode → enable Signature**

### Build from source

```bash
npm install --legacy-peer-deps
npm run build
```

---

## Usage

1. Write `[signature]` anywhere in a note
2. Click the highlighted text in the editor
3. If multiple signers are configured, select one from the list
4. If the signer has a password, confirm it (max 3 attempts)
5. The tag is replaced inline with the full signature block

To **remove** a signature: place cursor on the signature line → `Ctrl+P` → **Remove signature at cursor**

---

## Settings

Open **Settings → Signature**:

| Section | What it does |
|---------|-------------|
| Language | Switch interface between English, pt-BR, 中文 |
| Signers | Add name, role, optional password per signer |
| Email Notifications | Configure SMTP and recipient list |

---

## Email notifications

- Supports any SMTP server (Gmail, Outlook, custom)
- For Gmail: use an **App Password** — go to `myaccount.google.com → Security → App passwords`
- Test the connection with the **Send test email** button before enabling

> ⚠️ The SMTP password is stored in plain text in `data.json`. **Use an App Password, never your main account password.** `data.json` is in `.gitignore` by default.

---

## Security notes

- Signer passwords are stored as **FNV-1a 32-bit hashes** — not reversible, not recoverable
- The signature hash (`a1b2c3d4`) is derived from name + role + timestamp — it's a uniqueness identifier, not a cryptographic proof
- This plugin provides **internal control**, not legally valid signatures

---

## Tech stack

- TypeScript + esbuild
- CodeMirror 6 (via Obsidian)
- nodemailer (SMTP notifications)

---

## Other languages

- [Português (pt-BR)](README.pt-BR.md)
- [中文](README.zh.md)

---

## AI Attribution

This plugin was conceived and directed by **Lucas Burati** and implemented entirely by **Claude** (Anthropic's AI assistant). All code, architecture, and documentation were AI-generated based on human requirements and feedback. No line of code was written manually.
