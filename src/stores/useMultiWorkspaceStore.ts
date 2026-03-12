import { create } from "zustand";
import { toast } from "sonner";
import type { Notebook } from "@/types/bindings/Notebook";
import type { Section } from "@/types/bindings/Section";
import type { Workspace } from "@/types/bindings/Workspace";
import * as ipc from "@/lib/ipc";

export type ActiveView = "home" | "page" | "tags" | "section" | "notebook";

export interface WorkspaceNavigation {
  activeView: ActiveView;
  selectedNotebookId: string | null;
  selectedSectionId: string | null;
  selectedPageId: string | null;
  expandedNotebooks: Set<string>;
  expandedSections: Set<string>;
  history: string[];
  historyIndex: number;
}

export interface WorkspaceSlice {
  workspace: Workspace;
  notebooks: Notebook[];
  sections: Map<string, Section[]>;
  navigation: WorkspaceNavigation;
}

function defaultNavigation(): WorkspaceNavigation {
  return {
    activeView: "home",
    selectedNotebookId: null,
    selectedSectionId: null,
    selectedPageId: null,
    expandedNotebooks: new Set(),
    expandedSections: new Set(),
    history: [],
    historyIndex: -1,
  };
}

interface MultiWorkspaceStore {
  workspaces: Map<string, WorkspaceSlice>;
  focusedWorkspaceId: string | null;

  // ─── Derived getters ───
  focusedSlice: () => WorkspaceSlice | null;
  focusedWorkspace: () => Workspace | null;
  focusedNotebooks: () => Notebook[];

  // ─── Workspace lifecycle ───
  openWorkspace: (path: string) => Promise<Workspace | null>;
  forceOpenWorkspace: (path: string) => Promise<Workspace | null>;
  createWorkspace: (path: string, name: string) => Promise<Workspace | null>;
  closeWorkspace: (workspaceId: string) => Promise<void>;
  focusWorkspace: (workspaceId: string) => void;

  // ─── Scoped notebook actions (operate on focused workspace) ───
  loadNotebooks: (workspaceId?: string) => Promise<void>;
  createNotebook: (name: string, workspaceId?: string) => Promise<void>;
  renameNotebook: (
    id: string,
    name: string,
    workspaceId?: string,
  ) => Promise<void>;
  deleteNotebook: (id: string, workspaceId?: string) => Promise<void>;
  reorderNotebooks: (
    order: [string, number][],
    workspaceId?: string,
  ) => Promise<void>;

  // ─── Scoped section actions ───
  loadSections: (notebookId: string, workspaceId?: string) => Promise<void>;
  createSection: (
    notebookId: string,
    name: string,
    workspaceId?: string,
  ) => Promise<Section | undefined>;
  renameSection: (
    id: string,
    name: string,
    workspaceId?: string,
  ) => Promise<void>;
  deleteSection: (id: string, workspaceId?: string) => Promise<void>;
  reorderSections: (
    order: [string, number][],
    workspaceId?: string,
  ) => Promise<void>;
  moveSection: (
    sectionId: string,
    targetNotebookId: string,
    workspaceId?: string,
  ) => Promise<void>;

  // ─── Navigation (scoped to focused workspace) ───
  updateNavigation: (
    workspaceId: string,
    updater: (nav: WorkspaceNavigation) => WorkspaceNavigation,
  ) => void;
}

function resolveId(
  get: () => MultiWorkspaceStore,
  workspaceId?: string,
): string | null {
  return workspaceId ?? get().focusedWorkspaceId;
}

function extractMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (typeof e === "object" && e !== null) {
    const obj = e as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
  }
  return JSON.stringify(e) ?? String(e);
}

function isWorkspaceLocked(
  e: unknown,
): e is { code: "WorkspaceLocked"; message: number } {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as Record<string, unknown>).code === "WorkspaceLocked"
  );
}

function handleError(e: unknown) {
  const msg = extractMessage(e);
  console.error("[MultiWorkspaceStore]", msg);
  toast.error(msg);
}

