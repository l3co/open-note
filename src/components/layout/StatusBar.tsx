import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { usePageStore } from "@/stores/usePageStore";

const SOFT_BLOCK_LIMIT = 200;

export function StatusBar() {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const { currentPage, saveStatus, lastSavedAt } = usePageStore();

  const blockCount = currentPage?.blocks?.length ?? 0;
  const isOverSoftLimit = blockCount > SOFT_BLOCK_LIMIT;

  const saveLabel =
    saveStatus === "saving"
      ? "Salvando..."
      : saveStatus === "saved" && lastSavedAt
        ? `Salvo às ${lastSavedAt.toLocaleTimeString()}`
        : saveStatus === "error"
          ? "Erro ao salvar"
          : "";

  const saveColor =
    saveStatus === "error"
      ? "#ef4444"
      : saveStatus === "saving"
        ? "var(--accent)"
        : "var(--text-tertiary)";

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
        {currentPage && (
          <span
            style={{ color: isOverSoftLimit ? "#eab308" : "var(--text-tertiary)" }}
            title={
              isOverSoftLimit
                ? "Esta página está grande. Considere dividir o conteúdo."
                : undefined
            }
          >
            {blockCount} blocos
          </span>
        )}
        {saveLabel && <span style={{ color: saveColor }}>{saveLabel}</span>}
      </div>
    </footer>
  );
}
