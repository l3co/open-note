import { useTranslation } from "react-i18next";
import { Cloud } from "lucide-react";

export function SyncSection() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div
        className="flex flex-col items-center gap-3 rounded-lg border p-6"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--bg-secondary)",
        }}
      >
        <Cloud size={32} style={{ color: "var(--text-tertiary)" }} />
        <p
          className="text-center text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("sync.info_text")}
        </p>
      </div>
    </div>
  );
}
