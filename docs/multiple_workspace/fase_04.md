# Fase 04 — Frontend Stores Refactor (Namespace por Workspace)

**Esforço estimado:** ~25 horas  
**Prioridade:** 🔴 Crítica  
**Dependências:** Fase 03  
**Branch:** `feat/multi-workspace-phase-4`

---

## Objetivo

Refatorar os Zustand stores do frontend para que cada workspace aberto tenha seu próprio estado isolado (notebooks, sections, pages, navegação). O usuário pode alternar entre workspaces e o estado de cada um é preservado.

---

## Contexto Atual

### `useWorkspaceStore.ts`
```typescript
interface WorkspaceStore {
  workspace: Workspace | null;       // SINGULAR
  notebooks: Notebook[];             // do workspace ativo
  sections: Map<string, Section[]>;  // do workspace ativo
  isLoading: boolean;
  error: string | null;
  // ... actions
}
```

### `useNavigationStore.ts`
```typescript
interface NavigationStore {
  activeView: ActiveView;
  selectedNotebookId: string | null;  // GLOBAL — sem contexto de workspace
  selectedSectionId: string | null;
  selectedPageId: string | null;
  expandedNotebooks: Set<string>;
  history: string[];
  // ...
}
```

### Problema
Ao trocar de workspace, o estado de notebooks/sections/navegação é perdido. Não há como manter dois workspaces "vivos" ao mesmo tempo no frontend.

---

## Arquitetura Proposta

### Modelo: Workspace-Scoped State Map

```typescript
// Cada workspace tem seu próprio "slice" de estado
interface WorkspaceSlice {
  workspace: Workspace;
  notebooks: Notebook[];
  sections: Map<string, Section[]>;
  navigation: {
    activeView: ActiveView;
    selectedNotebookId: string | null;
    selectedSectionId: string | null;
    selectedPageId: string | null;
    expandedNotebooks: Set<string>;
    expandedSections: Set<string>;
    history: string[];
    historyIndex: number;
  };
}

// Store principal
interface MultiWorkspaceStore {
  workspaces: Map<string, WorkspaceSlice>;   // WorkspaceId → state
  focusedWorkspaceId: string | null;

  // Getters derivados
  focusedSlice: () => WorkspaceSlice | null;
  focusedWorkspace: () => Workspace | null;
  focusedNotebooks: () => Notebook[];

  // Actions
  openWorkspace: (path: string) => Promise<void>;
  closeWorkspace: (workspaceId: string) => Promise<void>;
  focusWorkspace: (workspaceId: string) => void;
  // ... notebook/section actions recebem workspaceId implícito (focused)
}
```

---

## Tarefas

### 4.1 — Criar `useMultiWorkspaceStore.ts`

**Arquivo:** `src/stores/useMultiWorkspaceStore.ts`

Store principal que gerencia múltiplos workspaces. Substitui a combinação atual de `useWorkspaceStore` + `useNavigationStore` para dados scoped.

```typescript
import { create } from "zustand";
import * as ipc from "@/lib/ipc";

export const useMultiWorkspaceStore = create<MultiWorkspaceStore>((set, get) => ({
  workspaces: new Map(),
  focusedWorkspaceId: null,

  // ─── Computed ───

  focusedSlice: () => {
    const { workspaces, focusedWorkspaceId } = get();
    if (!focusedWorkspaceId) return null;
    return workspaces.get(focusedWorkspaceId) ?? null;
  },

  // ─── Workspace Lifecycle ───

  openWorkspace: async (path) => {
    const workspace = await ipc.openWorkspace(path);
    const notebooks = await ipc.listNotebooks(workspace.id);

    set((s) => {
      const workspaces = new Map(s.workspaces);
      workspaces.set(workspace.id, {
        workspace,
        notebooks,
        sections: new Map(),
        navigation: defaultNavigation(),
      });
      return { workspaces, focusedWorkspaceId: workspace.id };
    });
  },

  closeWorkspace: async (workspaceId) => {
    await ipc.closeWorkspace(workspaceId);
    set((s) => {
      const workspaces = new Map(s.workspaces);
      workspaces.delete(workspaceId);
      const focused = s.focusedWorkspaceId === workspaceId
        ? (workspaces.keys().next().value ?? null)
        : s.focusedWorkspaceId;
      return { workspaces, focusedWorkspaceId: focused };
    });
  },

  focusWorkspace: (workspaceId) => {
    set({ focusedWorkspaceId: workspaceId });
    ipc.focusWorkspace(workspaceId).catch(console.warn);
  },

  // ─── Scoped Actions (operam no focused) ───
  // ...
}));
```

