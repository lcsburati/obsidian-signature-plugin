import {
  App,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
} from 'obsidian';
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view';
import { EditorState, RangeSetBuilder } from '@codemirror/state';
import type { Transporter } from 'nodemailer';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Signer {
  name: string;
  role: string;
  passwordHash: string;
}

interface EmailConfig {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  recipients: string[];
}

interface SignatureSettings {
  signers: Signer[];
  language: 'pt-BR' | 'en' | 'zh';
  email: EmailConfig;
}

const DEFAULT_EMAIL: EmailConfig = {
  enabled: false, smtpHost: '', smtpPort: 587,
  smtpUser: '', smtpPass: '', recipients: [],
};

const DEFAULT_SETTINGS: SignatureSettings = {
  signers: [], language: 'en', email: { ...DEFAULT_EMAIL },
};

// ── i18n ─────────────────────────────────────────────────────────────────────

interface Locale {
  // Meta
  placeholder_tag: string;    // tag que o utilizador escreve na nota
  sig_prefix: string;         // prefixo do bloco assinado ex: SIGNED, ASSINADO, 已签名
  // Settings
  settings_title: string; settings_desc: string;
  signer_n: (n: number) => string; signer_name_desc: string;
  name_placeholder: string; role_placeholder: string;
  password_label: string; no_password_desc: string; set_password_btn: string;
  has_password_desc: string; change_password_btn: string; remove_password_btn: string;
  delete_label: string; delete_desc_protected: string; delete_desc_free: string;
  delete_btn: string; add_signer_btn: string; language_label: string; language_desc: string;
  // Sign flow
  pick_signer_title: string; sign_pwd_title: (n: string) => string;
  sign_pwd_prompt: (n: string) => string; sign_btn: string;
  wrong_pwd: (n: number) => string; too_many_attempts: string; no_signers: string;
  // Set password
  set_pwd_title: (n: string) => string; new_pwd_label: string; confirm_pwd_label: string;
  new_pwd_placeholder: string; confirm_pwd_placeholder: string; set_pwd_btn: string;
  pwd_empty: string; pwd_mismatch: string; pwd_set_ok: (n: string) => string;
  // Change password
  change_pwd_title: (n: string) => string; current_pwd_label: string;
  current_pwd_placeholder: string; change_pwd_btn: string;
  wrong_current_pwd: (n: number) => string; pwd_changed_ok: (n: string) => string;
  new_pwd_empty: string;
  // Protected action
  remove_pwd_title: (n: string) => string; remove_pwd_desc: (n: string) => string;
  remove_pwd_btn: string; pwd_removed_ok: (n: string) => string;
  delete_title: (n: string) => string; delete_desc_modal: (n: string) => string;
  delete_confirm_btn: string; signer_deleted: (n: string) => string;
  pwd_field_placeholder: (n: string) => string;
  // Email
  email_section_title: string; email_enabled_label: string; email_enabled_desc: string;
  email_warning: string; email_smtp_host: string; email_smtp_host_desc: string;
  email_smtp_port: string; email_smtp_port_desc: string; email_smtp_user: string;
  email_smtp_user_desc: string; email_smtp_pass: string; email_smtp_pass_desc: string;
  email_recipients_label: string; email_recipients_desc: string;
  email_recipient_placeholder: string; email_add_recipient_btn: string;
  email_remove_recipient_tooltip: string; email_test_btn: string;
  email_test_ok: string; email_test_fail: (e: string) => string;
  email_notify_ok: string; email_notify_fail: (e: string) => string;
  email_subject: (note: string) => string;
  email_body_text: (note: string, signer: string, ts: string) => string;
  email_test_subject: string; email_test_body: string;
  email_no_recipients: string; email_incomplete_config: string;
  // Signature protection
  sig_protected: string; remove_sig_command: string;
  remove_sig_title: (n: string) => string; remove_sig_desc: (n: string, ts: string) => string;
  remove_sig_no_sig: string; remove_sig_ok: string;
  remove_sig_confirm_unknown: string; remove_sig_confirm_btn: string;
  remove_sig_confirm_no_pwd: string;
}

