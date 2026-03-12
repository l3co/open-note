# Redesign da Plataforma — Roadmap

## Visão Geral

Redesign visual completo do Open Note, com uma **Fase 0 funcional** de preparação backend. A referência é o **NotePlus** — um app de notas com sidebar limpa, cards coloridos, hierarquia visual clara e um CTA de criação proeminente.

O objetivo é elevar a qualidade percebida da interface: melhor hierarquia visual, tipografia system-ui refinada, cards mais ricos, sidebar mais expressiva, HomePage com feed temporal + discovery, e consistência de espaçamento/raio de borda em toda a aplicação.

**Princípios guia:**

1. **Local-first** — Zero dependência de rede para UI (sem Google Fonts, sem CDN)
2. **Visual-only nas Fases 1–5** — Sem novas stores, sem novos tipos. Apenas `.tsx`, `.css` e tokens
3. **Fase 0 é a exceção controlada** — Backend prep para Quick Notes, preview de conteúdo e random pages
4. **CSS-first para interatividade** — Hover/focus via classes CSS utilitárias, não inline JS
5. **Componentes reutilizáveis** — `<InteractiveCard>` compartilhado entre todas as views de cards

---

## Decision Log

| # | Decisão | Escolha | Alternativas Consideradas |
|---|---------|---------|--------------------------|
| D1 | Tipografia | **System Font Stack** (`system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`) | Google Fonts CDN (rejeitado: exige rede), Inter bundled woff2 (rejeitado: peso extra, renderização não-nativa) |
| D2 | Hover/Focus dos cards | **Classe CSS utilitária** (`.card-interactive` em `interactive.css`) | Inline `onMouseEnter`/`onMouseLeave` (rejeitado: não cobre `:focus-visible`, verboso), Hook `useHoverStyle()` (rejeitado: ainda JS-based) |
| D3 | CTA "New Page" sem section | **Criar no Quick Notes** (notebook/section automático) | Abrir dialog de seleção, desabilitar botão, navegar para notebook mais recente |
| D4 | Componente Card | **Extrair `<InteractiveCard>`** em `src/components/ui/` | Manter cards inline por view (rejeitado: duplicação em 4+ componentes) |
| D5 | Calendar na sidebar | **Manter desabilitado** (sinaliza feature futura) | Remover completamente, mover para Settings |
| D6 | Quick Notes no planejamento | **Fase 0 separada** (pré-requisito backend) | Embutir na Fase 2 (rejeitado: quebra princípio visual-only), adiar (rejeitado: CTA fica sem função) |
| D7 | HomePage | **Feed temporal (Evernote) + Random Note Spotlight (Obsidian)** | Dashboard Notion-style, Linear-style com métricas |
| D8 | Cards de recent pages | **Contexto completo** (título + ícone tipo + notebook › section + data + preview 1 linha) | Simples com caminho, contexto + badge de ação |
| D9 | Discovery | **Random Note Spotlight** (1-3 notas antigas aleatórias) | Tags Cloud, Estatísticas + Random, adiar |
| D10 | Preview + Random backend | **Tudo na Fase 0** (junto com Quick Notes) | Embutir na Fase 4, adiar |

---

## Estado Atual

### Arquitetura de UI Existente

```
App.tsx
├── Sidebar (src/components/sidebar/)
│   ├── WorkspaceSwitcher.tsx    ← dropdown simples, sem logo
│   ├── SidebarQuickNav.tsx      ← Search/Home/Calendar(disabled)/Tags como icon buttons
│   ├── NotebookTree.tsx         ← tree com DnD
│   └── SidebarFooter.tsx        ← strip de ícones (Plus, Search, Trash, Settings, LogOut, FolderSync)
│
├── Toolbar (src/components/layout/Toolbar.tsx)
│   └── Breadcrumb.tsx           ← path de navegação
│
└── ContentArea (src/components/layout/ContentArea.tsx)
    ├── HomePage.tsx             ← greeting + recent pages grid + quick actions
    ├── NotebookOverview.tsx     ← grid/list de sections com GridCard/ListRow
    ├── SectionOverview.tsx      ← grid/list de pages com cards
    ├── PageView.tsx             ← editor TipTap
    └── TagsPage.tsx             ← listagem de tags
```

