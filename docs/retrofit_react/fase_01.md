# Fase 01 — Primitivas de UI (Button, Dialog, Input, IconButton)

**Esforço estimado:** ~20 horas  
**Impacto:** 🔴 CRÍTICO  
**Dependências:** Nenhuma  
**Branch:** `refactor/ui-primitives`

---

## Objetivo

Criar uma biblioteca de componentes primitivos reutilizáveis que elimine a duplicação massiva de botões, dialogs, inputs e icon buttons espalhados por 30+ arquivos. Cada primitiva encapsula estilização, hover, estados (disabled, loading, active) e acessibilidade.

---

## Diagnóstico Detalhado

### Botões — 6+ implementações incompatíveis

| Componente | Arquivo | Linhas | Particularidades |
|-----------|---------|--------|------------------|
| `ToolbarButton` | `FloatingToolbar.tsx:180-210` | 30 | `active` state, hover via inline style |
| `QuickAction` | `HomePage.tsx:162-219` | 58 | Icon + label + shortcut kbd |
| `ActionButton` | `WorkspacePicker.tsx:335-380` | 46 | Icon + label + badge, disabled |
| Botões inline | `Toolbar.tsx:30-77` | ~50 | Navegação back/forward com disabled |
| Menu items | `ContextMenu.tsx:197-215` | 18 | Icon + label, danger variant |
| Tab buttons | `SettingsDialog.tsx:99-127` | 28 | Active tab state |

**Nenhum compartilha código.** Cada um reimplementa:
- `onMouseEnter` / `onMouseLeave` para hover
- Lógica de `active` / `selected` / `disabled`
- Sizing (h-6, h-7, h-8) sem padrão

### Dialogs — 4 implementações separadas

Padrão duplicado (`fixed inset-0 z-50 flex items-center justify-center`):
- `TrashPanel.tsx:51-162`
- `DeleteDialog.tsx:46-113`
- `SettingsDialog.tsx:65-173`
- `WorkspacePicker.tsx` (parcial — não usa overlay quando full-screen)

Faltam em todos: **focus trap**, **Escape handler** consistente, **animação de entrada/saída**.

### Inputs — 4+ estilos diferentes

- `ContextMenu.tsx:132-148` — rename input
- `WorkspacePicker.tsx:222-248` — create form inputs
- `NotebookTree.tsx:420-438` — inline rename input
- `QuickOpen.tsx:100-108` — search input
- `SearchPanel.tsx:121-129` — search input

---

## Tarefas

### 1.1 — Criar `IconButton`

**Arquivo:** `src/components/ui/IconButton.tsx`

```tsx
interface IconButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  size?: "sm" | "md" | "lg";          // h-6/h-7/h-8
  variant?: "ghost" | "subtle" | "danger";
  active?: boolean;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
  "aria-label"?: string;
  className?: string;
}
```

**Variantes de tamanho:**
| Size | Classes | Uso |
|------|---------|-----|
| `sm` | `h-6 w-6` | Close buttons, ações inline |
| `md` | `h-7 w-7` | Toolbar, floating toolbar |
| `lg` | `h-8 w-8` | Quick actions |

**Hover via CSS (não inline style):**
```css
/* Tailwind classes ou CSS module */
.icon-btn-ghost:hover:not(:disabled) { background-color: var(--bg-hover); }
.icon-btn-ghost[data-active="true"] { background-color: var(--accent-subtle); color: var(--accent); }
.icon-btn-danger:hover:not(:disabled) { background-color: rgba(239, 68, 68, 0.1); }
```

**Critérios:**
- [ ] Hover via CSS pseudo-class (zero `onMouseEnter`/`onMouseLeave`)
- [ ] Suporte a `active`, `disabled`, `loading` states
- [ ] `aria-label` obrigatório quando não há texto visível
- [ ] `title` para tooltip nativo
- [ ] Testes: render, click, disabled, active state, keyboard (Enter/Space)

---

### 1.2 — Criar `Button`

**Arquivo:** `src/components/ui/Button.tsx`

```tsx
interface ButtonProps {
  onClick?: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  badge?: string;
  shortcut?: string;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  type?: "button" | "submit";
  className?: string;
}
```

**Unifica:**
- `QuickAction` → `<Button variant="ghost" icon={...} shortcut="⌘K" />`
- `ActionButton` → `<Button variant="ghost" icon={...} badge="Coming soon" fullWidth />`
- Botões de confirmação → `<Button variant="primary">Create</Button>`
- Botões de cancelamento → `<Button variant="ghost">Cancel</Button>`
- Botões de deletar → `<Button variant="danger">Delete</Button>`

**Critérios:**
- [ ] Todas as variantes com hover CSS puro
- [ ] Slot para `icon` (esquerda/direita)
- [ ] Slot para `badge` (à direita, como em ActionButton)
- [ ] Slot para `shortcut` (como em QuickAction, renderiza `<kbd>`)
- [ ] `fullWidth` para lista de ações
- [ ] Testes: todas as variantes, disabled, loading, keyboard

---

### 1.3 — Criar `Dialog`

**Arquivo:** `src/components/ui/Dialog.tsx`

```tsx
interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
}
```

**Features essenciais:**
- **Focus trap:** Tab não escapa do dialog
- **Escape handler:** Fecha ao pressionar Escape
- **Backdrop click:** Fecha ao clicar fora (configurável)
- **Animação:** Fade in/out + scale (150ms)
- **Scroll lock:** Body não scrolla com dialog aberto
- **Auto-focus:** Foca no primeiro elemento interativo ao abrir
- **Return focus:** Volta o foco ao elemento que abriu o dialog

