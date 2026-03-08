import { useState, useCallback } from "react";
import { FileText } from "lucide-react";
import { PdfViewer } from "@/components/pdf/PdfViewer";

type DisplayMode = "single" | "continuous";

interface PdfBlockComponentProps {
  src: string | null;
  totalPages: number;
  displayMode: DisplayMode;
  currentPage: number;
  scale: number;
  onUpdate: (data: {
    displayMode?: DisplayMode;
    currentPage?: number;
    scale?: number;
  }) => void;
}

export function PdfBlockComponent({
  src,
  totalPages,
  displayMode: initialDisplayMode,
  currentPage: initialCurrentPage,
  scale: initialScale,
  onUpdate,
}: PdfBlockComponentProps) {
  const [displayMode, setDisplayMode] =
    useState<DisplayMode>(initialDisplayMode);
  const [currentPage, setCurrentPage] = useState(initialCurrentPage);
  const [scale, setScale] = useState(initialScale);

  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      onUpdate({ currentPage: page });
    },
    [onUpdate],
  );

  const handleDisplayModeChange = useCallback(
    (mode: DisplayMode) => {
      setDisplayMode(mode);
      onUpdate({ displayMode: mode });
    },
    [onUpdate],
  );

  const handleScaleChange = useCallback(
    (newScale: number) => {
      setScale(newScale);
      onUpdate({ scale: newScale });
    },
    [onUpdate],
  );

  if (!src) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border py-12"
        style={{
          borderColor: "var(--border)",
          color: "var(--text-tertiary)",
        }}
      >
        <FileText size={20} className="mr-2" />
        <span className="text-sm">Nenhum PDF carregado</span>
      </div>
    );
  }

  return (
    <div
      className="pdf-block-container my-2 overflow-hidden rounded-lg border"
      style={{ borderColor: "var(--border)" }}
    >
      <PdfViewer
        src={src}
        totalPages={totalPages}
        displayMode={displayMode}
        currentPage={currentPage}
        scale={scale}
        onPageChange={handlePageChange}
        onDisplayModeChange={handleDisplayModeChange}
        onScaleChange={handleScaleChange}
      />
    </div>
  );
}
