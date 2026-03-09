# Fase 06 — Acessibilidade & i18n Gaps

**Esforço estimado:** ~10 horas  
**Impacto:** 🟡 MÉDIO  
**Dependências:** Fase 01 (Dialog com focus trap)  
**Branch:** `refactor/a11y-i18n`

---

## Objetivo

Corrigir gaps de acessibilidade e strings hardcoded que violam o padrão i18n do projeto. Implementar focus trap em modais, keyboard navigation em menus, e garantir que screen readers possam navegar a aplicação.

---

## Diagnóstico

### Strings hardcoded (violação i18n)

| Arquivo | Linha | String | Idioma |
|---------|-------|--------|--------|
| `Toolbar.tsx` | 58 | `aria-label="Back"` | EN |
| `Toolbar.tsx` | 74 | `aria-label="Forward"` | EN |
| `PageView.tsx` | 24 | `"Criado:"` | PT-BR |
| `PageView.tsx` | 26 | `"Atualizado:"` | PT-BR |
| `BlockEditor.tsx` | 79 | `"Digite '/' para comandos..."` | PT-BR |
| `App.tsx` | 88 | `"Open Note"` | EN (nome do app — aceitável) |
| `App.tsx` | 91 | `"Loading..."` | EN |

### Acessibilidade — Focus Management

| Componente | Problema |
|-----------|---------|
| `TrashPanel` | Sem focus trap — Tab escapa do modal |
| `DeleteDialog` | Sem focus trap |
| `SettingsDialog` | Sem focus trap |
| `WorkspacePicker` | Sem focus trap (full-screen, menos crítico) |
| `ContextMenu` | Sem keyboard navigation (↑↓) |
| `QuickOpen` | Sem `aria-live` para anunciar resultados |
| `SearchPanel` | Sem `aria-live` para anunciar resultados |

### Acessibilidade — ARIA

| Componente | Problema |
|-----------|---------|
| `NotebookTree` → `TreeItem` | Sem `aria-label` descritivo (nome do item) |
| `InkToolbar` | Sem `role="toolbar"` e `aria-label` |
| `FloatingToolbar` | Sem `role="toolbar"` |
| `StatusBar` | Sem `role="status"` |
| `EditorModeToggle` | Sem `role="radiogroup"` |

---

## Tarefas

### 6.1 — Corrigir strings hardcoded

**Arquivo:** `src/components/layout/Toolbar.tsx`

```tsx
// ❌ Antes
aria-label="Back"
aria-label="Forward"

// ✅ Depois
aria-label={t("toolbar.go_back")}
aria-label={t("toolbar.go_forward")}
```

**Arquivo:** `src/components/pages/PageView.tsx`

```tsx
// ❌ Antes
<span>Criado: {new Date(page.created_at).toLocaleDateString()}</span>
<span>Atualizado: {new Date(page.updated_at).toLocaleDateString()}</span>

// ✅ Depois
<span>{t("page.created_at", { date: new Date(page.created_at).toLocaleDateString() })}</span>
<span>{t("page.updated_at", { date: new Date(page.updated_at).toLocaleDateString() })}</span>
```

**Arquivo:** `src/components/editor/BlockEditor.tsx`

```tsx
// ❌ Antes (placeholder hardcoded no extension config)
placeholder: ({ node }) => {
  if (node.type.name === "heading") {
    return `Heading ${node.attrs.level}`;
  }
  return "Digite '/' para comandos...";
},

// ✅ Depois — obter traduções via closure
```

**Nota sobre BlockEditor:** TipTap extensions são configuradas fora do componente React. A solução é passar as strings traduzidas como parâmetro ou usar um getter.

**Arquivo:** `src/App.tsx`

```tsx
// ❌ Antes
<p>"Loading..."</p>

// ✅ Depois — use CSS spinner sem texto, ou i18n
<p>{t("common.loading")}</p>
```

**Locales a atualizar:**

```json
// pt-BR.json
{
  "toolbar": {
    "go_back": "Voltar",
    "go_forward": "Avançar"
  },
  "page": {
    "created_at": "Criado: {{date}}",
    "updated_at": "Atualizado: {{date}}"
  },
  "editor": {
    "placeholder": "Digite '/' para comandos...",
    "heading_placeholder": "Título {{level}}"
  }
}

// en.json
{
  "toolbar": {
    "go_back": "Go back",
    "go_forward": "Go forward"
  },
  "page": {
    "created_at": "Created: {{date}}",
    "updated_at": "Updated: {{date}}"
  },
  "editor": {
    "placeholder": "Type '/' for commands...",
    "heading_placeholder": "Heading {{level}}"
  }
}
```

**Critérios:**
- [ ] Zero strings visíveis hardcoded em PT-BR ou EN
- [ ] Locales atualizados em `pt-BR.json` e `en.json`
- [ ] `aria-label` sempre traduzido

---

### 6.2 — Focus trap nos modais

Se as primitivas da Fase 01 já incluem focus trap no `Dialog`, esta tarefa é apenas migrar os modais existentes para usar `Dialog`.

Se a Fase 01 ainda não foi implementada, criar um hook `useFocusTrap`:

**Arquivo:** `src/hooks/useFocusTrap.ts`

```tsx
export function useFocusTrap(containerRef: React.RefObject<HTMLElement>, active: boolean) {
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const focusable = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Store previously focused element
    const previouslyFocused = document.activeElement as HTMLElement;

    // Focus first element
    first?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus(); // Return focus
    };
  }, [containerRef, active]);
}
```

**Critérios:**
- [ ] Tab não escapa de nenhum modal
- [ ] Shift+Tab volta para o último elemento
- [ ] Foco retorna ao elemento que abriu o modal
- [ ] Funciona com `TrashPanel`, `DeleteDialog`, `SettingsDialog`

