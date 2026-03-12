import { useTranslation } from "react-i18next";
import { CloudOff, FolderOpen } from "lucide-react";
import { useWorkspaceList } from "@/hooks/useWorkspaceList";
import { usePageStore } from "@/stores/usePageStore";
import { useUIStore } from "@/stores/useUIStore";

const SOFT_BLOCK_LIMIT = 200;

export function StatusBar() {
  const { workspaces, focusedId, count } = useWorkspaceList();
  const focused = workspaces.find((w) => w.workspace.id === focusedId);
  const { currentPage, saveStatus, lastSavedAt } = usePageStore();
  const openSyncSettings = useUIStore((s) => s.openSyncSettings);
  const { t } = useTranslation();

  const blockCount = currentPage?.blocks?.length ?? 0;
  const isOverSoftLimit = blockCount > SOFT_BLOCK_LIMIT;

  const saveLabel =
    saveStatus === "saving"
      ? t("save.saving")
      : saveStatus === "saved" && lastSavedAt
        ? t("save.saved", { time: lastSavedAt.toLocaleTimeString() })
        : saveStatus === "error"
          ? t("save.error")
          : "";

  const saveColor =
    saveStatus === "error"
      ? "#ef4444"
      : saveStatus === "saving"
        ? "var(--accent)"
        : "var(--text-tertiary)";

  return (
    <footer
      className="flex h-6 items-center justify-between border-t px-3 text-[11px]"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--border)",
        color: "var(--text-tertiary)",
      }}
      data-testid="status-bar"
    >
      <span
        className="flex items-center gap-1.5 truncate"
        data-testid="status-workspace-path"
      >
        <FolderOpen size={12} style={{ flexShrink: 0 }} />
        <span className="truncate">
          {focused?.workspace.name ?? t("workspace.none_open")}
        </span>
        {count > 1 && (
          <span
            className="text-[10px] opacity-60"
            data-testid="status-workspace-count"
          >
            ({t("workspace.count_open", { count })})
          </span>
        )}
      </span>

      <div className="flex items-center gap-4">
        {currentPage && (
          <span
            style={{
              color: isOverSoftLimit ? "#eab308" : "var(--text-tertiary)",
            }}
            title={isOverSoftLimit ? t("page.blocks_warning") : undefined}
            data-testid="status-block-count"
          >
            {t("page.blocks", { count: blockCount })}
          </span>
        )}
        {saveLabel && (
          <span style={{ color: saveColor }} data-testid="status-save">
            {saveLabel}
          </span>
        )}
        <button
          onClick={openSyncSettings}
          className="flex items-center gap-1 hover:opacity-80"
          style={{
            background: "none",
            border: "none",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            padding: 0,
            fontSize: "11px",
          }}
          title={t("sync.title")}
          data-testid="status-sync-btn"
        >
          <CloudOff size={13} />
        </button>
      </div>
    </footer>
  );
}
