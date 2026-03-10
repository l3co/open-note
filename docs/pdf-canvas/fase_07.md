# Fase 07 — Testes

## Objetivo

Garantir cobertura adequada da feature em todos os níveis da pirâmide de testes:
1. **Unit** — lógica de domínio e funções puras
2. **Integração** — storage round-trip + IPC mocks
3. **E2E** — fluxo completo no app real

---

## 1. Testes unitários Rust

### `crates/core/src/page.rs` — (adicionados na Fase 01)

```rust
// Checklist de testes:
// ✓ new_pdf_canvas_sets_correct_mode
// ✓ new_pdf_canvas_rejects_empty_title
// ✓ pdf_canvas_page_serializes_mode_as_snake_case
// ✓ legacy_page_without_pdf_fields_deserializes_with_defaults
```

### `crates/storage/src/migrations.rs`

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrate_page_adds_missing_pdf_fields() {
        let raw = serde_json::json!({
            "id": "00000000-0000-0000-0000-000000000001",
            "title": "Old Page"
            // sem pdf_asset e pdf_total_pages
        });
        let result = migrate_page_if_needed(raw);
        assert!(result["pdf_asset"].is_null());
        assert_eq!(result["pdf_total_pages"], 0);
    }

    #[test]
    fn migrate_page_preserves_existing_pdf_fields() {
        let raw = serde_json::json!({
            "pdf_asset": "assets/doc.pdf",
            "pdf_total_pages": 7
        });
        let result = migrate_page_if_needed(raw);
        assert_eq!(result["pdf_asset"], "assets/doc.pdf");
        assert_eq!(result["pdf_total_pages"], 7);
    }

    #[test]
    fn migrate_page_is_idempotent() {
        let raw = serde_json::json!({ "pdf_asset": null, "pdf_total_pages": 0 });
        let once = migrate_page_if_needed(raw.clone());
        let twice = migrate_page_if_needed(once.clone());
        assert_eq!(once, twice);
    }
}
```

### `crates/storage/tests/` — testes de integração storage

**Arquivo:** `crates/storage/tests/pdf_canvas.rs` (novo)

```rust
use opennote_core::id::SectionId;
use opennote_core::page::{EditorMode, Page};
use opennote_storage::engine::FsStorageEngine;
use tempfile::tempdir;

// Fixture helper
fn setup_section(root: &Path, section_id: SectionId) {
    // Cria estrutura mínima: notebook.json, section.json
    // ... (reutilizar helpers dos testes existentes)
}

#[test]
fn round_trip_pdf_canvas_page() {
    let dir = tempdir().unwrap();
    let root = dir.path();
    let section_id = SectionId::new();
    setup_section(root, section_id);

    let page = Page::new_pdf_canvas(
        section_id,
        "Anotações",
        "assets/doc.pdf".to_string(),
        8,
    ).unwrap();

    FsStorageEngine::create_page_from(root, &page).unwrap();

    let loaded = FsStorageEngine::load_page(root, page.id).unwrap();
    assert_eq!(loaded.editor_preferences.mode, EditorMode::PdfCanvas);
    assert_eq!(loaded.pdf_asset, Some("assets/doc.pdf".to_string()));
    assert_eq!(loaded.pdf_total_pages, 8);
    assert_eq!(loaded.title, "Anotações");
}

#[test]
fn load_legacy_page_without_pdf_fields_succeeds() {
    let dir = tempdir().unwrap();
    let root = dir.path();
    let section_id = SectionId::new();
    setup_section(root, section_id);

    // Escreve manualmente .opn.json sem campos pdf_*
    let legacy_json = serde_json::json!({
        "id": "01234567-89ab-cdef-0123-456789abcdef",
        "section_id": section_id.to_string(),
        "title": "Legacy",
        "tags": [],
        "blocks": [],
        "annotations": { "strokes": [], "highlights": [], "svg_cache": null },
        "editor_preferences": { "mode": "rich_text", "split_view": false },
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z",
        "schema_version": 1
    });
    // ... escreve no path correto ...

    let page_id: opennote_core::id::PageId = "01234567-89ab-cdef-0123-456789abcdef".parse().unwrap();
    let loaded = FsStorageEngine::load_page(root, page_id).unwrap();
    assert_eq!(loaded.pdf_asset, None);
    assert_eq!(loaded.pdf_total_pages, 0);
}
```

**Comando para rodar:**
```bash
cargo test -p opennote-storage
```

---

## 2. Testes unitários TypeScript (Vitest)

### Funções puras do `PdfCanvasPage`

**Arquivo:** `src/components/pdf/__tests__/PdfCanvasPage.test.ts` (novo)

```ts
import { describe, it, expect } from "vitest";
import { toPdfCoords, toCanvasCoords, flattenToAnchoredStrokes } from "../PdfCanvasPage";

