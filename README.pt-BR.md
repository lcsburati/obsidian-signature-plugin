# Obsidian Signature

> ⚠️ **Projeto gerado por IA** — Este plugin foi construído inteiramente por um assistente de IA (Claude, da Anthropic), guiado apenas por direcionamento e requisitos humanos. Nenhuma linha de código foi escrita manualmente. O conceito, as decisões de funcionalidades e os testes foram fornecidos pelo autor humano.

Assine notas inline com hashes à prova de adulteração. Detecta modificações com precisão — apontando exatamente qual assinatura falhou e por quê.

---

## Por que este plugin existe

Estamos passando por um período de padronização de documentações. Como parte desse processo, surgiu a necessidade de um sistema confiável para rastrear **quem realizou o quê, se foi revisado pela liderança, e quem refatorou a documentação** quando necessário.

Usamos o Obsidian como base de conhecimento compartilhada porque ele se mapeia naturalmente a uma pasta em um servidor compartilhado — toda a equipe consegue ler e editar notas sem atrito, e funciona bem com fluxos de trabalho assistidos por IA.

O problema era a rastreabilidade: um arquivo Markdown diz o que mudou, mas não *quem aprovou* ou *se passou por revisão*. Soluções tradicionais (exportações em PDF, Word com controle de alterações, ferramentas externas de assinatura) são pesadas demais para um fluxo de documentação ágil.

Este plugin resolve isso incorporando assinaturas inline diretamente na nota. Cada assinatura captura a identidade do assinante, o timestamp e um hash do conteúdo do documento no momento da assinatura. Se o documento for modificado após a assinatura, o hash deixa de bater — tornando qualquer alteração pós-assinatura imediatamente visível.

**Essas assinaturas não têm valor jurídico.** Seu valor é prático: elas criam uma trilha de auditoria leve diretamente dentro da documentação, deixando claro de uma olhada quem tocou em um documento, em qual papel, e se o conteúdo foi alterado desde que a pessoa assinou.

---

## Instalação via BRAT

