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
  unlockPage: vi.fn(),
  lockPage: vi.fn(),
  setPagePassword: vi.fn(),
  removePagePassword: vi.fn(),
  changePagePassword: vi.fn(),
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
  schema_version: 2,
  sort_order: 0,
  editor_preferences: { mode: "rich_text" as const, split_view: false },
  annotations: { strokes: [], highlights: [], svg_cache: null },
  pdf_asset: null,
  pdf_total_pages: null,
  canvas_state: null,
  protection: null,
  encrypted_content: null,
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
    const summaries = [
      { id: "p1", title: "Page 1", sort_order: 0, is_protected: false },
    ];
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

  it("loadPage sets lockState to locked for protected page with encrypted content", async () => {
    const lockedPage = makePage({
      protection: {
        salt: "aa",
        nonce: "bb",
        encrypted_title: "ct",
        algorithm: "AesGcm256",
        kdf: {},
      },
      encrypted_content: "enc",
      blocks: [],
    });
    mockIpc.loadPage.mockResolvedValue(lockedPage);

    await usePageStore.getState().loadPage("page-1");

    expect(usePageStore.getState().lockState).toBe("locked");
    expect(usePageStore.getState().currentPage).toEqual(lockedPage);
  });

  it("loadPage sets lockState to unlocked for normal page", async () => {
    const page = makePage();
    mockIpc.loadPage.mockResolvedValue(page);

    await usePageStore.getState().loadPage("page-1");

    expect(usePageStore.getState().lockState).toBe("unlocked");
  });

  it("unlockPage calls IPC and sets lockState to unlocked", async () => {
    const page = makePage({ title: "Secret Page" });
    mockIpc.unlockPage.mockResolvedValue(page);
    mockIpc.listPages.mockResolvedValue([]);

    await usePageStore.getState().unlockPage("page-1", "password123", 30);

    expect(mockIpc.unlockPage).toHaveBeenCalledWith(
      "page-1",
      "password123",
      30,
    );
    expect(usePageStore.getState().currentPage).toEqual(page);
    expect(usePageStore.getState().lockState).toBe("unlocked");
  });

  it("unlockPage re-throws on IPC failure", async () => {
    mockIpc.unlockPage.mockRejectedValue(new Error("WRONG_PASSWORD"));

    await expect(
      usePageStore.getState().unlockPage("page-1", "wrong", 30),
    ).rejects.toThrow("WRONG_PASSWORD");

    expect(usePageStore.getState().isLoading).toBe(false);
  });

  it("lockPage calls IPC and reloads page if it is current", async () => {
    const page = makePage();
    usePageStore.setState({ currentPage: page });
    mockIpc.lockPage.mockResolvedValue(undefined);
    mockIpc.loadPage.mockResolvedValue(page);

    await usePageStore.getState().lockPage("page-1");

    expect(mockIpc.lockPage).toHaveBeenCalledWith("page-1");
    expect(mockIpc.loadPage).toHaveBeenCalledWith("page-1");
  });

  it("lockPage does not reload if page is not current", async () => {
    mockIpc.lockPage.mockResolvedValue(undefined);

    await usePageStore.getState().lockPage("page-other");

    expect(mockIpc.lockPage).toHaveBeenCalledWith("page-other");
    expect(mockIpc.loadPage).not.toHaveBeenCalled();
  });

  it("lockPage sets error on failure", async () => {
    mockIpc.lockPage.mockRejectedValue(new Error("lock failed"));

    await usePageStore.getState().lockPage("page-1");

    expect(usePageStore.getState().error).toContain("lock failed");
  });

  it("setPagePassword calls IPC and reloads page", async () => {
    const page = makePage();
    mockIpc.setPagePassword.mockResolvedValue(undefined);
    mockIpc.loadPage.mockResolvedValue(page);
    mockIpc.listPages.mockResolvedValue([]);

    await usePageStore.getState().setPagePassword("page-1", "newpass");

    expect(mockIpc.setPagePassword).toHaveBeenCalledWith("page-1", "newpass");
    expect(usePageStore.getState().isSaving).toBe(false);
  });

  it("setPagePassword re-throws on IPC failure", async () => {
    mockIpc.setPagePassword.mockRejectedValue(new Error("protect failed"));

    await expect(
      usePageStore.getState().setPagePassword("page-1", "pass"),
    ).rejects.toThrow("protect failed");

    expect(usePageStore.getState().isSaving).toBe(false);
    expect(usePageStore.getState().error).toContain("protect failed");
  });

  it("removePagePassword calls IPC and sets unlocked state", async () => {
    const page = makePage();
    mockIpc.removePagePassword.mockResolvedValue(page);
    mockIpc.listPages.mockResolvedValue([]);

    await usePageStore.getState().removePagePassword("page-1", "oldpass");

    expect(mockIpc.removePagePassword).toHaveBeenCalledWith(
      "page-1",
      "oldpass",
    );
    expect(usePageStore.getState().currentPage).toEqual(page);
    expect(usePageStore.getState().lockState).toBe("unlocked");
    expect(usePageStore.getState().isSaving).toBe(false);
  });

  it("removePagePassword re-throws on IPC failure", async () => {
    mockIpc.removePagePassword.mockRejectedValue(new Error("WRONG_PASSWORD"));

    await expect(
      usePageStore.getState().removePagePassword("page-1", "wrong"),
    ).rejects.toThrow("WRONG_PASSWORD");

    expect(usePageStore.getState().isSaving).toBe(false);
  });

  it("changePagePassword calls IPC and clears isSaving", async () => {
    mockIpc.changePagePassword.mockResolvedValue(undefined);

    await usePageStore.getState().changePagePassword("page-1", "old", "new");

    expect(mockIpc.changePagePassword).toHaveBeenCalledWith(
      "page-1",
      "old",
      "new",
    );
    expect(usePageStore.getState().isSaving).toBe(false);
  });

  it("changePagePassword re-throws on IPC failure", async () => {
    mockIpc.changePagePassword.mockRejectedValue(new Error("WRONG_PASSWORD"));

    await expect(
      usePageStore.getState().changePagePassword("page-1", "wrong", "new"),
    ).rejects.toThrow("WRONG_PASSWORD");

    expect(usePageStore.getState().isSaving).toBe(false);
    expect(usePageStore.getState().error).toContain("WRONG_PASSWORD");
  });
});
