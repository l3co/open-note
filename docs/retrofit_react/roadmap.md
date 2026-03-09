# React Retrofit — Roadmap

## Visão Geral

Análise especializada do frontend React do Open Note (Tauri v2) com foco em **reaproveitamento de componentes**, **performance**, **usabilidade** e **manutenibilidade**. Baseado nas guidelines do Vercel React Best Practices (8 categorias, 45 regras priorizadas por impacto).

---

## Diagnóstico Geral

### Pontos Fortes ✅

| Aspecto | Avaliação |
|---------|-----------|
| **Organização de pastas** | Boa separação por domínio (`editor/`, `sidebar/`, `pages/`, `shared/`) |
| **TypeScript** | 100% tipado, bindings gerados por `ts-rs` |
| **i18n** | Consistente via `react-i18next`, strings não hardcoded (exceto 2 locais) |
| **Stores Zustand** | Separação por domínio, stores enxutas |
| **Testes** | Coverage razoável com Testing Library + mocks de IPC |
| **Acessibilidade base** | `aria-label`, `role`, `data-testid` presentes nos componentes principais |

### Problemas Identificados 🔴

---

## 1. Hover Inline Style — Anti-pattern Sistêmico (CRÍTICO)

**Regra violada:** `js-batch-dom-css` — Agrupar mudanças CSS via classes, não manipulação direta de style.

**Impacto:** 30+ instâncias de `onMouseEnter/onMouseLeave` manipulando `style` diretamente no DOM.

**Arquivos afetados:**
- `Toolbar.tsx` (3 botões)
- `HomePage.tsx` (6+ cards + QuickAction)
- `FloatingToolbar.tsx` (ToolbarButton)
- `SettingsDialog.tsx` (tabs + close button)
- `TrashPanel.tsx` (6+ botões)
- `DeleteDialog.tsx` (2 botões)
- `WorkspacePicker.tsx` (recent items + ActionButton)
- `ContextMenu.tsx` (menu items)
- `NotebookTree.tsx` (TreeItem)
- `SearchPanel.tsx`, `QuickOpen.tsx`

**Padrão problemático:**
```tsx
onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
```

**Solução:** Classes CSS com `hover:` pseudo-class via Tailwind ou CSS custom properties.

---

## 2. Componentes Duplicados — Falta de Primitivas Compartilhadas (ALTO)

**Regra violada:** Reaproveitamento de componentes, DRY.

### Botões (sem componente base)
Cada componente reimplementa botões interativos do zero:
- `ToolbarButton` (FloatingToolbar.tsx) — 30 linhas
- `QuickAction` (HomePage.tsx) — 58 linhas
- `ActionButton` (WorkspacePicker.tsx) — 46 linhas
- Botões inline em Toolbar.tsx, TrashPanel.tsx, SettingsDialog.tsx, DeleteDialog.tsx

**Nenhum `<Button>` compartilhado.** Cada lugar reinventa hover, active, disabled, sizing.

### Dialogs/Modais (sem componente base)
Padrão repetido em 5+ arquivos:
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center"
     style={{ backgroundColor: "var(--overlay)" }}
     onClick={onClose}>
  <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
