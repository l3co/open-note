# Fase 02 — Sidebar Redesign

**Esforço estimado:** ~6 horas
**Prioridade:** 🔴 Crítica
**Dependências:** Fases 0 e 1
**Branch:** `feat/redesign-plataforma-phase-2`

---

## Objetivo

Redesenhar a sidebar para ter a identidade visual do NotePlus: área de logo/marca no topo, seletor de workspace com avatar, campo de search como input visível (não ícone escondido), botão CTA "New Page" proeminente (usando Quick Notes da Fase 0), itens de navegação com hover states refinados e footer limpo com apenas ações secundárias.

**Decisões aplicadas:**
- **D3** — CTA "New Page" usa `ensureQuickNotes()` da Fase 0 (cria Quick Notes automaticamente)
- **D5** — Calendar mantido desabilitado na sidebar (sinaliza feature futura)
- Hover/focus states dos nav items via CSS classes (não inline JS)

---

## Contexto Atual

### WorkspaceSwitcher (topo da sidebar)
```tsx
// src/components/sidebar/WorkspaceSwitcher.tsx — linha 91-120
<div className="relative px-3 pt-3 pb-2">
  <button className="interactive-ghost flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium">
    <FolderOpen size={15} style={{ color: "var(--accent)", flexShrink: 0 }} />
    <span className="flex-1 truncate">{workspace.name}</span>
    <ChevronDown size={14} />
  </button>
  {/* popover dropdown */}
</div>
```
Problema: apenas um ícone de pasta pequeno, sem logo, sem identidade visual.

### SidebarQuickNav (navegação)
```tsx
// src/components/sidebar/SidebarQuickNav.tsx — linha 13-41
<div className="space-y-0.5">
  <QuickNavItem icon={<Search size={16}/>} label="Search" onClick={openQuickOpen}/>
  <QuickNavItem icon={<Home size={16}/>} label="Home" active={...}/>
  <QuickNavItem icon={<CalendarDays size={16}/>} label="Calendar" disabled/>
  <QuickNavItem icon={<Tag size={16}/>} label="Tags" active={...}/>
</div>
```
Problema: Search é um botão que abre quick-open modal. NotePlus tem um input inline.

### SidebarFooter (rodapé)
```tsx
// src/components/sidebar/SidebarFooter.tsx — linha 29-68
<div className="flex items-center justify-between border-t px-2 py-2">
  <div className="flex items-center gap-1">
    <FooterButton icon={<Plus/>} label="New Notebook"/>
    <FooterButton icon={<Search/>} label="Search" disabled/>
    <FooterButton icon={<Trash2/>} label="Trash"/>
    <FooterButton icon={<Settings/>} label="Settings"/>
  </div>
  <div className="flex items-center gap-1">
    <FooterButton icon={<LogOut/>} label="Close Workspace"/>
    <FooterButton icon={<FolderSync/>} label="Open Workspace"/>
  </div>
</div>
```
Problema: Strip de ícones sem label visível dificulta a descoberta. Duplicação de Search (já existe em QuickNav). Ações misturadas sem hierarquia.

---

## Tarefas

### 2.1 — Redesenhar WorkspaceSwitcher com área de logo

**Arquivo:** `src/components/sidebar/WorkspaceSwitcher.tsx`

Adicionar logo e nome da aplicação fixos acima do seletor de workspace. O seletor vira uma linha secundária com avatar de workspace:

```tsx
// Estrutura proposta para o return principal:
<div className="relative px-3 pt-4 pb-2" data-testid="workspace-switcher">

  {/* Área de branding — logo + nome do app */}
  <div className="flex items-center gap-2.5 px-2 mb-3">
    <img src={logoSrc} alt="Open Note" className="h-7 w-7 rounded-lg" />
    <span
      className="text-[15px] font-semibold tracking-tight"
      style={{ color: "var(--text-primary)" }}
    >
      Open Note
    </span>
  </div>

  {/* Seletor de workspace (mantém lógica existente) */}
  <button
    ref={triggerRef}
    onClick={handleToggle}
    className="interactive-ghost flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm"
    /* ... demais props preservados ... */
  >
    {/* Ícone de pasta colorido como "avatar" */}
    <div
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
      style={{ backgroundColor: "var(--accent-subtle)" }}
    >
      <FolderOpen size={13} style={{ color: "var(--accent)" }} />
    </div>
    <span className="flex-1 truncate text-left text-[13px]" style={{ color: "var(--text-secondary)" }}>
      {focused?.workspace.name ?? t("workspace.none_open")}
    </span>
    <ChevronDown size={12} style={{ color: "var(--text-tertiary)", /* transition preservada */ }} />
  </button>

  {/* Popover de workspaces — mantém lógica existente sem alteração */}
  {isOpen && ( /* ... código existente sem alteração ... */ )}
</div>
```

Adicionar import do logo:
```tsx
import logoSrc from "@/assets/logo.png";
```

