import { useRef, useEffect, useCallback } from "react";
import type { Stroke, StrokePoint, InkTool } from "@/lib/ink/types";
import {
  renderStrokesToCanvas,
  getStrokeOutline,
  getSvgPathFromStroke,
  hitTestStroke,
  createStrokeId,
  simplifyPoints,
} from "@/lib/ink/engine";

interface InkCanvasProps {
  width: number;
  height: number;
  strokes: Stroke[];
  activeTool: InkTool;
  activeColor: string;
  activeSize: number;
  activeOpacity?: number;
  onStrokeComplete: (stroke: Stroke) => void;
  onStrokeErased: (strokeId: string) => void;
  className?: string;
}

export function InkCanvas({
  width,
  height,
  strokes,
  activeTool,
  activeColor,
  activeSize,
  activeOpacity,
  onStrokeComplete,
  onStrokeErased,
  className = "",
}: InkCanvasProps) {
  const committedRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const currentPoints = useRef<StrokePoint[]>([]);

  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const canvasWidth = width * dpr;
  const canvasHeight = height * dpr;

  const getOpacity = useCallback(() => {
    if (activeOpacity !== undefined) return activeOpacity;
    return activeTool === "marker" ? 0.4 : 1.0;
  }, [activeTool, activeOpacity]);

  useEffect(() => {
    const canvas = committedRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderStrokesToCanvas(ctx, strokes, width, height);
  }, [strokes, width, height, dpr]);

  const renderActiveStroke = useCallback(() => {
    const canvas = activeRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (currentPoints.current.length === 0) return;

    const outline = getStrokeOutline(currentPoints.current, {
      size: activeSize,
      simulatePressure: false,
    });
    if (outline.length === 0) return;

    const pathData = getSvgPathFromStroke(outline);
    const path = new Path2D(pathData);
    ctx.save();
    ctx.globalAlpha = getOpacity();
    ctx.fillStyle = activeColor;
    ctx.fill(path);
    ctx.restore();
  }, [dpr, width, height, activeSize, activeColor, getOpacity]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (activeTool === "eraser") {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        for (const stroke of strokes) {
          if (hitTestStroke(stroke, x, y, activeSize / 2 + 5)) {
            onStrokeErased(stroke.id);
            return;
          }
        }
        return;
      }

      isDrawing.current = true;
      currentPoints.current = [
        {
          x: e.nativeEvent.offsetX,
          y: e.nativeEvent.offsetY,
          pressure: e.pressure || 0.5,
        },
      ];
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      renderActiveStroke();
    },
    [activeTool, activeSize, strokes, onStrokeErased, renderActiveStroke],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawing.current) return;

      const events = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [
        e.nativeEvent,
      ];
      for (const ce of events) {
        currentPoints.current.push({
          x: ce.offsetX,
          y: ce.offsetY,
          pressure: ce.pressure || 0.5,
        });
      }
      renderActiveStroke();
    },
    [renderActiveStroke],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (currentPoints.current.length < 2) {
      currentPoints.current = [];
      const canvas = activeRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvasWidth, canvasHeight);
      }
      return;
    }

    const simplified = simplifyPoints(currentPoints.current, 1.0);

    const stroke: Stroke = {
      id: createStrokeId(),
      points: simplified,
      color: activeColor,
      size: activeSize,
      tool: activeTool,
      opacity: getOpacity(),
      timestamp: Date.now(),
    };

    currentPoints.current = [];
    const canvas = activeRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvasWidth, canvasHeight);
    }

    onStrokeComplete(stroke);
  }, [
    activeColor,
    activeSize,
    activeTool,
    canvasWidth,
    canvasHeight,
    getOpacity,
    onStrokeComplete,
  ]);

  const cursorStyle = activeTool === "eraser" ? "crosshair" : "default";

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      <canvas
        ref={committedRef}
        width={canvasWidth}
        height={canvasHeight}
        style={{ position: "absolute", inset: 0, width, height }}
      />
      <canvas
        ref={activeRef}
        width={canvasWidth}
        height={canvasHeight}
        style={{
          position: "absolute",
          inset: 0,
          width,
          height,
          cursor: cursorStyle,
          touchAction: "none",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
}
