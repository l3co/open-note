# Fase 06 — Frontend: Roteamento + Context Menu

## Objetivo

1. Atualizar `PageView` para renderizar `PdfCanvasPage` quando o modo for `pdf_canvas`
2. Adicionar a opção "Importar PDF" no context menu de seção
3. Adicionar strings i18n necessárias

## Arquivos modificados

- `src/components/pages/PageView.tsx`
- `src/components/shared/ContextMenu.tsx`
- `src/locales/pt-BR.json`
- `src/locales/en.json`

---

## Mudanças detalhadas

### 1. Roteamento em `PageView.tsx`

`PageView` é o ponto de entrada para qualquer página aberta. Atualmente renderiza sempre o `PageEditor`.
A mudança é um simples guard no início do componente:

**Arquivo:** `src/components/pages/PageView.tsx`

```tsx
import type { Page } from "@/types/bindings/Page";
import { PageEditor } from "@/components/editor/PageEditor";
import { TagEditor } from "@/components/pages/TagEditor";
import { PdfCanvasPage } from "@/components/pdf/PdfCanvasPage";  // NOVO

interface PageViewProps {
  page: Page;
}

export function PageView({ page }: PageViewProps) {
  // Novo: PDF Canvas Page é full-screen, sem o wrapper de colunas
  if (page.editor_preferences.mode === "pdf_canvas") {
    return <PdfCanvasPage page={page} />;
  }

  // View padrão existente (rich text / markdown)
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
          <span>Atualizado: {new Date(page.updated_at).toLocaleDateString()}</span>
        </div>
        <PageEditor page={page} />
      </div>
    </div>
  );
}
```

> **Importante:** `PdfCanvasPage` ocupa 100% da área — não tem padding lateral nem max-width.
> Por isso o guard precisa ser **antes** do wrapper `div`, não dentro.

---

### 2. Opção "Importar PDF" no `ContextMenu.tsx`

**Arquivo:** `src/components/shared/ContextMenu.tsx`

Localizar o bloco de itens do menu para `type === "section"` e adicionar o item de importação.

O fluxo do handler:
1. Abre o file picker filtrado para `.pdf`
2. Deriva o título do nome do arquivo (sem extensão)
3. Chama `createPdfCanvasPage` via IPC
4. Atualiza o estado:
   - Força recarga da lista de páginas da seção
   - Navega e abre a nova página

```tsx
// Dentro do array de itens do menu, bloco type === "section":
{
  label: t("context_menu.import_pdf"),
  icon: <FileInput size={14} />,
  onClick: async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: false,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });

    if (!selected || typeof selected !== "string") return;

    // Deriva título do nome do arquivo
    const filename = selected.split("/").pop() ?? "PDF";
    const title = filename.replace(/\.pdf$/i, "");

    try {
      const page = await createPdfCanvasPage(id, selected, title);

      // Recarregar lista de páginas e navegar
      await usePageStore.getState().loadPages(id);
      useNavigationStore.getState().selectPage(page.id);
      usePageStore.getState().setCurrentPage(page);
    } catch (err) {
      console.error("[PDF Canvas] Import failed:", err);
      toast.error(t("context_menu.import_pdf_error"));
    }

    onClose();
  },
}
```

**Imports a adicionar no topo do `ContextMenu.tsx`:**
```tsx
import { FileInput } from "lucide-react";
import { createPdfCanvasPage } from "@/lib/ipc";
import { usePageStore } from "@/stores/usePageStore";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { toast } from "sonner";
```

> **Nota sobre import dinâmico:** `@tauri-apps/plugin-dialog` já é usado no `SlashCommandMenu.tsx`
> com import dinâmico — manter o mesmo padrão para consistência.

---

### 3. Ícone diferenciado na tree (opcional, MVP+)

As páginas PDF Canvas aparecem na tree com ícone `FileText` igual às demais. Para ícone diferenciado,
seria necessário adicionar `page_type` ao `PageSummary` (Rust). Deixar como TODO.

```
// TODO: Diferenciar ícone na NotebookTree para páginas pdf_canvas
// Requer adicionar page_type ao PageSummary em crates/core/src/page.rs
```

---

### 4. Strings i18n

**Arquivo:** `src/locales/pt-BR.json`

Adicionar dentro do objeto `"context_menu"`:
```json
"context_menu": {
  // ...chaves existentes...
  "import_pdf": "Importar PDF",
  "import_pdf_error": "Falha ao importar o PDF"
}
```

Adicionar dentro de um novo objeto `"pdf_canvas"`:
```json
"pdf_canvas": {
  "loading": "Carregando PDF...",
  "error": "Erro ao carregar PDF",
  "toolbar": {
    "scroll_mode": "Modo scroll",
    "draw_mode": "Modo escrita",
    "pen": "Caneta",
    "marker": "Marcador",
    "eraser": "Borracha",
    "undo": "Desfazer",
    "redo": "Refazer",
    "prev_page": "Página anterior",
    "next_page": "Próxima página",
    "zoom_in": "Aumentar zoom",
    "zoom_out": "Diminuir zoom"
  }
}
```

**Arquivo:** `src/locales/en.json`

```json
"context_menu": {
  // ...chaves existentes...
  "import_pdf": "Import PDF",
  "import_pdf_error": "Failed to import PDF"
}
```

```json
"pdf_canvas": {
  "loading": "Loading PDF...",
  "error": "Failed to load PDF",
  "toolbar": {
    "scroll_mode": "Scroll mode",
    "draw_mode": "Draw mode",
    "pen": "Pen",
    "marker": "Marker",
    "eraser": "Eraser",
    "undo": "Undo",
    "redo": "Redo",
    "prev_page": "Previous page",
    "next_page": "Next page",
    "zoom_in": "Zoom in",
    "zoom_out": "Zoom out"
  }
}
```

---

## Fluxo visual completo após estas mudanças

```
Usuário clica direito na seção "Laranja"
         │
         ▼
Context menu exibe:
  + Nova Página
  📄 Importar PDF     ← NOVO
  ✏️  Renomear
  🗑  Excluir
         │ (clica "Importar PDF")
         ▼
File picker abre (filtro: .pdf)
         │ (seleciona "Anotações Rust.pdf")
         ▼
IPC: create_pdf_canvas_page(
  sectionId: "laranja-id",
  filePath: "/path/to/Anotações Rust.pdf",
  title: "Anotações Rust"
)
         │
         ▼
Sidebar: nova página "Anotações Rust" aparece na seção
ContentArea: PdfCanvasPage abre em full-screen
         │
         ▼
Usuário clica 🖊 (modo escrita)
Escreve sobre a página 1
Após 1500ms → auto-save silencioso
```

---

## Verificação de impacto em páginas existentes

- `PageView` com `mode === "rich_text"` → caminho existente, zero mudança
- `PageView` com `mode === "markdown"` → caminho existente, zero mudança
- `ContextMenu` com `type === "notebook"` → sem mudança
- `ContextMenu` com `type === "page"` → sem mudança
- Somente `ContextMenu` com `type === "section"` recebe o novo item

---

## Critério de conclusão

- [ ] `PageView` renderiza `PdfCanvasPage` para `mode === "pdf_canvas"`
- [ ] `PageView` continua funcionando normalmente para rich_text e markdown
- [ ] Context menu de seção exibe "Importar PDF"
- [ ] Após importar, a nova página abre automaticamente
- [ ] Strings i18n adicionadas em pt-BR e en
- [ ] `npx tsc --noEmit` sem erros
