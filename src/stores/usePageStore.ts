import { create } from "zustand";
import type { Page } from "@/types/bindings/Page";
import type { PageSummary } from "@/types/bindings/PageSummary";
import * as ipc from "@/lib/ipc";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface PageStore {
  currentPage: Page | null;
  pages: Map<string, PageSummary[]>;
  isLoading: boolean;
  isSaving: boolean;
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  error: string | null;

  loadPages: (sectionId: string) => Promise<void>;
  loadPage: (pageId: string) => Promise<void>;
  createPage: (sectionId: string, title: string) => Promise<Page>;
  updatePage: (page: Page) => Promise<void>;
  updatePageTitle: (title: string) => Promise<void>;
  updateBlocks: (pageId: string, blocks: Page["blocks"]) => Promise<Page>;
  deletePage: (pageId: string) => Promise<void>;
  movePage: (pageId: string, targetSectionId: string) => Promise<void>;
  setCurrentPage: (page: Page) => void;
  setSaveStatus: (status: SaveStatus) => void;
  clearCurrentPage: () => void;
  clearError: () => void;
}

export const usePageStore = create<PageStore>((set, get) => ({
  currentPage: null,
  pages: new Map(),
  isLoading: false,
  isSaving: false,
  saveStatus: "idle",
  lastSavedAt: null,
  error: null,

  loadPages: async (sectionId) => {
    try {
      const pages = await ipc.listPages(sectionId);
      set((s) => {
        const map = new Map(s.pages);
        map.set(sectionId, pages);
        return { pages: map };
      });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  loadPage: async (pageId) => {
    set({ isLoading: true, error: null });
    try {
      const page = await ipc.loadPage(pageId);
      set({ currentPage: page, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  createPage: async (sectionId, title) => {
    try {
      const page = await ipc.createPage(sectionId, title);
      await get().loadPages(sectionId);
      return page;
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  updatePage: async (page) => {
    set({ isSaving: true });
    try {
      await ipc.updatePage(page);
      set({ currentPage: page, isSaving: false, lastSavedAt: new Date() });
    } catch (e) {
      set({ error: String(e), isSaving: false });
    }
  },

  updatePageTitle: async (title) => {
    const { currentPage } = get();
    if (!currentPage) return;
    const updated = { ...currentPage, title };
    await get().updatePage(updated);
    await get().loadPages(currentPage.section_id);
  },

  deletePage: async (pageId) => {
    try {
      const { currentPage, pages } = get();
      await ipc.deletePage(pageId);
      if (currentPage?.id === pageId) {
        set({ currentPage: null });
      }
      for (const [sectionId] of pages) {
        await get().loadPages(sectionId);
      }
    } catch (e) {
      set({ error: String(e) });
    }
  },

  movePage: async (pageId, targetSectionId) => {
    try {
      await ipc.movePage(pageId, targetSectionId);
      const { pages } = get();
      for (const [sectionId] of pages) {
        await get().loadPages(sectionId);
      }
    } catch (e) {
      set({ error: String(e) });
    }
  },

  updateBlocks: async (pageId, blocks) => {
    set({ isSaving: true, saveStatus: "saving" });
    try {
      const page = await ipc.updatePageBlocks(pageId, blocks);
      set({
        currentPage: page,
        isSaving: false,
        saveStatus: "saved",
        lastSavedAt: new Date(),
      });
      return page;
    } catch (e) {
      set({ error: String(e), isSaving: false, saveStatus: "error" });
      throw e;
    }
  },

  setCurrentPage: (page) => set({ currentPage: page }),
  setSaveStatus: (status) => set({ saveStatus: status }),
  clearCurrentPage: () => set({ currentPage: null, saveStatus: "idle" }),
  clearError: () => set({ error: null }),
}));
