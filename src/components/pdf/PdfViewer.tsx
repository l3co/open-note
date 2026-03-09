import { useRef, useEffect, useState, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Rows3,
  Square,
} from "lucide-react";

type DisplayMode = "single" | "continuous";

interface PdfViewerProps {
  src: string;
  totalPages: number;
  displayMode: DisplayMode;
  currentPage: number;
  scale: number;
  onPageChange: (page: number) => void;
  onDisplayModeChange: (mode: DisplayMode) => void;
  onScaleChange: (scale: number) => void;
}

export function PdfViewer({
  src,
  totalPages: initialTotalPages,
  displayMode,
  currentPage,
  scale,
  onPageChange,
  onDisplayModeChange,
  onScaleChange,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(initialTotalPages);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);
  const pdfBytesRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    if (!src) return;
    let cancelled = false;

    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);

        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        if (!pdfBytesRef.current) {
          if (src.startsWith("data:")) {
            const response = await fetch(src);
            const arrayBuffer = await response.arrayBuffer();
            pdfBytesRef.current = new Uint8Array(arrayBuffer);
          }
        }

        const pdfSource = pdfBytesRef.current
          ? { data: pdfBytesRef.current.slice() }
          : src;

        const pdf = await pdfjsLib.getDocument(pdfSource).promise;
        if (cancelled) return;

        pdfDocRef.current = pdf;
        if (pdf.numPages > 0) {
          setPageCount((previous) =>
            previous === pdf.numPages ? previous : pdf.numPages,
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError("Erro ao carregar PDF");
          console.error("PDF load error:", err);
          setLoading(false);
        }
      }
    };

    pdfBytesRef.current = null;
    pdfDocRef.current = null;
    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    const pdf = pdfDocRef.current;
    if (!pdf || !src) return;
    let cancelled = false;

    const renderPages = async () => {
      setLoading(true);
      setError(null);
      try {
        const pages =
          displayMode === "single"
            ? [currentPage]
            : Array.from({ length: pageCount }, (_, i) => i + 1);

        for (const pageNum of pages) {
          if (cancelled) return;
          const canvas = canvasRefs.current.get(pageNum);
          if (!canvas) continue;

          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale });

          const dpr = window.devicePixelRatio || 1;
          canvas.width = viewport.width * dpr;
          canvas.height = viewport.height * dpr;
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;

          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        }
      } catch (err) {
        if (!cancelled) {
          setError("Erro ao renderizar PDF");
          console.error("PDF render error:", err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    renderPages();

    return () => {
      cancelled = true;
    };
  }, [src, displayMode, currentPage, pageCount, scale]);

  const handlePrev = useCallback(() => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  }, [currentPage, onPageChange]);

  const handleNext = useCallback(() => {
    if (currentPage < pageCount) onPageChange(currentPage + 1);
  }, [currentPage, pageCount, onPageChange]);

  const handleZoomIn = useCallback(() => {
    onScaleChange(Math.min(scale + 0.25, 3.0));
  }, [scale, onScaleChange]);

  const handleZoomOut = useCallback(() => {
    onScaleChange(Math.max(scale - 0.25, 0.5));
  }, [scale, onScaleChange]);

  const setCanvasRef = useCallback(
    (pageNum: number) => (el: HTMLCanvasElement | null) => {
      if (el) {
        canvasRefs.current.set(pageNum, el);
      } else {
        canvasRefs.current.delete(pageNum);
      }
    },
    [],
  );

  const pagesToRender =
    displayMode === "single"
      ? [currentPage]
      : Array.from({ length: pageCount }, (_, i) => i + 1);

  return (
    <div className="pdf-viewer flex flex-col">
      <div
        className="flex items-center justify-between border-b px-3 py-1.5"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border)",
        }}
      >
        <div className="flex items-center gap-1">
          <NavButton
            onClick={handlePrev}
            disabled={currentPage <= 1}
            title="Página anterior"
          >
            <ChevronLeft size={16} />
          </NavButton>
          <span
            className="min-w-[80px] text-center text-xs"
            style={{ color: "var(--text-secondary)" }}
          >
            {currentPage} / {pageCount}
          </span>
          <NavButton
            onClick={handleNext}
            disabled={currentPage >= pageCount}
            title="Próxima página"
          >
            <ChevronRight size={16} />
          </NavButton>
        </div>

        <div className="flex items-center gap-1">
          <NavButton onClick={handleZoomOut} title="Diminuir zoom">
            <ZoomOut size={14} />
          </NavButton>
          <span
            className="min-w-[40px] text-center text-xs"
            style={{ color: "var(--text-secondary)" }}
          >
            {Math.round(scale * 100)}%
          </span>
          <NavButton onClick={handleZoomIn} title="Aumentar zoom">
            <ZoomIn size={14} />
          </NavButton>
        </div>

        <div className="flex items-center gap-1">
          <NavButton
            onClick={() => onDisplayModeChange("single")}
            active={displayMode === "single"}
            title="Uma página"
          >
            <Square size={14} />
          </NavButton>
          <NavButton
            onClick={() => onDisplayModeChange("continuous")}
            active={displayMode === "continuous"}
            title="Contínuo"
          >
            <Rows3 size={14} />
          </NavButton>
        </div>
      </div>

      <div
        ref={containerRef}
        className="overflow-auto"
        style={{ maxHeight: "70vh" }}
      >
        {loading && (
          <div
            className="flex items-center justify-center py-12 text-sm"
            style={{ color: "var(--text-tertiary)" }}
          >
            Carregando PDF...
          </div>
        )}
        {error && (
          <div
            className="flex items-center justify-center py-12 text-sm"
            style={{ color: "var(--danger)" }}
          >
            {error}
          </div>
        )}
        <div className="flex flex-col items-center gap-2 py-2">
          {pagesToRender.map((pageNum) => (
            <div
              key={pageNum}
              className="pdf-page-container relative"
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}
            >
              <canvas ref={setCanvasRef(pageNum)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface NavButtonProps {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}

function NavButton({
  onClick,
  disabled = false,
  active = false,
  title,
  children,
}: NavButtonProps) {
  return (
    <button
      type="button"
      className="flex h-7 w-7 items-center justify-center rounded transition-colors"
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
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}
