# Fase 07 — Memoização de Componentes Pesados

**Esforço estimado:** ~10 horas  
**Impacto:** 🟡 MÉDIO  
**Dependências:** Fase 04 (seletores granulares)  
**Branch:** `refactor/memoization`

---

## Objetivo

Aplicar `React.memo`, `useMemo` e `useCallback` estrategicamente nos componentes que mais sofrem re-renders desnecessários. Foco em **NotebookTree** (446 linhas, árvore inteira re-renderiza), **HomePage** (computação inline) e sub-componentes de lista.

**Regras Vercel:** `rerender-memo` — Extrair trabalho pesado para componentes memoizados. `rendering-hoist-jsx` — Extrair JSX estático fora de componentes.

---

## Diagnóstico

### NotebookTree — 446 linhas, zero memoização

A cada mudança em **qualquer** propriedade subscrita (expandir notebook, selecionar page, carregar pages), **toda a árvore re-renderiza**:

```
NotebookTree re-render
  └─ notebooks.map()
       └─ TreeItem (notebook) re-render
       └─ SectionNode re-render       ← não memoizado
            └─ TreeItem (section) re-render
            └─ pages.map()
                 └─ TreeItem (page) re-render × N   ← N re-renders
```

**Cenário:** Workspace com 5 notebooks, 3 sections cada, 10 pages cada = **165 componentes** re-renderizados ao selecionar 1 page.

### HomePage — Computação O(N²) no render

```tsx
// Executa em CADA render
const allPages: { id: string; title: string }[] = [];
pages.forEach((sectionPages) => {
  sectionPages.forEach((p) => allPages.push(p));
});
const recentPageIds = [...history].reverse().slice(0, 6);
const recentPages = recentPageIds
  .map((id) => allPages.find((p) => p.id === id))  // O(N) find × 6
  .filter(Boolean);
```

### Callbacks inline em listas

```tsx
// ❌ NotebookTree — nova função a cada render para CADA page
pages.map((page) => (
  <TreeItem
    onClick={() => onPageClick(page.id)}  // Nova ref a cada render
    onContextMenu={(e) => onContextMenu(e, "page", page.id, page.title, notebookId)}
  />
))
```

---

## Tarefas

### 7.1 — Memoizar `SectionNode`

**Arquivo:** `src/components/sidebar/NotebookTree.tsx`

```tsx
const MemoizedSectionNode = React.memo(SectionNode, (prev, next) => {
  return (
    prev.section.id === next.section.id &&
    prev.section.name === next.section.name &&
    prev.isExpanded === next.isExpanded &&
    prev.isSelected === next.isSelected &&
    prev.selectedPageId === next.selectedPageId &&
    prev.pages === next.pages
  );
});
```

**Critérios:**
- [ ] `SectionNode` só re-renderiza quando suas props mudam
- [ ] Aba expandir/colapsar de OUTRO section não re-renderiza este
- [ ] Selecionar page em OUTRO section não re-renderiza este

---

### 7.2 — Memoizar `TreeItem`

**Arquivo:** `src/components/sidebar/NotebookTree.tsx`

```tsx
const MemoizedTreeItem = React.memo(TreeItem);
```

**Nota:** `TreeItem` recebe callbacks como props. Para que `React.memo` funcione, os callbacks precisam ser **estáveis** (via `useCallback` no parent ou `getState()`). Isso depende da Fase 04.

**Alternativa sem Fase 04:** Custom comparator que ignora callbacks:
```tsx
const MemoizedTreeItem = React.memo(TreeItem, (prev, next) => {
  return (
    prev.label === next.label &&
    prev.isExpanded === next.isExpanded &&
    prev.isSelected === next.isSelected &&
    prev.isDragOver === next.isDragOver &&
    prev.depth === next.depth
  );
});
```

**Critérios:**
- [ ] TreeItem não re-renderiza quando props visuais são iguais
- [ ] Rename inline funciona (estado local do TreeItem)
- [ ] Drag-and-drop funciona

---

### 7.3 — Memoizar computação do HomePage

**Arquivo:** `src/components/pages/HomePage.tsx`

**Antes:**
```tsx
// Computa em cada render
const allPages: { id: string; title: string }[] = [];
pages.forEach((sectionPages) => {
  sectionPages.forEach((p) => allPages.push(p));
});
const recentPageIds = [...history].reverse().slice(0, 6);
const recentPages = recentPageIds
  .map((id) => allPages.find((p) => p.id === id))
  .filter(Boolean);
```

**Depois:**
```tsx
const recentPages = useMemo(() => {
  // Construir index Map para O(1) lookups
  const pageIndex = new Map<string, { id: string; title: string }>();
  pages.forEach((sectionPages) => {
    sectionPages.forEach((p) => pageIndex.set(p.id, p));
  });

  return [...history]
    .reverse()
    .slice(0, 6)
    .map((id) => pageIndex.get(id))
    .filter(Boolean) as { id: string; title: string }[];
}, [pages, history]);
```

**Melhoria:** `Map` para O(1) lookups ao invés de `Array.find` O(N).

**Regra Vercel:** `js-index-maps` — Build Map for repeated lookups.

**Critérios:**
- [ ] Computação só re-executa quando `pages` ou `history` mudam
- [ ] Map para lookups O(1)
- [ ] Recent pages corretas e ordenadas

---

### 7.4 — Memoizar cards de recent pages

**Arquivo:** `src/components/pages/HomePage.tsx`

Extrair o card de recent page para componente memoizado:

