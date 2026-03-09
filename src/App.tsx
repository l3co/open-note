import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { useUIStore } from "@/stores/useUIStore";
import { useMultiWorkspaceStore } from "@/stores/useMultiWorkspaceStore";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { WorkspacePicker } from "@/components/workspace/WorkspacePicker";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { Toolbar } from "@/components/layout/Toolbar";
import { ContentArea } from "@/components/layout/ContentArea";
import { StatusBar } from "@/components/layout/StatusBar";
import { TrashPanel } from "@/components/shared/TrashPanel";
import { QuickOpen } from "@/components/search/QuickOpen";
import { SearchPanel } from "@/components/search/SearchPanel";
import { SyncSettings } from "@/components/sync/SyncSettings";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { OnboardingDialog } from "@/components/onboarding/OnboardingDialog";
import { listenSystemTheme } from "@/lib/theme";
import * as ipc from "@/lib/ipc";

export function App() {
  const [initializing, setInitializing] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const {
    showWorkspacePicker,
    openWorkspacePicker,
    closeWorkspacePicker,
    applyThemeToDOM,
  } = useUIStore();
  const workspaceCount = useMultiWorkspaceStore((s) => s.workspaces.size);
  const multiStore = useMultiWorkspaceStore.getState();

  useKeyboardShortcuts();

  useEffect(() => {
    applyThemeToDOM();
    const unsub = listenSystemTheme(() => {
      const { theme } = useUIStore.getState();
      if (theme.baseTheme === "system") {
        applyThemeToDOM();
      }
    });
    return unsub;
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

        // Restore all previously active workspaces
        const activeWorkspaces = appState.active_workspaces ?? [];
        const focusedId = appState.focused_workspace_id ?? null;

        if (activeWorkspaces.length > 0) {
          for (const aw of activeWorkspaces) {
            await multiStore.openWorkspace(aw.path).catch(() => null);
          }
          // Focus the previously focused workspace if still open
          if (focusedId) {
            const openedIds = Array.from(
              useMultiWorkspaceStore.getState().workspaces.keys(),
            );
            if (openedIds.includes(focusedId)) {
              multiStore.focusWorkspace(focusedId);
            }
          }
          if (useMultiWorkspaceStore.getState().workspaces.size === 0) {
            openWorkspacePicker();
          }
        } else if (appState.last_opened_workspace) {
          // Backward compat: single workspace from legacy field
          await multiStore
            .openWorkspace(appState.last_opened_workspace)
            .catch(() => openWorkspacePicker());
          if (useMultiWorkspaceStore.getState().workspaces.size === 0) {
            openWorkspacePicker();
          }
        } else {
          openWorkspacePicker();
        }
      } catch {
        openWorkspacePicker();
      }

      if (!localStorage.getItem("opennote_onboarding_done")) {
        setShowOnboarding(true);
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
        data-testid="app-loading"
      >
        <div className="text-center">
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Open Note
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-tertiary)" }}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  if (workspaceCount === 0) {
    return (
      <>
        <WorkspacePicker />
        <Toaster position="top-right" />
      </>
    );
  }

  return (
    <div className="flex h-screen flex-col" data-testid="app-main">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <ContentArea />
      </div>
      <StatusBar />
      <TrashPanel />
      <QuickOpen />
      <SearchPanel />
      <SyncSettings />
      <SettingsDialog />
      {showWorkspacePicker && (
        <WorkspacePicker mode="modal" onClose={closeWorkspacePicker} />
      )}
      {showOnboarding && (
        <OnboardingDialog
          onComplete={() => {
            localStorage.setItem("opennote_onboarding_done", "1");
            setShowOnboarding(false);
          }}
        />
      )}
      <Toaster position="top-right" />
    </div>
  );
}
