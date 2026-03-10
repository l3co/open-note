# Fase 04 — Frontend: IPC Wrapper + Types

## Objetivo

Expor os dois novos comandos Tauri para o frontend via `src/lib/ipc.ts` e garantir que os tipos TypeScript gerados pelo `ts-rs` estão corretos e importados onde necessário.

## Arquivos modificados

- `src/lib/ipc.ts`
- `src/types/bindings/EditorMode.ts` ← gerado automaticamente, verificar
- `src/types/bindings/Page.ts` ← gerado automaticamente, verificar

---

## Mudanças detalhadas

### 1. Adicionar funções em `src/lib/ipc.ts`

**Localização:** após o bloco `// ─── PDF ───` existente

```ts
// ─── PDF Canvas ───

export const createPdfCanvasPage = (
  sectionId: SectionId,
  filePath: string,
  title: string,
  workspaceId?: string,
) =>
  invoke<Page>("create_pdf_canvas_page", {
    sectionId,
    filePath,
    title,
    workspaceId,
  });

export const updatePageAnnotations = (
  pageId: PageId,
  annotations: PageAnnotations,
  workspaceId?: string,
) =>
  invoke<void>("update_page_annotations", {
    pageId,
    annotations,
    workspaceId,
  });
```

**Imports a verificar/adicionar no topo do arquivo:**
```ts
import type { PageAnnotations } from "@/types/bindings/PageAnnotations";
// Page, PageId, SectionId já devem estar importados
```

---

### 2. Bindings TypeScript (gerados pelo ts-rs)

Após `cargo test -p opennote-core`, os seguintes arquivos são regenerados automaticamente:

**`src/types/bindings/EditorMode.ts`** — deve conter:
```ts
export type EditorMode = "rich_text" | "markdown" | "pdf_canvas";
```

**`src/types/bindings/Page.ts`** — deve conter os novos campos:
```ts
export interface Page {
  // ... campos existentes ...
  pdf_asset: string | null;
  pdf_total_pages: number;
}
```

> **Ação:** Após a Fase 01, rodar `cargo test -p opennote-core` e confirmar que os arquivos
> em `src/types/bindings/` foram atualizados.

---

### 3. Atualizar mock IPC para testes (MSW)

**Arquivo:** `e2e/helpers/ipc-mock.ts`

Adicionar handlers para os novos comandos:

```ts
// create_pdf_canvas_page
mockIpc("create_pdf_canvas_page", ({ sectionId, title }) => ({
  id: "page-pdf-canvas-id",
  section_id: sectionId,
  title,
  tags: [],
  blocks: [],
  annotations: { strokes: [], highlights: [], svg_cache: null },
  editor_preferences: { mode: "pdf_canvas", split_view: false },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  schema_version: 1,
  pdf_asset: "assets/mock.pdf",
  pdf_total_pages: 5,
}));

// update_page_annotations
mockIpc("update_page_annotations", () => null);
```

---

### 4. Atualizar mock de `load_page` nos testes existentes

Nos testes Vitest que mockam `load_page`, adicionar os novos campos com valores padrão para não quebrar:

```ts
// Em qualquer mock de Page existente, adicionar:
pdf_asset: null,
pdf_total_pages: 0,
```

---

## Verificação

### Checklist de tipos

Após regenerar os bindings:

```ts
// Deve compilar sem erros TypeScript:
const mode: EditorMode = "pdf_canvas";  // ✓
const page: Page = {
  // ...
  pdf_asset: null,        // ✓
  pdf_total_pages: 0,     // ✓
};
```

### Teste de compilação TS

```bash
npx tsc --noEmit
```

Não deve haver erros relacionados aos novos campos.

---

## Critério de conclusão

- [ ] `src/lib/ipc.ts` exporta `createPdfCanvasPage` e `updatePageAnnotations`
- [ ] `EditorMode` TypeScript inclui `"pdf_canvas"`
- [ ] `Page` TypeScript inclui `pdf_asset` e `pdf_total_pages`
- [ ] `npx tsc --noEmit` sem erros
- [ ] Mocks IPC atualizados para testes
