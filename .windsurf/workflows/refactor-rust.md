---
description: Refactor Rust — analisa todo o backend com rust-pro e gera plano de refatoração em docs/
---

Workflow ativado pelo comando `/refactor-rust`. Analisa o código Rust do projeto inteiro (todos os crates do workspace) como um especialista em sistemas Rust modernos, e gera documentação de planejamento de refatoração — **sem implementar nenhuma mudança de código**.

## Skill Requerida

Este workflow utiliza a skill `rust-pro` (Rust 1.75+ Expert). Analise com foco em:

- **Ownership & Memory** — lifetime issues, Arc/Rc desnecessários, clones evitáveis
- **Error Handling** — `unwrap()`/`expect()` em código de produção, erros não tipados, propagação inconsistente
- **Async/Concurrency** — padrões incorretos com Tokio, blocking em async context, race conditions
- **Type System** — newtype patterns ausentes, traits mal utilizados, generics excessivos ou insuficientes
- **Performance** — alocações desnecessárias, cópias evitáveis, algoritmos sub-ótimos
- **API Design** — violações de Clean Architecture, acoplamento entre crates, interfaces não ergonômicas
- **Testing** — cobertura insuficiente, testes frágeis, ausência de property-based tests
- **Clippy / Idioms** — código não-idiomático, lints conhecidos do Clippy

---

## Passos

### 1. Obter a data atual

// turbo
```bash
date +%Y-%m-%d
```

Guarde o resultado como `{DATA}` (ex: `2026-03-12`).

---

### 2. Verificar se a pasta de destino já existe

// turbo
```bash
ls /Users/leco/RustroverProjects/open-note/docs/ | grep refactor-rust
```

Se já existir `refactor-rust-{DATA}`, adicione sufixo `-v2` ou similar.

---

### 3. Criar a pasta de output

// turbo
```bash
mkdir -p /Users/leco/RustroverProjects/open-note/docs/refactor-rust-{DATA}
```

---

### 4. Escanear o workspace Rust completo

Leia e analise **todos** os arquivos Rust relevantes como um especialista. Não pule arquivos.

#### 4.1 — Mapear o workspace

```bash
cat /Users/leco/RustroverProjects/open-note/Cargo.toml
```

```bash
find /Users/leco/RustroverProjects/open-note/crates -name "Cargo.toml" | sort
```

```bash
cat /Users/leco/RustroverProjects/open-note/src-tauri/Cargo.toml
```

#### 4.2 — Crate `crates/core` (Domínio)

```bash
find /Users/leco/RustroverProjects/open-note/crates/core/src -name "*.rs" | sort
```

Avalie:
- Modelos de domínio ricos vs. anêmicos
- Invariantes de negócio explicitadas no tipo (newtype pattern)
- Dependências externas indevidas (core NÃO deve importar serde_json, tokio, Tauri)
- Erros tipados com `thiserror` em todos os módulos
- Testes unitários cobrindo regras de negócio

#### 4.3 — Crate `crates/storage` (Infraestrutura)

```bash
find /Users/leco/RustroverProjects/open-note/crates/storage/src -name "*.rs" | sort
```

Avalie:
- Atomic writes e tratamento de erros de I/O
- `unwrap()`/`expect()` em operações de filesystem
- Migrations versionadas e funções puras
- Abstrações de trait para testabilidade (injeção de dependência)
- Testes de integração com filesystem real

#### 4.4 — Crate `crates/search` (Tantivy)

```bash
find /Users/leco/RustroverProjects/open-note/crates/search/src -name "*.rs" | sort
```

Avalie:
- Gerenciamento do índice Tantivy (lock, flush, rebuild)
- Erros de indexação propagados corretamente
- Performance de queries e batching
- Testes de integração com índice real

#### 4.5 — Crate `crates/sync` (Cloud Sync)

```bash
find /Users/leco/RustroverProjects/open-note/crates/sync/src -name "*.rs" | sort
```

Avalie:
- Padrões async com Tokio (sem blocking em async context)
- Tratamento de erros de rede (retry, backoff, timeout)
- Trait de provider para testabilidade (mock de cloud providers)
- Race conditions em sync concorrente

#### 4.6 — `src-tauri` (Camada IPC)

```bash
find /Users/leco/RustroverProjects/open-note/src-tauri/src -name "*.rs" | sort
```

Avalie:
- Commands IPC como camada **fina** (delegam para crates, sem lógica de negócio)
- `AppState` e gerenciamento de estado compartilhado
- Erros retornados ao frontend com códigos tipados
- Bindings TypeScript via `ts-rs` presentes em todas as structs expostas

#### 4.7 — Métricas gerais

```bash
find /Users/leco/RustroverProjects/open-note/crates /Users/leco/RustroverProjects/open-note/src-tauri -name "*.rs" | grep -v "target" | wc -l
```

