---
description: Refactor React — analisa todo o frontend com react-best-practices e gera plano de refatoração em docs/
---

Workflow ativado pelo comando `/refactor-react`. Analisa o código React/TypeScript do projeto inteiro como um especialista em performance e boas práticas, e gera documentação de planejamento de refatoração — **sem implementar nenhuma mudança de código**.

## Skill Requerida

Este workflow utiliza a skill `react-best-practices` (Vercel React Best Practices). Consulte as regras nas categorias:

- **CRÍTICO** — `async-*` (waterfalls) e `bundle-*` (bundle size)
- **ALTO** — `server-*` (Server-Side Performance)
- **MÉDIO-ALTO** — `client-*` (Client-Side Data Fetching)
- **MÉDIO** — `rerender-*` (Re-render Optimization) e `rendering-*` (Rendering Performance)
- **BAIXO-MÉDIO** — `js-*` (JavaScript Performance)
- **BAIXO** — `advanced-*` (Advanced Patterns)

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
ls /Users/leco/RustroverProjects/open-note/docs/ | grep refactor-react
```

Se já existir `refactor-react-{DATA}`, adicione sufixo `-v2` ou similar.

---

### 3. Criar a pasta de output

// turbo
```bash
mkdir -p /Users/leco/RustroverProjects/open-note/docs/refactor-react-{DATA}
```

---

### 4. Escanear o frontend completo

Leia e analise **todos** os arquivos relevantes do frontend como um especialista. Não pule arquivos. Concentre-se em:

#### 4.1 — Componentes

```bash
find /Users/leco/RustroverProjects/open-note/src/components -name "*.tsx" -o -name "*.ts" | sort
```

Para cada componente identificado, avalie:
- Waterfalls de dados (chamadas IPC sequenciais que poderiam ser paralelas)
- Re-renders desnecessários (falta de `memo`, `useCallback`, `useMemo`)
- Lógica de estado derivada computada no render
- JSX estático dentro de componentes (deveria ser hoisted)
- Imports de barrel que inflam o bundle

#### 4.2 — Stores Zustand

```bash
find /Users/leco/RustroverProjects/open-note/src -name "*.ts" -path "*/stores/*" | sort
```

Avalie:
- Subscriptions desnecessárias a todo o store quando só um campo é usado
- Estado derivado calculado no render vs. seletores otimizados
- Callbacks instáveis causando re-renders em cascata

#### 4.3 — Hooks customizados

```bash
find /Users/leco/RustroverProjects/open-note/src/hooks -name "*.ts" -o -name "*.tsx" | sort
```

Avalie:
- Effect dependencies com objetos/arrays (deveria usar primitivos)
- Event listeners duplicados ou não limpos
- Estado lazy initialization ausente para cálculos pesados

#### 4.4 — Biblioteca e utilitários

```bash
find /Users/leco/RustroverProjects/open-note/src/lib -name "*.ts" | sort
```

Avalie:
- Funções puras que poderiam ser cacheadas no nível do módulo
- Lookups repetidos em arrays que poderiam usar `Map` ou `Set`
- RegExp criadas dentro de loops

#### 4.5 — Métricas gerais

```bash
find /Users/leco/RustroverProjects/open-note/src -name "*.tsx" -o -name "*.ts" | grep -v "__tests__" | grep -v ".d.ts" | wc -l
```

```bash
cat /Users/leco/RustroverProjects/open-note/package.json
```

---

### 5. Gerar `roadmap.md`

Crie `docs/refactor-react-{DATA}/roadmap.md` seguindo esta estrutura:

```markdown
# Refactor React — Roadmap

**Data da análise:** {DATA}
**Versão do projeto analisado:** (extrair do package.json)
**Especialista:** react-best-practices (Vercel React Best Practices — 45 regras em 8 categorias)

---

## Visão Geral

<Resumo do estado atual do frontend e o que esta refatoração busca melhorar. Mencione as categorias de problemas encontrados e o impacto esperado em performance, manutenibilidade e bundle size.>

---

## Diagnóstico Geral

### Problemas Encontrados por Categoria

| Categoria | Regra | Arquivo(s) | Severidade | Impacto |
|-----------|-------|-----------|------------|---------|
| Waterfalls | `async-*` | ... | 🔴 CRÍTICO | ... |
| Bundle Size | `bundle-*` | ... | 🔴 CRÍTICO | ... |
| Re-renders | `rerender-*` | ... | 🟡 MÉDIO | ... |
| Rendering | `rendering-*` | ... | 🟡 MÉDIO | ... |
| JS Perf | `js-*` | ... | 🟢 BAIXO | ... |

### Arquivos com Maior Concentração de Problemas

| Arquivo | Nº de Issues | Categorias |
|---------|-------------|------------|
| ... | ... | ... |

---

## Estado Atual

### Arquitetura Frontend

<Descreva a estrutura atual: componentes principais, stores Zustand, hooks customizados, fluxo de dados IPC>

### Pontos de Acoplamento e Problemas Críticos

| Arquivo | Problema | Regra Violada |
|---------|---------|---------------|
| ... | ... | ... |

---

## Avaliação de Complexidade

### Classificação: 🟢 BAIXA / 🟡 MÉDIA / 🟠 ALTA / 🔴 MUITO ALTA (Score: X/10)

