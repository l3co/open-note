# Fase 08 — Unificação de Styling (Tailwind-first)

**Esforço estimado:** ~8 horas  
**Impacto:** 🟢 BAIXO  
**Dependências:** Fase 02 (hover classes já migradas)  
**Branch:** `refactor/styling-unification`

---

## Objetivo

Unificar os três sistemas de styling que coexistem no projeto em uma estratégia **Tailwind-first** consistente. Eliminar CSS custom classes desnecessárias e reduzir o uso de `style={{}}` inline para CSS Variables que podem ser expressas via Tailwind.

---

## Diagnóstico — Três Sistemas Coexistentes

### Sistema 1: Tailwind utility classes ✅ (padrão desejado)

```tsx
// Sidebar.tsx — bom exemplo
className="relative flex flex-col border-r"
className="flex-1 overflow-y-auto px-3 pt-3"
```

### Sistema 2: CSS Variables via `style={{}}` inline 🟡

```tsx
// Presente em TODOS os componentes
style={{ backgroundColor: "var(--bg-primary)" }}
style={{ color: "var(--text-secondary)" }}
style={{ borderColor: "var(--border)" }}
```

**Problema:** `style={{}}` tem specificidade máxima e não pode ser overridden por tema. Também cria objetos novos a cada render.

### Sistema 3: CSS custom classes 🔴

```tsx
// QuickOpen.tsx — classes CSS fora do Tailwind
className="quick-open-backdrop"
className="quick-open-dialog"
className="quick-open-input-wrapper"
className="quick-open-icon"
className="quick-open-input"
className="quick-open-results"
className="quick-open-result-item"

// SearchPanel.tsx — mesmo padrão
className="search-panel"
className="search-panel-header"
className="search-panel-input-wrapper"
className="search-panel-result"
```

**Problema:** Duas estratégias de styling incompatíveis no mesmo projeto. Manutenção e debugging dificultados.

---

## Estratégia: Tailwind + CSS Variables Arbitrárias

Tailwind v3+ suporta CSS custom properties via **arbitrary values**:

```tsx
// ✅ Tailwind com CSS Variables — melhor dos dois mundos
className="bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border)]"
```

**Vantagens:**
- Mantém o sistema de temas via CSS Variables
- Remove `style={{}}` inline (sem specificidade máxima)
- Consistente com o resto do projeto
- Tooling do Tailwind (IntelliSense, purge) funciona