```tsx
const RecentPageCard = React.memo(function RecentPageCard({
  page,
  onClick,
}: {
  page: { id: string; title: string };
  onClick: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onClick(page.id)}
      className="group flex flex-col items-start rounded-xl border p-4 text-left transition-all
                 border-[var(--border)] bg-[var(--bg-secondary)]
                 hover:border-[var(--accent)] hover:shadow-md"
    >
      <FileText size={18} className="mb-2 text-[var(--text-tertiary)]" />
      <span className="w-full truncate text-sm font-medium text-[var(--text-primary)]">
        {page.title}
      </span>
    </button>
  );
});
```

**Critérios:**
- [ ] Card individual não re-renderiza quando outro card é adicionado/removido
- [ ] Hover via CSS (não inline style — benefício da Fase 02)

---

### 7.5 — Memoizar `TrashItemRow`

**Arquivo:** `src/components/shared/TrashPanel.tsx`

```tsx
const MemoizedTrashItemRow = React.memo(TrashItemRow);
```

`TrashItemRow` já recebe `onRestore` e `onDelete` como props. Se forem callbacks estáveis, `React.memo` funciona.

**Se callbacks não são estáveis**, usar pattern:
```tsx
const handleRestore = useCallback(async (id: string) => {
  await ipc.restoreFromTrash(id);
  await loadItems();
}, [loadItems]);

const handlePermanentDelete = useCallback(async (id: string) => {
  await ipc.permanentlyDelete(id);
  await loadItems();
}, [loadItems]);

// No map:
<MemoizedTrashItemRow
  item={item}
  onRestore={() => handleRestore(item.id)}   // ❌ Ainda inline
  onDelete={() => handlePermanentDelete(item.id)}
/>
```

**Solução melhor — passar id para o row:**
```tsx
<MemoizedTrashItemRow
  item={item}
  onRestore={handleRestore}    // ✅ Estável
  onDelete={handlePermanentDelete}
/>

// Dentro de TrashItemRow:
function TrashItemRow({ item, onRestore, onDelete }) {
  return (
    <button onClick={() => onRestore(item.id)}>  {/* Inline ok — dentro do memo */}
```

**Critérios:**
- [ ] TrashItemRow memoizado
- [ ] Callbacks estáveis passados como props

---

### 7.6 — Memoizar search results

**Arquivos:** `src/components/search/QuickOpen.tsx`, `SearchPanel.tsx`

Extrair item de resultado para componente memoizado:

```tsx
const SearchResultItem = React.memo(function SearchResultItem({
  item,
  isSelected,
  onClick,
  onMouseEnter,
}: {
  item: SearchResultItem;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  // ...
});
```

**Critérios:**
- [ ] Items individuais não re-renderizam ao navegar com ↑↓
- [ ] Apenas o item que muda `isSelected` re-renderiza

---

### 7.7 — Hoist static JSX

**Regra Vercel:** `rendering-hoist-jsx` — Extrair JSX estático fora de componentes.

**Arquivo:** `src/components/shared/BackgroundPattern.tsx`

Já é estático ✓ (bom exemplo).

**Arquivo:** `src/components/editor/FloatingToolbar.tsx`

O `Separator` é estático e pode ser hoisted:

```tsx
// ✅ Já é hoisted (function fora do componente principal) — ok
function Separator() { ... }
```

**Arquivo:** `src/components/pages/HomePage.tsx`

O ícone `<Clock size={14} style={{ color: "var(--text-tertiary)" }} />` é criado em cada render. Pode ser hoisted:

```tsx
// Fora do componente
const ClockIcon = <Clock size={14} style={{ color: "var(--text-tertiary)" }} />;
```

**Critérios:**
- [ ] JSX estático hoisted onde identificado
- [ ] Sem impacto funcional

---

### 7.8 — Testes de memoização

**Arquivo:** `src/components/sidebar/__tests__/NotebookTree.memo.test.tsx`

```tsx
test("SectionNode does not re-render when unrelated section expands", () => {
  // Render NotebookTree with 2 notebooks
  // Expand notebook B
  // Assert SectionNode of notebook A did NOT re-render
});

test("TreeItem does not re-render when unrelated page is selected", () => {
  // Render tree with 5 pages
  // Select page 3
  // Assert pages 1, 2, 4, 5 did NOT re-render
});
```

**Arquivo:** `src/components/pages/__tests__/HomePage.memo.test.tsx`

```tsx
test("recentPages recomputes only when pages or history changes", () => {
  // useMemo dependency test
});
```

---

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `src/components/sidebar/NotebookTree.tsx` | Memo SectionNode, TreeItem |
| `src/components/pages/HomePage.tsx` | useMemo recentPages, Memo RecentPageCard |
| `src/components/shared/TrashPanel.tsx` | Memo TrashItemRow |
| `src/components/search/QuickOpen.tsx` | Memo SearchResultItem |
| `src/components/search/SearchPanel.tsx` | Memo SearchResultItem |
| `src/components/sidebar/__tests__/NotebookTree.memo.test.tsx` | **Novo** |
| `src/components/pages/__tests__/HomePage.memo.test.tsx` | **Novo** |

---

## Critérios de Aceitação

- [ ] SectionNode e TreeItem memoizados
- [ ] HomePage.recentPages via useMemo + Map index
- [ ] TrashItemRow e SearchResultItem memoizados
- [ ] Testes provam que memoização evita re-renders desnecessários
- [ ] Funcionalidade idêntica ao estado anterior
- [ ] `npm run test` passa
- [ ] `npm run typecheck` sem erros
- [ ] PR review aprovado