// Exportar as funções utilitárias do componente para testabilidade
// (mover para src/lib/pdf-canvas-utils.ts para facilitar import)

describe("toPdfCoords", () => {
  it("divides points by scale", () => {
    const stroke = makeMockStroke([{ x: 150, y: 300, pressure: 0.5 }]);
    const result = toPdfCoords(stroke, 1.5);
    expect(result.points[0].x).toBeCloseTo(100);
    expect(result.points[0].y).toBeCloseTo(200);
  });
});

describe("toCanvasCoords", () => {
  it("multiplies points by scale", () => {
    const stroke = makeMockStroke([{ x: 100, y: 200, pressure: 0.5 }]);
    const result = toCanvasCoords(stroke, 1.5);
    expect(result.points[0].x).toBeCloseTo(150);
    expect(result.points[0].y).toBeCloseTo(300);
  });

  it("is the inverse of toPdfCoords", () => {
    const original = makeMockStroke([{ x: 150, y: 300, pressure: 0.8 }]);
    const pdfSpace = toPdfCoords(original, 2.0);
    const backToCanvas = toCanvasCoords(pdfSpace, 2.0);
    expect(backToCanvas.points[0].x).toBeCloseTo(original.points[0].x);
    expect(backToCanvas.points[0].y).toBeCloseTo(original.points[0].y);
  });
});

describe("flattenToAnchoredStrokes", () => {
  it("sets pdf_page anchor correctly", () => {
    const map = new Map([
      [1, [makeMockStroke()]],
      [3, [makeMockStroke(), makeMockStroke()]],
    ]);
    const flat = flattenToAnchoredStrokes(map);
    expect(flat).toHaveLength(3);
    expect(flat[0].anchor?.pdf_page).toBe(1);
    expect(flat[1].anchor?.pdf_page).toBe(3);
    expect(flat[2].anchor?.pdf_page).toBe(3);
  });

  it("returns empty array for empty map", () => {
    expect(flattenToAnchoredStrokes(new Map())).toHaveLength(0);
  });
});
```

**Nota:** Extrair `toPdfCoords`, `toCanvasCoords`, `flattenToAnchoredStrokes` para
`src/lib/pdf-canvas-utils.ts` para facilitar importação nos testes sem renderizar o componente.

**Comando para rodar:**
```bash
npx vitest run src/components/pdf/__tests__/
```

---

## 3. Testes de componente (Vitest + Testing Library)

**Arquivo:** `src/components/pdf/__tests__/PdfCanvasPage.component.test.tsx` (novo)

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PdfCanvasPage } from "../PdfCanvasPage";
import { mockPage } from "@/test-utils/factories";

// Mock das dependências pesadas
vi.mock("pdfjs-dist", () => ({
  getDocument: () => ({ promise: Promise.resolve({ numPages: 3, getPage: vi.fn() }) }),
  GlobalWorkerOptions: { workerSrc: "" },
}));

vi.mock("@/lib/ipc", () => ({
  readAssetBase64: () => Promise.resolve("data:application/pdf;base64,"),
  updatePageAnnotations: vi.fn().mockResolvedValue(undefined),
}));

const pdfCanvasPage = mockPage({
  editor_preferences: { mode: "pdf_canvas", split_view: false },
  pdf_asset: "assets/test.pdf",
  pdf_total_pages: 3,
});

describe("PdfCanvasPage", () => {
  it("renders toolbar with page navigation", async () => {
    render(<PdfCanvasPage page={pdfCanvasPage} />);
    expect(await screen.findByText("1 / 3")).toBeInTheDocument();
  });

  it("ink mode toggle shows/hides ink tools", async () => {
    render(<PdfCanvasPage page={pdfCanvasPage} />);
    const toggleBtn = await screen.findByTitle(/modo scroll|scroll mode/i);
    expect(screen.queryByTitle(/caneta|pen/i)).toBeNull();

    fireEvent.click(toggleBtn);
    expect(screen.getByTitle(/caneta|pen/i)).toBeInTheDocument();
  });

  it("shows error state when pdf_asset is null", () => {
    const badPage = mockPage({
      editor_preferences: { mode: "pdf_canvas", split_view: false },
      pdf_asset: null,
      pdf_total_pages: 0,
    });
    render(<PdfCanvasPage page={badPage} />);
    expect(screen.getByText(/erro|error/i)).toBeInTheDocument();
  });
});
```

