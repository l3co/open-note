import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMultiWorkspaceStore } from "../useMultiWorkspaceStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const mockIpc = vi.hoisted(() => ({
  openWorkspace: vi.fn(),
  createWorkspace: vi.fn(),
  closeWorkspace: vi.fn(),
  focusWorkspace: vi.fn(),
  listNotebooks: vi.fn(),
  createNotebook: vi.fn(),
  renameNotebook: vi.fn(),
  deleteNotebook: vi.fn(),
  reorderNotebooks: vi.fn(),
  listSections: vi.fn(),
  createSection: vi.fn(),
  renameSection: vi.fn(),
  deleteSection: vi.fn(),
  reorderSections: vi.fn(),
  rebuildIndex: vi.fn(),
}));

vi.mock("@/lib/ipc", () => mockIpc);

import type { Workspace } from "@/types/bindings/Workspace";
import type { Section } from "@/types/bindings/Section";

function makeWorkspace(id = "ws-1", name = "Test Workspace"): Workspace {
  return {
    id,
    name,
    root_path: `/tmp/${id}`,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    settings: {
      default_notebook_id: null,
      auto_save_interval_ms: BigInt(1000),
      sidebar_width: 260,
      sidebar_open: true,
      last_opened_page_id: null,
    },
  } as Workspace;
}

function makeSection(id: string, notebookId: string): Section {
  return {
    id,
    notebook_id: notebookId,
    name: `Section ${id}`,
    color: null,
    order: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  } as Section;
}

function resetStore() {
  useMultiWorkspaceStore.setState({
    workspaces: new Map(),
    focusedWorkspaceId: null,
  });
}

