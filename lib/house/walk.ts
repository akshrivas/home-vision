import { DEFAULTS } from "@/lib/house/defaults";
import { boundsOf, pointInPolygon } from "@/lib/house/geometry";
import type { Floor, House, Stair } from "@/lib/house/types";
import { wallPieces } from "@/lib/house/walls";

export type Collider = {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  radius: number;
  bottom: number;
  top: number;
};

export type CameraFrame = {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
};

export type WalkStart = {
  x: number;
  z: number;
  eye: number;
  lookX: number;
  lookZ: number;
};

export function collidersFor(house: House): Collider[] {
  const colliders: Collider[] = [];
  for (const floor of house.floors) {
    const openings = [
      ...floor.doors.map((door) => ({
        wallId: door.wallId,
        offset: door.offset,
        width: door.width,
        sill: 0,
        height: door.height,
      })),
      ...floor.windows.map((window) => ({
        wallId: window.wallId,
        offset: window.offset,
        width: window.width,
        sill: window.sill,
        height: window.height,
      })),
    ];
    for (const wall of floor.walls) {
      const cuts = openings.filter((opening) => opening.wallId === wall.id);
      for (const piece of wallPieces(wall, cuts)) {
        if (!(piece.y0 < 1.5 && piece.y1 > 0.3)) continue;
        colliders.push({
          x1: piece.a.x,
          z1: piece.a.y,
          x2: piece.b.x,
          z2: piece.b.y,
          radius: wall.thickness / 2 + DEFAULTS.playerRadius,
          bottom: floor.elevation + piece.y0,
          top: floor.elevation + piece.y1,
        });
      }
    }
  }
  return colliders;
}

export function resolveCollision(x: number, z: number, foot: number, colliders: Collider[]) {
  let px = x;
  let pz = z;
  const bodyBottom = foot + 0.15;
  const bodyTop = foot + 1.55;
  for (let pass = 0; pass < 3; pass += 1) {
    for (const collider of colliders) {
      if (bodyTop < collider.bottom || bodyBottom > collider.top) continue;
      const closest = closestOnSegment(px, pz, collider);
      if (closest.distance >= collider.radius) continue;
      const push = collider.radius - closest.distance + 0.001;
      const nx = closest.distance > 1e-4 ? (px - closest.x) / closest.distance : 0;
      const nz = closest.distance > 1e-4 ? (pz - closest.z) / closest.distance : 1;
      px += nx * push;
      pz += nz * push;
    }
  }
  return { x: px, z: pz };
}

export function footHeight(house: House, x: number, z: number, current: number): number {
  for (const floor of house.floors) {
    for (const stair of floor.stairs) {
      if (!pointInPolygon({ x, y: z }, stair.polygon)) continue;
      return floor.elevation + stairProgress(stair, x, z) * riseFor(floor, house.floors);
    }
  }

  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  let found = false;
  for (const floor of house.floors) {
    for (const room of floor.rooms) {
      if (room.kind === "parking") continue;
      if (!pointInPolygon({ x, y: z }, room.polygon)) continue;
      const delta = Math.abs(floor.elevation - current);
      if (!found || delta < bestDistance - 0.04) {
        best = floor.elevation;
        bestDistance = delta;
        found = true;
      }
    }
  }
  return found ? best : 0;
}

export function frameHouse(house: House): CameraFrame {
  const points = house.floors.flatMap((floor) => floor.rooms.flatMap((room) => room.polygon));
  const bounds = boundsOf(points.length > 0 ? points : house.plot.polygon);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minY + bounds.maxY) / 2;
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 8);
  const top = Math.max(...house.floors.map((floor) => floor.elevation + floor.height), 3);
  return {
    position: {
      x: cx + span * 0.55,
      y: span * 0.42,
      z: cz - span * 1.2,
    },
    target: { x: cx, y: top * 0.28, z: cz },
  };
}

export function walkStart(house: House): WalkStart {
  const floor = house.floors.slice().sort((a, b) => a.level - b.level)[0];
  const points = floor?.rooms.flatMap((room) => room.polygon) ?? [];
  const centroid = points.length
    ? {
        x: points.reduce((sum, item) => sum + item.x, 0) / points.length,
        y: points.reduce((sum, item) => sum + item.y, 0) / points.length,
      }
    : { x: 0, y: 0 };
  let x = centroid.x;
  let z = centroid.y;
  const door = floor?.doors.slice().sort((a, b) => a.center.y - b.center.y)[0];
  if (door) {
    const dx = centroid.x - door.center.x;
    const dy = centroid.y - door.center.y;
    const length = Math.hypot(dx, dy) || 1;
    x = door.center.x + (dx / length) * 1.1;
    z = door.center.y + (dy / length) * 1.1;
  }
  return {
    x,
    z,
    eye: (floor?.elevation ?? 0) + DEFAULTS.eyeHeight,
    lookX: centroid.x,
    lookZ: centroid.y,
  };
}

export function clampToPlot(house: House, x: number, z: number) {
  const bounds = boundsOf(house.plot.polygon);
  const pad = 6;
  return {
    x: Math.min(bounds.maxX + pad, Math.max(bounds.minX - pad, x)),
    z: Math.min(bounds.maxY + pad, Math.max(bounds.minY - pad, z)),
  };
}

export function riseFor(floor: Floor, floors: Floor[]): number {
  const above = floors
    .filter((item) => item.level > floor.level)
    .sort((a, b) => a.level - b.level)[0];
  if (!above) return floor.height;
  return Math.max(0.8, above.elevation - floor.elevation);
}

export function stairProgress(stair: Stair, x: number, z: number): number {
  const bounds = boundsOf(stair.polygon);
  const min = stair.axis === "x" ? bounds.minX : bounds.minY;
  const max = stair.axis === "x" ? bounds.maxX : bounds.maxY;
  const coord = stair.axis === "x" ? x : z;
  let t = (coord - min) / Math.max(0.001, max - min);
  t = Math.min(1, Math.max(0, t));
  return stair.riseToward === "negative" ? 1 - t : t;
}

function closestOnSegment(x: number, z: number, collider: Collider) {
  const dx = collider.x2 - collider.x1;
  const dz = collider.z2 - collider.z1;
  const lengthSquared = dx * dx + dz * dz || 1e-8;
  const t = Math.min(1, Math.max(0, ((x - collider.x1) * dx + (z - collider.z1) * dz) / lengthSquared));
  const cx = collider.x1 + dx * t;
  const cz = collider.z1 + dz * t;
  return { x: cx, z: cz, distance: Math.hypot(x - cx, z - cz) };
}
