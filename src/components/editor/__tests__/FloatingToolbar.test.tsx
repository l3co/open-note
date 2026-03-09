import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FloatingToolbar } from "../FloatingToolbar";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mockRun = vi.fn();
const mockChain = () => ({
  focus: () => ({
    toggleBold: () => ({ run: mockRun }),
    toggleItalic: () => ({ run: mockRun }),
    toggleUnderline: () => ({ run: mockRun }),
    toggleStrike: () => ({ run: mockRun }),
    toggleCode: () => ({ run: mockRun }),
    toggleHeading: () => ({ run: mockRun }),
    toggleBlockquote: () => ({ run: mockRun }),
    setLink: () => ({ run: mockRun }),
    unsetLink: () => ({ run: mockRun }),
  }),
});

const mockEditor = {
  chain: mockChain,
  isActive: vi.fn(() => false),
  getAttributes: vi.fn(() => ({ href: "" })),
  view: { state: { selection: { empty: false } } },
  on: vi.fn(),
  off: vi.fn(),
} as unknown;

vi.mock("@tiptap/react/menus", () => ({
  BubbleMenu: ({
    children,
    editor,
  }: {
    children: React.ReactNode;
    editor: unknown;
  }) => (editor ? <div data-testid="bubble-menu">{children}</div> : null),
}));

describe("FloatingToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders toolbar buttons inside BubbleMenu", () => {
    render(
      <FloatingToolbar editor={mockEditor as import("@tiptap/react").Editor} />,
    );
    expect(screen.getByTestId("bubble-menu")).toBeInTheDocument();
  });

  it("renders bold button", () => {
    render(
      <FloatingToolbar editor={mockEditor as import("@tiptap/react").Editor} />,
    );
    expect(screen.getByTitle("Negrito (Cmd+B)")).toBeInTheDocument();
  });

  it("renders italic button", () => {
    render(
      <FloatingToolbar editor={mockEditor as import("@tiptap/react").Editor} />,
    );
    expect(screen.getByTitle("Itálico (Cmd+I)")).toBeInTheDocument();
  });

  it("renders underline button", () => {
    render(
      <FloatingToolbar editor={mockEditor as import("@tiptap/react").Editor} />,
    );
    expect(screen.getByTitle("Sublinhado (Cmd+U)")).toBeInTheDocument();
  });

  it("calls toggleBold on bold button click", async () => {
    const user = userEvent.setup();
    render(
      <FloatingToolbar editor={mockEditor as import("@tiptap/react").Editor} />,
    );
    await user.click(screen.getByTitle("Negrito (Cmd+B)"));
    expect(mockRun).toHaveBeenCalled();
  });

  it("calls toggleItalic on italic button click", async () => {
    const user = userEvent.setup();
    render(
      <FloatingToolbar editor={mockEditor as import("@tiptap/react").Editor} />,
    );
    await user.click(screen.getByTitle("Itálico (Cmd+I)"));
    expect(mockRun).toHaveBeenCalled();
  });

  it("calls toggleUnderline on underline button click", async () => {
    const user = userEvent.setup();
    render(
      <FloatingToolbar editor={mockEditor as import("@tiptap/react").Editor} />,
    );
    await user.click(screen.getByTitle("Sublinhado (Cmd+U)"));
    expect(mockRun).toHaveBeenCalled();
  });

  it("calls toggleStrike on strikethrough button click", async () => {
    const user = userEvent.setup();
    render(
      <FloatingToolbar editor={mockEditor as import("@tiptap/react").Editor} />,
    );
    await user.click(screen.getByTitle("Tachado (Cmd+Shift+S)"));
    expect(mockRun).toHaveBeenCalled();
  });

  it("calls toggleCode on code button click", async () => {
    const user = userEvent.setup();
    render(
      <FloatingToolbar editor={mockEditor as import("@tiptap/react").Editor} />,
    );
    await user.click(screen.getByTitle("Código (Cmd+E)"));
    expect(mockRun).toHaveBeenCalled();
  });

  it("renders heading buttons", () => {
    render(
      <FloatingToolbar editor={mockEditor as import("@tiptap/react").Editor} />,
    );
    expect(screen.getByTitle("Título 1")).toBeInTheDocument();
    expect(screen.getByTitle("Título 2")).toBeInTheDocument();
    expect(screen.getByTitle("Título 3")).toBeInTheDocument();
  });

  it("renders blockquote button", () => {
    render(
      <FloatingToolbar editor={mockEditor as import("@tiptap/react").Editor} />,
    );
    expect(screen.getByTitle("Citação")).toBeInTheDocument();
  });

  it("renders link button", () => {
    render(
      <FloatingToolbar editor={mockEditor as import("@tiptap/react").Editor} />,
    );
    expect(screen.getByTitle("Link (Cmd+K)")).toBeInTheDocument();
  });

  it("shows link popover on link button click", async () => {
    const user = userEvent.setup();
    render(
      <FloatingToolbar editor={mockEditor as import("@tiptap/react").Editor} />,
    );
    await user.click(screen.getByTitle("Link (Cmd+K)"));
    expect(screen.getByPlaceholderText("https://...")).toBeInTheDocument();
  });

  it("highlights active bold button", () => {
    (
      mockEditor as { isActive: ReturnType<typeof vi.fn> }
    ).isActive.mockImplementation((name: string) => name === "bold");
    render(
      <FloatingToolbar editor={mockEditor as import("@tiptap/react").Editor} />,
    );
    const boldBtn = screen.getByTitle("Negrito (Cmd+B)");
    expect(boldBtn.style.backgroundColor).toBe("var(--accent-subtle)");
  });
});