**Para valores muito repetidos**, criar classes Tailwind customizadas no `tailwind.config`:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        "bg-primary": "var(--bg-primary)",
        "bg-secondary": "var(--bg-secondary)",
        "bg-tertiary": "var(--bg-tertiary)",
        "bg-hover": "var(--bg-hover)",
        "bg-toolbar": "var(--bg-toolbar)",
        "bg-sidebar": "var(--bg-sidebar)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
        "accent": "var(--accent)",
        "accent-subtle": "var(--accent-subtle)",
        "border": "var(--border)",
        "danger": "var(--danger)",
        "overlay": "var(--overlay)",
      },
      boxShadow: {
        "theme-lg": "var(--shadow-lg)",
      },
    },
  },
};
```

**Resultado:** Uso limpo e semântico:
```tsx
// ✅ Ao invés de style={{ backgroundColor: "var(--bg-primary)" }}
className="bg-bg-primary text-text-secondary border-border"
```

---

## Tarefas

### 8.1 — Configurar Tailwind theme com CSS Variables

**Arquivo:** `tailwind.config.js` (ou `.ts`)

Mapear todas as CSS Variables usadas no projeto para o theme do Tailwind:

```js
theme: {
  extend: {
    colors: {
      surface: {
        primary: "var(--bg-primary)",
        secondary: "var(--bg-secondary)",
        tertiary: "var(--bg-tertiary)",
        hover: "var(--bg-hover)",
        active: "var(--bg-active)",
        toolbar: "var(--bg-toolbar)",
        sidebar: "var(--bg-sidebar)",
      },
      content: {
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        tertiary: "var(--text-tertiary)",
      },
      accent: {
        DEFAULT: "var(--accent)",
        subtle: "var(--accent-subtle)",
        text: "var(--accent-text)",
        hover: "var(--accent-hover)",
      },
      border: {
        DEFAULT: "var(--border)",
        subtle: "var(--border-subtle)",
      },
      danger: {
        DEFAULT: "var(--danger)",
        hover: "var(--danger-hover)",
      },
      overlay: "var(--overlay)",
    },
    boxShadow: {
      "theme": "var(--shadow-lg)",
    },
  },
},
```

**Uso:**
```tsx
className="bg-surface-primary text-content-secondary border-border"
className="bg-accent-subtle text-accent"
className="shadow-theme"
```

**Critérios:**
- [ ] Todas as CSS Variables mapeadas no Tailwind config
- [ ] Naming semântico (`surface-*`, `content-*`, `accent-*`)
- [ ] IntelliSense funciona no VS Code/Cursor

---

### 8.2 — Migrar `style={{}}` inline para Tailwind classes

**Componentes prioritários (mais ocorrências):**

| Componente | `style={{}}` count | Ação |
|-----------|-------------------|------|
| `HomePage.tsx` | ~15 | Migrar para classes Tailwind |
| `WorkspacePicker.tsx` | ~12 | Migrar |
| `NotebookTree.tsx` | ~8 | Migrar (exceto `paddingLeft` dinâmico) |
| `SettingsDialog.tsx` | ~8 | Migrar |
| `TrashPanel.tsx` | ~10 | Migrar |
| `Toolbar.tsx` | ~4 | Migrar |
| `Sidebar.tsx` | ~3 | Migrar |

**Exemplo — HomePage.tsx:**

```tsx
// ❌ Antes
<div style={{ backgroundColor: "var(--bg-primary)" }}>
<h1 style={{ color: "var(--text-primary)" }}>
<span style={{ color: "var(--text-tertiary)" }}>

// ✅ Depois
<div className="bg-surface-primary">
<h1 className="text-content-primary">
<span className="text-content-tertiary">
```

**Exceções — manter `style={{}}` quando:**
- Valores dinâmicos (ex: `paddingLeft: 8 + depth * 16` no TreeItem)
- `width` dinâmico (ex: sidebar width)
- Inline SVG styling

**Critérios:**
- [ ] `style={{}}` inline reduzido em 80%+
- [ ] Valores estáticos 100% migrados para Tailwind
- [ ] Valores dinâmicos mantidos em `style={{}}`

---

### 8.3 — Eliminar CSS custom classes (QuickOpen, SearchPanel)

**Arquivo:** `src/components/search/QuickOpen.tsx`

Migrar de:
```tsx
className="quick-open-backdrop"
className="quick-open-dialog"
className="quick-open-input-wrapper"
```

Para:
```tsx
className="fixed inset-0 z-50 flex items-center justify-center bg-overlay"
className="w-[520px] rounded-xl border border-border bg-surface-primary shadow-theme"
className="flex items-center gap-2 border-b border-border px-4 py-3"
```

**Arquivo:** `src/components/search/SearchPanel.tsx` — mesmo padrão.

**CSS a remover:** Todas as classes `.quick-open-*` e `.search-panel-*` do stylesheet.

**Critérios:**
- [ ] Zero CSS custom classes para QuickOpen e SearchPanel
- [ ] Visual idêntico ao anterior
- [ ] CSS custom removido do stylesheet

---

### 8.4 — Criar utility classes para padrões repetidos

Para padrões que aparecem 5+ vezes, criar `@apply` no CSS:

**Arquivo:** `src/styles/utilities.css`

```css
/* Dialog overlay */
.dialog-overlay {
  @apply fixed inset-0 z-50 flex items-center justify-center bg-overlay;
}

/* Dialog container */
.dialog-container {
  @apply rounded-xl border border-border bg-surface-primary shadow-theme;
}

