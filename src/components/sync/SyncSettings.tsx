import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useUIStore } from "@/stores/useUIStore";
import { SyncSection } from "@/components/settings/SyncSection";

export function SyncSettings() {
  const show = useUIStore((s) => s.showSyncSettings);
  const close = useUIStore((s) => s.closeSyncSettings);
  const { t } = useTranslation();

  if (!show) return null;

  return (
    <div className="sync-settings-backdrop" onClick={close}>
      <div className="sync-settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sync-settings-header">
          <h3 className="sync-settings-title">{t("sync.title")}</h3>
          <button
            className="sync-settings-close"
            onClick={close}
            aria-label={t("common.close")}
          >
            <X size={16} />
          </button>
        </div>
        <div className="sync-settings-body">
          <SyncSection />
        </div>
      </div>
    </div>
  );
}
