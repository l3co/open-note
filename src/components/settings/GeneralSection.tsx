import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";

export function GeneralSection() {
  const { t } = useTranslation();
  const currentLang = i18n.language;

  const handleLanguageChange = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="space-y-6">
      <SettingsField label={t("settings.language")}>
        <div className="flex gap-2">
          <LangButton
            label={t("settings.language_pt")}
            active={currentLang === "pt-BR"}
            onClick={() => handleLanguageChange("pt-BR")}
          />
          <LangButton
            label={t("settings.language_en")}
            active={currentLang === "en"}
            onClick={() => handleLanguageChange("en")}
          />
        </div>
      </SettingsField>
    </div>
  );
}

function SettingsField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className="text-sm"
        style={{ color: "var(--text-primary)" }}
      >
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}

function LangButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
      style={{
        borderColor: active ? "var(--accent)" : "var(--border)",
        backgroundColor: active ? "var(--accent-subtle)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-secondary)",
      }}
      onMouseEnter={(e) => {
        if (!active)
          e.currentTarget.style.backgroundColor = "var(--bg-hover)";
      }}
      onMouseLeave={(e) => {
        if (!active)
          e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {label}
    </button>
  );
}