### Design System Atual

| Token | Valor (light) |
|-------|--------------|
| `--bg-primary` | `#ffffff` |
| `--bg-secondary` | `#f8f9fa` |
| `--bg-sidebar` | `#f6f6f7` |
| `--border` | `#e5e7eb` |
| `--text-primary` | `#1a1a1a` |
| `--text-secondary` | `#6b7280` |
| `--accent` | `#3b82f6` |
| Font | `-apple-system, BlinkMacSystemFont, "Segoe UI"...` (sistema genérico) |
| Border radius | Inconsistente: `rounded-md`, `rounded-lg`, `rounded-xl` misturados |
| Shadows | Apenas `--shadow` e `--shadow-lg`. Sem escala card/dropdown/modal |

### Pontos de Acoplamento Identificados

| Camada | Arquivo | Acoplamento |
|--------|---------|-------------|
| CSS | `src/styles/globals.css` | Todas as variáveis de tema, estilos de editor |
| CSS | `src/styles/interactive.css` | Padrões de hover/focus existentes |
| Sidebar | `src/components/sidebar/WorkspaceSwitcher.tsx` | Dropdown do workspace |
| Sidebar | `src/components/sidebar/SidebarQuickNav.tsx` | Itens de navegação rápida |
| Sidebar | `src/components/sidebar/SidebarFooter.tsx` | Ações de criação e configurações |
| Home | `src/components/pages/HomePage.tsx` | Cards de recent pages + quick actions |
| Overview | `src/components/pages/NotebookOverview.tsx` | GridCard e ListRow de sections |
| Overview | `src/components/pages/SectionOverview.tsx` | GridCard e ListRow de pages |
| Toolbar | `src/components/layout/Toolbar.tsx` | Barra superior de navegação |
| Breadcrumb | `src/components/layout/Breadcrumb.tsx` | Caminho de navegação |
| UI | `src/components/ui/Button.tsx` | Componente de botão base |

---

## Avaliação de Complexidade

### Classificação: 🟡 MÉDIA-ALTA (Score: 5/10)

**Justificativa:**

| Fator | Impacto | Nota |
|-------|---------|------|
| Fase 0 toca backend (core + storage + IPC) | Risco moderado de regressão | 3/5 |
| CSS variables já abstraídas | Mudança de tokens é segura | 1/5 |
| Testes existentes verificam comportamento, não visual | Baixo risco de quebrar testes | 2/5 |
| Múltiplos componentes tocados (~15) | Esforço distribuído | 3/5 |
| Novo componente `<InteractiveCard>` | Abstração compartilhada, risco de over-engineering | 2/5 |

**Estimativa de esforço total: ~32 horas de desenvolvimento**

| Fase | Esforço |
|------|---------|
| Fase 0 — Backend prep | ~4h |
| Fase 1 — Tokens & Tipografia | ~2h |
| Fase 2 — Sidebar Redesign | ~6h |
| Fase 3 — Cards & Overviews | ~6h |
| Fase 4 — HomePage Redesign | ~6h |
| Fase 5 — Toolbar, Breadcrumb & Polish | ~5h |
| Buffer (temas dark/paper, edge cases) | ~3h |

### Riscos Principais

1. **Tailwind purge** — classes novas adicionadas dinamicamente devem ser referenciadas estaticamente para não serem removidas no build
2. **Temas dark/paper** — cada mudança de token light deve ser espelhada nos 3 temas para não quebrar contraste
3. **Testes de snapshot** — se existirem snapshots de HTML, podem falhar com mudanças de className. Atualizar snapshots no critério de aceitação de cada fase.
4. **Quick Notes (Fase 0)** — lógica de auto-criação de notebook/section deve ter fallback seguro se o workspace não tiver notebooks

---

## Estratégia de Implementação

### Princípio: Backend-First, then Visual Bottom-Up