const LOCALES: Record<SignatureSettings['language'], Locale> = {
  'en': {
    placeholder_tag: 'signature',
    sig_prefix: 'SIGNED',
    settings_title: 'Signature — Settings',
    settings_desc: 'Password protects changes and deletion. Stored as hash — not recoverable if lost.',
    signer_n: (n) => `Signer ${n}`, signer_name_desc: 'Name and role displayed in the signature.',
    name_placeholder: 'Full name', role_placeholder: 'Role / position',
    password_label: 'Password', no_password_desc: 'No protection — anyone can sign as this person.',
    set_password_btn: 'Set password', has_password_desc: '🔒 Password set. Changing or removing requires current password.',
    change_password_btn: 'Change password', remove_password_btn: 'Remove password',
    delete_label: 'Delete signer', delete_desc_protected: "Requires the signer's password to confirm.",
    delete_desc_free: 'Permanently removes this signer.',
    delete_btn: 'Delete', add_signer_btn: '+ Add signer',
    language_label: 'Language', language_desc: 'Plugin interface language.',
    pick_signer_title: 'Select signer',
    sign_pwd_title: (n) => `Confirm identity — ${n}`, sign_pwd_prompt: (n) => `Password for ${n}`,
    sign_btn: 'Sign', wrong_pwd: (n) => `Wrong password. Attempts remaining: ${n}`,
    too_many_attempts: 'Too many incorrect attempts. Operation cancelled.',
    no_signers: 'No signers configured. Go to Settings → Signature.',
    set_pwd_title: (n) => `Set password — ${n}`, new_pwd_label: 'New password',
    confirm_pwd_label: 'Confirm password', new_pwd_placeholder: 'Enter new password',
    confirm_pwd_placeholder: 'Repeat password', set_pwd_btn: 'Set password',
    pwd_empty: 'Password cannot be empty.', pwd_mismatch: 'Passwords do not match.',
    pwd_set_ok: (n) => `Password set for ${n}.`,
    change_pwd_title: (n) => `Change password — ${n}`, current_pwd_label: 'Current password',
    current_pwd_placeholder: 'Current password', change_pwd_btn: 'Change password',
    wrong_current_pwd: (n) => `Wrong current password. Attempts remaining: ${n}`,
    pwd_changed_ok: (n) => `Password changed for ${n}.`, new_pwd_empty: 'New password cannot be empty.',
    remove_pwd_title: (n) => `Remove password — ${n}`,
    remove_pwd_desc: (n) => `Enter ${n}'s current password to remove protection.`,
    remove_pwd_btn: 'Remove password', pwd_removed_ok: (n) => `Password removed from ${n}.`,
    delete_title: (n) => `Delete signer — ${n}`,
    delete_desc_modal: (n) => `Enter ${n}'s password to delete them.`,
    delete_confirm_btn: 'Delete', signer_deleted: (n) => `Signer ${n} deleted.`,
    pwd_field_placeholder: (n) => `Password for ${n}`,
    email_section_title: '📧 Email Notifications', email_enabled_label: 'Enable notifications',
    email_enabled_desc: 'Sends an email to registered recipients whenever a signature is applied.',
    email_warning: '⚠️ SMTP password is stored as plain text in data.json. Use an App Password — never your main account password.',
    email_smtp_host: 'SMTP Server', email_smtp_host_desc: 'e.g. smtp.gmail.com',
    email_smtp_port: 'SMTP Port', email_smtp_port_desc: '587 (TLS) or 465 (SSL)',
    email_smtp_user: 'SMTP User', email_smtp_user_desc: 'Your email address.',
    email_smtp_pass: 'SMTP Password', email_smtp_pass_desc: 'Use an App Password. Stored unencrypted.',
    email_recipients_label: 'Recipients', email_recipients_desc: 'Emails that will receive signature notifications.',
    email_recipient_placeholder: 'email@example.com', email_add_recipient_btn: '+ Add recipient',
    email_remove_recipient_tooltip: 'Remove', email_test_btn: 'Send test email',
    email_test_ok: '✅ Test email sent successfully.',
    email_test_fail: (e) => `❌ Send error: ${e}`,
    email_notify_ok: '📧 Signature notification sent.',
    email_notify_fail: (e) => `⚠️ Email not sent: ${e}`,
    email_subject: (note) => `[Signature] ${note}`,
    email_body_text: (note, signer, ts) => `The note "${note}" was signed by ${signer} on ${ts}.`,
    email_test_subject: '[Signature] Test email',
    email_test_body: 'This is a test email from the Obsidian Signature plugin. Notifications are working correctly.',
    email_no_recipients: 'No recipients configured.',
    email_incomplete_config: 'Configure SMTP server, user and password before enabling.',
    sig_protected: '🔒 Signatures are protected from direct editing. Use: Command Palette → "Remove signature".',
    remove_sig_command: 'Remove signature at cursor',
    remove_sig_title: (n) => `Remove signature — ${n}`,
    remove_sig_desc: (n, ts) => `Signature by ${n} applied on ${ts}.`,
    remove_sig_no_sig: 'No signature found at cursor position.',
    remove_sig_ok: '🗑️ Signature removed.',
    remove_sig_confirm_unknown: 'Signer not found in settings. Confirm removal?',
    remove_sig_confirm_btn: 'Remove',
    remove_sig_confirm_no_pwd: 'This signer has no password. Confirm removal?',
  },
  'pt-BR': {
    placeholder_tag: 'assinatura',
    sig_prefix: 'ASSINADO',
    settings_title: 'Assinatura — Configurações',
    settings_desc: 'Senha protege alterações e exclusão. Armazenada como hash — não recuperável se perdida.',
    signer_n: (n) => `Assinante ${n}`, signer_name_desc: 'Nome e cargo exibidos na assinatura.',
    name_placeholder: 'Nome completo', role_placeholder: 'Cargo / função',
    password_label: 'Senha', no_password_desc: 'Sem proteção — qualquer um pode assinar como este assinante.',
    set_password_btn: 'Definir senha', has_password_desc: '🔒 Senha definida. Alterar ou remover exige senha atual.',
    change_password_btn: 'Alterar senha', remove_password_btn: 'Remover senha',
    delete_label: 'Excluir assinante', delete_desc_protected: 'Exige a senha do assinante para confirmar.',
    delete_desc_free: 'Remove permanentemente este assinante.',
    delete_btn: 'Excluir', add_signer_btn: '+ Adicionar assinante',
    language_label: 'Idioma', language_desc: 'Idioma da interface do plugin.',
    pick_signer_title: 'Selecionar assinante',
    sign_pwd_title: (n) => `Confirmar identidade — ${n}`, sign_pwd_prompt: (n) => `Senha de ${n}`,
    sign_btn: 'Assinar', wrong_pwd: (n) => `Senha incorreta. Tentativas restantes: ${n}`,
    too_many_attempts: 'Muitas tentativas incorretas. Operação cancelada.',
    no_signers: 'Nenhum assinante configurado. Vá em Configurações → Assinatura.',
    set_pwd_title: (n) => `Definir senha — ${n}`, new_pwd_label: 'Nova senha',
    confirm_pwd_label: 'Confirmar senha', new_pwd_placeholder: 'Digite a nova senha',
    confirm_pwd_placeholder: 'Repita a senha', set_pwd_btn: 'Definir senha',
    pwd_empty: 'A senha não pode ser vazia.', pwd_mismatch: 'As senhas não coincidem.',
    pwd_set_ok: (n) => `Senha definida para ${n}.`,
    change_pwd_title: (n) => `Alterar senha — ${n}`, current_pwd_label: 'Senha atual',
    current_pwd_placeholder: 'Senha atual', change_pwd_btn: 'Alterar senha',
    wrong_current_pwd: (n) => `Senha atual incorreta. Tentativas restantes: ${n}`,
    pwd_changed_ok: (n) => `Senha alterada para ${n}.`, new_pwd_empty: 'A nova senha não pode ser vazia.',
    remove_pwd_title: (n) => `Remover senha — ${n}`,
    remove_pwd_desc: (n) => `Confirme a senha atual de ${n} para remover a proteção.`,
    remove_pwd_btn: 'Remover senha', pwd_removed_ok: (n) => `Senha removida de ${n}.`,
    delete_title: (n) => `Excluir assinante — ${n}`,
    delete_desc_modal: (n) => `Confirme a senha de ${n} para excluí-lo.`,
    delete_confirm_btn: 'Excluir', signer_deleted: (n) => `Assinante ${n} excluído.`,
    pwd_field_placeholder: (n) => `Senha de ${n}`,
    email_section_title: '📧 Notificações por Email', email_enabled_label: 'Ativar notificações',
    email_enabled_desc: 'Envia um email para os destinatários cadastrados sempre que uma assinatura for aplicada.',
    email_warning: '⚠️ A senha SMTP é armazenada em texto simples em data.json. Use uma senha de aplicativo (App Password), nunca sua senha principal.',
    email_smtp_host: 'Servidor SMTP', email_smtp_host_desc: 'Ex: smtp.gmail.com',
    email_smtp_port: 'Porta SMTP', email_smtp_port_desc: '587 (TLS) ou 465 (SSL)',
    email_smtp_user: 'Usuário SMTP', email_smtp_user_desc: 'Seu endereço de email.',
    email_smtp_pass: 'Senha SMTP', email_smtp_pass_desc: 'Use uma senha de aplicativo. Armazenada sem criptografia.',
    email_recipients_label: 'Destinatários', email_recipients_desc: 'Emails que receberão a notificação de assinatura.',
    email_recipient_placeholder: 'email@exemplo.com', email_add_recipient_btn: '+ Adicionar destinatário',
    email_remove_recipient_tooltip: 'Remover', email_test_btn: 'Enviar email de teste',
    email_test_ok: '✅ Email de teste enviado com sucesso.',
    email_test_fail: (e) => `❌ Erro ao enviar: ${e}`,
    email_notify_ok: '📧 Notificação de assinatura enviada.',
    email_notify_fail: (e) => `⚠️ Email não enviado: ${e}`,
    email_subject: (note) => `[Assinatura] ${note}`,
    email_body_text: (note, signer, ts) => `A nota "${note}" foi assinada por ${signer} em ${ts}.`,
    email_test_subject: '[Assinatura] Email de teste',
    email_test_body: 'Este é um email de teste do plugin Signature do Obsidian. As notificações estão funcionando corretamente.',
    email_no_recipients: 'Nenhum destinatário cadastrado.',
    email_incomplete_config: 'Configure servidor SMTP, usuário e senha antes de ativar.',
    sig_protected: '🔒 Assinaturas são protegidas contra edição direta. Use: Paleta de Comandos → "Remover assinatura".',
    remove_sig_command: 'Remover assinatura na posição do cursor',
    remove_sig_title: (n) => `Remover assinatura — ${n}`,
    remove_sig_desc: (n, ts) => `Assinatura de ${n} aplicada em ${ts}.`,
    remove_sig_no_sig: 'Nenhuma assinatura encontrada na posição do cursor.',
    remove_sig_ok: '🗑️ Assinatura removida.',
    remove_sig_confirm_unknown: 'Assinante não encontrado nas configurações. Confirmar remoção?',
    remove_sig_confirm_btn: 'Remover',
    remove_sig_confirm_no_pwd: 'Este assinante não tem senha. Confirmar remoção?',
  },
  'zh': {
    placeholder_tag: '签名',
    sig_prefix: '已签名',
    settings_title: '签名 — 设置',
    settings_desc: '密码保护修改和删除操作。以哈希值存储，丢失后无法恢复。',
    signer_n: (n) => `签署人 ${n}`, signer_name_desc: '签名中显示的姓名和职位。',
    name_placeholder: '全名', role_placeholder: '职位 / 职能',
    password_label: '密码', no_password_desc: '无保护——任何人都可以以此签署人身份签名。',
    set_password_btn: '设置密码', has_password_desc: '🔒 已设置密码。更改或删除需要输入当前密码。',
    change_password_btn: '更改密码', remove_password_btn: '删除密码',
    delete_label: '删除签署人', delete_desc_protected: '需要签署人密码确认。',
    delete_desc_free: '永久删除此签署人。',
    delete_btn: '删除', add_signer_btn: '+ 添加签署人',
    language_label: '语言', language_desc: '插件界面语言。',
    pick_signer_title: '选择签署人',
    sign_pwd_title: (n) => `确认身份 — ${n}`, sign_pwd_prompt: (n) => `${n} 的密码`,
    sign_btn: '签名', wrong_pwd: (n) => `密码错误，剩余尝试次数：${n}`,
    too_many_attempts: '尝试次数过多，操作已取消。',
    no_signers: '未配置签署人。请前往设置 → 签名。',
    set_pwd_title: (n) => `设置密码 — ${n}`, new_pwd_label: '新密码',
    confirm_pwd_label: '确认密码', new_pwd_placeholder: '输入新密码',
    confirm_pwd_placeholder: '重复密码', set_pwd_btn: '设置密码',
    pwd_empty: '密码不能为空。', pwd_mismatch: '两次输入的密码不一致。',
    pwd_set_ok: (n) => `已为 ${n} 设置密码。`,
    change_pwd_title: (n) => `更改密码 — ${n}`, current_pwd_label: '当前密码',
    current_pwd_placeholder: '当前密码', change_pwd_btn: '更改密码',
    wrong_current_pwd: (n) => `当前密码错误，剩余尝试次数：${n}`,
    pwd_changed_ok: (n) => `已更改 ${n} 的密码。`, new_pwd_empty: '新密码不能为空。',
    remove_pwd_title: (n) => `删除密码 — ${n}`,
    remove_pwd_desc: (n) => `请输入 ${n} 的当前密码以删除保护。`,
    remove_pwd_btn: '删除密码', pwd_removed_ok: (n) => `已删除 ${n} 的密码。`,
    delete_title: (n) => `删除签署人 — ${n}`,
    delete_desc_modal: (n) => `请输入 ${n} 的密码以确认删除。`,
    delete_confirm_btn: '删除', signer_deleted: (n) => `签署人 ${n} 已删除。`,
    pwd_field_placeholder: (n) => `${n} 的密码`,
    email_section_title: '📧 邮件通知', email_enabled_label: '启用通知',
    email_enabled_desc: '每次应用签名时，向已注册的收件人发送邮件。',
    email_warning: '⚠️ SMTP 密码以明文存储在 data.json 中。请使用应用专用密码（App Password），切勿使用主账户密码。',
    email_smtp_host: 'SMTP 服务器', email_smtp_host_desc: '例如：smtp.gmail.com',
    email_smtp_port: 'SMTP 端口', email_smtp_port_desc: '587（TLS）或 465（SSL）',
    email_smtp_user: 'SMTP 用户', email_smtp_user_desc: '您的电子邮件地址。',
    email_smtp_pass: 'SMTP 密码', email_smtp_pass_desc: '请使用应用专用密码，明文存储。',
    email_recipients_label: '收件人', email_recipients_desc: '将接收签名通知的邮件地址。',
    email_recipient_placeholder: 'email@example.com', email_add_recipient_btn: '+ 添加收件人',
    email_remove_recipient_tooltip: '删除', email_test_btn: '发送测试邮件',
    email_test_ok: '✅ 测试邮件发送成功。',
    email_test_fail: (e) => `❌ 发送失败：${e}`,
    email_notify_ok: '📧 签名通知已发送。',
    email_notify_fail: (e) => `⚠️ 邮件未发送：${e}`,
    email_subject: (note) => `[签名] ${note}`,
    email_body_text: (note, signer, ts) => `笔记"${note}"已由 ${signer} 于 ${ts} 签署。`,
    email_test_subject: '[签名] 测试邮件',
    email_test_body: '这是来自 Obsidian Signature 插件的测试邮件。通知功能运行正常。',
    email_no_recipients: '未配置收件人。',
    email_incomplete_config: '启用前请先配置 SMTP 服务器、用户名和密码。',
    sig_protected: '🔒 签名受保护，无法直接编辑。请使用：命令面板 → "删除签名"。',
    remove_sig_command: '删除光标处的签名',
    remove_sig_title: (n) => `删除签名 — ${n}`,
    remove_sig_desc: (n, ts) => `${n} 于 ${ts} 应用的签名。`,
    remove_sig_no_sig: '光标位置未找到签名。',
    remove_sig_ok: '🗑️ 签名已删除。',
    remove_sig_confirm_unknown: '在设置中未找到此签署人。确认删除？',
    remove_sig_confirm_btn: '删除',
    remove_sig_confirm_no_pwd: '此签署人未设置密码。确认删除？',
  },
};