---

### 6.3 — Keyboard navigation no ContextMenu

**Arquivo:** `src/components/shared/ContextMenu.tsx` (ou `ContextMenuPrimitive` da Fase 01)

Adicionar suporte a ↑↓ Enter Escape:

```tsx
const [focusedIndex, setFocusedIndex] = useState(0);

const handleKeyDown = (e: React.KeyboardEvent) => {
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, items.length - 1));
      break;
    case "ArrowUp":
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
      break;
    case "Enter":
      e.preventDefault();
      items[focusedIndex]?.onClick();
      break;
    case "Escape":
      onClose();
      break;
  }
};
```

**ARIA:**
```tsx
<div role="menu" aria-label={t("context_menu.title")} onKeyDown={handleKeyDown}>
  {items.map((item, i) => (
    <button
      role="menuitem"
      tabIndex={i === focusedIndex ? 0 : -1}
      ref={(el) => { if (i === focusedIndex) el?.focus(); }}
    >
```

**Critérios:**
- [ ] ↑↓ navega entre items
- [ ] Enter executa ação
- [ ] Escape fecha
- [ ] `role="menu"` + `role="menuitem"`
- [ ] Auto-focus no primeiro item ao abrir

---

### 6.4 — `aria-live` para resultados de busca

**Arquivo:** `src/components/search/QuickOpen.tsx`

```tsx
<div aria-live="polite" className="sr-only">
  {results.length > 0
    ? t("search.results_announced", { count: results.length })
    : query && !loading
      ? t("search.no_results")
      : ""}
</div>
```

**Arquivo:** `src/components/search/SearchPanel.tsx` — mesmo padrão.

**Critérios:**
- [ ] Screen reader anuncia contagem de resultados
- [ ] Anuncia "nenhum resultado" quando aplicável
- [ ] Classe `sr-only` para esconder visualmente

---

### 6.5 — ARIA roles em toolbars e status

**Arquivo:** `src/components/editor/FloatingToolbar.tsx`

```tsx
<div role="toolbar" aria-label={t("editor.toolbar.title")}>
```

**Arquivo:** `src/components/layout/StatusBar.tsx`

```tsx
<footer role="status" aria-label={t("statusbar.title")}>
```

**Arquivo:** `src/components/editor/EditorModeToggle.tsx`

```tsx
<div role="radiogroup" aria-label={t("editor.mode_label")}>
  <button role="radio" aria-checked={mode === "richtext"}>
  <button role="radio" aria-checked={mode === "markdown"}>
</div>
```

**Critérios:**
- [ ] Toolbars com `role="toolbar"` + `aria-label`
- [ ] StatusBar com `role="status"`
- [ ] EditorModeToggle com `role="radiogroup"` + `aria-checked`

---

### 6.6 — TreeItem acessibilidade melhorada

**Arquivo:** `src/components/sidebar/NotebookTree.tsx`

```tsx
<div
  role="treeitem"
  aria-label={label}
  aria-expanded={isExpanded}
  aria-selected={isSelected}
  tabIndex={isSelected ? 0 : -1}
>
```

**Critérios:**
- [ ] Cada TreeItem tem `aria-label` com o nome do item
- [ ] `aria-expanded` para notebooks/sections
- [ ] `aria-selected` para o item selecionado
- [ ] `tabIndex` roving para navegação por teclado

---

### 6.7 — Testes de acessibilidade

**Arquivos:** Testes existentes + novos

| Teste | Descrição |
|-------|-----------|
| `dialog_focus_trap` | Tab não escapa de TrashPanel/DeleteDialog/Settings |
| `context_menu_keyboard` | ↑↓ Enter Escape funcionam |
| `search_aria_live` | Resultados anunciados via aria-live |
| `toolbar_aria_roles` | Toolbar tem role="toolbar" |
| `treeitem_aria` | TreeItem tem aria-label, aria-expanded, aria-selected |
| `no_hardcoded_strings` | Grep por strings PT/EN em componentes (exceto nomes de app) |

**Critérios:**
- [ ] Testes de acessibilidade passam
- [ ] `axe-core` ou similar valida ARIA em componentes principais

---

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `src/components/layout/Toolbar.tsx` | i18n aria-labels |
| `src/components/pages/PageView.tsx` | i18n datas |
| `src/components/editor/BlockEditor.tsx` | i18n placeholder |
| `src/App.tsx` | i18n loading |
| `src/hooks/useFocusTrap.ts` | **Novo** (se Fase 01 não implementada) |
| `src/components/shared/ContextMenu.tsx` | Keyboard navigation + ARIA |
| `src/components/search/QuickOpen.tsx` | aria-live |
| `src/components/search/SearchPanel.tsx` | aria-live |
| `src/components/editor/FloatingToolbar.tsx` | role="toolbar" |
| `src/components/layout/StatusBar.tsx` | role="status" |
| `src/components/editor/EditorModeToggle.tsx` | role="radiogroup" |
| `src/components/sidebar/NotebookTree.tsx` | TreeItem ARIA |
| `src/locales/pt-BR.json` | Strings novas |
| `src/locales/en.json` | Strings novas |

---

## Critérios de Aceitação

- [ ] Zero strings visíveis hardcoded (verificar com grep)
- [ ] Focus trap em todos os modais
- [ ] Keyboard navigation no ContextMenu
- [ ] `aria-live` em resultados de busca
- [ ] ARIA roles corretos em toolbars, status, toggles
- [ ] TreeItem com aria-label, aria-expanded, aria-selected
- [ ] Locales atualizados em pt-BR e en
- [ ] `npm run test` passa
- [ ] `npm run lint` limpo
- [ ] PR review aprovado
