import { create } from "zustand";

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

export const useNavigationStore = create<NavigationStore>((set, get) => ({
  activeView: "home" as ActiveView,
  selectedNotebookId: null,
  selectedSectionId: null,
  selectedPageId: null,
  expandedNotebooks: new Set(),
  expandedSections: new Set(),
  history: [],
  historyIndex: -1,

  setActiveView: (view) => set({ activeView: view }),

  selectNotebook: (id) =>
    set((s) => {
      const expanded = new Set(s.expandedNotebooks);
      expanded.add(id);
      return { selectedNotebookId: id, expandedNotebooks: expanded };
    }),

  selectSection: (id) =>
    set((s) => {
      const expanded = new Set(s.expandedSections);
      expanded.add(id);
      return { selectedSectionId: id, expandedSections: expanded };
    }),

  selectPage: (id) => {
    const { history, historyIndex, selectedPageId } = get();
    if (id === selectedPageId) return;
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(id);
    set({
      activeView: "page",
      selectedPageId: id,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  goBack: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    set({
      selectedPageId: history[newIndex] ?? null,
      historyIndex: newIndex,
    });
  },

  goForward: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    set({
      selectedPageId: history[newIndex] ?? null,
      historyIndex: newIndex,
    });
  },

  toggleNotebook: (id) =>
    set((s) => {
      const expanded = new Set(s.expandedNotebooks);
      if (expanded.has(id)) expanded.delete(id);
      else expanded.add(id);
      return { expandedNotebooks: expanded };
    }),

  toggleSection: (id) =>
    set((s) => {
      const expanded = new Set(s.expandedSections);
      if (expanded.has(id)) expanded.delete(id);
      else expanded.add(id);
      return { expandedSections: expanded };
    }),

  reset: () =>
    set({
      selectedNotebookId: null,
      selectedSectionId: null,
      selectedPageId: null,
      expandedNotebooks: new Set(),
      expandedSections: new Set(),
      history: [],
      historyIndex: -1,
    }),
}));
