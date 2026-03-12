# Fase 04 — HomePage Redesign

**Esforço estimado:** ~6 horas
**Prioridade:** 🟡 Alta
**Dependências:** Fases 0, 1, 3
**Branch:** `feat/redesign-plataforma-phase-4`

---

## Objetivo

Redesenhar a HomePage com modelo **Evernote + Obsidian**: feed temporal de recent pages com contexto completo (título + ícone tipo + notebook › section + data relativa + preview de conteúdo), seção de **Random Note Spotlight** para redescoberta, quick actions como tiles coloridos, e área de boas-vindas com data. Consome `<InteractiveCard>` (Fase 3), `PageSummary.preview` e `getRandomPages` (Fase 0).

**Decisões aplicadas:**
- **D7** — Feed temporal (Evernote) + Random Note Spotlight (Obsidian)
- **D8** — Cards com contexto completo (título + tipo + caminho + data + preview 1 linha)
- **D9** — Random Note Spotlight (1-3 notas aleatórias antigas)
- **D4** — Usa `<InteractiveCard>` para cards de recent pages e spotlight

---

## Contexto Atual

### Área de boas-vindas
```tsx
// src/components/pages/HomePage.tsx — linha 115-124
<div className="mb-10 flex items-center gap-4">
  <img src={logoSrc} alt="Open Note" className="h-10 w-10" />
  <h1 className="text-3xl font-bold tracking-tight">
    {t(getGreetingKey())}
  </h1>
</div>
```
Problema: logo + título horizontal parece deslocado. Não exibe data.

### Recent pages — grid de 3 colunas
```tsx
// src/components/pages/HomePage.tsx — linha 137-157
<div className="grid grid-cols-3 gap-3">
  {recentPages.map((page) => (
    <button className="group flex flex-col items-start rounded-xl border ...">
      <FileText size={18} className="mb-2" />
      <span className="w-full truncate text-sm font-medium">{page.title}</span>
    </button>
  ))}
</div>
```
Problema: cards minimalistas demais — apenas ícone + título. Sem contexto (notebook/section), sem tipo visual, sem preview, sem data relativa.

### Dados disponíveis após Fase 0
- `PageSummary` agora inclui `preview: Option<String>` (~80 chars do primeiro text block)
- `PageSummary` já tem `mode: EditorMode`, `updated_at`, `tags`
- IPC `getRandomPages(count, excludeIds)` retorna summaries aleatórios
- Frontend `pages: Map<string, PageSummary[]>` já está preenchido por section

### Sem seção de discovery
A HomePage atual não tem nenhum mecanismo de redescoberta de notas antigas.

---

## Tarefas

### 4.1 — Redesenhar área de boas-vindas

**Arquivo:** `src/components/pages/HomePage.tsx`

```tsx
<div className="mb-8">
  <p
    className="text-[13px] font-medium mb-1"
    style={{ color: "var(--text-tertiary)" }}
  >
    {new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    })}
  </p>
  <h1
    className="text-2xl font-bold tracking-tight"
    style={{ color: "var(--text-primary)" }}
  >
    {t(getGreetingKey())}
  </h1>
</div>
```

Remover o logo da HomePage (já aparece na sidebar). Exibir data atual como subtítulo.

**Critérios:**
- [ ] Logo removido do conteúdo principal (já está na sidebar)
- [ ] Data atual formatada com locale do usuário (weekday + month + day)
- [ ] Título menor (text-2xl em vez de text-3xl)

---

### 4.2 — Redesenhar cards de Recent Pages com contexto completo

**Arquivo:** `src/components/pages/HomePage.tsx`

Os cards agora mostram: ícone por tipo, título, **preview de conteúdo**, caminho notebook › section, e data relativa. Usar `<InteractiveCard>` e dados do `PageSummary`.

#### Tipo enriquecido

```tsx
type RecentPageWithContext = {
  id: string;
  title: string;
  preview?: string | null;   // NEW — da Fase 0
  mode: string;               // "rich_text" | "canvas" | "pdf_canvas" | "markdown"
  sectionName?: string;
  notebookName?: string;
  updatedAt: string;
};
```

