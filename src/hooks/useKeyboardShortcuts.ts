import { useEffect } from "react";
import { useUIStore } from "@/stores/useUIStore";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { useMultiWorkspaceStore } from "@/stores/useMultiWorkspaceStore";

export function useKeyboardShortcuts() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const openWorkspacePicker = useUIStore((s) => s.openWorkspacePicker);
  const openQuickOpen = useUIStore((s) => s.openQuickOpen);
  const toggleSearchPanel = useUIStore((s) => s.toggleSearchPanel);
  const openSettings = useUIStore((s) => s.openSettings);
  const { goBack, goForward } = useNavigationStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      // Excalidraw usa Cmd/Ctrl+[ e Cmd/Ctrl+] para z-order de elementos.
      // Ceder esses atalhos ao Excalidraw quando o canvas estiver ativo.
      const insideCanvas =
        document.activeElement?.closest(".excalidraw") !== null;

      if (mod && e.key === "\\") {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      if (!insideCanvas && mod && !e.shiftKey && e.key === "[") {
        e.preventDefault();
        goBack();
        return;
      }

      if (!insideCanvas && mod && !e.shiftKey && e.key === "]") {
        e.preventDefault();
        goForward();
        return;
      }

      if (mod && e.shiftKey && e.key === "O") {
        e.preventDefault();
        openWorkspacePicker();
        return;
      }

      // Cmd/Ctrl+Shift+W — open workspace switcher (workspace picker)
      if (mod && e.shiftKey && e.key === "W") {
        e.preventDefault();
        openWorkspacePicker();
        return;
      }

      // Cmd/Ctrl+Shift+[ — previous workspace
      if (mod && e.shiftKey && e.key === "[") {
        e.preventDefault();
        const { workspaces, focusedWorkspaceId, focusWorkspace } =
          useMultiWorkspaceStore.getState();
        const ids = Array.from(workspaces.keys());
        if (ids.length < 2 || !focusedWorkspaceId) return;
        const idx = ids.indexOf(focusedWorkspaceId);
        const prev = ids[(idx - 1 + ids.length) % ids.length];
        if (prev) focusWorkspace(prev);
        return;
      }

      // Cmd/Ctrl+Shift+] — next workspace
      if (mod && e.shiftKey && e.key === "]") {
        e.preventDefault();
        const { workspaces, focusedWorkspaceId, focusWorkspace } =
          useMultiWorkspaceStore.getState();
        const ids = Array.from(workspaces.keys());
        if (ids.length < 2 || !focusedWorkspaceId) return;
        const idx = ids.indexOf(focusedWorkspaceId);
        const next = ids[(idx + 1) % ids.length];
        if (next) focusWorkspace(next);
        return;
      }

      if (mod && e.key === "p") {
        e.preventDefault();
        openQuickOpen();
        return;
      }

      if (mod && e.shiftKey && e.key === "F") {
        e.preventDefault();
        toggleSearchPanel();
        return;
      }

      if (mod && e.key === ",") {
        e.preventDefault();
        openSettings();
        return;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [
    toggleSidebar,
    goBack,
    goForward,
    openWorkspacePicker,
    openQuickOpen,
    toggleSearchPanel,
    openSettings,
  ]);
}
