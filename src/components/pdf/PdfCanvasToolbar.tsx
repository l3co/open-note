import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Pen,
  Eraser,
  MousePointer,
  Undo2,
  Redo2,
  Highlighter,
} from "lucide-react";
import {
  PEN_COLORS,
  HIGHLIGHT_COLORS,
  PEN_SIZES,
  HIGHLIGHT_SIZES,
} from "./PdfCanvasConstants";

export type PdfCanvasTool = "scroll" | "pen" | "highlighter" | "eraser";

interface PdfCanvasToolbarProps {
  currentPage: number;
  totalPages: number;
  scale: number;
  tool: PdfCanvasTool;
  color: string;
  strokeSize: number;
  canUndo: boolean;
  canRedo: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToolChange: (tool: PdfCanvasTool) => void;
  onColorChange: (color: string) => void;
  onSizeChange: (size: number) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function PdfCanvasToolbar({
  currentPage,
  totalPages,
  scale,
  tool,
  color,
  strokeSize,
  canUndo,
  canRedo,
  onPrevPage,
  onNextPage,
  onZoomIn,
  onZoomOut,
  onToolChange,
  onColorChange,
  onSizeChange,
  onUndo,
  onRedo,
}: PdfCanvasToolbarProps) {
  const { t } = useTranslation();
  const isDrawing = tool === "pen" || tool === "highlighter";
  const colors = tool === "highlighter" ? HIGHLIGHT_COLORS : PEN_COLORS;
  const sizes = tool === "highlighter" ? HIGHLIGHT_SIZES : PEN_SIZES;

  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-1 border-b px-3 py-1.5"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      {/* Page navigation */}
      <ToolbarBtn
        onClick={onPrevPage}
        disabled={currentPage <= 1}
        title={t("pdf_canvas.prev_page")}
      >
        <ChevronLeft size={16} />
      </ToolbarBtn>

      <span
        className="min-w-[60px] text-center text-xs"
        style={{ color: "var(--text-secondary)" }}
      >
        {currentPage} / {totalPages}
      </span>

      <ToolbarBtn
        onClick={onNextPage}
        disabled={currentPage >= totalPages}
        title={t("pdf_canvas.next_page")}
      >
        <ChevronRight size={16} />
      </ToolbarBtn>

      <Divider />

      {/* Zoom */}
      <ToolbarBtn
        onClick={onZoomOut}
        disabled={scale <= 0.5}
        title={t("pdf_canvas.zoom_out")}
      >
        <ZoomOut size={16} />
      </ToolbarBtn>

      <span
        className="min-w-[40px] text-center text-xs"
        style={{ color: "var(--text-secondary)" }}
      >
        {Math.round(scale * 100)}%
      </span>

      <ToolbarBtn
        onClick={onZoomIn}
        disabled={scale >= 3}
        title={t("pdf_canvas.zoom_in")}
      >
        <ZoomIn size={16} />
      </ToolbarBtn>

      <Divider />

      {/* Tool selection */}
      <ToolbarBtn
        onClick={() => onToolChange("scroll")}
        active={tool === "scroll"}
        title={t("pdf_canvas.tool_scroll")}
      >
        <MousePointer size={16} />
      </ToolbarBtn>

      <ToolbarBtn
        onClick={() => onToolChange("pen")}
        active={tool === "pen"}
        title={t("pdf_canvas.tool_pen")}
      >
        <Pen size={16} />
      </ToolbarBtn>

      <ToolbarBtn
        onClick={() => onToolChange("highlighter")}
        active={tool === "highlighter"}
        title={t("pdf_canvas.tool_highlighter")}
      >
        <Highlighter size={16} />
      </ToolbarBtn>

      <ToolbarBtn
        onClick={() => onToolChange("eraser")}
        active={tool === "eraser"}
        title={t("pdf_canvas.tool_eraser")}
      >
        <Eraser size={16} />
      </ToolbarBtn>

      {/* Color palette — visible when pen or highlighter is active */}
      {isDrawing && (
        <>
          <Divider />
          <div className="flex items-center gap-1">
            {(colors as readonly string[]).map((c) => (
              <button
                key={c}
                title={c}
                onClick={() => onColorChange(c)}
                className="rounded-full transition-all"
                style={{
                  width: 18,
                  height: 18,
                  backgroundColor: c,
                  border:
                    color === c
                      ? "2px solid var(--accent)"
                      : "2px solid transparent",
                  outline:
                    color === c ? "1px solid var(--bg-secondary)" : "none",
                  outlineOffset: 1,
                }}
              />
            ))}
          </div>

          <Divider />

          {/* Size selector */}
          <div className="flex items-center gap-0.5">
            {(sizes as readonly { label: string; value: number }[]).map((s) => (
              <button
                key={s.value}
                onClick={() => onSizeChange(s.value)}
                title={`${t("pdf_canvas.size")} ${s.label}`}
                className="flex h-7 min-w-[26px] items-center justify-center rounded px-1 text-xs transition-colors"
                style={{
                  backgroundColor:
                    strokeSize === s.value
                      ? "var(--accent-subtle)"
                      : "transparent",
                  color:
                    strokeSize === s.value
                      ? "var(--accent)"
                      : "var(--text-secondary)",
                  fontWeight: strokeSize === s.value ? 600 : 400,
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}

      <Divider />

      {/* Undo / Redo */}
      <ToolbarBtn
        onClick={onUndo}
        disabled={!canUndo}
        title={t("pdf_canvas.undo")}
      >
        <Undo2 size={16} />
      </ToolbarBtn>

      <ToolbarBtn
        onClick={onRedo}
        disabled={!canRedo}
        title={t("pdf_canvas.redo")}
      >
        <Redo2 size={16} />
      </ToolbarBtn>
    </div>
  );
}

function ToolbarBtn({
  children,
  onClick,
  disabled,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded transition-colors disabled:opacity-40"
      style={{
        backgroundColor: active ? "var(--accent-subtle)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-secondary)",
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <div
      className="mx-1 h-5 w-px shrink-0"
      style={{ backgroundColor: "var(--border)" }}
    />
  );
}
