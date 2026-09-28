"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { boundsOf, pointAlong } from "@/lib/house/geometry";
import { holesInRoom, stairHoles } from "@/lib/house/normalize";
import type { Finish, Floor, House, Point, Wall } from "@/lib/house/types";
import { riseFor } from "@/lib/house/walk";
import { wallPieces, type OpeningCut } from "@/lib/house/walls";

const FINISH: Record<Finish, string> = {
  wood: "#c49a6c",
  tile: "#d8d3c9",
  stone: "#cfc3b0",
  concrete: "#b7b3ac",
};

export function HouseMesh({ house }: { house: House }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[180, 180]} />
        <meshStandardMaterial color="#d5e2cc" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      {house.plot.polygon.length >= 3 ? (
        <PlanSurface polygon={house.plot.polygon} holes={[]} y={0.005} color="#e5ddd0" roughness={0.95} />
      ) : null}
      {house.floors.map((floor) => (
        <FloorLevel key={floor.id} floor={floor} floors={house.floors} />
      ))}
      <Roof house={house} />
      <RoomLights house={house} />
    </group>
  );
}

function FloorLevel({ floor, floors }: { floor: Floor; floors: Floor[] }) {
  const holes = stairHoles(floor);
  return (
    <group>
      {floor.rooms.map((room) => (
        <PlanSurface
          key={room.id}
          polygon={room.polygon}
          holes={holesInRoom(room, holes)}
          y={floor.elevation + 0.05}
          color={FINISH[room.finish]}
          roughness={room.finish === "tile" ? 0.45 : 0.72}
        />
      ))}
      {floor.walls.map((wall) => (
        <WallMesh key={wall.id} floor={floor} wall={wall} />
      ))}
      {floor.doors.map((door) => {
        const wall = floor.walls.find((item) => item.id === door.wallId);
        return wall ? <DoorAssembly key={door.id} wall={wall} door={door} elevation={floor.elevation} /> : null;
      })}
      {floor.windows.map((window) => {
        const wall = floor.walls.find((item) => item.id === window.wallId);
        return wall ? <WindowPane key={window.id} wall={wall} window={window} elevation={floor.elevation} /> : null;
      })}
      {floor.stairs.map((stair) => (
        <StairRun key={stair.id} stair={stair} elevation={floor.elevation} rise={riseFor(floor, floors)} />
      ))}
    </group>
  );
}

function WallMesh({ floor, wall }: { floor: Floor; wall: Wall }) {
  const openings: OpeningCut[] = [
    ...floor.doors
      .filter((door) => door.wallId === wall.id)
      .map((door) => ({ offset: door.offset, width: door.width, sill: 0, height: door.height })),
    ...floor.windows
      .filter((window) => window.wallId === wall.id)
      .map((window) => ({ offset: window.offset, width: window.width, sill: window.sill, height: window.height })),
  ];
  const glassRail = wall.height < 1.4 && wall.thickness < 0.08;
  const pieces = wallPieces(wall, openings);

  return (
    <group>
      {pieces.map((piece, index) => {
        const length = Math.hypot(piece.b.x - piece.a.x, piece.b.y - piece.a.y);
        const angle = Math.atan2(piece.b.y - piece.a.y, piece.b.x - piece.a.x);
        const bands =
          wall.exterior && piece.y0 < 0.02 && piece.y1 > 0.18
            ? [
                { y0: piece.y0, y1: Math.min(piece.y1, 0.16), color: "#ddd4c6", roughness: 0.88 },
                { y0: Math.max(piece.y0, 0.16), y1: piece.y1, color: "#f4f1ea", roughness: 0.92 },
              ]
            : [
                {
                  y0: piece.y0,
                  y1: piece.y1,
                  color: glassRail ? "#c5dcea" : "#f4f1ea",
                  roughness: glassRail ? 0.08 : 0.92,
                },
              ];
        return bands
          .filter((band) => band.y1 - band.y0 > 0.02 && length > 0.03)
          .map((band) => (
            <mesh
              key={`${index}-${band.y0}`}
              position={[
                (piece.a.x + piece.b.x) / 2,
                floor.elevation + (band.y0 + band.y1) / 2,
                (piece.a.y + piece.b.y) / 2,
              ]}
              rotation={[0, -angle, 0]}
              castShadow={!glassRail}
              receiveShadow
            >
              <boxGeometry args={[length, band.y1 - band.y0, wall.thickness]} />
              <meshStandardMaterial
                color={band.color}
                roughness={band.roughness}
                metalness={0.02}
                transparent={glassRail}
                opacity={glassRail ? 0.35 : 1}
                side={glassRail ? THREE.DoubleSide : THREE.FrontSide}
              />
            </mesh>
          ));
      })}
    </group>
  );
}