#### Resolver contexto

```tsx
const { notebooks, sections } = useWorkspaceStore();

const recentPagesWithContext: RecentPageWithContext[] = recentPageIds
  .map((id) => {
    for (const [notebookId, sectionList] of sections) {
      for (const section of sectionList) {
        const sectionPages = pages.get(section.id) ?? [];
        const found = sectionPages.find((p) => p.id === id);
        if (found) {
          const notebook = notebooks.find((n) => n.id === notebookId);
          return {
            id: found.id,
            title: found.title,
            preview: found.preview,
            mode: found.mode,
            sectionName: section.name,
            notebookName: notebook?.name,
            updatedAt: found.updated_at,
          };
        }
      }
    }
    return null;
  })
  .filter(Boolean) as RecentPageWithContext[];
```

#### Função de ícone por tipo

```tsx
function getPageIcon(mode: string) {
  switch (mode) {
    case "canvas": return LayoutDashboard;
    case "pdf_canvas": return FileImage;
    case "markdown": return Code;
    default: return FileText;
  }
}
```

#### Card com `<InteractiveCard>`

```tsx
import { InteractiveCard } from "@/components/ui";

<div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
  {recentPagesWithContext.map((page) => {
    const PageIcon = getPageIcon(page.mode);
    return (
      <InteractiveCard
        key={page.id}
        onClick={() => handlePageClick(page.id)}
        accentBar
      >
        <div className="p-4 flex-1">
          {/* Ícone com bg tintado */}
          <div
            className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ backgroundColor: "var(--accent-subtle)" }}
          >
            <PageIcon size={16} style={{ color: "var(--accent)" }} />
          </div>

          {/* Título */}
          <span
            className="mb-1 block line-clamp-2 text-sm font-semibold leading-snug"
            style={{ color: "var(--text-primary)" }}
          >
            {page.title || t("page.untitled")}
          </span>

          {/* Preview de conteúdo (D8) */}
          {page.preview && (
            <p
              className="mb-2 line-clamp-1 text-[12px] leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              {page.preview}
            </p>
          )}

          {/* Contexto: notebook › section + data relativa */}
          <div
            className="flex items-center gap-1 text-[11px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            {(page.notebookName || page.sectionName) && (
              <>
                <span className="truncate max-w-[140px]">
                  {[page.notebookName, page.sectionName].filter(Boolean).join(" › ")}
                </span>
                <span>·</span>
              </>
            )}
            <span>{formatRelativeDate(page.updatedAt)}</span>
          </div>
        </div>
      </InteractiveCard>
    );
  })}
</div>
```

#### Função `formatRelativeDate`

Adicionar helper em `src/lib/utils.ts` (ou inline):

```tsx
function formatRelativeDate(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("time.just_now");
  if (mins < 60) return t("time.minutes_ago", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("time.hours_ago", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t("time.days_ago", { count: days });
  const months = Math.floor(days / 30);
  return t("time.months_ago", { count: months });
}
```

**Chaves i18n:** `time.just_now`, `time.minutes_ago`, `time.hours_ago`, `time.days_ago`, `time.months_ago`

**Critérios:**
- [ ] Cards usam `<InteractiveCard>` (D4) — zero inline hover JS
- [ ] Preview de 1 linha visível nos cards (D8)
- [ ] Ícone varia por `page.mode`
- [ ] Contexto notebook › section exibido
- [ ] Data relativa ("2h atrás", "3 dias atrás")
- [ ] Borda accent na base (consistente com Fase 3)
- [ ] Grid 2 colunas default, 3 em lg:

---

### 4.3 — Adicionar seção Random Note Spotlight (discovery)

**Arquivo:** `src/components/pages/HomePage.tsx`

Nova seção entre "Recent Pages" e "Quick Actions". Consome `ipc.getRandomPages()` da Fase 0.

#### Carregar random pages

```tsx
import * as ipc from "@/lib/ipc";

const [spotlightPages, setSpotlightPages] = useState<PageSummary[]>([]);

useEffect(() => {
  const excludeIds = recentPageIds;
  ipc.getRandomPages(3, excludeIds)
    .then(setSpotlightPages)
    .catch(() => setSpotlightPages([]));
}, [recentPageIds.length]);  // recarrega quando history muda
```

