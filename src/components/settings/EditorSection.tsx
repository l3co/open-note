import { useTranslation } from "react-i18next";
import { useUIStore } from "@/stores/useUIStore";
import { clsx } from "clsx";

const FONT_FAMILIES = [
  { id: "System", label: "System Default" },
  { id: "Inter", label: "Inter" },
  { id: "Roboto", label: "Roboto" },
  { id: "Merriweather", label: "Merriweather" },
  { id: "Fira Code", label: "Fira Code" },
  { id: "Georgia", label: "Georgia" },
  { id: "Times New Roman", label: "Times New Roman" },
  { id: "Arial", label: "Arial" },
];

const FONT_SIZES = [12, 14, 16, 18, 20, 24];

export function EditorSection() {
  const { t } = useTranslation();
  const { editorConfig, setEditorConfig } = useUIStore();

  return (
    <div className="space-y-6">
      <SettingsField label={t("settings.font_family")}>
        <select
          value={editorConfig.fontFamily}
          onChange={(e) => setEditorConfig({ fontFamily: e.target.value })}
          data-testid="editor-font-family"
          className="rounded-md border px-2 py-1 text-xs outline-none"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--bg-primary)",
            color: "var(--text-primary)",
          }}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </SettingsField>

      <SettingsField label={t("settings.font_size")}>
        <div className="flex gap-1.5">
          {FONT_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => setEditorConfig({ fontSize: size })}
              data-testid={`editor-font-size-${size}`}
              className={clsx(
                "interactive-ghost rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                editorConfig.fontSize === size ? "border-[var(--accent)]" : "border-[var(--border)]",
                editorConfig.fontSize !== size && "text-[var(--text-secondary)]"
              )}
              data-active={editorConfig.fontSize === size}
            >
              {size}px
            </button>
          ))}
        </div>
      </SettingsField>

      <SettingsField label={t("settings.default_mode")}>
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          Rich Text
        </span>
      </SettingsField>

      <SettingsField label={t("settings.spell_check")}>
        <div className="flex gap-2">
          <button
            onClick={() => setEditorConfig({ spellCheckEnabled: true })}
            data-testid="spell-check-on"
            className={clsx(
              "interactive-ghost rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              editorConfig.spellCheckEnabled ? "border-[var(--accent)]" : "border-[var(--border)]",
              !editorConfig.spellCheckEnabled && "text-[var(--text-secondary)]"
            )}
            data-active={editorConfig.spellCheckEnabled}
          >
            {t("common.yes")}
          </button>
          <button
            onClick={() => setEditorConfig({ spellCheckEnabled: false })}
            data-testid="spell-check-off"
            className={clsx(
              "interactive-ghost rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              !editorConfig.spellCheckEnabled ? "border-[var(--accent)]" : "border-[var(--border)]",
              editorConfig.spellCheckEnabled && "text-[var(--text-secondary)]"
            )}
            data-active={!editorConfig.spellCheckEnabled}
          >
            {t("common.no")}
          </button>
        </div>
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
