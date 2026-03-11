import { useState, useEffect, useCallback } from "react";
import { CloudConnectModal } from "@/components/sync/CloudConnectModal";
import { useTranslation } from "react-i18next";
import { FolderOpen, Plus, Cloud, X, AlertCircle } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { useMultiWorkspaceStore } from "@/stores/useMultiWorkspaceStore";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { useUIStore } from "@/stores/useUIStore";
import * as ipc from "@/lib/ipc";
import { BackgroundPattern } from "@/components/shared/BackgroundPattern";
import { Illustration } from "@/components/shared/Illustration";
import { Button, IconButton } from "@/components/ui";
import logoSrc from "@/assets/logo.png";
import folderOpenSvg from "@/assets/illustrations/folders/folder-open.svg";
import type { AppState } from "@/types/bindings/AppState";

interface WorkspacePickerProps {
  mode?: "fullscreen" | "modal";
  onClose?: () => void;
}

export function WorkspacePicker({
  mode = "fullscreen",
  onClose,
}: WorkspacePickerProps) {
  const [appState, setAppState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPath, setNewPath] = useState("");

  const { openWorkspace } = useWorkspaceStore();
  const { createWorkspace: createWorkspaceMulti, loadSections } =
    useMultiWorkspaceStore();
  const { toggleNotebook } = useNavigationStore();
  const { closeWorkspacePicker } = useUIStore();
  const { t } = useTranslation();

  const handleClose = onClose ?? closeWorkspacePicker;

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
      handleClose();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newPath.trim()) return;
    try {
      const workspace = await createWorkspaceMulti(
        newPath.trim(),
        newName.trim(),
      );
      if (workspace) {
        const qnNotebookId = workspace.settings?.quick_notes_notebook_id;
        if (qnNotebookId) {
          toggleNotebook(qnNotebookId);
          await loadSections(qnNotebookId, workspace.id);
        }
      }
      handleClose();
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

  const card = (
    <div
      className="relative z-10 w-[420px] rounded-xl border p-6 shadow-lg"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      {mode === "modal" && (
        <div className="absolute top-3 right-3 z-10">
          <IconButton
            size="sm"
            onClick={handleClose}
            icon={<X size={16} />}
            aria-label={t("common.close")}
            data-testid="workspace-picker-close"
          />
        </div>
      )}
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
          <IconButton
            size="sm"
            onClick={() => setError(null)}
            icon={<X size={12} />}
          />
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
                    className="interactive-ghost group flex cursor-pointer items-center rounded-lg px-3 py-2"
                    onClick={() => handleOpen(rw.path)}
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
                    <IconButton
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveRecent(rw.path);
                      }}
                      className="opacity-0 group-hover:opacity-100"
                      icon={<X size={12} />}
                      aria-label={t("workspace.remove_recent")}
                    />
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
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const selected = await open({
                      directory: true,
                      multiple: false,
                      title: t("workspace.choose_folder"),
                    });
                    if (selected) setNewPath(selected);
                  }}
                  icon={
                    <FolderOpen
                      size={14}
                      className="text-[var(--text-secondary)]"
                    />
                  }
                >
                  {t("workspace.choose_folder")}
                </Button>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setShowCreate(false)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCreate}
                  data-testid="workspace-confirm-create"
                >
                  {t("common.create")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <Button
                variant="ghost"
                icon={
                  <Plus size={16} className="text-[var(--text-secondary)]" />
                }
                onClick={() => setShowCreate(true)}
                data-testid="workspace-create-btn"
                fullWidth
                className="!justify-start"
              >
                {t("workspace.create")}
              </Button>
              <Button
                variant="ghost"
                icon={
                  <Cloud size={16} className="text-[var(--text-secondary)]" />
                }
                onClick={() => setShowCloudModal(true)}
                data-testid="workspace-cloud-btn"
                fullWidth
                className="!justify-start"
              >
                {t("workspace.cloud_connect")}
              </Button>
              <Button
                variant="ghost"
                icon={
                  <FolderOpen
                    size={16}
                    className="text-[var(--text-secondary)]"
                  />
                }
                data-testid="workspace-open-btn"
                fullWidth
                className="!justify-start"
                onClick={async () => {
                  const selected = await open({
                    directory: true,
                    multiple: false,
                    title: t("workspace.open"),
                  });
                  if (selected) handleOpen(selected);
                }}
              >
                {t("workspace.open")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );

  if (mode === "modal") {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{
          backgroundColor: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
        }}
        data-testid="workspace-picker"
        onKeyDown={(e) => {
          if (e.key === "Escape") handleClose();
        }}
      >
        {card}
        {showCloudModal && (
          <CloudConnectModal onClose={() => setShowCloudModal(false)} />
        )}
      </div>
    );
  }

  return (
    <div
      className="relative flex h-screen w-full items-center justify-center"
      style={{ backgroundColor: "var(--bg-secondary)" }}
      data-testid="workspace-picker"
    >
      <BackgroundPattern />
      {card}
      {showCloudModal && (
        <CloudConnectModal onClose={() => setShowCloudModal(false)} />
      )}
    </div>
  );
}
