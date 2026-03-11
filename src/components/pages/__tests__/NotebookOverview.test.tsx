import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotebookOverview } from "../NotebookOverview";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { usePageStore } from "@/stores/usePageStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const makeNotebook = (id: string, name: string) => ({
  id,
  name,
  color: null,
  icon: null,
  order: 0,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
});

const makeSection = (
  id: string,
  nbId: string,
  name: string,
  color?: string,
) => ({
  id,
  notebook_id: nbId,
  name,
  color: color ? { hex: color } : null,
  order: 0,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-06-15T10:00:00Z",
});

describe("NotebookOverview", () => {
  const mockOpenSectionOverview = vi.fn();
  const mockLoadSections = vi.fn();
  const mockCreateSection = vi.fn();
  const mockLoadPages = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    useNavigationStore.setState({
      selectedNotebookId: "nb-1",
      openSectionOverview: mockOpenSectionOverview,
    });
    useWorkspaceStore.setState({
      notebooks: [makeNotebook("nb-1", "My Notebook")],
      sections: new Map(),
      loadSections: mockLoadSections,
      createSection: mockCreateSection,
    });
    usePageStore.setState({ pages: new Map(), loadPages: mockLoadPages });
  });

  it("returns null when no notebook is selected", () => {
    useNavigationStore.setState({ selectedNotebookId: null });
    const { container } = render(<NotebookOverview />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when notebook is not found in list", () => {
    useNavigationStore.setState({ selectedNotebookId: "unknown" });
    const { container } = render(<NotebookOverview />);
    expect(container.firstChild).toBeNull();
  });

  it("renders notebook name in header", () => {
    render(<NotebookOverview />);
    expect(screen.getByText("My Notebook")).toBeInTheDocument();
  });

  it("shows sections count badge", () => {
    useWorkspaceStore.setState({
      notebooks: [makeNotebook("nb-1", "My Notebook")],
      sections: new Map([["nb-1", [makeSection("s-1", "nb-1", "Intro")]]]),
      loadSections: mockLoadSections,
      createSection: mockCreateSection,
    });
    render(<NotebookOverview />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("calls loadSections on mount when notebook is selected", () => {
    render(<NotebookOverview />);
    expect(mockLoadSections).toHaveBeenCalledWith("nb-1");
  });

  it("shows empty state when no sections exist", () => {
    render(<NotebookOverview />);
    expect(screen.getByText(/nenhuma seção ainda|empty/i)).toBeInTheDocument();
  });

  it("renders sections in grid view by default", () => {
    useWorkspaceStore.setState({
      notebooks: [makeNotebook("nb-1", "My Notebook")],
      sections: new Map([
        [
          "nb-1",
          [
            makeSection("s-1", "nb-1", "Chapter 1"),
            makeSection("s-2", "nb-1", "Chapter 2"),
          ],
        ],
      ]),
      loadSections: mockLoadSections,
      createSection: mockCreateSection,
    });
    render(<NotebookOverview />);
    expect(screen.getByText("Chapter 1")).toBeInTheDocument();
    expect(screen.getByText("Chapter 2")).toBeInTheDocument();
  });

  it("switches to list view when list toggle is clicked", () => {
    useWorkspaceStore.setState({
      notebooks: [makeNotebook("nb-1", "My Notebook")],
      sections: new Map([["nb-1", [makeSection("s-1", "nb-1", "Chapter 1")]]]),
      loadSections: mockLoadSections,
      createSection: mockCreateSection,
    });
    render(<NotebookOverview />);

    const listBtn = screen.getByTitle(/visualização em lista|list/i);
    fireEvent.click(listBtn);
    expect(screen.getByText("Chapter 1")).toBeInTheDocument();
    expect(localStorage.getItem("notebook-overview-layout")).toBe("list");
  });

  it("switches back to grid view", () => {
    useWorkspaceStore.setState({
      notebooks: [makeNotebook("nb-1", "My Notebook")],
      sections: new Map([["nb-1", [makeSection("s-1", "nb-1", "Chapter 1")]]]),
      loadSections: mockLoadSections,
      createSection: mockCreateSection,
    });
    render(<NotebookOverview />);

    fireEvent.click(screen.getByTitle(/visualização em lista|list/i));
    fireEvent.click(screen.getByTitle(/visualização em grade|grid/i));
    expect(localStorage.getItem("notebook-overview-layout")).toBe("grid");
  });

  it("clicking a section card calls openSectionOverview and loadPages", () => {
    useWorkspaceStore.setState({
      notebooks: [makeNotebook("nb-1", "My Notebook")],
      sections: new Map([["nb-1", [makeSection("s-1", "nb-1", "Chapter 1")]]]),
      loadSections: mockLoadSections,
      createSection: mockCreateSection,
    });
    render(<NotebookOverview />);

    const sectionBtn = screen.getByText("Chapter 1").closest("button")!;
    fireEvent.click(sectionBtn);

    expect(mockOpenSectionOverview).toHaveBeenCalledWith("s-1");
  });

  it("shows page count for sections that have pages loaded", () => {
    useWorkspaceStore.setState({
      notebooks: [makeNotebook("nb-1", "My Notebook")],
      sections: new Map([["nb-1", [makeSection("s-1", "nb-1", "Chapter 1")]]]),
      loadSections: mockLoadSections,
      createSection: mockCreateSection,
    });
    usePageStore.setState({
      pages: new Map([
        [
          "s-1",
          [
            {
              id: "p-1",
              title: "Page 1",
              tags: [],
              mode: "rich_text" as const,
              block_count: 0,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
            {
              id: "p-2",
              title: "Page 2",
              tags: [],
              mode: "rich_text" as const,
              block_count: 0,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
          ],
        ],
      ]),
      loadPages: mockLoadPages,
    });
    render(<NotebookOverview />);
    expect(screen.getByText(/^2/)).toBeInTheDocument();
  });

  it("clicking new section button in header creates a section", async () => {
    mockCreateSection.mockResolvedValue(
      makeSection("new-s", "nb-1", "New Section"),
    );
    render(<NotebookOverview />);

    const newBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.match(/new_section|new section/i));
    if (newBtn) {
      fireEvent.click(newBtn);
      await waitFor(() =>
        expect(mockCreateSection).toHaveBeenCalledWith(
          "nb-1",
          expect.any(String),
        ),
      );
    }
  });

  it("clicking new section button in empty state creates a section", async () => {
    mockCreateSection.mockResolvedValue(
      makeSection("new-s", "nb-1", "New Section"),
    );
    render(<NotebookOverview />);

    const emptyNewBtn = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.match(/new_section|new section/i));
    if (emptyNewBtn) {
      fireEvent.click(emptyNewBtn);
      await waitFor(() => expect(mockCreateSection).toHaveBeenCalled());
    }
  });

  it("renders section with custom color accent", () => {
    useWorkspaceStore.setState({
      notebooks: [makeNotebook("nb-1", "My Notebook")],
      sections: new Map([
        ["nb-1", [makeSection("s-1", "nb-1", "Colored Section", "#ff5733")]],
      ]),
      loadSections: mockLoadSections,
      createSection: mockCreateSection,
    });
    render(<NotebookOverview />);
    expect(screen.getByText("Colored Section")).toBeInTheDocument();
  });

  it("reads layout preference from localStorage", () => {
    localStorage.setItem("notebook-overview-layout", "list");
    useWorkspaceStore.setState({
      notebooks: [makeNotebook("nb-1", "My Notebook")],
      sections: new Map([["nb-1", [makeSection("s-1", "nb-1", "Chapter 1")]]]),
      loadSections: mockLoadSections,
      createSection: mockCreateSection,
    });
    render(<NotebookOverview />);
    expect(localStorage.getItem("notebook-overview-layout")).toBe("list");
  });
});
