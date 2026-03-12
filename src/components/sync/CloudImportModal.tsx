import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, CloudDownload, FolderOpen, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import * as ipc from "@/lib/ipc";
import type { RemoteWorkspaceInfo } from "@/types/sync";

interface CloudImportModalProps {
  providerName: string;
  providerLabel: string;
  workspaces: RemoteWorkspaceInfo[];
  defaultDestDir: string;
  onClose: () => void;
}

type WorkspaceStatus = "idle" | "downloading" | "done" | "error";

interface WorkspaceState {
  status: WorkspaceStatus;
  count?: number;
  error?: string;
}

export function CloudImportModal({
  providerName,
  providerLabel,
  workspaces,
  defaultDestDir,
  onClose,
}: CloudImportModalProps) {
  const { t } = useTranslation();
  const [states, setStates] = useState<Record<string, WorkspaceState>>(
    Object.fromEntries(workspaces.map((w) => [w.name, { status: "idle" }])),
  );
  const [downloadingAll, setDownloadingAll] = useState(false);

  const setWsState = (name: string, state: WorkspaceState) => {
    setStates((prev) => ({ ...prev, [name]: state }));
  };

  const downloadOne = async (ws: RemoteWorkspaceInfo) => {
    setWsState(ws.name, { status: "downloading" });
    const dest = `${defaultDestDir}/${ws.name}`;
    try {
      const count = await ipc.downloadWorkspace(providerName, ws.name, dest);
      setWsState(ws.name, { status: "done", count });
    } catch (e) {
      setWsState(ws.name, { status: "error", error: String(e) });
    }
  };

  const downloadAll = async () => {
    setDownloadingAll(true);
    for (const ws of workspaces) {
      if (states[ws.name]?.status !== "done") {
        await downloadOne(ws);
      }
    }
    setDownloadingAll(false);
  };

  const allDone = workspaces.every((w) => states[w.name]?.status === "done");
  const anyBusy =
    downloadingAll || workspaces.some((w) => states[w.name]?.status === "downloading");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !anyBusy) onClose();
      }}
    >
      <div
        className="relative w-[460px] max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl"
        style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border)" }}
      >
        <div className="flex items-start gap-3 p-6 border-b" style={{ borderColor: "var(--border)" }}>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: "var(--accent-subtle)" }}
          >
            <CloudDownload size={18} style={{ color: "var(--accent)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {t("sync.import_modal_title")}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
              {t("sync.import_modal_subtitle", { provider: providerLabel })}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={anyBusy}
            className="rounded-md p-1 transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-40"
            aria-label={t("common.close")}
          >
            <X size={16} style={{ color: "var(--text-tertiary)" }} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {workspaces.map((ws) => {
            const wsState = states[ws.name] ?? { status: "idle" };
            return (
              <div
                key={ws.name}
                className="flex items-center gap-3 rounded-xl border px-4 py-3"
                style={{
                  borderColor: wsState.status === "done" ? "var(--accent)" : "var(--border)",
                  backgroundColor:
                    wsState.status === "done" ? "var(--accent-subtle)" : "var(--bg-secondary)",
                }}
              >
                <FolderOpen
                  size={16}
                  style={{
                    color: wsState.status === "done" ? "var(--accent)" : "var(--text-secondary)",
                  }}
                />
                <span
                  className="flex-1 text-sm font-medium truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {ws.name}
                </span>

                {wsState.status === "idle" && (
                  <button
                    onClick={() => downloadOne(ws)}
                    disabled={anyBusy}
                    className="text-xs px-3 py-1 rounded-lg font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    style={{ backgroundColor: "var(--accent)" }}
                  >
                    {t("sync.import_one")}
                  </button>
                )}

                {wsState.status === "downloading" && (
                  <Loader2 size={16} className="animate-spin" style={{ color: "var(--accent)" }} />
                )}

                {wsState.status === "done" && (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-500">
                    <CheckCircle size={13} />
                    {t("sync.import_done", { count: wsState.count ?? 0 })}
                  </span>
                )}

                {wsState.status === "error" && (
                  <span
                    className="flex items-center gap-1 text-xs text-red-400 max-w-[160px] truncate"
                    title={wsState.error}
                  >
                    <AlertCircle size={13} />
                    {t("sync.import_error", { error: wsState.error })}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div
          className="flex items-center justify-between gap-3 p-4 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={onClose}
            disabled={anyBusy}
            className="text-sm px-4 py-2 rounded-lg transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-40"
            style={{ color: "var(--text-secondary)" }}
          >
            {allDone ? t("common.close") : t("sync.import_skip")}
          </button>

          {!allDone && (
            <button
              onClick={downloadAll}
              disabled={anyBusy}
              className="flex items-center gap-2 text-sm px-5 py-2 rounded-lg font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: "var(--accent)" }}
            >
              {downloadingAll ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {t("sync.import_downloading")}
                </>
              ) : (
                <>
                  <CloudDownload size={14} />
                  {t("sync.import_all")}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