```bash
grep -rn "unwrap()\|expect(" /Users/leco/RustroverProjects/open-note/crates /Users/leco/RustroverProjects/open-note/src-tauri/src --include="*.rs" | grep -v "#\[cfg(test)\]" | grep -v "//.*unwrap" | wc -l
```

```bash
grep -rn "\.clone()" /Users/leco/RustroverProjects/open-note/crates --include="*.rs" | wc -l
```

---

### 5. Gerar `roadmap.md`

Crie `docs/refactor-rust-{DATA}/roadmap.md` seguindo esta estrutura:

```markdown
# Refactor Rust — Roadmap

**Data da análise:** {DATA}
**Versão do Rust analisado:** (extrair de rust-toolchain.toml)
**Workspace:** crates/core, crates/storage, crates/search, crates/sync, src-tauri
**Especialista:** rust-pro (Rust 1.75+ Expert)

---

## Visão Geral

<Resumo do estado atual do backend Rust e o que esta refatoração busca melhorar. Mencione as categorias de problemas encontrados, impacto em segurança de tipos, performance e manutenibilidade.>

---

## Diagnóstico Geral

### Problemas Encontrados por Categoria

| Categoria | Arquivo(s) | Ocorrências | Severidade | Impacto |
|-----------|-----------|-------------|------------|---------|
| Error Handling (`unwrap`/`expect`) | ... | ... | 🔴 CRÍTICO | Panics em produção |
| Violações de Clean Architecture | ... | ... | 🔴 CRÍTICO | Acoplamento indevido |
| Async/Concurrency | ... | ... | 🟠 ALTO | ... |
| Clones desnecessários | ... | ... | 🟡 MÉDIO | Alocações extra |
| Código não-idiomático (Clippy) | ... | ... | 🟡 MÉDIO | ... |
| Cobertura de testes | ... | ... | 🟡 MÉDIO | ... |
| Type system / Newtype ausente | ... | ... | 🟢 BAIXO | ... |

### Crates com Maior Concentração de Problemas

| Crate | Nº de Issues | Categorias Principais |
|-------|-------------|----------------------|
| `crates/core` | ... | ... |
| `crates/storage` | ... | ... |
| `crates/search` | ... | ... |
| `crates/sync` | ... | ... |
| `src-tauri` | ... | ... |

---

## Estado Atual

### Arquitetura Existente

<Descreva o estado atual: structs principais de cada crate, traits públicas, fluxos de dados, IPC commands. Use ASCII art ou diagramas de texto quando ajudar.>

### Pontos de Violação de Arquitetura

| Crate | Arquivo | Violação | Regra |
|-------|---------|---------|-------|
| ... | ... | ... | Clean Architecture / DDD |

### Dependências Entre Crates (atual)

```
src-tauri → crates/storage → crates/core
src-tauri → crates/search  → crates/core
src-tauri → crates/sync    → crates/core
```

<Se houver dependências indevidas encontradas, liste-as aqui>

---

## Avaliação de Complexidade

### Classificação: 🟢 BAIXA / 🟡 MÉDIA / 🟠 ALTA / 🔴 MUITO ALTA (Score: X/10)

**Justificativa:**

| Fator | Impacto | Nota |
|-------|---------|------|
| Quantidade de arquivos afetados | ... | .../5 |
| Risco de regressão em produção | ... | .../5 |
| Complexidade de lifetimes/async | ... | .../5 |
| Esforço de testes | ... | .../5 |

**Estimativa de esforço total: ~XX horas de desenvolvimento**

### Riscos Principais

1. ...
2. ...

---

## Estratégia de Refatoração

### Princípio: Inside-Out, Sem Breaking Changes Externas

Começar pelo domínio (`crates/core`), depois infraestrutura, depois IPC — seguindo a direção de dependências do Clean Architecture.

### Fases

| Fase | Nome | Crate(s) | Esforço | Prioridade | Dependências |
|------|------|----------|---------|------------|--------------|
| 1 | **<Nome>** — <subtítulo> | `crates/core` | ~Xh | 🔴 Crítica | — |
| 2 | **<Nome>** — <subtítulo> | `crates/storage` | ~Xh | 🔴 Crítica | Fase 1 |
| 3 | **<Nome>** — <subtítulo> | `crates/sync` | ~Xh | 🟡 Alta | Fase 1 |
...

---

## Critérios de Aceitação (Definição de Done)

- [ ] Zero `unwrap()`/`expect()` fora de `#[cfg(test)]` e código de inicialização justificado
- [ ] `crates/core` sem dependências de infraestrutura (serde_json, tokio, Tauri)
- [ ] Todos os erros tipados com `thiserror` em todos os módulos
- [ ] `cargo clippy --workspace -- -D warnings` sem nenhum warning
- [ ] `cargo test --workspace` passando
- [ ] Coverage ≥ 85% em `crates/core` e `crates/storage`
- [ ] Nenhuma API pública quebrada (backward compatible)

