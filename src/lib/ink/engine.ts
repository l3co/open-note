import getStroke from "perfect-freehand";
import type { Stroke, StrokePoint } from "./types";

export interface RenderOptions {
  size?: number;
  smoothing?: number;
  thinning?: number;
  simulatePressure?: boolean;
}

export function getStrokeOutline(
  points: StrokePoint[],
  options: RenderOptions = {},
): number[][] {
  const inputPoints = points.map((p) => [p.x, p.y, p.pressure]);
  return getStroke(inputPoints, {
    size: options.size ?? 3,
    smoothing: options.smoothing ?? 0.5,
    thinning: options.thinning ?? 0.5,
    simulatePressure: options.simulatePressure ?? false,
  });
}

export function getSvgPathFromStroke(outline: number[][]): string {
  if (outline.length === 0) return "";
  if (outline.length === 1) {
    const [x, y] = outline[0]!;
    return `M ${x} ${y} L ${x} ${y}`;
  }

  let d = `M ${outline[0]![0]} ${outline[0]![1]}`;
  for (let i = 1; i < outline.length - 1; i++) {
    const [x0, y0] = outline[i]!;
    const [x1, y1] = outline[i + 1]!;
    const mx = (x0! + x1!) / 2;
    const my = (y0! + y1!) / 2;
    d += ` Q ${x0} ${y0}, ${mx} ${my}`;
  }
  const last = outline[outline.length - 1]!;
  d += ` L ${last[0]} ${last[1]} Z`;
  return d;
}

export function renderStrokeToCanvas(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
): void {
  const outline = getStrokeOutline(stroke.points, {
    size: stroke.size,
    simulatePressure: false,
  });
  if (outline.length === 0) return;

  const path = new Path2D(getSvgPathFromStroke(outline));
  ctx.save();
  ctx.globalAlpha = stroke.opacity;
  ctx.fillStyle = stroke.color;
  ctx.fill(path);
  ctx.restore();
}

export function renderStrokesToCanvas(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height);
  for (const stroke of strokes) {
    renderStrokeToCanvas(ctx, stroke);
  }
}

export function strokesToSvg(
  strokes: Stroke[],
  width: number,
  height: number,
): string {
  const paths = strokes.map((stroke) => {
    const outline = getStrokeOutline(stroke.points, {
      size: stroke.size,
      simulatePressure: false,
    });
    const pathData = getSvgPathFromStroke(outline);
    return `<path d="${pathData}" fill="${stroke.color}" opacity="${stroke.opacity}" />`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${paths.join("")}</svg>`;
}

export function simplifyPoints(
  points: StrokePoint[],
  epsilon = 1.0,
): StrokePoint[] {
  if (points.length <= 2) return points;
  return rdpSimplify(points, epsilon);
}

function rdpSimplify(points: StrokePoint[], epsilon: number): StrokePoint[] {
  if (points.length <= 2) return points;

  const first = points[0]!;
  const last = points[points.length - 1]!;

  let maxDist = 0;
  let maxIdx = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i]!, first, last);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = rdpSimplify(points.slice(0, maxIdx + 1), epsilon);
    const right = rdpSimplify(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

function perpendicularDistance(
  point: StrokePoint,
  lineStart: StrokePoint,
  lineEnd: StrokePoint,
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const ex = point.x - lineStart.x;
    const ey = point.y - lineStart.y;
    return Math.sqrt(ex * ex + ey * ey);
  }

  const num = Math.abs(
    dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x,
  );
  return num / Math.sqrt(lenSq);
}

export function hitTestStroke(
  stroke: Stroke,
  x: number,
  y: number,
  threshold = 10,
): boolean {
  for (const point of stroke.points) {
    const dx = point.x - x;
    const dy = point.y - y;
    if (dx * dx + dy * dy <= threshold * threshold) {
      return true;
    }
  }
  return false;
}

export function createStrokeId(): string {
  return crypto.randomUUID();
}
