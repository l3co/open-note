import { useMultiWorkspaceStore } from "@/stores/useMultiWorkspaceStore";

/**
 * Hook de conveniência que expõe o slice do workspace em foco.
 * Re-renderiza apenas quando o slice muda (selector otimizado).
 */
export function useFocusedWorkspace() {
  const focusedId = useMultiWorkspaceStore((s) => s.focusedWorkspaceId);
  const slice = useMultiWorkspaceStore((s) =>
    focusedId ? s.workspaces.get(focusedId) : null,
  );

  return {
    workspaceId: focusedId,
    workspace: slice?.workspace ?? null,
    notebooks: slice?.notebooks ?? [],
    sections: slice?.sections ?? new Map(),
    navigation: slice?.navigation ?? null,
  };
}
