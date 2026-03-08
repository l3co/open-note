import { useTranslation } from "react-i18next";
import { BookOpen, Plus, Keyboard } from "lucide-react";

export function WelcomePage() {
  const { t } = useTranslation();

  return (
    <div
      className="flex flex-1 items-center justify-center"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div className="max-w-md text-center">
        <div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ backgroundColor: "var(--accent-subtle)" }}
        >
          <BookOpen size={32} style={{ color: "var(--accent)" }} />
        </div>

        <h1
          className="text-2xl font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Open Note
        </h1>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("page.select_page")}
        </p>

        <div className="mt-8 space-y-3">
          <ShortcutHint icon={<Plus size={14} />} label={t("page.new")} keys="Cmd+N" />
          <ShortcutHint
            icon={<Keyboard size={14} />}
            label={t("notebook.new")}
            keys="Cmd+Shift+N"
          />
        </div>
      </div>
    </div>
  );
}

function ShortcutHint({
  icon,
  label,
  keys,
}: {
  icon: React.ReactNode;
  label: string;
  keys: string;
}) {
  return (
    <div
      className="flex items-center justify-between rounded-lg px-4 py-2.5"
      style={{ backgroundColor: "var(--bg-secondary)" }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: "var(--text-tertiary)" }}>{icon}</span>
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {label}
        </span>
      </div>
      <kbd
        className="rounded px-2 py-0.5 text-xs font-medium"
        style={{
          backgroundColor: "var(--bg-tertiary)",
          color: "var(--text-tertiary)",
          border: "1px solid var(--border)",
        }}
      >
        {keys}
      </kbd>
    </div>
  );
}
