# Fase 03 — Cards & Overviews

**Esforço estimado:** ~6 horas
**Prioridade:** 🟡 Alta
**Dependências:** Fase 1
**Branch:** `feat/redesign-plataforma-phase-3`

---

## Objetivo

Criar o componente `<InteractiveCard>` reutilizável e redesenhar os cards de Section (NotebookOverview) e de Page (SectionOverview) para ficarem semelhantes ao estilo NotePlus: cards com borda de accent colorida na base, ícone com background tintado, sombra suave ao hover via `.card-interactive` (CSS) e melhor hierarquia tipográfica. Também refinar os headers e empty states.

**Decisões aplicadas:**
- **D2** — Hover/focus via `.card-interactive` CSS class (não inline JS)
- **D4** — Extrair `<InteractiveCard>` em `src/components/ui/` — reutilizável em todas as views

---

## Contexto Atual

### GridCard em NotebookOverview
```tsx
// src/components/pages/NotebookOverview.tsx — linha 192-237
<button
  className="group flex flex-col rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
  style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}
>
  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
       style={{ backgroundColor: `${accentColor}20` }}>
    <FolderOpen size={20} style={{ color: accentColor }} />
  </div>
  <span className="mb-2 line-clamp-2 text-sm leading-snug font-medium">
    {section.name}
  </span>
  <div className="mb-1 flex items-center gap-1 text-[11px]">
    {pageCount} pages
  </div>
  <div className="flex items-center gap-1 text-[11px]">
    <Clock size={10} />
    <span>{formatDate(section.updated_at)}</span>
  </div>
</button>
```
Problema: borda genérica, sem accent colorido na base, `hover:-translate-y-0.5` causa layout shift.

### GridCard em SectionOverview
```tsx
// src/components/pages/SectionOverview.tsx (linhas do GridCard)
// Segue padrão similar ao NotebookOverview.tsx
```

### Header do NotebookOverview
```tsx
// src/components/pages/NotebookOverview.tsx — linha 72-130
<div className="flex items-center justify-between border-b px-6 py-4">
  <div className="flex items-center gap-3">
    <h1 className="text-xl font-semibold">{notebook.name}</h1>
    <span className="rounded-full px-2 py-0.5 text-xs">
      {notebookSections.length}
    </span>
  </div>
  <div className="flex items-center gap-2">
    {/* New section button + layout toggle */}
  </div>
</div>
```

---

## Tarefas

### 3.1 — Criar componente `<InteractiveCard>`

**Arquivo:** `src/components/ui/InteractiveCard.tsx` (NOVO)

Componente reutilizável que encapsula o padrão visual de card interativo:

```tsx
import type { ReactNode, CSSProperties, ButtonHTMLAttributes } from "react";

interface InteractiveCardProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Cor de accent para hover/focus (default: var(--accent)) */
  accentColor?: string;
  /** Barra colorida na base do card */
  accentBar?: boolean;
  /** Conteúdo do card */
  children: ReactNode;
}

export function InteractiveCard({
  accentColor,
  accentBar = false,
  children,
  className = "",
  style,
  ...props
}: InteractiveCardProps) {
  const cardStyle: CSSProperties = {
    ...style,
    ...(accentColor ? { "--card-accent": accentColor } as CSSProperties : {}),
  };

  return (
    <button
      className={`card-interactive relative flex flex-col overflow-hidden text-left ${className}`}
      style={cardStyle}
      {...props}
    >
      {children}

      {accentBar && (
        <div
          className="h-[3px] w-full shrink-0"
          style={{ backgroundColor: accentColor ?? "var(--accent)" }}
        />
      )}
    </button>
  );
}
```

**Critérios:**
- [ ] Usa `.card-interactive` do CSS (Fase 1) — zero inline hover JS
- [ ] `--card-accent` passado via inline style para cor dinâmica
- [ ] `accentBar` opcional renderiza barra colorida de 3px na base
- [ ] Aceita todos os props de `<button>` (`onClick`, `data-testid`, etc.)
- [ ] Exportado em `src/components/ui/index.ts`

---

### 3.2 — Redesenhar GridCard do NotebookOverview

**Arquivo:** `src/components/pages/NotebookOverview.tsx`

Substituir o componente `GridCard` para usar `<InteractiveCard>`:

