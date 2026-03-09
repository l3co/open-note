# Fase 02 — Eliminação de Inline Hover (CSS Hover Classes)

**Esforço estimado:** ~8 horas  
**Impacto:** 🟠 ALTO  
**Dependências:** Fase 01 (primitivas criadas)  
**Branch:** `refactor/css-hover-classes`

---

## Objetivo

Eliminar **todas as 30+ instâncias** de `onMouseEnter`/`onMouseLeave` que manipulam `style` diretamente. Substituir por classes CSS com pseudo-classes `:hover` (Tailwind ou custom CSS).

**Regra Vercel:** `js-batch-dom-css` — Agrupar mudanças CSS via classes, não manipulação direta de style.

---

## Problema em Detalhe

### Padrão Atual (anti-pattern)

```tsx
<button
  style={{ color: "var(--text-secondary)" }}
  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
>
```

**Problemas:**
1. **Performance:** Cada hover dispara um re-layout do DOM (style mutation)
2. **Acessibilidade:** `:focus-visible` não é tratado (apenas mouse hover)
3. **Manutenção:** 30+ cópias do mesmo padrão
4. **Mobile/Touch:** `onMouseEnter` não funciona em touch — sticky hover
5. **CSS specificity:** `style={{}}` inline tem specificity máxima, impossível de override por tema

### Solução: Tailwind Hover Classes + CSS Custom Properties

```tsx
// ✅ DEPOIS
<button className="text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] focus-visible:bg-[var(--bg-hover)]">
```

Ou, para padrões complexos (como `active` state condicional), usar classes utilitárias:

```css
/* src/styles/interactive.css */
.interactive-ghost {
  background-color: transparent;
  transition: background-color 100ms ease;
}
.interactive-ghost:hover:not(:disabled) {
  background-color: var(--bg-hover);
}
.interactive-ghost:focus-visible {
  background-color: var(--bg-hover);
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.interactive-ghost[data-active="true"] {
  background-color: var(--accent-subtle);
  color: var(--accent);
}
.interactive-danger:hover:not(:disabled) {
  background-color: rgba(239, 68, 68, 0.1);
}
```

---

## Tarefas

### 2.1 — Criar classes utilitárias de interação

**Arquivo:** `src/styles/interactive.css`

Classes base para estados interativos que usam CSS custom properties:

| Classe | Hover | Active | Disabled |
|--------|-------|--------|----------|
| `.interactive-ghost` | `var(--bg-hover)` | `var(--accent-subtle)` | opacity 0.5 |
| `.interactive-subtle` | `var(--bg-hover)` | `var(--bg-active)` | opacity 0.5 |
| `.interactive-danger` | `rgba(239,68,68,0.1)` | — | opacity 0.5 |
| `.interactive-accent` | `var(--accent-hover)` | — | opacity 0.5 |

**Critérios:**
- [x] Todas as classes incluem `:focus-visible` (acessibilidade)
- [x] Transição suave de 100ms
- [x] Funciona com CSS Variables do tema
- [x] Importado no `main.css` ou entry point

---

### 2.2 — Migrar componentes para primitivas (Fase 01) + classes CSS

**Componentes a migrar (por prioridade de impacto):**

#### Grupo A — Migrar para primitivas `IconButton`/`Button`

| Componente | Local | Ação |
|-----------|-------|------|
| `FloatingToolbar.tsx` | `ToolbarButton` | Substituir por `<IconButton>` |
| `Toolbar.tsx` | 3 botões inline | Substituir por `<IconButton>` |
| `TrashPanel.tsx` | Close + restore + delete | Substituir por `<IconButton>` |
| `SettingsDialog.tsx` | Close button + tab buttons | `<IconButton>` + classe `interactive-ghost` |
| `DeleteDialog.tsx` | Cancel + Confirm | `<Button variant="ghost">` + `<Button variant="danger">` |
| `HomePage.tsx` | `QuickAction` | `<Button icon={} shortcut={}>` |
| `WorkspacePicker.tsx` | `ActionButton` + remove recent | `<Button>` + `<IconButton>` |

#### Grupo B — Aplicar classes CSS diretamente (sem primitiva)

| Componente | Local | Classe CSS |
|-----------|-------|-----------|
| `NotebookTree.tsx` | `TreeItem` | `interactive-ghost` + `data-active` |
| `ContextMenu.tsx` | Menu items | `interactive-ghost` / `interactive-danger` |
| `HomePage.tsx` | Recent page cards | `interactive-ghost` com border hover |
| `WorkspacePicker.tsx` | Recent workspace items | `interactive-ghost` |

