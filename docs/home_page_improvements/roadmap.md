# Home Page Improvements — Roadmap

## Visão Geral

Corrigir bugs críticos na `HomePage` e adicionar duas features que melhoram substancialmente a experiência inicial do usuário: **Quick Notes** (área de anotações rápidas criada automaticamente em todo workspace) e **mover página entre notebooks** via menu de contexto.

---

## Estado Atual

### Bugs identificados

| Bug | Localização | Causa raiz |
|-----|-------------|-----------|
| Notas recentes duplicadas | `HomePage.tsx:35` | `history[]` acumula IDs repetidos; `reverse().slice(0,6)` não deduplica |
| "Nova Página" (⌘N) não faz nada | `HomePage.tsx:123` | `onClick={() => {}}` — handler vazio |
| "Novo Notebook" (⌘⇧N) não faz nada | `HomePage.tsx:130` | `onClick={() => {}}` — handler vazio |

### Contexto atual relevante

```
useNavigationStore.history[]
  └── Acumula page_id a cada selectPage()
      Exemplo: ["page-A", "page-B", "page-A", "page-C", "page-A"]
      reverse().slice(0,6) → ["page-A", "page-C", "page-A", "page-B", "page-A"]
      = page-A aparece 3x na tela

HomePage quick actions
  └── "Nova Página"   → onClick={() => {}}  ← dead code
  └── "Novo Notebook" → onClick={() => {}}  ← dead code
  └── "Buscar"        → openQuickOpen()     ← ok
  └── "Configurações" → openSettings()      ← ok
```

### Ausência de Quick Notes

Ao criar um workspace, nenhum notebook/section é criado automaticamente. O usuário precisa:
1. Criar manualmente um notebook
2. Criar manualmente uma section
3. Só então criar uma página

Não há conceito de "área de rascunho" para anotações rápidas.

### Ausência de Move Page na UI

O backend já possui `move_page` (IPC command em `commands/page.rs:142-156`) e a store já tem `movePage` (`usePageStore.ts:107-117`). Porém o `ContextMenu.tsx` não expõe essa opção para páginas — o menu de contexto de page só tem "Excluir".

```
ContextMenu (type="page")
  └── items[] = [{ Trash2, "Excluir" }]   ← único item, sem "Mover para..."
```

---

## Avaliação de Complexidade

### Classificação: 🟢 BAIXA (Score: 3/10)

**Justificativa:**

| Fator | Impacto | Nota |
|-------|---------|------|
| Mudanças no domínio (`crates/core`) | Nenhuma | 0/5 |
| Mudanças no storage (`crates/storage`) | Mínima — `create_workspace` inicializa Quick Notes | 1/5 |
| Mudanças no Tauri IPC (`src-tauri`) | Mínima — reutiliza commands existentes | 1/5 |
| Mudanças nos stores (frontend) | Baixa — `useMultiWorkspaceStore.createWorkspace` + `usePageStore` | 2/5 |
| Mudanças na UI (componentes) | Média — `HomePage`, `ContextMenu`, novo `MovePageDialog` | 3/5 |
| Testes existentes | Baixo impacto — não quebra nenhum teste existente | 1/5 |

**Estimativa de esforço total: ~18-24 horas de desenvolvimento**

### Riscos Principais

1. **Quick Notes: identidade persistente** — precisamos de uma convenção para identificar o notebook/section de Quick Notes após criação (flag no metadata ou nome reservado)
2. **Move Page Dialog: UX** — listar todas as sections de todos os notebooks pode ser verboso; precisamos de estrutura hierárquica clara
3. **Deduplicação de histórico** — o fix deve preservar a ordem cronológica (mais recente primeiro) sem afetar `historyIndex` (navegação back/forward)

---

## Estratégia de Implementação

### Princípio: Bug-first, Incremental, Zero Breaking Changes

Fase 1 corrige os bugs imediatamente (alto valor, baixo risco). Fases 2 e 3 adicionam features independentes que podem ser mergeadas separadamente.

### Fases

| Fase | Nome | Esforço | Prioridade | Dependências |
|------|------|---------|------------|--------------|
| 1 | **Bug Fixes** — histórico deduplicado + botões funcionais | ~4h | 🔴 Crítica | — |
| 2 | **Quick Notes** — auto-criação + botão "Nova Página" conectado | ~10h | 🟡 Alta | Fase 1 |
| 3 | **Move Page** — UI para mover página entre sections/notebooks | ~8h | 🟡 Alta | — |

---

## Modelo de Domínio Proposto

### Quick Notes — Identificação do notebook padrão

**Opção adotada:** campo `quick_notes_notebook_id: Option<NotebookId>` em `WorkspaceSettings` (já existente em `crates/core/src/workspace.rs`).

```
Workspace
├── workspace.json
│   └── settings.quick_notes_notebook_id: Option<Uuid>   ← NOVO
│   └── settings.quick_notes_section_id: Option<Uuid>    ← NOVO
└── notebooks/
    └── quick-notes/
        ├── notebook.json  { name: "Quick Notes", ... }
        └── quick-notes/
            └── section.json  { name: "Quick Notes", ... }
```

### Histórico deduplicado (frontend only)

```
Antes:  history = ["A", "B", "A", "C", "A"]
         reverse().slice(0,6) → ["A", "C", "A", "B", "A"]

Depois: dedup = unique IDs preservando mais recente
         ["A", "B", "A", "C", "A"] → seen set → ["A", "C", "B"]
         mostrar: A, C, B (sem duplicatas, mais recente primeiro)
```

---

## Critérios de Aceitação (Definição de Done)

- [ ] Notas recentes nunca mostram a mesma página duas vezes
- [ ] Botão "Nova Página" cria uma página no Quick Notes e navega para ela
- [ ] Botão "Novo Notebook" abre um input inline ou dialog para nome e cria o notebook
- [ ] Todo workspace novo já possui notebook "Quick Notes" com section "Quick Notes"
- [ ] Workspaces existentes **não são afetados** (sem migration obrigatória)
- [ ] Menu de contexto de página tem opção "Mover para..." que lista sections disponíveis
- [ ] Mover uma página redireciona a navegação corretamente
- [ ] Todos os testes existentes continuam passando
- [ ] Novos testes cobrem: deduplicação, criação via Quick Notes, move page

---

## Referências

- `src/components/pages/HomePage.tsx` — página com os bugs
- `src/stores/useNavigationStore.ts` — `history[]` e `selectPage`
- `src/stores/useMultiWorkspaceStore.ts` — `createWorkspace`
- `src/stores/usePageStore.ts` — `movePage`
- `src/components/shared/ContextMenu.tsx` — menu de contexto de página
- `src/components/sidebar/NotebookTree.tsx` — árvore de notebooks/sections
- `src-tauri/src/commands/workspace.rs` — `create_workspace` backend
- `src-tauri/src/commands/page.rs` — `move_page` backend (já implementado)
- `crates/core/src/workspace.rs` — `WorkspaceSettings`
