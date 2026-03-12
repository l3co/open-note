# Fase 05 — Toolbar, Breadcrumb & Polish Global

**Esforço estimado:** ~5 horas
**Prioridade:** 🟢 Média
**Dependências:** Fases 1–4
**Branch:** `feat/redesign-plataforma-phase-5`

---

## Objetivo

Refinar os últimos elementos da interface: toolbar (barra superior), breadcrumb, StatusBar, e aplicar polish global — consistência de border-radius (usar tokens `--radius-*`), ajustes de espaçamento, hover states nos itens do NotebookTree, e revisão do componente `Button.tsx`. Esta é a fase de acabamento visual.

**Decisões aplicadas:**
- Todos os `rounded-md`/`rounded-lg`/`rounded-xl` avulsos devem migrar para `var(--radius-*)` tokens da Fase 1
- Hover/focus states via CSS classes (`.interactive-ghost`, `.interactive-subtle`) já existentes
- Auditoria de contraste para os 3 temas (light, dark, paper)

---

## Contexto Atual

### Toolbar
```tsx
// src/components/layout/Toolbar.tsx — linha 21-60
<header
  data-tauri-drag-region
  className="flex h-10 items-center border-b px-2 select-none"
  style={{
    backgroundColor: "var(--bg-toolbar)",
    borderColor: "var(--border)",
  }}
>
  <IconButton onClick={toggleSidebar} icon={<PanelLeftClose size={16}/>} variant="subtle" />
  <div className="ml-1 flex items-center gap-0.5">
    <IconButton onClick={goBack} disabled={!canGoBack} icon={<ChevronLeft size={16}/>} />
    <IconButton onClick={goForward} disabled={!canGoForward} icon={<ChevronRight size={16}/>} />
  </div>
  <div className="ml-3 flex-1">
    <Breadcrumb />
  </div>
</header>
```
Problema: Toolbar de apenas `h-10` (40px) é muito comprimida. Sem separador visual entre controles de navegação e breadcrumb. Breadcrumb sem hierarquia visual clara.

### Breadcrumb
```tsx
// src/components/layout/Breadcrumb.tsx
// Componente a inspecionar — renderiza o path atual
```

### StatusBar
```tsx
// src/components/layout/StatusBar.tsx — componente de barra inferior
```

### NotebookTree — items
```tsx
// src/components/sidebar/NotebookTree.tsx
// Itens de notebook/section/page com DnD — estilo atual muito denso
```

### Button component
```tsx
// src/components/ui/Button.tsx — 3953 bytes
// Variantes existentes: primary, secondary, ghost, danger
```

---

## Tarefas

### 5.1 — Redesenhar Toolbar

**Arquivo:** `src/components/layout/Toolbar.tsx`

```tsx
<header
  data-tauri-drag-region
  className="flex h-11 items-center gap-2 border-b px-3 select-none"
  style={{
    backgroundColor: "var(--bg-toolbar)",
    borderColor: "var(--border)",
  }}
  data-testid="toolbar"
>
  {/* Toggle sidebar */}
  <IconButton
    onClick={toggleSidebar}
    icon={sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
    aria-label={t("toolbar.toggle_sidebar")}
    variant="subtle"
  />

  {/* Separador vertical sutil */}
  <div
    className="h-5 w-px shrink-0"
    style={{ backgroundColor: "var(--border)" }}
  />

  {/* Navegação back/forward */}
  <div className="flex items-center gap-0.5">
    <IconButton
      onClick={goBack}
      disabled={!canGoBack}
      icon={<ChevronLeft size={15} />}
      aria-label="Back"
      variant="subtle"
    />
    <IconButton
      onClick={goForward}
      disabled={!canGoForward}
      icon={<ChevronRight size={15} />}
      aria-label="Forward"
      variant="subtle"
    />
  </div>

  {/* Separador vertical sutil */}
  <div
    className="h-5 w-px shrink-0"
    style={{ backgroundColor: "var(--border)" }}
  />

  {/* Breadcrumb */}
  <div className="flex-1 min-w-0" data-testid="breadcrumb">
    <Breadcrumb />
  </div>
</header>
```

**Critérios:**
- [ ] Altura aumentada para `h-11` (44px) — melhor toque e proporção
- [ ] Separadores verticais entre grupos de controles
- [ ] Ícones reduzidos de `size={16}` para `size={15}` (mais refinados)
- [ ] `data-testid="toolbar"` preservado

---

### 5.2 — Redesenhar Breadcrumb

**Arquivo:** `src/components/layout/Breadcrumb.tsx`

Inspecionar o componente atual e garantir:

