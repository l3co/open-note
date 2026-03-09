# Fase 04 — Store Selectors & Re-render Optimization

**Esforço estimado:** ~15 horas  
**Impacto:** 🟠 ALTO  
**Dependências:** Nenhuma (pode ser feita em paralelo)  
**Branch:** `refactor/store-selectors`

---

## Objetivo

Otimizar os Zustand stores para minimizar re-renders desnecessários usando **seletores granulares**, **derived state** e **subscriptions atômicas**. Atualmente, vários componentes subscrevem a objetos inteiros quando precisam apenas de um booleano ou uma action.

**Regras Vercel:** `rerender-derived-state`, `rerender-defer-reads`, `rerender-memo`, `rerender-functional-setstate`

---

## Diagnóstico Detalhado

### Problema 1: Destructuring do store inteiro

```tsx
// ❌ App.tsx — re-renderiza quando QUALQUER campo de useUIStore muda
const { showWorkspacePicker, openWorkspacePicker, applyThemeToDOM } = useUIStore();

// ❌ Sidebar.tsx — re-renderiza quando sidebarOpen, sidebarWidth OU qualquer outro campo muda
const { sidebarOpen, sidebarWidth, setSidebarWidth } = useUIStore();

// ❌ NotebookTree.tsx — puxa 6 propriedades + 4 actions
const { notebooks, loadSections, sections, reorderNotebooks, renameNotebook, renameSection } = useWorkspaceStore();
```

**Quando desestrutura sem selector, Zustand faz shallow compare do STORE INTEIRO.** Qualquer toggle de `showTrashPanel` re-renderiza `Sidebar`, `App`, etc.

### Problema 2: Actions causam re-render desnecessário

```tsx
// ❌ As actions nunca mudam, mas são incluídas na subscription
const { goBack, goForward, historyIndex, history } = useNavigationStore();
```

Actions Zustand são referências estáveis — não precisam estar na subscription. Devem ser acessadas via `.getState()` ou seletor separado.

### Problema 3: ContentArea subscreve a currentPage inteiro

```tsx
// ❌ ContentArea.tsx — re-renderiza quando QUALQUER campo de pageStore muda
const { currentPage, isLoading } = usePageStore();
```

`ContentArea` só precisa saber: `isLoading`, `!!currentPage`, e `activeView`. Não precisa do objeto `currentPage` completo.

### Problema 4: Toolbar subscreve ao history[] inteiro

```tsx
// ❌ Toolbar.tsx — history é um array que muda a cada navegação
const { goBack, goForward, historyIndex, history } = useNavigationStore();
const canGoBack = historyIndex > 0;
const canGoForward = historyIndex < history.length - 1;
```

Toolbar só precisa de dois booleanos: `canGoBack` e `canGoForward`.

---

## Tarefas

### 4.1 — Refatorar `useUIStore` com seletores atômicos

**Arquivo:** `src/stores/useUIStore.ts`

Adicionar seletores exportados:

```tsx
// ─── Seletores atômicos ───
export const selectSidebarOpen = (s: UIStore) => s.sidebarOpen;
export const selectSidebarWidth = (s: UIStore) => s.sidebarWidth;
export const selectTheme = (s: UIStore) => s.theme;
export const selectEditorConfig = (s: UIStore) => s.editorConfig;
export const selectShowWorkspacePicker = (s: UIStore) => s.showWorkspacePicker;
export const selectShowTrashPanel = (s: UIStore) => s.showTrashPanel;
export const selectShowQuickOpen = (s: UIStore) => s.showQuickOpen;
export const selectShowSearchPanel = (s: UIStore) => s.showSearchPanel;
export const selectShowSettings = (s: UIStore) => s.showSettings;
export const selectShowSyncSettings = (s: UIStore) => s.showSyncSettings;
```

**Critérios:**
- [ ] Seletores exportados para cada campo de estado
- [ ] Componentes migrados para usar seletores individuais
- [ ] Actions acessadas via `useUIStore.getState()` ou seletor separado

---

### 4.2 — Migrar `App.tsx` para seletores

**Arquivo:** `src/App.tsx`

**Antes:**
```tsx
const { showWorkspacePicker, openWorkspacePicker, applyThemeToDOM } = useUIStore();
const { workspace, openWorkspace } = useWorkspaceStore();
```

**Depois:**
```tsx
const showWorkspacePicker = useUIStore(selectShowWorkspacePicker);
const workspace = useWorkspaceStore((s) => s.workspace);

// Actions via getState (estáveis, não causam re-render)
const { openWorkspacePicker, applyThemeToDOM } = useUIStore.getState();
const { openWorkspace } = useWorkspaceStore.getState();
```

**Ou para actions usadas em effects:**
```tsx
useEffect(() => {
  const { applyThemeToDOM } = useUIStore.getState();
  applyThemeToDOM();
  // ...
}, []);
```

