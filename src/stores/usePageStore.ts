import { create } from "zustand";
import type { Page } from "@/types/bindings/Page";
import type { PageSummary } from "@/types/bindings/PageSummary";
import * as ipc from "@/lib/ipc";

export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type PageLockState = "unlocked" | "locked" | "loading";

interface PageStore {
  currentPage: Page | null;
  pages: Map<string, PageSummary[]>;
  isLoading: boolean;
  isSaving: boolean;
  saveStatus: SaveStatus;
  lockState: PageLockState;
  lastSavedAt: Date | null;
  error: string | null;

  loadPages: (sectionId: string) => Promise<void>;
  loadPage: (pageId: string) => Promise<void>;
  unlockPage: (
    pageId: string,
    password: string,
    durationMins?: number,
  ) => Promise<void>;
  lockPage: (pageId: string) => Promise<void>;
  setPagePassword: (pageId: string, password: string) => Promise<void>;
  removePagePassword: (pageId: string, password: string) => Promise<void>;
  changePagePassword: (
    pageId: string,
    oldPw: string,
    newPw: string,
  ) => Promise<void>;
  createPage: (sectionId: string, title: string) => Promise<Page>;
  updatePage: (page: Page) => Promise<void>;
  updatePageTitle: (title: string) => Promise<void>;
  updateBlocks: (pageId: string, blocks: Page["blocks"]) => Promise<Page>;
  deletePage: (pageId: string) => Promise<void>;
  movePage: (pageId: string, targetSectionId: string) => Promise<void>;
  setCurrentPage: (page: Page, lockState?: PageLockState) => void;
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
  lockState: "unlocked",
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
    set({ isLoading: true, error: null, lockState: "loading" });
    try {
      const page = await ipc.loadPage(pageId);
      // Backend retorna blocks vazio quando está bloqueada.
      // Se protection existe mas blocks está vazio e há encryptedContent, está locked.
      if (
        page.protection &&
        page.blocks.length === 0 &&
        page.encrypted_content
      ) {
        set({ currentPage: page, lockState: "locked", isLoading: false });
      } else {
        set({ currentPage: page, lockState: "unlocked", isLoading: false });
      }
    } catch (e) {
      set({ error: String(e), isLoading: false, lockState: "unlocked" });
    }
  },

  unlockPage: async (pageId, password, durationMins) => {
    set({ isLoading: true, error: null });
    try {
      const page = await ipc.unlockPage(pageId, password, durationMins);
      set({ currentPage: page, lockState: "unlocked", isLoading: false });
      // Atualiza summaries para refletir título real na sidebar se necessário
      await get().loadPages(page.section_id);
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  lockPage: async (pageId) => {
    try {
      await ipc.lockPage(pageId);
      const { currentPage } = get();
      if (currentPage?.id === pageId) {
        // Recarrega a página para voltar ao estado "locked" visualmente
        await get().loadPage(pageId);
      }
    } catch (e) {
      set({ error: String(e) });
    }
  },

  setPagePassword: async (pageId, password) => {
    set({ isSaving: true, error: null });
    try {
      await ipc.setPagePassword(pageId, password);
      // Recarrega a página para atualizar o estado local (agora protegida)
      await get().loadPage(pageId);
      const { currentPage } = get();
      if (currentPage) {
        await get().loadPages(currentPage.section_id);
      }
      set({ isSaving: false });
    } catch (e) {
      set({ error: String(e), isSaving: false });
      throw e;
    }
  },

  removePagePassword: async (pageId, password) => {
    set({ isSaving: true, error: null });
    try {
      const page = await ipc.removePagePassword(pageId, password);
      set({ currentPage: page, lockState: "unlocked", isSaving: false });
      await get().loadPages(page.section_id);
    } catch (e) {
      set({ error: String(e), isSaving: false });
      throw e;
    }
  },

  changePagePassword: async (pageId, oldPw, newPw) => {
    set({ isSaving: true, error: null });
    try {
      await ipc.changePagePassword(pageId, oldPw, newPw);
      set({ isSaving: false });
    } catch (e) {
      set({ error: String(e), isSaving: false });
      throw e;
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
      const sectionsToReload = new Set<string>([targetSectionId]);
      for (const [sectionId] of pages) {
        sectionsToReload.add(sectionId);
      }
      await Promise.all([...sectionsToReload].map((id) => get().loadPages(id)));
      const { currentPage } = get();
      if (currentPage?.id === pageId) {
        await get().loadPage(pageId);
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

  setCurrentPage: (page, lockState) =>
    set({ currentPage: page, lockState: lockState ?? "unlocked" }),
  setSaveStatus: (status) => set({ saveStatus: status }),
  clearCurrentPage: () =>
    set({ currentPage: null, saveStatus: "idle", lockState: "unlocked" }),
  clearError: () => set({ error: null }),
}));
