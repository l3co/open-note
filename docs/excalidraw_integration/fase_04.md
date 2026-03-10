# Fase 04 — UI: Roteamento, SectionOverview e i18n

## Objetivo

Integrar o `CanvasPage` ao fluxo de navegação existente: rotear corretamente
em `PageView`, expor a criação de páginas canvas na `SectionOverview` e no
menu de contexto, e adicionar todas as strings i18n necessárias.

**Pré-requisito:** Fase 03 concluída (`CanvasPage` componente funcional).

---

## Contexto

### Fluxo atual de `PageView`

```tsx
// src/components/pages/PageView.tsx — comportamento atual
export function PageView({ page }: PageViewProps) {
  if (page.editor_preferences.mode === "pdf_canvas") {
    return <PdfCanvasPage page={page} />;
  }
  return (
    // ... layout padrão com PageEditor ...
  );
}
```

O padrão é um `if` por modo especial antes do fallback para o editor padrão.

### Fluxo atual de criação de página na `SectionOverview`

O componente `SectionOverview.tsx` (arquivo aberto no IDE) possui um botão
"New Page" e "Import PDF". Precisamos adicionar "New Canvas Page".

---

## Tarefas

### 4.1 — Atualizar `PageView.tsx`

**Arquivo:** `src/components/pages/PageView.tsx`

Adicionar o branch para `canvas` antes do branch de `pdf_canvas`:

```tsx
import React, { Suspense } from "react";
import type { Page } from "@/types/bindings/Page";
import { PageEditor } from "@/components/editor/PageEditor";
import { TagEditor } from "@/components/pages/TagEditor";
import { PdfCanvasPage } from "@/components/pdf/PdfCanvasPage";
import { useTranslation } from "react-i18next";

const CanvasPage = React.lazy(() =>
  import("@/components/canvas/CanvasPage").then((m) => ({
    default: m.CanvasPage,
  })),
);

interface PageViewProps {
  page: Page;
}

export function PageView({ page }: PageViewProps) {
  const { t } = useTranslation();

  if (page.editor_preferences.mode === "canvas") {
    return (
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center">
            <span style={{ color: "var(--text-tertiary)" }}>
              {t("common.loading")}
            </span>
          </div>
        }
      >
        <CanvasPage page={page} />
      </Suspense>
    );
  }

  if (page.editor_preferences.mode === "pdf_canvas") {
    return <PdfCanvasPage page={page} />;
  }

  return (
    <div
      className="flex flex-1 flex-col overflow-y-auto"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div className="mx-auto w-10/12 max-w-6xl px-8 py-6">
        <div className="mb-2">
          <TagEditor pageId={page.id} tags={page.tags} />
        </div>
        <div
          className="mb-4 flex items-center gap-4 text-xs"
          style={{ color: "var(--text-tertiary)" }}
        >
          <span>Criado: {new Date(page.created_at).toLocaleDateString()}</span>
          <span>
            Atualizado: {new Date(page.updated_at).toLocaleDateString()}
          </span>
        </div>
        <PageEditor page={page} />
      </div>
    </div>
  );
}
```

> **`React.lazy` + `Suspense`** garante que o bundle do Excalidraw (~1.5MB)
> só é carregado quando o usuário abre uma página canvas pela primeira vez.

---

### 4.2 — Adicionar botão "Nova Página Canvas" na `SectionOverview`

**Arquivo:** `src/components/pages/SectionOverview.tsx`

#### 4.2.1 — Importar o novo IPC e o ícone

No topo do arquivo, adicionar:
```tsx
import { LayoutDashboard } from "lucide-react";
import { createCanvasPage } from "@/lib/ipc";
```

#### 4.2.2 — Adicionar handler de criação

Dentro do componente, adicionar junto com os outros handlers (próximo a onde
`handleImportPdf` é definido):

```tsx
const handleNewCanvasPage = useCallback(async () => {
  if (!section) return;
  try {
    const title = t("canvas.default_title");
    const page = await createCanvasPage(section.id, title);
    navigate to page // usar o mesmo método de navegação que "New Page" usa
  } catch (e) {
    console.error("Failed to create canvas page", e);
  }
}, [section, t]);
```

> Inspecionar como o botão "New Page" existente navega para a nova página —
> usar exatamente o mesmo padrão (provavelmente via `usePageStore` ou evento).

#### 4.2.3 — Adicionar botão na UI

Localizar o grupo de botões de ação na SectionOverview (próximo ao botão
"Import PDF") e adicionar:

```tsx
<button
  type="button"
  onClick={handleNewCanvasPage}
  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-hover)]"
  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
  title={t("canvas.new_page")}
>
  <LayoutDashboard size={16} />
  {t("canvas.new_page")}
</button>
```

---

### 4.3 — Adicionar item no menu de contexto

**Arquivo:** Localizar o arquivo de menu de contexto de páginas.