**Critérios:**
- [ ] App re-renderiza APENAS quando `showWorkspacePicker` ou `workspace` muda
- [ ] Actions não estão na subscription

---

### 4.3 — Migrar `Sidebar.tsx` para seletores

**Arquivo:** `src/components/sidebar/Sidebar.tsx`

**Antes:**
```tsx
const { sidebarOpen, sidebarWidth, setSidebarWidth } = useUIStore();
```

**Depois:**
```tsx
const sidebarOpen = useUIStore(selectSidebarOpen);
const sidebarWidth = useUIStore(selectSidebarWidth);
const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);
```

**Nota:** `setSidebarWidth` é uma action estável que poderia usar `getState()`, mas é usada no `useEffect` deps, então mantemos como seletor.

**Critérios:**
- [ ] Sidebar não re-renderiza ao abrir trash/quickopen/settings

---

### 4.4 — Migrar `Toolbar.tsx` com derived state

**Arquivo:** `src/components/layout/Toolbar.tsx`

**Antes:**
```tsx
const { goBack, goForward, historyIndex, history } = useNavigationStore();
const canGoBack = historyIndex > 0;
const canGoForward = historyIndex < history.length - 1;
```

**Depois — Seletor derivado:**
```tsx
const canGoBack = useNavigationStore((s) => s.historyIndex > 0);
const canGoForward = useNavigationStore((s) => s.historyIndex < s.history.length - 1);
const goBack = useNavigationStore((s) => s.goBack);
const goForward = useNavigationStore((s) => s.goForward);
```

**Resultado:** Toolbar re-renderiza APENAS quando `canGoBack` ou `canGoForward` muda (booleano), não a cada push no history[].

**Critérios:**
- [ ] Toolbar subscreve a booleanos derivados, não ao array history
- [ ] Re-renders reduzidos significativamente

---

### 4.5 — Migrar `ContentArea.tsx` com seletor minimal

**Arquivo:** `src/components/layout/ContentArea.tsx`

**Antes:**
```tsx
const { activeView, selectedPageId } = useNavigationStore();
const { currentPage, isLoading } = usePageStore();
```

**Depois:**
```tsx
const activeView = useNavigationStore((s) => s.activeView);
const selectedPageId = useNavigationStore((s) => s.selectedPageId);
const hasPage = usePageStore((s) => s.currentPage !== null);
const isLoading = usePageStore((s) => s.isLoading);
const currentPage = usePageStore((s) => s.currentPage);
```

**Alternativa melhor — split do componente:**
```tsx
export function ContentArea() {
  const activeView = useNavigationStore((s) => s.activeView);
  const selectedPageId = useNavigationStore((s) => s.selectedPageId);
  const isLoading = usePageStore((s) => s.isLoading);

  if (isLoading) return <LoadingSpinner />;
  if (activeView === "home" || !selectedPageId) return <HomePage />;
  if (activeView === "tags") return <TagsPage />;

  // PageView lê currentPage internamente
  return <PageViewWrapper />;
}

function PageViewWrapper() {
  const currentPage = usePageStore((s) => s.currentPage);
  if (!currentPage) return <HomePage />;
  return <PageView page={currentPage} />;
}
```

**Critérios:**
- [ ] ContentArea não re-renderiza quando `currentPage` muda (apenas PageViewWrapper)
- [ ] Loading state isolado

---

### 4.6 — Migrar `NotebookTree.tsx` com seletores granulares

**Arquivo:** `src/components/sidebar/NotebookTree.tsx`

**Antes:**
```tsx
const { notebooks, loadSections, sections, reorderNotebooks, renameNotebook, renameSection } = useWorkspaceStore();
const { selectedNotebookId, selectedSectionId, selectedPageId, expandedNotebooks, expandedSections, toggleNotebook, toggleSection, selectPage } = useNavigationStore();
const { loadPages, loadPage, pages } = usePageStore();
```

**Depois:**
```tsx
const notebooks = useWorkspaceStore((s) => s.notebooks);
const sections = useWorkspaceStore((s) => s.sections);
const selectedNotebookId = useNavigationStore((s) => s.selectedNotebookId);
const selectedSectionId = useNavigationStore((s) => s.selectedSectionId);
const selectedPageId = useNavigationStore((s) => s.selectedPageId);
const expandedNotebooks = useNavigationStore((s) => s.expandedNotebooks);
const expandedSections = useNavigationStore((s) => s.expandedSections);
const pages = usePageStore((s) => s.pages);

// Actions via getState
const { loadSections, reorderNotebooks, renameNotebook, renameSection } = useWorkspaceStore.getState();
const { toggleNotebook, toggleSection, selectPage } = useNavigationStore.getState();
const { loadPages, loadPage } = usePageStore.getState();
```