```

Implementado separadamente em:
- `TrashPanel.tsx`
- `DeleteDialog.tsx`
- `SettingsDialog.tsx`
- `WorkspacePicker.tsx` (parcialmente)

### Input fields
Inputs com estilo duplicado em:
- `ContextMenu.tsx` (rename input)
- `WorkspacePicker.tsx` (create form)
- `NotebookTree.tsx` (TreeItem rename)
- `QuickOpen.tsx`, `SearchPanel.tsx`

---

## 3. Store Zustand — Seletores Granulares Ausentes (ALTO)

**Regra violada:** `rerender-derived-state` — Subscrever a valores derivados/booleanos, não objetos raw.

### `useUIStore` — Subscriptions excessivas
```tsx
// ❌ App.tsx — puxa 3 propriedades + 2 actions = re-render em QUALQUER mudança do store
const { showWorkspacePicker, openWorkspacePicker, applyThemeToDOM } = useUIStore();
```

```tsx
// ❌ Sidebar.tsx — puxa sidebarOpen + sidebarWidth + setSidebarWidth
const { sidebarOpen, sidebarWidth, setSidebarWidth } = useUIStore();
```

### `usePageStore` — Over-subscription no ContentArea
```tsx
// ❌ ContentArea.tsx — re-renderiza quando QUALQUER campo do pageStore muda
const { currentPage, isLoading } = usePageStore();
```

### `useNavigationStore` — Toolbar puxa history inteiro
```tsx
// ❌ Toolbar.tsx — subscreve ao array history[] inteiro para calcular canGoBack
const { goBack, goForward, historyIndex, history } = useNavigationStore();
```

---

## 4. Lazy Loading Ausente — Bundle Monolítico (CRÍTICO)

**Regra violada:** `bundle-dynamic-imports` — Usar imports dinâmicos para componentes pesados.

**Componentes que deveriam ser lazy-loaded:**
| Componente | Motivo | Estimativa de bundle |
|-----------|--------|---------------------|
| `MarkdownEditor` | CodeMirror 6 inteiro | ~150-200 KB |
| `BlockEditor` | TipTap + 15 extensões + Lowlight | ~250-300 KB |
| `InkCanvas` / `InkOverlay` | perfect-freehand + Canvas engine | ~30-50 KB |
| `PdfViewer` | pdfjs-dist | ~400+ KB |
| `SettingsDialog` | 6 sub-sections | ~20 KB |
| `SyncSettings` | APIs de sync | ~15 KB |
| `OnboardingDialog` | Render condicional | ~10 KB |

**Atualmente TUDO é importado estaticamente.** O `App.tsx` importa `SettingsDialog`, `SyncSettings`, `OnboardingDialog`, `TrashPanel`, `QuickOpen`, `SearchPanel` — todos renderizados condicionalmente mas carregados no bundle principal.

---

## 5. Re-renders Desnecessários (MÉDIO)

**Regras violadas:** `rerender-memo`, `rerender-defer-reads`, `rerender-functional-setstate`

### `NotebookTree` — 446 linhas, sem memoização
Componente mais complexo do projeto. A cada mudança no store (expandir notebook, selecionar page), **toda a árvore re-renderiza**:
- `SectionNode` não é memoizado
- `TreeItem` não é memoizado
- Callbacks inline `() => handlePageClick(page.id)` criam novas funções a cada render

### `HomePage` — Computação inline no render
```tsx
// ❌ Recalcula em cada render
const allPages: { id: string; title: string }[] = [];
pages.forEach((sectionPages) => {
  sectionPages.forEach((p) => allPages.push(p));
});
const recentPageIds = [...history].reverse().slice(0, 6);
const recentPages = recentPageIds
  .map((id) => allPages.find((p) => p.id === id))
  .filter(Boolean);