```bash
grep -rn "import_pdf\|new_page\|context.*menu" src/components/ --include="*.tsx" -l
```

Quando encontrado, adicionar o item "New Canvas Page" junto com "New Page" e
"Import PDF", usando a key i18n `context_menu.new_canvas_page`.

---

### 4.4 — Ícone na sidebar para páginas canvas

**Arquivo:** Localizar onde a sidebar renderiza o ícone de cada página.

```bash
grep -rn "pdf_canvas\|page.*icon\|icon.*page" src/components/ --include="*.tsx" -l
```

Se houver ícones por tipo de página, adicionar o ícone `LayoutDashboard` para
`mode === "canvas"`.

---

### 4.5 — Strings i18n — `en.json`

**Arquivo:** `src/locales/en.json`

Adicionar nova seção `"canvas"` antes de `"section_overview"`:

```json
"canvas": {
  "new_page": "New Canvas Page",
  "default_title": "Untitled Canvas",
  "loading": "Loading canvas...",
  "tool_select": "Select",
  "tool_hand": "Hand (Pan)",
  "tool_rectangle": "Rectangle",
  "tool_ellipse": "Ellipse",
  "tool_diamond": "Diamond",
  "tool_arrow": "Arrow",
  "tool_line": "Line",
  "tool_freedraw": "Pen",
  "tool_text": "Text",
  "tool_image": "Image",
  "tool_eraser": "Eraser",
  "export": "Export as image",
  "export_excalidraw": "Export as .excalidraw"
},
"context_menu": {
  "rename": "Rename",
  "delete": "Delete",
  "move": "Move to...",
  "duplicate": "Duplicate",
  "new_section": "New Section",
  "new_page": "New Page",
  "import_pdf": "Import PDF",
  "new_canvas_page": "New Canvas Page"
}
```

> **Nota:** A chave `context_menu` já existe no arquivo — apenas adicionar
> `"new_canvas_page"` dentro dela, sem duplicar a seção.

---

### 4.6 — Strings i18n — `pt-BR.json`

**Arquivo:** `src/locales/pt-BR.json`

Adicionar as mesmas chaves com tradução em português:

```json
"canvas": {
  "new_page": "Nova Página Canvas",
  "default_title": "Canvas sem título",
  "loading": "Carregando canvas...",
  "tool_select": "Selecionar",
  "tool_hand": "Mão (Panorâmica)",
  "tool_rectangle": "Retângulo",
  "tool_ellipse": "Elipse",
  "tool_diamond": "Losango",
  "tool_arrow": "Seta",
  "tool_line": "Linha",
  "tool_freedraw": "Caneta",
  "tool_text": "Texto",
  "tool_image": "Imagem",
  "tool_eraser": "Borracha",
  "export": "Exportar como imagem",
  "export_excalidraw": "Exportar como .excalidraw"
},
```

E dentro de `context_menu` existente, adicionar:
```json
"new_canvas_page": "Nova Página Canvas"
```

---

### 4.7 — Atualizar `SectionOverview` card de página (opcional)

Se a `SectionOverview` exibe um preview de blocos ou ícone de tipo na listagem,
adicionar representação visual para páginas canvas:

```tsx
// Onde o tipo de página é renderizado
if (pageSummary.mode === "canvas") {
  return <LayoutDashboard size={14} style={{ color: "var(--accent)" }} />;
}
```

> **Verificar primeiro** se `PageSummary` inclui o modo (`mode` não está em
> `PageSummary` atual em `crates/core/src/page.rs`). Se necessário, adicionar
> `mode: EditorMode` ao `PageSummary` em uma sub-tarefa da Fase 01.

---

## Verificação

```bash
# TypeScript sem erros
npx tsc --noEmit

# Lint sem erros
npm run lint

# Build de desenvolvimento
npm run dev
```

**Testes manuais:**
1. Abrir a `SectionOverview` de qualquer seção
2. Clicar em "Nova Página Canvas"
3. Verificar que a página criada abre diretamente no `CanvasPage`
4. Verificar que o tema do Excalidraw muda ao trocar o tema do app
5. Verificar que o loading spinner aparece durante o carregamento do lazy bundle

---

## Critérios de Aceite

- [ ] `PageView` roteia `mode === "canvas"` para `CanvasPage` via `React.lazy`
- [ ] Spinner de loading exibe durante carregamento do bundle Excalidraw
- [ ] Botão "Nova Página Canvas" visível na `SectionOverview`
- [ ] Clicar no botão cria a página e navega para ela automaticamente
- [ ] Todas as chaves `canvas.*` e `context_menu.new_canvas_page` presentes em `en.json` e `pt-BR.json`
- [ ] Nenhuma string visível hardcoded no componente `CanvasPage` ou botões relacionados
- [ ] `npm run lint` sem erros novos
