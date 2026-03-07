import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { usePageStore } from "@/stores/usePageStore";

export function StatusBar() {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const { currentPage, isSaving, lastSavedAt } = usePageStore();

  const blockCount = currentPage?.blocks?.length ?? 0;

  const saveStatus = isSaving
    ? "Salvando..."
    : lastSavedAt
      ? `Salvo às ${lastSavedAt.toLocaleTimeString()}`
      : "";

  return (
    <footer
      className="flex h-7 items-center justify-between border-t px-3 text-[11px]"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--border)",
        color: "var(--text-tertiary)",
      }}
    >
      <span className="truncate">
        {workspace?.root_path ?? "Nenhum workspace aberto"}
      </span>

      <div className="flex items-center gap-4">
        {currentPage && <span>{blockCount} blocos</span>}
        {saveStatus && <span>{saveStatus}</span>}
      </div>
    </footer>
  );
}
