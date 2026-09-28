import { DEFAULTS } from "@/lib/house/defaults";
import {
  boundsOf,
  dedupePoints,
  distance,
  ensureCounterClockwise,
  extendSegment,
  outwardNormal,
  point,
  pointInPolygon,
  polygonArea,
  projectOntoSegment,
  snap,
} from "@/lib/house/geometry";
import type { Extraction } from "@/lib/house/schema";
import type { Door, Finish, Floor, House, Point, RoomKind, Stair, Wall, Window } from "@/lib/house/types";

type DraftWall = {
  a: Point;
  b: Point;
  floorId: string;
  sources: number;
};

const ENCLOSED: ReadonlySet<RoomKind> = new Set(["room", "circulation", "other"]);

export function normalizeHouse(raw: Extraction, source: House["metadata"]["source"]): House {
  const notes = raw.notes.map((note) => note.trim()).filter(Boolean);
  const scaled = scaleToMetres(raw, notes);
  const floors = prepareFloors(scaled);
  const floorIds = new Set(floors.map((floor) => floor.id));
  const fallbackFloor = floors[0].id;

  const stairInputs = [...scaled.stairs];
  for (const room of scaled.rooms) {
    if (!isStairName(room.name)) continue;
    if (stairInputs.some((stair) => stair.floorId === room.floorId)) continue;
    const polygon = tidyPolygon(room.polygon);
    if (polygon.length < 3) continue;
    const bounds = boundsOf(polygon);
    stairInputs.push({
      id: room.id,
      floorId: room.floorId,
      polygon,
      axis: bounds.maxX - bounds.minX > bounds.maxY - bounds.minY ? "x" : "y",
      riseToward: "positive",
    });
  }

  const rooms = scaled.rooms.filter((room) => !isStairName(room.name)).flatMap((room) => {
    const polygon = tidyPolygon(room.polygon.map((item) => ({ x: item.x, y: item.y })));
    if (polygon.length < 3 || Math.abs(polygonArea(polygon)) < 0.4) return [];
    const floorId = floorIds.has(room.floorId) ? room.floorId : fallbackFloor;
    return [
      {
        id: room.id,
        floorId,
        name: room.name.trim(),
        kind: room.kind,
        polygon,
        finish: finishFor(room.name, room.kind),
      },
    ];
  });

  if (rooms.length === 0) {
    throw new Error("No rooms could be read from the floor plan.");
  }

  const byFloor = new Map<string, typeof rooms>();
  for (const room of rooms) {
    const list = byFloor.get(room.floorId) ?? [];
    list.push(room);
    byFloor.set(room.floorId, list);
  }

  const minLevel = Math.min(...floors.map((floor) => floor.level));
  const builtFloors: Floor[] = floors.map((floor) => {
    const floorRooms = byFloor.get(floor.id) ?? [];
    const elevation = (floor.level - minLevel) * DEFAULTS.floorToFloor;
    const drafted = floorRooms
      .filter((room) => ENCLOSED.has(room.kind))
      .flatMap((room) => wallsFromRoom(room.polygon, floor.id));
    const merged = extendWalls(mergeWalls(drafted));
    const walls = [
      ...merged.map((wall, index) => toWall(wall, index)),
      ...balconyRails(floorRooms, merged, floor.id).map((wall, index) => toRail(wall, index)),
    ];
    const attached = attachOpenings(
      scaled.openings.filter((opening) => (floorIds.has(opening.floorId) ? opening.floorId : fallbackFloor) === floor.id),
      walls,
      notes,
    );
    if (attached.doors.length === 0) {
      const entrance = defaultEntrance(walls);
      if (entrance) {
        attached.doors.push(entrance);
        notes.push("No door could be placed, so a default entrance was added.");
      }
    }
    const stairs = stairInputs.flatMap((stair) => {
      const stairFloor = floorIds.has(stair.floorId) ? stair.floorId : fallbackFloor;
      if (stairFloor !== floor.id) return [];
      const polygon = tidyPolygon(stair.polygon);
      if (polygon.length < 3) return [];
      return [
        {
          id: stair.id,
          polygon,
          axis: stair.axis,
          riseToward: stair.riseToward,
        } satisfies Stair,
      ];
    });

    return {
      id: floor.id,
      name: floor.name,
      level: floor.level,
      elevation,
      height: DEFAULTS.wallHeight,
      rooms: floorRooms.map((room) => ({
        id: room.id,
        name: room.name,
        kind: room.kind,
        polygon: room.polygon,
        finish: room.finish,
      })),
      walls,
      doors: attached.doors,
      windows: attached.windows,
      stairs,
    };
  });

  const occupied = builtFloors.filter((floor) => floor.rooms.length > 0);
  if (occupied.length === 0) {
    throw new Error("No rooms could be read from the floor plan.");
  }

  return {
    metadata: {
      name: scaled.name.trim() || "House",
      source,
      units: "m",
      notes: unique(notes).slice(0, 8),
    },
    plot: { polygon: plotPolygon(scaled.plot.polygon, rooms.map((room) => room.polygon).flat()) },
    floors: occupied,
  };
}

