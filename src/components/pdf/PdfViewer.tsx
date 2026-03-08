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
  totalPages,
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
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  const renderPage = useCallback(
    async (pageNum: number, canvas: HTMLCanvasElement) => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const pdf = await pdfjsLib.getDocument(src).promise;
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });

        const dpr = window.devicePixelRatio || 1;
        canvas.width = viewport.width * dpr;
        canvas.height = viewport.height * dpr;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      } catch (err) {
        setError(`Erro ao renderizar página ${pageNum}`);
        console.error("PDF render error:", err);
      }
    },
    [src, scale],
  );

  useEffect(() => {
    if (!src) return;
    setLoading(true);
    setError(null);

    const renderPages = async () => {
      try {
        if (displayMode === "single") {
          const canvas = canvasRefs.current.get(currentPage);
          if (canvas) {
            await renderPage(currentPage, canvas);
          }
        } else {
          for (let i = 1; i <= totalPages; i++) {
            const canvas = canvasRefs.current.get(i);
            if (canvas) {
              await renderPage(i, canvas);
            }
          }
        }
      } catch (err) {
        setError("Erro ao carregar PDF");
        console.error("PDF load error:", err);
      } finally {
        setLoading(false);
      }
    };

    renderPages();
  }, [src, displayMode, currentPage, totalPages, scale, renderPage]);

  const handlePrev = useCallback(() => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  }, [currentPage, onPageChange]);

  const handleNext = useCallback(() => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  }, [currentPage, totalPages, onPageChange]);

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
      : Array.from({ length: totalPages }, (_, i) => i + 1);

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
            {currentPage} / {totalPages}
          </span>
          <NavButton
            onClick={handleNext}
            disabled={currentPage >= totalPages}
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
