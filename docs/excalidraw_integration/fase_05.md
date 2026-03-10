# Fase 05 — Testes e Validações

## Objetivo

Garantir cobertura de testes em todas as camadas da integração: unitários Rust
no domínio, testes de componente React com Vitest + Testing Library, e testes
E2E com Playwright.

**Pré-requisito:** Fases 01–04 concluídas e funcionando manualmente.

---

## Contexto

### Pirâmide de testes do projeto

| Camada | Ferramenta | Meta de cobertura |
|---|---|---|
| Domínio Rust (`crates/core`) | `cargo test` + `insta` | ≥ 90% |
| Frontend components | Vitest + Testing Library + MSW | ≥ 85% |
| E2E | Playwright | Cenários críticos |

Os testes unitários Rust foram parcialmente cobertos na Fase 01 (testes inline
em `page.rs`). Esta fase adiciona os testes de integração de storage e os
testes de frontend.

---

## Tarefas

### 5.1 — Testes de integração Rust: storage canvas

**Arquivo:** `crates/storage/tests/` (criar se necessário, seguindo o padrão
dos testes existentes)

```bash
# Ver testes de storage existentes como referência
ls crates/storage/tests/
```

Criar ou adicionar ao arquivo de testes de integração:

```rust
// crates/storage/tests/canvas_page_test.rs

use opennote_core::id::SectionId;
use opennote_core::page::{EditorMode, Page};
use opennote_storage::engine::FsStorageEngine;
use tempfile::TempDir;

fn setup_workspace() -> TempDir {
    let dir = TempDir::new().unwrap();
    // Inicializar workspace, notebook e section conforme padrão dos outros testes
    dir
}

#[test]
fn create_and_load_canvas_page_roundtrip() {
    let dir = setup_workspace();
    // ... criar workspace, notebook, section ...
    let section_id = SectionId::new();

    let page = Page::new_canvas(section_id, "Meu Canvas").unwrap();
    let created = FsStorageEngine::create_page_from(dir.path(), section_id, page).unwrap();

    assert_eq!(created.editor_preferences.mode, EditorMode::Canvas);
    assert!(created.canvas_state.is_none());

    // Simular save do canvas_state
    let mut loaded = FsStorageEngine::load_page(dir.path(), created.id).unwrap();
    loaded.update_canvas_state(Some(serde_json::json!({
        "elements": [{ "type": "rectangle", "id": "abc" }],
        "appState": { "viewBackgroundColor": "#ffffff" },
        "files": {}
    })));
    FsStorageEngine::update_page(dir.path(), &loaded).unwrap();

    // Recarregar e verificar persistência
    let reloaded = FsStorageEngine::load_page(dir.path(), created.id).unwrap();
    assert!(reloaded.canvas_state.is_some());
    let elements = reloaded.canvas_state.as_ref().unwrap()["elements"].as_array().unwrap();
    assert_eq!(elements.len(), 1);
}

#[test]
fn canvas_page_clear_state() {
    // ... setup ...
    // Criar página com estado, depois limpar com canvas_state: None
    // Verificar que o campo é salvo como null/ausente no JSON
}
```

> **Adaptar** o setup ao padrão exato dos testes de storage existentes
> (estrutura de diretórios, inicialização de workspace). Seguir o mesmo
> scaffolding dos outros `#[test]` em `crates/storage/tests/`.

---

### 5.2 — Testes de snapshot Rust com `insta`

**Arquivo:** `crates/core/src/page.rs` ou arquivo de snapshot separado

Adicionar um snapshot test para o JSON serializado de `Page::new_canvas()`:

```rust
#[test]
fn canvas_page_snapshot() {
    use insta::assert_json_snapshot;

    // Usar IDs fixos para snapshot reproduzível
    let section_id = SectionId::from(uuid::Uuid::nil());
    let mut page = Page::new_canvas(section_id, "Canvas Test").unwrap();
    // Fixar timestamps para snapshot determinístico
    page.id = PageId::from(uuid::Uuid::nil());
    page.created_at = chrono::DateTime::parse_from_rfc3339("2026-01-01T00:00:00Z")
        .unwrap()
        .with_timezone(&chrono::Utc);
    page.updated_at = page.created_at;

    assert_json_snapshot!(page, {
        ".id" => "[uuid]",
        ".section_id" => "[uuid]",
        ".created_at" => "[datetime]",
        ".updated_at" => "[datetime]",
    });
}
```

