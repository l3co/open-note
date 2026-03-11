import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CanvasPage } from "../CanvasPage";
import type { Page } from "@/types/bindings/Page";
import { Excalidraw } from "@excalidraw/excalidraw";

// Mock do Excalidraw (não funciona em jsdom)
vi.mock("@excalidraw/excalidraw", () => ({
  Excalidraw: vi.fn(({ onChange }) => (
    <div
      data-testid="excalidraw-mock"
      onClick={() =>
        onChange?.(
          [{ type: "rectangle", id: "test" }],
          { name: "test-app-state" },
          {},
        )
      }
    />
  )),
}));

// Mock do IPC
vi.mock("@/lib/ipc", () => ({
  updatePageCanvasState: vi.fn().mockResolvedValue(undefined),
  updatePageTitle: vi.fn().mockResolvedValue(undefined),
  createCanvasPage: vi.fn(),
}));

// Mock do usePageStore
vi.mock("@/stores/usePageStore", () => ({
  usePageStore: Object.assign(
    () => ({
      updatePageTitle: vi.fn(),
    }),
    {
      getState: () => ({
        updatePageTitle: vi.fn(),
      }),
    },
  ),
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
  protection: null,
  encrypted_content: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  schema_version: 1,
};

describe("CanvasPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("renderiza o Excalidraw", () => {
    render(<CanvasPage page={mockPage} />);
    expect(screen.getByTestId("excalidraw-mock")).toBeInTheDocument();
  });

  it("exibe o título da página", () => {
    render(<CanvasPage page={mockPage} />);
    expect(screen.getByTestId("title-editor")).toHaveTextContent("Meu Canvas");
  });

  it("salva o canvas_state após mudança (debounce)", async () => {
    const { updatePageCanvasState } = await import("@/lib/ipc");

    render(<CanvasPage page={mockPage} />);

    // Simular onChange do Excalidraw
    const excalidrawMock = screen.getByTestId("excalidraw-mock");
    excalidrawMock.click();

    // Aguardar o debounce (1500ms)
    await waitFor(
      () => {
        expect(updatePageCanvasState).toHaveBeenCalled();
      },
      { timeout: 3000 },
    );

    expect(updatePageCanvasState).toHaveBeenCalledWith(
      mockPage.id,
      expect.objectContaining({
        elements: expect.arrayContaining([
          expect.objectContaining({ type: "rectangle" }),
        ]),
      }),
    );
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

    expect(Excalidraw).toHaveBeenCalledWith(
      expect.objectContaining({
        initialData: expect.objectContaining({
          elements: expect.arrayContaining([
            expect.objectContaining({ type: "rectangle" }),
          ]),
        }),
      }),
      undefined,
    );
  });
});
