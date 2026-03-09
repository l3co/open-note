# Fase 05 — UI: Workspace Switcher & Tabs

**Esforço estimado:** ~20 horas  
**Prioridade:** 🟡 Alta  
**Dependências:** Fase 04  
**Branch:** `feat/multi-workspace-phase-5`

---

## Objetivo

Criar a interface de usuário para gerenciar múltiplos workspaces: um **Workspace Switcher** na sidebar, **tabs ou indicador visual** do workspace ativo, e ajustes no **WorkspacePicker** para funcionar como modal quando já há workspaces abertos.

---

## Design de UX

### Referências Visuais

- **VS Code:** Sidebar com ícone de workspace, popup de troca rápida
- **Notion:** Sidebar com dropdown de workspace no topo
- **OneNote:** Barra lateral com notebooks agrupados por conta

### Decisão: Sidebar Header com Workspace Dropdown

```
┌─────────────────────────────────────────────────┐
│ Toolbar                                         │
├──────────┬──────────────────────────────────────┤
│ Sidebar  │                                      │
│          │                                      │
│ [▼ Meus  │   Content Area                       │
│  Estudos]│                                      │
│ ──────── │                                      │
│ Notebooks│                                      │
│  ├ Math  │                                      │
│  ├ CS    │                                      │
│          │                                      │
│ [+ Open] │                                      │
│ [+ New]  │                                      │
├──────────┴──────────────────────────────────────┤
│ StatusBar: "Meus Estudos" | 3 workspaces open   │
└─────────────────────────────────────────────────┘
```

**Dropdown expandido:**
```
┌──────────────────┐
│ ✓ Meus Estudos   │  ← focused (check mark)
│   Trabalho       │
│   Pessoal        │
│ ──────────────── │
│ + Open Workspace │
│ + New Workspace  │
│ ──────────────── │
│ ⚙ Manage...     │
└──────────────────┘
```

---

## Tarefas

### 5.1 — Componente `WorkspaceSwitcher`

**Arquivo:** `src/components/sidebar/WorkspaceSwitcher.tsx`

Dropdown no topo da sidebar mostrando o workspace em foco com opção de trocar.

```typescript
export function WorkspaceSwitcher() {
  const { workspaces, focusedId } = useWorkspaceList();
  const { focusWorkspace, closeWorkspace } = useMultiWorkspaceStore();

  // Renderiza: nome do focused + chevron
  // Ao clicar: popover com lista de workspaces
  // Cada item: nome, path, botão close (X)
  // Footer: "Open Workspace" e "New Workspace"
}
```

**Sub-componentes:**
- `WorkspaceSwitcherTrigger` — Botão com nome + chevron
- `WorkspaceSwitcherPopover` — Lista de workspaces + ações

**Critérios:**
- [ ] Mostra nome do workspace focused no trigger
- [ ] Popover lista todos os workspaces abertos
- [ ] Check mark (✓) no workspace em foco
- [ ] Click em outro workspace → `focusWorkspace(id)`
- [ ] Botão X em cada workspace → `closeWorkspace(id)` com confirmação
- [ ] "Open Workspace" abre dialog de seleção de pasta
- [ ] "New Workspace" abre form inline ou modal
- [ ] Keyboard navigation: ↑↓ para navegar, Enter para selecionar
- [ ] i18n: todas as strings via `useTranslation()`
- [ ] Ícone: `FolderOpen` do Lucide

---

### 5.2 — Integrar `WorkspaceSwitcher` na `Sidebar`

**Arquivo:** `src/components/sidebar/Sidebar.tsx`

Adicionar `WorkspaceSwitcher` como primeiro elemento da sidebar, acima da lista de notebooks.

```tsx
export function Sidebar() {
  return (
    <aside>
      <WorkspaceSwitcher />       {/* NOVO */}
      <SidebarDivider />
      <NotebookList />
      {/* ... */}
    </aside>
  );
}
```

**Critérios:**
- [ ] Visível apenas quando 1+ workspaces abertos
- [ ] Não aparece no WorkspacePicker (tela inicial sem workspace)
- [ ] Respeita `sidebarWidth` do `useUIStore`
- [ ] Scroll da lista de notebooks não afeta o switcher (sticky top)

---

### 5.3 — Refatorar `WorkspacePicker` para modo modal

**Arquivo:** `src/components/workspace/WorkspacePicker.tsx`

Atualmente o WorkspacePicker é full-screen. Com múltiplos workspaces, precisa funcionar em dois modos:

1. **Full-screen** — quando nenhum workspace aberto (como hoje)
2. **Modal** — quando já há workspace(s) aberto(s) e o usuário quer adicionar mais

```typescript
interface WorkspacePickerProps {
  mode?: "fullscreen" | "modal";
  onClose?: () => void;
}

export function WorkspacePicker({ mode = "fullscreen", onClose }: WorkspacePickerProps) {
  // mode="fullscreen": layout atual
  // mode="modal": dialog overlay com backdrop, botão close
}
```

**Critérios:**
- [ ] Modo fullscreen: idêntico ao comportamento atual
- [ ] Modo modal: overlay com backdrop blur, botão X, Escape fecha
- [ ] "Open" em modo modal → abre workspace adicional (não substitui)
- [ ] "Create" em modo modal → cria e abre workspace adicional
- [ ] Testes visuais para ambos os modos

---