/* Section heading (usado em sidebar, home, settings) */
.section-heading {
  @apply text-xs font-semibold tracking-widest uppercase text-content-tertiary;
}
```

**Critérios:**
- [ ] Máximo 5-8 classes utilitárias (não over-abstract)
- [ ] Cada uma elimina 5+ duplicações
- [ ] `@apply` usa tokens do Tailwind config

---

### 8.5 — Audit final — consistência de styling

**Verificação:**

```bash
# Contagem de style={{}} restantes (target: <20, todos dinâmicos)
grep -r 'style={{' src/components/ | grep -v test | grep -v '__tests__' | wc -l

# Contagem de CSS custom classes restantes (target: 0 para quick-open/search-panel)
grep -r 'className="quick-open' src/components/ | wc -l
grep -r 'className="search-panel' src/components/ | wc -l

# CSS Variables usadas diretamente via style (vs Tailwind)
grep -r 'var(--' src/components/ | grep 'style=' | grep -v test | wc -l
```

**Critérios:**
- [ ] `style={{}}` com CSS vars estáticos: 0
- [ ] `style={{}}` com valores dinâmicos: ok (sidebarWidth, paddingLeft, etc.)
- [ ] CSS custom classes (quick-open, search-panel): 0
- [ ] Todos os componentes usam o mesmo vocabulário de classes

---

### 8.6 — Documentar convenção de styling

**Arquivo:** `docs/STYLING.md`

```markdown
# Convenção de Styling

## Regra: Tailwind-first com CSS Variables

1. **Cores e tokens:** Usar classes Tailwind mapeadas no theme config
   - `bg-surface-primary`, `text-content-secondary`, `border-border`

2. **Interatividade:** Usar CSS pseudo-classes (hover:, focus-visible:)
   - NUNCA `onMouseEnter`/`onMouseLeave` para estilo

3. **Valores dinâmicos:** `style={{}}` apenas para valores calculados
   - `width`, `paddingLeft`, transform com variáveis JS

4. **Classes utilitárias:** `@apply` para padrões repetidos (max 10 classes)

5. **CSS custom:** Apenas para integrações terceiras (TipTap, CodeMirror)
```

**Critérios:**
- [ ] Convenção documentada
- [ ] Equipe sabe quando usar `style={{}}` vs classes

---

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `tailwind.config.js` | Theme com CSS Variables |
| `src/styles/utilities.css` | **Novo** — utility classes |
| `src/components/search/QuickOpen.tsx` | CSS custom → Tailwind |
| `src/components/search/SearchPanel.tsx` | CSS custom → Tailwind |
| `src/components/pages/HomePage.tsx` | `style={{}}` → Tailwind |
| `src/components/workspace/WorkspacePicker.tsx` | `style={{}}` → Tailwind |
| `src/components/sidebar/NotebookTree.tsx` | `style={{}}` estáticos → Tailwind |
| `src/components/settings/SettingsDialog.tsx` | `style={{}}` → Tailwind |
| `src/components/shared/TrashPanel.tsx` | `style={{}}` → Tailwind |
| `src/components/layout/Toolbar.tsx` | `style={{}}` → Tailwind |
| `src/components/layout/Sidebar.tsx` | `style={{}}` → Tailwind |
| CSS stylesheet(s) | Remover `.quick-open-*`, `.search-panel-*` |
| `docs/STYLING.md` | **Novo** — convenção documentada |

---

## Critérios de Aceitação

- [ ] Tailwind config com todas as CSS Variables mapeadas
- [ ] `style={{}}` inline reduzido em 80%+ (restam apenas dinâmicos)
- [ ] CSS custom classes `.quick-open-*` e `.search-panel-*` removidas
- [ ] Visual 100% idêntico (regressão visual: zero)
- [ ] Convenção de styling documentada
- [ ] Tailwind IntelliSense funciona com os tokens customizados
- [ ] `npm run test` passa
- [ ] `npm run build` sem warnings
- [ ] PR review aprovado
