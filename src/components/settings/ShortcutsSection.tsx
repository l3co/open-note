import { useTranslation } from "react-i18next";

interface Shortcut {
  keys: string;
  labelKey: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: "Cmd+N", labelKey: "page.new" },
  { keys: "Cmd+Shift+N", labelKey: "notebook.new" },
  { keys: "Cmd+S", labelKey: "common.save" },
  { keys: "Cmd+P", labelKey: "search.quick_open_placeholder" },
  { keys: "Cmd+Shift+F", labelKey: "sidebar.search" },
  { keys: "Cmd+Shift+M", labelKey: "editor.mode_markdown" },
  { keys: "Cmd+B", labelKey: "editor.toolbar.bold" },
  { keys: "Cmd+I", labelKey: "editor.toolbar.italic" },
  { keys: "Cmd+U", labelKey: "editor.toolbar.underline" },
  { keys: "Cmd+K", labelKey: "editor.toolbar.link" },
  { keys: "Cmd+E", labelKey: "editor.toolbar.code" },
  { keys: "Cmd+,", labelKey: "settings.title" },
];

export function ShortcutsSection() {
  const { t } = useTranslation();

  return (
    <div className="space-y-1">
      {SHORTCUTS.map((shortcut) => (
        <div
          key={shortcut.keys}
          className="flex items-center justify-between rounded-md px-2 py-2"
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "var(--bg-hover)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
        >
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
            {t(shortcut.labelKey)}
          </span>
          <kbd
            className="rounded px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--text-tertiary)",
              border: "1px solid var(--border)",
            }}
          >
            {shortcut.keys}
          </kbd>
        </div>
      ))}
    </div>
  );
}