function DoorAssembly({ wall, door, elevation }: { wall: Wall; door: Floor["doors"][number]; elevation: number }) {
  const angle = Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x);
  const center = pointAlong(wall.a, wall.b, door.offset);
  const width = Math.max(0.7, door.width);
  const height = Math.max(1.8, door.height);
  const depth = Math.max(0.12, wall.thickness);
  const jamb = 0.07;
  const leaf = Math.max(0.45, width - jamb * 2 - 0.02);
  const frameColor = "#ebe4d8";

  return (
    <group position={[center.x, elevation, center.y]} rotation={[0, -angle, 0]}>
      {/* Frame sits in the wall thickness so the opening reads as a doorway, not a floating leaf. */}
      <mesh position={[-width / 2 + jamb / 2, height / 2, 0]} castShadow>
        <boxGeometry args={[jamb, height, depth]} />
        <meshStandardMaterial color={frameColor} roughness={0.78} />
      </mesh>
      <mesh position={[width / 2 - jamb / 2, height / 2, 0]} castShadow>
        <boxGeometry args={[jamb, height, depth]} />
        <meshStandardMaterial color={frameColor} roughness={0.78} />
      </mesh>
      <mesh position={[0, height - jamb / 2, 0]} castShadow>
        <boxGeometry args={[width, jamb, depth]} />
        <meshStandardMaterial color={frameColor} roughness={0.78} />
      </mesh>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[width, 0.04, depth]} />
        <meshStandardMaterial color="#d8d0c4" roughness={0.9} />
      </mesh>
      {/* Leaf hinged on the left jamb, slightly ajar, flush with one face of the wall. */}
      <group position={[-width / 2 + jamb, 0, depth * 0.18]} rotation={[0, -0.42, 0]}>
        <mesh position={[leaf / 2, height / 2 - 0.02, 0]} castShadow>
          <boxGeometry args={[leaf, height - jamb - 0.06, 0.04]} />
          <meshStandardMaterial color="#6d4c34" roughness={0.58} />
        </mesh>
        <mesh position={[leaf - 0.1, height * 0.48, 0.025]}>
          <sphereGeometry args={[0.03, 10, 10]} />
          <meshStandardMaterial color="#c2a46a" metalness={0.55} roughness={0.35} />
        </mesh>
      </group>
    </group>
  );
}

function WindowPane({
  wall,
  window,
  elevation,
}: {
  wall: Wall;
  window: Floor["windows"][number];
  elevation: number;
}) {
  const angle = Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x);
  const center = pointAlong(wall.a, wall.b, window.offset);
  const width = window.width;
  const height = window.height;
  const y = window.sill + height / 2;
  return (
    <group position={[center.x, elevation, center.y]} rotation={[0, -angle, 0]}>
      <mesh position={[0, y, 0]}>
        <boxGeometry args={[Math.max(0.2, width - 0.08), Math.max(0.2, height - 0.08), 0.02]} />
        <meshStandardMaterial color="#c5dcea" transparent opacity={0.32} roughness={0.08} side={THREE.DoubleSide} />
      </mesh>
      <FrameBox args={[width, 0.06, wall.thickness * 0.55]} position={[0, window.sill + height, 0]} />
      <FrameBox args={[width, 0.06, wall.thickness * 0.7]} position={[0, window.sill, 0]} />
      <FrameBox args={[0.06, height, wall.thickness * 0.55]} position={[-width / 2, y, 0]} />
      <FrameBox args={[0.06, height, wall.thickness * 0.55]} position={[width / 2, y, 0]} />
    </group>
  );
}

function FrameBox({ args, position }: { args: [number, number, number]; position: [number, number, number] }) {
  return (
    <mesh position={position} castShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color="#f7f4ef" roughness={0.7} />
    </mesh>
  );
}