// ── Utilitários ──────────────────────────────────────────────────────────────

function shortHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/**
 * Regex que detecta TODOS os placeholders (todos os idiomas).
 * O utilizador pode usar [assinatura], [signature] ou [签名] independentemente
 * do idioma configurado — a detecção é sempre universal.
 */
const ALL_PLACEHOLDER_RE = /\[(assinatura|signature|签名)\]/gi;

/**
 * Regex que detecta assinaturas JÁ APLICADAS (todos os prefixos).
 * Groups: 1=prefix, 2=name, 3=role, 4=timestamp, 5=hash
 */
const SIGNED_RE = /\[(ASSINADO|SIGNED|已签名): ([^\]|]+?) - ([^\]|]+?) \| ([^\]|]+?) \| ([^\]]+?)\]/g;

interface ParsedSig { from: number; to: number; name: string; role: string; ts: string; }

function findSignaturesInText(text: string, offset = 0): ParsedSig[] {
  const results: ParsedSig[] = [];
  SIGNED_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SIGNED_RE.exec(text)) !== null) {
    results.push({
      from: offset + m.index, to: offset + m.index + m[0].length,
      name: m[2].trim(), role: m[3].trim(), ts: m[4].trim(),
    });
  }
  return results;
}

function emailHtml(noteTitle: string, signerName: string, timestamp: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
<tr><td style="background:#7c3aed;padding:24px 32px;"><h1 style="margin:0;color:#fff;font-size:20px;font-weight:600;">✍️ Document Signed</h1></td></tr>
<tr><td style="padding:28px 32px;">
<table width="100%">
<tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
<span style="color:#6b7280;font-size:13px;display:block;margin-bottom:2px;">Note</span>
<span style="color:#111827;font-size:16px;font-weight:600;">${noteTitle}</span></td></tr>
<tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
<span style="color:#6b7280;font-size:13px;display:block;margin-bottom:2px;">Signed by</span>
<span style="color:#111827;font-size:15px;font-weight:500;">${signerName}</span></td></tr>
<tr><td style="padding:10px 0;">
<span style="color:#6b7280;font-size:13px;display:block;margin-bottom:2px;">Date / Time</span>
<span style="color:#111827;font-size:15px;">${timestamp}</span></td></tr>
</table></td></tr>
<tr><td style="padding:0 32px 24px;color:#9ca3af;font-size:12px;">Sent automatically by the <strong>Signature</strong> plugin for Obsidian.</td></tr>
</table></td></tr></table></body></html>`;
}

async function sendEmail(cfg: EmailConfig, subject: string, text: string, html: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodemailer = require('nodemailer') as typeof import('nodemailer');
  const t: Transporter = nodemailer.createTransport({
    host: cfg.smtpHost, port: cfg.smtpPort || 587, secure: cfg.smtpPort === 465,
    auth: { user: cfg.smtpUser, pass: cfg.smtpPass }, tls: { rejectUnauthorized: false },
  });
  await t.sendMail({ from: `"Obsidian Signature" <${cfg.smtpUser}>`, to: cfg.recipients.join(', '), subject, text, html });
}

async function notifySignature(plugin: SignaturePlugin, activeFile: TFile | null, signerName: string, timestamp: string): Promise<void> {
  const cfg = plugin.settings.email;
  const L = plugin.L;
  if (!cfg.enabled || !cfg.recipients.length || !cfg.smtpHost || !cfg.smtpUser || !cfg.smtpPass) return;
  const noteTitle = activeFile?.basename ?? '—';
  try {
    await sendEmail(cfg, L.email_subject(noteTitle), L.email_body_text(noteTitle, signerName, timestamp), emailHtml(noteTitle, signerName, timestamp));
    new Notice(L.email_notify_ok);
  } catch (err) {
    console.error('[Signature] Email error:', err);
    new Notice(L.email_notify_fail((err as Error).message));
  }
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function addPwdField(container: HTMLElement, label: string, placeholder: string, onReady: (input: HTMLInputElement) => void): HTMLInputElement {
  let inputEl!: HTMLInputElement;
  new Setting(container).setName(label).addText((t) => {
    t.inputEl.type = 'password'; t.inputEl.placeholder = placeholder;
    t.inputEl.addClass('sig-pwd-field'); inputEl = t.inputEl; onReady(inputEl);
  });
  return inputEl;
}

function createErrorEl(container: HTMLElement): HTMLElement {
  const el = container.createDiv({ cls: 'sig-error' }); el.hide(); return el;
}
function showError(el: HTMLElement, msg: string) { el.setText(msg); el.show(); }
function clearError(el: HTMLElement) { el.setText(''); el.hide(); }

// ── CM6: decorações dos placeholders ─────────────────────────────────────────

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const mark = Decoration.mark({ class: 'sig-placeholder' });
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    ALL_PLACEHOLDER_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = ALL_PLACEHOLDER_RE.exec(text)) !== null)
      builder.add(from + match.index, from + match.index + match[0].length, mark);
  }
  return builder.finish();
}

// ── CM6: filtro de proteção ───────────────────────────────────────────────────

function makeProtectionFilter(plugin: SignaturePlugin) {
  return EditorState.transactionFilter.of((tr) => {
    if (plugin.bypassProtection || !tr.docChanged) return tr;

    const text = tr.startState.doc.toString();
    const sigs = findSignaturesInText(text);
    if (!sigs.length) return tr;

    let blocked = false;
    tr.changes.iterChanges((fromA, toA) => {
      if (blocked) return;
      for (const s of sigs) {
        if (fromA < s.to && toA > s.from) { blocked = true; break; }
      }
    });

    if (blocked) {
      queueMicrotask(() => new Notice(LOCALES[plugin.settings.language].sig_protected));
      return [];
    }
    return tr;
  });
}

// ── CM6: ViewPlugin ───────────────────────────────────────────────────────────

function makeEditorPlugin(plugin: SignaturePlugin) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) { this.decorations = buildDecorations(view); }
      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged) this.decorations = buildDecorations(u.view);
      }
    },
    {
      decorations: (v) => v.decorations,
      eventHandlers: {
        mousedown(e: MouseEvent, view: EditorView) {
          const target = e.target as HTMLElement;
          if (!target.classList.contains('sig-placeholder')) return false;
          e.preventDefault();

          const L = LOCALES[plugin.settings.language];
          const pos = view.posAtDOM(target);
          const line = view.state.doc.lineAt(pos);

          // Detecta qual placeholder foi clicado (qualquer idioma)
          ALL_PLACEHOLDER_RE.lastIndex = 0;
          let match: RegExpExecArray | null;
          let from = -1, to = -1;
          while ((match = ALL_PLACEHOLDER_RE.exec(line.text)) !== null) {
            const s = line.from + match.index, en = s + match[0].length;
            if (pos >= s && pos <= en) { from = s; to = en; break; }
          }
          if (from === -1) return false;

          const applySignature = (signer: Signer) => {
            const now = new Date();
            const timestamp = now.toISOString().slice(0, 16).replace('T', ' ');
            const id = shortHash(signer.name + signer.role + now.toISOString());
            // Usa o prefixo do idioma atual
            const sig = `[${L.sig_prefix}: ${signer.name} - ${signer.role} | ${timestamp} | ${id}]`;
            view.dispatch({ changes: { from, to, insert: sig } });
            const activeFile = plugin.app.workspace.getActiveFile();
            notifySignature(plugin, activeFile, signer.name, timestamp);
          };

          if (!plugin.settings.signers.length) { new Notice(L.no_signers); return true; }

          const proceed = (signer: Signer) =>
            signer.passwordHash
              ? new SignPasswordModal(plugin.app, signer, L, applySignature).open()
              : applySignature(signer);

          plugin.settings.signers.length === 1
            ? proceed(plugin.settings.signers[0])
            : new SignerPickerModal(plugin.app, plugin.settings.signers, L, proceed).open();

          return true;
        },
      },
    }
  );
}

// ── Modais ────────────────────────────────────────────────────────────────────

abstract class SigModal extends Modal {
  protected attempts = 0;
  protected readonly MAX = 3;
  protected checkAttempts(onExceeded: () => void): boolean {
    this.attempts++;
    if (this.attempts >= this.MAX) { this.close(); onExceeded(); return true; }
    return false;
  }
}

class SignerPickerModal extends Modal {
  constructor(app: App, private signers: Signer[], private L: Locale, private onChoose: (s: Signer) => void) { super(app); }
  onOpen() {
    this.titleEl.setText(this.L.pick_signer_title);
    this.contentEl.empty(); this.contentEl.addClass('sig-picker');
    for (const signer of this.signers) {
      const row = this.contentEl.createDiv({ cls: 'sig-signer-row' });
      const nameEl = row.createSpan({ cls: 'sig-signer-name', text: signer.name });
      row.createSpan({ cls: 'sig-signer-role', text: signer.role });
      if (signer.passwordHash) nameEl.createSpan({ cls: 'sig-lock', text: ' 🔒' });
      row.addEventListener('click', () => { this.close(); this.onChoose(signer); });
    }
  }
  onClose() { this.contentEl.empty(); }
}

class SignPasswordModal extends SigModal {
  constructor(app: App, private signer: Signer, private L: Locale, private onSuccess: (s: Signer) => void) { super(app); }
  onOpen() {
    const { L, signer } = this;
    this.titleEl.setText(L.sign_pwd_title(signer.name));
    this.contentEl.empty(); this.contentEl.addClass('sig-modal');
    let inputEl!: HTMLInputElement;
    addPwdField(this.contentEl, L.sign_pwd_prompt(signer.name), '••••••••', (el) => { inputEl = el; });
    const err = createErrorEl(this.contentEl);
    new Setting(this.contentEl).addButton((b) => b.setButtonText(L.sign_btn).setCta().onClick(() => trySign()));
    const trySign = () => {
      clearError(err);
      if (shortHash(inputEl.value) === signer.passwordHash) { this.close(); this.onSuccess(signer); }
      else { inputEl.value = ''; inputEl.focus(); if (this.checkAttempts(() => new Notice(L.too_many_attempts))) return; showError(err, L.wrong_pwd(this.MAX - this.attempts)); }
    };
    inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') trySign(); });
    setTimeout(() => inputEl?.focus(), 50);
  }
  onClose() { this.contentEl.empty(); }
}

class SetPasswordModal extends Modal {
  constructor(app: App, private signerName: string, private L: Locale, private onSet: (hash: string) => void) { super(app); }
  onOpen() {
    const { L } = this;
    this.titleEl.setText(L.set_pwd_title(this.signerName));
    this.contentEl.empty(); this.contentEl.addClass('sig-modal');
    let newEl!: HTMLInputElement, confirmEl!: HTMLInputElement;
    addPwdField(this.contentEl, L.new_pwd_label, L.new_pwd_placeholder, (el) => { newEl = el; });
    addPwdField(this.contentEl, L.confirm_pwd_label, L.confirm_pwd_placeholder, (el) => { confirmEl = el; });
    const err = createErrorEl(this.contentEl);
    new Setting(this.contentEl).addButton((b) => b.setButtonText(L.set_pwd_btn).setCta().onClick(() => trySet()));
    const trySet = () => {
      clearError(err);
      if (!newEl.value.trim()) { showError(err, L.pwd_empty); newEl.focus(); return; }
      if (newEl.value !== confirmEl.value) { showError(err, L.pwd_mismatch); confirmEl.value = ''; confirmEl.focus(); return; }
      this.close(); this.onSet(shortHash(newEl.value.trim()));
    };
    [newEl, confirmEl].forEach((f) => f?.addEventListener('keydown', (e) => { if (e.key === 'Enter') trySet(); }));
    setTimeout(() => newEl?.focus(), 50);
  }
  onClose() { this.contentEl.empty(); }
}

class ChangePasswordModal extends SigModal {
  constructor(app: App, private signer: Signer, private L: Locale, private onChanged: (h: string) => void) { super(app); }
  onOpen() {
    const { L, signer } = this;
    this.titleEl.setText(L.change_pwd_title(signer.name));
    this.contentEl.empty(); this.contentEl.addClass('sig-modal');
    let currentEl!: HTMLInputElement, newEl!: HTMLInputElement, confirmEl!: HTMLInputElement;
    addPwdField(this.contentEl, L.current_pwd_label, L.current_pwd_placeholder, (el) => { currentEl = el; });
    addPwdField(this.contentEl, L.new_pwd_label, L.new_pwd_placeholder, (el) => { newEl = el; });
    addPwdField(this.contentEl, L.confirm_pwd_label, L.confirm_pwd_placeholder, (el) => { confirmEl = el; });
    const err = createErrorEl(this.contentEl);
    new Setting(this.contentEl).addButton((b) => b.setButtonText(L.change_pwd_btn).setCta().onClick(() => tryChange()));
    const tryChange = () => {
      clearError(err);
      if (shortHash(currentEl.value) !== signer.passwordHash) {
        currentEl.value = ''; currentEl.focus();
        if (this.checkAttempts(() => new Notice(L.too_many_attempts))) return;
        showError(err, L.wrong_current_pwd(this.MAX - this.attempts)); return;
      }
      if (!newEl.value.trim()) { showError(err, L.new_pwd_empty); newEl.focus(); return; }
      if (newEl.value !== confirmEl.value) { showError(err, L.pwd_mismatch); confirmEl.value = ''; confirmEl.focus(); return; }
      this.close(); this.onChanged(shortHash(newEl.value.trim()));
    };
    [currentEl, newEl, confirmEl].forEach((f) => f?.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryChange(); }));
    setTimeout(() => currentEl?.focus(), 50);
  }
  onClose() { this.contentEl.empty(); }
}

class ProtectedActionModal extends SigModal {
  constructor(app: App, private title: string, private description: string, private confirmLabel: string, private signer: Signer, private L: Locale, private onConfirm: () => void) { super(app); }
  onOpen() {
    const { L, signer } = this;
    this.titleEl.setText(this.title);
    this.contentEl.empty(); this.contentEl.addClass('sig-modal');
    this.contentEl.createDiv({ cls: 'sig-modal-desc', text: this.description });
    let inputEl!: HTMLInputElement;
    addPwdField(this.contentEl, L.password_label, L.pwd_field_placeholder(signer.name), (el) => { inputEl = el; });
    const err = createErrorEl(this.contentEl);
    new Setting(this.contentEl).addButton((b) => b.setButtonText(this.confirmLabel).setWarning().onClick(() => tryConfirm()));
    const tryConfirm = () => {
      clearError(err);
      if (shortHash(inputEl.value) === signer.passwordHash) { this.close(); this.onConfirm(); }
      else { inputEl.value = ''; inputEl.focus(); if (this.checkAttempts(() => new Notice(L.too_many_attempts))) return; showError(err, L.wrong_pwd(this.MAX - this.attempts)); }
    };
    inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryConfirm(); });
    setTimeout(() => inputEl?.focus(), 50);
  }
  onClose() { this.contentEl.empty(); }
}

class RemoveSignatureModal extends SigModal {
  constructor(app: App, private sig: ParsedSig, private signer: Signer, private L: Locale, private onConfirm: () => void) { super(app); }
  onOpen() {
    const { L, signer, sig } = this;
    this.titleEl.setText(L.remove_sig_title(signer.name));
    this.contentEl.empty(); this.contentEl.addClass('sig-modal');
    this.contentEl.createDiv({ cls: 'sig-modal-desc', text: L.remove_sig_desc(sig.name, sig.ts) });
    let inputEl!: HTMLInputElement;
    addPwdField(this.contentEl, L.password_label, L.pwd_field_placeholder(signer.name), (el) => { inputEl = el; });
    const err = createErrorEl(this.contentEl);
    new Setting(this.contentEl).addButton((b) => b.setButtonText(L.remove_sig_confirm_btn).setWarning().onClick(() => tryRemove()));
    const tryRemove = () => {
      clearError(err);
      if (shortHash(inputEl.value) === signer.passwordHash) { this.close(); this.onConfirm(); }
      else { inputEl.value = ''; inputEl.focus(); if (this.checkAttempts(() => new Notice(L.too_many_attempts))) return; showError(err, L.wrong_pwd(this.MAX - this.attempts)); }
    };
    inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryRemove(); });
    setTimeout(() => inputEl?.focus(), 50);
  }
  onClose() { this.contentEl.empty(); }
}

class ConfirmRemoveModal extends Modal {
  constructor(app: App, private message: string, private L: Locale, private onConfirm: () => void) { super(app); }
  onOpen() {
    const { L } = this;
    this.titleEl.setText(L.remove_sig_confirm_btn);
    this.contentEl.empty(); this.contentEl.addClass('sig-modal');
    this.contentEl.createDiv({ cls: 'sig-modal-desc', text: this.message });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText(L.remove_sig_confirm_btn).setWarning().onClick(() => { this.close(); this.onConfirm(); }))
      .addButton((b) => b.setButtonText('✕').onClick(() => this.close()));
  }
  onClose() { this.contentEl.empty(); }
}

// ── Plugin principal ──────────────────────────────────────────────────────────

export default class SignaturePlugin extends Plugin {
  settings: SignatureSettings = DEFAULT_SETTINGS;
  bypassProtection = false;

  async onload() {
    await this.loadSettings();
    this.registerEditorExtension([makeEditorPlugin(this), makeProtectionFilter(this)]);
    this.addSettingTab(new SignatureSettingTab(this.app, this));

    this.addCommand({
      id: 'remove-signature',
      name: this.L.remove_sig_command,
      editorCallback: (editor) => {
        const L = this.L;
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const lineOffset = editor.posToOffset({ line: cursor.line, ch: 0 });
        const sigs = findSignaturesInText(line, lineOffset);

        if (!sigs.length) { new Notice(L.remove_sig_no_sig); return; }

        const sig = sigs.find(s => cursor.ch >= s.from - lineOffset && cursor.ch <= s.to - lineOffset) ?? sigs[0];

        const doRemove = () => {
          this.bypassProtection = true;
          editor.replaceRange('', editor.offsetToPos(sig.from), editor.offsetToPos(sig.to));
          this.bypassProtection = false;
          new Notice(L.remove_sig_ok);
        };

        const signer = this.settings.signers.find(s => s.name === sig.name);
        if (signer && signer.passwordHash) {
          new RemoveSignatureModal(this.app, sig, signer, L, doRemove).open();
        } else {
          new ConfirmRemoveModal(this.app, signer ? L.remove_sig_confirm_no_pwd : L.remove_sig_confirm_unknown, L, doRemove).open();
        }
      },
    });
  }

  get L(): Locale { return LOCALES[this.settings.language]; }

  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data, {
      email: Object.assign({}, DEFAULT_EMAIL, data?.email ?? {}),
    });
  }

  async saveSettings() { await this.saveData(this.settings); }
}

// ── Settings tab ──────────────────────────────────────────────────────────────

class SignatureSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: SignaturePlugin) { super(app, plugin); }

  display() {
    const { containerEl, plugin } = this;
    const L = plugin.L;
    containerEl.empty();

    containerEl.createEl('h2', { text: L.settings_title });
    containerEl.createEl('p', { text: L.settings_desc, cls: 'setting-item-description' });

    new Setting(containerEl).setName(L.language_label).setDesc(L.language_desc)
      .addDropdown((d) =>
        d.addOption('en', 'English').addOption('pt-BR', 'Português (Brasil)').addOption('zh', '中文')
          .setValue(plugin.settings.language)
          .onChange(async (v) => { plugin.settings.language = v as SignatureSettings['language']; await plugin.saveSettings(); this.display(); })
      );

    containerEl.createEl('hr');
    containerEl.createEl('h3', { text: '✍️ ' + ({'pt-BR': 'Assinantes', 'en': 'Signers', 'zh': '签署人'}[plugin.settings.language]) });

    // Dica de tag
    const tagHint = containerEl.createDiv({ cls: 'sig-tag-hint' });
    tagHint.createSpan({ text: {'pt-BR': 'Tag ativa: ', 'en': 'Active tag: ', 'zh': '当前标签：'}[plugin.settings.language] });
    tagHint.createEl('code', { text: `[${L.placeholder_tag}]` });

    const signers = plugin.settings.signers;

    for (let i = 0; i < signers.length; i++) {
      const s = signers[i];

      new Setting(containerEl).setName(L.signer_n(i + 1)).setDesc(L.signer_name_desc)
        .addText((t) => t.setPlaceholder(L.name_placeholder).setValue(s.name).onChange(async (v) => { signers[i].name = v.trim(); await plugin.saveSettings(); }))
        .addText((t) => t.setPlaceholder(L.role_placeholder).setValue(s.role).onChange(async (v) => { signers[i].role = v.trim(); await plugin.saveSettings(); }));

      const pwdSetting = new Setting(containerEl).setName(L.password_label);
      if (!s.passwordHash) {
        pwdSetting.setDesc(L.no_password_desc).addButton((b) =>
          b.setButtonText(L.set_password_btn).onClick(() =>
            new SetPasswordModal(this.app, s.name, L, async (hash) => { signers[i].passwordHash = hash; await plugin.saveSettings(); this.display(); new Notice(L.pwd_set_ok(s.name)); }).open()
          )
        );
      } else {
        pwdSetting.setDesc(L.has_password_desc)
          .addButton((b) => b.setButtonText(L.change_password_btn).onClick(() =>
            new ChangePasswordModal(this.app, s, L, async (h) => { signers[i].passwordHash = h; await plugin.saveSettings(); this.display(); new Notice(L.pwd_changed_ok(s.name)); }).open()
          ))
          .addButton((b) => b.setButtonText(L.remove_password_btn).setWarning().onClick(() =>
            new ProtectedActionModal(this.app, L.remove_pwd_title(s.name), L.remove_pwd_desc(s.name), L.remove_pwd_btn, s, L,
              async () => { signers[i].passwordHash = ''; await plugin.saveSettings(); this.display(); new Notice(L.pwd_removed_ok(s.name)); }).open()
          ));
      }

      new Setting(containerEl).setName(L.delete_label).setDesc(s.passwordHash ? L.delete_desc_protected : L.delete_desc_free)
        .addButton((b) => b.setButtonText(L.delete_btn).setWarning().onClick(() => {
          if (s.passwordHash) {
            new ProtectedActionModal(this.app, L.delete_title(s.name), L.delete_desc_modal(s.name), L.delete_confirm_btn, s, L,
              async () => { signers.splice(i, 1); await plugin.saveSettings(); this.display(); new Notice(L.signer_deleted(s.name)); }).open();
          } else { signers.splice(i, 1); plugin.saveSettings().then(() => this.display()); }
        }));

      containerEl.createEl('hr');
    }

    new Setting(containerEl).addButton((b) =>
      b.setButtonText(L.add_signer_btn).setCta().onClick(async () => { signers.push({ name: '', role: '', passwordHash: '' }); await plugin.saveSettings(); this.display(); })
    );

    // ── Email ──────────────────────────────────────────────────────────────
    containerEl.createEl('hr');
    containerEl.createEl('h3', { text: L.email_section_title });
    containerEl.createDiv({ cls: 'sig-email-warning', text: L.email_warning });

    const cfg = plugin.settings.email;

    new Setting(containerEl).setName(L.email_enabled_label).setDesc(L.email_enabled_desc)
      .addToggle((t) => t.setValue(cfg.enabled).onChange(async (v) => {
        if (v && (!cfg.smtpHost || !cfg.smtpUser || !cfg.smtpPass)) { new Notice(L.email_incomplete_config); t.setValue(false); return; }
        if (v && !cfg.recipients.length) { new Notice(L.email_no_recipients); t.setValue(false); return; }
        cfg.enabled = v; await plugin.saveSettings();
      }));

    new Setting(containerEl).setName(L.email_smtp_host).setDesc(L.email_smtp_host_desc)
      .addText((t) => t.setPlaceholder('smtp.gmail.com').setValue(cfg.smtpHost).onChange(async (v) => { cfg.smtpHost = v.trim(); await plugin.saveSettings(); }));

    new Setting(containerEl).setName(L.email_smtp_port).setDesc(L.email_smtp_port_desc)
      .addText((t) => { t.setPlaceholder('587').setValue(String(cfg.smtpPort || 587)); t.inputEl.type = 'number'; t.inputEl.style.width = '80px'; t.onChange(async (v) => { cfg.smtpPort = parseInt(v) || 587; await plugin.saveSettings(); }); });

    new Setting(containerEl).setName(L.email_smtp_user).setDesc(L.email_smtp_user_desc)
      .addText((t) => t.setPlaceholder('you@gmail.com').setValue(cfg.smtpUser).onChange(async (v) => { cfg.smtpUser = v.trim(); await plugin.saveSettings(); }));

    new Setting(containerEl).setName(L.email_smtp_pass).setDesc(L.email_smtp_pass_desc)
      .addText((t) => { t.inputEl.type = 'password'; t.inputEl.placeholder = '••••••••'; t.setValue(cfg.smtpPass).onChange(async (v) => { cfg.smtpPass = v; await plugin.saveSettings(); }); });

    containerEl.createEl('p', { text: L.email_recipients_label, cls: 'sig-recipients-label' });
    containerEl.createEl('p', { text: L.email_recipients_desc, cls: 'setting-item-description' });

    for (let i = 0; i < cfg.recipients.length; i++) {
      new Setting(containerEl).setName(cfg.recipients[i])
        .addExtraButton((b) => b.setIcon('trash').setTooltip(L.email_remove_recipient_tooltip).onClick(async () => { cfg.recipients.splice(i, 1); await plugin.saveSettings(); this.display(); }));
    }

    let newRecipientInput: HTMLInputElement;
    new Setting(containerEl)
      .addText((t) => { t.setPlaceholder(L.email_recipient_placeholder); t.inputEl.style.minWidth = '220px'; newRecipientInput = t.inputEl; t.inputEl.addEventListener('keydown', async (e) => { if (e.key === 'Enter') await addRecipient(); }); })
      .addButton((b) => b.setButtonText(L.email_add_recipient_btn).onClick(addRecipient));

    const addRecipient = async () => {
      const val = newRecipientInput?.value?.trim();
      if (!val || !val.includes('@')) return;
      if (!cfg.recipients.includes(val)) { cfg.recipients.push(val); await plugin.saveSettings(); this.display(); }
    };

    new Setting(containerEl).addButton((b) =>
      b.setButtonText(L.email_test_btn).onClick(async () => {
        if (!cfg.smtpHost || !cfg.smtpUser || !cfg.smtpPass) { new Notice(L.email_incomplete_config); return; }
        if (!cfg.recipients.length) { new Notice(L.email_no_recipients); return; }
        b.setButtonText('...').setDisabled(true);
        try { await sendEmail(cfg, L.email_test_subject, L.email_test_body, `<p>${L.email_test_body}</p>`); new Notice(L.email_test_ok); }
        catch (err) { new Notice(L.email_test_fail((err as Error).message)); }
        finally { b.setButtonText(L.email_test_btn).setDisabled(false); }
      })
    );
  }
}