```tsx
import { InteractiveCard } from "@/components/ui";

function GridCard({ section, pageCount, onClick }: {
  section: Section;
  pageCount: number | undefined;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const accentColor = section.color?.hex ?? "var(--accent)";

  return (
    <InteractiveCard
      onClick={onClick}
      accentColor={accentColor}
      accentBar
    >
      <div className="p-4">
        {/* Ícone com background tintado */}
        <div
          className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${accentColor}18` }}
        >
          <FolderOpen size={18} style={{ color: accentColor }} />
        </div>

        {/* Nome da section */}
        <span
          className="mb-2 block line-clamp-2 text-sm font-semibold leading-snug"
          style={{ color: "var(--text-primary)" }}
        >
          {section.name}
        </span>

        {/* Metadata */}
        <div
          className="flex items-center gap-2 text-[11px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {pageCount !== undefined && (
            <span>{pageCount} {t("notebook_overview.pages", { count: pageCount })}</span>
          )}
          {pageCount !== undefined && <span>·</span>}
          <span>{formatDate(section.updated_at)}</span>
        </div>
      </div>
    </InteractiveCard>
  );
}
```

**Critérios:**
- [ ] Usa `<InteractiveCard>` — sem inline hover JS
- [ ] Borda colorida de 3px na base via `accentBar`
- [ ] Sem layout shift no hover (shadow via CSS)
- [ ] Ícone com background tintado em `${accentColor}18`

---

### 3.3 — Redesenhar ListRow do NotebookOverview

**Arquivo:** `src/components/pages/NotebookOverview.tsx`

Atualizar `ListRow` para usar `<InteractiveCard>`:

```tsx
function ListRow({ section, pageCount, onClick }: {
  section: Section;
  pageCount: number | undefined;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const accentColor = section.color?.hex ?? "var(--accent)";

  return (
    <InteractiveCard
      onClick={onClick}
      accentColor={accentColor}
      className="flex-row items-center gap-3 px-4 py-3"
    >
      {/* Dot de accent colorido */}
      <div
        className="h-8 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: accentColor }}
      />

      {/* Ícone */}
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${accentColor}18` }}
      >
        <FolderOpen size={15} style={{ color: accentColor }} />
      </div>

      {/* Conteúdo */}
      <div className="min-w-0 flex-1">
        <span
          className="block truncate text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {section.name}
        </span>
        <div
          className="mt-0.5 flex items-center gap-2 text-[11px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {pageCount !== undefined && (
            <span>{pageCount} {t("notebook_overview.pages", { count: pageCount })}</span>
          )}
          {pageCount !== undefined && <span>·</span>}
          <span>{formatDate(section.updated_at)}</span>
        </div>
      </div>

      {/* Data de criação */}
      <span className="shrink-0 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
        {formatDateShort(section.created_at)}
      </span>
    </InteractiveCard>
  );
}
```

**Critérios:**
- [ ] Usa `<InteractiveCard>` com `className="flex-row"` para layout horizontal
- [ ] Barra vertical colorida à esquerda (dot de accent)
- [ ] Hover com shadow elevada via CSS

---

### 3.4 — Redesenhar GridCard do SectionOverview (pages)

**Arquivo:** `src/components/pages/SectionOverview.tsx`

Localizar o componente `GridCard` e redesenhá-lo usando `<InteractiveCard>`:

```tsx
<InteractiveCard
  onClick={onClick}
  accentBar
>
  <div className="p-4">
    {/* Ícone por tipo de page */}
    <div
      className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
      style={{ backgroundColor: "var(--accent-subtle)" }}
    >
      {pageIcon}  {/* FileText, LayoutDashboard, FileImage conforme page.mode */}
    </div>

    {/* Título */}
    <span
      className="mb-2 block line-clamp-2 text-sm font-semibold leading-snug"
      style={{ color: "var(--text-primary)" }}
    >
      {page.title || t("section_overview.untitled")}
    </span>

    {/* Metadata */}
    <div className="flex items-center gap-1 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
      <Clock size={10} />
      <span>{formatDate(page.updated_at)}</span>
    </div>
  </div>
</InteractiveCard>
```

**Critérios:**
- [ ] Usa `<InteractiveCard>` — consistente com section cards
- [ ] Ícone varia por `page.mode` (RichText = FileText, Canvas = LayoutDashboard, PdfCanvas = FileImage)
- [ ] Borda accent na base com `var(--accent)` (cor padrão)
- [ ] Tags de page exibidas como badges se existirem

---

### 3.5 — Redesenhar ListRow do SectionOverview

**Arquivo:** `src/components/pages/SectionOverview.tsx`

Seguir o padrão do 3.3 usando `<InteractiveCard>`:

```tsx
<InteractiveCard
  onClick={onClick}
  className="flex-row items-center gap-3 px-4 py-3"
>
  {/* Dot de accent */}
  <div className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: "var(--accent)" }} />

  {/* Ícone por tipo */}
  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
       style={{ backgroundColor: "var(--accent-subtle)" }}>
    {pageIcon}
  </div>

  {/* Conteúdo */}
  <div className="min-w-0 flex-1">
    <span className="block truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
      {page.title || t("section_overview.untitled")}
    </span>
    <div className="mt-0.5 flex items-center gap-2 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
      {tags e metadata}
    </div>
  </div>
</InteractiveCard>
```

**Critérios:**
- [ ] Usa `<InteractiveCard>` — consistência visual com ListRow de sections
- [ ] Tipo de página visível pelo ícone

---

### 3.6 — Redesenhar headers de NotebookOverview e SectionOverview

**Arquivos:** `NotebookOverview.tsx`, `SectionOverview.tsx`

Ajustes no header das views:

```tsx
{/* Header renovado */}
<div
  className="flex items-center justify-between px-6 py-5 border-b"
  style={{ borderColor: "var(--border)" }}
>
  <div className="flex items-center gap-3">
    {/* Ícone da entidade */}
    <div
      className="flex h-9 w-9 items-center justify-center rounded-xl"
      style={{ backgroundColor: "var(--accent-subtle)" }}
    >
      <FolderOpen size={18} style={{ color: "var(--accent)" }} />
    </div>

    <div>
      <h1
        className="text-lg font-bold leading-tight"
        style={{ color: "var(--text-primary)" }}
      >
        {notebook.name}
      </h1>
      <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
        {notebookSections.length} {t("notebook_overview.sections_count", { count: notebookSections.length })}
      </p>
    </div>
  </div>

  {/* Ações: botão CTA + toggle de layout */}
  <div className="flex items-center gap-2"> ... </div>
</div>
```

Adicionar chave i18n `notebook_overview.sections_count` e `section_overview.pages_count`.

**Critérios:**
- [ ] Header com ícone, título e subtítulo com contagem
- [ ] Layout mais vertical (ícone + título + subtítulo)
- [ ] Padding `py-5` (de `py-4`)

---

### 3.7 — Redesenhar EmptyState das overviews

**Arquivos:** `NotebookOverview.tsx`, `SectionOverview.tsx`

Melhorar o estado vazio:

```tsx
function EmptyState({ onNew, label, description, icon, ctaLabel }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div
        className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl"
        style={{ backgroundColor: "var(--bg-tertiary)" }}
      >
        {icon}
      </div>
      <p className="mb-2 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
        {label}
      </p>
      <p className="mb-6 max-w-[240px] text-sm leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
        {description}
      </p>
      <button
        onClick={onNew}
        className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
        style={{ backgroundColor: "var(--accent)", color: "#ffffff" }}
      >
        {ctaLabel}
      </button>
    </div>
  );
}
```

**Critérios:**
- [ ] Ícone maior (h-20 w-20)
- [ ] CTA com `rounded-xl` e font-semibold
- [ ] Descrição com `max-w-[240px]` para boa quebra de linha

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `src/components/ui/InteractiveCard.tsx` | **NOVO** — componente reutilizável de card interativo |
| `src/components/ui/index.ts` | Alteração — export do InteractiveCard |
| `src/components/pages/NotebookOverview.tsx` | Alteração — GridCard, ListRow, Header, EmptyState |
| `src/components/pages/SectionOverview.tsx` | Alteração — GridCard, ListRow, Header, EmptyState |
| `src/locales/en.json` | Alteração — chaves de contagem i18n |
| `src/locales/pt-BR.json` | Alteração — chaves de contagem i18n |

## Arquivos NÃO Modificados (ainda)

- `src/components/sidebar/` — Já feito na Fase 2
- `src/components/pages/HomePage.tsx` — Fase 4
- `src/components/layout/Toolbar.tsx` — Fase 5

---

## Critérios de Aceitação da Fase

- [ ] `cargo test --workspace` passa
- [ ] `npm run typecheck` sem erros
- [ ] `<InteractiveCard>` criado e exportado em `src/components/ui/`
- [ ] Cards com borda de accent na base visível
- [ ] Hover/focus via `.card-interactive` CSS (zero inline JS)
- [ ] EmptyState com CTA visível e estilizado
- [ ] Temas dark/paper sem perda de contraste nos cards
- [ ] Testes unitários para `<InteractiveCard>`
- [ ] Snapshots atualizados onde necessário
- [ ] PR review aprovado