describe("useMultiWorkspaceStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIpc.rebuildIndex.mockResolvedValue(0);
    mockIpc.focusWorkspace.mockResolvedValue(undefined);
    mockIpc.closeWorkspace.mockResolvedValue(undefined);
    resetStore();
  });

  // ─── Initial state ───

  it("initial_state_empty", () => {
    const { workspaces, focusedWorkspaceId } =
      useMultiWorkspaceStore.getState();
    expect(workspaces.size).toBe(0);
    expect(focusedWorkspaceId).toBeNull();
  });

  it("focusedSlice returns null when no workspace open", () => {
    const slice = useMultiWorkspaceStore.getState().focusedSlice();
    expect(slice).toBeNull();
  });

  // ─── openWorkspace ───

  it("open_workspace_adds_to_map", async () => {
    const ws = makeWorkspace();
    mockIpc.openWorkspace.mockResolvedValue(ws);
    mockIpc.listNotebooks.mockResolvedValue([]);

    await useMultiWorkspaceStore.getState().openWorkspace("/tmp/ws-1");

    const { workspaces, focusedWorkspaceId } =
      useMultiWorkspaceStore.getState();
    expect(workspaces.size).toBe(1);
    expect(workspaces.has("ws-1")).toBe(true);
    expect(focusedWorkspaceId).toBe("ws-1");
  });

  it("open_second_workspace_keeps_first", async () => {
    const ws1 = makeWorkspace("ws-1", "WS 1");
    const ws2 = makeWorkspace("ws-2", "WS 2");
    mockIpc.openWorkspace.mockResolvedValueOnce(ws1).mockResolvedValueOnce(ws2);
    mockIpc.listNotebooks.mockResolvedValue([]);

    await useMultiWorkspaceStore.getState().openWorkspace("/tmp/ws-1");
    await useMultiWorkspaceStore.getState().openWorkspace("/tmp/ws-2");

    const { workspaces, focusedWorkspaceId } =
      useMultiWorkspaceStore.getState();
    expect(workspaces.size).toBe(2);
    expect(workspaces.has("ws-1")).toBe(true);
    expect(workspaces.has("ws-2")).toBe(true);
    expect(focusedWorkspaceId).toBe("ws-2");
  });

  it("open_workspace_throws_on_error", async () => {
    mockIpc.openWorkspace.mockRejectedValue(new Error("not found"));

    await expect(
      useMultiWorkspaceStore.getState().openWorkspace("/invalid"),
    ).rejects.toThrow("not found");

    expect(useMultiWorkspaceStore.getState().workspaces.size).toBe(0);
  });

  // ─── createWorkspace ───

  it("create_workspace_adds_to_map", async () => {
    const ws = makeWorkspace();
    mockIpc.createWorkspace.mockResolvedValue(ws);

    await useMultiWorkspaceStore
      .getState()
      .createWorkspace("/tmp", "Test Workspace");

    const { workspaces, focusedWorkspaceId } =
      useMultiWorkspaceStore.getState();
    expect(workspaces.size).toBe(1);
    expect(focusedWorkspaceId).toBe("ws-1");
    expect(workspaces.get("ws-1")!.notebooks).toEqual([]);
  });

  // ─── closeWorkspace ───

  it("close_workspace_removes_from_map", async () => {
    const ws = makeWorkspace();
    mockIpc.openWorkspace.mockResolvedValue(ws);
    mockIpc.listNotebooks.mockResolvedValue([]);
    await useMultiWorkspaceStore.getState().openWorkspace("/tmp/ws-1");

    await useMultiWorkspaceStore.getState().closeWorkspace("ws-1");

    expect(useMultiWorkspaceStore.getState().workspaces.size).toBe(0);
    expect(useMultiWorkspaceStore.getState().focusedWorkspaceId).toBeNull();
  });

  it("close_focused_moves_to_next", async () => {
    const ws1 = makeWorkspace("ws-1");
    const ws2 = makeWorkspace("ws-2");
    mockIpc.openWorkspace.mockResolvedValueOnce(ws1).mockResolvedValueOnce(ws2);
    mockIpc.listNotebooks.mockResolvedValue([]);
    await useMultiWorkspaceStore.getState().openWorkspace("/tmp/ws-1");
    await useMultiWorkspaceStore.getState().openWorkspace("/tmp/ws-2");

    await useMultiWorkspaceStore.getState().closeWorkspace("ws-2");

    const { workspaces, focusedWorkspaceId } =
      useMultiWorkspaceStore.getState();
    expect(workspaces.size).toBe(1);
    expect(focusedWorkspaceId).toBe("ws-1");
  });

  it("close_last_clears_focused", async () => {
    const ws = makeWorkspace();
    mockIpc.openWorkspace.mockResolvedValue(ws);
    mockIpc.listNotebooks.mockResolvedValue([]);
    await useMultiWorkspaceStore.getState().openWorkspace("/tmp/ws-1");

    await useMultiWorkspaceStore.getState().closeWorkspace("ws-1");

    expect(useMultiWorkspaceStore.getState().focusedWorkspaceId).toBeNull();
  });

  // ─── focusWorkspace ───

  it("focus_workspace_changes_focused", async () => {
    const ws1 = makeWorkspace("ws-1");
    const ws2 = makeWorkspace("ws-2");
    mockIpc.openWorkspace.mockResolvedValueOnce(ws1).mockResolvedValueOnce(ws2);
    mockIpc.listNotebooks.mockResolvedValue([]);
    await useMultiWorkspaceStore.getState().openWorkspace("/tmp/ws-1");
    await useMultiWorkspaceStore.getState().openWorkspace("/tmp/ws-2");

    useMultiWorkspaceStore.getState().focusWorkspace("ws-1");

    expect(useMultiWorkspaceStore.getState().focusedWorkspaceId).toBe("ws-1");
    expect(mockIpc.focusWorkspace).toHaveBeenCalledWith("ws-1");
  });

  // ─── Notebook scoping ───

  it("notebooks_scoped_per_workspace", async () => {
    const ws1 = makeWorkspace("ws-1");
    const ws2 = makeWorkspace("ws-2");
    const nbs1 = [{ id: "nb-a", name: "NB A", sort_order: 0 }];
    const nbs2 = [{ id: "nb-b", name: "NB B", sort_order: 0 }];

    mockIpc.openWorkspace.mockResolvedValueOnce(ws1).mockResolvedValueOnce(ws2);
    mockIpc.listNotebooks
      .mockResolvedValueOnce(nbs1)
      .mockResolvedValueOnce(nbs2);

    await useMultiWorkspaceStore.getState().openWorkspace("/tmp/ws-1");
    await useMultiWorkspaceStore.getState().openWorkspace("/tmp/ws-2");

    const { workspaces } = useMultiWorkspaceStore.getState();
    expect(workspaces.get("ws-1")!.notebooks).toEqual(nbs1);
    expect(workspaces.get("ws-2")!.notebooks).toEqual(nbs2);
  });

  // ─── Navigation scoping ───

  it("navigation_scoped_per_workspace", async () => {
    const ws1 = makeWorkspace("ws-1");
    const ws2 = makeWorkspace("ws-2");
    mockIpc.openWorkspace.mockResolvedValueOnce(ws1).mockResolvedValueOnce(ws2);
    mockIpc.listNotebooks.mockResolvedValue([]);
    await useMultiWorkspaceStore.getState().openWorkspace("/tmp/ws-1");
    await useMultiWorkspaceStore.getState().openWorkspace("/tmp/ws-2");

    useMultiWorkspaceStore.getState().updateNavigation("ws-1", (nav) => ({
      ...nav,
      selectedPageId: "page-x",
    }));

    const ws1Nav = useMultiWorkspaceStore
      .getState()
      .workspaces.get("ws-1")!.navigation;
    const ws2Nav = useMultiWorkspaceStore
      .getState()
      .workspaces.get("ws-2")!.navigation;
    expect(ws1Nav.selectedPageId).toBe("page-x");
    expect(ws2Nav.selectedPageId).toBeNull();
  });

  // ─── focusedSlice derived getter ───

  it("focused_slice_reflects_current_focused", async () => {
    const ws1 = makeWorkspace("ws-1");
    const ws2 = makeWorkspace("ws-2");
    mockIpc.openWorkspace.mockResolvedValueOnce(ws1).mockResolvedValueOnce(ws2);
    mockIpc.listNotebooks.mockResolvedValue([]);
    await useMultiWorkspaceStore.getState().openWorkspace("/tmp/ws-1");
    await useMultiWorkspaceStore.getState().openWorkspace("/tmp/ws-2");

    useMultiWorkspaceStore.getState().focusWorkspace("ws-1");
    expect(useMultiWorkspaceStore.getState().focusedSlice()?.workspace.id).toBe(
      "ws-1",
    );

    useMultiWorkspaceStore.getState().focusWorkspace("ws-2");
    expect(useMultiWorkspaceStore.getState().focusedSlice()?.workspace.id).toBe(
      "ws-2",
    );
  });

  // ─── Section scoping ───

  it("sections_scoped_per_workspace", async () => {
    const ws1 = makeWorkspace("ws-1");
    mockIpc.openWorkspace.mockResolvedValue(ws1);
    mockIpc.listNotebooks.mockResolvedValue([]);
    await useMultiWorkspaceStore.getState().openWorkspace("/tmp/ws-1");

    const secs = [makeSection("sec-1", "nb-1")];
    mockIpc.listSections.mockResolvedValue(secs);
    await useMultiWorkspaceStore.getState().loadSections("nb-1", "ws-1");

    const slice = useMultiWorkspaceStore.getState().workspaces.get("ws-1")!;
    expect(slice.sections.get("nb-1")).toEqual(secs);
  });

  it("createSection returns created section", async () => {
    const ws = makeWorkspace();
    mockIpc.openWorkspace.mockResolvedValue(ws);
    mockIpc.listNotebooks.mockResolvedValue([]);
    await useMultiWorkspaceStore.getState().openWorkspace("/tmp/ws-1");

    const sec = makeSection("sec-new", "nb-1");
    mockIpc.createSection.mockResolvedValue(sec);
    mockIpc.listSections.mockResolvedValue([sec]);

    const result = await useMultiWorkspaceStore
      .getState()
      .createSection("nb-1", "New Section", "ws-1");

    expect(result).toEqual(sec);
    expect(mockIpc.createSection).toHaveBeenCalledWith(
      "nb-1",
      "New Section",
      "ws-1",
    );
  });
});
