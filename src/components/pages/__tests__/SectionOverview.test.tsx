import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SectionOverview } from "../SectionOverview";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { usePageStore } from "@/stores/usePageStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue(null),
}));

const mockIpc = vi.hoisted(() => ({
  importPdf: vi.fn(),
  createPdfCanvasPage: vi.fn(),
}));
vi.mock("@/lib/ipc", () => mockIpc);

const makePageSummary = (id: string, title: string, tags: string[] = []) => ({
  id,
  title,
  tags,
  block_count: 0,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-02T00:00:00Z",
});

describe("SectionOverview", () => {
  const mockSelectPage = vi.fn();
  const mockLoadPage = vi.fn();
  const mockLoadPages = vi.fn();
  const mockCreatePage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    useNavigationStore.setState({
      selectedSectionId: "sec-1",
      selectPage: mockSelectPage,
    });
    usePageStore.setState({
      pages: new Map(),
      loadPages: mockLoadPages,
      loadPage: mockLoadPage,
      createPage: mockCreatePage,
    });
    useWorkspaceStore.setState({
      sections: new Map([
        [
          "nb-1",
          [
            {
              id: "sec-1",
              notebook_id: "nb-1",
              name: "My Section",
              color: null,
              order: 0,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
          ],
        ],
      ]),
    });
  });

  it("returns null when no section is selected", () => {
    useNavigationStore.setState({ selectedSectionId: null });
    const { container } = render(<SectionOverview />);
    expect(container.firstChild).toBeNull();
  });

  it("renders section name in header", () => {
    render(<SectionOverview />);
    expect(screen.getByText("My Section")).toBeInTheDocument();
  });

  it("shows page count badge", () => {
    usePageStore.setState({
      pages: new Map([["sec-1", [makePageSummary("p-1", "Page 1")]]]),
      loadPages: mockLoadPages,
      loadPage: mockLoadPage,
      createPage: mockCreatePage,
    });
    render(<SectionOverview />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("calls loadPages on mount when section is selected", () => {
    render(<SectionOverview />);
    expect(mockLoadPages).toHaveBeenCalledWith("sec-1");
  });

  it("shows empty state when section has no pages", () => {
    render(<SectionOverview />);
    expect(screen.getByText(/nenhuma página ainda|empty/i)).toBeInTheDocument();
  });

  it("renders pages in grid view by default", () => {
    usePageStore.setState({
      pages: new Map([
        [
          "sec-1",
          [
            makePageSummary("p-1", "Page One"),
            makePageSummary("p-2", "Page Two"),
          ],
        ],
      ]),
      loadPages: mockLoadPages,
      loadPage: mockLoadPage,
      createPage: mockCreatePage,
    });
    render(<SectionOverview />);
    expect(screen.getByText("Page One")).toBeInTheDocument();
    expect(screen.getByText("Page Two")).toBeInTheDocument();
  });

  it("switches to list view when list toggle is clicked", () => {
    usePageStore.setState({
      pages: new Map([["sec-1", [makePageSummary("p-1", "Page One")]]]),
      loadPages: mockLoadPages,
      loadPage: mockLoadPage,
      createPage: mockCreatePage,
    });
    render(<SectionOverview />);

    const listBtn = screen.getByTitle(/visualização em lista|list/i);
    fireEvent.click(listBtn);
    expect(screen.getByText("Page One")).toBeInTheDocument();
    expect(localStorage.getItem("section-overview-layout")).toBe("list");
  });

  it("switches back to grid view", () => {
    usePageStore.setState({
      pages: new Map([["sec-1", [makePageSummary("p-1", "Page One")]]]),
      loadPages: mockLoadPages,
      loadPage: mockLoadPage,
      createPage: mockCreatePage,
    });
    render(<SectionOverview />);

    fireEvent.click(screen.getByTitle(/visualização em lista|list/i));
    fireEvent.click(screen.getByTitle(/visualização em grade|grid/i));
    expect(localStorage.getItem("section-overview-layout")).toBe("grid");
  });

  it("clicking a page card calls selectPage and loadPage", () => {
    usePageStore.setState({
      pages: new Map([["sec-1", [makePageSummary("p-1", "My Page")]]]),
      loadPages: mockLoadPages,
      loadPage: mockLoadPage,
      createPage: mockCreatePage,
    });
    render(<SectionOverview />);

    const pageBtn = screen.getByText("My Page").closest("button")!;
    fireEvent.click(pageBtn);

    expect(mockSelectPage).toHaveBeenCalledWith("p-1");
    expect(mockLoadPage).toHaveBeenCalledWith("p-1");
  });

  it("clicking new page button in empty state creates a page", async () => {
    const newPage = { id: "new-p", title: "Untitled" };
    mockCreatePage.mockResolvedValue(newPage);

    render(<SectionOverview />);

    const newPageBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.match(/new_page|new page/i));
    if (newPageBtn) {
      fireEvent.click(newPageBtn);
      await waitFor(() =>
        expect(mockCreatePage).toHaveBeenCalledWith(
          "sec-1",
          expect.any(String),
        ),
      );
    }
  });

  it("renders tags on page cards", () => {
    usePageStore.setState({
      pages: new Map([
        ["sec-1", [makePageSummary("p-1", "Tagged Page", ["rust", "tauri"])]],
      ]),
      loadPages: mockLoadPages,
      loadPage: mockLoadPage,
      createPage: mockCreatePage,
    });
    render(<SectionOverview />);
    expect(screen.getByText("rust")).toBeInTheDocument();
    expect(screen.getByText("tauri")).toBeInTheDocument();
  });

  it("shows +N overflow when page has more than 3 tags", () => {
    const tags = ["a", "b", "c", "d", "e"];
    usePageStore.setState({
      pages: new Map([["sec-1", [makePageSummary("p-1", "Many Tags", tags)]]]),
      loadPages: mockLoadPages,
      loadPage: mockLoadPage,
      createPage: mockCreatePage,
    });
    render(<SectionOverview />);
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("shows pagination when pages exceed 24", () => {
    const manyPages = Array.from({ length: 25 }, (_, i) =>
      makePageSummary(`p-${i}`, `Page ${i}`),
    );
    usePageStore.setState({
      pages: new Map([["sec-1", manyPages]]),
      loadPages: mockLoadPages,
      loadPage: mockLoadPage,
      createPage: mockCreatePage,
    });
    render(<SectionOverview />);
    expect(screen.getByText("→")).toBeInTheDocument();
  });

  it("navigates to next page in pagination", () => {
    const manyPages = Array.from({ length: 25 }, (_, i) =>
      makePageSummary(`p-${i}`, `Page ${i}`),
    );
    usePageStore.setState({
      pages: new Map([["sec-1", manyPages]]),
      loadPages: mockLoadPages,
      loadPage: mockLoadPage,
      createPage: mockCreatePage,
    });
    render(<SectionOverview />);

    const nextBtn = screen.getByText("→");
    fireEvent.click(nextBtn);
    expect(screen.getByText("Page 24")).toBeInTheDocument();
  });

  it("prev button is disabled on first page", () => {
    const manyPages = Array.from({ length: 25 }, (_, i) =>
      makePageSummary(`p-${i}`, `Page ${i}`),
    );
    usePageStore.setState({
      pages: new Map([["sec-1", manyPages]]),
      loadPages: mockLoadPages,
      loadPage: mockLoadPage,
      createPage: mockCreatePage,
    });
    render(<SectionOverview />);

    const prevBtn = screen.getByText("←");
    expect(prevBtn).toBeDisabled();
  });

  it("reads layout preference from localStorage", () => {
    localStorage.setItem("section-overview-layout", "list");
    usePageStore.setState({
      pages: new Map([["sec-1", [makePageSummary("p-1", "Page One")]]]),
      loadPages: mockLoadPages,
      loadPage: mockLoadPage,
      createPage: mockCreatePage,
    });
    render(<SectionOverview />);
    expect(localStorage.getItem("section-overview-layout")).toBe("list");
  });
});
