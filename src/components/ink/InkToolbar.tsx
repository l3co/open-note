import { Pen, Highlighter, Eraser, Undo2, Redo2, X } from "lucide-react";
import type { InkTool } from "@/lib/ink/types";
import { DEFAULT_COLORS, PEN_SIZES, MARKER_SIZES } from "@/lib/ink/types";

interface InkToolbarProps {
  activeTool: InkTool;
  activeColor: string;
  activeSize: number;
  canUndo: boolean;
  canRedo: boolean;
  onToolChange: (tool: InkTool) => void;
  onColorChange: (color: string) => void;
  onSizeChange: (size: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClose: () => void;
}

export function InkToolbar({
  activeTool,
  activeColor,
  activeSize,
  canUndo,
  canRedo,
  onToolChange,
  onColorChange,
  onSizeChange,
  onUndo,
  onRedo,
  onClose,
}: InkToolbarProps) {
  const sizes = activeTool === "marker" ? MARKER_SIZES : PEN_SIZES;

  return (
    <div
      className="flex items-center gap-3 rounded-lg border px-3 py-2 shadow-md"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex items-center gap-1">
        <ToolButton
          active={activeTool === "pen"}
          onClick={() => onToolChange("pen")}
          title="Caneta (P)"
        >
          <Pen size={16} />
        </ToolButton>
        <ToolButton
          active={activeTool === "marker"}
          onClick={() => onToolChange("marker")}
          title="Marcador (M)"
        >
          <Highlighter size={16} />
        </ToolButton>
        <ToolButton
          active={activeTool === "eraser"}
          onClick={() => onToolChange("eraser")}
          title="Borracha (E)"
        >
          <Eraser size={16} />
        </ToolButton>
      </div>

      <Divider />

      <div className="flex items-center gap-1">
        {DEFAULT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
            style={{
              backgroundColor: color,
              borderColor:
                activeColor === color ? "var(--accent)" : "transparent",
            }}
            onClick={() => onColorChange(color)}
            title={color}
          />
        ))}
      </div>

      <Divider />

      <div className="flex items-center gap-1">
        {sizes.map((size) => (
          <button
            key={size}
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded transition-colors"
            style={{
              backgroundColor:
                activeSize === size ? "var(--bg-hover)" : "transparent",
              color: "var(--text-primary)",
            }}
            onClick={() => onSizeChange(size)}
            title={`${size}px`}
          >
            <span
              className="rounded-full"
              style={{
                width: Math.min(size, 14),
                height: Math.min(size, 14),
                backgroundColor: activeColor,
              }}
            />
          </button>
        ))}
      </div>

      <Divider />

      <div className="flex items-center gap-1">
        <ToolButton
          active={false}
          onClick={onUndo}
          title="Desfazer (Cmd+Z)"
          disabled={!canUndo}
        >
          <Undo2 size={16} />
        </ToolButton>
        <ToolButton
          active={false}
          onClick={onRedo}
          title="Refazer (Cmd+Shift+Z)"
          disabled={!canRedo}
        >
          <Redo2 size={16} />
        </ToolButton>
      </div>

      <Divider />

      <ToolButton active={false} onClick={onClose} title="Sair (Esc)">
        <X size={16} />
      </ToolButton>
    </div>
  );
}

interface ToolButtonProps {
  active: boolean;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}

function ToolButton({
  active,
  onClick,
  title,
  disabled = false,
  children,
}: ToolButtonProps) {
  return (
    <button
      type="button"
      className="flex h-8 w-8 items-center justify-center rounded transition-colors"
      style={{
        backgroundColor: active ? "var(--accent-subtle)" : "transparent",
        color: active
          ? "var(--accent)"
          : disabled
            ? "var(--text-tertiary)"
            : "var(--text-secondary)",
        opacity: disabled ? 0.4 : 1,
      }}
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <div
      className="h-6 w-px"
      style={{ backgroundColor: "var(--border)" }}
    />
  );
}