```

### `useAutoSave` — Retorna refs como valores (nunca trigger re-render)
```tsx
// ❌ Valores de ref nunca causam re-render — isSaving/lastSavedAt sempre stale na UI
return {
  isSaving: savingRef.current,
  lastSavedAt: lastSavedRef.current,
  error: errorRef.current,
  forceSave,
};
```

---

## 6. Async Waterfalls — Operações Sequenciais (MÉDIO)

**Regra violada:** `async-parallel` — Usar `Promise.all()` para operações independentes.

### `deletePage` — Recarrega TODAS as sections sequencialmente
```tsx
// ❌ usePageStore.ts — waterfall
for (const [sectionId] of pages) {
  await get().loadPages(sectionId);  // N chamadas IPC sequenciais
}
```

### `movePage` — Mesmo padrão
```tsx
// ❌ usePageStore.ts
for (const [sectionId] of pages) {
  await get().loadPages(sectionId);  // N chamadas sequenciais
}
```

### `App.tsx init` — IPC sequencial
```tsx
// ❌ getAppState → openWorkspace → sequencial
const appState = await ipc.getAppState();
// ... processa theme ...
await openWorkspace(appState.last_opened_workspace);
```

---

## 7. Acessibilidade — Gaps Importantes (MÉDIO)

| Componente | Problema |
|-----------|---------|
| `Toolbar.tsx` | `aria-label="Back"` e `"Forward"` hardcoded em inglês (não i18n) |
| `PageView.tsx` | `"Criado:"` e `"Atualizado:"` hardcoded em PT-BR |
| `NotebookTree.tsx` | TreeItem sem `aria-label` descritivo |
| `BlockEditor.tsx` | Placeholder `"Digite '/' para comandos..."` hardcoded |
| `ContextMenu.tsx` | Sem keyboard navigation (↑↓) nos menu items |
| `SearchPanel.tsx` / `QuickOpen.tsx` | Sem `aria-live` para anunciar resultados |
| Modais | Sem focus trap (Tab pode sair do modal) |

---

## 8. Padrões CSS Inconsistentes (BAIXO)

| Padrão | Onde | Problema |
|--------|-----|---------|
| CSS Variables inline (`style={{}}`) | Todos os componentes | Mistura Tailwind + inline style para cores |
| CSS Classes customizadas | `QuickOpen.tsx`, `SearchPanel.tsx` | `.quick-open-*`, `.search-panel-*` fora do Tailwind |
| Tailwind utility | Sidebar, Toolbar | Usado normalmente |

Três sistemas de styling coexistem sem critério claro.

---

## Fases de Implementação

| Fase | Nome | Esforço | Impacto |
|------|------|---------|---------|
| 1 | ✅ **Primitivas de UI** — Button, Dialog, Input, IconButton | ~20h | 🔴 CRÍTICO |
| 2 | ✅ **Eliminação de Inline Hover** — CSS hover classes | ~8h | 🟠 ALTO |
| 3 | **Lazy Loading & Code Splitting** — Dynamic imports (Tauri-safe) | ~12h | 🔴 CRÍTICO |
| 4 | **Store Selectors & Re-render Optimization** | ~15h | 🟠 ALTO |
| 5 | **Async Optimization** — Promise.all, waterfalls | ~8h | 🟡 MÉDIO |
| 6 | **Acessibilidade & i18n Gaps** — Focus trap, aria, strings | ~10h | 🟡 MÉDIO |
| 7 | **Memoização de Componentes Pesados** — NotebookTree, HomePage | ~10h | 🟡 MÉDIO |
| 8 | **Unificação de Styling** — Tailwind-first, eliminar CSS custom | ~8h | 🟢 BAIXO |

**Total estimado: ~91 horas**

---

## Considerações Especiais para Tauri

1. **Lazy loading:** `React.lazy` + `Suspense` funciona normalmente em Tauri. Não há server-side, então não há preocupação com SSR.
2. **Bundle size:** Em Tauri, o bundle é local (não download de rede), mas apps menores = startup mais rápido.
3. **IPC overhead:** Cada `invoke()` cruza a ponte Rust↔JS. Batching de chamadas IPC é mais importante que em web apps.
4. **Memory:** Tauri WebView (WKWebView/WebView2) tem limits reais de memória. Lazy loading reduz o footprint inicial.
5. **CSS Variables:** O padrão de CSS custom properties (`var(--bg-primary)`) é bom para temas, mas deve ser combinado com Tailwind `@apply` ou classes utilitárias, não inline styles.

---

## Referências

- **Vercel React Best Practices** — 45 regras priorizadas
- `src/components/` — 54 arquivos TSX analisados
- `src/stores/` — 5 stores Zustand analisados
- `src/hooks/` — 2 hooks custom analisados
- `src/lib/ipc.ts` — 40+ funções IPC analisadas
