import { describe, it, expect } from "vitest";
import {
  getStrokeOutline,
  getSvgPathFromStroke,
  strokesToSvg,
  simplifyPoints,
  hitTestStroke,
  createStrokeId,
} from "@/lib/ink/engine";
import type { Stroke, StrokePoint } from "@/lib/ink/types";

const samplePoints: StrokePoint[] = [
  { x: 10, y: 10, pressure: 0.5 },
  { x: 20, y: 15, pressure: 0.6 },
  { x: 30, y: 20, pressure: 0.7 },
  { x: 40, y: 25, pressure: 0.6 },
  { x: 50, y: 30, pressure: 0.5 },
];

const sampleStroke: Stroke = {
  id: "test-stroke-1",
  points: samplePoints,
  color: "#1a1a1a",
  size: 3,
  tool: "pen",
  opacity: 1.0,
  timestamp: 1709820000000,
};

describe("getStrokeOutline", () => {
  it("returns outline points from stroke points", () => {
    const outline = getStrokeOutline(samplePoints, { size: 3 });
    expect(outline.length).toBeGreaterThan(0);
    for (const point of outline) {
      expect(point).toHaveLength(2);
      expect(typeof point[0]).toBe("number");
      expect(typeof point[1]).toBe("number");
    }
  });

  it("returns empty for empty points", () => {
    const outline = getStrokeOutline([], { size: 3 });
    expect(outline).toHaveLength(0);
  });

  it("handles single point", () => {
    const outline = getStrokeOutline([{ x: 10, y: 10, pressure: 0.5 }], {
      size: 5,
    });
    expect(outline.length).toBeGreaterThan(0);
  });
});

describe("getSvgPathFromStroke", () => {
  it("generates valid SVG path data from outline", () => {
    const outline = getStrokeOutline(samplePoints, { size: 3 });
    const path = getSvgPathFromStroke(outline);
    expect(path).toMatch(/^M /);
    expect(path).toContain("Z");
  });

  it("returns empty string for empty outline", () => {
    expect(getSvgPathFromStroke([])).toBe("");
  });

  it("handles single-point outline", () => {
    const path = getSvgPathFromStroke([[10, 20]]);
    expect(path).toContain("M 10 20");
  });
});

describe("strokesToSvg", () => {
  it("generates valid SVG with xmlns", () => {
    const svg = strokesToSvg([sampleStroke], 800, 400);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="800"');
    expect(svg).toContain('height="400"');
    expect(svg).toContain("<path");
    expect(svg).toContain('fill="#1a1a1a"');
  });

  it("generates SVG with multiple strokes", () => {
    const stroke2: Stroke = {
      ...sampleStroke,
      id: "test-stroke-2",
      color: "#ef4444",
    };
    const svg = strokesToSvg([sampleStroke, stroke2], 800, 400);
    expect(svg).toContain('fill="#1a1a1a"');
    expect(svg).toContain('fill="#ef4444"');
  });

  it("generates empty SVG for no strokes", () => {
    const svg = strokesToSvg([], 800, 400);
    expect(svg).toContain("<svg");
    expect(svg).not.toContain("<path");
  });
});

describe("simplifyPoints", () => {
  it("returns same points if 2 or fewer", () => {
    const two: StrokePoint[] = [
      { x: 0, y: 0, pressure: 0.5 },
      { x: 10, y: 10, pressure: 0.5 },
    ];
    expect(simplifyPoints(two)).toEqual(two);
    expect(simplifyPoints([two[0]!])).toEqual([two[0]!]);
  });

  it("reduces collinear points", () => {
    const collinear: StrokePoint[] = [
      { x: 0, y: 0, pressure: 0.5 },
      { x: 5, y: 5, pressure: 0.5 },
      { x: 10, y: 10, pressure: 0.5 },
      { x: 15, y: 15, pressure: 0.5 },
      { x: 20, y: 20, pressure: 0.5 },
    ];
    const simplified = simplifyPoints(collinear, 0.5);
    expect(simplified.length).toBeLessThan(collinear.length);
    expect(simplified[0]).toEqual(collinear[0]);
    expect(simplified[simplified.length - 1]).toEqual(
      collinear[collinear.length - 1],
    );
  });

  it("preserves corner points", () => {
    const withCorner: StrokePoint[] = [
      { x: 0, y: 0, pressure: 0.5 },
      { x: 50, y: 0, pressure: 0.5 },
      { x: 50, y: 50, pressure: 0.5 },
    ];
    const simplified = simplifyPoints(withCorner, 1.0);
    expect(simplified).toHaveLength(3);
  });
});

describe("hitTestStroke", () => {
  it("detects hit within threshold", () => {
    expect(hitTestStroke(sampleStroke, 10, 10, 5)).toBe(true);
    expect(hitTestStroke(sampleStroke, 30, 20, 5)).toBe(true);
  });

  it("misses outside threshold", () => {
    expect(hitTestStroke(sampleStroke, 100, 100, 5)).toBe(false);
  });

  it("uses default threshold of 10", () => {
    expect(hitTestStroke(sampleStroke, 15, 15)).toBe(true);
  });
});

describe("createStrokeId", () => {
  it("generates unique UUID strings", () => {
    const id1 = createStrokeId();
    const id2 = createStrokeId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
