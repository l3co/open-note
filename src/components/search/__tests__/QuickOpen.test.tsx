import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QuickOpen } from "../QuickOpen";
import { useUIStore } from "@/stores/useUIStore";
import { useNavigationStore } from "@/stores/useNavigationStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mockQuickOpen = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ipc", () => ({
  quickOpen: mockQuickOpen,
}));

describe("QuickOpen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUIStore.setState({ showQuickOpen: false });
    mockQuickOpen.mockResolvedValue([]);
  });

  it("renders nothing when not visible", () => {
    const { container } = render(<QuickOpen />);
    expect(container.firstChild).toBeNull();
  });

  it("renders dialog when visible", () => {
    useUIStore.setState({ showQuickOpen: true });
    render(<QuickOpen />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("closes on backdrop click", async () => {
    useUIStore.setState({ showQuickOpen: true });
    const user = userEvent.setup();
    const { container } = render(<QuickOpen />);
    const backdrop = container.firstChild as HTMLElement;
    await user.click(backdrop);
    expect(useUIStore.getState().showQuickOpen).toBe(false);
  });

  it("closes on Escape key", async () => {
    useUIStore.setState({ showQuickOpen: true });
    const user = userEvent.setup();
    render(<QuickOpen />);
    await user.keyboard("{Escape}");
    expect(useUIStore.getState().showQuickOpen).toBe(false);
  });

  it("shows no results message when query has no matches", async () => {
    useUIStore.setState({ showQuickOpen: true });
    const user = userEvent.setup();
    render(<QuickOpen />);
    await user.type(screen.getByRole("textbox"), "nonexistent");
    // Wait for debounce
    await vi.waitFor(
      () => {
        expect(mockQuickOpen).toHaveBeenCalled();
      },
      { timeout: 500 },
    );
    expect(screen.getByText(/no.*result|nenhum/i)).toBeInTheDocument();
  });

  it("displays search results", async () => {
    const results = [
      {
        page_id: "p1",
        title: "Found Page",
        notebook_name: "NB",
        section_name: "Sec",
        snippet: null,
        score: 1.0,
        tags: [],
        updated_at: null,
      },
    ];
    mockQuickOpen.mockResolvedValue(results);
    useUIStore.setState({ showQuickOpen: true });
    const user = userEvent.setup();
    render(<QuickOpen />);
    await user.type(screen.getByRole("textbox"), "found");
    await vi.waitFor(
      () => {
        expect(screen.getByText("Found Page")).toBeInTheDocument();
      },
      { timeout: 500 },
    );
  });

  it("selects page and closes on result click", async () => {
    const selectPage = vi.fn();
    useNavigationStore.setState({ selectPage });
    const results = [
      {
        page_id: "p1",
        title: "Result",
        notebook_name: "NB",
        section_name: "Sec",
        snippet: null,
        score: 1.0,
        tags: [],
        updated_at: null,
      },
    ];
    mockQuickOpen.mockResolvedValue(results);
    useUIStore.setState({ showQuickOpen: true });
    const user = userEvent.setup();
    render(<QuickOpen />);
    await user.type(screen.getByRole("textbox"), "result");
    await vi.waitFor(
      () => {
        expect(screen.getByText("Result")).toBeInTheDocument();
      },
      { timeout: 500 },
    );
    await user.click(screen.getByText("Result"));
    expect(selectPage).toHaveBeenCalledWith("p1");
    expect(useUIStore.getState().showQuickOpen).toBe(false);
  });

  it("resets state when reopened", () => {
    useUIStore.setState({ showQuickOpen: true });
    const { rerender } = render(<QuickOpen />);
    useUIStore.setState({ showQuickOpen: false });
    rerender(<QuickOpen />);
    useUIStore.setState({ showQuickOpen: true });
    rerender(<QuickOpen />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("");
  });
});