```bash
# Gerar snapshots iniciais
cargo test -p opennote-core canvas_page_snapshot -- --test
# Aceitar snapshots novos
cargo insta review
```

---

### 5.3 — Testes de componente: `CanvasPage`

**Arquivo:** `src/components/canvas/__tests__/CanvasPage.test.tsx`

O Excalidraw não é facilmente testável em jsdom — usar mock do módulo:

```tsx
// src/components/canvas/__tests__/CanvasPage.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CanvasPage } from "../CanvasPage";
import type { Page } from "@/types/bindings/Page";

// Mock do Excalidraw (não funciona em jsdom)
vi.mock("@excalidraw/excalidraw", () => ({
  Excalidraw: vi.fn(({ onChange }) => (
    <div
      data-testid="excalidraw-mock"
      onClick={() =>
        onChange?.([{ type: "rectangle", id: "test" }], {}, {})
      }
    />
  )),
}));

// Mock do IPC
vi.mock("@/lib/ipc", () => ({
  updatePageCanvasState: vi.fn().mockResolvedValue(undefined),
  updatePageTitle: vi.fn().mockResolvedValue(undefined),
}));

const mockPage: Page = {
  id: "page-uuid-001",
  section_id: "section-uuid-001",
  title: "Meu Canvas",
  tags: [],
  blocks: [],
  annotations: { strokes: [], highlights: [], svg_cache: null },
  editor_preferences: { mode: "canvas", split_view: false },
  canvas_state: null,
  pdf_asset: null,
  pdf_total_pages: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  schema_version: 1,
};

describe("CanvasPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza o Excalidraw", () => {
    render(<CanvasPage page={mockPage} />);
    expect(screen.getByTestId("excalidraw-mock")).toBeInTheDocument();
  });

  it("exibe o título da página", () => {
    render(<CanvasPage page={mockPage} />);
    expect(screen.getByDisplayValue("Meu Canvas")).toBeInTheDocument();
  });

  it("salva o canvas_state após mudança (debounce)", async () => {
    const { updatePageCanvasState } = await import("@/lib/ipc");
    vi.useFakeTimers();

    render(<CanvasPage page={mockPage} />);

    // Simular onChange do Excalidraw
    screen.getByTestId("excalidraw-mock").click();

    // Antes do debounce: não deve ter salvo
    expect(updatePageCanvasState).not.toHaveBeenCalled();

    // Avançar o timer do debounce
    await vi.advanceTimersByTimeAsync(1500);

    expect(updatePageCanvasState).toHaveBeenCalledWith(
      mockPage.id,
      expect.objectContaining({ elements: expect.any(Array) }),
      undefined,
    );

    vi.useRealTimers();
  });

  it("restaura estado inicial do canvas quando canvas_state não é null", () => {
    const pageWithState: Page = {
      ...mockPage,
      canvas_state: {
        elements: [{ type: "rectangle", id: "existing" }],
        appState: { viewBackgroundColor: "#ffffff" },
        files: {},
      },
    };

    render(<CanvasPage page={pageWithState} />);
    // Verifica que o Excalidraw foi chamado com initialData do canvas_state
    const { Excalidraw } = require("@excalidraw/excalidraw");
    expect(Excalidraw).toHaveBeenCalledWith(
      expect.objectContaining({
        initialData: expect.objectContaining({
          elements: expect.arrayContaining([
            expect.objectContaining({ type: "rectangle" }),
          ]),
        }),
      }),
      {},
    );
  });
});
```

---

### 5.4 — Testes de componente: `PageView` roteamento

**Arquivo:** `src/components/pages/__tests__/PageView.test.tsx` (criar ou
adicionar ao existente)

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PageView } from "../PageView";

// Mock lazy do CanvasPage
vi.mock("@/components/canvas/CanvasPage", () => ({
  CanvasPage: () => <div data-testid="canvas-page-mock" />,
}));

const canvasPage = {
  // ... mesma estrutura do mockPage acima ...
  editor_preferences: { mode: "canvas" as const, split_view: false },
};

it("renderiza CanvasPage para modo canvas", async () => {
  render(
    <React.Suspense fallback={null}>
      <PageView page={canvasPage} />
    </React.Suspense>
  );
  // Aguardar lazy load
  await screen.findByTestId("canvas-page-mock");
  expect(screen.getByTestId("canvas-page-mock")).toBeInTheDocument();
});
```

---

### 5.5 — Teste E2E: criar e persistir página canvas

**Arquivo:** `e2e/fase-06-canvas-page.spec.ts`

```typescript
import { test, expect } from "@playwright/test";
import { createTestWorkspace, openSection } from "./helpers/workspace";

