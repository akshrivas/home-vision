# House Vision

Turn an architect's floor plan into a walkable 3D house.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Copy `.env.example` to `.env.local` and set `OPENAI_API_KEY`. Floor plans are read by a vision model (`gpt-4.1` by default). Override the model with `OPENAI_VISION_MODEL`.

## What it does

Upload a PDF, PNG, or JPG, or try the sample plan. The app extracts a house model and opens a 3D view you can orbit or walk through.

A CAD-exported architect PDF works best when room names, dimensions, walls, doors, windows, and stairs are clearly visible.
