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
    expect(screen.getByRole("button", { name: /Cmd\+B/i })).toBeInTheDocument();
  });

  it("renders italic button", () => {
    render(
      <FloatingToolbar editor={mockEditor as import("@tiptap/react").Editor} />,
    );
    expect(screen.getByRole("button", { name: /Cmd\+I/i })).toBeInTheDocument();
  });

  it("renders underline button", () => {
    render(
      <FloatingToolbar editor={mockEditor as import("@tiptap/react").Editor} />,
    );
    expect(screen.getByRole("button", { name: /Cmd\+U/i })).toBeInTheDocument();
  });

  it("calls toggleBold on bold button click", async () => {
    const user = userEvent.setup();
    render(
      <FloatingToolbar editor={mockEditor as import("@tiptap/react").Editor} />,
    );
    await user.click(screen.getByRole("button", { name: /Cmd\+B/i }));
    expect(mockRun).toHaveBeenCalled();
  });

  it("calls toggleItalic on italic button click", async () => {
    const user = userEvent.setup();
    render(
      <FloatingToolbar editor={mockEditor as import("@tiptap/react").Editor} />,
    );
    await user.click(screen.getByRole("button", { name: /Cmd\+I/i }));
    expect(mockRun).toHaveBeenCalled();
  });

  it("calls toggleUnderline on underline button click", async () => {
    const user = userEvent.setup();
    render(
      <FloatingToolbar editor={mockEditor as import("@tiptap/react").Editor} />,
    );
    await user.click(screen.getByRole("button", { name: /Cmd\+U/i }));
    expect(mockRun).toHaveBeenCalled();
  });

  it("calls toggleStrike on strikethrough button click", async () => {
    const user = userEvent.setup();
    render(
      <FloatingToolbar editor={mockEditor as import("@tiptap/react").Editor} />,
    );
    await user.click(screen.getByRole("button", { name: /Cmd\+Shift\+S/i }));
    expect(mockRun).toHaveBeenCalled();
  });

  it("calls toggleCode on code button click", async () => {
    const user = userEvent.setup();
    render(
      <FloatingToolbar editor={mockEditor as import("@tiptap/react").Editor} />,
    );
    await user.click(screen.getByRole("button", { name: /Cmd\+E/i }));
    expect(mockRun).toHaveBeenCalled();
  });

  it("renders heading buttons", () => {
    render(
      <FloatingToolbar editor={mockEditor as import("@tiptap/react").Editor} />,
    );
    expect(
      screen.getByRole("button", {
        name: /heading.*1|1.*heading|h1|t[ií]tulo.*1|1.*t[ií]tulo/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /heading.*2|2.*heading|h2|t[ií]tulo.*2|2.*t[ií]tulo/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /heading.*3|3.*heading|h3|t[ií]tulo.*3|3.*t[ií]tulo/i,
      }),
    ).toBeInTheDocument();
  });

  it("renders blockquote button", () => {
    render(
      <FloatingToolbar editor={mockEditor as import("@tiptap/react").Editor} />,
    );
    expect(
      screen.getByRole("button", { name: /blockquote|cita/i }),
    ).toBeInTheDocument();
  });

  it("renders link button", () => {
    render(
      <FloatingToolbar editor={mockEditor as import("@tiptap/react").Editor} />,
    );
    expect(screen.getByRole("button", { name: /Cmd\+K/i })).toBeInTheDocument();
  });

  it("shows link popover on link button click", async () => {
    const user = userEvent.setup();
    render(
      <FloatingToolbar editor={mockEditor as import("@tiptap/react").Editor} />,
    );
    await user.click(screen.getByRole("button", { name: /Cmd\+K/i }));
    expect(screen.getByPlaceholderText("https://...")).toBeInTheDocument();
  });

  it("highlights active bold button", () => {
    (
      mockEditor as { isActive: ReturnType<typeof vi.fn> }
    ).isActive.mockImplementation((name: string) => name === "bold");
    render(
      <FloatingToolbar editor={mockEditor as import("@tiptap/react").Editor} />,
    );
    const boldBtn = screen.getByRole("button", { name: /Cmd\+B/i });
    expect(boldBtn).toHaveAttribute("data-active", "true");
  });
});
