import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { useUIStore } from "@/stores/useUIStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { WorkspacePicker } from "@/components/workspace/WorkspacePicker";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { Toolbar } from "@/components/layout/Toolbar";
import { ContentArea } from "@/components/layout/ContentArea";
import { StatusBar } from "@/components/layout/StatusBar";
import { TrashPanel } from "@/components/shared/TrashPanel";
import * as ipc from "@/lib/ipc";

export function App() {
  const [initializing, setInitializing] = useState(true);
  const { showWorkspacePicker, openWorkspacePicker, applyThemeToDOM } =
    useUIStore();
  const { workspace, openWorkspace } = useWorkspaceStore();

  useKeyboardShortcuts();

  useEffect(() => {
    applyThemeToDOM();
  }, [applyThemeToDOM]);

  useEffect(() => {
    const init = async () => {
      try {
        const appState = await ipc.getAppState();

        const { theme } = appState.global_settings;
        const uiStore = useUIStore.getState();
        uiStore.setTheme({
          baseTheme: theme.base_theme,
          accentColor: theme.accent_color,
          chromeTint: theme.chrome_tint,
        });
        uiStore.applyThemeToDOM();

        if (appState.last_opened_workspace) {
          try {
            await openWorkspace(appState.last_opened_workspace);
          } catch {
            openWorkspacePicker();
          }
        } else {
          openWorkspacePicker();
        }
      } catch {
        openWorkspacePicker();
      }
      setInitializing(false);
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (initializing) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ backgroundColor: "var(--bg-primary)" }}
      >
        <div className="text-center">
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Open Note
          </h1>
          <p
            className="mt-2 text-sm"
            style={{ color: "var(--text-tertiary)" }}
          >
            Carregando...
          </p>
        </div>
      </div>
    );
  }

  if (showWorkspacePicker || !workspace) {
    return (
      <>
        <WorkspacePicker />
        <Toaster position="top-right" />
      </>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <ContentArea />
      </div>
      <StatusBar />
      <TrashPanel />
      <Toaster position="top-right" />
    </div>
  );
}
