import { useTranslation } from "react-i18next";
import { Type, Code } from "lucide-react";

export type EditorMode = "richtext" | "markdown";

interface EditorModeToggleProps {
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
}

export function EditorModeToggle({ mode, onChange }: EditorModeToggleProps) {
  const { t } = useTranslation();

  return (
    <div
      className="inline-flex overflow-hidden rounded-md border"
      style={{ borderColor: "var(--border)" }}
      data-testid="editor-mode-toggle"
    >
      <button
        type="button"
        className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium transition-colors"
        style={{
          backgroundColor:
            mode === "richtext" ? "var(--accent-subtle)" : "transparent",
          color:
            mode === "richtext" ? "var(--accent)" : "var(--text-secondary)",
        }}
        onClick={() => onChange("richtext")}
        data-testid="mode-richtext"
      >
        <Type size={14} />
        {t("editor.mode_richtext")}
      </button>
      <button
        type="button"
        className="flex items-center gap-1.5 border-l px-3 py-1 text-xs font-medium transition-colors"
        style={{
          borderColor: "var(--border)",
          backgroundColor:
            mode === "markdown" ? "var(--accent-subtle)" : "transparent",
          color:
            mode === "markdown" ? "var(--accent)" : "var(--text-secondary)",
        }}
        onClick={() => onChange("markdown")}
        data-testid="mode-markdown"
      >
        <Code size={14} />
        {t("editor.mode_markdown")}
      </button>
    </div>
  );
}
