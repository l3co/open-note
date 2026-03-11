import { useEffect } from "react";
import { useUIStore } from "@/stores/useUIStore";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { useMultiWorkspaceStore } from "@/stores/useMultiWorkspaceStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { usePageStore } from "@/stores/usePageStore";

export function useKeyboardShortcuts() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const openWorkspacePicker = useUIStore((s) => s.openWorkspacePicker);
  const openQuickOpen = useUIStore((s) => s.openQuickOpen);
  const toggleSearchPanel = useUIStore((s) => s.toggleSearchPanel);
  const openSettings = useUIStore((s) => s.openSettings);
  const openNewNotebookModal = useUIStore((s) => s.openNewNotebookModal);
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

      // Cmd/Ctrl+N — nova página na seção selecionada (ou quick notes)
      if (mod && !e.shiftKey && e.key === "n") {
        e.preventDefault();
        const { selectedSectionId, selectPage } = useNavigationStore.getState();
        const { createPage, loadPage } = usePageStore.getState();
        const { focusedSlice } = useMultiWorkspaceStore.getState();
        const quickNotesSectionId =
          focusedSlice()?.workspace.settings?.quick_notes_section_id ?? null;
        const { sections } = useWorkspaceStore.getState();
        const targetSectionId =
          selectedSectionId ??
          quickNotesSectionId ??
          (() => {
            for (const [, list] of sections) {
              if (list.length > 0) return list[0]?.id ?? null;
            }
            return null;
          })();
        if (targetSectionId) {
          createPage(targetSectionId, "Nova página")
            .then((page) => {
              selectPage(page.id);
              loadPage(page.id);
            })
            .catch(() => {});
        } else {
          openQuickOpen();
        }
        return;
      }

      // Cmd/Ctrl+Shift+N — novo notebook
      if (mod && e.shiftKey && e.key === "N") {
        e.preventDefault();
        openNewNotebookModal();
        return;
      }

      // Cmd/Ctrl+K — busca rápida (cede ao TipTap dentro do editor para inserir link)
      if (mod && !e.shiftKey && e.key === "k") {
        const insideEditor =
          document.activeElement?.closest(".ProseMirror") !== null;
        if (!insideEditor) {
          e.preventDefault();
          openQuickOpen();
          return;
        }
      }
    };

    // capture: true garante que o handler roda antes dos handlers React de
    // componentes filhos (como o Excalidraw) que possam chamar stopPropagation.
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [
    toggleSidebar,
    goBack,
    goForward,
    openWorkspacePicker,
    openQuickOpen,
    toggleSearchPanel,
    openSettings,
    openNewNotebookModal,
  ]);
}
