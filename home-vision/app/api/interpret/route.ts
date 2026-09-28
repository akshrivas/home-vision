import { readFile } from "node:fs/promises";
import path from "node:path";
import { InterpretError, interpretFloorPlan } from "@/lib/ai/interpret";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_BYTES = 12 * 1024 * 1024;
const SAMPLE_PATH = path.join(process.cwd(), "public", "samples", "floor-plan.pdf");

export async function POST(request: Request) {
  try {
    const plan = await readPlan(request);
    const house = await interpretFloorPlan(plan);
    return Response.json({ house });
  } catch (error) {
    const failure = toFailure(error);
    if (!(error instanceof InterpretError)) console.error(error);
    return Response.json({ error: failure.message }, { status: failure.status });
  }
}

async function readPlan(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("sample" in body) || body.sample !== true) {
      throw new InterpretError("Choose a floor plan or the sample plan.", 400);
    }
    const bytes = await readFile(SAMPLE_PATH);
    return {
      bytes,
      mime: "application/pdf" as const,
      filename: "floor-plan.pdf",
      source: "sample" as const,
    };
  }

  const form = await request.formData();
  const uploaded = form.get("file");
  if (!(uploaded instanceof File)) {
    throw new InterpretError("Choose a PDF, PNG, or JPG floor plan.", 400);
  }
  if (uploaded.size === 0) {
    throw new InterpretError("That file is empty.", 400);
  }
  if (uploaded.size > MAX_BYTES) {
    throw new InterpretError("Use a floor plan smaller than 12 MB.", 400);
  }
  const mime = mimeOf(uploaded);
  if (!mime) {
    throw new InterpretError("Use a PDF, PNG, or JPG floor plan.", 400);
  }
  const bytes = Buffer.from(await uploaded.arrayBuffer());
  return {
    bytes,
    mime,
    filename: uploaded.name || "floor-plan",
    source: "upload" as const,
  };
}

function mimeOf(file: File): "application/pdf" | "image/png" | "image/jpeg" | null {
  const type = file.type.toLowerCase();
  if (type === "application/pdf" || type === "image/png" || type === "image/jpeg") return type;
  if (type === "image/jpg") return "image/jpeg";
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return null;
}

function toFailure(error: unknown) {
  if (error instanceof InterpretError) return { message: error.message, status: error.status };
  const message = error instanceof Error ? error.message : "";
  if (/api key/i.test(message)) {
    return { message: "Add OPENAI_API_KEY to .env.local to read floor plans.", status: 500 };
  }
  return { message: "The floor plan could not be read. Try a clearer architect PDF.", status: 500 };
}
