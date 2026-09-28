import { z } from "zod";

export const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const extractionSchema = z.object({
  name: z.string().min(1).max(160),
  notes: z.array(z.string().max(400)).max(20),
  plot: z.object({
    polygon: z.array(pointSchema).min(3).max(32),
  }),
  floors: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        name: z.string().min(1).max(80),
        level: z.number(),
      }),
    )
    .min(1)
    .max(6),
  rooms: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        floorId: z.string().min(1).max(40),
        name: z.string().min(1).max(80),
        kind: z.enum(["room", "circulation", "balcony", "parking", "other"]),
        polygon: z.array(pointSchema).min(3).max(32),
      }),
    )
    .min(1)
    .max(48),
  openings: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        floorId: z.string().min(1).max(40),
        kind: z.enum(["door", "window"]),
        center: pointSchema,
        width: z.number(),
        height: z.number(),
      }),
    )
    .max(100),
  stairs: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        floorId: z.string().min(1).max(40),
        polygon: z.array(pointSchema).min(3).max(16),
        axis: z.enum(["x", "y"]),
        riseToward: z.enum(["positive", "negative"]),
      }),
    )
    .max(12),
});

export type Extraction = z.infer<typeof extractionSchema>;

const pointJson = {
  type: "object",
  additionalProperties: false,
  properties: {
    x: { type: "number" },
    y: { type: "number" },
  },
  required: ["x", "y"],
} as const;

export const extractionJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    notes: { type: "array", items: { type: "string" } },
    plot: {
      type: "object",
      additionalProperties: false,
      properties: {
        polygon: { type: "array", items: pointJson },
      },
      required: ["polygon"],
    },
    floors: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          level: { type: "number" },
        },
        required: ["id", "name", "level"],
      },
    },
    rooms: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          floorId: { type: "string" },
          name: { type: "string" },
          kind: {
            type: "string",
            enum: ["room", "circulation", "balcony", "parking", "other"],
          },
          polygon: { type: "array", items: pointJson },
        },
        required: ["id", "floorId", "name", "kind", "polygon"],
      },
    },
    openings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          floorId: { type: "string" },
          kind: { type: "string", enum: ["door", "window"] },
          center: pointJson,
          width: { type: "number" },
          height: { type: "number" },
        },
        required: ["id", "floorId", "kind", "center", "width", "height"],
      },
    },
    stairs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          floorId: { type: "string" },
          polygon: { type: "array", items: pointJson },
          axis: { type: "string", enum: ["x", "y"] },
          riseToward: { type: "string", enum: ["positive", "negative"] },
        },
        required: ["id", "floorId", "polygon", "axis", "riseToward"],
      },
    },
  },
  required: ["name", "notes", "plot", "floors", "rooms", "openings", "stairs"],
};
