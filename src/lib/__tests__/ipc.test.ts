import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

import * as ipc from "../ipc";

describe("ipc wrappers", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it("getAppState invokes get_app_state", async () => {
    mockInvoke.mockResolvedValue({ recent_workspaces: [] });
    const result = await ipc.getAppState();
    expect(mockInvoke).toHaveBeenCalledWith("get_app_state");
    expect(result).toEqual({ recent_workspaces: [] });
  });

  it("createWorkspace invokes with path and name", async () => {
    mockInvoke.mockResolvedValue({});
    await ipc.createWorkspace("/tmp/ws", "My WS");
    expect(mockInvoke).toHaveBeenCalledWith("create_workspace", {
      path: "/tmp/ws",
      name: "My WS",
    });
  });

  it("openWorkspace invokes with path", async () => {
    mockInvoke.mockResolvedValue({});
    await ipc.openWorkspace("/tmp/ws");
    expect(mockInvoke).toHaveBeenCalledWith("open_workspace", {
      path: "/tmp/ws",
    });
  });

  it("closeWorkspace invokes close_workspace", async () => {
    mockInvoke.mockResolvedValue(undefined);
    await ipc.closeWorkspace();
    expect(mockInvoke).toHaveBeenCalledWith("close_workspace", {
      workspaceId: undefined,
    });
  });

  it("removeRecentWorkspace invokes with path", async () => {
    mockInvoke.mockResolvedValue(undefined);
    await ipc.removeRecentWorkspace("/tmp/ws");
    expect(mockInvoke).toHaveBeenCalledWith("remove_recent_workspace", {
      path: "/tmp/ws",
    });
  });

  it("getWorkspaceSettings invokes get_workspace_settings", async () => {
    mockInvoke.mockResolvedValue({});
    await ipc.getWorkspaceSettings();
    expect(mockInvoke).toHaveBeenCalledWith("get_workspace_settings", {
      workspaceId: undefined,
    });
  });

  it("updateWorkspaceSettings invokes with settings", async () => {
    const settings = { auto_save: true };
    mockInvoke.mockResolvedValue(undefined);
    await ipc.updateWorkspaceSettings(settings as never);
    expect(mockInvoke).toHaveBeenCalledWith("update_workspace_settings", {
      settings,
    });
  });

  it("getGlobalSettings invokes get_global_settings", async () => {
    mockInvoke.mockResolvedValue({});
    await ipc.getGlobalSettings();
    expect(mockInvoke).toHaveBeenCalledWith("get_global_settings");
  });

  it("updateGlobalSettings invokes with settings", async () => {
    const settings = { theme: {} };
    mockInvoke.mockResolvedValue(undefined);
    await ipc.updateGlobalSettings(settings as never);
    expect(mockInvoke).toHaveBeenCalledWith("update_global_settings", {
      settings,
    });
  });

  it("listNotebooks invokes list_notebooks", async () => {
    mockInvoke.mockResolvedValue([]);
    await ipc.listNotebooks();
    expect(mockInvoke).toHaveBeenCalledWith("list_notebooks", {
      workspaceId: undefined,
    });
  });

  it("createNotebook invokes with name", async () => {
    mockInvoke.mockResolvedValue({});
    await ipc.createNotebook("NB");
    expect(mockInvoke).toHaveBeenCalledWith("create_notebook", { name: "NB" });
  });

  it("renameNotebook invokes with id and name", async () => {
    mockInvoke.mockResolvedValue({});
    await ipc.renameNotebook("nb-1", "New");
    expect(mockInvoke).toHaveBeenCalledWith("rename_notebook", {
      id: "nb-1",
      name: "New",
    });
  });

  it("deleteNotebook invokes with id", async () => {
    mockInvoke.mockResolvedValue(undefined);
    await ipc.deleteNotebook("nb-1");
    expect(mockInvoke).toHaveBeenCalledWith("delete_notebook", { id: "nb-1" });
  });

  it("reorderNotebooks invokes with order", async () => {
    const order: [string, number][] = [["nb-1", 0]];
    mockInvoke.mockResolvedValue(undefined);
    await ipc.reorderNotebooks(order);
    expect(mockInvoke).toHaveBeenCalledWith("reorder_notebooks", { order });
  });

  it("listSections invokes with notebookId", async () => {
    mockInvoke.mockResolvedValue([]);
    await ipc.listSections("nb-1");
    expect(mockInvoke).toHaveBeenCalledWith("list_sections", {
      notebookId: "nb-1",
    });
  });

  it("createSection invokes with notebookId and name", async () => {
    mockInvoke.mockResolvedValue({});
    await ipc.createSection("nb-1", "Sec");
    expect(mockInvoke).toHaveBeenCalledWith("create_section", {
      notebookId: "nb-1",
      name: "Sec",
    });
  });

  it("renameSection invokes with id and name", async () => {
    mockInvoke.mockResolvedValue({});
    await ipc.renameSection("sec-1", "New");
    expect(mockInvoke).toHaveBeenCalledWith("rename_section", {
      id: "sec-1",
      name: "New",
    });
  });

  it("deleteSection invokes with id", async () => {
    mockInvoke.mockResolvedValue(undefined);
    await ipc.deleteSection("sec-1");
    expect(mockInvoke).toHaveBeenCalledWith("delete_section", { id: "sec-1" });
  });

  it("reorderSections invokes with order", async () => {
    const order: [string, number][] = [["sec-1", 0]];
    mockInvoke.mockResolvedValue(undefined);
    await ipc.reorderSections(order);
    expect(mockInvoke).toHaveBeenCalledWith("reorder_sections", { order });
  });

  it("listPages invokes with sectionId", async () => {
    mockInvoke.mockResolvedValue([]);
    await ipc.listPages("sec-1");
    expect(mockInvoke).toHaveBeenCalledWith("list_pages", {
      sectionId: "sec-1",
    });
  });

  it("loadPage invokes with pageId", async () => {
    mockInvoke.mockResolvedValue({});
    await ipc.loadPage("page-1");
    expect(mockInvoke).toHaveBeenCalledWith("load_page", { pageId: "page-1" });
  });

  it("createPage invokes with sectionId and title", async () => {
    mockInvoke.mockResolvedValue({});
    await ipc.createPage("sec-1", "Page");
    expect(mockInvoke).toHaveBeenCalledWith("create_page", {
      sectionId: "sec-1",
      title: "Page",
    });
  });

  it("updatePage invokes with page", async () => {
    const page = { id: "p1" };
    mockInvoke.mockResolvedValue(undefined);
    await ipc.updatePage(page as never);
    expect(mockInvoke).toHaveBeenCalledWith("update_page", { page });
  });

  it("updatePageBlocks invokes with pageId and blocks", async () => {
    mockInvoke.mockResolvedValue({});
    await ipc.updatePageBlocks("page-1", []);
    expect(mockInvoke).toHaveBeenCalledWith("update_page_blocks", {
      pageId: "page-1",
      blocks: [],
    });
  });

  it("deletePage invokes with pageId", async () => {
    mockInvoke.mockResolvedValue(undefined);
    await ipc.deletePage("page-1");
    expect(mockInvoke).toHaveBeenCalledWith("delete_page", {
      pageId: "page-1",
    });
  });

  it("movePage invokes with pageId and targetSectionId", async () => {
    mockInvoke.mockResolvedValue({});
    await ipc.movePage("page-1", "sec-2");
    expect(mockInvoke).toHaveBeenCalledWith("move_page", {
      pageId: "page-1",
      targetSectionId: "sec-2",
    });
  });

  it("readFileContent invokes with path", async () => {
    mockInvoke.mockResolvedValue("content");
    const result = await ipc.readFileContent("/test.md");
    expect(mockInvoke).toHaveBeenCalledWith("read_file_content", {
      path: "/test.md",
    });
    expect(result).toBe("content");
  });

  it("saveFileContent invokes with path and content", async () => {
    mockInvoke.mockResolvedValue(undefined);
    await ipc.saveFileContent("/test.md", "data");
    expect(mockInvoke).toHaveBeenCalledWith("save_file_content", {
      path: "/test.md",
      content: "data",
    });
  });

  it("importPdf invokes with sectionId and filePath", async () => {
    mockInvoke.mockResolvedValue(["asset-id", 5]);
    await ipc.importPdf("sec-1", "/test.pdf");
    expect(mockInvoke).toHaveBeenCalledWith("import_pdf", {
      sectionId: "sec-1",
      filePath: "/test.pdf",
    });
  });

  it("listAllTags invokes list_all_tags", async () => {
    mockInvoke.mockResolvedValue(["tag1"]);
    const result = await ipc.listAllTags();
    expect(mockInvoke).toHaveBeenCalledWith("list_all_tags", {
      workspaceId: undefined,
    });
    expect(result).toEqual(["tag1"]);
  });

  it("listTrashItems invokes list_trash_items", async () => {
    mockInvoke.mockResolvedValue([]);
    await ipc.listTrashItems();
    expect(mockInvoke).toHaveBeenCalledWith("list_trash_items", {
      workspaceId: undefined,
    });
  });

  it("restoreFromTrash invokes with trashItemId", async () => {
    mockInvoke.mockResolvedValue(undefined);
    await ipc.restoreFromTrash("trash-1");
    expect(mockInvoke).toHaveBeenCalledWith("restore_from_trash", {
      trashItemId: "trash-1",
    });
  });

  it("permanentlyDelete invokes with trashItemId", async () => {
    mockInvoke.mockResolvedValue(undefined);
    await ipc.permanentlyDelete("trash-1");
    expect(mockInvoke).toHaveBeenCalledWith("permanently_delete", {
      trashItemId: "trash-1",
    });
  });

  it("emptyTrash invokes empty_trash", async () => {
    mockInvoke.mockResolvedValue(undefined);
    await ipc.emptyTrash();
    expect(mockInvoke).toHaveBeenCalledWith("empty_trash", {
      workspaceId: undefined,
    });
  });

  it("searchPages invokes with query", async () => {
    const query = { text: "test", limit: 10, offset: 0 };
    mockInvoke.mockResolvedValue({ items: [], total: 0, query_time_ms: 1 });
    await ipc.searchPages(query);
    expect(mockInvoke).toHaveBeenCalledWith("search_pages", { query });
  });

  it("quickOpen invokes with query and limit", async () => {
    mockInvoke.mockResolvedValue([]);
    await ipc.quickOpen("test", 5);
    expect(mockInvoke).toHaveBeenCalledWith("quick_open", {
      query: "test",
      limit: 5,
    });
  });

  it("reindexPage invokes with pageId", async () => {
    mockInvoke.mockResolvedValue(undefined);
    await ipc.reindexPage("page-1");
    expect(mockInvoke).toHaveBeenCalledWith("reindex_page", {
      pageId: "page-1",
    });
  });

  it("rebuildIndex invokes rebuild_index", async () => {
    mockInvoke.mockResolvedValue(42);
    const result = await ipc.rebuildIndex();
    expect(mockInvoke).toHaveBeenCalledWith("rebuild_index", {
      workspaceId: undefined,
    });
    expect(result).toBe(42);
  });

  it("getIndexStatus invokes get_index_status", async () => {
    mockInvoke.mockResolvedValue({});
    await ipc.getIndexStatus();
    expect(mockInvoke).toHaveBeenCalledWith("get_index_status", {
      workspaceId: undefined,
    });
  });

  it("getSyncProviders invokes get_sync_providers", async () => {
    mockInvoke.mockResolvedValue([]);
    await ipc.getSyncProviders();
    expect(mockInvoke).toHaveBeenCalledWith("get_sync_providers");
  });

  it("getSyncStatus invokes get_sync_status", async () => {
    mockInvoke.mockResolvedValue({});
    await ipc.getSyncStatus();
    expect(mockInvoke).toHaveBeenCalledWith("get_sync_status");
  });

  it("getSyncConfig invokes get_sync_config", async () => {
    mockInvoke.mockResolvedValue({});
    await ipc.getSyncConfig();
    expect(mockInvoke).toHaveBeenCalledWith("get_sync_config");
  });

  it("setSyncConfig invokes with config", async () => {
    const config = { enabled: true };
    mockInvoke.mockResolvedValue(undefined);
    await ipc.setSyncConfig(config as never);
    expect(mockInvoke).toHaveBeenCalledWith("set_sync_config", { config });
  });

  it("getSyncConflicts invokes get_sync_conflicts", async () => {
    mockInvoke.mockResolvedValue([]);
    await ipc.getSyncConflicts();
    expect(mockInvoke).toHaveBeenCalledWith("get_sync_conflicts");
  });

  it("resolveSyncConflict invokes with conflictId and resolution", async () => {
    mockInvoke.mockResolvedValue(undefined);
    await ipc.resolveSyncConflict("c1", "keep_local" as never);
    expect(mockInvoke).toHaveBeenCalledWith("resolve_sync_conflict", {
      conflictId: "c1",
      resolution: "keep_local",
    });
  });
});