#### Renderizar seção

```tsx
{spotlightPages.length > 0 && (
  <section className="mb-8">
    <div className="mb-3 flex items-center gap-2">
      <Lightbulb size={13} style={{ color: "var(--text-tertiary)" }} />
      <h2
        className="text-[11px] font-semibold tracking-widest uppercase"
        style={{ color: "var(--text-tertiary)" }}
      >
        {t("home.rediscover")}
      </h2>
    </div>

    <div className="space-y-2">
      {spotlightPages.map((page) => {
        const PageIcon = getPageIcon(page.mode);
        return (
          <InteractiveCard
            key={page.id}
            onClick={() => handlePageClick(page.id)}
            className="flex-row items-center gap-3 px-4 py-3"
          >
            {/* Ícone */}
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: "var(--accent-subtle)" }}
            >
              <PageIcon size={16} style={{ color: "var(--accent)" }} />
            </div>

            {/* Conteúdo */}
            <div className="min-w-0 flex-1">
              <span
                className="block truncate text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {page.title}
              </span>
              {page.preview && (
                <p
                  className="truncate text-[12px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {page.preview}
                </p>
              )}
              <span
                className="text-[11px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                {formatRelativeDate(page.updated_at)}
              </span>
            </div>
          </InteractiveCard>
        );
      })}
    </div>
  </section>
)}
```

**Chaves i18n:** `home.rediscover` — EN: `"Rediscover"`, PT-BR: `"Redescobrir"`

**Critérios:**
- [ ] Seção aparece apenas se houver notas aleatórias disponíveis
- [ ] Cards em layout horizontal (list-style) — diferenciação visual das recent pages (grid)
- [ ] Preview de conteúdo visível
- [ ] Exclui páginas que já estão nos recentes
- [ ] Exclui páginas protegidas (lógica no backend, Fase 0)
- [ ] Ícone `Lightbulb` para label da seção

---

### 4.4 — Redesenhar Quick Actions como tiles coloridos

**Arquivo:** `src/components/pages/HomePage.tsx`

Substituir os `<Button>` por tiles com `<InteractiveCard>` e cores individuais por ação:

```tsx
<div className="grid grid-cols-2 gap-3">
  {[
    {
      icon: <Plus size={20} />,
      label: t("home.action_new_page"),
      shortcut: "⌘N",
      onClick: handleNewPage,
      color: "var(--accent)",
    },
    {
      icon: <BookOpen size={20} />,
      label: t("home.action_new_notebook"),
      shortcut: "⌘⇧N",
      onClick: handleNewNotebook,
      color: "#8b5cf6",
    },
    {
      icon: <Search size={20} />,
      label: t("home.action_search"),
      shortcut: "⌘K",
      onClick: openQuickOpen,
      color: "#f97316",
    },
    {
      icon: <Settings size={20} />,
      label: t("home.action_settings"),
      shortcut: "⌘,",
      onClick: openSettings,
      color: "#14b8a6",
    },
  ].map((action) => (
    <InteractiveCard
      key={action.label}
      onClick={action.onClick}
      accentColor={action.color}
    >
      <div className="p-4">
        {/* Ícone com bg colorido */}
        <div
          className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${action.color}18` }}
        >
          <span style={{ color: action.color }}>{action.icon}</span>
        </div>

        <span
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {action.label}
        </span>

        <span
          className="mt-1 block text-[11px] font-mono"
          style={{ color: "var(--text-tertiary)" }}
        >
          {action.shortcut}
        </span>
      </div>
    </InteractiveCard>
  ))}
</div>
```

**Critérios:**
- [ ] 4 tiles com `<InteractiveCard>` e `accentColor` individual
- [ ] Hover com border colorida dinâmica via `--card-accent` (CSS-only)
- [ ] Ícone com background colorido em `${color}18` (10% opacity)
- [ ] Shortcut em fonte mono
- [ ] Lógica de `handleNewPage` usa `ensureQuickNotes()` (D3, já implementado na Fase 2)

---

### 4.5 — Ajustar layout geral da HomePage

**Arquivo:** `src/components/pages/HomePage.tsx`

```tsx
<div className="relative z-10 mx-auto w-full max-w-3xl px-8 py-10">
  {/* 4.1 — Boas-vindas */}
  {/* 4.2 — Recent Pages (feed temporal) */}
  {/* 4.3 — Random Note Spotlight (discovery) */}
  {/* 4.4 — Quick Actions (tiles) */}