**Critérios:**
- [ ] Logo visível no topo da sidebar em todas as views
- [ ] Workspace switcher menor e mais discreto (hierarquia secundária)
- [ ] Funcionalidade de troca de workspace 100% preservada
- [ ] Testes existentes em `WorkspaceSwitcher.__tests__` continuam passando

---

### 2.2 — Adicionar Search Input inline na sidebar

**Arquivo:** `src/components/sidebar/SidebarQuickNav.tsx`

Substituir o `QuickNavItem` de Search por um input estilizado que chama `openQuickOpen` ao focar/clicar:

```tsx
import { Search, Home, Tag } from "lucide-react";
// CalendarDays mantido (desabilitado, sinaliza feature futura)

export function SidebarQuickNav() {
  const { t } = useTranslation();
  const { activeView, setActiveView } = useNavigationStore();
  const { openQuickOpen } = useUIStore();

  return (
    <div className="space-y-1">

      {/* Search Input — abre quick open ao clicar */}
      <button
        onClick={openQuickOpen}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors"
        style={{
          backgroundColor: "var(--bg-tertiary)",
          color: "var(--text-tertiary)",
          border: "1px solid var(--border-subtle)",
        }}
        aria-label={t("sidebar.search")}
      >
        <Search size={14} className="shrink-0" />
        <span className="flex-1 text-left">{t("sidebar.search_placeholder")}</span>
        <span
          className="rounded px-1 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-tertiary)" }}
        >
          ⌘K
        </span>
      </button>

      {/* Nav items */}
      <div className="pt-1 space-y-0.5">
        <QuickNavItem
          icon={<Home size={15} />}
          label={t("sidebar.home")}
          active={activeView === "home"}
          onClick={() => setActiveView("home")}
        />
        <QuickNavItem
          icon={<CalendarDays size={15} />}
          label={t("sidebar.calendar")}
          disabled
        />
        <QuickNavItem
          icon={<Tag size={15} />}
          label={t("sidebar.tags")}
          active={activeView === "tags"}
          onClick={() => setActiveView("tags")}
        />
      </div>
    </div>
  );
}
```

Adicionar chave i18n `sidebar.search_placeholder` nos arquivos de locale:
- `src/locales/en.json`: `"search_placeholder": "Search..."`
- `src/locales/pt-BR.json`: `"search_placeholder": "Buscar..."`

**Critérios:**
- [ ] Search input visível e proeminente no topo da nav
- [ ] Clicar abre `openQuickOpen` (comportamento preservado)
- [ ] Shortcut `⌘K` visível no botão
- [ ] Calendar mantido desabilitado (D5)
- [ ] Home e Tags preservados

---

### 2.3 — Adicionar botão CTA "New Page" proeminente

**Arquivo:** `src/components/sidebar/SidebarQuickNav.tsx`

Após o search input e antes dos nav items, adicionar um botão CTA de criação (inspirado no "+ Add New" do NotePlus):

```tsx
// Dentro do SidebarQuickNav, após o search button:
<button
  onClick={onNewPage}  // prop passada pelo Sidebar.tsx
  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-all hover:opacity-90 active:scale-[0.98]"
  style={{
    backgroundColor: "var(--accent)",
    color: "#ffffff",
  }}
>
  <Plus size={15} className="shrink-0" />
  <span className="flex-1 text-left">{t("sidebar.new_page")}</span>
  <span
    className="rounded px-1 py-0.5 text-[10px] font-medium opacity-70"
    style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
  >
    ⌘N
  </span>
</button>
```

A lógica de `onNewPage` usa `ipc.ensureQuickNotes()` (Fase 0) para garantir que existe um section de Quick Notes:

```tsx
const handleNewPage = async () => {
  try {
    const sectionId = await ipc.ensureQuickNotes();
    const page = await createPage(sectionId, t("page.new"));
    selectPage(page.id);
    await loadPage(page.id);
  } catch {
    // Fallback: abre quick-open para seleção manual
    openQuickOpen();
  }
};
```

**Nota:** Adicionar chave `sidebar.new_page` nos locales: EN: `"New Page"`, PT-BR: `"Nova Página"`.

**Critérios:**
- [ ] Botão CTA visível em azul accent no topo da sidebar
- [ ] Cria página via `ensureQuickNotes()` (D3) — zero friction
- [ ] Fallback para quick-open se algo falhar
- [ ] Shortcut `⌘N` visível
- [ ] `active:scale-[0.98]` para feedback tátil

---

### 2.4 — Redesenhar QuickNavItem com estilo melhorado

**Arquivo:** `src/components/sidebar/SidebarQuickNav.tsx`

Atualizar o componente `QuickNavItem` interno:

```tsx
function QuickNavItem({ icon, label, active = false, onClick }: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium transition-colors"
      style={{
        backgroundColor: active ? "var(--accent-subtle)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-secondary)",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--bg-hover)";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
      }}
      data-active={active}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="flex-1 truncate text-left">{label}</span>
    </button>
  );
}
```

