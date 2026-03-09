import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import appIcon from "@/assets/logo.png";

export function AboutSection() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <img
          src={appIcon}
          alt="Open Note"
          className="h-12 w-12 rounded-xl"
        />
        <div>
          <h3
            className="text-base font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Open Note
          </h3>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            {t("settings.version")} 0.1.0
          </p>
        </div>
      </div>

      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {t("workspace.picker_subtitle")}
      </p>

      <div className="space-y-2">
        <AboutLink
          label={t("settings.github")}
          href="https://github.com/open-note/open-note"
        />
        <AboutLink
          label={t("settings.docs")}
          href="https://open-note.dev/docs"
        />
        <AboutLink
          label={t("settings.license")}
          href="https://github.com/open-note/open-note/blob/main/LICENSE"
        />
      </div>
    </div>
  );
}

function AboutLink({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between rounded-md px-2 py-2 text-sm transition-colors"
      style={{ color: "var(--accent)" }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.backgroundColor = "var(--bg-hover)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.backgroundColor = "transparent")
      }
    >
      {label}
      <ExternalLink size={14} style={{ color: "var(--text-tertiary)" }} />
    </a>
  );
}
