import { useState, useCallback, useRef, useEffect } from "react";
import { Maximize2, Pencil } from "lucide-react";
import type { Stroke } from "@/lib/ink/types";
import { strokesToSvg } from "@/lib/ink/engine";
import { InkCanvas } from "@/components/ink/InkCanvas";
import { InkToolbar } from "@/components/ink/InkToolbar";
import { useAnnotationStore } from "@/stores/useAnnotationStore";

type InkBlockState = "idle" | "editing" | "fullscreen";

interface InkBlockComponentProps {
  width: number | null;
  height: number;
  strokes: Stroke[];
  svgCache: string | null;
  onUpdate: (strokes: Stroke[], svgCache: string | null) => void;
}

export function InkBlockComponent({
  width: propWidth,
  height: propHeight,
  strokes: initialStrokes,
  svgCache: initialSvgCache,
  onUpdate,
}: InkBlockComponentProps) {
  const [state, setState] = useState<InkBlockState>("idle");
  const [strokes, setStrokes] = useState<Stroke[]>(initialStrokes);
  const [svgCache, setSvgCache] = useState<string | null>(initialSvgCache);
  const [blockHeight, setBlockHeight] = useState(propHeight);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(propWidth ?? 700);

  const { activeTool, activeColor, activeSize } = useAnnotationStore();

  const [localUndoStack, setLocalUndoStack] = useState<Stroke[][]>([]);
  const [localRedoStack, setLocalRedoStack] = useState<Stroke[][]>([]);

  useEffect(() => {
    if (!containerRef.current || propWidth !== null) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [propWidth]);

  const effectiveWidth = propWidth ?? containerWidth;

  const regenerateSvg = useCallback(
    (currentStrokes: Stroke[]) => {
      if (currentStrokes.length === 0) return null;
      return strokesToSvg(currentStrokes, effectiveWidth, blockHeight);
    },
    [effectiveWidth, blockHeight],
  );

  const handleStrokeComplete = useCallback(
    (stroke: Stroke) => {
      setLocalUndoStack((prev) => [...prev, strokes]);
      setLocalRedoStack([]);
      const next = [...strokes, stroke];
      setStrokes(next);
      const svg = regenerateSvg(next);
      setSvgCache(svg);
      onUpdate(next, svg);
    },
    [strokes, regenerateSvg, onUpdate],
  );

  const handleStrokeErased = useCallback(
    (strokeId: string) => {
      setLocalUndoStack((prev) => [...prev, strokes]);
      setLocalRedoStack([]);
      const next = strokes.filter((s) => s.id !== strokeId);
      setStrokes(next);
      const svg = regenerateSvg(next);
      setSvgCache(svg);
      onUpdate(next, svg);
    },
    [strokes, regenerateSvg, onUpdate],
  );

  const handleUndo = useCallback(() => {
    if (localUndoStack.length === 0) return;
    const prev = localUndoStack[localUndoStack.length - 1]!;
    setLocalRedoStack((r) => [...r, strokes]);
    setLocalUndoStack((u) => u.slice(0, -1));
    setStrokes(prev);
    const svg = regenerateSvg(prev);
    setSvgCache(svg);
    onUpdate(prev, svg);
  }, [localUndoStack, strokes, regenerateSvg, onUpdate]);

  const handleRedo = useCallback(() => {
    if (localRedoStack.length === 0) return;
    const next = localRedoStack[localRedoStack.length - 1]!;
    setLocalUndoStack((u) => [...u, strokes]);
    setLocalRedoStack((r) => r.slice(0, -1));
    setStrokes(next);
    const svg = regenerateSvg(next);
    setSvgCache(svg);
    onUpdate(next, svg);
  }, [localRedoStack, strokes, regenerateSvg, onUpdate]);

  const enterEditing = useCallback(() => setState("editing"), []);
  const enterFullscreen = useCallback(() => setState("fullscreen"), []);
  const exitFullscreen = useCallback(() => setState("editing"), []);
  const exitEditing = useCallback(() => {
    const svg = regenerateSvg(strokes);
    setSvgCache(svg);
    setState("idle");
  }, [strokes, regenerateSvg]);

  useEffect(() => {
    if (state !== "editing" && state !== "fullscreen") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (state === "fullscreen") exitFullscreen();
        else exitEditing();
      }
      if (e.key === "F11") {
        e.preventDefault();
        if (state === "fullscreen") exitFullscreen();
        else enterFullscreen();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [state, exitEditing, exitFullscreen, enterFullscreen]);

  const resizeHandleRef = useRef<{ startY: number; startH: number } | null>(
    null,
  );

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeHandleRef.current = { startY: e.clientY, startH: blockHeight };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [blockHeight],
  );

  const handleResizePointerMove = useCallback((e: React.PointerEvent) => {
    if (!resizeHandleRef.current) return;
    const delta = e.clientY - resizeHandleRef.current.startY;
    const newH = Math.max(100, resizeHandleRef.current.startH + delta);
    setBlockHeight(newH);
  }, []);

  const handleResizePointerUp = useCallback(() => {
    resizeHandleRef.current = null;
  }, []);

  if (state === "fullscreen") {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{ backgroundColor: "var(--bg-primary)" }}
      >
        <div className="flex items-center justify-center border-b px-4 py-2"
          style={{ borderColor: "var(--border)" }}
        >
          <InkToolbar
            activeTool={activeTool}
            activeColor={activeColor}
            activeSize={activeSize}
            canUndo={localUndoStack.length > 0}
            canRedo={localRedoStack.length > 0}
            onToolChange={useAnnotationStore.getState().setTool}
            onColorChange={useAnnotationStore.getState().setColor}
            onSizeChange={useAnnotationStore.getState().setSize}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClose={exitFullscreen}
          />
        </div>
        <div className="flex-1">
          <InkCanvas
            width={window.innerWidth}
            height={window.innerHeight - 56}
            strokes={strokes}
            activeTool={activeTool}
            activeColor={activeColor}
            activeSize={activeSize}
            onStrokeComplete={handleStrokeComplete}
            onStrokeErased={handleStrokeErased}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="ink-block-container group relative my-2 rounded-lg border"
      style={{ borderColor: "var(--border)", minHeight: 100 }}
    >
      {state === "idle" && (
        <div
          className="relative cursor-pointer"
          style={{ height: blockHeight }}
          onClick={enterEditing}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && enterEditing()}
        >
          {svgCache ? (
            <div
              className="h-full w-full"
              dangerouslySetInnerHTML={{ __html: svgCache }}
            />
          ) : (
            <div
              className="flex h-full items-center justify-center text-sm"
              style={{ color: "var(--text-tertiary)" }}
            >
              <Pencil size={16} className="mr-2" />
              Clique para desenhar
            </div>
          )}

          <div
            className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <button
              type="button"
              className="rounded p-1 transition-colors hover:bg-black/10"
              onClick={(e) => {
                e.stopPropagation();
                enterEditing();
              }}
              title="Editar"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              className="rounded p-1 transition-colors hover:bg-black/10"
              onClick={(e) => {
                e.stopPropagation();
                enterFullscreen();
              }}
              title="Tela cheia (F11)"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>
      )}

      {state === "editing" && (
        <div>
          <div
            className="flex items-center justify-between border-b px-3 py-1"
            style={{ borderColor: "var(--border)" }}
          >
            <InkToolbar
              activeTool={activeTool}
              activeColor={activeColor}
              activeSize={activeSize}
              canUndo={localUndoStack.length > 0}
              canRedo={localRedoStack.length > 0}
              onToolChange={useAnnotationStore.getState().setTool}
              onColorChange={useAnnotationStore.getState().setColor}
              onSizeChange={useAnnotationStore.getState().setSize}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onClose={exitEditing}
            />
            <button
              type="button"
              className="rounded p-1 transition-colors"
              style={{ color: "var(--text-secondary)" }}
              onClick={enterFullscreen}
              title="Tela cheia (F11)"
            >
              <Maximize2 size={16} />
            </button>
          </div>
          <InkCanvas
            width={effectiveWidth}
            height={blockHeight}
            strokes={strokes}
            activeTool={activeTool}
            activeColor={activeColor}
            activeSize={activeSize}
            onStrokeComplete={handleStrokeComplete}
            onStrokeErased={handleStrokeErased}
          />
        </div>
      )}

      <div
        className="h-2 cursor-row-resize border-t"
        style={{ borderColor: "var(--border)" }}
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        onPointerCancel={handleResizePointerUp}
      />
    </div>
  );
}
