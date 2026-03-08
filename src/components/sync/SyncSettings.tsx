import { useState, useEffect } from "react";
import { Cloud, CloudOff, X, AlertTriangle } from "lucide-react";
import { useUIStore } from "@/stores/useUIStore";
import * as ipc from "@/lib/ipc";
import type { ProviderInfo, SyncStatus, SyncConflict } from "@/types/sync";

export function SyncSettings() {
  const show = useUIStore((s) => s.showSyncSettings);
  const close = useUIStore((s) => s.closeSyncSettings);

  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    Promise.all([
      ipc.getSyncProviders(),
      ipc.getSyncStatus(),
      ipc.getSyncConflicts(),
    ]).then(([p, s, c]) => {
      if (cancelled) return;
      setProviders(p);
      setStatus(s);
      setConflicts(c);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [show]);

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return "Nunca";
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Agora";
      if (diffMins < 60) return `${diffMins}min atrás`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h atrás`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d atrás`;
    } catch {
      return "Desconhecido";
    }
  };

  if (!show) return null;

  const connectedProvider = providers.find((p) => p.connected);

  return (
    <div className="sync-settings-backdrop" onClick={close}>
      <div className="sync-settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sync-settings-header">
          <h3 className="sync-settings-title">Sincronização</h3>
          <button className="sync-settings-close" onClick={close}>
            <X size={16} />
          </button>
        </div>

        <div className="sync-settings-body">
          {/* Status */}
          <div className="sync-settings-section">
            <h4 className="sync-settings-section-title">Status</h4>
            {status?.is_syncing ? (
              <div className="sync-status-row">
                <Cloud size={16} className="sync-icon syncing" />
                <span>Sincronizando...</span>
              </div>
            ) : connectedProvider ? (
              <div className="sync-status-row">
                <Cloud size={16} className="sync-icon connected" />
                <span>
                  Conectado — {connectedProvider.display_name}
                  {connectedProvider.user_email && ` (${connectedProvider.user_email})`}
                </span>
              </div>
            ) : (
              <div className="sync-status-row">
                <CloudOff size={16} className="sync-icon disconnected" />
                <span>Não conectado</span>
              </div>
            )}
            {status?.last_synced_at && (
              <div className="sync-meta">
                Último sync: {formatTimeAgo(status.last_synced_at)}
              </div>
            )}
            {status?.last_error && (
              <div className="sync-error">
                <AlertTriangle size={14} />
                <span>{status.last_error}</span>
              </div>
            )}
          </div>

          {/* Providers */}
          <div className="sync-settings-section">
            <h4 className="sync-settings-section-title">Provedores</h4>
            <div className="sync-providers-list">
              {providers.map((provider) => (
                <div
                  key={provider.name}
                  className={`sync-provider-card ${provider.connected ? "connected" : ""}`}
                >
                  <div className="sync-provider-info">
                    <span className="sync-provider-name">{provider.display_name}</span>
                    {provider.connected ? (
                      <span className="sync-provider-badge connected">Conectado</span>
                    ) : (
                      <span className="sync-provider-badge">Em breve</span>
                    )}
                  </div>
                  {provider.last_synced_at && (
                    <span className="sync-provider-meta">
                      Último sync: {formatTimeAgo(provider.last_synced_at)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Conflicts */}
          {conflicts.length > 0 && (
            <div className="sync-settings-section">
              <h4 className="sync-settings-section-title">
                Conflitos ({conflicts.length})
              </h4>
              {conflicts.map((conflict) => (
                <div key={conflict.id} className="sync-conflict-item">
                  <AlertTriangle size={14} className="sync-conflict-icon" />
                  <div className="sync-conflict-info">
                    <span className="sync-conflict-title">{conflict.page_title}</span>
                    <span className="sync-conflict-meta">
                      Local: {new Date(conflict.local_modified_at).toLocaleString()}
                      {" • "}
                      Remoto: {new Date(conflict.remote_modified_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info */}
          <div className="sync-settings-section">
            <p className="sync-info-text">
              A sincronização com provedores de nuvem será disponibilizada em breve.
              Seus dados permanecem seguros localmente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
