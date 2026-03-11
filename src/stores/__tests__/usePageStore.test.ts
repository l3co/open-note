import { describe, it, expect, vi, beforeEach } from "vitest";
import { usePageStore } from "../usePageStore";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockIpc = vi.hoisted(() => ({
  listPages: vi.fn(),
  loadPage: vi.fn(),
  createPage: vi.fn(),
  updatePage: vi.fn(),
  updatePageBlocks: vi.fn(),
  deletePage: vi.fn(),
  movePage: vi.fn(),
}));

vi.mock("@/lib/ipc", () => mockIpc);

const makePage = (overrides = {}) => ({
  id: "page-1",
  title: "Test Page",
  section_id: "sec-1",
  blocks: [],
  tags: [],
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  schema_version: 1,
  sort_order: 0,
  editor_preferences: { mode: "rich_text" as const, split_view: false },
  annotations: { strokes: [], highlights: [], svg_cache: null },
  pdf_asset: null,
  pdf_total_pages: null,
  canvas_state: null,
  ...overrides,
});

describe("usePageStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePageStore.setState({
      currentPage: null,
      pages: new Map(),
      isLoading: false,
      isSaving: false,
      saveStatus: "idle",
      lastSavedAt: null,
      error: null,
    });
  });

  it("has correct initial state", () => {
    const state = usePageStore.getState();
    expect(state.currentPage).toBeNull();
    expect(state.pages.size).toBe(0);
    expect(state.isLoading).toBe(false);
    expect(state.saveStatus).toBe("idle");
  });

  it("loadPages stores pages by section id", async () => {
    const summaries = [{ id: "p1", title: "Page 1", sort_order: 0 }];
    mockIpc.listPages.mockResolvedValue(summaries);

    await usePageStore.getState().loadPages("sec-1");

    expect(mockIpc.listPages).toHaveBeenCalledWith("sec-1");
    expect(usePageStore.getState().pages.get("sec-1")).toEqual(summaries);
  });

  it("loadPages sets error on failure", async () => {
    mockIpc.listPages.mockRejectedValue(new Error("fail"));

    await usePageStore.getState().loadPages("sec-1");

    expect(usePageStore.getState().error).toContain("fail");
  });

  it("loadPage sets current page", async () => {
    const page = makePage();
    mockIpc.loadPage.mockResolvedValue(page);

    await usePageStore.getState().loadPage("page-1");

    expect(usePageStore.getState().isLoading).toBe(false);
    expect(usePageStore.getState().currentPage).toEqual(page);
  });

  it("loadPage sets loading state", async () => {
    mockIpc.loadPage.mockImplementation(
      () => new Promise((r) => setTimeout(() => r(makePage()), 100)),
    );

    const promise = usePageStore.getState().loadPage("page-1");
    expect(usePageStore.getState().isLoading).toBe(true);
    await promise;
    expect(usePageStore.getState().isLoading).toBe(false);
  });

  it("loadPage sets error on failure", async () => {
    mockIpc.loadPage.mockRejectedValue(new Error("not found"));

    await usePageStore.getState().loadPage("page-1");

    expect(usePageStore.getState().error).toContain("not found");
    expect(usePageStore.getState().isLoading).toBe(false);
  });

  it("createPage calls IPC and reloads section pages", async () => {
    const page = makePage();
    mockIpc.createPage.mockResolvedValue(page);
    mockIpc.listPages.mockResolvedValue([]);

    const result = await usePageStore
      .getState()
      .createPage("sec-1", "New Page");

    expect(mockIpc.createPage).toHaveBeenCalledWith("sec-1", "New Page");
    expect(result).toEqual(page);
  });

  it("updatePage saves and updates current page", async () => {
    const page = makePage();
    mockIpc.updatePage.mockResolvedValue(undefined);

    await usePageStore.getState().updatePage(page);

    expect(mockIpc.updatePage).toHaveBeenCalledWith(page);
    expect(usePageStore.getState().currentPage).toEqual(page);
    expect(usePageStore.getState().isSaving).toBe(false);
    expect(usePageStore.getState().lastSavedAt).toBeInstanceOf(Date);
  });

  it("updatePage sets error on failure", async () => {
    mockIpc.updatePage.mockRejectedValue(new Error("save failed"));

    await usePageStore.getState().updatePage(makePage());

    expect(usePageStore.getState().error).toContain("save failed");
    expect(usePageStore.getState().isSaving).toBe(false);
  });

  it("updatePageTitle does nothing without current page", async () => {
    await usePageStore.getState().updatePageTitle("New Title");
    expect(mockIpc.updatePage).not.toHaveBeenCalled();
  });

  it("updatePageTitle updates title of current page", async () => {
    const page = makePage();
    usePageStore.setState({ currentPage: page });
    mockIpc.updatePage.mockResolvedValue(undefined);
    mockIpc.listPages.mockResolvedValue([]);

    await usePageStore.getState().updatePageTitle("Updated Title");

    expect(mockIpc.updatePage).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Updated Title" }),
    );
  });

  it("deletePage clears current page if matching", async () => {
    const page = makePage();
    usePageStore.setState({ currentPage: page });
    mockIpc.deletePage.mockResolvedValue(undefined);

    await usePageStore.getState().deletePage("page-1");

    expect(usePageStore.getState().currentPage).toBeNull();
  });

  it("deletePage sets error on failure", async () => {
    mockIpc.deletePage.mockRejectedValue(new Error("delete failed"));

    await usePageStore.getState().deletePage("page-1");

    expect(usePageStore.getState().error).toContain("delete failed");
  });

  it("movePage calls IPC and reloads", async () => {
    mockIpc.movePage.mockResolvedValue(undefined);

    await usePageStore.getState().movePage("page-1", "sec-2");

    expect(mockIpc.movePage).toHaveBeenCalledWith("page-1", "sec-2");
  });

  it("movePage sets error on failure", async () => {
    mockIpc.movePage.mockRejectedValue(new Error("move failed"));

    await usePageStore.getState().movePage("page-1", "sec-2");

    expect(usePageStore.getState().error).toContain("move failed");
  });

  it("updateBlocks saves and sets saved status", async () => {
    const page = makePage();
    mockIpc.updatePageBlocks.mockResolvedValue(page);

    const result = await usePageStore.getState().updateBlocks("page-1", []);

    expect(usePageStore.getState().saveStatus).toBe("saved");
    expect(usePageStore.getState().currentPage).toEqual(page);
    expect(result).toEqual(page);
  });

  it("updateBlocks sets error status on failure", async () => {
    mockIpc.updatePageBlocks.mockRejectedValue(new Error("block save failed"));

    await expect(
      usePageStore.getState().updateBlocks("page-1", []),
    ).rejects.toThrow("block save failed");

    expect(usePageStore.getState().saveStatus).toBe("error");
  });

  it("setCurrentPage sets current page directly", () => {
    const page = makePage();
    usePageStore.getState().setCurrentPage(page);
    expect(usePageStore.getState().currentPage).toEqual(page);
  });

  it("setSaveStatus sets save status directly", () => {
    usePageStore.getState().setSaveStatus("saving");
    expect(usePageStore.getState().saveStatus).toBe("saving");
  });

  it("clearCurrentPage resets page and status", () => {
    usePageStore.setState({ currentPage: makePage(), saveStatus: "saved" });
    usePageStore.getState().clearCurrentPage();
    expect(usePageStore.getState().currentPage).toBeNull();
    expect(usePageStore.getState().saveStatus).toBe("idle");
  });

  it("clearError resets error", () => {
    usePageStore.setState({ error: "some error" });
    usePageStore.getState().clearError();
    expect(usePageStore.getState().error).toBeNull();
  });
});