---

## Referências

- `crates/core/src/` — Domínio analisado
- `crates/storage/src/` — Storage analisado
- `crates/search/src/` — Search analisado
- `crates/sync/src/` — Sync analisado
- `src-tauri/src/` — IPC layer analisada
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- Skill: `rust-pro` (Rust 1.75+ Expert)
```

---

### 6. Gerar `fase_1.md`

Crie `docs/refactor-rust-{DATA}/fase_1.md` com os problemas de **maior severidade** (🔴 CRÍTICO — error handling e violações de Clean Architecture), seguindo esta estrutura:

```markdown
# Fase 01 — <Nome: ex: "Error Handling e Invariantes de Domínio">

**Esforço estimado:** ~XX horas
**Prioridade:** 🔴 Crítica
**Dependências:** Nenhuma
**Branch:** `refactor/rust-phase-1-{DATA}`

---

## Objetivo

<O que esta fase corrige e por que é crítica. Ex: eliminar X panics potenciais em produção, isolar o domínio de dependências de infraestrutura.>

---

## Contexto Atual

<Trechos reais de código dos arquivos do projeto que demonstram os problemas. NUNCA invente código — use apenas o que foi lido nos arquivos reais.>

---

## Tarefas

### 1.1 — <Nome da Tarefa>

**Arquivo:** `crates/.../src/...`
**Problema:** <descrição precisa com referência ao código real>

```rust
// código atual problemático (copiado do arquivo real)
```

**Solução proposta:**

```rust
// como deve ficar após a refatoração
```

**Critérios:**
- [ ] ...
- [ ] Testes cobrindo: ...

---

### 1.N — Testes e Validação

| Comando | Resultado esperado |
|---------|-------------------|
| `cargo test --workspace` | Todos passando |
| `cargo clippy --workspace -- -D warnings` | Zero warnings |
| `cargo fmt --all -- --check` | Sem diff |

---

## Arquivos Modificados

| Arquivo | Crate | Tipo de Mudança |
|---------|-------|----------------|
| `crates/.../src/...` | ... | Alteração |

## Arquivos NÃO Modificados nesta Fase

- `...` — Endereçado na Fase 2

---

## Critérios de Aceitação da Fase

- [ ] `cargo test --workspace` passando
- [ ] `cargo clippy --workspace -- -D warnings` sem warnings
- [ ] `cargo fmt --all -- --check` sem diff
- [ ] Nenhuma API pública quebrada
- [ ] PR review aprovado
```

---

### 7. Gerar fases adicionais (se necessário)

Se a análise identificar problemas suficientes para mais fases, crie `fase_2.md`, `fase_3.md`, etc., seguindo o mesmo template. Ordene as fases da seguinte forma:

1. **Fase 1** — `crates/core`: error handling, invariantes de domínio, isolamento de dependências
2. **Fase 2** — `crates/storage`: atomic writes, tratamento de I/O, testabilidade via traits
3. **Fase 3** — `crates/search` e `crates/sync`: async patterns, retry/backoff, mock de providers
4. **Fase 4** — `src-tauri`: delegação correta, bindings ts-rs completos, erros tipados para frontend
5. **Fase 5** (se necessário) — Performance: clones evitáveis, alocações, algoritmos

Cada arquivo de fase deve:
- Cobrir um crate ou área coesa
- Ser independentemente mergeable sem quebrar o que existe
- Referenciar código **real** do projeto (nunca inventado)

---

### 8. Verificar os arquivos gerados

// turbo
```bash
ls -la /Users/leco/RustroverProjects/open-note/docs/refactor-rust-{DATA}/
```

---

### 9. Resumir o diagnóstico

Apresente ao usuário:
- A pasta gerada em `docs/`
- O número total de issues encontrados por categoria e por crate
- Os 3-5 problemas mais críticos com localização exata (crate, arquivo, linha)
- A lista de fases geradas com crate(s) alvo, esforço e prioridade
- A estimativa total de esforço
- Pergunte se há ajustes no escopo ou priorização das fases

---

## Notas Importantes

- **NUNCA implemente código** — este workflow só gera planejamento.
- **Use código real** — ao descrever problemas, inclua trechos reais dos arquivos lidos. Nunca invente exemplos genéricos.
- **Respeite a direção de dependências** — problemas em `crates/core` têm impacto cascata em todos os outros crates. Priorize o domínio.
- **Fases independentes** — cada fase deve poder ser merged em `main` sem quebrar o que existe.
- **Seja específico** — nomes de crates, arquivos, funções, números de linha. Nenhuma vagueza.
- **Clippy é lei** — qualquer pattern que `cargo clippy -- -D warnings` rejeitaria é um issue válido.