function scaleToMetres(raw: Extraction, notes: string[]): Extraction {
  const values = [
    ...raw.plot.polygon,
    ...raw.rooms.flatMap((room) => room.polygon),
    ...raw.openings.map((opening) => opening.center),
    ...raw.stairs.flatMap((stair) => stair.polygon),
  ].map((item) => Math.max(Math.abs(item.x), Math.abs(item.y)));
  const max = values.length ? Math.max(...values) : 0;
  const factor = max >= 2000 ? 0.001 : max >= 200 ? 0.01 : 1;
  if (factor === 1) return raw;
  notes.push(factor === 0.001 ? "Dimensions were converted from millimetres." : "Dimensions were converted from centimetres.");
  const scale = (item: Point): Point => ({ x: item.x * factor, y: item.y * factor });
  return {
    ...raw,
    plot: { polygon: raw.plot.polygon.map(scale) },
    rooms: raw.rooms.map((room) => ({ ...room, polygon: room.polygon.map(scale) })),
    openings: raw.openings.map((opening) => ({
      ...opening,
      center: scale(opening.center),
      width: opening.width * factor,
      height: opening.height * factor,
    })),
    stairs: raw.stairs.map((stair) => ({ ...stair, polygon: stair.polygon.map(scale) })),
  };
}

function prepareFloors(raw: Extraction) {
  const seen = new Set<string>();
  const floors = raw.floors
    .map((floor) => ({
      id: floor.id.trim(),
      name: floor.name.trim() || "Floor",
      level: Math.round(floor.level),
    }))
    .filter((floor) => {
      if (!floor.id || seen.has(floor.id)) return false;
      seen.add(floor.id);
      return true;
    })
    .sort((a, b) => a.level - b.level);
  return floors.length > 0 ? floors : [{ id: "ground", name: "Ground floor", level: 0 }];
}

