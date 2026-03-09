import { useTranslation } from "react-i18next";
import { useUIStore } from "@/stores/useUIStore";
import { ACCENT_PALETTES } from "@/lib/theme";
import { clsx } from "clsx";

export function AppearanceSection() {
  const { t } = useTranslation();
  const { theme, setTheme, applyThemeToDOM } = useUIStore();

  const handleBaseTheme = (
    baseTheme: "light" | "dark" | "paper" | "system",
  ) => {
    setTheme({ baseTheme });
    setTimeout(() => applyThemeToDOM(), 0);
  };

  const handleAccentColor = (accentColor: string) => {
    setTheme({ accentColor });
    setTimeout(() => applyThemeToDOM(), 0);
  };

  const handleChromeTint = (chromeTint: "neutral" | "tinted") => {
    setTheme({ chromeTint });
    setTimeout(() => applyThemeToDOM(), 0);
  };

  const themes: { id: "light" | "dark" | "paper" | "system"; label: string }[] =
    [
      { id: "light", label: t("settings.theme_light") },
      { id: "dark", label: t("settings.theme_dark") },
      { id: "paper", label: t("settings.theme_paper") },
      { id: "system", label: t("settings.theme_system") },
    ];

  return (
    <div className="space-y-6">
      {/* Theme */}
      <SettingsField label={t("settings.theme")}>
        <div className="flex gap-2">
          {themes.map((th) => (
            <button
              key={th.id}
              onClick={() => handleBaseTheme(th.id)}
              className={clsx(
                "interactive-ghost rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                theme.baseTheme === th.id ? "border-[var(--accent)]" : "border-[var(--border)]",
                theme.baseTheme !== th.id && "text-[var(--text-secondary)]"
              )}
              data-active={theme.baseTheme === th.id}
            >
              {th.label}
            </button>
          ))}
        </div>
      </SettingsField>

      {/* Accent Color */}
      <SettingsField label={t("settings.accent_color")}>
        <div className="flex gap-1.5">
          {ACCENT_PALETTES.map((palette) => (
            <button
              key={palette.name}
              onClick={() => handleAccentColor(palette.name)}
              className="flex h-6 w-6 items-center justify-center rounded-full border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: palette.hex,
                borderColor:
                  theme.accentColor === palette.name
                    ? "var(--text-primary)"
                    : "transparent",
              }}
              title={palette.name}
              aria-label={palette.name}
            />
          ))}
        </div>
      </SettingsField>

      {/* Chrome Tint */}
      <SettingsField label={t("settings.chrome_tint")}>
        <div className="flex gap-2">
          <button
            onClick={() => handleChromeTint("neutral")}
            className={clsx(
              "interactive-ghost rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              theme.chromeTint === "neutral" ? "border-[var(--accent)]" : "border-[var(--border)]",
              theme.chromeTint !== "neutral" && "text-[var(--text-secondary)]"
            )}
            data-active={theme.chromeTint === "neutral"}
          >
            {t("settings.chrome_neutral")}
          </button>
          <button
            onClick={() => handleChromeTint("tinted")}
            className={clsx(
              "interactive-ghost rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              theme.chromeTint === "tinted" ? "border-[var(--accent)]" : "border-[var(--border)]",
              theme.chromeTint !== "tinted" && "text-[var(--text-secondary)]"
            )}
            data-active={theme.chromeTint === "tinted"}
          >
            {t("settings.chrome_tinted")}
          </button>
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
      <span className="text-sm" style={{ color: "var(--text-primary)" }}>
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}