---

### 2.3 — Migrar `TreeItem` (NotebookTree.tsx)

Este é o caso mais complexo pois combina hover, selected, drag-over:

**Antes:**
```tsx
onMouseEnter={(e) => {
  if (!isSelected && !isDragOver)
    e.currentTarget.style.backgroundColor = "var(--bg-hover)";
}}
onMouseLeave={(e) => {
  if (!isSelected && !isDragOver)
    e.currentTarget.style.backgroundColor = "transparent";
}}
```

**Depois:**
```tsx
<div
  className={cn(
    "group flex h-8 cursor-pointer items-center gap-2 rounded-md pr-1 text-[14px]",
    "interactive-ghost",
    isSelected && "bg-[var(--accent-subtle)] text-[var(--accent)]",
    isDragOver && "bg-[var(--accent-subtle)]",
  )}
  data-active={isSelected || isDragOver}
>
```

A lógica de "só hover se não selected" é resolvida pela CSS:
```css
.interactive-ghost[data-active="true"]:hover {
  /* Não muda — active bg tem prioridade */
  background-color: var(--accent-subtle);
}
```

**Critérios:**
- [x] TreeItem sem nenhum `onMouseEnter`/`onMouseLeave`
- [x] Selected + drag-over states via `data-active` ou classes condicionais
- [x] Testes de TreeItem continuam passando

---

### 2.4 — Migrar cards do HomePage

**Antes:**
```tsx
onMouseEnter={(e) => {
  e.currentTarget.style.borderColor = "var(--accent)";
  e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
}}
onMouseLeave={(e) => {
  e.currentTarget.style.borderColor = "var(--border)";
  e.currentTarget.style.boxShadow = "none";
}}
```

**Depois:**
```tsx
<button
  className="... border border-[var(--border)] hover:border-[var(--accent)] hover:shadow-md transition-all"
>
```

**Critérios:**
- [x] Tailwind `hover:` classes para border e shadow
- [x] Transição suave via `transition-all`
- [x] Sem `style={{}}` para borderColor/boxShadow

---

### 2.5 — Verificação: zero `onMouseEnter` para styling

**Validação final:**

```bash
# Deve retornar 0 resultados após esta fase
grep -r "onMouseEnter.*style\." src/components/ | grep -v test | wc -l
grep -r "onMouseLeave.*style\." src/components/ | grep -v test | wc -l
```

**Nota:** `onMouseEnter` ainda é válido para lógica (não styling), como:
- `setDragOverId` no drag-and-drop (NotebookTree)
- `setSelectedIndex` no QuickOpen/SearchPanel (highlight via `selected` class)

Esses são **comportamentais**, não visuais, e podem permanecer.

**Critérios:**
- [x] Zero `onMouseEnter`/`onMouseLeave` para manipulação de `style`
- [x] `onMouseEnter` mantido apenas para lógica comportamental (drag, selection)

---

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `src/styles/interactive.css` | **Novo** — classes utilitárias |
| `src/components/editor/FloatingToolbar.tsx` | Migrar ToolbarButton → IconButton |
| `src/components/layout/Toolbar.tsx` | Migrar botões → IconButton |
| `src/components/shared/TrashPanel.tsx` | Migrar botões → IconButton/Button |
| `src/components/shared/DeleteDialog.tsx` | Migrar → Dialog + Button |
| `src/components/settings/SettingsDialog.tsx` | Migrar → Dialog + IconButton |
| `src/components/pages/HomePage.tsx` | QuickAction → Button, cards → Tailwind hover |
| `src/components/workspace/WorkspacePicker.tsx` | ActionButton → Button |
| `src/components/sidebar/NotebookTree.tsx` | TreeItem → classes CSS |
| `src/components/shared/ContextMenu.tsx` | Items → classes CSS |

---

## Critérios de Aceitação

- [x] Zero `onMouseEnter`/`onMouseLeave` para manipulação de `style` em componentes
- [x] Todos os hovers funcionam via CSS pseudo-classes
- [x] `:focus-visible` implementado em todos os elementos interativos
- [x] Testes existentes passam sem alteração
- [x] Visual identico ao atual (nenhuma mudança perceptível para o usuário)
- [x] `npm run test` passa
- [x] `npm run lint` limpo
- [x] PR review aprovado
