import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PageView } from "../PageView";
import React from "react";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@/components/editor/PageEditor", () => ({
  PageEditor: ({ page }: { page: { title: string } }) => (
    <div data-testid="page-editor-mock">{page.title}</div>
  ),
}));
vi.mock("@/components/pages/TagEditor", () => ({
  TagEditor: ({ tags }: { tags: string[] }) => (
    <div data-testid="tag-editor-mock">{tags.join(",")}</div>
  ),
}));
vi.mock("@/components/pdf/PdfCanvasPage", () => ({
  PdfCanvasPage: () => <div data-testid="pdf-canvas-mock" />,
}));
vi.mock("@/components/canvas/CanvasPage", () => ({
  CanvasPage: () => <div data-testid="canvas-page-mock" />,
}));

const makePage = () => ({
  id: "page-1",
  title: "Test Page",
  section_id: "sec-1",
  blocks: [],
  tags: ["tag1", "tag2"],
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  schema_version: 1,
  editor_preferences: { mode: "rich_text" as const, split_view: false },
  annotations: { strokes: [], highlights: [], svg_cache: null },
  pdf_asset: null,
  pdf_total_pages: null,
  canvas_state: null,
  protection: null,
  encrypted_content: null,
});

describe("PageView", () => {
  it("renders page editor with page data", () => {
    render(<PageView page={makePage()} />);
    expect(screen.getByTestId("page-editor-mock")).toHaveTextContent(
      "Test Page",
    );
  });

  it("renders tag editor with page tags", () => {
    render(<PageView page={makePage()} />);
    expect(screen.getByTestId("tag-editor-mock")).toHaveTextContent(
      "tag1,tag2",
    );
  });

  it("renders with empty tags", () => {
    const page = { ...makePage(), tags: [] };
    render(<PageView page={page} />);
    expect(screen.getByTestId("tag-editor-mock")).toBeInTheDocument();
  });

  it("renderiza CanvasPage para modo canvas", async () => {
    const canvasPage = {
      ...makePage(),
      editor_preferences: { mode: "canvas" as const, split_view: false },
    };
    render(
      <React.Suspense fallback={null}>
        <PageView page={canvasPage} />
      </React.Suspense>,
    );
    // Aguardar lazy load
    expect(await screen.findByTestId("canvas-page-mock")).toBeInTheDocument();
  });

  it("renderiza PdfCanvasPage para modo pdf_canvas", () => {
    const pdfPage = {
      ...makePage(),
      editor_preferences: { mode: "pdf_canvas" as const, split_view: false },
    };
    render(<PageView page={pdfPage} />);
    expect(screen.getByTestId("pdf-canvas-mock")).toBeInTheDocument();
  });
});
