import { create } from "zustand";
import type {
  InkTool,
  AnchoredStroke,
  HighlightAnnotation,
  PageAnnotations,
  InkAction,
} from "@/lib/ink/types";

interface AnnotationStore {
  isAnnotationMode: boolean;
  activeTool: InkTool;
  activeColor: string;
  activeSize: number;
  annotations: PageAnnotations;
  undoStack: InkAction[];
  redoStack: InkAction[];

  toggleAnnotationMode: () => void;
  setAnnotationMode: (active: boolean) => void;
  setTool: (tool: InkTool) => void;
  setColor: (color: string) => void;
  setSize: (size: number) => void;
  setAnnotations: (annotations: PageAnnotations) => void;
  addStroke: (stroke: AnchoredStroke) => void;
  removeStroke: (id: string) => void;
  addHighlight: (highlight: HighlightAnnotation) => void;
  removeHighlight: (id: string) => void;
  clearAll: () => void;
  undo: () => void;
  redo: () => void;
}

const emptyAnnotations: PageAnnotations = {
  strokes: [],
  highlights: [],
  svgCache: null,
};

export const useAnnotationStore = create<AnnotationStore>((set, get) => ({
  isAnnotationMode: false,
  activeTool: "pen",
  activeColor: "#1a1a1a",
  activeSize: 3,
  annotations: { ...emptyAnnotations },
  undoStack: [],
  redoStack: [],

  toggleAnnotationMode: () =>
    set((s) => ({ isAnnotationMode: !s.isAnnotationMode })),

  setAnnotationMode: (active) => set({ isAnnotationMode: active }),

  setTool: (tool) => {
    const defaults: Record<InkTool, number> = {
      pen: 3,
      marker: 15,
      eraser: 20,
    };
    set({ activeTool: tool, activeSize: defaults[tool] });
  },

  setColor: (color) => set({ activeColor: color }),
  setSize: (size) => set({ activeSize: size }),

  setAnnotations: (annotations) =>
    set({ annotations, undoStack: [], redoStack: [] }),

  addStroke: (stroke) => {
    const { annotations, undoStack } = get();
    const action: InkAction = { type: "add_stroke", stroke };
    set({
      annotations: {
        ...annotations,
        strokes: [...annotations.strokes, stroke],
        svgCache: null,
      },
      undoStack: [...undoStack, action],
      redoStack: [],
    });
  },

  removeStroke: (id) => {
    const { annotations, undoStack } = get();
    const stroke = annotations.strokes.find((s) => s.id === id);
    if (!stroke) return;
    const action: InkAction = { type: "remove_stroke", strokeId: id, stroke };
    set({
      annotations: {
        ...annotations,
        strokes: annotations.strokes.filter((s) => s.id !== id),
        svgCache: null,
      },
      undoStack: [...undoStack, action],
      redoStack: [],
    });
  },

  addHighlight: (highlight) => {
    const { annotations, undoStack } = get();
    const action: InkAction = { type: "add_highlight", highlight };
    set({
      annotations: {
        ...annotations,
        highlights: [...annotations.highlights, highlight],
      },
      undoStack: [...undoStack, action],
      redoStack: [],
    });
  },

  removeHighlight: (id) => {
    const { annotations, undoStack } = get();
    const highlight = annotations.highlights.find((h) => h.id === id);
    if (!highlight) return;
    const action: InkAction = {
      type: "remove_highlight",
      highlightId: id,
      highlight,
    };
    set({
      annotations: {
        ...annotations,
        highlights: annotations.highlights.filter((h) => h.id !== id),
      },
      undoStack: [...undoStack, action],
      redoStack: [],
    });
  },

  clearAll: () => {
    const { annotations, undoStack } = get();
    if (annotations.strokes.length === 0 && annotations.highlights.length === 0)
      return;
    const action: InkAction = {
      type: "clear_all",
      strokes: annotations.strokes,
      highlights: annotations.highlights,
    };
    set({
      annotations: { strokes: [], highlights: [], svgCache: null },
      undoStack: [...undoStack, action],
      redoStack: [],
    });
  },

  undo: () => {
    const { undoStack, redoStack, annotations } = get();
    if (undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1]!;
    const newUndo = undoStack.slice(0, -1);

    switch (action.type) {
      case "add_stroke":
        set({
          annotations: {
            ...annotations,
            strokes: annotations.strokes.filter(
              (s) => s.id !== action.stroke.id,
            ),
            svgCache: null,
          },
          undoStack: newUndo,
          redoStack: [...redoStack, action],
        });
        break;
      case "remove_stroke":
        set({
          annotations: {
            ...annotations,
            strokes: [...annotations.strokes, action.stroke],
            svgCache: null,
          },
          undoStack: newUndo,
          redoStack: [...redoStack, action],
        });
        break;
      case "add_highlight":
        set({
          annotations: {
            ...annotations,
            highlights: annotations.highlights.filter(
              (h) => h.id !== action.highlight.id,
            ),
          },
          undoStack: newUndo,
          redoStack: [...redoStack, action],
        });
        break;
      case "remove_highlight":
        set({
          annotations: {
            ...annotations,
            highlights: [...annotations.highlights, action.highlight],
          },
          undoStack: newUndo,
          redoStack: [...redoStack, action],
        });
        break;
      case "clear_all":
        set({
          annotations: {
            strokes: action.strokes,
            highlights: action.highlights,
            svgCache: null,
          },
          undoStack: newUndo,
          redoStack: [...redoStack, action],
        });
        break;
    }
  },

  redo: () => {
    const { undoStack, redoStack, annotations } = get();
    if (redoStack.length === 0) return;
    const action = redoStack[redoStack.length - 1]!;
    const newRedo = redoStack.slice(0, -1);

    switch (action.type) {
      case "add_stroke":
        set({
          annotations: {
            ...annotations,
            strokes: [...annotations.strokes, action.stroke],
            svgCache: null,
          },
          undoStack: [...undoStack, action],
          redoStack: newRedo,
        });
        break;
      case "remove_stroke":
        set({
          annotations: {
            ...annotations,
            strokes: annotations.strokes.filter(
              (s) => s.id !== action.strokeId,
            ),
            svgCache: null,
          },
          undoStack: [...undoStack, action],
          redoStack: newRedo,
        });
        break;
      case "add_highlight":
        set({
          annotations: {
            ...annotations,
            highlights: [...annotations.highlights, action.highlight],
          },
          undoStack: [...undoStack, action],
          redoStack: newRedo,
        });
        break;
      case "remove_highlight":
        set({
          annotations: {
            ...annotations,
            highlights: annotations.highlights.filter(
              (h) => h.id !== action.highlightId,
            ),
          },
          undoStack: [...undoStack, action],
          redoStack: newRedo,
        });
        break;
      case "clear_all":
        set({
          annotations: { strokes: [], highlights: [], svgCache: null },
          undoStack: [...undoStack, action],
          redoStack: newRedo,
        });
        break;
    }
  },
}));
