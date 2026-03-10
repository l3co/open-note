---
description: Planejamento de feature — gera pasta em docs/ com roadmap.md e arquivos de fase a partir da conversa atual
---

Workflow ativado pelo comando `/planejamento`. Analisa toda a conversa da sessão atual e gera documentação estruturada de planejamento dentro de `docs/`.

## Passos

### 1. Extrair informações da conversa

Leia o contexto da conversa atual e extraia:

- **Nome da feature** — identifique o tema principal discutido (ex: "code signing macOS", "wayland fix", "offline sync"). Converta para `snake_case` minúsculo (ex: `macos_code_signing`, `wayland_support`, `offline_sync`)
- **Descrição** — resumo em 1-2 frases do que é a feature
- **Problema/motivação** — por que essa feature é necessária (o que levou à conversa)
- **Escopo** — o que está dentro e fora do escopo
- **Complexidade estimada** — Baixa / Média / Alta / Muito Alta (com justificativa)
- **Camadas impactadas** — quais crates, stores, componentes, IPC commands serão tocados
- **Fases propostas** — liste as fases naturais de implementação, cada uma entregando valor independente

Se alguma informação não estiver clara na conversa, **infira a partir do contexto do projeto** (ROADMAP.md, docs existentes, arquitetura).

---

### 2. Determinar o nome da pasta

Use o nome da feature em `snake_case`. Exemplos:
- "Code signing no macOS" → `macos_code_signing`
- "Suporte a Wayland no Linux" → `wayland_support`
- "Sincronização offline" → `offline_sync`

Verifique se a pasta já existe:
// turbo
```bash
ls /Users/leco/RustroverProjects/open-note/docs/
```

Se já existir uma pasta com o mesmo nome, adicione sufixo `_v2` ou similar.

---

### 3. Criar a pasta da feature

// turbo
```bash
mkdir -p /Users/leco/RustroverProjects/open-note/docs/<nome_da_feature>
```

---

### 4. Gerar `roadmap.md`

Crie o arquivo `docs/<nome_da_feature>/roadmap.md` seguindo **exatamente** esta estrutura (baseada em `docs/multiple_workspace/roadmap.md`):

```markdown
# <Nome da Feature> — Roadmap

## Visão Geral

<Descrição detalhada da feature, o que ela habilita, inspiração/referência se houver>

---

## Estado Atual

### Arquitetura Existente

<Descreva o estado atual relevante: structs, stores, componentes, fluxos. Use blocos de código ou ASCII art quando ajudar>

### Pontos de Acoplamento Identificados

| Camada | Arquivo | Acoplamento |
|--------|---------|-------------|
| ... | ... | ... |

---

## Avaliação de Complexidade

### Classificação: 🟢 BAIXA / 🟡 MÉDIA / 🟠 ALTA / 🔴 MUITO ALTA (Score: X/10)

**Justificativa:**

| Fator | Impacto | Nota |
|-------|---------|------|
| ... | ... | .../5 |

**Estimativa de esforço total: ~XX horas de desenvolvimento**

### Riscos Principais

1. ...
2. ...

---

## Estratégia de Implementação

### Princípio: <princípio guia, ex: "Incremental, Backward Compatible">

<Explicação do princípio>

### Fases

| Fase | Nome | Esforço | Prioridade | Dependências |
|------|------|---------|------------|--------------|
| 1 | **<Nome>** — <subtítulo> | ~Xh | 🔴/🟡/🟢 | — |
| 2 | **<Nome>** — <subtítulo> | ~Xh | 🔴/🟡/🟢 | Fase 1 |
...

---

## Modelo de Domínio Proposto

### Antes
\`\`\`
<Estado atual relevante>
\`\`\`

### Depois
\`\`\`
<Estado proposto>
\`\`\`

---

## Critérios de Aceitação (Definição de Done)

- [ ] ...
- [ ] ...
- [ ] Todos os testes existentes continuam passando

---

## Referências

- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- <outros arquivos relevantes do projeto>
```

---

### 5. Gerar arquivos de fase

Para **cada fase** identificada no roadmap, crie `docs/<nome_da_feature>/fase_0X.md` seguindo **exatamente** esta estrutura (baseada em `docs/multiple_workspace/fase_01.md`):

```markdown
# Fase 0X — <Nome da Fase>

**Esforço estimado:** ~XX horas
**Prioridade:** 🔴 Crítica / 🟡 Alta / 🟢 Média
**Dependências:** Nenhuma / Fase X
**Branch:** `feat/<nome-da-feature>-phase-X`

---

## Objetivo

<O que esta fase entrega e por que é necessária. Uma fase = uma entrega independente que pode ser merged em main.>

---

## Contexto Atual

<Código/estado atual relevante para esta fase. Inclua trechos de código reais dos arquivos do projeto quando possível.>

---

## Tarefas

### X.1 — <Nome da Tarefa>

**Arquivo:** `<caminho/do/arquivo>`

\`\`\`rust / typescript
<Esboço do código ou interface proposta>
\`\`\`

**Critérios:**
- [ ] ...
- [ ] Testes cobrindo: ...

---

### X.2 — <Nome da Tarefa>
...

---

### X.N — Testes

**Arquivo:** `<caminho/do/arquivo de teste>`

| Teste | Descrição |
|-------|-----------|
| `nome_do_teste` | O que verifica |

**Critérios:**
- [ ] XX% dos testes passando
- [ ] Coverage ≥ 85%

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `...` | Adição / Alteração / Novo (gerado) |

## Arquivos NÃO Modificados (ainda)

- `...` — Sem mudanças nesta fase

---

## Critérios de Aceitação da Fase

- [ ] `cargo test --workspace` passa
- [ ] `cargo clippy --workspace -- -D warnings` sem warnings
- [ ] `npm run typecheck` sem erros
- [ ] Nenhuma breaking change em APIs públicas existentes
- [ ] PR review aprovado
```

---

### 6. Verificar arquivos gerados

// turbo
```bash
ls -la /Users/leco/RustroverProjects/open-note/docs/<nome_da_feature>/
```

---

### 7. Resumir o que foi criado

Apresente ao usuário:
- O nome da pasta criada em `docs/`
- A lista de arquivos gerados com uma linha descrevendo cada fase
- A estimativa total de esforço
- Pergunte se há ajustes a fazer no escopo, nas fases ou nos critérios de aceitação

---

## Notas

- **Qualidade sobre velocidade** — os arquivos devem ter conteúdo real e específico para o projeto, não placeholders genéricos.
- **Use o código real** — ao descrever o contexto atual, leia os arquivos relevantes do projeto para incluir trechos reais, não inventados.
- **Fases independentes** — cada fase deve poder ser merged em `main` sem quebrar o que existe.
- **Prioridade das fases** — 🔴 Crítica = bloqueante para as demais, 🟡 Alta = necessária mas não bloqueante, 🟢 Média = polish/testes/documentação.
- **Nomenclatura de branches** — sempre `feat/<feature-slug>-phase-X` em kebab-case.
