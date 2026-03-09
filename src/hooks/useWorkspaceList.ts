import { useMultiWorkspaceStore } from "@/stores/useMultiWorkspaceStore";
import type { WorkspaceSlice } from "@/stores/useMultiWorkspaceStore";

/**
 * Hook que expõe a lista reativa de workspaces abertos.
 * Usado pelo WorkspaceSwitcher (Fase 5).
 */
export function useWorkspaceList() {
  const workspaces = useMultiWorkspaceStore((s) => s.workspaces);
  const focusedId = useMultiWorkspaceStore((s) => s.focusedWorkspaceId);

  const list: WorkspaceSlice[] = Array.from(workspaces.values());

  return {
    workspaces: list,
    focusedId,
    count: workspaces.size,
  };
}
