import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotebookTree } from "../NotebookTree";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { usePageStore } from "@/stores/usePageStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const makeNotebook = (id: string, name: string) => ({
  id,
  name,
  workspace_id: "ws-1",
  color: null,
  order: 0,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
});

const makeSection = (id: string, nbId: string, name: string) => ({
  id,
  notebook_id: nbId,
  name,
  color: null,
  order: 0,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
});

const makePage = (id: string, title: string) => ({
  id,
  title,
  section_id: "sec-1",
  tags: [],
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
});

describe("NotebookTree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState({
      notebooks: [],
      sections: new Map(),
      loadSections: vi.fn(),
      reorderNotebooks: vi.fn(),
      renameNotebook: vi.fn(),
      renameSection: vi.fn(),
    });
    useNavigationStore.setState({
      selectedNotebookId: null,
      selectedSectionId: null,
      selectedPageId: null,
      expandedNotebooks: new Set(),
      expandedSections: new Set(),
      toggleNotebook: vi.fn(),
      selectNotebook: vi.fn(),
      toggleSection: vi.fn(),
      selectSection: vi.fn(),
      selectPage: vi.fn(),
    });
    usePageStore.setState({
      pages: new Map(),
      loadPages: vi.fn(),
      loadPage: vi.fn(),
    });
  });

  it("renders tree with aria-label", () => {
    render(<NotebookTree />);
    expect(screen.getByRole("tree")).toBeInTheDocument();
  });

  it("renders notebooks as tree items", () => {
    useWorkspaceStore.setState({
      notebooks: [makeNotebook("nb-1", "Notebook A")] as never,
    });
    render(<NotebookTree />);
    expect(screen.getByText("Notebook A")).toBeInTheDocument();
  });

  it("renders multiple notebooks", () => {
    useWorkspaceStore.setState({
      notebooks: [
        makeNotebook("nb-1", "Notebook A"),
        makeNotebook("nb-2", "Notebook B"),
      ] as never,
    });
    render(<NotebookTree />);
    expect(screen.getByText("Notebook A")).toBeInTheDocument();
    expect(screen.getByText("Notebook B")).toBeInTheDocument();
  });

  it("clicking notebook sets selectedNotebookId, calls toggleNotebook and loadSections", async () => {
    const toggleNotebook = vi.fn();
    const loadSections = vi.fn();
    useWorkspaceStore.setState({
      notebooks: [makeNotebook("nb-1", "NB")] as never,
      loadSections,
    });
    useNavigationStore.setState({ toggleNotebook });
    const user = userEvent.setup();
    render(<NotebookTree />);
    await user.click(screen.getByText("NB"));
    expect(useNavigationStore.getState().selectedNotebookId).toBe("nb-1");
    expect(toggleNotebook).toHaveBeenCalledWith("nb-1");
    expect(loadSections).toHaveBeenCalledWith("nb-1");
  });

  it("shows sections when notebook is expanded", () => {
    useWorkspaceStore.setState({
      notebooks: [makeNotebook("nb-1", "NB")] as never,
      sections: new Map([
        ["nb-1", [makeSection("sec-1", "nb-1", "Section 1")] as never],
      ]),
    });
    useNavigationStore.setState({
      expandedNotebooks: new Set(["nb-1"]),
    });
    render(<NotebookTree />);
    expect(screen.getByText("Section 1")).toBeInTheDocument();
  });

  it("hides sections when notebook is collapsed", () => {
    useWorkspaceStore.setState({
      notebooks: [makeNotebook("nb-1", "NB")] as never,
      sections: new Map([
        ["nb-1", [makeSection("sec-1", "nb-1", "Section 1")] as never],
      ]),
    });
    useNavigationStore.setState({
      expandedNotebooks: new Set(),
    });
    render(<NotebookTree />);
    expect(screen.queryByText("Section 1")).not.toBeInTheDocument();
  });

  it("clicking section sets selectedSectionId, calls toggleSection and loadPages", async () => {
    const toggleSection = vi.fn();
    const loadPages = vi.fn();
    useWorkspaceStore.setState({
      notebooks: [makeNotebook("nb-1", "NB")] as never,
      sections: new Map([
        ["nb-1", [makeSection("sec-1", "nb-1", "Sec")] as never],
      ]),
    });
    useNavigationStore.setState({
      expandedNotebooks: new Set(["nb-1"]),
      toggleSection,
    });
    usePageStore.setState({ loadPages });
    const user = userEvent.setup();
    render(<NotebookTree />);
    await user.click(screen.getByText("Sec"));
    expect(useNavigationStore.getState().selectedSectionId).toBe("sec-1");
    expect(toggleSection).toHaveBeenCalledWith("sec-1");
    expect(loadPages).toHaveBeenCalledWith("sec-1");
  });

  it("shows pages when section is expanded", () => {
    useWorkspaceStore.setState({
      notebooks: [makeNotebook("nb-1", "NB")] as never,
      sections: new Map([
        ["nb-1", [makeSection("sec-1", "nb-1", "Sec")] as never],
      ]),
    });
    useNavigationStore.setState({
      expandedNotebooks: new Set(["nb-1"]),
      expandedSections: new Set(["sec-1"]),
    });
    usePageStore.setState({
      pages: new Map([["sec-1", [makePage("p-1", "My Page")] as never]]),
    });
    render(<NotebookTree />);
    expect(screen.getByText("My Page")).toBeInTheDocument();
  });

  it("clicking page calls selectPage and loadPage", async () => {
    const selectPage = vi.fn();
    const loadPage = vi.fn();
    useWorkspaceStore.setState({
      notebooks: [makeNotebook("nb-1", "NB")] as never,
      sections: new Map([
        ["nb-1", [makeSection("sec-1", "nb-1", "Sec")] as never],
      ]),
    });
    useNavigationStore.setState({
      expandedNotebooks: new Set(["nb-1"]),
      expandedSections: new Set(["sec-1"]),
      selectPage,
    });
    usePageStore.setState({
      pages: new Map([["sec-1", [makePage("p-1", "Page")] as never]]),
      loadPage,
    });
    const user = userEvent.setup();
    render(<NotebookTree />);
    await user.click(screen.getByText("Page"));
    expect(selectPage).toHaveBeenCalledWith("p-1");
    expect(loadPage).toHaveBeenCalledWith("p-1");
  });

  it("shows context menu on right-click of notebook", async () => {
    useWorkspaceStore.setState({
      notebooks: [makeNotebook("nb-1", "NB")] as never,
    });
    render(<NotebookTree />);
    fireEvent.contextMenu(screen.getByText("NB"));
    expect(screen.getByText("Renomear")).toBeInTheDocument();
    expect(screen.getByText("Excluir")).toBeInTheDocument();
    expect(screen.getByText("Nova Seção")).toBeInTheDocument();
  });

  it("shows context menu on right-click of section", async () => {
    useWorkspaceStore.setState({
      notebooks: [makeNotebook("nb-1", "NB")] as never,
      sections: new Map([
        ["nb-1", [makeSection("sec-1", "nb-1", "Sec")] as never],
      ]),
    });
    useNavigationStore.setState({
      expandedNotebooks: new Set(["nb-1"]),
    });
    render(<NotebookTree />);
    fireEvent.contextMenu(screen.getByText("Sec"));
    expect(screen.getByText("Renomear")).toBeInTheDocument();
    expect(screen.getByText("Excluir")).toBeInTheDocument();
    expect(screen.getByText("Nova Página")).toBeInTheDocument();
  });

  it("shows context menu on right-click of page", async () => {
    useWorkspaceStore.setState({
      notebooks: [makeNotebook("nb-1", "NB")] as never,
      sections: new Map([
        ["nb-1", [makeSection("sec-1", "nb-1", "Sec")] as never],
      ]),
    });
    useNavigationStore.setState({
      expandedNotebooks: new Set(["nb-1"]),
      expandedSections: new Set(["sec-1"]),
    });
    usePageStore.setState({
      pages: new Map([["sec-1", [makePage("p-1", "Page")] as never]]),
    });
    render(<NotebookTree />);
    fireEvent.contextMenu(screen.getByText("Page"));
    expect(screen.getByText("Excluir")).toBeInTheDocument();
  });

  it("highlights selected notebook", () => {
    useWorkspaceStore.setState({
      notebooks: [makeNotebook("nb-1", "NB")] as never,
    });
    useNavigationStore.setState({ selectedNotebookId: "nb-1" });
    render(<NotebookTree />);
    const item = screen
      .getByText("NB")
      .closest('[role="button"]') as HTMLElement;
    expect(item.style.backgroundColor).toBe("var(--accent-subtle)");
  });

  it("shows empty tree when no notebooks", () => {
    render(<NotebookTree />);
    expect(screen.getByRole("tree")).toBeEmptyDOMElement();
  });

  it("opens inline rename on double-click", async () => {
    useWorkspaceStore.setState({
      notebooks: [makeNotebook("nb-1", "NB")] as never,
    });
    const user = userEvent.setup();
    render(<NotebookTree />);
    await user.dblClick(screen.getByText("NB"));
    expect(screen.getByDisplayValue("NB")).toBeInTheDocument();
  });

  it("opens inline rename on F2", async () => {
    useWorkspaceStore.setState({
      notebooks: [makeNotebook("nb-1", "NB")] as never,
    });
    render(<NotebookTree />);
    const item = screen.getByText("NB").closest('[role="button"]')!;
    fireEvent.keyDown(item, { key: "F2" });
    expect(screen.getByDisplayValue("NB")).toBeInTheDocument();
  });

  it("submits rename on Enter", async () => {
    const renameNotebook = vi.fn();
    useWorkspaceStore.setState({
      notebooks: [makeNotebook("nb-1", "NB")] as never,
      renameNotebook,
    });
    const user = userEvent.setup();
    render(<NotebookTree />);
    await user.dblClick(screen.getByText("NB"));
    const input = screen.getByDisplayValue("NB");
    await user.clear(input);
    await user.type(input, "Renamed{Enter}");
    expect(renameNotebook).toHaveBeenCalledWith("nb-1", "Renamed");
  });

  it("cancels rename on Escape", async () => {
    useWorkspaceStore.setState({
      notebooks: [makeNotebook("nb-1", "NB")] as never,
    });
    const user = userEvent.setup();
    render(<NotebookTree />);
    await user.dblClick(screen.getByText("NB"));
    const input = screen.getByDisplayValue("NB");
    await user.type(input, "{Escape}");
    expect(screen.getByText("NB")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("NB")).not.toBeInTheDocument();
  });

  it("Enter triggers click on tree item", () => {
    const toggleNotebook = vi.fn();
    const loadSections = vi.fn();
    useWorkspaceStore.setState({
      notebooks: [makeNotebook("nb-1", "NB")] as never,
      loadSections,
    });
    useNavigationStore.setState({ toggleNotebook });
    render(<NotebookTree />);
    const item = screen.getByText("NB").closest('[role="button"]')!;
    fireEvent.keyDown(item, { key: "Enter" });
    expect(useNavigationStore.getState().selectedNotebookId).toBe("nb-1");
    expect(toggleNotebook).toHaveBeenCalledWith("nb-1");
  });

  it("supports drag and drop on notebooks", () => {
    useWorkspaceStore.setState({
      notebooks: [
        makeNotebook("nb-1", "A"),
        makeNotebook("nb-2", "B"),
      ] as never,
    });
    render(<NotebookTree />);
    const itemA = screen.getByText("A").closest('[role="button"]')!;
    const itemB = screen.getByText("B").closest('[role="button"]')!;
    fireEvent.dragStart(itemA);
    fireEvent.dragOver(itemB);
    fireEvent.drop(itemB);
    fireEvent.dragEnd(itemA);
    expect(useWorkspaceStore.getState().reorderNotebooks).toHaveBeenCalled();
  });
});
