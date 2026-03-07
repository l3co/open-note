export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export type InkTool = "pen" | "marker" | "eraser";

export interface Stroke {
  id: string;
  points: StrokePoint[];
  color: string;
  size: number;
  tool: InkTool;
  opacity: number;
  timestamp: number;
}

export interface AnchoredStroke extends Stroke {
  anchor: {
    blockId: string;
    offsetX: number;
    offsetY: number;
  } | null;
}

export interface HighlightAnnotation {
  id: string;
  blockId: string;
  startOffset: number;
  endOffset: number;
  color: string;
  opacity: number;
}

export interface PageAnnotations {
  strokes: AnchoredStroke[];
  highlights: HighlightAnnotation[];
  svgCache: string | null;
}

export type InkAction =
  | { type: "add_stroke"; stroke: AnchoredStroke }
  | { type: "remove_stroke"; strokeId: string; stroke: AnchoredStroke }
  | { type: "add_highlight"; highlight: HighlightAnnotation }
  | { type: "remove_highlight"; highlightId: string; highlight: HighlightAnnotation }
  | { type: "clear_all"; strokes: AnchoredStroke[]; highlights: HighlightAnnotation[] };

export interface InkHistory {
  undoStack: InkAction[];
  redoStack: InkAction[];
}

export const DEFAULT_COLORS = [
  "#1a1a1a",
  "#6b7280",
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#8b5cf6",
  "#f97316",
] as const;

export const PEN_SIZES = [1, 2, 3, 5, 8] as const;
export const MARKER_SIZES = [10, 15, 20, 30] as const;
