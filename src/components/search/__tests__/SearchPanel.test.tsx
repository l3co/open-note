import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SearchPanel } from "../SearchPanel";
import { useUIStore } from "@/stores/useUIStore";
import { useNavigationStore } from "@/stores/useNavigationStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mockSearchPages = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ipc", () => ({
  searchPages: mockSearchPages,
}));

describe("SearchPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUIStore.setState({ showSearchPanel: false });
    mockSearchPages.mockResolvedValue({
      items: [],
      total: 0,
      query_time_ms: 1,
    });
  });

  it("renders nothing when not visible", () => {
    const { container } = render(<SearchPanel />);
    expect(container.firstChild).toBeNull();
  });

  it("renders panel when visible", () => {
    useUIStore.setState({ showSearchPanel: true });
    render(<SearchPanel />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("closes on X button click", async () => {
    useUIStore.setState({ showSearchPanel: true });
    const user = userEvent.setup();
    render(<SearchPanel />);
    const closeBtn = screen.getByRole("button", { name: "" });
    await user.click(closeBtn);
    expect(useUIStore.getState().showSearchPanel).toBe(false);
  });

  it("shows no results message when query has no matches", async () => {
    useUIStore.setState({ showSearchPanel: true });
    const user = userEvent.setup();
    render(<SearchPanel />);
    await user.type(screen.getByRole("textbox"), "nonexistent");
    await vi.waitFor(
      () => {
        expect(mockSearchPages).toHaveBeenCalled();
      },
      { timeout: 600 },
    );
    expect(screen.getByText(/no.*result|nenhum/i)).toBeInTheDocument();
  });

  it("displays search results with snippets", async () => {
    const results = {
      items: [
        {
          page_id: "p1",
          title: "Found Page",
          notebook_name: "NB",
          section_name: "Sec",
          snippet: "...matched text...",
          score: 1.0,
          tags: [],
          updated_at: "2024-01-01T00:00:00Z",
        },
      ],
      total: 1,
      query_time_ms: 5,
    };
    mockSearchPages.mockResolvedValue(results);
    useUIStore.setState({ showSearchPanel: true });
    const user = userEvent.setup();
    render(<SearchPanel />);
    await user.type(screen.getByRole("textbox"), "found");
    await vi.waitFor(
      () => {
        expect(screen.getByText("Found Page")).toBeInTheDocument();
      },
      { timeout: 600 },
    );
    expect(screen.getByText("...matched text...")).toBeInTheDocument();
  });

  it("selects page on result click", async () => {
    const selectPage = vi.fn();
    useNavigationStore.setState({ selectPage });
    const results = {
      items: [
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
      ],
      total: 1,
      query_time_ms: 2,
    };
    mockSearchPages.mockResolvedValue(results);
    useUIStore.setState({ showSearchPanel: true });
    const user = userEvent.setup();
    render(<SearchPanel />);
    await user.type(screen.getByRole("textbox"), "result");
    await vi.waitFor(
      () => {
        expect(screen.getByText("Result")).toBeInTheDocument();
      },
      { timeout: 600 },
    );
    await user.click(screen.getByText("Result"));
    expect(selectPage).toHaveBeenCalledWith("p1");
  });

  it("shows result count and query time", async () => {
    const results = {
      items: [
        {
          page_id: "p1",
          title: "Page",
          notebook_name: "NB",
          section_name: "S",
          snippet: null,
          score: 1,
          tags: [],
          updated_at: null,
        },
      ],
      total: 1,
      query_time_ms: 3,
    };
    mockSearchPages.mockResolvedValue(results);
    useUIStore.setState({ showSearchPanel: true });
    const user = userEvent.setup();
    render(<SearchPanel />);
    await user.type(screen.getByRole("textbox"), "page");
    await vi.waitFor(
      () => {
        expect(screen.getByText(/3ms/)).toBeInTheDocument();
      },
      { timeout: 600 },
    );
  });

  it("resets state when reopened", () => {
    useUIStore.setState({ showSearchPanel: true });
    const { rerender } = render(<SearchPanel />);
    useUIStore.setState({ showSearchPanel: false });
    rerender(<SearchPanel />);
    useUIStore.setState({ showSearchPanel: true });
    rerender(<SearchPanel />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("");
  });
});
