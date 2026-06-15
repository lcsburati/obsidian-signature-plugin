# Obsidian Signature — Plugin de Assinatura Digital

**Versão 2.0.0** · Autor: Lucas Burati · Desktop only

Assina notas inline com nome, cargo, timestamp e hashes de integridade. Detecta adulterações com precisão — apontando exatamente qual assinatura falhou e por quê.

---

## Como funciona

### Assinar uma nota

Digite uma das tags de placeholder em qualquer ponto do documento:

| Idioma | Tag |
|--------|-----|
| Português | `[assinatura]` |
| Inglês | `[signature]` |
| Chinês | `[签名]` |

Clique na tag. Se houver mais de um assinante configurado, o picker aparece. Se houver senha, ela é solicitada (não: a senha não é necessária para assinar, apenas para remover).

A tag é substituída por um bloco como:

```
[ASSINADO: Lucas Burati - Gerente | 2026-06-15 14:32 | a3f2b1c4.e8d9f7a2]
```

O bloco contém dois hashes FNV-1a 32-bit:
- **idHash** (`a3f2b1c4`) — hash de identidade: `fnv32a(nome + "|" + cargo + "|" + timestamp)`
- **contentHash** (`e8d9f7a2`) — hash de conteúdo: `fnv32a(texto do documento sem assinaturas)`

Qualquer alteração no documento após a assinatura invalida o `contentHash`.

### Modo LOCK

Se o assinante tiver **"Bloquear ao assinar"** ativado, o bloco usa o prefixo `[BLOQUEADO: ...]` / `[LOCKED: ...]`. Um documento com qualquer LOCK válido fica completamente bloqueado para edição — nenhuma tecla funciona.

---

## Comandos

| Comando | O que faz |
|---------|-----------|
| `Verificar assinaturas da nota atual` | Verifica todas as assinaturas e lista **qual** falhou e **por quê** (hash de identidade? hash de conteúdo? ambos?) |
| `Remover assinatura na posição do cursor` | Remove a assinatura sob o cursor. Solicita senha se o assinante for protegido. |
| `Abrir Central de Assinaturas` | Abre o painel lateral com todas as assinaturas do vault e seus status |
| `Validar assinatura por hash` | Abre modal para validar um par de hashes manualmente contra um conteúdo |

---

## Validação por hash

Use o comando **"Validar assinatura por hash"** quando quiser verificar uma assinatura fora do contexto da nota original.

**Inputs:**
1. O par de hashes da assinatura: `xxxxxxxx.xxxxxxxx` (copiado diretamente do bloco `[ASSINADO: ...]`)
2. O conteúdo do documento **sem** as assinaturas (cole o texto puro)

**O que é verificado:** o plugin recalcula `fnv32a(stripSignatures(conteúdo))` e compara com o `contentHash` da assinatura. Se conferir, o documento não foi alterado desde a assinatura.

> **Nota:** o `idHash` identifica o assinante/momento mas não pode ser re-verificado sem saber o timestamp exato — use o `contentHash` para validar integridade.

---

## Central de Assinaturas

Clique no ícone 🖊 na ribbon ou use o comando **"Abrir Central de Assinaturas"** para abrir o painel lateral.

O painel escaneia todos os arquivos Markdown do vault e lista cada assinatura com:

| Coluna | Conteúdo |
|--------|----------|
| Ícone | ✅ Válida · ❌ Adulterada · ⚠️ Legado · 🔒 Bloqueada |
| Nome e cargo | Do assinante |
| Data | Timestamp da assinatura |
| Status | Textual |

**Clique em qualquer linha** → abre a nota correspondente e exibe um modal com todos os detalhes da assinatura (hashes, arquivo, status completo).

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
- **hash de identidade inválido** — o nome/cargo/timestamp foi alterado dentro do bloco
- **hash de conteúdo inválido** — o corpo do documento foi alterado após a assinatura
- **ambos os hashes inválidos** — bloco e conteúdo foram modificados

---

## Configurações

### Assinantes

Cada assinante tem:

| Campo | Descrição |
|-------|-----------|
| Nome | Aparece no bloco de assinatura |
| Cargo | Aparece no bloco de assinatura |
| Senha (opcional) | Se definida, é exigida para remover a assinatura |
| **Administrador** | Acesso à Central e permissão para remover qualquer assinatura |
| **Bloquear ao assinar** | Usa prefixo LOCKED e trava o documento |

### Verificar ao abrir

Se ativado, cada nota aberta é verificada automaticamente. Adulterações geram um aviso imediato com detalhes.

### Alertas por e-mail

Configure SMTP para receber alertas automáticos quando adulterações forem detectadas ao abrir arquivos. Requer servidor SMTP acessível localmente.

---

## Formato dos blocos de assinatura

```
[ASSINADO: Nome - Cargo | YYYY-MM-DD HH:MM | idHash.contentHash]
[BLOQUEADO: Nome - Cargo | YYYY-MM-DD HH:MM | idHash.contentHash]
```

**Retrocompatibilidade:** blocos do formato antigo (sem `contentHash`) são reconhecidos como `⚠️ Legado` — exibidos sem erro, mas sem verificação de integridade.

---

## Algoritmo de hash

```
fnv32a(str):
  hash = 2166136261  (FNV offset basis)
  para cada char:
    hash ^= charCode
    hash *= 16777619  (FNV prime)
    hash &= 0xFFFFFFFF
  retorna hash em hex (8 chars)

idHash      = fnv32a(nome + "|" + cargo + "|" + timestamp)
contentHash = fnv32a(documento com assinaturas e placeholders removidos)
```

> FNV-1a 32-bit é rápido e suficiente para detecção de adulteração informal. Para uso jurídico ou segurança crítica, considere SHA-256.

---

## Compatibilidade de idiomas

Os prefixos reconhecidos no parse são:

| Prefixo | Idioma |
|---------|--------|
| `ASSINADO` / `BLOQUEADO` | Português |
| `SIGNED` / `LOCKED` | Inglês |
| `已签名` / `已锁定` | Chinês |

O idioma dos novos blocos gerados segue a configuração de **Idioma** nas configurações.

---

## Changelog

### v2.0.0
- **Central de Assinaturas**: painel lateral com todas as assinaturas do vault, filtro por status, clique para navegar e ver detalhes
- **Validação detalhada**: relatório de adulteração aponta qual hash falhou (identidade, conteúdo ou ambos) por assinatura
- **Conceito de Admin**: toggle por assinante; admins têm acesso ao dashboard e podem remover qualquer assinatura
- **Modal de detalhes do assinante**: picker compacto com botão `···` para ver detalhes sem poluir a lista
- **Comando "Validar por hash"**: valida uma assinatura colando os hashes e o conteúdo manualmente
- **Verificação ao abrir**: relatório detalhado também ao abrir notas automaticamente
- Ícone na ribbon para acesso rápido à Central

### v1.0.0
- Assinatura inline com FNV-1a (idHash + contentHash)
- Suporte a LOCK (bloqueio de documento)
- Verificação manual por comando
- Suporte a pt-BR, en, zh
