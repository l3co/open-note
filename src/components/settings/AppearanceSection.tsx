import { useTranslation } from "react-i18next";
import { useUIStore } from "@/stores/useUIStore";
import { ACCENT_PALETTES } from "@/lib/theme";

export function AppearanceSection() {
  const { t } = useTranslation();
  const { theme, setTheme, applyThemeToDOM } = useUIStore();

  const handleBaseTheme = (baseTheme: "light" | "dark" | "paper" | "system") => {
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

  const themes: { id: "light" | "dark" | "paper" | "system"; label: string }[] = [
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
              className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                borderColor: theme.baseTheme === th.id ? "var(--accent)" : "var(--border)",
                backgroundColor: theme.baseTheme === th.id ? "var(--accent-subtle)" : "transparent",
                color: theme.baseTheme === th.id ? "var(--accent)" : "var(--text-secondary)",
              }}
              onMouseEnter={(e) => {
                if (theme.baseTheme !== th.id)
                  e.currentTarget.style.backgroundColor = "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                if (theme.baseTheme !== th.id)
                  e.currentTarget.style.backgroundColor = "transparent";
              }}
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
            className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              borderColor: theme.chromeTint === "neutral" ? "var(--accent)" : "var(--border)",
              backgroundColor: theme.chromeTint === "neutral" ? "var(--accent-subtle)" : "transparent",
              color: theme.chromeTint === "neutral" ? "var(--accent)" : "var(--text-secondary)",
            }}
            onMouseEnter={(e) => {
              if (theme.chromeTint !== "neutral")
                e.currentTarget.style.backgroundColor = "var(--bg-hover)";
            }}
            onMouseLeave={(e) => {
              if (theme.chromeTint !== "neutral")
                e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {t("settings.chrome_neutral")}
          </button>
          <button
            onClick={() => handleChromeTint("tinted")}
            className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              borderColor: theme.chromeTint === "tinted" ? "var(--accent)" : "var(--border)",
              backgroundColor: theme.chromeTint === "tinted" ? "var(--accent-subtle)" : "transparent",
              color: theme.chromeTint === "tinted" ? "var(--accent)" : "var(--text-secondary)",
            }}
            onMouseEnter={(e) => {
              if (theme.chromeTint !== "tinted")
                e.currentTarget.style.backgroundColor = "var(--bg-hover)";
            }}
            onMouseLeave={(e) => {
              if (theme.chromeTint !== "tinted")
                e.currentTarget.style.backgroundColor = "transparent";
            }}
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
