import { create } from "zustand";
import type { Notebook } from "@/types/bindings/Notebook";
import type { Section } from "@/types/bindings/Section";
import type { Workspace } from "@/types/bindings/Workspace";
import * as ipc from "@/lib/ipc";

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
  createSection: (notebookId: string, name: string) => Promise<void>;
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
      set({ error: String(e), isLoading: false });
    }
  },

  createWorkspace: async (path, name) => {
    set({ isLoading: true, error: null });
    try {
      const workspace = await ipc.createWorkspace(path, name);
      set({ workspace, notebooks: [], sections: new Map(), isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
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
      set({ error: String(e) });
    }
  },

  createNotebook: async (name) => {
    try {
      await ipc.createNotebook(name);
      await get().loadNotebooks();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  renameNotebook: async (id, name) => {
    try {
      await ipc.renameNotebook(id, name);
      await get().loadNotebooks();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  deleteNotebook: async (id) => {
    try {
      await ipc.deleteNotebook(id);
      await get().loadNotebooks();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  reorderNotebooks: async (order) => {
    try {
      await ipc.reorderNotebooks(order);
      await get().loadNotebooks();
    } catch (e) {
      set({ error: String(e) });
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
      set({ error: String(e) });
    }
  },

  createSection: async (notebookId, name) => {
    try {
      await ipc.createSection(notebookId, name);
      await get().loadSections(notebookId);
    } catch (e) {
      set({ error: String(e) });
    }
  },

  renameSection: async (id, name) => {
    try {
      const section = await ipc.renameSection(id, name);
      await get().loadSections(section.notebook_id);
    } catch (e) {
      set({ error: String(e) });
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
      set({ error: String(e) });
    }
  },

  reorderSections: async (order) => {
    try {
      await ipc.reorderSections(order);
    } catch (e) {
      set({ error: String(e) });
    }
  },

  clearError: () => set({ error: null }),
}));
