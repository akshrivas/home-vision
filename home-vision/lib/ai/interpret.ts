import OpenAI from "openai";
import { FLOOR_PLAN_PROMPT } from "@/lib/ai/prompt";
import { normalizeHouse } from "@/lib/house/normalize";
import { extractionJsonSchema, extractionSchema } from "@/lib/house/schema";
import type { House } from "@/lib/house/types";

export class InterpretError extends Error {
  status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.status = status;
  }
}

type PlanFile = {
  bytes: Buffer;
  mime: "application/pdf" | "image/png" | "image/jpeg";
  filename: string;
  source: House["metadata"]["source"];
};

export async function interpretFloorPlan(file: PlanFile): Promise<House> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new InterpretError("Add OPENAI_API_KEY to .env.local to read floor plans.", 500);
  }

  const model = process.env.OPENAI_VISION_MODEL || "gpt-4.1";
  const client = new OpenAI({ apiKey });
  let extracted: unknown;
  try {
    extracted = await requestExtraction(client, model, file);
  } catch (error) {
    if (model !== "gpt-4o" && isUnknownModel(error)) {
      extracted = await requestExtraction(client, "gpt-4o", file);
    } else {
      throw error;
    }
  }

  const parsed = extractionSchema.safeParse(extracted);
  if (!parsed.success) {
    console.error(parsed.error.issues);
    throw new InterpretError("The floor plan could not be read into a house model.");
  }

  try {
    const house = normalizeHouse(parsed.data, file.source);
    console.info(
      `House "${house.metadata.name}": ${house.floors.length} floor(s), ${house.floors.reduce((sum, floor) => sum + floor.rooms.length, 0)} rooms, ${house.floors.reduce((sum, floor) => sum + floor.walls.length, 0)} walls`,
    );
    return house;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The floor plan could not be turned into a house.";
    throw new InterpretError(message);
  }
}

async function requestExtraction(client: OpenAI, model: string, file: PlanFile): Promise<unknown> {
  const base64 = file.bytes.toString("base64");
  const content =
    file.mime === "application/pdf"
      ? [
          { type: "input_text" as const, text: FLOOR_PLAN_PROMPT },
          {
            type: "input_file" as const,
            filename: file.filename,
            file_data: `data:application/pdf;base64,${base64}`,
            detail: "high" as const,
          },
        ]
      : [
          { type: "input_text" as const, text: FLOOR_PLAN_PROMPT },
          {
            type: "input_image" as const,
            image_url: `data:${file.mime};base64,${base64}`,
            detail: "high" as const,
          },
        ];

  const response = await client.responses.create(
    {
      model,
      store: false,
      temperature: 0,
      input: [{ role: "user", content }],
      text: {
        format: {
          type: "json_schema",
          name: "house_extraction",
          strict: true,
          schema: extractionJsonSchema,
        },
      },
    },
    { timeout: 90_000 },
  );

  if (!response.output_text) {
    throw new InterpretError("The vision model returned an empty reading of the floor plan.");
  }
  return JSON.parse(response.output_text) as unknown;
}

function isUnknownModel(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /model/i.test(message) && /(not found|does not exist|invalid)/i.test(message);
}
