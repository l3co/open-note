import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MarkdownEditor } from "../MarkdownEditor";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

vi.mock("@codemirror/view", () => {
  const mockView = {
    destroy: vi.fn(),
    state: { doc: { toString: () => "" } },
    dispatch: vi.fn(),
  };
  const EditorViewCtor = vi.fn().mockImplementation(() => mockView);
  (EditorViewCtor as unknown as Record<string, unknown>).lineWrapping = {};
  (EditorViewCtor as unknown as Record<string, unknown>).updateListener = {
    of: () => ({}),
  };
  (EditorViewCtor as unknown as Record<string, unknown>).theme = () => ({});
  return {
    EditorView: EditorViewCtor,
    keymap: { of: () => ({}) },
    placeholder: () => ({}),
  };
});

vi.mock("@codemirror/state", () => ({
  EditorState: {
    create: () => ({}),
  },
}));

vi.mock("@codemirror/lang-markdown", () => ({
  markdown: () => ({}),
}));

vi.mock("@codemirror/theme-one-dark", () => ({
  oneDark: {},
}));

vi.mock("@codemirror/commands", () => ({
  defaultKeymap: [],
  indentWithTab: {},
}));

vi.mock("@codemirror/language", () => ({
  syntaxHighlighting: () => ({}),
  defaultHighlightStyle: {},
}));

describe("MarkdownEditor", () => {
  it("renders container div", () => {
    const { container } = render(
      <MarkdownEditor content="# Hello" onChange={vi.fn()} theme="light" />,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders with dark theme", () => {
    const { container } = render(
      <MarkdownEditor content="# Hello" onChange={vi.fn()} theme="dark" />,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders with min-height style", () => {
    const { container } = render(
      <MarkdownEditor content="" onChange={vi.fn()} theme="light" />,
    );
    const div = container.firstChild as HTMLElement;
    expect(div.style.minHeight).toBe("200px");
  });

  it("has proper class names", () => {
    const { container } = render(
      <MarkdownEditor content="" onChange={vi.fn()} theme="light" />,
    );
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain("max-w-3xl");
  });

  it("re-renders when theme changes", () => {
    const onChange = vi.fn();
    const { rerender, container } = render(
      <MarkdownEditor content="text" onChange={onChange} theme="light" />,
    );
    rerender(
      <MarkdownEditor content="text" onChange={onChange} theme="dark" />,
    );
    expect(container.firstChild).toBeInTheDocument();
  });
});
