import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { PdfCanvasToolbar, type PdfCanvasTool } from "./PdfCanvasToolbar";
import {
  PEN_COLORS,
  HIGHLIGHT_COLORS,
  PEN_SIZES,
  HIGHLIGHT_SIZES,
} from "./PdfCanvasConstants";
import { readAssetBase64, updatePageAnnotations } from "@/lib/ipc";
import { renderStrokesToCanvas, renderStrokeToCanvas } from "@/lib/ink/engine";
import type { Stroke } from "@/lib/ink/types";
import type { Page } from "@/types/bindings/Page";
import type { AnchoredStroke } from "@/types/bindings/AnchoredStroke";
import type { StrokePoint } from "@/types/bindings/StrokePoint";
import type { PageAnnotations } from "@/types/bindings/PageAnnotations";

function toRenderStroke(
  s: AnchoredStroke,
  scaleX: number,
  scaleY: number,
): Stroke {
  return {
    id: s.id,
    points: s.points.map((p) => ({
      x: p.x * scaleX,
      y: p.y * scaleY,
      pressure: p.pressure,
    })),
    color: s.color,
    size: s.size,
    tool: s.tool as Stroke["tool"],
    opacity: s.opacity,
    timestamp: Number(s.timestamp),
  };
}

const NULL_UUID = "00000000-0000-0000-0000-000000000000";
const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const SCALE_STEP = 0.25;
const AUTOSAVE_DELAY_MS = 1500;

interface PdfCanvasPageProps {
  page: Page;
}

interface InkPoint {
  x: number;
  y: number;
  pressure: number;
}