---

## 4. Testes E2E (Playwright)

**Arquivo:** `e2e/pdf-canvas.spec.ts` (novo)

```ts
import { test, expect } from "@playwright/test";
import { setupWorkspace, mockIpc } from "./helpers/workspace";

test.describe("PDF Canvas Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupWorkspace(page);
    // Mock IPC para evitar filesystem real
    await mockIpc(page, "create_pdf_canvas_page", {
      id: "pdf-page-1",
      title: "Relatório Q1",
      editor_preferences: { mode: "pdf_canvas", split_view: false },
      pdf_asset: "assets/relatorio.pdf",
      pdf_total_pages: 5,
      // ...outros campos padrão
    });
    await mockIpc(page, "update_page_annotations", null);
  });

  test("context menu de seção exibe Importar PDF", async ({ page }) => {
    // Clique direito na seção
    await page.getByTestId("section-item").first().click({ button: "right" });
    await expect(page.getByText("Importar PDF")).toBeVisible();
  });

  test("após importar PDF, página abre em modo pdf_canvas", async ({ page }) => {
    await page.getByTestId("section-item").first().click({ button: "right" });
    await page.getByText("Importar PDF").click();

    // Mock do file picker — retorna caminho direto
    // (Playwright Tauri: mockar o dialog via IPC mock)

    await expect(page.getByTestId("pdf-canvas-toolbar")).toBeVisible();
    await expect(page.getByTestId("pdf-canvas-container")).toBeVisible();
  });

  test("toggle modo escrita ativa InkCanvas", async ({ page }) => {
    // Navegar para página PDF canvas existente
    // ...

    const toolbar = page.getByTestId("pdf-canvas-toolbar");
    await expect(toolbar.getByTitle(/modo scroll/i)).toBeVisible();

    await toolbar.getByTitle(/modo scroll/i).click();
    await expect(toolbar.getByTitle(/modo escrita/i)).toBeVisible();
    await expect(page.getByTestId("ink-canvas-overlay")).toBeVisible();
  });
});
```

**Comando para rodar:**
```bash
npx playwright test e2e/pdf-canvas.spec.ts
```

---

## 5. Checklist de regressão

Antes de marcar a feature como completa, verificar que nada regrediu:

```bash
# Testes Rust — todos os crates
cargo test

# Testes TypeScript
npx vitest run

# Type check
npx tsc --noEmit

# E2E existentes (não devem quebrar)
npx playwright test e2e/fase-01-initialization.spec.ts
npx playwright test e2e/fase-02-local-management.spec.ts
npx playwright test e2e/fase-03-ui-shell.spec.ts
```

### Casos de regressão críticos

| Caso | Verificação |
|---|---|
| Abrir página rich text existente | `PageView` renderiza `PageEditor` normalmente |
| Abrir página markdown existente | `PageView` renderiza `PageEditor` normalmente |
| Deserializar página antiga sem `pdf_asset` | Carrega com defaults, sem exceção |
| Context menu de notebook | Não exibe "Importar PDF" |
| Context menu de página | Não exibe "Importar PDF" |
| Ink overlay em página rich text | Continua funcionando via `InkOverlay` |

---

## Critério de conclusão da Fase 07

- [ ] `cargo test` — 0 falhas
- [ ] `npx vitest run` — 0 falhas
- [ ] `npx tsc --noEmit` — 0 erros
- [ ] Testes E2E de fases anteriores passam sem regressão
- [ ] Novos testes E2E do pdf-canvas passam
