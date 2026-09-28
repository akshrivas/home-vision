import { normalizeHouse } from "../lib/house/normalize";
import type { Extraction } from "../lib/house/schema";

const sample: Extraction = {
  name: "Sample Residence",
  notes: [],
  plot: {
    polygon: [
      { x: -1.6, y: -5.4 },
      { x: 16.4, y: -5.4 },
      { x: 16.4, y: 11.6 },
      { x: -1.6, y: 11.6 },
    ],
  },
  floors: [{ id: "ground", name: "Ground floor", level: 0 }],
  rooms: [
    { id: "kitchen", floorId: "ground", name: "Kitchen", kind: "room", polygon: rect(0.2, 0.2, 4.5, 4.5) },
    { id: "entry", floorId: "ground", name: "Entry", kind: "circulation", polygon: rect(4.65, 0.2, 8.5, 4.5) },
    { id: "balcony", floorId: "ground", name: "Balcony", kind: "balcony", polygon: rect(0.2, 4.75, 4.5, 6) },
  ],
  openings: [
    { id: "d1", floorId: "ground", kind: "door", center: { x: 4.575, y: 2.2 }, width: 0.9, height: 2.1 },
    { id: "w1", floorId: "ground", kind: "window", center: { x: 2, y: 0.1 }, width: 1.2, height: 1.2 },
  ],
  stairs: [
    {
      id: "stair",
      floorId: "ground",
      polygon: rect(6.3, 0.8, 8.3, 4),
      axis: "y",
      riseToward: "positive",
    },
  ],
};

const house = normalizeHouse(sample, "sample");
const floor = house.floors[0];
const interior = floor.walls.filter((wall) => !wall.exterior && wall.height > 2);
const rails = floor.walls.filter((wall) => wall.height < 1.5);
assert(floor.rooms.length === 3, `rooms ${floor.rooms.length}`);
assert(interior.length === 1, `interior walls ${interior.length}`);
assert(floor.doors.length === 1, `doors ${floor.doors.length}`);
assert(floor.windows.length === 1, `windows ${floor.windows.length}`);
assert(rails.length >= 2, `rails ${rails.length}`);
assert(floor.stairs.length === 1, "stair missing");

const millimetres = structuredClone(sample);
scale(millimetres, 1000);
const converted = normalizeHouse(millimetres, "upload");
const kitchen = converted.floors[0].rooms.find((room) => room.name === "Kitchen");
assert(kitchen !== undefined && Math.abs(kitchen.polygon[1].x - 4.5) < 0.05, "millimetre scale");

console.log(
  `ok rooms=${floor.rooms.length} walls=${floor.walls.length} interior=${interior.length} doors=${floor.doors.length} windows=${floor.windows.length} rails=${rails.length}`,
);

function rect(x0: number, y0: number, x1: number, y1: number) {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

function scale(extraction: Extraction, factor: number) {
  const point = (item: { x: number; y: number }) => {
    item.x *= factor;
    item.y *= factor;
  };
  extraction.plot.polygon.forEach(point);
  extraction.rooms.forEach((room) => room.polygon.forEach(point));
  extraction.openings.forEach((opening) => {
    point(opening.center);
    opening.width *= factor;
    opening.height *= factor;
  });
  extraction.stairs.forEach((stair) => stair.polygon.forEach(point));
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}
