import { readFileSync, writeFileSync } from "node:fs";
import { interpretFloorPlan } from "../lib/ai/interpret";

loadEnv();

async function main() {
  const bytes = readFileSync("public/samples/floor-plan.pdf");
  const house = await interpretFloorPlan({
    bytes,
    mime: "application/pdf",
    filename: "floor-plan.pdf",
    source: "sample",
  });

  writeFileSync("/tmp/house-vision-sample.json", JSON.stringify(house, null, 2));
  for (const floor of house.floors) {
    console.log(`\n${floor.name} level ${floor.level}`);
    for (const room of floor.rooms) {
      const xs = room.polygon.map((point) => point.x);
      const ys = room.polygon.map((point) => point.y);
      console.log(
        `  ${room.kind.padEnd(12)} ${room.name.padEnd(16)} ${Math.min(...xs).toFixed(2)},${Math.min(...ys).toFixed(2)} ${Math.max(...xs).toFixed(2)},${Math.max(...ys).toFixed(2)}`,
      );
    }
    console.log(
      `  doors ${floor.doors.length} windows ${floor.windows.length} stairs ${floor.stairs.length} walls ${floor.walls.length}`,
    );
  }
  console.log("notes:", house.metadata.notes.join(" | ") || "(none)");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

function loadEnv() {
  const text = readFileSync(".env.local", "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 1) continue;
    const key = trimmed.slice(0, index);
    if (!process.env[key]) process.env[key] = trimmed.slice(index + 1);
  }
}