</div>
```

**Critérios:**
- [ ] `max-w-3xl` (de `max-w-2xl`) para acomodar grid 2/3 colunas
- [ ] `py-10` (de `py-12`) — mais compacto
- [ ] Ordem: boas-vindas → recentes → redescobrir → ações rápidas

---

### 4.6 — Melhorar modal inline de novo notebook

**Arquivo:** `src/components/pages/HomePage.tsx`

Apenas ajustes visuais no modal existente:

```tsx
<div
  className="w-[360px] rounded-2xl border p-6"
  style={{
    backgroundColor: "var(--bg-primary)",
    borderColor: "var(--border)",
    boxShadow: "var(--shadow-modal)",  // novo token da Fase 1
  }}
>
  {/* ... conteúdo existente preservado ... */}
</div>
```

**Critérios:**
- [ ] `rounded-2xl` no modal container
- [ ] `--shadow-modal` token aplicado
- [ ] Botão confirmar com `rounded-xl`

---

### 4.7 — Melhorar Empty State de recent pages

**Arquivo:** `src/components/pages/HomePage.tsx`

Redesenhar o estado vazio quando não há recent pages:

```tsx
<div
  className="flex flex-col items-center rounded-xl border py-10 text-center"
  style={{
    borderColor: "var(--border)",
    backgroundColor: "var(--bg-secondary)",
  }}
>
  <div
    className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
    style={{ backgroundColor: "var(--accent-subtle)" }}
  >
    <FileText size={24} style={{ color: "var(--accent)" }} className="opacity-50" />
  </div>
  <p
    className="mb-1 text-sm font-medium"
    style={{ color: "var(--text-secondary)" }}
  >
    {t("home.no_recent")}
  </p>
  <p
    className="max-w-[220px] text-[12px]"
    style={{ color: "var(--text-tertiary)" }}
  >
    {t("home.no_recent_description")}
  </p>
</div>
```

**Chaves i18n:** `home.no_recent_description` — EN: `"Pages you open will appear here"`, PT-BR: `"As páginas que você abrir aparecerão aqui"`

**Critérios:**
- [ ] Ícone maior com background tintado
- [ ] Descrição explicativa abaixo do título
- [ ] Consistente com EmptyState da Fase 3

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `src/components/pages/HomePage.tsx` | Alteração — boas-vindas, recent cards, spotlight, quick actions, modal, empty state |
| `src/lib/utils.ts` | Alteração — `formatRelativeDate()` helper |
| `src/locales/en.json` | Alteração — chaves `time.*`, `home.rediscover`, `home.no_recent_description` |
| `src/locales/pt-BR.json` | Alteração — mesmas chaves |

## Arquivos NÃO Modificados (ainda)

- `src/components/layout/Toolbar.tsx` — Fase 5
- `src/components/layout/Breadcrumb.tsx` — Fase 5
- `src/components/ui/Button.tsx` — Não usado (tiles usam `<InteractiveCard>`)
- `crates/` — Sem mudanças (Fase 0 já entregue)

---

## Critérios de Aceitação da Fase

- [ ] `cargo test --workspace` passa
- [ ] `npm run typecheck` sem erros
- [ ] Cards de recent pages com contexto completo: título + tipo + preview + caminho + data relativa
- [ ] Random Note Spotlight visível com 1-3 notas antigas
- [ ] Quick action tiles com `<InteractiveCard>` e cores individuais
- [ ] Hover/focus via CSS (zero inline JS)
- [ ] Empty state redesenhado com descrição
- [ ] Modal usa `--shadow-modal`
- [ ] Temas dark/paper sem perda de contraste
- [ ] Snapshots atualizados onde necessário
- [ ] PR review aprovado