**Critérios:**
- [ ] Map de WorkspaceSlice indexado por WorkspaceId
- [ ] Computed getters para workspace em foco
- [ ] Actions de lifecycle: open, close, focus
- [ ] Testes unitários com mocks de IPC

---

### 4.2 — Adaptar `useWorkspaceStore` como facade

**Arquivo:** `src/stores/useWorkspaceStore.ts`

**Estratégia:** Em vez de deletar o store existente (breaking change em 50+ componentes), transformá-lo em uma **facade** que delega para `useMultiWorkspaceStore`:

```typescript
// ADAPTER — mantém a API existente, delega para multi-workspace store
export const useWorkspaceStore = create<WorkspaceStore>((set, get) => {
  // Subscribe ao multi-workspace store
  const unsub = useMultiWorkspaceStore.subscribe((multiState) => {
    const slice = multiState.focusedSlice();
    set({
      workspace: slice?.workspace ?? null,
      notebooks: slice?.notebooks ?? [],
      sections: slice?.sections ?? new Map(),
    });
  });

  return {
    workspace: null,
    notebooks: [],
    sections: new Map(),
    isLoading: false,
    error: null,

    openWorkspace: async (path) => {
      set({ isLoading: true });
      try {
        await useMultiWorkspaceStore.getState().openWorkspace(path);
        set({ isLoading: false });
      } catch (e) {
        set({ isLoading: false, error: String(e) });
      }
    },
    // ... demais actions delegam para multiStore
  };
});
```

**Critérios:**
- [ ] API idêntica à atual — ZERO breaking changes em componentes
- [ ] Componentes existentes continuam usando `useWorkspaceStore`
- [ ] Novos componentes podem usar `useMultiWorkspaceStore` diretamente
- [ ] Testes existentes de `useWorkspaceStore` passam sem alteração

---

### 4.3 — Adaptar `useNavigationStore` com workspace scope

**Arquivo:** `src/stores/useNavigationStore.ts`

O navigation state agora vive dentro do `WorkspaceSlice`. O store existente vira facade:

```typescript
export const useNavigationStore = create<NavigationStore>((set, get) => ({
  // Getters delegam para o focused slice no multi-workspace store
  get activeView() {
    return useMultiWorkspaceStore.getState().focusedSlice()?.navigation.activeView ?? "home";
  },
  // ...

  selectPage: (id) => {
    const focusedId = useMultiWorkspaceStore.getState().focusedWorkspaceId;
    if (!focusedId) return;
    useMultiWorkspaceStore.getState().updateNavigation(focusedId, (nav) => ({
      ...nav,
      activeView: "page",
      selectedPageId: id,
    }));
  },
}));
```

**Critérios:**
- [ ] Estado de navegação preservado por workspace ao trocar
- [ ] Histórico de páginas isolado por workspace
- [ ] `reset()` limpa apenas o workspace em foco
- [ ] API do store mantida para componentes existentes

---

### 4.4 — Hook `useFocusedWorkspace`

**Arquivo:** `src/hooks/useFocusedWorkspace.ts`

Hook de conveniência para componentes:

```typescript
export function useFocusedWorkspace() {
  const focusedId = useMultiWorkspaceStore((s) => s.focusedWorkspaceId);
  const slice = useMultiWorkspaceStore((s) =>
    focusedId ? s.workspaces.get(focusedId) : null
  );

  return {
    workspaceId: focusedId,
    workspace: slice?.workspace ?? null,
    notebooks: slice?.notebooks ?? [],
    sections: slice?.sections ?? new Map(),
    navigation: slice?.navigation ?? null,
  };
}
```

**Critérios:**
- [ ] Re-renderiza apenas quando o slice muda (selector otimizado)
- [ ] Retorna nulls seguros quando nenhum workspace ativo

---

### 4.5 — Hook `useWorkspaceList`

**Arquivo:** `src/hooks/useWorkspaceList.ts`

```typescript
export function useWorkspaceList() {
  const workspaces = useMultiWorkspaceStore((s) => s.workspaces);
  const focusedId = useMultiWorkspaceStore((s) => s.focusedWorkspaceId);

  return {
    workspaces: Array.from(workspaces.values()),
    focusedId,
    count: workspaces.size,
  };
}
```

**Critérios:**
- [ ] Lista reativa de workspaces abertos
- [ ] Usado pelo Workspace Switcher (Fase 5)

