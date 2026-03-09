import { create } from "zustand";
import { toast } from "sonner";
import type { Notebook } from "@/types/bindings/Notebook";
import type { Section } from "@/types/bindings/Section";
import type { Workspace } from "@/types/bindings/Workspace";
import * as ipc from "@/lib/ipc";

function handleError(e: unknown, set: (s: { error: string }) => void) {
  const msg = String(e);
  console.error("[WorkspaceStore]", msg);
  set({ error: msg });
  toast.error(msg);
}

interface WorkspaceStore {
  workspace: Workspace | null;
  notebooks: Notebook[];
  sections: Map<string, Section[]>;
  isLoading: boolean;
  error: string | null;

  openWorkspace: (path: string) => Promise<void>;
  createWorkspace: (path: string, name: string) => Promise<void>;
  closeWorkspace: () => Promise<void>;
  loadNotebooks: () => Promise<void>;
  createNotebook: (name: string) => Promise<void>;
  renameNotebook: (id: string, name: string) => Promise<void>;
  deleteNotebook: (id: string) => Promise<void>;
  reorderNotebooks: (order: [string, number][]) => Promise<void>;
  loadSections: (notebookId: string) => Promise<void>;
  createSection: (notebookId: string, name: string) => Promise<Section | undefined>;
  renameSection: (id: string, name: string) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;
  reorderSections: (order: [string, number][]) => Promise<void>;
  clearError: () => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspace: null,
  notebooks: [],
  sections: new Map(),
  isLoading: false,
  error: null,

  openWorkspace: async (path) => {
    set({ isLoading: true, error: null });
    try {
      const workspace = await ipc.openWorkspace(path);
      set({ workspace, isLoading: false });
      await get().loadNotebooks();
    } catch (e) {
      set({ isLoading: false });
      handleError(e, set);
    }
  },

  createWorkspace: async (path, name) => {
    set({ isLoading: true, error: null });
    try {
      const workspace = await ipc.createWorkspace(path, name);
      set({ workspace, notebooks: [], sections: new Map(), isLoading: false });
    } catch (e) {
      set({ isLoading: false });
      handleError(e, set);
    }
  },

  closeWorkspace: async () => {
    try {
      await ipc.closeWorkspace();
    } catch {
      /* workspace may already be closed */
    }
    set({ workspace: null, notebooks: [], sections: new Map() });
  },

  loadNotebooks: async () => {
    try {
      const notebooks = await ipc.listNotebooks();
      set({ notebooks });
    } catch (e) {
      handleError(e, set);
    }
  },

  createNotebook: async (name) => {
    try {
      await ipc.createNotebook(name);
      await get().loadNotebooks();
    } catch (e) {
      handleError(e, set);
    }
  },

  renameNotebook: async (id, name) => {
    try {
      await ipc.renameNotebook(id, name);
      await get().loadNotebooks();
    } catch (e) {
      handleError(e, set);
    }
  },

  deleteNotebook: async (id) => {
    try {
      await ipc.deleteNotebook(id);
      await get().loadNotebooks();
    } catch (e) {
      handleError(e, set);
    }
  },

  reorderNotebooks: async (order) => {
    try {
      await ipc.reorderNotebooks(order);
      await get().loadNotebooks();
    } catch (e) {
      handleError(e, set);
    }
  },

  loadSections: async (notebookId) => {
    try {
      const sections = await ipc.listSections(notebookId);
      set((s) => {
        const map = new Map(s.sections);
        map.set(notebookId, sections);
        return { sections: map };
      });
    } catch (e) {
      handleError(e, set);
    }
  },

  createSection: async (notebookId, name) => {
    try {
      const section = await ipc.createSection(notebookId, name);
      await get().loadSections(notebookId);
      return section;
    } catch (e) {
      handleError(e, set);
      return undefined;
    }
  },

  renameSection: async (id, name) => {
    try {
      const section = await ipc.renameSection(id, name);
      await get().loadSections(section.notebook_id);
    } catch (e) {
      handleError(e, set);
    }
  },

  deleteSection: async (id) => {
    try {
      const { sections } = get();
      let notebookId: string | null = null;
      for (const [nbId, secs] of sections) {
        if (secs.some((s) => s.id === id)) {
          notebookId = nbId;
          break;
        }
      }
      await ipc.deleteSection(id);
      if (notebookId) await get().loadSections(notebookId);
    } catch (e) {
      handleError(e, set);
    }
  },

  reorderSections: async (order) => {
    try {
      await ipc.reorderSections(order);
    } catch (e) {
      handleError(e, set);
    }
  },

  clearError: () => set({ error: null }),
}));