**Tamanhos:**
| Size | Classe | Uso |
|------|--------|-----|
| `sm` | `w-80` | DeleteDialog, confirmações |
| `md` | `w-[420px]` | TrashPanel, WorkspacePicker |
| `lg` | `w-[720px]` | SettingsDialog |
| `xl` | `w-[900px]` | Futuro: cross-workspace search |

**Sub-componentes:**
```tsx
Dialog.Header  // Título + close button
Dialog.Body    // Conteúdo scrollável
Dialog.Footer  // Ações (botões)
```

**Critérios:**
- [ ] Focus trap funcional (Tab + Shift+Tab)
- [ ] Escape fecha
- [ ] Backdrop click fecha (configurável)
- [ ] Animação enter/exit
- [ ] `role="dialog"` + `aria-modal="true"` + `aria-label`
- [ ] Return focus ao fechar
- [ ] Testes: open/close, focus trap, escape, backdrop, acessibilidade

---

### 1.4 — Criar `Input`

**Arquivo:** `src/components/ui/Input.tsx`

```tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  error?: string;
  size?: "sm" | "md";
  fullWidth?: boolean;
}
```

**Unifica:**
- Search inputs (QuickOpen, SearchPanel) → `<Input icon={<Search />} />`
- Rename inputs (ContextMenu, TreeItem) → `<Input size="sm" autoFocus />`
- Form inputs (WorkspacePicker) → `<Input fullWidth />`

**Critérios:**
- [ ] Estilo consistente em toda a app
- [ ] Focus ring com `var(--accent)` 
- [ ] Error state com borda vermelha
- [ ] Slot para ícone (left/right)
- [ ] Testes: render, focus, error state, icon

---

### 1.5 — Criar `ContextMenuPrimitive`

**Arquivo:** `src/components/ui/ContextMenuPrimitive.tsx`

```tsx
interface ContextMenuPrimitiveProps {
  x: number;
  y: number;
  onClose: () => void;
  children: React.ReactNode;
}

interface MenuItemProps {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  shortcut?: string;
}
```

**Features:**
- Posicionamento automático (viewport boundary detection)
- Keyboard navigation (↑↓ para mover, Enter para selecionar, Escape para fechar)
- Close on click outside
- `role="menu"` + `role="menuitem"`

**Critérios:**
- [ ] Keyboard navigation completa
- [ ] Viewport boundary: não corta na borda da tela
- [ ] ARIA roles corretos
- [ ] Testes: keyboard nav, click outside, escape

---

### 1.6 — Barrel export + index

**Arquivo:** `src/components/ui/index.ts`

```tsx
export { IconButton } from "./IconButton";
export { Button } from "./Button";
export { Dialog } from "./Dialog";
export { Input } from "./Input";
export { ContextMenuPrimitive, MenuItem } from "./ContextMenuPrimitive";
```

**Critérios:**
- [ ] Importação limpa: `import { Button, Dialog } from "@/components/ui"`
- [ ] Nenhuma dependência circular

---

### 1.7 — Testes das primitivas

**Arquivos:** `src/components/ui/__tests__/`

| Componente | Testes |
|-----------|--------|
| `IconButton` | render, click, disabled, active, loading, keyboard (Enter/Space) |
| `Button` | variants (primary, ghost, danger), icon slot, shortcut, badge, disabled |
| `Dialog` | open/close, focus trap, escape, backdrop, aria, animation |
| `Input` | render, focus ring, error state, icon slot |
| `ContextMenuPrimitive` | keyboard nav, viewport bounds, escape, click outside |

**Critérios:**
- [ ] Coverage ≥ 90% para cada primitiva
- [ ] Testes de acessibilidade com `@testing-library/jest-dom`
- [ ] Zero manipulação de style inline nos testes

---

## Migração Gradual

Após criar as primitivas, a migração dos componentes existentes será feita nas fases seguintes. As primitivas são **aditivas** — não quebram nada.

**Ordem de migração sugerida (por impacto):**
1. `FloatingToolbar.tsx` → `ToolbarButton` → `IconButton`
2. `Toolbar.tsx` → botões inline → `IconButton`
3. `DeleteDialog.tsx` → todo → `Dialog` + `Button`
4. `TrashPanel.tsx` → overlay → `Dialog`
5. `SettingsDialog.tsx` → overlay + tabs → `Dialog` + `IconButton`
6. `HomePage.tsx` → `QuickAction` → `Button`
7. `WorkspacePicker.tsx` → `ActionButton` → `Button`
8. `ContextMenu.tsx` → todo → `ContextMenuPrimitive`
9. Rename inputs → `Input`

---

## Arquivos Criados

| Arquivo | Tipo |
|---------|------|
| `src/components/ui/IconButton.tsx` | **Novo** |
| `src/components/ui/Button.tsx` | **Novo** |
| `src/components/ui/Dialog.tsx` | **Novo** |
| `src/components/ui/Input.tsx` | **Novo** |
| `src/components/ui/ContextMenuPrimitive.tsx` | **Novo** |
| `src/components/ui/index.ts` | **Novo** |
| `src/components/ui/__tests__/*.test.tsx` | **Novos** |

## Arquivos NÃO Modificados (ainda)

Nenhum componente existente é alterado nesta fase. As primitivas são adicionais.

---

## Critérios de Aceitação

- [ ] 5 componentes primitivos criados e testados
- [ ] Zero `onMouseEnter`/`onMouseLeave` inline nas primitivas
- [ ] Dialog com focus trap funcional
- [ ] ContextMenu com keyboard navigation
- [ ] `npm run test` passa
- [ ] `npm run typecheck` sem erros
- [ ] `npm run lint` limpo
- [ ] PR review aprovado
