import { describe, it, expect, vi, beforeEach } from "vitest";
import { useWorkspaceStore } from "../useWorkspaceStore";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const mockIpc = vi.hoisted(() => ({
  openWorkspace: vi.fn(),
  createWorkspace: vi.fn(),
  closeWorkspace: vi.fn(),
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
}));

vi.mock("@/lib/ipc", () => mockIpc);

import type { Workspace } from "@/types/bindings/Workspace";
import type { Section } from "@/types/bindings/Section";

const makeWorkspace = (): Workspace =>
  ({
    id: "ws-1",
    name: "Test Workspace",
    root_path: "/tmp/test-ws",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    settings: {
      default_notebook_id: null,
      auto_save_interval_ms: BigInt(1000),
      sidebar_width: 260,
      sidebar_open: true,
      last_opened_page_id: null,
    },
  }) as Workspace;

const makeSection = (id: string, nbId: string): Section =>
  ({
    id,
    notebook_id: nbId,
    name: `Section ${id}`,
    color: null,
    order: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  }) as Section;

describe("useWorkspaceStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState({
      workspace: null,
      notebooks: [],
      sections: new Map(),
      isLoading: false,
      error: null,
    });
  });

  it("has correct initial state", () => {
    const state = useWorkspaceStore.getState();
    expect(state.workspace).toBeNull();
    expect(state.notebooks).toEqual([]);
    expect(state.sections.size).toBe(0);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("openWorkspace sets workspace and loads notebooks", async () => {
    const ws = makeWorkspace();
    mockIpc.openWorkspace.mockResolvedValue(ws);
    mockIpc.listNotebooks.mockResolvedValue([]);

    await useWorkspaceStore.getState().openWorkspace("/tmp/test-ws");

    expect(useWorkspaceStore.getState().workspace).toEqual(ws);
    expect(useWorkspaceStore.getState().isLoading).toBe(false);
    expect(mockIpc.listNotebooks).toHaveBeenCalled();
  });

  it("openWorkspace sets error on failure", async () => {
    mockIpc.openWorkspace.mockRejectedValue(new Error("not found"));

    await useWorkspaceStore.getState().openWorkspace("/invalid");

    expect(useWorkspaceStore.getState().error).toContain("not found");
    expect(useWorkspaceStore.getState().isLoading).toBe(false);
  });

  it("createWorkspace sets workspace", async () => {
    const ws = makeWorkspace();
    mockIpc.createWorkspace.mockResolvedValue(ws);

    await useWorkspaceStore.getState().createWorkspace("/tmp/new", "New WS");

    expect(useWorkspaceStore.getState().workspace).toEqual(ws);
    expect(useWorkspaceStore.getState().notebooks).toEqual([]);
    expect(useWorkspaceStore.getState().isLoading).toBe(false);
  });

  it("createWorkspace sets error on failure", async () => {
    mockIpc.createWorkspace.mockRejectedValue(new Error("exists"));

    await useWorkspaceStore.getState().createWorkspace("/tmp/new", "New WS");

    expect(useWorkspaceStore.getState().error).toContain("exists");
  });

  it("closeWorkspace clears state", async () => {
    useWorkspaceStore.setState({ workspace: makeWorkspace(), notebooks: [] });
    mockIpc.closeWorkspace.mockResolvedValue(undefined);

    await useWorkspaceStore.getState().closeWorkspace();

    expect(useWorkspaceStore.getState().workspace).toBeNull();
    expect(useWorkspaceStore.getState().notebooks).toEqual([]);
  });

  it("closeWorkspace handles already-closed gracefully", async () => {
    mockIpc.closeWorkspace.mockRejectedValue(new Error("already closed"));

    await useWorkspaceStore.getState().closeWorkspace();

    expect(useWorkspaceStore.getState().workspace).toBeNull();
  });

  it("loadNotebooks fetches and stores notebooks", async () => {
    const nbs = [{ id: "nb-1", name: "NB1", sort_order: 0 }];
    mockIpc.listNotebooks.mockResolvedValue(nbs);

    await useWorkspaceStore.getState().loadNotebooks();

    expect(useWorkspaceStore.getState().notebooks).toEqual(nbs);
  });

  it("createNotebook creates and reloads", async () => {
    mockIpc.createNotebook.mockResolvedValue({});
    mockIpc.listNotebooks.mockResolvedValue([]);

    await useWorkspaceStore.getState().createNotebook("New NB");

    expect(mockIpc.createNotebook).toHaveBeenCalledWith("New NB");
    expect(mockIpc.listNotebooks).toHaveBeenCalled();
  });

  it("renameNotebook renames and reloads", async () => {
    mockIpc.renameNotebook.mockResolvedValue({});
    mockIpc.listNotebooks.mockResolvedValue([]);

    await useWorkspaceStore.getState().renameNotebook("nb-1", "Renamed");

    expect(mockIpc.renameNotebook).toHaveBeenCalledWith("nb-1", "Renamed");
  });

  it("deleteNotebook deletes and reloads", async () => {
    mockIpc.deleteNotebook.mockResolvedValue(undefined);
    mockIpc.listNotebooks.mockResolvedValue([]);

    await useWorkspaceStore.getState().deleteNotebook("nb-1");

    expect(mockIpc.deleteNotebook).toHaveBeenCalledWith("nb-1");
  });

  it("reorderNotebooks sends order and reloads", async () => {
    mockIpc.reorderNotebooks.mockResolvedValue(undefined);
    mockIpc.listNotebooks.mockResolvedValue([]);
    const order: [string, number][] = [
      ["nb-1", 0],
      ["nb-2", 1],
    ];

    await useWorkspaceStore.getState().reorderNotebooks(order);

    expect(mockIpc.reorderNotebooks).toHaveBeenCalledWith(order);
  });

  it("loadSections fetches sections by notebook", async () => {
    const secs = [{ id: "sec-1", name: "Section 1", notebook_id: "nb-1", sort_order: 0 }];
    mockIpc.listSections.mockResolvedValue(secs);

    await useWorkspaceStore.getState().loadSections("nb-1");

    expect(useWorkspaceStore.getState().sections.get("nb-1")).toEqual(secs);
  });

  it("createSection creates, reloads, and returns section", async () => {
    const created = makeSection("sec-new", "nb-1");
    mockIpc.createSection.mockResolvedValue(created);
    mockIpc.listSections.mockResolvedValue([created]);

    const result = await useWorkspaceStore.getState().createSection("nb-1", "New Section");

    expect(mockIpc.createSection).toHaveBeenCalledWith("nb-1", "New Section");
    expect(result).toEqual(created);
  });

  it("createSection returns undefined on error", async () => {
    mockIpc.createSection.mockRejectedValue(new Error("fail"));

    const result = await useWorkspaceStore.getState().createSection("nb-1", "X");

    expect(result).toBeUndefined();
    expect(useWorkspaceStore.getState().error).toContain("fail");
  });

  it("renameSection renames and reloads", async () => {
    mockIpc.renameSection.mockResolvedValue({ id: "sec-1", notebook_id: "nb-1" });
    mockIpc.listSections.mockResolvedValue([]);

    await useWorkspaceStore.getState().renameSection("sec-1", "Renamed");

    expect(mockIpc.renameSection).toHaveBeenCalledWith("sec-1", "Renamed");
  });

  it("deleteSection finds notebook and reloads", async () => {
    const sections = new Map([
      ["nb-1", [makeSection("sec-1", "nb-1")]],
    ]);
    useWorkspaceStore.setState({ sections });
    mockIpc.deleteSection.mockResolvedValue(undefined);
    mockIpc.listSections.mockResolvedValue([]);

    await useWorkspaceStore.getState().deleteSection("sec-1");

    expect(mockIpc.deleteSection).toHaveBeenCalledWith("sec-1");
  });

  it("reorderSections sends order", async () => {
    mockIpc.reorderSections.mockResolvedValue(undefined);
    const order: [string, number][] = [["sec-1", 0]];

    await useWorkspaceStore.getState().reorderSections(order);

    expect(mockIpc.reorderSections).toHaveBeenCalledWith(order);
  });

  it("clearError resets error", () => {
    useWorkspaceStore.setState({ error: "some error" });
    useWorkspaceStore.getState().clearError();
    expect(useWorkspaceStore.getState().error).toBeNull();
  });

  it("loadNotebooks sets error on failure", async () => {
    mockIpc.listNotebooks.mockRejectedValue(new Error("fail"));

    await useWorkspaceStore.getState().loadNotebooks();

    expect(useWorkspaceStore.getState().error).toContain("fail");
  });
});