---

### 4.6 — Testes unitários stores

**Arquivo:** `src/stores/__tests__/useMultiWorkspaceStore.test.ts`

| Teste | Descrição |
|-------|-----------|
| `initial_state_empty` | Sem workspaces, focused null |
| `open_workspace_adds_to_map` | Open → workspace na map + focused |
| `open_second_workspace_keeps_first` | Open A, Open B → ambos na map, B focused |
| `close_workspace_removes_from_map` | Close → removido, focused atualizado |
| `close_focused_moves_to_next` | Close focused → próximo vira focused |
| `close_last_clears_focused` | Close único → focused null |
| `focus_workspace_changes_focused` | Focus B → focusedId = B |
| `notebooks_scoped_per_workspace` | A com notebooks, B com notebooks → isolados |
| `navigation_scoped_per_workspace` | Selecionar page no A → B não afetado |
| `facade_workspace_store_reflects_focused` | useWorkspaceStore reflete o focused do multi |

**Critérios:**
- [ ] Todos os testes existentes de `useWorkspaceStore` continuam passando
- [ ] Testes novos cobrem isolamento e transição
- [ ] Mocks de IPC para `listOpenWorkspaces`, `focusWorkspace`

---

### 4.7 — Atualizar `App.tsx` para multi-workspace

**Arquivo:** `src/App.tsx`

Mudança mínima: usar `useMultiWorkspaceStore` para decidir se mostra WorkspacePicker:

```typescript
const workspaceCount = useMultiWorkspaceStore((s) => s.workspaces.size);
const showPicker = useUIStore((s) => s.showWorkspacePicker);

// Mostra picker se nenhum workspace aberto OU explicitamente solicitado
if (workspaceCount === 0 || (showPicker && workspaceCount === 0)) {
  return <WorkspacePicker />;
}

// Quando há workspace(s) aberto(s), renderiza o editor
// WorkspacePicker pode ser um modal em vez de full-screen
return <MainLayout />;
```

**Critérios:**
- [ ] Com 0 workspaces → WorkspacePicker full-screen (como hoje)
- [ ] Com 1+ workspaces → Editor com picker como modal (se solicitado)
- [ ] Transição suave entre estados

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `src/stores/useMultiWorkspaceStore.ts` | **Novo** — store principal |
| `src/stores/useWorkspaceStore.ts` | Refatorado para facade |
| `src/stores/useNavigationStore.ts` | Refatorado para facade |
| `src/hooks/useFocusedWorkspace.ts` | **Novo** |
| `src/hooks/useWorkspaceList.ts` | **Novo** |
| `src/stores/__tests__/useMultiWorkspaceStore.test.ts` | **Novo** |
| `src/App.tsx` | Ajuste mínimo na condição de render |

## Arquivos NÃO Modificados

- Nenhum componente existente precisa mudar (facades mantêm API)
- `src/lib/ipc.ts` — Já atualizado na Fase 3

---

## Critérios de Aceitação da Fase

- [ ] `npm run test` passa (todos os testes existentes + novos)
- [ ] `npm run typecheck` sem erros
- [ ] `npm run lint` limpo
- [ ] Componentes existentes funcionam sem alteração (facade pattern)
- [ ] Novos hooks disponíveis para componentes da Fase 5
- [ ] Estado isolado por workspace comprovado em testes
- [ ] PR review aprovado

---

## Notas de Design

### Por que Facade em vez de Rewrite?

O projeto tem ~50 componentes que importam `useWorkspaceStore`. Reescrever todos de uma vez:
- Alto risco de regressão
- PR gigante impossível de revisar
- Testes quebrados em massa

A facade permite migração **gradual**: componentes novos usam `useMultiWorkspaceStore`, existentes migram no ritmo do time.

### Zustand Map vs Zustand Slices

**Map<WorkspaceId, Slice>** foi escolhido sobre slices nomeados porque:
- Número dinâmico de workspaces (0-10)
- Não sabemos os IDs em build-time
- Map permite lookup O(1) e iteração fácil
- Zustand subscriptions com selector funcionam com Maps

### Persistência do Estado Multi-Workspace

O `AppState` (Fase 1) já persiste `active_workspaces` no JSON. Na inicialização:
1. Ler `app_state.json` → `active_workspaces`
2. Para cada um, chamar `openWorkspace(path)`
3. Focar no `focused_workspace_id`

Isso será implementado no `App.tsx` `useEffect` de inicialização.
