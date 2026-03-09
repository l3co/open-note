import { create } from "zustand";
import {
  applyAccentColor,
  applyBaseTheme,
  applyChromeTint,
  getAccentPalette,
} from "@/lib/theme";

interface ThemeConfig {
  baseTheme: "light" | "dark" | "paper" | "system";
  accentColor: string;
  chromeTint: "neutral" | "tinted";
}

interface EditorConfig {
  fontFamily: string;
  fontSize: number;
  documentLanguage: string;
  spellCheckEnabled: boolean;
}

interface UIStore {
  sidebarOpen: boolean;
  sidebarWidth: number;
  theme: ThemeConfig;
  editorConfig: EditorConfig;
  showWorkspacePicker: boolean;
  showTrashPanel: boolean;
  showQuickOpen: boolean;
  showSearchPanel: boolean;
  showSyncSettings: boolean;
  showSettings: boolean;

  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setTheme: (theme: Partial<ThemeConfig>) => void;
  setEditorConfig: (config: Partial<EditorConfig>) => void;
  applyThemeToDOM: () => void;
  openWorkspacePicker: () => void;
  closeWorkspacePicker: () => void;
  openTrashPanel: () => void;
  closeTrashPanel: () => void;
  openQuickOpen: () => void;
  closeQuickOpen: () => void;
  openSearchPanel: () => void;
  closeSearchPanel: () => void;
  toggleSearchPanel: () => void;
  openSyncSettings: () => void;
  closeSyncSettings: () => void;
  openSettings: () => void;
  closeSettings: () => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
  sidebarOpen: true,
  sidebarWidth: 260,
  theme: {
    baseTheme: "system",
    accentColor: "Blue",
    chromeTint: "neutral",
  },
  showWorkspacePicker: false,
  showTrashPanel: false,
  showQuickOpen: false,
  showSearchPanel: false,
  showSyncSettings: false,
  editorConfig: {
    fontFamily: "System",
    fontSize: 16,
    documentLanguage: "pt-BR",
    spellCheckEnabled: true,
  },
  showSettings: false,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  setSidebarWidth: (width) =>
    set({ sidebarWidth: Math.max(200, Math.min(400, width)) }),

  setTheme: (partial) =>
    set((s) => {
      const theme = { ...s.theme, ...partial };
      return { theme };
    }),

  setEditorConfig: (partial) =>
    set((s) => ({
      editorConfig: { ...s.editorConfig, ...partial },
    })),

  applyThemeToDOM: () => {
    const { theme } = get();
    applyBaseTheme(theme.baseTheme);
    applyAccentColor(getAccentPalette(theme.accentColor));
    applyChromeTint(theme.chromeTint);
  },

  openWorkspacePicker: () => set({ showWorkspacePicker: true }),
  closeWorkspacePicker: () => set({ showWorkspacePicker: false }),
  openTrashPanel: () => set({ showTrashPanel: true }),
  closeTrashPanel: () => set({ showTrashPanel: false }),
  openQuickOpen: () => set({ showQuickOpen: true }),
  closeQuickOpen: () => set({ showQuickOpen: false }),
  openSearchPanel: () => set({ showSearchPanel: true }),
  closeSearchPanel: () => set({ showSearchPanel: false }),
  toggleSearchPanel: () =>
    set((s) => ({ showSearchPanel: !s.showSearchPanel })),
  openSyncSettings: () => set({ showSyncSettings: true }),
  closeSyncSettings: () => set({ showSyncSettings: false }),
  openSettings: () => set({ showSettings: true }),
  closeSettings: () => set({ showSettings: false }),
}));