**Critérios:**
- [ ] Altura mínima 36px (h-9) para touch targets >= 44px com padding
- [ ] Active state com `accent-subtle` bg e `accent` text
- [ ] Hover state suave sem `interactive-ghost` class (conflito com inline styles)

---

### 2.5 — Redesenhar SidebarFooter

**Arquivo:** `src/components/sidebar/SidebarFooter.tsx`

Simplificar o footer: remover search duplicado e reorganizar em dois grupos com labels tooltips:

```tsx
// Footer mais limpo — apenas ações secundárias
<div
  className="flex items-center justify-between border-t px-3 py-2"
  style={{ borderColor: "var(--border)" }}
  data-testid="sidebar-footer"
>
  <div className="flex items-center gap-0.5">
    <FooterButton icon={<Plus size={15}/>} label={t("notebook.new")} onClick={() => setShowCreate(true)} />
    <FooterButton icon={<Trash2 size={15}/>} label={t("sidebar.trash")} onClick={openTrashPanel} />
  </div>
  <div className="flex items-center gap-0.5">
    <FooterButton icon={<Settings size={15}/>} label={t("settings.title")} onClick={openSettings} />
    <FooterButton icon={<FolderSync size={15}/>} label={t("workspace.open")} onClick={openWorkspacePicker} />
  </div>
</div>
```

Atualizar `FooterButton` para usar `--radius-md` e padding mais generoso:

```tsx
function FooterButton({ icon, label, onClick, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-30"
      style={{ color: "var(--text-tertiary)" }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      onMouseDown={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
      onMouseUp={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}
```

**Critérios:**
- [ ] Search removido do footer (existe como input na nav)
- [ ] LogOut removido do footer (workspace switcher já tem essa função)
- [ ] Trash movido da nav para o footer (junto com New Notebook, Settings, Open Workspace)
- [ ] `title` tooltip preservado em todos os botões

---

### 2.6 — Ajustar Sidebar container

**Arquivo:** `src/components/sidebar/Sidebar.tsx`

Adicionar separador visual entre branding e nav, e ajustar padding do `<nav>`:

```tsx
<aside
  className="relative flex flex-col border-r"
  style={{
    width: sidebarWidth,
    minWidth: 200,
    maxWidth: 400,
    backgroundColor: "var(--bg-sidebar)",
    borderColor: "var(--border)",
  }}
>
  <WorkspaceSwitcher onOpenWorkspacePicker={openWorkspacePicker} />

  {/* Separador sutil */}
  <div className="mx-3 mb-1" style={{ height: "1px", backgroundColor: "var(--border-subtle)" }} />

  <nav
    className="flex-1 overflow-y-auto px-3 py-2"
    aria-label={t("sidebar.notebooks")}
  >
    <SidebarQuickNav />

    <div className="mt-4 mb-1.5 flex items-center px-1">
      <h2
        className="text-[10px] font-semibold tracking-widest uppercase"
        style={{ color: "var(--text-tertiary)" }}
      >
        {t("sidebar.notebooks")}
      </h2>
    </div>

    <NotebookTree />
  </nav>

  <SidebarFooter />

  {/* Resize handle — preservado */}
  <div
    ref={resizeRef}
    onMouseDown={handleMouseDown}
    className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-[var(--accent)]"
    style={{ opacity: 0.3 }}
  />
</aside>
```

**Critérios:**
- [ ] Separador visual sutil entre branding e nav
- [ ] Padding `py-2` no nav (de `pt-2` para `py-2`)
- [ ] `data-testid="sidebar"` preservado

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `src/components/sidebar/WorkspaceSwitcher.tsx` | Alteração — logo + branding area |
| `src/components/sidebar/SidebarQuickNav.tsx` | Alteração — search input, CTA button, nav items |
| `src/components/sidebar/SidebarFooter.tsx` | Alteração — simplificação do footer |
| `src/components/sidebar/Sidebar.tsx` | Alteração — separador e padding |
| `src/locales/en.json` | Alteração — novas chaves i18n |
| `src/locales/pt-BR.json` | Alteração — novas chaves i18n |

## Arquivos NÃO Modificados (ainda)

- `src/components/pages/` — Sem mudanças nesta fase
- `src/components/layout/Toolbar.tsx` — Sem mudanças
- `src/styles/globals.css` — Sem mudanças (já feito na Fase 1)

---

## Critérios de Aceitação da Fase

- [ ] `cargo test --workspace` passa
- [ ] `npm run typecheck` sem erros
- [ ] Logo visível no topo da sidebar
- [ ] Search input visível e funcional
- [ ] CTA "Nova Página" usa `ensureQuickNotes()` — cria página sem dialog
- [ ] Calendar mantido desabilitado na nav
- [ ] Footer simplificado sem duplicações
- [ ] Testes existentes de sidebar passando (`npm run test -- sidebar`)
- [ ] Snapshots atualizados onde necessário
- [ ] PR review aprovado
