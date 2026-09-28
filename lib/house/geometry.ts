import type { Point } from "@/lib/house/types";

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function snap(value: number, step = 0.05): number {
  return Math.round(value / step) * step;
}

export function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function point(x: number, y: number): Point {
  return { x: round3(x), y: round3(y) };
}

export function polygonArea(polygon: Point[]): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return sum / 2;
}

export function polygonCentroid(polygon: Point[]): Point {
  let crossSum = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    const cross = current.x * next.y - next.x * current.y;
    crossSum += cross;
    x += (current.x + next.x) * cross;
    y += (current.y + next.y) * cross;
  }
  if (Math.abs(crossSum) < 1e-6) {
    return {
      x: polygon.reduce((sum, item) => sum + item.x, 0) / polygon.length,
      y: polygon.reduce((sum, item) => sum + item.y, 0) / polygon.length,
    };
  }
  return { x: x / (3 * crossSum), y: y / (3 * crossSum) };
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = a.y > point.y !== b.y > point.y;
    if (!crosses) continue;
    const x = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1e-9) + a.x;
    if (point.x < x) inside = !inside;
  }
  return inside;
}

export function boundsOf(points: Point[]) {
  const xs = points.map((item) => item.x);
  const ys = points.map((item) => item.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

export function dedupePoints(polygon: Point[]): Point[] {
  const next: Point[] = [];
  for (const item of polygon) {
    const previous = next[next.length - 1];
    if (!previous || distance(previous, item) > 0.04) next.push(item);
  }
  if (next.length > 2 && distance(next[0], next[next.length - 1]) <= 0.04) next.pop();
  return next;
}

export function ensureCounterClockwise(polygon: Point[]): Point[] {
  return polygonArea(polygon) < 0 ? [...polygon].reverse() : polygon;
}

export function outwardNormal(a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dy / length, y: -dx / length };
}

export function projectOntoSegment(point: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy || 1e-8;
  const length = Math.sqrt(lengthSquared);
  const t = Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  const x = a.x + dx * t;
  const y = a.y + dy * t;
  return {
    offset: t * length,
    distance: Math.hypot(point.x - x, point.y - y),
  };
}

export function pointAlong(a: Point, b: Point, distanceAlong: number): Point {
  const length = distance(a, b) || 1;
  const t = distanceAlong / length;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function extendSegment(a: Point, b: Point, amount: number): [Point, Point] {
  const length = distance(a, b) || 1;
  const ux = (b.x - a.x) / length;
  const uy = (b.y - a.y) / length;
  return [
    { x: a.x - ux * amount, y: a.y - uy * amount },
    { x: b.x + ux * amount, y: b.y + uy * amount },
  ];
}
