import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BlockEditor } from "../BlockEditor";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

vi.mock("@tiptap/react", () => {
  const mockEditor = {
    getJSON: () => ({ type: "doc", content: [] }),
    commands: { setContent: vi.fn() },
    isActive: vi.fn(() => false),
    can: () => ({ chain: () => ({ focus: () => ({ toggleBold: () => ({ run: vi.fn() }) }) }) }),
    chain: () => ({ focus: () => ({ toggleBold: () => ({ run: vi.fn() }) }) }),
    view: { state: { selection: { empty: true } } },
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
    state: { doc: { textContent: "" } },
  };
  return {
    useEditor: (opts: { onUpdate?: (p: { editor: typeof mockEditor }) => void }) => {
      if (opts?.onUpdate) {
        setTimeout(() => opts.onUpdate!({ editor: mockEditor }), 0);
      }
      return mockEditor;
    },
    EditorContent: ({ editor }: { editor: unknown }) =>
      editor ? <div data-testid="editor-content">Editor Content</div> : null,
  };
});

vi.mock("@tiptap/react/menus", () => ({
  BubbleMenu: () => null,
}));

vi.mock("@tiptap/starter-kit", () => ({
  default: { configure: () => ({}) },
}));
vi.mock("@tiptap/extension-placeholder", () => ({
  default: { configure: () => ({}) },
}));
vi.mock("@tiptap/extension-underline", () => ({ default: {} }));
vi.mock("@tiptap/extension-link", () => ({
  default: { configure: () => ({}) },
}));
vi.mock("@tiptap/extension-typography", () => ({ default: {} }));
vi.mock("@tiptap/extension-character-count", () => ({ default: {} }));
vi.mock("@tiptap/extension-code-block-lowlight", () => ({
  default: { configure: () => ({}) },
}));
vi.mock("@tiptap/extension-table", () => ({
  Table: { configure: () => ({}) },
}));
vi.mock("@tiptap/extension-table-row", () => ({ default: {} }));
vi.mock("@tiptap/extension-table-cell", () => ({ default: {} }));
vi.mock("@tiptap/extension-table-header", () => ({ default: {} }));
vi.mock("@tiptap/extension-task-list", () => ({
  default: { configure: () => ({}) },
}));
vi.mock("@tiptap/extension-task-item", () => ({
  default: { configure: () => ({}) },
}));
vi.mock("@tiptap/extension-image", () => ({
  default: { configure: () => ({}) },
}));
vi.mock("lowlight", () => ({
  common: {},
  createLowlight: () => ({}),
}));

vi.mock("@/components/editor/FloatingToolbar", () => ({
  FloatingToolbar: () => <div data-testid="floating-toolbar" />,
}));
vi.mock("@/components/editor/SlashCommandMenu", () => ({
  SlashCommandMenu: () => <div data-testid="slash-command-menu" />,
}));
vi.mock("@/components/editor/extensions/CalloutExtension", () => ({
  Callout: {},
}));
vi.mock("@/components/editor/extensions/InkBlockExtension", () => ({
  InkBlock: {},
}));
vi.mock("@/components/editor/extensions/PdfBlockExtension", () => ({
  PdfBlock: {},
}));
vi.mock("@/components/editor/extensions/SpellCheckExtension", () => ({
  SpellCheckExtension: { configure: () => ({}) },
}));

describe("BlockEditor", () => {
  const defaultProps = {
    initialContent: { type: "doc" as const, content: [] },
    onUpdate: vi.fn(),
    onEditorReady: vi.fn(),
  };

  it("renders editor content", () => {
    render(<BlockEditor {...defaultProps} />);
    expect(screen.getByTestId("editor-content")).toBeInTheDocument();
  });

  it("renders floating toolbar", () => {
    render(<BlockEditor {...defaultProps} />);
    expect(screen.getByTestId("floating-toolbar")).toBeInTheDocument();
  });

  it("renders slash command menu", () => {
    render(<BlockEditor {...defaultProps} />);
    expect(screen.getByTestId("slash-command-menu")).toBeInTheDocument();
  });

  it("calls onEditorReady when editor is initialized", async () => {
    render(<BlockEditor {...defaultProps} />);
    await vi.waitFor(() => {
      expect(defaultProps.onEditorReady).toHaveBeenCalled();
    });
  });

  it("calls onUpdate when editor content changes", async () => {
    render(<BlockEditor {...defaultProps} />);
    await vi.waitFor(() => {
      expect(defaultProps.onUpdate).toHaveBeenCalled();
    });
  });

  it("renders without onEditorReady", () => {
    const { onEditorReady: _unused, ...propsWithout } = defaultProps;
    void _unused;
    render(<BlockEditor {...propsWithout} />);
    expect(screen.getByTestId("editor-content")).toBeInTheDocument();
  });
});
