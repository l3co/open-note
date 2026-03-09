import { describe, it, expect, beforeEach } from "vitest";
import { useAnnotationStore } from "@/stores/useAnnotationStore";
import type { AnchoredStroke, HighlightAnnotation } from "@/lib/ink/types";

function makeStroke(id: string): AnchoredStroke {
  return {
    id,
    points: [
      { x: 10, y: 10, pressure: 0.5 },
      { x: 20, y: 20, pressure: 0.6 },
    ],
    color: "#1a1a1a",
    size: 3,
    tool: "pen",
    opacity: 1.0,
    timestamp: Date.now(),
    anchor: null,
  };
}

function makeHighlight(id: string): HighlightAnnotation {
  return {
    id,
    blockId: "block-1",
    startOffset: 0,
    endOffset: 10,
    color: "#eab308",
    opacity: 0.3,
  };
}

describe("useAnnotationStore", () => {
  beforeEach(() => {
    useAnnotationStore.setState({
      isAnnotationMode: false,
      activeTool: "pen",
      activeColor: "#1a1a1a",
      activeSize: 3,
      annotations: { strokes: [], highlights: [], svgCache: null },
      undoStack: [],
      redoStack: [],
    });
  });

  it("toggles annotation mode", () => {
    const { toggleAnnotationMode } = useAnnotationStore.getState();
    expect(useAnnotationStore.getState().isAnnotationMode).toBe(false);
    toggleAnnotationMode();
    expect(useAnnotationStore.getState().isAnnotationMode).toBe(true);
    toggleAnnotationMode();
    expect(useAnnotationStore.getState().isAnnotationMode).toBe(false);
  });

  it("sets tool with default size", () => {
    const { setTool } = useAnnotationStore.getState();
    setTool("marker");
    expect(useAnnotationStore.getState().activeTool).toBe("marker");
    expect(useAnnotationStore.getState().activeSize).toBe(15);

    setTool("pen");
    expect(useAnnotationStore.getState().activeSize).toBe(3);

    setTool("eraser");
    expect(useAnnotationStore.getState().activeSize).toBe(20);
  });

  it("adds and removes strokes", () => {
    const { addStroke, removeStroke } = useAnnotationStore.getState();
    const stroke = makeStroke("s1");

    addStroke(stroke);
    expect(useAnnotationStore.getState().annotations.strokes).toHaveLength(1);
    expect(useAnnotationStore.getState().undoStack).toHaveLength(1);

    removeStroke("s1");
    expect(useAnnotationStore.getState().annotations.strokes).toHaveLength(0);
    expect(useAnnotationStore.getState().undoStack).toHaveLength(2);
  });

  it("adds and removes highlights", () => {
    const { addHighlight, removeHighlight } = useAnnotationStore.getState();
    const hl = makeHighlight("h1");

    addHighlight(hl);
    expect(useAnnotationStore.getState().annotations.highlights).toHaveLength(
      1,
    );

    removeHighlight("h1");
    expect(useAnnotationStore.getState().annotations.highlights).toHaveLength(
      0,
    );
  });

  it("clears all annotations", () => {
    const { addStroke, addHighlight, clearAll } = useAnnotationStore.getState();
    addStroke(makeStroke("s1"));
    addHighlight(makeHighlight("h1"));

    clearAll();
    expect(useAnnotationStore.getState().annotations.strokes).toHaveLength(0);
    expect(useAnnotationStore.getState().annotations.highlights).toHaveLength(
      0,
    );
  });

  it("undo reverses add_stroke", () => {
    const { addStroke, undo } = useAnnotationStore.getState();
    addStroke(makeStroke("s1"));
    expect(useAnnotationStore.getState().annotations.strokes).toHaveLength(1);

    undo();
    expect(useAnnotationStore.getState().annotations.strokes).toHaveLength(0);
    expect(useAnnotationStore.getState().redoStack).toHaveLength(1);
  });

  it("redo restores undone add_stroke", () => {
    const { addStroke, undo, redo } = useAnnotationStore.getState();
    addStroke(makeStroke("s1"));
    undo();
    expect(useAnnotationStore.getState().annotations.strokes).toHaveLength(0);

    redo();
    expect(useAnnotationStore.getState().annotations.strokes).toHaveLength(1);
  });

  it("undo reverses remove_stroke", () => {
    const { addStroke, removeStroke, undo } = useAnnotationStore.getState();
    addStroke(makeStroke("s1"));
    removeStroke("s1");
    expect(useAnnotationStore.getState().annotations.strokes).toHaveLength(0);

    undo();
    expect(useAnnotationStore.getState().annotations.strokes).toHaveLength(1);
  });

  it("undo reverses clear_all", () => {
    const { addStroke, addHighlight, clearAll, undo } =
      useAnnotationStore.getState();
    addStroke(makeStroke("s1"));
    addHighlight(makeHighlight("h1"));
    clearAll();

    undo();
    expect(useAnnotationStore.getState().annotations.strokes).toHaveLength(1);
    expect(useAnnotationStore.getState().annotations.highlights).toHaveLength(
      1,
    );
  });

  it("adding new action clears redo stack", () => {
    const { addStroke, undo } = useAnnotationStore.getState();
    addStroke(makeStroke("s1"));
    undo();
    expect(useAnnotationStore.getState().redoStack).toHaveLength(1);

    addStroke(makeStroke("s2"));
    expect(useAnnotationStore.getState().redoStack).toHaveLength(0);
  });

  it("undo does nothing when stack is empty", () => {
    const { undo } = useAnnotationStore.getState();
    undo();
    expect(useAnnotationStore.getState().annotations.strokes).toHaveLength(0);
  });

  it("redo does nothing when stack is empty", () => {
    const { redo } = useAnnotationStore.getState();
    redo();
    expect(useAnnotationStore.getState().annotations.strokes).toHaveLength(0);
  });

  it("setAnnotations resets undo/redo stacks", () => {
    const { addStroke, setAnnotations } = useAnnotationStore.getState();
    addStroke(makeStroke("s1"));
    expect(useAnnotationStore.getState().undoStack).toHaveLength(1);

    setAnnotations({ strokes: [], highlights: [], svgCache: null });
    expect(useAnnotationStore.getState().undoStack).toHaveLength(0);
    expect(useAnnotationStore.getState().redoStack).toHaveLength(0);
  });

  it("undo reverses add_highlight", () => {
    const { addHighlight, undo } = useAnnotationStore.getState();
    addHighlight(makeHighlight("h1"));
    expect(useAnnotationStore.getState().annotations.highlights).toHaveLength(
      1,
    );
    undo();
    expect(useAnnotationStore.getState().annotations.highlights).toHaveLength(
      0,
    );
    expect(useAnnotationStore.getState().redoStack).toHaveLength(1);
  });

  it("redo restores undone add_highlight", () => {
    const { addHighlight, undo, redo } = useAnnotationStore.getState();
    addHighlight(makeHighlight("h1"));
    undo();
    redo();
    expect(useAnnotationStore.getState().annotations.highlights).toHaveLength(
      1,
    );
  });

  it("undo reverses remove_highlight", () => {
    const { addHighlight, removeHighlight, undo } =
      useAnnotationStore.getState();
    addHighlight(makeHighlight("h1"));
    removeHighlight("h1");
    expect(useAnnotationStore.getState().annotations.highlights).toHaveLength(
      0,
    );
    undo();
    expect(useAnnotationStore.getState().annotations.highlights).toHaveLength(
      1,
    );
  });

  it("redo restores undone remove_stroke", () => {
    const { addStroke, removeStroke, undo, redo } =
      useAnnotationStore.getState();
    addStroke(makeStroke("s1"));
    removeStroke("s1");
    undo();
    expect(useAnnotationStore.getState().annotations.strokes).toHaveLength(1);
    redo();
    expect(useAnnotationStore.getState().annotations.strokes).toHaveLength(0);
  });

  it("redo restores undone remove_highlight", () => {
    const { addHighlight, removeHighlight, undo, redo } =
      useAnnotationStore.getState();
    addHighlight(makeHighlight("h1"));
    removeHighlight("h1");
    undo();
    redo();
    expect(useAnnotationStore.getState().annotations.highlights).toHaveLength(
      0,
    );
  });

  it("redo restores undone clear_all", () => {
    const { addStroke, addHighlight, clearAll, undo, redo } =
      useAnnotationStore.getState();
    addStroke(makeStroke("s1"));
    addHighlight(makeHighlight("h1"));
    clearAll();
    undo();
    redo();
    expect(useAnnotationStore.getState().annotations.strokes).toHaveLength(0);
    expect(useAnnotationStore.getState().annotations.highlights).toHaveLength(
      0,
    );
  });

  it("removeStroke does nothing for unknown id", () => {
    const { removeStroke } = useAnnotationStore.getState();
    removeStroke("nonexistent");
    expect(useAnnotationStore.getState().undoStack).toHaveLength(0);
  });

  it("removeHighlight does nothing for unknown id", () => {
    const { removeHighlight } = useAnnotationStore.getState();
    removeHighlight("nonexistent");
    expect(useAnnotationStore.getState().undoStack).toHaveLength(0);
  });

  it("clearAll does nothing when already empty", () => {
    const { clearAll } = useAnnotationStore.getState();
    clearAll();
    expect(useAnnotationStore.getState().undoStack).toHaveLength(0);
  });

  it("setAnnotationMode sets explicit value", () => {
    const { setAnnotationMode } = useAnnotationStore.getState();
    setAnnotationMode(true);
    expect(useAnnotationStore.getState().isAnnotationMode).toBe(true);
    setAnnotationMode(false);
    expect(useAnnotationStore.getState().isAnnotationMode).toBe(false);
  });

  it("setColor updates active color", () => {
    const { setColor } = useAnnotationStore.getState();
    setColor("#ff0000");
    expect(useAnnotationStore.getState().activeColor).toBe("#ff0000");
  });

  it("setSize updates active size", () => {
    const { setSize } = useAnnotationStore.getState();
    setSize(10);
    expect(useAnnotationStore.getState().activeSize).toBe(10);
  });

  it("nullifies svgCache on stroke changes", () => {
    const { addStroke, setAnnotations } = useAnnotationStore.getState();
    setAnnotations({
      strokes: [],
      highlights: [],
      svgCache: "<svg>cached</svg>",
    });
    expect(useAnnotationStore.getState().annotations.svgCache).toBe(
      "<svg>cached</svg>",
    );

    addStroke(makeStroke("s1"));
    expect(useAnnotationStore.getState().annotations.svgCache).toBeNull();
  });
});