export function PdfCanvasPage({ page }: PdfCanvasPageProps) {
  const { t } = useTranslation();

  // PDF state
  const [pdfSrc, setPdfSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number>(page.pdf_total_pages ?? 1);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.25);

  // Tool state
  const [tool, setTool] = useState<PdfCanvasTool>("scroll");
  const [color, setColor] = useState<string>(PEN_COLORS[0]);
  const [strokeSize, setStrokeSize] = useState<number>(PEN_SIZES[2].value);

  const handleToolChange = useCallback((next: PdfCanvasTool) => {
    setTool(next);
    if (next === "highlighter") {
      setColor(HIGHLIGHT_COLORS[0]);
      setStrokeSize(HIGHLIGHT_SIZES[1].value);
    } else if (next === "pen") {
      setColor(PEN_COLORS[0]);
      setStrokeSize(PEN_SIZES[2].value);
    }
  }, []);

  // Strokes state — committed strokes per PDF page (1-indexed)
  const [strokesByPage, setStrokesByPage] = useState<
    Map<number, AnchoredStroke[]>
  >(() => {
    const map = new Map<number, AnchoredStroke[]>();
    for (const stroke of page.annotations.strokes) {
      const pdfPage = stroke.anchor?.pdf_page ?? 1;
      const arr = map.get(pdfPage) ?? [];
      arr.push(stroke);
      map.set(pdfPage, arr);
    }
    return map;
  });

  // Undo/redo history (list of full strokesByPage snapshots)
  const [undoStack, setUndoStack] = useState<Map<number, AnchoredStroke[]>[]>(
    [],
  );
  const [redoStack, setRedoStack] = useState<Map<number, AnchoredStroke[]>[]>(
    [],
  );

  // Active stroke being drawn
  const activePointsRef = useRef<InkPoint[]>([]);
  const isDrawingRef = useRef(false);

  // Canvas refs per PDF page: pdfCanvas and inkCanvas
  const pdfCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const inkCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const activeInkCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);

  // Autosave timer
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Load PDF ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!page.pdf_asset) return;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const dataUrl = await readAssetBase64(page.pdf_asset!);
        if (cancelled) return;

        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const response = await fetch(dataUrl);
        const buffer = await response.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
          .promise;
        if (cancelled) return;

        pdfDocRef.current = pdf;
        setPageCount(pdf.numPages);
        setPdfSrc(dataUrl);
      } catch (err) {
        if (!cancelled) {
          setError(t("pdf_canvas.load_error"));
          console.error("[PdfCanvasPage] load error:", err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [page.pdf_asset, t]);

  // ─── Render PDF pages whenever scale/pageCount changes ───────────────────────

  useEffect(() => {
    const pdf = pdfDocRef.current;
    if (!pdf || !pdfSrc) return;
    let cancelled = false;

    const renderAll = async () => {
      const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
      for (const pageNum of pages) {
        if (cancelled) return;
        const canvas = pdfCanvasRefs.current.get(pageNum);
        if (!canvas) continue;

        const pdfPage = await pdf.getPage(pageNum);
        const viewport = pdfPage.getViewport({ scale });
        const dpr = window.devicePixelRatio || 1;

        canvas.width = viewport.width * dpr;
        canvas.height = viewport.height * dpr;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        // Sync ink canvases dimensions
        for (const inkRef of [
          inkCanvasRefs.current.get(pageNum),
          activeInkCanvasRefs.current.get(pageNum),
        ]) {
          if (inkRef) {
            inkRef.width = viewport.width * dpr;
            inkRef.height = viewport.height * dpr;
            inkRef.style.width = `${viewport.width}px`;
            inkRef.style.height = `${viewport.height}px`;
          }
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        await pdfPage.render({ canvasContext: ctx, viewport }).promise;
      }

      if (!cancelled) redrawAllInkLayers();
    };

    renderAll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfSrc, pageCount, scale]);

  // ─── Redraw committed ink layer whenever strokes change ─────────────────────

  const redrawAllInkLayers = useCallback(() => {
    for (const [pageNum, canvas] of inkCanvasRefs.current) {
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      // Single clear — avoids erasing the highlight layer with a second clearRect
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const strokes = strokesByPage.get(pageNum) ?? [];
      const dprLocal = window.devicePixelRatio || 1;
      const hlStrokes = strokes.filter((s) => s.tool === "marker");
      const penStrokes = strokes.filter((s) => s.tool !== "marker");
      // 1. Draw highlighter behind (semi-transparent)
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.globalCompositeOperation = "multiply";
      for (const s of hlStrokes) {
        renderStrokeToCanvas(
          ctx,
          toRenderStroke(s, scale * dprLocal, scale * dprLocal),
        );
      }
      ctx.restore();
      // 2. Draw pen strokes on top (full opacity)
      for (const s of penStrokes) {
        renderStrokeToCanvas(
          ctx,
          toRenderStroke(s, scale * dprLocal, scale * dprLocal),
        );
      }
    }
  }, [strokesByPage, scale]);

  useEffect(() => {
    redrawAllInkLayers();
  }, [redrawAllInkLayers]);

  // ─── Autosave ────────────────────────────────────────────────────────────────

  const scheduleAutosave = useCallback(
    (strokes: Map<number, AnchoredStroke[]>) => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = setTimeout(async () => {
        const allStrokes: AnchoredStroke[] = [];
        for (const arr of strokes.values()) allStrokes.push(...arr);
        const annotations: PageAnnotations = {
          strokes: allStrokes,
          highlights: page.annotations.highlights,
          svg_cache: null,
        };
        try {
          await updatePageAnnotations(page.id, annotations);
        } catch (err) {
          console.error("[PdfCanvasPage] autosave error:", err);
        }
      }, AUTOSAVE_DELAY_MS);
    },
    [page.id, page.annotations.highlights],
  );

  // ─── Pointer / drawing handlers ──────────────────────────────────────────────

  const getCanvasCoords = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>): InkPoint => {
      const rect = e.currentTarget.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale,
        pressure: e.pressure > 0 ? e.pressure : 0.5,
      };
    },
    [scale],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>, _pageNum: number) => {
      if (tool === "scroll") return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      isDrawingRef.current = true;
      activePointsRef.current = [getCanvasCoords(e)];
    },
    [tool, getCanvasCoords],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>, pageNum: number) => {
      if (!isDrawingRef.current || tool === "scroll") return;
      e.preventDefault();

      activePointsRef.current.push(getCanvasCoords(e));

      const activeCanvas = activeInkCanvasRefs.current.get(pageNum);
      if (!activeCanvas) return;
      const ctx = activeCanvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);

      if (tool === "pen") {
        const tempStroke: Stroke = {
          id: "active",
          points: activePointsRef.current.map((p) => ({
            x: p.x * scale * dpr,
            y: p.y * scale * dpr,
            pressure: p.pressure,
          })),
          color,
          size: strokeSize,
          tool: "pen",
          opacity: 1,
          timestamp: 0,
        };
        renderStrokesToCanvas(
          ctx,
          [tempStroke],
          activeCanvas.width,
          activeCanvas.height,
        );
      } else if (tool === "highlighter") {
        const pts = activePointsRef.current;
        if (pts.length >= 2) {
          ctx.save();
          ctx.globalAlpha = 0.35;
          ctx.globalCompositeOperation = "multiply";
          ctx.strokeStyle = color;
          ctx.lineWidth = strokeSize * scale * dpr;
          ctx.lineCap = "square";
          ctx.lineJoin = "miter";
          ctx.beginPath();
          ctx.moveTo(pts[0]!.x * scale * dpr, pts[0]!.y * scale * dpr);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i]!.x * scale * dpr, pts[i]!.y * scale * dpr);
          }
          ctx.stroke();
          ctx.restore();
        }
      } else if (tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        const pts = activePointsRef.current;
        const last = pts[pts.length - 1];
        if (last) {
          ctx.arc(
            last.x * scale * dpr,
            last.y * scale * dpr,
            12 * dpr,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
      }
    },
    [tool, getCanvasCoords, scale, color, strokeSize],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>, pageNum: number) => {
      if (!isDrawingRef.current || tool === "scroll") return;
      e.preventDefault();
      isDrawingRef.current = false;

      const activeCanvas = activeInkCanvasRefs.current.get(pageNum);
      if (activeCanvas) {
        const ctx = activeCanvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);
      }

      const points = activePointsRef.current;
      activePointsRef.current = [];

      if (points.length < 2) return;

      setUndoStack((prev) => [...prev.slice(-49), new Map(strokesByPage)]);
      setRedoStack([]);

      setStrokesByPage((prev) => {
        const next = new Map(prev);

        if (tool === "pen" || tool === "highlighter") {
          const stroke: AnchoredStroke = {
            id: crypto.randomUUID(),
            points: points.map((p) => ({
              x: p.x,
              y: p.y,
              pressure: p.pressure,
            })) as StrokePoint[],
            color,
            size: strokeSize,
            tool: tool === "highlighter" ? "marker" : "pen",
            opacity: tool === "highlighter" ? 0.35 : 1,
            timestamp: Date.now() as unknown as bigint,
            anchor: {
              block_id: NULL_UUID,
              offset_x: 0,
              offset_y: 0,
              pdf_page: pageNum,
            },
          };
          const arr = [...(next.get(pageNum) ?? []), stroke];
          next.set(pageNum, arr);
        } else if (tool === "eraser") {
          const erDpr = window.devicePixelRatio || 1;
          const eraseRadius = 12;
          const existing = next.get(pageNum) ?? [];
          const filtered = existing.filter((stroke) => {
            return !points.some((ep) =>
              stroke.points.some(
                (sp) =>
                  Math.hypot(
                    sp.x * scale * erDpr - ep.x * scale * erDpr,
                    sp.y * scale * erDpr - ep.y * scale * erDpr,
                  ) <
                  eraseRadius * erDpr,
              ),
            );
          });
          next.set(pageNum, filtered);
        }

        scheduleAutosave(next);
        return next;
      });
    },
    [tool, strokesByPage, scale, color, strokeSize, scheduleAutosave],
  );

  // ─── Undo / Redo ─────────────────────────────────────────────────────────────

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    if (!prev) return;
    setRedoStack((r) => [...r, new Map(strokesByPage)]);
    setUndoStack((u) => u.slice(0, -1));
    setStrokesByPage(prev);
    scheduleAutosave(prev);
  }, [undoStack, strokesByPage, scheduleAutosave]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    setUndoStack((u) => [...u, new Map(strokesByPage)]);
    setRedoStack((r) => r.slice(0, -1));
    setStrokesByPage(next);
    scheduleAutosave(next);
  }, [redoStack, strokesByPage, scheduleAutosave]);

  // ─── Navigation helpers ──────────────────────────────────────────────────────

  const scrollToPage = useCallback((pageNum: number) => {
    const el = document.getElementById(`pdf-page-${pageNum}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    setCurrentPage(pageNum);
  }, []);

  const pagesArray = useMemo(
    () => Array.from({ length: pageCount }, (_, i) => i + 1),
    [pageCount],
  );

  // ─── Intersection observer: track current page in scroll ─────────────────────

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let visiblePage = currentPage;
        for (const entry of entries) {
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            const pageNum = Number((entry.target as HTMLElement).dataset.page);
            if (!isNaN(pageNum)) visiblePage = pageNum;
          }
        }
        setCurrentPage(visiblePage);
      },
      { threshold: [0.1, 0.5, 0.9] },
    );

    pagesArray.forEach((p) => {
      const el = document.getElementById(`pdf-page-${p}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [pagesArray, currentPage]);

  // ─── Cleanup autosave on unmount ─────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2
          size={28}
          className="animate-spin"
          style={{ color: "var(--text-tertiary)" }}
        />
      </div>
    );
  }

  if (error || !pdfSrc) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm" style={{ color: "var(--danger)" }}>
          {error ?? t("pdf_canvas.load_error")}
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-1 flex-col overflow-hidden"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <PdfCanvasToolbar
        currentPage={currentPage}
        totalPages={pageCount}
        scale={scale}
        tool={tool}
        color={color}
        strokeSize={strokeSize}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onPrevPage={() => scrollToPage(Math.max(1, currentPage - 1))}
        onNextPage={() => scrollToPage(Math.min(pageCount, currentPage + 1))}
        onZoomIn={() => setScale((s) => Math.min(s + SCALE_STEP, MAX_SCALE))}
        onZoomOut={() => setScale((s) => Math.max(s - SCALE_STEP, MIN_SCALE))}
        onToolChange={handleToolChange}
        onColorChange={setColor}
        onSizeChange={setStrokeSize}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      {/* Scrollable pages area */}
      <div
        className="flex flex-1 flex-col items-center gap-4 overflow-y-auto py-6"
        style={{
          backgroundColor: "var(--bg-tertiary)",
          cursor: tool === "scroll" ? "default" : "crosshair",
        }}
      >
        {pagesArray.map((pageNum) => (
          <div
            key={pageNum}
            id={`pdf-page-${pageNum}`}
            data-page={pageNum}
            className="relative shadow-md"
            style={{ lineHeight: 0 }}
          >
            {/* PDF render canvas */}
            <canvas
              ref={(el) => {
                if (el) pdfCanvasRefs.current.set(pageNum, el);
                else pdfCanvasRefs.current.delete(pageNum);
              }}
              style={{ display: "block" }}
            />

            {/* Committed ink layer */}
            <canvas
              ref={(el) => {
                if (el) inkCanvasRefs.current.set(pageNum, el);
                else inkCanvasRefs.current.delete(pageNum);
              }}
              className="absolute inset-0"
              style={{ pointerEvents: "none" }}
            />

            {/* Active drawing layer (pointer events gated by tool) */}
            <canvas
              ref={(el) => {
                if (el) activeInkCanvasRefs.current.set(pageNum, el);
                else activeInkCanvasRefs.current.delete(pageNum);
              }}
              className="absolute inset-0"
              style={{
                pointerEvents: tool !== "scroll" ? "auto" : "none",
                touchAction: "none",
              }}
              onPointerDown={(e) => handlePointerDown(e, pageNum)}
              onPointerMove={(e) => handlePointerMove(e, pageNum)}
              onPointerUp={(e) => handlePointerUp(e, pageNum)}
              onPointerCancel={(e) => handlePointerUp(e, pageNum)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