### 5.4 — Indicador de workspace no `StatusBar`

**Arquivo:** `src/components/layout/StatusBar.tsx`

Adicionar indicador do workspace ativo e contagem de workspaces abertos:

```tsx
<span className="status-bar-item">
  <FolderOpen size={14} />
  {focusedWorkspace?.name}
  {workspaceCount > 1 && (
    <span className="text-xs opacity-60">
      ({workspaceCount} workspaces)
    </span>
  )}
</span>
```

**Critérios:**
- [ ] Nome do workspace visível na status bar
- [ ] Contagem apenas se > 1 workspace
- [ ] Click no nome abre o WorkspaceSwitcher popover
- [ ] i18n para a label

---

### 5.5 — Atalhos de teclado para troca de workspace

**Arquivo:** `src/hooks/useKeyboardShortcuts.ts`

| Atalho | Ação |
|--------|------|
| `Ctrl/Cmd + Shift + W` | Abrir WorkspaceSwitcher popover |
| `Ctrl/Cmd + Shift + [` | Workspace anterior |
| `Ctrl/Cmd + Shift + ]` | Próximo workspace |
| `Ctrl/Cmd + Shift + N` | Novo workspace (modal) |

**Critérios:**
- [ ] Atalhos registrados no hook existente
- [ ] Não conflitam com atalhos existentes
- [ ] Funcionam apenas quando há workspaces abertos

---

### 5.6 — Animação de transição entre workspaces

**Arquivo:** `src/components/layout/ContentArea.tsx`

Ao trocar de workspace, uma transição sutil:

```css
/* Fade + slide suave */
.workspace-transition-enter {
  opacity: 0;
  transform: translateY(4px);
}
.workspace-transition-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 150ms ease, transform 150ms ease;
}
```

**Critérios:**
- [ ] Transição de 150ms (não intrusiva)
- [ ] Sidebar atualiza notebooks instantaneamente
- [ ] Content area faz fade in do conteúdo do novo workspace
- [ ] Sem janking ou flash de conteúdo anterior

---

### 5.7 — Strings de i18n

**Arquivos:** `src/locales/pt-BR.json`, `src/locales/en.json`

```json
{
  "workspace": {
    "switcher_title": "Workspaces",
    "switch_to": "Switch to {{name}}",
    "close_workspace": "Close workspace",
    "close_confirm": "Close \"{{name}}\"? Unsaved changes will be preserved.",
    "open_another": "Open Workspace",
    "create_another": "New Workspace",
    "manage": "Manage Workspaces",
    "count_open": "{{count}} workspaces open",
    "shortcut_switch": "Switch workspace",
    "shortcut_next": "Next workspace",
    "shortcut_prev": "Previous workspace"
  }
}
```

**Critérios:**
- [ ] Todas as strings novas em pt-BR e en
- [ ] Nenhuma string hardcoded nos componentes novos
- [ ] Interpolação para nomes dinâmicos

---

### 5.8 — Testes de componente

**Arquivos:**
- `src/components/sidebar/__tests__/WorkspaceSwitcher.test.tsx`
- `src/components/workspace/__tests__/WorkspacePicker.test.tsx` (atualizar)

| Teste | Descrição |
|-------|-----------|
| `renders_focused_workspace_name` | Mostra nome do focused no trigger |
| `popover_lists_all_workspaces` | Click → popover com todos os workspaces |
| `click_workspace_focuses_it` | Click em item → focusWorkspace chamado |
| `close_button_removes_workspace` | Click X → closeWorkspace chamado |
| `open_workspace_button_triggers_dialog` | "Open" → dialog de seleção |
| `keyboard_navigation_works` | ↑↓ navega, Enter seleciona |
| `escape_closes_popover` | Escape → fecha popover |
| `modal_mode_has_backdrop` | mode="modal" → backdrop visível |
| `fullscreen_mode_unchanged` | mode="fullscreen" → layout original |
| `status_bar_shows_workspace_info` | Nome e contagem visíveis |

**Critérios:**
- [ ] Testes com Testing Library + mocks de stores
- [ ] Coverage ≥ 85% dos componentes novos
- [ ] Acessibilidade: roles corretos, aria-labels

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `src/components/sidebar/WorkspaceSwitcher.tsx` | **Novo** |
| `src/components/sidebar/Sidebar.tsx` | Integração do switcher |
| `src/components/workspace/WorkspacePicker.tsx` | Modo modal adicionado |
| `src/components/layout/StatusBar.tsx` | Indicador de workspace |
| `src/components/layout/ContentArea.tsx` | Animação de transição |
| `src/hooks/useKeyboardShortcuts.ts` | Novos atalhos |
| `src/locales/pt-BR.json` | Strings novas |
| `src/locales/en.json` | Strings novas |
| Testes diversos | Novos e atualizados |

---

## Critérios de Aceitação da Fase

- [ ] Workspace Switcher funcional na sidebar
- [ ] Troca de workspace preserva estado (notebooks, navegação, page aberta)
- [ ] WorkspacePicker funciona como modal quando invocado com workspaces abertos
- [ ] Status bar mostra workspace ativo
- [ ] Atalhos de teclado funcionam
- [ ] Todas as strings em pt-BR e en
- [ ] `npm run test` passa
- [ ] `npm run lint` limpo
- [ ] `npm run typecheck` sem erros
- [ ] PR review aprovado
