import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PageEditor } from "../PageEditor";
import { usePageStore } from "@/stores/usePageStore";
import { useUIStore } from "@/stores/useUIStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

vi.mock("@/components/editor/BlockEditor", () => ({
  BlockEditor: ({
    onUpdate,
    onEditorReady,
  }: {
    onUpdate: (c: unknown) => void;
    onEditorReady?: (e: unknown) => void;
  }) => {
    if (onEditorReady) {
      onEditorReady({
        commands: { setContent: vi.fn() },
        getJSON: () => ({ type: "doc", content: [] }),
      });
    }
    return (
      <div
        data-testid="block-editor-mock"
        onClick={() => onUpdate({ type: "doc", content: [] })}
      />
    );
  },
}));

vi.mock("@/components/editor/MarkdownEditor", () => ({
  MarkdownEditor: ({
    onChange,
    content,
  }: {
    content: string;
    onChange: (s: string) => void;
  }) => (
    <textarea
      data-testid="markdown-editor-mock"
      value={content}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("@/components/editor/TitleEditor", () => ({
  TitleEditor: ({
    title,
    onTitleChange,
  }: {
    title: string;
    onTitleChange: (t: string) => void;
  }) => (
    <input
      data-testid="title-editor-mock"
      value={title}
      onChange={(e) => onTitleChange(e.target.value)}
    />
  ),
}));

vi.mock("@/components/editor/EditorModeToggle", () => ({
  EditorModeToggle: ({
    mode,
    onChange,
  }: {
    mode: string;
    onChange: (m: string) => void;
  }) => (
    <div data-testid="mode-toggle-mock">
      <button
        data-testid="toggle-richtext"
        onClick={() => onChange("richtext")}
      >
        Rich
      </button>
      <button
        data-testid="toggle-markdown"
        onClick={() => onChange("markdown")}
      >
        MD
      </button>
      <span data-testid="current-mode">{mode}</span>
    </div>
  ),
}));

vi.mock("@/components/ink/InkOverlay", () => ({
  InkOverlay: () => <div data-testid="ink-overlay-mock" />,
}));

vi.mock("@/hooks/useAutoSave", () => ({
  useAutoSave: ({ onSave }: { onSave: (doc: unknown) => void }) => ({
    forceSave: () => onSave({ type: "doc", content: [] }),
  }),
}));

vi.mock("@/lib/serialization", () => ({
  blocksToTiptap: () => ({ type: "doc", content: [] }),
  tiptapToBlocks: () => [],
}));

vi.mock("@/lib/markdown", () => ({
  tiptapToMarkdown: () => "# Markdown",
  markdownToTiptap: () => ({ type: "doc", content: [] }),
}));

const makePage = () => ({
  id: "page-1",
  title: "Test Page",
  section_id: "sec-1",
  blocks: [],
  tags: [],
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  schema_version: 1,
  editor_preferences: { mode: "rich_text" as const, split_view: false },
  annotations: { strokes: [], highlights: [], svg_cache: null },
});

describe("PageEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePageStore.setState({
      updateBlocks: vi.fn().mockResolvedValue(undefined),
      updatePageTitle: vi.fn().mockResolvedValue(undefined),
    });
    useUIStore.setState({
      theme: { baseTheme: "light", accentColor: "Blue", chromeTint: "neutral" },
    });
  });

  it("renders page editor container", () => {
    render(<PageEditor page={makePage()} />);
    expect(screen.getByTestId("page-editor")).toBeInTheDocument();
  });

  it("renders title editor with page title", () => {
    render(<PageEditor page={makePage()} />);
    expect(screen.getByTestId("title-editor-mock")).toHaveValue("Test Page");
  });

  it("renders mode toggle", () => {
    render(<PageEditor page={makePage()} />);
    expect(screen.getByTestId("mode-toggle-mock")).toBeInTheDocument();
  });

  it("renders block editor in richtext mode by default", () => {
    render(<PageEditor page={makePage()} />);
    expect(screen.getByTestId("block-editor-mock")).toBeInTheDocument();
    expect(
      screen.queryByTestId("markdown-editor-mock"),
    ).not.toBeInTheDocument();
  });

  it("switches to markdown mode on toggle", async () => {
    render(<PageEditor page={makePage()} />);
    fireEvent.click(screen.getByTestId("toggle-markdown"));
    expect(screen.getByTestId("markdown-editor-mock")).toBeInTheDocument();
    expect(screen.queryByTestId("block-editor-mock")).not.toBeInTheDocument();
  });

  it("switches back to richtext mode", async () => {
    render(<PageEditor page={makePage()} />);
    fireEvent.click(screen.getByTestId("toggle-markdown"));
    expect(screen.getByTestId("markdown-editor-mock")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("toggle-richtext"));
    expect(screen.getByTestId("block-editor-mock")).toBeInTheDocument();
  });

  it("renders ink overlay", () => {
    render(<PageEditor page={makePage()} />);
    expect(screen.getByTestId("ink-overlay-mock")).toBeInTheDocument();
  });

  it("calls updatePageTitle on title change", () => {
    render(<PageEditor page={makePage()} />);
    fireEvent.change(screen.getByTestId("title-editor-mock"), {
      target: { value: "New Title" },
    });
    expect(usePageStore.getState().updatePageTitle).toHaveBeenCalledWith(
      "New Title",
    );
  });

  it("calls forceSave on blur", () => {
    render(<PageEditor page={makePage()} />);
    fireEvent.blur(screen.getByTestId("page-editor"));
    expect(usePageStore.getState().updateBlocks).toHaveBeenCalled();
  });

  it("toggles mode on Cmd+Shift+M", () => {
    render(<PageEditor page={makePage()} />);
    expect(screen.getByTestId("block-editor-mock")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "m", metaKey: true, shiftKey: true });
    expect(screen.getByTestId("markdown-editor-mock")).toBeInTheDocument();
  });

  it("handles markdown content changes", () => {
    render(<PageEditor page={makePage()} />);
    fireEvent.click(screen.getByTestId("toggle-markdown"));
    fireEvent.change(screen.getByTestId("markdown-editor-mock"), {
      target: { value: "# New content" },
    });
    expect(screen.getByTestId("markdown-editor-mock")).toHaveValue(
      "# New content",
    );
  });
});
