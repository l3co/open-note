import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Cloud,
  CloudOff,
  FolderOpen,
  Loader2,
  LogOut,
  RefreshCw,
  UploadCloud,
} from "lucide-react";
import * as ipc from "@/lib/ipc";
import type { DownloadedWorkspace, ProviderConnectionStatus } from "@/lib/ipc";
import type { SyncStatus } from "@/types/sync";
import { CloudConnectModal } from "@/components/sync/CloudConnectModal";

const PROVIDER_LOGOS: Record<string, React.ReactNode> = {
  google_drive: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 87.3 78"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
        fill="#0066da"
      />
      <path
        d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z"
        fill="#00ac47"
      />
      <path
        d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"
        fill="#ea4335"
      />
      <path
        d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"
        fill="#00832d"
      />
      <path
        d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
        fill="#2684fc"
      />
      <path
        d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 27h27.45c0-1.55-.4-3.1-1.2-4.5z"
        fill="#ffba00"
      />
    </svg>
  ),
  onedrive: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10.5 18.5H6a4 4 0 1 1 .97-7.88A5.5 5.5 0 0 1 18 13h.5a3.5 3.5 0 0 1 0 7h-8z"
        fill="#0078D4"
      />
    </svg>
  ),
  dropbox: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 2L12 6.5 6 11 0 6.5zM18 2l6 4.5-6 4.5-6-4.5zM0 12.5L6 8l6 4.5L6 17zM18 8l6 4.5-6 4.5-6-4.5zM6 18.5L12 14l6 4.5-6 4.5z"
        fill="#0061FF"
      />
    </svg>
  ),
};

function formatTimeAgo(
  dateStr: string | null,
  t: (k: string, o?: Record<string, unknown>) => string,
): string {
  if (!dateStr) return t("sync.never");
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return t("search.time_ago_now");
    if (diffMins < 60) return t("search.time_ago_minutes", { count: diffMins });
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return t("search.time_ago_hours", { count: diffHours });
    return t("search.time_ago_days", { count: Math.floor(diffHours / 24) });
  } catch {
    return t("search.time_ago_unknown");
  }
}

function ProviderRow({
  p,
  onDisconnect,
  onConnect,
}: {
  p: ProviderConnectionStatus;
  onDisconnect: (name: string) => void;
  onConnect: (name: string) => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await ipc.disconnectProviderByName(p.name);
      onDisconnect(p.name);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex items-center justify-between rounded-xl border px-4 py-3"
      style={{
        borderColor: p.connected ? "var(--accent)" : "var(--border)",
        backgroundColor: p.connected
          ? "var(--accent-subtle)"
          : "var(--bg-secondary)",
      }}
    >
      <div className="flex items-center gap-3">
        <div className="shrink-0">{PROVIDER_LOGOS[p.name]}</div>
        <div>
          <p
            className="text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {p.displayName}
          </p>
          <p
            className="text-xs"
            style={{
              color: p.errorMsg ? "var(--error)" : "var(--text-secondary)",
            }}
          >
            {p.errorMsg
              ? `⚠ ${p.errorMsg}`
              : p.connected
                ? (p.email ?? t("sync.connected"))
                : t("sync.not_connected")}
          </p>
        </div>
      </div>

      {p.connected ? (
        <button
          onClick={handleDisconnect}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
          style={{
            backgroundColor: "var(--bg-hover)",
            color: "var(--text-secondary)",
          }}
        >
          {busy ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <LogOut size={12} />
          )}
          {t("sync.disconnect")}
        </button>
      ) : (
        <button
          onClick={() => onConnect(p.name)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--accent)" }}
        >
          {t("sync.connect_btn")}
        </button>
      )}
    </div>
  );
}