1. Instale o [plugin BRAT](https://github.com/TfTHacker/obsidian42-brat) pela loja de plugins do Obsidian.
2. Abra as configurações do BRAT → **Add Beta Plugin**.
3. Cole: `https://github.com/lcsburati/obsidian-sinature-plugin`
4. Clique em **Add Plugin** — o BRAT instala e mantém atualizado automaticamente.

---

## Como funciona

### Assinando uma nota

Digite uma das tags de placeholder em qualquer ponto do documento:

| Idioma | Tag |
|--------|-----|
| Português | `[assinatura]` |
| Inglês | `[signature]` |
| Chinês | `[签名]` |

Clique na tag. Se houver mais de um assinante configurado, o seletor aparece. A tag é substituída por um bloco como:

```
[ASSINADO: Lucas Burati - Gerente | 2026-06-15 14:32 | a3f2b1c4.e8d9f7a2]
```

O bloco contém dois hashes FNV-1a 32-bit:
- **idHash** (`a3f2b1c4`) — hash de identidade: `fnv32a(nome + "|" + cargo + "|" + timestamp)`
- **contentHash** (`e8d9f7a2`) — hash de conteúdo: `fnv32a(texto do documento sem assinaturas)`

Qualquer alteração no documento após a assinatura invalida o `contentHash`.

### Modo LOCK

Se o assinante tiver **"Bloquear ao assinar"** ativado, o bloco usa o prefixo `[BLOQUEADO: ...]`. Um documento com qualquer LOCK válido fica completamente bloqueado para edição até que a assinatura seja removida.

---

## Comandos

| Comando | O que faz |
|---------|-----------|
| `Verificar assinaturas da nota atual` | Verifica todas as assinaturas e aponta **qual** falhou e **por quê** (hash de identidade? hash de conteúdo? ambos?) |
| `Remover assinatura na posição do cursor` | Remove a assinatura sob o cursor. Solicita senha se o assinante for protegido. |
| `Abrir Central de Assinaturas` | Abre o painel lateral com todas as assinaturas do vault e seus status |
| `Validar assinatura por hash` | Abre modal para validar um par de hashes manualmente contra um conteúdo |

---

## Central de Assinaturas

Clique no ícone 🖊 na ribbon ou use **"Abrir Central de Assinaturas"** para abrir o painel lateral.

O painel escaneia todos os arquivos Markdown do vault e lista cada assinatura com:

| Coluna | Conteúdo |
|--------|----------|
| Ícone | ✅ Válida · ❌ Adulterada · ⚠️ Legado · 🔒 Bloqueada |
| Nome e cargo | Do assinante |
| Data | Timestamp da assinatura |
| Status | Texto |

**Clique em qualquer linha** → abre a nota correspondente e exibe um modal com todos os detalhes da assinatura, incluindo a **comparação de hashes** (armazenado vs. atual) para confirmar se o conteúdo foi alterado após a assinatura.

**Filtro de status** no topo permite ver só as adulteradas, legadas, etc.

**Botão ↺** atualiza o scan do vault.

---

## Relatório de adulteração

Quando a verificação detecta adulteração, o aviso mostra exatamente o problema de cada assinatura:

```
❌ 2 assinatura(s) adulterada(s)!
  • Lucas Burati (Gerente): hash de conteúdo inválido
  • Maria Santos (Diretora): ambos os hashes inválidos
```

Tipos de falha possíveis:
- **hash de identidade inválido** — nome/cargo/timestamp foi alterado dentro do bloco
- **hash de conteúdo inválido** — o corpo do documento foi alterado após a assinatura
- **ambos os hashes inválidos** — bloco e conteúdo foram modificados

---

## Validação por hash

Use **"Validar assinatura por hash"** para verificar uma assinatura fora do contexto da nota original.

**Inputs:**
1. O par de hashes: `xxxxxxxx.xxxxxxxx` (copiado diretamente do bloco `[ASSINADO: ...]`)
2. O conteúdo do documento **sem** assinaturas (cole o texto puro)

O plugin recalcula `fnv32a(stripSignatures(conteúdo))` e compara com o `contentHash` armazenado.

**Alternativa via CLI** — use `verify.mjs` sem abrir o Obsidian:
```bash
node verify.mjs nota.md
node verify.mjs --dir ./vault
node verify.mjs --hash a3f2b1c4.e8d9f7a2 nota.md
```

---

## Configurações

As configurações estão divididas em duas abas:

### Aba ✍️ Assinantes

Cada assinante tem um card expansível (fechado por padrão). Clique para expandir:

| Campo | Descrição |
|-------|-----------|
| Nome | Exibido no bloco de assinatura |
| Cargo | Exibido no bloco de assinatura |
| Senha (opcional) | Se definida, é exigida para remover a assinatura |
| **Administrador** | Acesso à Central e permissão para remover qualquer assinatura |
| **Bloquear ao assinar** | Usa prefixo BLOQUEADO e torna o documento somente-leitura |

Gerenciamento de senha via modais separados: Definir / Alterar (exige senha atual) / Remover (exige senha atual).

### Aba ⚙️ Gerenciador

- **Idioma** — pt-BR / English / 中文
- **Verificar ao abrir** — verifica assinaturas automaticamente ao abrir qualquer nota
- **Notificações por e-mail** — configuração SMTP com destinatários individuais (adicionar/remover) e toggle de alerta de adulteração

---

## Formato dos blocos de assinatura

```
[ASSINADO: Nome - Cargo | YYYY-MM-DD HH:MM | idHash.contentHash]
[BLOQUEADO: Nome - Cargo | YYYY-MM-DD HH:MM | idHash.contentHash]
```

**Retrocompatibilidade:** blocos no formato antigo (sem `contentHash`) são reconhecidos como `⚠️ Legado` — exibidos sem erro, mas sem verificação de integridade.

---

## Algoritmo de hash

```
fnv32a(str):
  hash = 2166136261       // FNV offset basis
  para cada char:
    hash ^= charCode
    hash *= 16777619      // FNV prime
    hash &= 0xFFFFFFFF
  retorna hash.toString(16).padStart(8, '0')

idHash      = fnv32a(nome + "|" + cargo + "|" + timestamp)
contentHash = fnv32a(documento com blocos de assinatura e placeholders removidos)
```

> FNV-1a 32-bit é rápido e suficiente para detecção de adulteração informal. Para uso jurídico ou segurança crítica, considere SHA-256.

---

## Suporte a idiomas

Prefixos reconhecidos no parse:

| Prefixo | Idioma |
|---------|--------|
| `ASSINADO` / `BLOQUEADO` | Português |
| `SIGNED` / `LOCKED` | Inglês |
| `已签名` / `已锁定` | Chinês |

O idioma dos novos blocos gerados segue a configuração de **Idioma**.

---

## Changelog

### v2.0.0
- **Central de Assinaturas** — painel lateral com scan do vault, filtro por status, clique para navegar e ver detalhes
- **Comparação de hashes** — modal de detalhes mostra hash armazenado vs. hash atual para confirmar integridade
- **Relatório de adulteração preciso** — aponta qual hash falhou (identidade, conteúdo ou ambos) por assinante
- **Conceito de Admin** — toggle por assinante; admins acessam o dashboard e podem remover qualquer assinatura
- **Modal de detalhes do assinante** — picker compacto com botão `···` para detalhes sem poluir a lista
- **Comando "Validar por hash"** — valida assinatura colando hashes e conteúdo manualmente
- **Verificação ao abrir** — mesmo relatório detalhado ao abrir notas automaticamente
- **Abas nas configurações** — Assinantes / Gerenciador com cards expansíveis e badges de status
- **Destinatários de e-mail** — linhas individuais com botão remover, restaurado da v1
- **verify.mjs** — novo subcomando `--hash`, distingue tampered-id vs tampered-content
- Ícone na ribbon para acesso rápido à Central

### v1.0.0
- Assinatura inline com FNV-1a (idHash + contentHash)
- Modo LOCK (documento somente-leitura após assinar)
- Comando de verificação manual
- Suporte a pt-BR, en, zh