1. **Fase 0** — Preparar o backend: Quick Notes, preview no `PageSummary`, IPC `get_random_pages`
2. **Fases 1–5** — Visual-only, bottom-up: tokens → sidebar → cards → home → polish

Cada fase pode ser mergeada em `main` de forma independente.

### Fases

| Fase | Nome | Esforço | Prioridade | Dependências |
|------|------|---------|------------|--------------|
| **0** | **Backend Prep** — Quick Notes + PageSummary preview + get_random_pages | ~4h | 🔴 Crítica | — |
| 1 | **Tokens & Tipografia** — System font stack + escala de radius/shadow | ~2h | 🔴 Crítica | — |
| 2 | **Sidebar Redesign** — Logo, Search input, CTA "New Page" (Quick Notes), nav items | ~6h | 🔴 Crítica | Fases 0, 1 |
| 3 | **Cards & Overviews** — `<InteractiveCard>` + `.card-interactive` + section/page cards | ~6h | 🟡 Alta | Fase 1 |
| 4 | **HomePage Redesign** — Feed temporal + Random Note Spotlight + preview de conteúdo | ~6h | 🟡 Alta | Fases 0, 1, 3 |
| 5 | **Toolbar, Breadcrumb & Polish Global** — Refinamento final de toda a UI | ~5h | 🟢 Média | Fases 1–4 |

---

## Modelo de Domínio Proposto

### Antes — Sidebar
```
[FolderOpen icon] workspace-name [ChevronDown]
─────────────────────────────────────────────
[Search]  Search            (button icon)
[Home]    Home
[Calendar] Calendar         (disabled)
[Tag]     Tags
─────────────────────────────────────────────
NOTEBOOKS
  ▶ My Notebook
─────────────────────────────────────────────
[+] [Search] [Trash] [Settings] | [LogOut] [FolderSync]
```

### Depois — Sidebar (inspirado no NotePlus)
```
┌──────────────────────────────────────────┐
│  [Logo]  Open Note                       │
├──────────────────────────────────────────┤
│  [Avatar]  workspace-name  [ChevronDown] │
├──────────────────────────────────────────┤
│  🔍  Search...              ⌘K  (input)  │
├──────────────────────────────────────────┤
│  [+  New Page               ⌘N] (CTA)   │
├──────────────────────────────────────────┤
│  [Home]      Your Notes                  │
│  [Calendar]  Calendar        (disabled)  │
│  [Tag]       Tags                        │
│  [Trash]     Trash                       │
├──────────────────────────────────────────┤
│  NOTEBOOKS                               │
│    ▶ [Folder] My Notebook                │
├──────────────────────────────────────────┤
│  [Settings]  [FolderSync]   (footer)     │
└──────────────────────────────────────────┘
```

### Antes — HomePage
```
[Logo] Good morning!
─────────────────────────────────────
RECENT PAGES (grid 3 cols)
┌──────┐ ┌──────┐ ┌──────┐
│[File]│ │[File]│ │[File]│
│Title │ │Title │ │Title │
└──────┘ └──────┘ └──────┘

QUICK ACTIONS (grid 2 cols)
┌──────────────┐ ┌──────────────┐
│ [+] New Page │ │ [📖] Notebook│
│         ⌘N   │ │        ⌘⇧N   │
└──────────────┘ └──────────────┘
```

### Depois — HomePage (Evernote + Obsidian)
```
Wednesday, March 12
Good morning!
─────────────────────────────────────
RECENT PAGES (grid 2/3 cols, feed temporal)
┌────────────────────┐ ┌────────────────────┐
│ [icon bg-tinted]   │ │ [icon bg-tinted]   │
│ Page Title         │ │ Page Title         │
│ "First line of..." │ │ "First line of..." │
│ Notebook › Section │ │ Notebook › Section │
├════════════════════╡ ├════════════════════╡
└ accent bar ────────┘ └ accent bar ────────┘

REDISCOVER (Random Note Spotlight)
┌──────────────────────────────────────────┐
│ 💡 [icon] "Old Note Title"              │
│    "Preview of content..."               │
│    Notebook › Section · 3 months ago     │
└──────────────────────────────────────────┘

QUICK ACTIONS (grid 2 cols, tiles coloridos)
┌──────────────┐ ┌──────────────┐
│ [+ blue bg]  │ │ [📖 purple]  │
│ New Page     │ │ New Notebook  │
│ ⌘N           │ │ ⌘⇧N          │
└──────────────┘ └──────────────┘
```

