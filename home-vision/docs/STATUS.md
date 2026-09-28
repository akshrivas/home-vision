# House Vision — Status

Date: 29 September 2026

Production: https://house-vision-nine.vercel.app

## Where this stands

The smallest end-to-end path exists. It is not yet the product in the FSD.

A sample floor plan can be read by a vision model, turned into a House JSON model, and shown in the browser as a 3D building you can orbit. Walk mode is implemented. The picture is still an early massing model: simple plaster, a flat roof, basic openings. It does not yet feel like a beautiful house you can walk inside. That quality bar is the open gap.

## Done

- Next.js app with a landing page: upload, sample plan, and the architect-PDF recommendation.
- Upload accepts PDF, PNG, and JPG. Sample plan is `public/samples/floor-plan.pdf`.
- Server route sends the file to a vision model (`gpt-4.1` by default) and validates a structured reading.
- That reading is normalized into the House model: plot, floors, rooms, walls, doors, windows, stairs, metadata.
- React Three Fiber builds the mesh from that model only. The sample house is not hardcoded in the viewer.
- Orbit and walk controls are in the viewer. Walk uses pointer look, WASD, wall collision, and stair height.
- Sample plan extraction has produced the labelled spaces on that sheet: kitchen, entry, living, two bedrooms, bath, balcony, parking, and a stair.

## Not done

- Visual quality at the FSD bar. Materials, light, windows, doors, and the interior still read as a study model.
- Vision reading is uneven. Some runs miss windows or shift a door onto a nearby wall. The app does not invent rooms to hide that.
- No accounts, saving, or sharing. The current house lives in the browser tab.
- Floor-plan reading takes about 15–20 seconds. A host with a short function limit can cut that off.

## Production

Live app: https://house-vision-nine.vercel.app

The landing page and the 3D viewer are up. The sample-plan route returns a house on production (about 20 seconds). Upload and sample both need the vision key, which is set on the Vercel project and is not in git.

## Run locally

```bash
cd home-vision
npm install
npm run dev
```

Open http://localhost:3000.

`OPENAI_API_KEY` belongs in `.env.local` (see `.env.example`). It is not committed.
