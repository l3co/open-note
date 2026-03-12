import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Cloud, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import * as ipc from "@/lib/ipc";
import type { ProviderConnectionStatus } from "@/lib/ipc";
import type { RemoteWorkspaceInfo } from "@/types/sync";
import { CloudImportModal } from "./CloudImportModal";

interface Provider {
  id: string;
  label: string;
  logo: string;
}

const PROVIDERS: Provider[] = [
  { id: "google_drive", label: "Google Drive", logo: "google" },
  { id: "dropbox", label: "Dropbox", logo: "dropbox" },
];

type Status = "idle" | "connecting" | "success" | "error";

interface CloudConnectModalProps {
  onClose: () => void;
  initialProvider?: string;
  onConnected?: (providerName: string, email: string) => void;
}

export function CloudConnectModal({
  onClose,
  initialProvider,
  onConnected,
}: CloudConnectModalProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(
    initialProvider ?? null,
  );
  const [status, setStatus] = useState<Status>("idle");
  const [userEmail, setUserEmail] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [connectedProviders, setConnectedProviders] = useState<
    Record<string, ProviderConnectionStatus>
  >({});
  const [remoteWorkspaces, setRemoteWorkspaces] = useState<RemoteWorkspaceInfo[]>([]);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    ipc
      .getProviderStatus()
      .then((list) => {
        const map: Record<string, ProviderConnectionStatus> = {};
        list.forEach((p) => {
          map[p.name] = p;
        });
        setConnectedProviders(map);
        // If initialProvider is already connected, show success immediately
        if (initialProvider && map[initialProvider]?.connected) {
          setUserEmail(map[initialProvider].email ?? "");
          setStatus("success");
        }
      })
      .catch(() => {});
  }, [initialProvider]);

  const handleConnect = async () => {
    if (!selected || status === "connecting") return;
    setStatus("connecting");
    setErrorMsg("");
    try {
      const email = await ipc.connectProvider(selected);
      setUserEmail(email);
      setStatus("success");
      onConnected?.(selected, email);
      ipc
        .listRemoteWorkspaces(selected)
        .then((workspaces) => {
          if (workspaces.length > 0) {
            setRemoteWorkspaces(workspaces);
            setShowImport(true);
          } else {
            ipc.syncBidirectional(selected).catch(() => {});
          }
        })
        .catch(() => {
          ipc.syncBidirectional(selected).catch(() => {});
        });
    } catch (e) {
      setErrorMsg(String(e));
      setStatus("error");
    }
  };

  if (showImport && selected) {
    const providerLabel =
      PROVIDERS.find((p) => p.id === selected)?.label ?? selected;
    return (
      <CloudImportModal
        providerName={selected}
        providerLabel={providerLabel}
        workspaces={remoteWorkspaces}
        defaultDestDir="~/Documents/OpenNote"
        onClose={onClose}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && status !== "connecting") onClose();
      }}
    >
      <div
        className="relative w-[380px] rounded-2xl border p-6 shadow-2xl"
        style={{
          backgroundColor: "var(--bg-primary)",
          borderColor: "var(--border)",
        }}
      >
        <button
          onClick={onClose}
          disabled={status === "connecting"}
          className="absolute top-4 right-4 rounded-md p-1 transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-40"
          aria-label={t("common.close")}
        >
          <X size={16} style={{ color: "var(--text-tertiary)" }} />
        </button>

        <div className="mb-5 flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ backgroundColor: "var(--accent-subtle)" }}
          >
            <Cloud size={18} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <h2
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {t("sync.connect_modal_title")}
            </h2>
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              {t("sync.connect_modal_subtitle")}
            </p>
          </div>
        </div>

        {status === "success" ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle size={36} className="text-green-500" />
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              {t("sync.connect_success")}
            </p>
            {userEmail && (
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {userEmail}
              </p>
            )}
            <button
              onClick={onClose}
              className="mt-2 rounded-lg px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--accent)" }}
            >
              {t("common.close")}
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 space-y-2">
              {PROVIDERS.map((p) => {
                const alreadyConnected =
                  connectedProviders[p.id]?.connected === true;
                const isSelected = selected === p.id;
                const disabled = status === "connecting" || alreadyConnected;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (!disabled) setSelected(p.id);
                    }}
                    disabled={disabled}
                    className="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all disabled:cursor-default"
                    style={{
                      borderColor: alreadyConnected
                        ? "var(--accent)"
                        : isSelected
                          ? "var(--accent)"
                          : "var(--border)",
                      backgroundColor: alreadyConnected
                        ? "var(--accent-subtle)"
                        : isSelected
                          ? "var(--accent-subtle)"
                          : "var(--bg-secondary)",
                      opacity: disabled && !alreadyConnected ? 0.5 : 1,
                    }}
                  >
                    <ProviderLogo name={p.logo} />
                    <span
                      className="flex-1 text-sm font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {p.label}
                    </span>
                    {alreadyConnected && (
                      <span className="flex items-center gap-1 text-xs font-medium text-green-500">
                        <CheckCircle size={13} />
                        {t("sync.connected")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {status === "error" && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2">
                <AlertCircle
                  size={14}
                  className="mt-0.5 shrink-0 text-red-400"
                />
                <p className="text-xs text-red-400">{errorMsg}</p>
              </div>
            )}

            {status === "connecting" && (
              <div
                className="mb-3 flex items-center gap-2 rounded-lg px-3 py-2"
                style={{ backgroundColor: "var(--bg-secondary)" }}
              >
                <Loader2
                  size={14}
                  className="animate-spin"
                  style={{ color: "var(--accent)" }}
                />
                <p
                  className="text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {t("sync.connect_waiting")}
                </p>
              </div>
            )}

            <button
              onClick={handleConnect}
              disabled={!selected || status === "connecting"}
              className="w-full rounded-lg py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: "var(--accent)" }}
            >
              {status === "connecting"
                ? t("sync.connect_waiting_short")
                : t("sync.connect_btn")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ProviderLogo({ name }: { name: string }) {
  if (name === "google") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
    );
  }
  if (name === "microsoft") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="1" y="1" width="10" height="10" fill="#F25022" />
        <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
        <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
        <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2.5c-5.24 0-9.5 4.26-9.5 9.5s4.26 9.5 9.5 9.5 9.5-4.26 9.5-9.5S17.24 2.5 12 2.5zm0 4c1.38 0 2.5 1.12 2.5 2.5S13.38 11.5 12 11.5 9.5 10.38 9.5 9s1.12-2.5 2.5-2.5zm0 13.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"
        fill="#0061FF"
      />
    </svg>
  );
}