function tidyPolygon(polygon: Point[]): Point[] {
  const snapped = polygon.map((item) => ({ x: snap(item.x), y: snap(item.y) }));
  if (isNearlyRectangle(snapped)) {
    const xs = snapped.map((item) => item.x);
    const ys = snapped.map((item) => item.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    if (maxX - minX < 0.4 || maxY - minY < 0.4) return [];
    return [
      point(minX, minY),
      point(maxX, minY),
      point(maxX, maxY),
      point(minX, maxY),
    ];
  }
  const cleaned = ensureCounterClockwise(dedupePoints(snapped));
  return cleaned.length >= 3 ? cleaned : [];
}

function isNearlyRectangle(polygon: Point[]): boolean {
  if (polygon.length !== 4) return false;
  return polygon.every((item, index) => {
    const next = polygon[(index + 1) % polygon.length];
    const angle = Math.abs((Math.atan2(next.y - item.y, next.x - item.x) * 180) / Math.PI);
    return angle < 12 || angle > 168 || Math.abs(angle - 90) < 12;
  });
}

function wallsFromRoom(polygon: Point[], floorId: string): DraftWall[] {
  const ring = ensureCounterClockwise(polygon);
  const walls: DraftWall[] = [];
  for (let index = 0; index < ring.length; index += 1) {
    const start = ring[index];
    const end = ring[(index + 1) % ring.length];
    if (distance(start, end) < 0.25) continue;
    const normal = outwardNormal(start, end);
    const half = DEFAULTS.interiorThickness / 2;
    walls.push({
      a: { x: start.x + normal.x * half, y: start.y + normal.y * half },
      b: { x: end.x + normal.x * half, y: end.y + normal.y * half },
      floorId,
      sources: 1,
    });
  }
  return walls;
}

function mergeWalls(walls: DraftWall[]): DraftWall[] {
  return [...mergeAxis(walls, "h"), ...mergeAxis(walls, "v"), ...diagonalWalls(walls)];
}

function diagonalWalls(walls: DraftWall[]): DraftWall[] {
  return walls.filter((wall) => {
    const dx = Math.abs(wall.b.x - wall.a.x);
    const dy = Math.abs(wall.b.y - wall.a.y);
    return dx > 0.12 && dy > 0.12;
  });
}

function mergeAxis(walls: DraftWall[], axis: "h" | "v"): DraftWall[] {
  const items = walls
    .flatMap((wall) => {
      const horizontal = Math.abs(wall.a.y - wall.b.y) <= 0.12 && Math.abs(wall.b.x - wall.a.x) > 0.2;
      const vertical = Math.abs(wall.a.x - wall.b.x) <= 0.12 && Math.abs(wall.b.y - wall.a.y) > 0.2;
      if (axis === "h" && !horizontal) return [];
      if (axis === "v" && !vertical) return [];
      if (axis === "h") {
        return [{ ...wall, fixed: (wall.a.y + wall.b.y) / 2, start: Math.min(wall.a.x, wall.b.x), end: Math.max(wall.a.x, wall.b.x) }];
      }
      return [{ ...wall, fixed: (wall.a.x + wall.b.x) / 2, start: Math.min(wall.a.y, wall.b.y), end: Math.max(wall.a.y, wall.b.y) }];
    })
    .sort((a, b) => a.fixed - b.fixed || a.start - b.start);

  const clusters: (typeof items)[] = [];
  for (const item of items) {
    const cluster = clusters[clusters.length - 1];
    if (!cluster || cluster[0].floorId !== item.floorId) {
      clusters.push([item]);
      continue;
    }
    const mean = cluster.reduce((sum, entry) => sum + entry.fixed, 0) / cluster.length;
    if (Math.abs(item.fixed - mean) < 0.28) cluster.push(item);
    else clusters.push([item]);
  }

  const merged: DraftWall[] = [];
  for (const cluster of clusters) {
    const spans = cluster
      .slice()
      .sort((a, b) => a.start - b.start)
      .reduce<Array<{ start: number; end: number; sources: number; fixed: number; count: number; floorId: string }>>((list, item) => {
        const current = list[list.length - 1];
        if (!current || item.start > current.end + 0.35) {
          list.push({ start: item.start, end: item.end, sources: item.sources, fixed: item.fixed, count: 1, floorId: item.floorId });
          return list;
        }
        if (item.start < current.end - 0.05) current.sources += item.sources;
        current.end = Math.max(current.end, item.end);
        current.fixed += item.fixed;
        current.count += 1;
        return list;
      }, []);

    for (const span of spans) {
      if (span.end - span.start < 0.25) continue;
      const fixed = snap(span.fixed / span.count);
      const start = span.start;
      const end = span.end;
      merged.push(
        axis === "h"
          ? { a: { x: start, y: fixed }, b: { x: end, y: fixed }, floorId: span.floorId, sources: span.sources }
          : { a: { x: fixed, y: start }, b: { x: fixed, y: end }, floorId: span.floorId, sources: span.sources },
      );
    }
  }
  return merged;
}

function extendWalls(walls: DraftWall[]): DraftWall[] {
  return walls.map((wall) => {
    const thickness = wall.sources >= 2 ? DEFAULTS.interiorThickness : DEFAULTS.exteriorThickness;
    const [a, b] = extendSegment(wall.a, wall.b, thickness / 2);
    return { ...wall, a, b };
  });
}

function toWall(wall: DraftWall, index: number): Wall {
  const exterior = wall.sources < 2;
  return {
    id: `wall-${wall.floorId}-${index}`,
    a: point(wall.a.x, wall.a.y),
    b: point(wall.b.x, wall.b.y),
    thickness: exterior ? DEFAULTS.exteriorThickness : DEFAULTS.interiorThickness,
    height: DEFAULTS.wallHeight,
    exterior,
  };
}

function toRail(wall: DraftWall, index: number): Wall {
  return {
    id: `rail-${wall.floorId}-${index}`,
    a: point(wall.a.x, wall.a.y),
    b: point(wall.b.x, wall.b.y),
    thickness: DEFAULTS.balconyRailThickness,
    height: DEFAULTS.balconyRailHeight,
    exterior: false,
  };
}

function balconyRails(
  rooms: Array<{ kind: RoomKind; polygon: Point[] }>,
  walls: DraftWall[],
  floorId: string,
): DraftWall[] {
  const rails: DraftWall[] = [];
  for (const room of rooms) {
    if (room.kind !== "balcony") continue;
    const ring = ensureCounterClockwise(room.polygon);
    for (let index = 0; index < ring.length; index += 1) {
      const start = ring[index];
      const end = ring[(index + 1) % ring.length];
      if (distance(start, end) < 0.3) continue;
      const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      const nearBuilding = walls.some((wall) => projectOntoSegment(mid, wall.a, wall.b).distance < 0.35);
      if (nearBuilding) continue;
      const normal = outwardNormal(start, end);
      const half = DEFAULTS.balconyRailThickness / 2;
      rails.push({
        a: point(start.x + normal.x * half, start.y + normal.y * half),
        b: point(end.x + normal.x * half, end.y + normal.y * half),
        floorId,
        sources: 1,
      });
    }
  }
  return rails;
}

function attachOpenings(openings: Extraction["openings"], walls: Wall[], notes: string[]) {
  const doors: Door[] = [];
  const windows: Window[] = [];
  let missed = 0;
  for (const opening of openings) {
    const placed = placeOpening(opening, walls);
    if (!placed) {
      missed += 1;
      continue;
    }
    if (placed.door) doors.push(placed.door);
    if (placed.window) windows.push(placed.window);
  }
  if (missed > 0) notes.push("Some openings could not be matched to a wall.");
  return { doors, windows };
}

function placeOpening(opening: Extraction["openings"][number], walls: Wall[]) {
  let best: { wall: Wall; offset: number; distance: number } | null = null;
  for (const wall of walls) {
    if (wall.height < 2) continue;
    const projected = projectOntoSegment(opening.center, wall.a, wall.b);
    if (!best || projected.distance < best.distance) {
      best = { wall, offset: projected.offset, distance: projected.distance };
    }
  }
  if (!best || best.distance > 1.15) return null;
  const length = distance(best.wall.a, best.wall.b);
  const width = Math.min(cleanWidth(opening.kind, opening.width), length - 0.16);
  if (width < 0.45) return null;
  const margin = width / 2 + 0.05;
  const offset = Math.min(length - margin, Math.max(margin, best.offset));
  const center = centerOnWall(best.wall, offset);
  if (opening.kind === "door") {
    const height = Math.min(cleanHeight("door", opening.height), best.wall.height - 0.08);
    const door: Door = { id: opening.id, wallId: best.wall.id, offset, width, height, center };
    return { door, window: null };
  }
  const height = Math.min(cleanHeight("window", opening.height), best.wall.height - DEFAULTS.windowSill - 0.08);
  const window: Window = {
    id: opening.id,
    wallId: best.wall.id,
    offset,
    width,
    height: Math.max(0.6, height),
    sill: DEFAULTS.windowSill,
    center,
  };
  return { door: null, window };
}

function defaultEntrance(walls: Wall[]): Door | null {
  const candidates = walls
    .filter((wall) => wall.exterior && wall.height > 2 && distance(wall.a, wall.b) > 1.4)
    .sort((a, b) => Math.min(a.a.y, a.b.y) - Math.min(b.a.y, b.b.y));
  const wall = candidates[0];
  if (!wall) return null;
  const length = distance(wall.a, wall.b);
  const offset = length / 2;
  return {
    id: "entrance",
    wallId: wall.id,
    offset,
    width: Math.min(DEFAULTS.doorWidth, length - 0.3),
    height: DEFAULTS.doorHeight,
    center: centerOnWall(wall, offset),
  };
}

function centerOnWall(wall: Wall, offset: number): Point {
  const length = distance(wall.a, wall.b) || 1;
  const t = offset / length;
  return point(wall.a.x + (wall.b.x - wall.a.x) * t, wall.a.y + (wall.b.y - wall.a.y) * t);
}

function cleanWidth(kind: "door" | "window", width: number): number {
  if (!Number.isFinite(width) || width < 0.45 || width > 4) {
    return kind === "door" ? DEFAULTS.doorWidth : DEFAULTS.windowWidth;
  }
  return width;
}

function cleanHeight(kind: "door" | "window", height: number): number {
  if (!Number.isFinite(height) || height < 0.5 || height > 2.7) {
    return kind === "door" ? DEFAULTS.doorHeight : DEFAULTS.windowHeight;
  }
  return height;
}

function finishFor(name: string, kind: RoomKind): Finish {
  if (kind === "parking") return "concrete";
  if (kind === "balcony") return "stone";
  const label = name.toLowerCase();
  if (/bath|toilet|wc|powder|laundry/.test(label)) return "tile";
  if (/kitchen/.test(label)) return "tile";
  if (/entry|foyer|hall|lobby|passage|corridor|stair/.test(label)) return "stone";
  return "wood";
}

function plotPolygon(polygon: Point[], roomPoints: Point[]): Point[] {
  const tidy = tidyPolygon(polygon);
  if (tidy.length >= 3) return tidy;
  if (roomPoints.length === 0) return [];
  const bounds = boundsOf(roomPoints);
  const pad = 1.8;
  return [
    { x: snap(bounds.minX - pad), y: snap(bounds.minY - pad) },
    { x: snap(bounds.maxX + pad), y: snap(bounds.minY - pad) },
    { x: snap(bounds.maxX + pad), y: snap(bounds.maxY + pad) },
    { x: snap(bounds.minX - pad), y: snap(bounds.maxY + pad) },
  ];
}

function isStairName(name: string): boolean {
  return /^\s*stairs?\b/i.test(name);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function stairHoles(floor: Floor): Point[][] {
  return floor.stairs
    .map((stair) => stair.polygon)
    .filter((polygon) => polygon.length >= 3);
}

export function holesInRoom(room: { polygon: Point[] }, holes: Point[][]): Point[][] {
  return holes.filter((hole) => pointInPolygon(average(hole), room.polygon));
}

function average(polygon: Point[]): Point {
  return {
    x: polygon.reduce((sum, item) => sum + item.x, 0) / polygon.length,
    y: polygon.reduce((sum, item) => sum + item.y, 0) / polygon.length,
  };
}