**Critérios:**
- [ ] Actions não estão na subscription (estáveis)
- [ ] Cada campo de estado tem seu próprio seletor
- [ ] NotebookTree não re-renderiza ao mudar `isLoading` do pageStore

---

### 4.7 — Migrar search/modal components

**Arquivos:** `QuickOpen.tsx`, `SearchPanel.tsx`, `TrashPanel.tsx`, `SettingsDialog.tsx`

Padrão para modais:
```tsx
// ✅ Seletor atômico para visibilidade
const show = useUIStore((s) => s.showQuickOpen);        // já usa seletor ✓
const close = useUIStore((s) => s.closeQuickOpen);      // já usa seletor ✓
```

QuickOpen e SearchPanel **já usam seletores individuais** ✓. Verificar apenas:
- `TrashPanel.tsx` — `const { showTrashPanel, closeTrashPanel } = useUIStore();` → migrar
- `SettingsDialog.tsx` — já usa seletores ✓

**Critérios:**
- [ ] Todos os modais usam seletores atômicos
- [ ] Nenhum modal re-renderiza ao abrir outro modal

---

### 4.8 — Fix do `useAutoSave` — refs não causam re-render

**Arquivo:** `src/hooks/useAutoSave.ts`

**Problema:**
```tsx
return {
  isSaving: savingRef.current,      // ← valor capturado no momento do render
  lastSavedAt: lastSavedRef.current, // ← nunca atualiza a UI
  error: errorRef.current,           // ← nunca atualiza a UI
  forceSave,
};
```

Refs não causam re-render. `isSaving` será sempre o valor do último render, nunca `true` durante o save.

**Solução — usar estado para valores que a UI precisa:**
```tsx
const [saveState, setSaveState] = useState<{
  isSaving: boolean;
  lastSavedAt: Date | null;
  error: string | null;
}>({ isSaving: false, lastSavedAt: null, error: null });

const doSave = useCallback(async (doc: JSONContent) => {
  setSaveState(s => ({ ...s, isSaving: true, error: null }));
  try {
    await onSaveRef.current(doc);
    setSaveState({ isSaving: false, lastSavedAt: new Date(), error: null });
  } catch (err) {
    setSaveState(s => ({ ...s, isSaving: false, error: String(err) }));
  }
}, []);

return { ...saveState, forceSave };
```

**Critérios:**
- [ ] `isSaving` é reativo (UI mostra indicador de salvamento)
- [ ] `lastSavedAt` atualiza na UI
- [ ] `error` mostra na UI quando save falha
- [ ] Debounce ainda funciona corretamente
- [ ] Testes existentes atualizados

---

### 4.9 — Testes de re-render

**Arquivo:** `src/stores/__tests__/rerender.test.tsx`

Testes que verificam que componentes não re-renderizam desnecessariamente:

```tsx
import { renderHook, act } from "@testing-library/react";

test("Sidebar does not re-render when showQuickOpen changes", () => {
  const renderCount = { current: 0 };
  // ... mock component that counts renders
  // ... change showQuickOpen
  // ... assert renderCount unchanged
});
```

| Teste | Assertion |
|-------|-----------|
| Sidebar vs showQuickOpen | 0 re-renders |
| Toolbar vs currentPage change | 0 re-renders |
| ContentArea vs expandedNotebooks | 0 re-renders |
| PageView vs sidebarWidth | 0 re-renders |

**Critérios:**
- [ ] Testes provam isolamento de re-renders
- [ ] Nenhum componente re-renderiza por mudanças irrelevantes no store

---

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `src/stores/useUIStore.ts` | Exportar seletores atômicos |
| `src/stores/useNavigationStore.ts` | Seletores derivados (canGoBack) |
| `src/App.tsx` | Seletores + actions via getState |
| `src/components/sidebar/Sidebar.tsx` | Seletores atômicos |
| `src/components/layout/Toolbar.tsx` | Derived state para booleans |
| `src/components/layout/ContentArea.tsx` | Split + seletores minimal |
| `src/components/sidebar/NotebookTree.tsx` | Seletores + actions getState |
| `src/components/shared/TrashPanel.tsx` | Seletores atômicos |
| `src/hooks/useAutoSave.ts` | Fix refs → useState |
| `src/stores/__tests__/rerender.test.tsx` | **Novo** |

---

## Critérios de Aceitação

- [ ] Todos os componentes usam seletores granulares (não destructuring do store)
- [ ] Actions acessadas via `getState()` onde possível
- [ ] Toolbar subscreve a booleanos derivados
- [ ] ContentArea split para isolamento de re-render
- [ ] `useAutoSave` retorna valores reativos
- [ ] Testes de re-render provam isolamento
- [ ] `npm run test` passa
- [ ] `npm run typecheck` sem erros
- [ ] PR review aprovado
