import { pointAlong } from "@/lib/house/geometry";
import type { Point, Wall } from "@/lib/house/types";

export type OpeningCut = {
  offset: number;
  width: number;
  sill: number;
  height: number;
};

export type WallPiece = {
  a: Point;
  b: Point;
  y0: number;
  y1: number;
};

export function wallPieces(wall: Wall, openings: OpeningCut[]): WallPiece[] {
  const length = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
  const cuts = openings
    .map((opening) => ({
      start: clamp(opening.offset - opening.width / 2, 0, length),
      end: clamp(opening.offset + opening.width / 2, 0, length),
      sill: clamp(opening.sill, 0, wall.height),
      head: clamp(opening.sill + opening.height, 0, wall.height),
    }))
    .filter((opening) => opening.end - opening.start > 0.05)
    .sort((a, b) => a.start - b.start);

  const pieces: WallPiece[] = [];
  const push = (from: number, to: number, y0: number, y1: number) => {
    if (to - from < 0.04 || y1 - y0 < 0.04) return;
    pieces.push({
      a: pointAlong(wall.a, wall.b, from),
      b: pointAlong(wall.a, wall.b, to),
      y0,
      y1,
    });
  };

  let cursor = 0;
  for (const cut of cuts) {
    push(cursor, cut.start, 0, wall.height);
    if (cut.sill > 0.04) push(cut.start, cut.end, 0, cut.sill);
    if (wall.height - cut.head > 0.04) push(cut.start, cut.end, cut.head, wall.height);
    cursor = Math.max(cursor, cut.end);
  }
  push(cursor, length, 0, wall.height);
  return pieces;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