```tsx
// Estrutura esperada do Breadcrumb melhorado:
// workspace › Notebook › Section › Page

// Separadores mais refinados:
<span
  className="mx-1 text-[11px]"
  style={{ color: "var(--text-tertiary)" }}
>
  /
</span>

// Itens clicáveis:
<button
  onClick={...}
  className="truncate text-[13px] font-medium transition-colors hover:underline"
  style={{ color: "var(--text-secondary)" }}
>
  {label}
</button>

// Item ativo (último):
<span
  className="truncate text-[13px] font-semibold"
  style={{ color: "var(--text-primary)" }}
>
  {label}
</span>
```

**Critérios:**
- [ ] Separador `/` mais sutil (de `›` para `/`)
- [ ] Items não-ativos: `text-secondary`, ativos: `text-primary font-semibold`
- [ ] Font size `text-[13px]` (de `text-sm` = 14px para 13px — mais compacto)

---

### 5.3 — Refinamento do NotebookTree items

**Arquivo:** `src/components/sidebar/NotebookTree.tsx`

Os itens de notebook, section e page na árvore precisam de ajustes visuais. Localizar os componentes `NotebookItem`, `SectionItem` e `PageItem` internos e aplicar:

```tsx
// Padrão a seguir para cada item:
// - Height: h-8 (32px) — consistente com SidebarQuickNav
// - Border radius: rounded-lg
// - Font size: text-[13px]
// - Indent visual: pl-* por nível
// - Hover: var(--bg-hover)
// - Active: accent-subtle bg + accent text

// Exemplo para notebook item:
<button
  className={clsx(
    "flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium transition-colors",
    isActive
      ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
      : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
  )}
>
  {isExpanded ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
  <BookOpen size={14} style={{ color: isActive ? "var(--accent)" : "var(--text-tertiary)" }}/>
  <span className="flex-1 truncate">{notebook.name}</span>
</button>

// Page item — nível mais profundo, fonte menor:
<button
  className={clsx(
    "flex h-7 w-full items-center gap-2 rounded-md pl-9 pr-2.5 text-[12px] transition-colors",
    isActive
      ? "bg-[var(--accent-subtle)] font-medium text-[var(--accent)]"
      : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
  )}
>
  <FileText size={12} style={{ color: "var(--text-tertiary)", flexShrink: 0 }}/>
  <span className="flex-1 truncate">{page.title}</span>
</button>
```

**Critérios:**
- [ ] Todos os níveis (notebook, section, page) com `rounded-lg`/`rounded-md`
- [ ] Font size `text-[13px]` para notebook/section, `text-[12px]` para page
- [ ] Ícones `size={14}` para notebook/section, `size={12}` para page
- [ ] DnD funcionalidade 100% preservada

---

### 5.4 — Revisar componente Button.tsx

**Arquivo:** `src/components/ui/Button.tsx`

Verificar as variantes existentes e aplicar os novos tokens de raio:

```tsx
// Garantir que todas as variantes usem border-radius consistente:
// - Default: rounded-lg (var(--radius-md) = 8px)
// - Pequeno: rounded-md (var(--radius-sm) = 6px)
// - Grande: rounded-xl (var(--radius-lg) = 12px)

// Verificar e ajustar a variante "primary":
const variantStyles = {
  primary: {
    backgroundColor: "var(--accent)",
    color: "#ffffff",
    // hover via onMouseEnter/onMouseLeave ou CSS class
  },
  secondary: {
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
  },
  ghost: {
    backgroundColor: "transparent",
    color: "var(--text-secondary)",
  },
  danger: {
    backgroundColor: "rgba(239,68,68,0.10)",
    color: "var(--danger)",
  },
};

// Border radius padrão: rounded-lg em todos os botões
// Adicionar active:scale-[0.98] para feedback tátil
```

**Critérios:**
- [ ] `rounded-lg` como default em todos os botões
- [ ] `active:scale-[0.98]` na variante primary e secondary
- [ ] Variante secondary com border explícita

---

### 5.5 — Ajustar componente IconButton.tsx

**Arquivo:** `src/components/ui/IconButton.tsx`

```tsx
// Garantir: h-8 w-8 rounded-lg para tamanho default
// h-7 w-7 rounded-md para tamanho sm

// Border radius atualizado de rounded-md para rounded-lg
```

**Critérios:**
- [ ] `rounded-lg` como default
- [ ] Tamanho consistente com a toolbar (`h-8 w-8`)

---

### 5.6 — Revisar Dialog.tsx e Input.tsx

**Arquivo:** `src/components/ui/Dialog.tsx`, `src/components/ui/Input.tsx`

Aplicar novos tokens de raio e sombra:

```tsx
// Dialog container:
// rounded-2xl (de rounded-xl)
// boxShadow: "var(--shadow-modal)"

// Input:
// rounded-lg (de rounded-md)
// focus:border-[var(--accent)] preservado
// height: h-9 (36px) para consistência
```

