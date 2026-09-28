export type Point = { x: number; y: number };

export type RoomKind = "room" | "circulation" | "balcony" | "parking" | "other";

export type Finish = "wood" | "tile" | "stone" | "concrete";

export type Room = {
  id: string;
  name: string;
  kind: RoomKind;
  polygon: Point[];
  finish: Finish;
};

export type Wall = {
  id: string;
  a: Point;
  b: Point;
  thickness: number;
  height: number;
  exterior: boolean;
};

export type Door = {
  id: string;
  wallId: string;
  offset: number;
  width: number;
  height: number;
  center: Point;
};

export type Window = {
  id: string;
  wallId: string;
  offset: number;
  width: number;
  height: number;
  sill: number;
  center: Point;
};

export type Stair = {
  id: string;
  polygon: Point[];
  axis: "x" | "y";
  riseToward: "positive" | "negative";
};

export type Floor = {
  id: string;
  name: string;
  level: number;
  elevation: number;
  height: number;
  rooms: Room[];
  walls: Wall[];
  doors: Door[];
  windows: Window[];
  stairs: Stair[];
};

export type House = {
  metadata: {
    name: string;
    source: "sample" | "upload";
    units: "m";
    notes: string[];
  };
  plot: {
    polygon: Point[];
  };
  floors: Floor[];
};

export function isHouse(value: unknown): value is House {
  if (!value || typeof value !== "object") return false;
  const house = value as House;
  return Boolean(
    house.metadata &&
      house.metadata.units === "m" &&
      house.plot?.polygon &&
      Array.isArray(house.floors),
  );
}
