import { useTranslation } from "react-i18next";

export function EditorSection() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <SettingsField label={t("settings.default_mode")}>
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          Rich Text
        </span>
      </SettingsField>

      <SettingsField label={t("settings.spell_check")}>
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          {t("common.yes")}
        </span>
      </SettingsField>

      <SettingsField label={t("settings.font_size")}>
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          16px
        </span>
      </SettingsField>

      <SettingsField label={t("settings.tab_size")}>
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          2
        </span>
      </SettingsField>

      <SettingsField label={t("settings.content_width")}>
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          {t("settings.content_medium")}
        </span>
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
      <span className="text-sm" style={{ color: "var(--text-primary)" }}>
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}