### Antes — SectionOverview GridCard
```
┌─────────────────┐
│ [FolderOpen]    │
│ Section Name    │
│ 5 pages         │
│ 2d atrás        │
└─────────────────┘
```

### Depois — SectionOverview GridCard (com accent via `<InteractiveCard>`)
```
┌─────────────────┐
│ [icon bg-tinted]│  ← .card-interactive class
│ Section Name    │  ← :hover → shadow-card-hover + border accent
│ 5 pages · 2d   │  ← :focus-visible → outline accent
│                 │
├════════════════╡  ← borda inferior colorida (section.color)
```

---

## Novos Artefatos Criados

### Fase 0 (Backend)

| Artefato | Camada | Descrição |
|----------|--------|-----------|
| `PageSummary.preview` | `crates/core` | Campo `Option<String>` — primeiros ~80 chars do primeiro TextBlock |
| `get_random_pages` IPC | `src-tauri/commands` | Retorna N `PageSummary` aleatórios não visitados recentemente |
| Quick Notes logic | `crates/core` + `crates/storage` | Auto-criação de notebook/section "Quick Notes" |

### Fase 1 (CSS)

| Artefato | Camada | Descrição |
|----------|--------|-----------|
| `.card-interactive` | `src/styles/interactive.css` | Classe CSS com `:hover` e `:focus-visible` para cards. Usa `--card-accent` para cor dinâmica |
| Tokens `--radius-*` | `src/styles/globals.css` | Escala de border-radius: sm/md/lg/xl/full |
| Tokens `--shadow-card*` | `src/styles/globals.css` | Sombras para card, card-hover, dropdown, modal — em **3 temas** (light/dark/paper) |

### Fase 3 (Componente)

| Artefato | Camada | Descrição |
|----------|--------|-----------|
| `<InteractiveCard>` | `src/components/ui/InteractiveCard.tsx` | Componente reutilizável: border, shadow, hover via `.card-interactive`, accent bar opcional |

---

## Critérios de Aceitação (Definição de Done)

- [ ] System font stack aplicado em toda a aplicação (zero dependência de rede)
- [ ] Quick Notes funcional: CTA "New Page" cria página automaticamente
- [ ] `PageSummary` inclui preview de conteúdo (~80 chars)
- [ ] IPC `get_random_pages` retorna notas aleatórias para discovery
- [ ] Sidebar tem logo, search input, CTA button e nav items com hover/focus states via CSS
- [ ] Cards de section e page usam `<InteractiveCard>` com borda colorida e `.card-interactive`
- [ ] HomePage com feed temporal (recent pages com contexto completo) + Random Note Spotlight
- [ ] Quick actions como tiles com cores individuais por ação
- [ ] Toolbar visualmente alinhada com o novo design system
- [ ] Temas light, dark e paper funcionando sem perda de contraste
- [ ] Todos os testes existentes passando (`npm run test`, `cargo test --workspace`)
- [ ] `npm run typecheck` sem erros
- [ ] `cargo clippy --workspace -- -D warnings` sem warnings
- [ ] Snapshots atualizados onde necessário

---

## Referências

- `docs/ARCHITECTURE.md`
- `src/styles/globals.css` — tokens de tema (3 temas: light, dark, paper)
- `src/styles/interactive.css` — padrões de hover/focus existentes
- `src/components/sidebar/` — sidebar atual
- `src/components/pages/` — views atuais
- `crates/core/src/page.rs` — `Page`, `PageSummary`, `EditorMode`
- Referência visual: **NotePlus** (imagens fornecidas pelo usuário)
- Referência UX: **Evernote** (feed temporal) + **Obsidian** (random note discovery)