function DownloadedWorkspacesSection() {
  const { t } = useTranslation();
  const [workspaces, setWorkspaces] = useState<DownloadedWorkspace[]>([]);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    ipc
      .listDownloadedWorkspaces()
      .then(setWorkspaces)
      .catch(() => {});
  }, []);

  if (workspaces.length === 0) return null;

  const handleOpen = async (ws: DownloadedWorkspace) => {
    setOpening(ws.name);
    try {
      await ipc.openWorkspace(ws.localPath);
    } finally {
      setOpening(null);
    }
  };

  return (
    <div className="space-y-2">
      <p
        className="text-xs font-semibold tracking-wide uppercase"
        style={{ color: "var(--text-tertiary)" }}
      >
        {t("sync.downloaded_workspaces")}
      </p>
      {workspaces.map((ws) => (
        <div
          key={ws.name}
          className="flex items-center justify-between rounded-xl border px-4 py-3"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--bg-secondary)",
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <FolderOpen
              size={16}
              style={{ color: "var(--accent)", flexShrink: 0 }}
            />
            <div className="min-w-0">
              <p
                className="truncate text-sm font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                {ws.name}
              </p>
              <p
                className="truncate font-mono text-xs"
                style={{ color: "var(--text-tertiary)" }}
                title={ws.localPath}
              >
                {ws.localPath}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleOpen(ws)}
            disabled={opening === ws.name}
            className="ml-3 flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)" }}
          >
            {opening === ws.name ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <FolderOpen size={12} />
            )}
            {t("common.open")}
          </button>
        </div>
      ))}
    </div>
  );
}

export function SyncSection() {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<ProviderConnectionStatus[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connectTarget, setConnectTarget] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const [providerList, status] = await Promise.all([
        ipc.getProviderStatus(),
        ipc.getSyncStatus().catch(() => null),
      ]);
      setProviders(providerList.filter((p) => p.name !== "onedrive"));
      setSyncStatus(status);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleSyncNow = async () => {
    const connected = providers.find((p) => p.connected);
    if (!connected || syncing) return;
    setSyncing(true);
    try {
      await ipc.syncBidirectional(connected.name);
      await loadStatus();
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = (name: string) => {
    setProviders((prev) =>
      prev.map((p) =>
        p.name === name ? { ...p, connected: false, email: null } : p,
      ),
    );
  };

  const handleConnected = (name: string, email: string) => {
    setProviders((prev) =>
      prev.map((p) => (p.name === name ? { ...p, connected: true, email } : p)),
    );
    setConnectTarget(null);
  };

  const connectedProvider = providers.find((p) => p.connected);
  const isSyncing = syncing || (syncStatus?.is_syncing ?? false);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cloud size={16} style={{ color: "var(--accent)" }} />
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {t("sync.title")}
          </h3>
        </div>
        <button
          onClick={loadStatus}
          disabled={loading}
          className="rounded-md p-1 transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-40"
          aria-label={t("common.refresh")}
        >
          <RefreshCw
            size={14}
            className={loading ? "animate-spin" : ""}
            style={{ color: "var(--text-tertiary)" }}
          />
        </button>
      </div>

      {/* Status row */}
      <div
        className="flex items-center justify-between rounded-lg px-3 py-2"
        style={{ backgroundColor: "var(--bg-secondary)" }}
      >
        <div className="flex items-center gap-2">
          {isSyncing ? (
            <Loader2
              size={14}
              className="animate-spin"
              style={{ color: "var(--accent)" }}
            />
          ) : connectedProvider ? (
            <Cloud size={14} style={{ color: "var(--accent)" }} />
          ) : (
            <CloudOff size={14} style={{ color: "var(--text-tertiary)" }} />
          )}
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {isSyncing
              ? t("sync.syncing")
              : connectedProvider
                ? t("sync.last_sync", {
                    time: formatTimeAgo(syncStatus?.last_synced_at ?? null, t),
                  })
                : t("sync.not_connected")}
          </span>
        </div>

        {connectedProvider && !isSyncing && (
          <button
            onClick={handleSyncNow}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)" }}
            disabled={syncing}
            data-testid="sync-now-btn"
          >
            <UploadCloud size={12} />
            {t("sync.sync_now")}
          </button>
        )}
      </div>

      {/* Provider list */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2
            size={20}
            className="animate-spin"
            style={{ color: "var(--text-tertiary)" }}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {providers.map((p) => (
            <ProviderRow
              key={p.name}
              p={p}
              onDisconnect={handleDisconnect}
              onConnect={(name) => setConnectTarget(name)}
            />
          ))}
        </div>
      )}

      <DownloadedWorkspacesSection />

      {connectTarget && (
        <CloudConnectModal
          initialProvider={connectTarget}
          onClose={() => setConnectTarget(null)}
          onConnected={handleConnected}
        />
      )}
    </div>
  );
}