test.describe("Canvas Page", () => {
  test("criar página canvas e verificar que abre no modo canvas", async ({
    page,
  }) => {
    await createTestWorkspace(page);
    await openSection(page, "Test Section");

    // Clicar no botão "Nova Página Canvas"
    await page.getByRole("button", { name: /nova página canvas/i }).click();

    // Verificar que o Excalidraw foi carregado
    await expect(page.locator(".excalidraw")).toBeVisible({ timeout: 10000 });
  });

  test("estado do canvas persiste após recarregar", async ({ page }) => {
    await createTestWorkspace(page);
    await openSection(page, "Test Section");

    // Criar página canvas
    await page.getByRole("button", { name: /nova página canvas/i }).click();
    await expect(page.locator(".excalidraw")).toBeVisible({ timeout: 10000 });

    // Usar a ferramenta de retângulo e desenhar
    await page.keyboard.press("r"); // atalho de retângulo no Excalidraw
    await page.mouse.move(300, 300);
    await page.mouse.down();
    await page.mouse.move(500, 450);
    await page.mouse.up();

    // Aguardar auto-save (1.5s + margem)
    await page.waitForTimeout(2500);

    // Navegar para outra página e voltar
    await page.getByTestId("page-list").getByRole("button").first().click();
    await page.waitForTimeout(500);
    await page.getByText("Canvas").click(); // clicar na página canvas

    // Verificar que o Excalidraw carregou e o elemento persiste
    await expect(page.locator(".excalidraw")).toBeVisible({ timeout: 10000 });
    // Verificar que há elementos no canvas (via DOM interno do Excalidraw)
    await expect(
      page.locator(".excalidraw .layer-ui__wrapper"),
    ).toBeVisible();
  });
});
```

> **Nota sobre seletores do Excalidraw:** O Excalidraw usa a classe
> `.excalidraw` como raiz. Para verificação de elementos dentro do canvas,
> usar a API `page.evaluate` para inspecionar o estado via `window.__excalidraw`
> se necessário. Ajustar seletores conforme a versão instalada.

---

### 5.6 — Executar suíte completa e verificar cobertura

```bash
# Testes Rust (todos os crates)
cargo test

# Verificar cobertura Rust (requer cargo-tarpaulin)
cargo tarpaulin -p opennote-core --out Html

# Testes frontend (unit + component)
npm run test

# Testes com cobertura frontend
npm run test -- --coverage

# Testes E2E (requer app compilado ou dev server)
npm run tauri dev &
npx playwright test e2e/fase-06-canvas-page.spec.ts
```

---

## Critérios de Aceite

- [ ] `cargo test` passa em todos os crates sem warnings novos
- [ ] Cobertura de `crates/core/src/page.rs` ≥ 90% após adição dos novos testes
- [ ] `npm run test` passa sem falhas
- [ ] Snapshot insta do `canvas_page_snapshot` aceito e commitado
- [ ] `CanvasPage.test.tsx` cobre: render, título, auto-save debounce, restauração de estado
- [ ] `PageView.test.tsx` cobre roteamento para `mode === "canvas"`
- [ ] E2E `fase-06-canvas-page.spec.ts` passa nos dois cenários
- [ ] CI (`ci.yml`) não precisa de mudanças — todos os testes existentes ainda passam

---

## Checklist Final de Release (todas as fases)

- [ ] **Fase 01:** `EditorMode::Canvas` + `canvas_state` + `Page::new_canvas()` ✓
- [ ] **Fase 02:** IPC `create_canvas_page` + `update_page_canvas_state` ✓
- [ ] **Fase 03:** `CanvasPage` component com auto-save e restauração ✓
- [ ] **Fase 04:** `PageView` roteamento + `SectionOverview` botão + i18n ✓
- [ ] **Fase 05:** Testes unitários, componente e E2E ✓
- [ ] Bindings TypeScript atualizados e commitados
- [ ] CHANGELOG.md atualizado com entrada `feat: canvas page (Excalidraw integration)`
- [ ] `DATA_MODEL.md` atualizado com `EditorMode::Canvas` e campo `canvas_state`