**Justificativa:**

| Fator | Impacto | Nota |
|-------|---------|------|
| Quantidade de componentes afetados | ... | .../5 |
| Risco de regressão | ... | .../5 |
| Esforço de testes | ... | .../5 |

**Estimativa de esforço total: ~XX horas de desenvolvimento**

### Riscos Principais

1. ...
2. ...

---

## Estratégia de Refatoração

### Princípio: Incremental, Prioritizado por Impacto

Cada fase é independente, mergeable em `main`, e entrega melhoria mensurável sem quebrar funcionalidade existente.

### Fases

| Fase | Nome | Regras Abordadas | Esforço | Prioridade | Dependências |
|------|------|-----------------|---------|------------|--------------|
| 1 | **<Nome>** — <subtítulo> | `async-*`, `bundle-*` | ~Xh | 🔴 Crítica | — |
| 2 | **<Nome>** — <subtítulo> | `rerender-*` | ~Xh | 🟡 Alta | Fase 1 |
...

---

## Critérios de Aceitação (Definição de Done)

- [ ] Nenhum waterfall de dados identificado na análise permanece
- [ ] Bundle size reduzido ou mantido (sem regressão)
- [ ] Zero re-renders desnecessários nos componentes críticos
- [ ] `npm run typecheck` sem erros
- [ ] `npm run lint` sem warnings
- [ ] Todos os testes existentes continuam passando
- [ ] Coverage ≥ 85%

---

## Referências

- `src/components/` — Componentes analisados
- `src/stores/` — Stores Zustand analisados
- `src/hooks/` — Hooks customizados analisados
- `docs/ARCHITECTURE.md`
- Skill: `react-best-practices` (regras completas em `AGENTS.md`)
```

---

### 6. Gerar `fase_1.md`

Crie `docs/refactor-react-{DATA}/fase_1.md` com os problemas de **maior severidade** (🔴 CRÍTICO — waterfalls e bundle size), seguindo esta estrutura:

```markdown
# Fase 01 — <Nome: ex: "Eliminação de Waterfalls e Redução de Bundle">

**Esforço estimado:** ~XX horas
**Prioridade:** 🔴 Crítica
**Dependências:** Nenhuma
**Branch:** `refactor/react-phase-1-{DATA}`

---

## Objetivo

<O que esta fase corrige e qual o impacto mensurável esperado (ex: -X ms no TTI, -X KB no bundle)>

---

## Contexto Atual

<Trechos reais de código dos arquivos do projeto que demonstram os problemas identificados. NUNCA invente código — use apenas o que foi lido nos arquivos.>

---

## Tarefas

### 1.1 — <Nome da Tarefa>

**Arquivo:** `src/...`
**Regra:** `async-parallel` / `bundle-barrel-imports` / etc.
**Problema:**
```tsx
// código atual com o problema (copiado do arquivo real)
```
**Solução proposta:**
```tsx
// como deve ficar após a refatoração
```
**Critérios:**
- [ ] ...
- [ ] Testes cobrindo: ...

---

### 1.N — Testes e Validação

| Comando | Resultado esperado |
|---------|-------------------|
| `npm run typecheck` | Zero erros |
| `npm run lint` | Zero warnings |
| `npm run test` | Todos passando |

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `src/...` | Alteração |

## Arquivos NÃO Modificados nesta Fase

- `...` — Endereçado na Fase 2

---

## Critérios de Aceitação da Fase

- [ ] `npm run typecheck` sem erros
- [ ] `npm run lint` sem warnings
- [ ] `npm run test` passando
- [ ] Bundle size ≤ ao baseline atual
- [ ] PR review aprovado
```

---

### 7. Gerar fases adicionais (se necessário)

Se a análise identificar problemas suficientes para mais de uma fase, crie `fase_2.md`, `fase_3.md`, etc., seguindo o mesmo template da Fase 1, mas com os problemas de menor severidade (🟡 re-renders, 🟢 JS performance).

Cada arquivo de fase deve:
- Cobrir uma categoria de problemas coesa
- Ser independentemente mergeable
- Referenciar código **real** do projeto (nunca inventado)

---

### 8. Verificar os arquivos gerados

// turbo
```bash
ls -la /Users/leco/RustroverProjects/open-note/docs/refactor-react-{DATA}/
```

---

### 9. Resumir o diagnóstico

Apresente ao usuário:
- A pasta gerada em `docs/`
- O número total de issues encontrados por categoria
- Os 3-5 problemas mais críticos com localização exata
- A lista de fases geradas com esforço e prioridade
- A estimativa total de esforço
- Pergunte se há ajustes no escopo ou priorização das fases

---

## Notas Importantes

- **NUNCA implemente código** — este workflow só gera planejamento.
- **Use código real** — ao descrever problemas, inclua trechos reais dos arquivos lidos. Nunca invente exemplos genéricos.
- **Priorize pelo impacto** — siga a ordem de categorias da skill: waterfalls > bundle > server > client > re-renders > rendering > JS perf > advanced.
- **Fases independentes** — cada fase deve poder ser merged em `main` sem quebrar o que existe.
- **Seja específico** — nomes de arquivos, número de linha, nome da função/componente. Nenhuma vagueza.
