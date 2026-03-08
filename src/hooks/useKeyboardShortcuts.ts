import { useEffect } from "react";
import { useUIStore } from "@/stores/useUIStore";
import { useNavigationStore } from "@/stores/useNavigationStore";

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

      if (mod && e.key === "\\") {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      if (mod && e.key === "[") {
        e.preventDefault();
        goBack();
        return;
      }

      if (mod && e.key === "]") {
        e.preventDefault();
        goForward();
        return;
      }

      if (mod && e.shiftKey && e.key === "O") {
        e.preventDefault();
        openWorkspacePicker();
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