export const useMultiWorkspaceStore = create<MultiWorkspaceStore>(
  (set, get) => ({
    workspaces: new Map(),
    focusedWorkspaceId: null,

    // ─── Derived getters ───

    focusedSlice: () => {
      const { workspaces, focusedWorkspaceId } = get();
      if (!focusedWorkspaceId) return null;
      return workspaces.get(focusedWorkspaceId) ?? null;
    },

    focusedWorkspace: () => get().focusedSlice()?.workspace ?? null,

    focusedNotebooks: () => get().focusedSlice()?.notebooks ?? [],

    // ─── Workspace lifecycle ───

    openWorkspace: async (path) => {
      try {
        const workspace = await ipc.openWorkspace(path);
        const notebooks = await ipc.listNotebooks(workspace.id);

        set((s) => {
          const workspaces = new Map(s.workspaces);
          const existing = workspaces.get(workspace.id);
          workspaces.set(workspace.id, {
            workspace,
            notebooks,
            sections: existing?.sections ?? new Map(),
            navigation: existing?.navigation ?? defaultNavigation(),
          });
          return { workspaces, focusedWorkspaceId: workspace.id };
        });

        ipc
          .rebuildIndex(workspace.id)
          .catch((err) =>
            console.warn("[Search] failed to rebuild index:", err),
          );

        return workspace;
      } catch (e) {
        if (isWorkspaceLocked(e)) {
          const pid = e.message;
          console.warn(
            `[MultiWorkspaceStore] workspace locked by PID ${pid}, offering force-open`,
          );
          toast.warning(
            `Workspace bloqueado pelo processo PID ${pid}. Isso pode ser um lock antigo de uma sessão que fechou incorretamente.`,
            {
              duration: 10000,
              action: {
                label: "Forçar abertura",
                onClick: () =>
                  get()
                    .forceOpenWorkspace(path)
                    .catch((err) => handleError(err)),
              },
            },
          );
          throw e;
        }
        handleError(e);
        throw e;
      }
    },

    forceOpenWorkspace: async (path) => {
      try {
        const workspace = await ipc.forceOpenWorkspace(path);
        const notebooks = await ipc.listNotebooks(workspace.id);

        set((s) => {
          const workspaces = new Map(s.workspaces);
          const existing = workspaces.get(workspace.id);
          workspaces.set(workspace.id, {
            workspace,
            notebooks,
            sections: existing?.sections ?? new Map(),
            navigation: existing?.navigation ?? defaultNavigation(),
          });
          return { workspaces, focusedWorkspaceId: workspace.id };
        });

        ipc
          .rebuildIndex(workspace.id)
          .catch((err) =>
            console.warn("[Search] failed to rebuild index:", err),
          );

        return workspace;
      } catch (e) {
        handleError(e);
        throw e;
      }
    },

    createWorkspace: async (path, name) => {
      try {
        const workspace = await ipc.createWorkspace(path, name);
        const notebooks = await ipc.listNotebooks(workspace.id);

        set((s) => {
          const workspaces = new Map(s.workspaces);
          workspaces.set(workspace.id, {
            workspace,
            notebooks,
            sections: new Map(),
            navigation: defaultNavigation(),
          });
          return { workspaces, focusedWorkspaceId: workspace.id };
        });

        ipc
          .rebuildIndex(workspace.id)
          .catch((err) =>
            console.warn("[Search] failed to rebuild index:", err),
          );

        return workspace;
      } catch (e) {
        handleError(e);
        throw e;
      }
    },

    closeWorkspace: async (workspaceId) => {
      try {
        await ipc.closeWorkspace(workspaceId);
      } catch {
        /* workspace may already be closed */
      }
      set((s) => {
        const workspaces = new Map(s.workspaces);
        workspaces.delete(workspaceId);
        const focused =
          s.focusedWorkspaceId === workspaceId
            ? (workspaces.keys().next().value ?? null)
            : s.focusedWorkspaceId;
        return { workspaces, focusedWorkspaceId: focused };
      });
    },

    focusWorkspace: (workspaceId) => {
      set({ focusedWorkspaceId: workspaceId });
      ipc.focusWorkspace(workspaceId).catch(console.warn);
    },

    // ─── Scoped notebook actions ───

    loadNotebooks: async (workspaceId) => {
      const id = resolveId(get, workspaceId);
      if (!id) return;
      try {
        const notebooks = await ipc.listNotebooks(id);
        set((s) => {
          const workspaces = new Map(s.workspaces);
          const slice = workspaces.get(id);
          if (slice) workspaces.set(id, { ...slice, notebooks });
          return { workspaces };
        });
      } catch (e) {
        handleError(e);
      }
    },

    createNotebook: async (name, workspaceId) => {
      const id = resolveId(get, workspaceId);
      if (!id) return;
      try {
        await ipc.createNotebook(name, id);
        await get().loadNotebooks(id);
      } catch (e) {
        handleError(e);
      }
    },

    renameNotebook: async (notebookId, name, workspaceId) => {
      const id = resolveId(get, workspaceId);
      if (!id) return;
      try {
        await ipc.renameNotebook(notebookId, name, id);
        await get().loadNotebooks(id);
      } catch (e) {
        handleError(e);
      }
    },

    deleteNotebook: async (notebookId, workspaceId) => {
      const id = resolveId(get, workspaceId);
      if (!id) return;
      try {
        await ipc.deleteNotebook(notebookId, id);
        await get().loadNotebooks(id);
      } catch (e) {
        handleError(e);
      }
    },

    reorderNotebooks: async (order, workspaceId) => {
      const id = resolveId(get, workspaceId);
      if (!id) return;
      try {
        await ipc.reorderNotebooks(order, id);
        await get().loadNotebooks(id);
      } catch (e) {
        handleError(e);
      }
    },

    // ─── Scoped section actions ───

    loadSections: async (notebookId, workspaceId) => {
      const id = resolveId(get, workspaceId);
      if (!id) return;
      try {
        const sections = await ipc.listSections(notebookId, id);
        set((s) => {
          const workspaces = new Map(s.workspaces);
          const slice = workspaces.get(id);
          if (slice) {
            const sectionMap = new Map(slice.sections);
            sectionMap.set(notebookId, sections);
            workspaces.set(id, { ...slice, sections: sectionMap });
          }
          return { workspaces };
        });
      } catch (e) {
        handleError(e);
      }
    },

    createSection: async (notebookId, name, workspaceId) => {
      const id = resolveId(get, workspaceId);
      if (!id) return undefined;
      try {
        const section = await ipc.createSection(notebookId, name, id);
        await get().loadSections(notebookId, id);
        return section;
      } catch (e) {
        handleError(e);
        return undefined;
      }
    },

    renameSection: async (sectionId, name, workspaceId) => {
      const id = resolveId(get, workspaceId);
      if (!id) return;
      try {
        const section = await ipc.renameSection(sectionId, name, id);
        await get().loadSections(section.notebook_id, id);
      } catch (e) {
        handleError(e);
      }
    },

    deleteSection: async (sectionId, workspaceId) => {
      const id = resolveId(get, workspaceId);
      if (!id) return;
      try {
        const { workspaces } = get();
        const slice = workspaces.get(id);
        let notebookId: string | null = null;
        if (slice) {
          for (const [nbId, secs] of slice.sections) {
            if (secs.some((s) => s.id === sectionId)) {
              notebookId = nbId;
              break;
            }
          }
        }
        await ipc.deleteSection(sectionId, id);
        if (notebookId) await get().loadSections(notebookId, id);
      } catch (e) {
        handleError(e);
      }
    },

    reorderSections: async (order, workspaceId) => {
      const id = resolveId(get, workspaceId);
      if (!id) return;
      try {
        await ipc.reorderSections(order, id);
      } catch (e) {
        handleError(e);
      }
    },

    moveSection: async (sectionId, targetNotebookId, workspaceId) => {
      const id = resolveId(get, workspaceId);
      if (!id) return;
      try {
        const section = await ipc.moveSection(sectionId, targetNotebookId, id);
        await get().loadSections(section.notebook_id, id);
        const { workspaces } = get();
        const slice = workspaces.get(id);
        if (slice) {
          for (const [nbId] of slice.sections) {
            if (nbId !== section.notebook_id) {
              await get().loadSections(nbId, id);
            }
          }
        }
      } catch (e) {
        handleError(e);
      }
    },

    // ─── Navigation ───

    updateNavigation: (workspaceId, updater) => {
      set((s) => {
        const workspaces = new Map(s.workspaces);
        const slice = workspaces.get(workspaceId);
        if (!slice) return {};
        workspaces.set(workspaceId, {
          ...slice,
          navigation: updater(slice.navigation),
        });
        return { workspaces };
      });
    },
  }),
);
