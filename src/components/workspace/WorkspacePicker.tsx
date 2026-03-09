import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen, Plus, Cloud, X, AlertCircle } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { useUIStore } from "@/stores/useUIStore";
import * as ipc from "@/lib/ipc";
import { BackgroundPattern } from "@/components/shared/BackgroundPattern";
import { Illustration } from "@/components/shared/Illustration";
import logoSrc from "@/assets/logo.png";
import folderOpenSvg from "@/assets/illustrations/folders/folder-open.svg";
import type { AppState } from "@/types/bindings/AppState";

export function WorkspacePicker() {
  const [appState, setAppState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPath, setNewPath] = useState("");

  const { openWorkspace, createWorkspace } = useWorkspaceStore();
  const { closeWorkspacePicker } = useUIStore();
  const { t } = useTranslation();

  const loadAppState = useCallback(async () => {
    try {
      const state = await ipc.getAppState();
      setAppState(state);
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetching on mount
    loadAppState();
  }, [loadAppState]);

  const handleOpen = async (path: string) => {
    try {
      await openWorkspace(path);
      closeWorkspacePicker();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newPath.trim()) return;
    try {
      await createWorkspace(newPath.trim(), newName.trim());
      closeWorkspacePicker();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleRemoveRecent = async (path: string) => {
    try {
      await ipc.removeRecentWorkspace(path);
      await loadAppState();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div
      className="relative flex h-screen w-full items-center justify-center"
      style={{ backgroundColor: "var(--bg-secondary)" }}
      data-testid="workspace-picker"
    >
      <BackgroundPattern />
      <div
        className="relative z-10 w-[420px] rounded-xl border p-6 shadow-lg"
        style={{
          backgroundColor: "var(--bg-primary)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="mb-4 flex justify-center">
          <img src={logoSrc} alt="Open Note" className="h-14 w-14" />
        </div>
        <h1
          className="mb-1 text-center text-2xl font-bold"
          style={{ color: "var(--text-primary)" }}
          data-testid="workspace-picker-title"
        >
          {t("workspace.picker_title")}
        </h1>
        <p
          className="mb-6 text-center text-sm"
          style={{ color: "var(--text-tertiary)" }}
        >
          {t("workspace.picker_subtitle")}
        </p>

        {error && (
          <div
            className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              color: "var(--danger)",
            }}
            data-testid="workspace-error"
          >
            <AlertCircle size={14} />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)}>
              <X size={12} />
            </button>
          </div>
        )}

        {loading ? (
          <div
            className="py-8 text-center text-sm"
            style={{ color: "var(--text-tertiary)" }}
          >
            {t("common.loading")}
          </div>
        ) : (
          <>
            {appState && appState.recent_workspaces.length > 0 ? (
              <div className="mb-4">
                <h2
                  className="mb-2 text-xs font-medium tracking-wide uppercase"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {t("workspace.recent")}
                </h2>
                <div className="space-y-1">
                  {appState.recent_workspaces.map((rw) => (
                    <div
                      key={rw.path}
                      className="group flex cursor-pointer items-center rounded-lg px-3 py-2"
                      onClick={() => handleOpen(rw.path)}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          "var(--bg-hover)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                      }
                    >
                      <Illustration
                        src={folderOpenSvg}
                        alt=""
                        size={20}
                        className="mr-3 shrink-0"
                        style={{ color: "var(--text-tertiary)" }}
                      />
                      <div className="min-w-0 flex-1">
                        <div
                          className="truncate text-sm font-medium"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {rw.name}
                        </div>
                        <div
                          className="truncate text-xs"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {rw.path} • local
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveRecent(rw.path);
                        }}
                        className="flex h-5 w-5 items-center justify-center rounded opacity-0 group-hover:opacity-100"
                        style={{ color: "var(--text-tertiary)" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            "var(--bg-active)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            "transparent")
                        }
                        aria-label={t("workspace.remove_recent")}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-4 flex flex-col items-center py-6">
                <Illustration
                  src={folderOpenSvg}
                  alt=""
                  size={64}
                  style={{ color: "var(--text-tertiary)", opacity: 0.4 }}
                />
                <p
                  className="mt-3 text-sm"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {t("workspace.no_recent")}
                </p>
              </div>
            )}

            {showCreate ? (
              <div
                className="rounded-lg border p-3"
                style={{ borderColor: "var(--border)" }}
                data-testid="workspace-create-form"
              >
                <h3
                  className="mb-2 text-xs font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {t("workspace.create_title")}
                </h3>
                <input
                  autoFocus
                  className="mb-2 h-8 w-full rounded border bg-transparent px-3 text-sm outline-none"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                  placeholder={t("workspace.create_name_placeholder")}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  data-testid="workspace-name-input"
                />
                <div className="mb-3 flex gap-1.5">
                  <input
                    className="h-8 flex-1 rounded border bg-transparent px-3 text-sm outline-none"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                    placeholder={t("workspace.create_path_placeholder")}
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                      if (e.key === "Escape") setShowCreate(false);
                    }}
                    readOnly
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const selected = await open({
                        directory: true,
                        multiple: false,
                        title: t("workspace.choose_folder"),
                      });
                      if (selected) setNewPath(selected);
                    }}
                    className="flex h-8 items-center gap-1.5 rounded border px-3 text-xs font-medium whitespace-nowrap"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--text-secondary)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor =
                        "var(--bg-hover)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "transparent")
                    }
                  >
                    <FolderOpen size={14} />
                    {t("workspace.choose_folder")}
                  </button>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowCreate(false)}
                    className="rounded px-3 py-1.5 text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    onClick={handleCreate}
                    className="rounded px-3 py-1.5 text-xs font-medium"
                    style={{
                      backgroundColor: "var(--accent)",
                      color: "var(--accent-text)",
                    }}
                    data-testid="workspace-confirm-create"
                  >
                    {t("common.create")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <ActionButton
                  icon={<Plus size={16} />}
                  label={t("workspace.create")}
                  onClick={() => setShowCreate(true)}
                  testId="workspace-create-btn"
                />
                <ActionButton
                  icon={<Cloud size={16} />}
                  label={t("workspace.cloud_connect")}
                  disabled
                  badge={t("workspace.cloud_coming_soon")}
                  testId="workspace-cloud-btn"
                />
                <ActionButton
                  icon={<FolderOpen size={16} />}
                  label={t("workspace.open")}
                  testId="workspace-open-btn"
                  onClick={async () => {
                    const selected = await open({
                      directory: true,
                      multiple: false,
                      title: t("workspace.open"),
                    });
                    if (selected) handleOpen(selected);
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled = false,
  badge,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  badge?: string;
  testId?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      style={{ color: "var(--text-primary)" }}
      onMouseEnter={(e) => {
        if (!disabled)
          e.currentTarget.style.backgroundColor = "var(--bg-hover)";
      }}
      onMouseLeave={(e) =>
        (e.currentTarget.style.backgroundColor = "transparent")
      }
    >
      <span style={{ color: "var(--text-secondary)" }}>{icon}</span>
      <span>{label}</span>
      {badge && (
        <span
          className="ml-auto rounded-full px-2 py-0.5 text-[10px]"
          style={{
            backgroundColor: "var(--bg-tertiary)",
            color: "var(--text-tertiary)",
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
