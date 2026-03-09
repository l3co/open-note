import { create } from "zustand";
import {
  useMultiWorkspaceStore,
  type WorkspaceNavigation,
} from "./useMultiWorkspaceStore";

export type ActiveView = "home" | "page" | "tags";

interface NavigationStore {
  activeView: ActiveView;
  selectedNotebookId: string | null;
  selectedSectionId: string | null;
  selectedPageId: string | null;
  expandedNotebooks: Set<string>;
  expandedSections: Set<string>;
  history: string[];
  historyIndex: number;

  setActiveView: (view: ActiveView) => void;
  selectNotebook: (id: string) => void;
  selectSection: (id: string) => void;
  selectPage: (id: string) => void;
  goBack: () => void;
  goForward: () => void;
  toggleNotebook: (id: string) => void;
  toggleSection: (id: string) => void;
  reset: () => void;
}

function getFocusedNav(): WorkspaceNavigation | null {
  return useMultiWorkspaceStore.getState().focusedSlice()?.navigation ?? null;
}

function updateFocusedNav(
  updater: (nav: WorkspaceNavigation) => WorkspaceNavigation,
) {
  const { focusedWorkspaceId, updateNavigation } =
    useMultiWorkspaceStore.getState();
  if (focusedWorkspaceId) updateNavigation(focusedWorkspaceId, updater);
}

// Facade: delegates navigation state to the focused WorkspaceSlice in
// useMultiWorkspaceStore. Existing components keep the same API.
export const useNavigationStore = create<NavigationStore>((set) => {
  // Mirror the focused slice's navigation into this store on every change
  useMultiWorkspaceStore.subscribe((multiState) => {
    const nav = multiState.focusedSlice()?.navigation;
    if (nav) {
      set({
        activeView: nav.activeView,
        selectedNotebookId: nav.selectedNotebookId,
        selectedSectionId: nav.selectedSectionId,
        selectedPageId: nav.selectedPageId,
        expandedNotebooks: nav.expandedNotebooks,
        expandedSections: nav.expandedSections,
        history: nav.history,
        historyIndex: nav.historyIndex,
      });
    } else {
      set({
        activeView: "home",
        selectedNotebookId: null,
        selectedSectionId: null,
        selectedPageId: null,
        expandedNotebooks: new Set(),
        expandedSections: new Set(),
        history: [],
        historyIndex: -1,
      });
    }
  });

  return {
    activeView: "home",
    selectedNotebookId: null,
    selectedSectionId: null,
    selectedPageId: null,
    expandedNotebooks: new Set(),
    expandedSections: new Set(),
    history: [],
    historyIndex: -1,

    setActiveView: (view) => {
      updateFocusedNav((nav) => ({ ...nav, activeView: view }));
    },

    selectNotebook: (id) => {
      updateFocusedNav((nav) => {
        const expanded = new Set(nav.expandedNotebooks);
        expanded.add(id);
        return { ...nav, selectedNotebookId: id, expandedNotebooks: expanded };
      });
    },

    selectSection: (id) => {
      updateFocusedNav((nav) => {
        const expanded = new Set(nav.expandedSections);
        expanded.add(id);
        return { ...nav, selectedSectionId: id, expandedSections: expanded };
      });
    },

    selectPage: (id) => {
      const nav = getFocusedNav();
      const currentPageId = nav?.selectedPageId ?? null;
      const currentView = nav?.activeView ?? "home";

      if (id === currentPageId) {
        if (currentView !== "page") {
          updateFocusedNav((n) => ({ ...n, activeView: "page" }));
        }
        return;
      }

      const currentHistory = nav?.history ?? [];
      const currentIndex = nav?.historyIndex ?? -1;
      const newHistory = currentHistory.slice(0, currentIndex + 1);
      newHistory.push(id);
      const newIndex = newHistory.length - 1;

      updateFocusedNav((n) => ({
        ...n,
        activeView: "page",
        selectedPageId: id,
        history: newHistory,
        historyIndex: newIndex,
      }));
    },

    goBack: () => {
      const nav = getFocusedNav();
      if (!nav || nav.historyIndex <= 0) return;
      const newIndex = nav.historyIndex - 1;
      const pageId = nav.history[newIndex] ?? null;
      updateFocusedNav((n) => ({
        ...n,
        selectedPageId: pageId,
        historyIndex: newIndex,
      }));
    },

    goForward: () => {
      const nav = getFocusedNav();
      if (!nav || nav.historyIndex >= nav.history.length - 1) return;
      const newIndex = nav.historyIndex + 1;
      const pageId = nav.history[newIndex] ?? null;
      updateFocusedNav((n) => ({
        ...n,
        selectedPageId: pageId,
        historyIndex: newIndex,
      }));
    },

    toggleNotebook: (id) => {
      updateFocusedNav((nav) => {
        const expanded = new Set(nav.expandedNotebooks);
        if (expanded.has(id)) expanded.delete(id);
        else expanded.add(id);
        return { ...nav, expandedNotebooks: expanded };
      });
    },

    toggleSection: (id) => {
      updateFocusedNav((nav) => {
        const expanded = new Set(nav.expandedSections);
        if (expanded.has(id)) expanded.delete(id);
        else expanded.add(id);
        return { ...nav, expandedSections: expanded };
      });
    },

    reset: () => {
      updateFocusedNav((_nav) => ({
        activeView: "home",
        selectedNotebookId: null,
        selectedSectionId: null,
        selectedPageId: null,
        expandedNotebooks: new Set(),
        expandedSections: new Set(),
        history: [],
        historyIndex: -1,
      }));
    },
  };
});
