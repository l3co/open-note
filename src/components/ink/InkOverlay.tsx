import { useRef, useEffect, useCallback, useState } from "react";
import type { AnchoredStroke } from "@/lib/ink/types";
import {
  renderStrokesToCanvas,
  getStrokeOutline,
  getSvgPathFromStroke,
  hitTestStroke,
  createStrokeId,
  simplifyPoints,
  strokesToSvg,
} from "@/lib/ink/engine";
import { useAnnotationStore } from "@/stores/useAnnotationStore";
import { InkToolbar } from "@/components/ink/InkToolbar";

interface InkOverlayProps {
  contentRef: React.RefObject<HTMLElement | null>;
}

export function InkOverlay({ contentRef }: InkOverlayProps) {
  const {
    isAnnotationMode,
    activeTool,
    activeColor,
    activeSize,
    annotations,
    undoStack,
    redoStack,
    addStroke,
    removeStroke,
    setTool,
    setColor,
    setSize,
    undo,
    redo,
    setAnnotationMode,
  } = useAnnotationStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<HTMLDivElement>(null);
  const isDrawing = useRef(false);
  const currentPoints = useRef<{ x: number; y: number; pressure: number }[]>(
    [],
  );
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  useEffect(() => {
    if (!contentRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        setDimensions({
          width: el.scrollWidth,
          height: el.scrollHeight,
        });
      }
    });
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [contentRef]);

  useEffect(() => {
    if (isAnnotationMode || !svgRef.current) return;
    if (annotations.strokes.length === 0) {
      svgRef.current.innerHTML = "";
      return;
    }
    const svg = strokesToSvg(
      annotations.strokes,
      dimensions.width,
      dimensions.height,
    );
    svgRef.current.innerHTML = svg;
  }, [isAnnotationMode, annotations.strokes, dimensions]);

  useEffect(() => {
    if (!isAnnotationMode || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderStrokesToCanvas(
      ctx,
      annotations.strokes,
      dimensions.width,
      dimensions.height,
    );
  }, [isAnnotationMode, annotations.strokes, dimensions, dpr]);

  const resolveAnchor = useCallback(
    (x: number, y: number): AnchoredStroke["anchor"] => {
      if (!contentRef.current) return null;
      const blocks = contentRef.current.querySelectorAll("[data-block-id]");
      for (const block of blocks) {
        const rect = block.getBoundingClientRect();
        const containerRect = contentRef.current.getBoundingClientRect();
        const top = rect.top - containerRect.top + contentRef.current.scrollTop;
        const left = rect.left - containerRect.left;
        const bottom = top + rect.height;
        const right = left + rect.width;

        if (y >= top && y <= bottom && x >= left && x <= right) {
          return {
            blockId: block.getAttribute("data-block-id")!,
            offsetX: x - left,
            offsetY: y - top,
          };
        }
      }
      return null;
    },
    [contentRef],
  );

  const getOpacity = useCallback(() => {
    return activeTool === "marker" ? 0.4 : 1.0;
  }, [activeTool]);

  const renderActiveStroke = useCallback(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    for (const stroke of annotations.strokes) {
      const outline = getStrokeOutline(stroke.points, {
        size: stroke.size,
        simulatePressure: false,
      });
      if (outline.length === 0) continue;
      const path = new Path2D(getSvgPathFromStroke(outline));
      ctx.save();
      ctx.globalAlpha = stroke.opacity;
      ctx.fillStyle = stroke.color;
      ctx.fill(path);
      ctx.restore();
    }

    if (currentPoints.current.length > 0) {
      const outline = getStrokeOutline(currentPoints.current, {
        size: activeSize,
        simulatePressure: false,
      });
      if (outline.length > 0) {
        const path = new Path2D(getSvgPathFromStroke(outline));
        ctx.save();
        ctx.globalAlpha = getOpacity();
        ctx.fillStyle = activeColor;
        ctx.fill(path);
        ctx.restore();
      }
    }
  }, [
    dpr,
    dimensions,
    annotations.strokes,
    activeSize,
    activeColor,
    getOpacity,
  ]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isAnnotationMode) return;

      if (e.pointerType === "pen" && !isAnnotationMode) {
        setAnnotationMode(true);
      }

      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const containerRect = contentRef.current?.getBoundingClientRect();
      const scrollTop = contentRef.current?.scrollTop ?? 0;
      const x = e.clientX - (containerRect?.left ?? rect.left);
      const y = e.clientY - (containerRect?.top ?? rect.top) + scrollTop;

      if (activeTool === "eraser") {
        for (const stroke of annotations.strokes) {
          if (hitTestStroke(stroke, x, y, activeSize / 2 + 5)) {
            removeStroke(stroke.id);
            return;
          }
        }
        return;
      }

      isDrawing.current = true;
      currentPoints.current = [{ x, y, pressure: e.pressure || 0.5 }];
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      renderActiveStroke();
    },
    [
      isAnnotationMode,
      activeTool,
      activeSize,
      annotations.strokes,
      removeStroke,
      setAnnotationMode,
      contentRef,
      renderActiveStroke,
    ],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawing.current) return;
      const containerRect = contentRef.current?.getBoundingClientRect();
      const scrollTop = contentRef.current?.scrollTop ?? 0;

      const events = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [
        e.nativeEvent,
      ];
      for (const ce of events) {
        const x = ce.clientX - (containerRect?.left ?? 0);
        const y = ce.clientY - (containerRect?.top ?? 0) + scrollTop;
        currentPoints.current.push({ x, y, pressure: ce.pressure || 0.5 });
      }
      renderActiveStroke();
    },
    [contentRef, renderActiveStroke],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (currentPoints.current.length < 2) {
      currentPoints.current = [];
      renderActiveStroke();
      return;
    }

    const simplified = simplifyPoints(currentPoints.current, 1.0);
    const startPoint = currentPoints.current[0]!;
    const anchor = resolveAnchor(startPoint.x, startPoint.y);

    const stroke: AnchoredStroke = {
      id: createStrokeId(),
      points: simplified,
      color: activeColor,
      size: activeSize,
      tool: activeTool,
      opacity: getOpacity(),
      timestamp: Date.now(),
      anchor,
    };

    currentPoints.current = [];
    addStroke(stroke);
  }, [
    activeColor,
    activeSize,
    activeTool,
    getOpacity,
    resolveAnchor,
    addStroke,
    renderActiveStroke,
  ]);

  useEffect(() => {
    if (!isAnnotationMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAnnotationMode(false);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      if (e.key === "p" || e.key === "P") setTool("pen");
      if (e.key === "m" || e.key === "M") setTool("marker");
      if (e.key === "e" || e.key === "E") setTool("eraser");
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isAnnotationMode, setAnnotationMode, undo, redo, setTool]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key === "a" || e.key === "A")
      ) {
        e.preventDefault();
        setAnnotationMode(!isAnnotationMode);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isAnnotationMode, setAnnotationMode]);

  return (
    <>
      {isAnnotationMode && (
        <div
          className="sticky top-0 z-[101] flex justify-center border-b py-2"
          style={{
            backgroundColor: "var(--bg-primary)",
            borderColor: "var(--border)",
          }}
        >
          <InkToolbar
            activeTool={activeTool}
            activeColor={activeColor}
            activeSize={activeSize}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            onToolChange={setTool}
            onColorChange={setColor}
            onSizeChange={setSize}
            onUndo={undo}
            onRedo={redo}
            onClose={() => setAnnotationMode(false)}
          />
        </div>
      )}

      <div
        ref={svgRef}
        className="ink-overlay pointer-events-none absolute inset-0"
        style={{
          zIndex: 100,
          display: isAnnotationMode ? "none" : "block",
          width: dimensions.width || "100%",
          height: dimensions.height || "100%",
        }}
      />

      {isAnnotationMode && (
        <canvas
          ref={canvasRef}
          className="ink-overlay absolute inset-0"
          width={dimensions.width * dpr}
          height={dimensions.height * dpr}
          style={{
            zIndex: 100,
            width: dimensions.width || "100%",
            height: dimensions.height || "100%",
            cursor: activeTool === "eraser" ? "crosshair" : "crosshair",
            touchAction: "none",
            pointerEvents: "auto",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      )}
    </>
  );
}
