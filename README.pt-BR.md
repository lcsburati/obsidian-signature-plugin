# Obsidian Signature Plugin

> ⚠️ **Projeto gerado por IA** — Este plugin foi construído inteiramente por um assistente de IA (Claude, da Anthropic), guiado apenas por direcionamento e requisitos humanos. Nenhuma linha de código foi escrita manualmente. O conceito, as decisões de funcionalidades e os testes foram fornecidos pelo autor humano.

Assine notas inline com nome, cargo, timestamp e hash único — para controle e rastreabilidade internos, sem valor jurídico oficial.

---

## Funcionalidades

- **Tags de ativação por idioma** — cada idioma tem sua própria tag:
  - Português: `[assinatura]` → `[ASSINADO: Nome - Cargo | 2026-06-12 14:32 | a1b2c3d4]`
  - Inglês: `[signature]` → `[SIGNED: Name - Role | 2026-06-12 14:32 | a1b2c3d4]`
  - Chinês: `[签名]` → `[已签名: 姓名 - 职位 | 2026-06-12 14:32 | a1b2c3d4]`
- **Todas as tags são detectadas universalmente** — você pode usar qualquer tag independentemente do idioma configurado
- **Proteção por senha por assinante** — opcional; armazenada como hash FNV-1a (não recuperável)
- **Assinaturas protegidas** — edição direta do texto `[ASSINADO: ...]` é bloqueada por filtro CM6
- **Comando para remover assinatura** — `Ctrl+P` → *Remover assinatura na posição do cursor* — exige senha se configurada
- **Notificações por email via SMTP** — opcional; disparada após cada assinatura aplicada
- **Interface em 3 idiomas** — English, Português (pt-BR), 中文

---

## Instalação (manual)

1. Baixe ou compile `main.js`, `manifest.json` e `styles.css`
2. Copie para `<seu-vault>/.obsidian/plugins/obsidian-signature/`
3. No Obsidian: **Configurações → Plugins instalados → desative o Modo Restrito → ative Signature**

### Compilar a partir do código-fonte

```bash
npm install --legacy-peer-deps
npm run build
```

---

## Uso

1. Escreva `[assinatura]` em qualquer nota
2. Clique no texto destacado no editor
3. Se houver múltiplos assinantes, selecione na lista
4. Se o assinante tiver senha, confirme (máx. 3 tentativas)
5. A tag é substituída inline pelo bloco completo de assinatura

Para **remover** uma assinatura: posicione o cursor na linha da assinatura → `Ctrl+P` → **Remover assinatura na posição do cursor**

---

## Configurações

Abra **Configurações → Signature**:

| Seção | Função |
|-------|--------|
| Idioma | Alternar interface entre English, pt-BR, 中文 |
| Assinantes | Adicionar nome, cargo e senha opcional por assinante |
| Notificações por Email | Configurar SMTP e lista de destinatários |

---

## Notificações por email

- Suporta qualquer servidor SMTP (Gmail, Outlook, customizado)
- Para Gmail: use uma **senha de aplicativo** — acesse `myaccount.google.com → Segurança → Senhas de app`
- Teste a conexão com o botão **Enviar email de teste** antes de ativar

> ⚠️ A senha SMTP é armazenada em texto simples em `data.json`. **Use uma senha de aplicativo, nunca sua senha principal.** O `data.json` está no `.gitignore` por padrão.

---

## Notas de segurança

- Senhas de assinantes são armazenadas como **hashes FNV-1a 32-bit** — não reversíveis, não recuperáveis
- O hash da assinatura (`a1b2c3d4`) é derivado de nome + cargo + timestamp — é um identificador de unicidade, não uma prova criptográfica
- Este plugin oferece **controle interno**, não assinaturas com validade jurídica

---

## Stack

- TypeScript + esbuild
- CodeMirror 6 (via Obsidian)
- nodemailer (notificações SMTP)

---

## Outros idiomas

- [English (padrão)](README.md)
- [中文](README.zh.md)

---

## Atribuição de IA

Este plugin foi concebido e direcionado por **Lucas Burati** e implementado inteiramente pelo **Claude** (assistente de IA da Anthropic). Todo o código, arquitetura e documentação foram gerados por IA com base em requisitos e feedback humanos. Nenhuma linha de código foi escrita manualmente.