function StairRun({
  stair,
  elevation,
  rise,
}: {
  stair: Floor["stairs"][number];
  elevation: number;
  rise: number;
}) {
  const bounds = boundsOf(stair.polygon);
  const min = stair.axis === "x" ? bounds.minX : bounds.minY;
  const max = stair.axis === "x" ? bounds.maxX : bounds.maxY;
  const along = Math.max(0.4, max - min);
  const cross = Math.max(0.4, stair.axis === "x" ? bounds.maxY - bounds.minY : bounds.maxX - bounds.minX);
  const steps = Math.max(4, Math.round(rise / 0.17));
  const stepLength = along / steps;
  const stepRise = rise / steps;
  const low = stair.riseToward === "positive" ? min : max;
  const direction = stair.riseToward === "positive" ? 1 : -1;
  const crossCenter = stair.axis === "x" ? (bounds.minY + bounds.maxY) / 2 : (bounds.minX + bounds.maxX) / 2;

  return (
    <group>
      {Array.from({ length: steps }, (_, index) => {
        const alongCenter = low + direction * (index + 0.5) * stepLength;
        const height = (index + 1) * stepRise;
        const x = stair.axis === "x" ? alongCenter : crossCenter;
        const z = stair.axis === "y" ? alongCenter : crossCenter;
        return (
          <mesh key={index} position={[x, elevation + height / 2, z]} castShadow receiveShadow>
            <boxGeometry args={[stair.axis === "x" ? stepLength : cross, height, stair.axis === "y" ? stepLength : cross]} />
            <meshStandardMaterial color="#c9c2b6" roughness={0.72} />
          </mesh>
        );
      })}
    </group>
  );
}

function Roof({ house }: { house: House }) {
  const geometry = useMemo(() => {
    const top = house.floors.slice().sort((a, b) => b.level - a.level)[0];
    if (!top) return null;
    const rooms = top.rooms.filter((room) => room.kind === "room" || room.kind === "circulation");
    const source = rooms.length > 0 ? rooms : top.rooms.filter((room) => room.kind !== "parking");
    if (source.length === 0) return null;
    const bounds = boundsOf(source.flatMap((room) => room.polygon));
    const overhang = 0.42;
    const polygon = [
      { x: bounds.minX - overhang, y: bounds.minY - overhang },
      { x: bounds.maxX + overhang, y: bounds.minY - overhang },
      { x: bounds.maxX + overhang, y: bounds.maxY + overhang },
      { x: bounds.minX - overhang, y: bounds.maxY + overhang },
    ];
    const geometry = new THREE.ExtrudeGeometry(planShape(polygon, top.stairs.map((stair) => stair.polygon)), {
      depth: 0.16,
      bevelEnabled: false,
    });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, top.elevation + top.height, 0);
    geometry.computeVertexNormals();
    return geometry;
  }, [house]);

  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#efe8de" roughness={0.86} side={THREE.DoubleSide} />
    </mesh>
  );
}

function RoomLights({ house }: { house: House }) {
  return (
    <group>
      {house.floors.flatMap((floor) =>
        floor.rooms
          .filter((room) => room.kind === "room" || room.kind === "circulation")
          .map((room) => {
            const bounds = boundsOf(room.polygon);
            return (
              <pointLight
                key={room.id}
                position={[(bounds.minX + bounds.maxX) / 2, floor.elevation + floor.height - 0.35, (bounds.minY + bounds.maxY) / 2]}
                intensity={28}
                distance={14}
                decay={2}
                color="#fff3e4"
              />
            );
          }),
      )}
    </group>
  );
}

function PlanSurface({
  polygon,
  holes,
  y,
  color,
  roughness,
}: {
  polygon: Point[];
  holes: Point[][];
  y: number;
  color: string;
  roughness: number;
}) {
  const geometry = useMemo(() => {
    const geometry = new THREE.ShapeGeometry(planShape(polygon, holes));
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, y, 0);
    return geometry;
  }, [polygon, holes, y]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color={color} roughness={roughness} side={THREE.DoubleSide} />
    </mesh>
  );
}

function planShape(polygon: Point[], holes: Point[][]) {
  const ring = (points: Point[], counterClockwise: boolean) => {
    const mapped = points.map((item) => new THREE.Vector2(item.x, -item.y));
    const area = mapped.reduce((sum, item, index) => {
      const next = mapped[(index + 1) % mapped.length];
      return sum + item.x * next.y - next.x * item.y;
    }, 0);
    if (area > 0 !== counterClockwise) mapped.reverse();
    return mapped;
  };
  const shape = new THREE.Shape(ring(polygon, true));
  for (const hole of holes) {
    if (hole.length >= 3) shape.holes.push(new THREE.Path(ring(hole, false)));
  }
  return shape;
}
