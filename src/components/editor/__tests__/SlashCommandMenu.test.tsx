import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SlashCommandMenu } from "../SlashCommandMenu";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mockRun = vi.fn();
const mockChain = () => ({
  focus: () => ({
    toggleHeading: () => ({ run: mockRun }),
    toggleBulletList: () => ({ run: mockRun }),
    toggleOrderedList: () => ({ run: mockRun }),
    toggleBlockquote: () => ({ run: mockRun }),
    toggleTaskList: () => ({ run: mockRun }),
    setHorizontalRule: () => ({ run: mockRun }),
    setCodeBlock: () => ({ run: mockRun }),
    insertTable: () => ({ run: mockRun }),
    setCallout: () => ({ run: mockRun }),
    setImage: () => ({ run: mockRun }),
    insertContent: () => ({ run: mockRun }),
    deleteRange: () => ({
      toggleHeading: () => ({ run: mockRun }),
      toggleBulletList: () => ({ run: mockRun }),
      toggleOrderedList: () => ({ run: mockRun }),
      toggleBlockquote: () => ({ run: mockRun }),
      toggleTaskList: () => ({ run: mockRun }),
      setHorizontalRule: () => ({ run: mockRun }),
      setCodeBlock: () => ({ run: mockRun }),
      insertTable: () => ({ run: mockRun }),
      setCallout: () => ({ run: mockRun }),
      setImage: () => ({ run: mockRun }),
      insertContent: () => ({ run: mockRun }),
    }),
  }),
});

const mockEditor = {
  chain: mockChain,
  isActive: vi.fn(() => false),
  view: {
    state: {
      selection: {
        $from: { start: () => 0, parent: { textContent: "" } },
        from: 0,
        to: 0,
        empty: true,
      },
      doc: { textBetween: () => "" },
    },
  },
  registerPlugin: vi.fn(),
  unregisterPlugin: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  state: {
    selection: {
      $from: { start: () => 0, parent: { textContent: "" } },
      from: 0,
    },
  },
} as unknown;

describe("SlashCommandMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { container } = render(
      <SlashCommandMenu
        editor={mockEditor as import("@tiptap/react").Editor}
      />,
    );
    expect(container).toBeDefined();
  });

  it("does not show menu by default", () => {
    render(
      <SlashCommandMenu
        editor={mockEditor as import("@tiptap/react").Editor}
      />,
    );
    expect(screen.queryByText("Título 1")).not.toBeInTheDocument();
  });

  it("menu renders nothing initially (no slash typed)", () => {
    const { container } = render(
      <SlashCommandMenu
        editor={mockEditor as import("@tiptap/react").Editor}
      />,
    );
    const menu = container.querySelector("[data-testid='slash-menu']");
    expect(menu).toBeNull();
  });
});