**Critérios:**
- [ ] Modais com `rounded-2xl` e `--shadow-modal`
- [ ] Inputs com `rounded-lg` e `h-9`

---

### 5.7 — Revisar StatusBar

**Arquivo:** `src/components/layout/StatusBar.tsx`

Inspecionar e ajustar para consistência:

```tsx
// StatusBar: h-6 (24px), font-size text-[11px], border-t
// Usar var(--text-tertiary) para conteúdo
// Preservar toda a lógica existente
```

**Critérios:**
- [ ] Consistência tipográfica com `text-[11px]`
- [ ] `var(--text-tertiary)` para texto de status

---

### 5.8 — Auditoria de acessibilidade e contraste

**Arquivos:** todos os modificados nas fases 1–5

Verificar:

| Check | Regra UI/UX Pro Max |
|-------|---------------------|
| Inline styles `color: "var(--text-secondary)"` | Contraste >= 4.5:1 em light mode |
| Hover states com inline style | `cursor: pointer` presente em todos os `<button>` |
| `aria-label` | Todos os icon-only buttons têm aria-label |
| Focus visible | `:focus-visible` com outline accent preservado |
| Transições | <= 150ms em todos os micro-interactions |

**Critérios:**
- [ ] Nenhum `<button>` sem `cursor-pointer` ou `cursor` definido
- [ ] Todos os icon-only buttons têm `aria-label`
- [ ] Sem `hover:-translate-y-*` que cause layout shift

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `src/components/layout/Toolbar.tsx` | Alteração — altura, separadores, ícones |
| `src/components/layout/Breadcrumb.tsx` | Alteração — tipografia, separadores |
| `src/components/layout/StatusBar.tsx` | Alteração — tipografia menor |
| `src/components/sidebar/NotebookTree.tsx` | Alteração — font size, border radius, spacing |
| `src/components/ui/Button.tsx` | Alteração — border radius, active scale |
| `src/components/ui/IconButton.tsx` | Alteração — border radius, tamanho |
| `src/components/ui/Dialog.tsx` | Alteração — rounded-2xl, shadow-modal |
| `src/components/ui/Input.tsx` | Alteração — rounded-lg, altura h-9 |

## Arquivos NÃO Modificados

- `src/components/editor/` — Editor TipTap sem alterações visuais
- `src/components/canvas/` — Canvas sem alterações visuais
- `src/components/settings/` — Settings sem alterações nesta fase
- `crates/` — Sem mudanças Rust em nenhuma das 5 fases
- `src-tauri/` — Sem mudanças IPC em nenhuma das 5 fases

---

## Critérios de Aceitação da Fase

- [ ] `cargo test --workspace` passa
- [ ] `cargo clippy --workspace -- -D warnings` sem warnings
- [ ] `npm run typecheck` sem erros
- [ ] `npm run test` — todos os testes existentes passando
- [ ] Toolbar com separadores visuais
- [ ] NotebookTree com font/sizing refinados
- [ ] Todos os modais com `rounded-2xl`
- [ ] Nenhum `hover:-translate-y-*` remanescente
- [ ] Auditoria de `cursor-pointer` e `aria-label` aprovada
- [ ] PR review aprovado

---

## Resumo do Redesign Completo

Após as 6 fases (0–5), o Open Note terá:

| Componente | Antes | Depois |
|-----------|-------|--------|
| **Backend** | Sem Quick Notes, sem preview, sem random pages | Quick Notes auto-criação, `PageSummary.preview`, `get_random_pages` IPC |
| **Tipografia** | System font genérico | `system-ui` moderno (SF Pro/Segoe UI/Roboto nativo) |
| **Sidebar header** | Ícone de pasta + workspace name | Logo + nome do app + workspace switcher |
| **Search** | Botão de ícone no footer | Input visível no topo da sidebar com shortcut ⌘K |
| **New page CTA** | Botão no footer (sem label) | CTA azul proeminente → cria em Quick Notes automaticamente |
| **Calendar** | Desabilitado na nav | Mantido desabilitado (sinaliza feature futura) |
| **Cards** | Border genérica, inline hover JS | `<InteractiveCard>` + `.card-interactive` CSS, accent bar colorida |
| **HomePage** | Grid simples de recent pages | Feed temporal com contexto completo + Random Note Spotlight |
| **Quick actions** | Button componente genérico | Tiles com `<InteractiveCard>` e cor individual por ação |
| **Toolbar** | h-10 sem separadores | h-11 com separadores visuais |
| **Modais** | `rounded-xl` | `rounded-2xl` com `--shadow-modal` |
| **Shadows** | 2 tokens (shadow, shadow-lg) | Escala de 4 níveis (card, card-hover, dropdown, modal) em 3 temas |
