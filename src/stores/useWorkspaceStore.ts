import { create } from "zustand";
import type { Notebook } from "@/types/bindings/Notebook";
import type { Section } from "@/types/bindings/Section";
import type { Workspace } from "@/types/bindings/Workspace";
import { useMultiWorkspaceStore } from "./useMultiWorkspaceStore";

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
  createSection: (
    notebookId: string,
    name: string,
  ) => Promise<Section | undefined>;
  renameSection: (id: string, name: string) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;
  reorderSections: (order: [string, number][]) => Promise<void>;
  moveSection: (sectionId: string, targetNotebookId: string) => Promise<void>;
  clearError: () => void;
}

// Facade: delegates all operations to useMultiWorkspaceStore.
// Existing components keep the same API without any changes.
export const useWorkspaceStore = create<WorkspaceStore>((set) => {
  // Mirror focused slice into this store whenever multi-store changes
  useMultiWorkspaceStore.subscribe((multiState) => {
    const slice = multiState.focusedSlice();
    set({
      workspace: slice?.workspace ?? null,
      notebooks: slice?.notebooks ?? [],
      sections: slice?.sections ?? new Map(),
    });
  });

  return {
    workspace: null,
    notebooks: [],
    sections: new Map(),
    isLoading: false,
    error: null,

    openWorkspace: async (path) => {
      set({ isLoading: true, error: null });
      try {
        await useMultiWorkspaceStore.getState().openWorkspace(path);
        set({ isLoading: false });
      } catch (e) {
        set({ isLoading: false, error: String(e) });
      }
    },

    createWorkspace: async (path, name) => {
      set({ isLoading: true, error: null });
      try {
        await useMultiWorkspaceStore.getState().createWorkspace(path, name);
        set({ isLoading: false });
      } catch (e) {
        set({ isLoading: false, error: String(e) });
      }
    },

    closeWorkspace: async () => {
      const focusedId = useMultiWorkspaceStore.getState().focusedWorkspaceId;
      if (focusedId) {
        await useMultiWorkspaceStore.getState().closeWorkspace(focusedId);
      }
    },

    loadNotebooks: async () => {
      await useMultiWorkspaceStore.getState().loadNotebooks();
    },

    createNotebook: async (name) => {
      await useMultiWorkspaceStore.getState().createNotebook(name);
    },

    renameNotebook: async (id, name) => {
      await useMultiWorkspaceStore.getState().renameNotebook(id, name);
    },

    deleteNotebook: async (id) => {
      await useMultiWorkspaceStore.getState().deleteNotebook(id);
    },

    reorderNotebooks: async (order) => {
      await useMultiWorkspaceStore.getState().reorderNotebooks(order);
    },

    loadSections: async (notebookId) => {
      await useMultiWorkspaceStore.getState().loadSections(notebookId);
    },

    createSection: async (notebookId, name) => {
      return useMultiWorkspaceStore.getState().createSection(notebookId, name);
    },

    renameSection: async (id, name) => {
      await useMultiWorkspaceStore.getState().renameSection(id, name);
    },

    deleteSection: async (id) => {
      await useMultiWorkspaceStore.getState().deleteSection(id);
    },

    reorderSections: async (order) => {
      await useMultiWorkspaceStore.getState().reorderSections(order);
    },

    moveSection: async (sectionId, targetNotebookId) => {
      await useMultiWorkspaceStore
        .getState()
        .moveSection(sectionId, targetNotebookId);
    },

    clearError: () => set({ error: null }),
  };
});
