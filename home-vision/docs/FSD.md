# House Vision — Functional Specification

Date: 29 September 2026

## 1. Final vision

House Vision turns an architect's floor plan into a house you can walk through.

The architect has already designed the house. This product does not design, review, or estimate anything. It understands the supplied plan and shows that house in 3D.

The result should feel like a beautiful modern architectural visualization:

> Here is my house. I can walk inside it.

It should not feel like a CAD viewer, a massing box, or a rough technical preview.

## 2. Who it is for

A person who already has a floor plan — ideally the original digital or CAD-exported architect PDF — and wants to see the house, move around it, and walk inside.

## 3. Product principle

Read the plan. Do not invent a different house.

If a label, dimension, door, window, or stair is missing, use a sensible visualization default so the house can still be seen and walked. Do not add rooms, floors, or features that are not in the drawing.

## 4. V1 scope

Two actions only:

1. Upload Floor Plan
2. Try Sample Plan

Supported files: PDF, PNG, JPG.

Preferred input, shown on the landing page:

> Upload the original digital or CAD-exported architect floor-plan PDF with room names, dimensions, walls, doors, windows and stairs clearly visible.

After processing, the person sees **View 3D House** and can orbit the outside or walk inside.

Nothing else is required for V1.

## 5. Landing

The landing page contains only:

- House Vision
- "Turn your floor plan into a 3D house."
- Upload Floor Plan
- Try Sample Plan
- The short recommendation about the architect PDF

## 6. What the vision model extracts

An existing vision-capable model reads the uploaded plan. Extract only what is visible:

- plot or boundary
- floors
- rooms and room names
- dimensions
- walls
- doors
- windows
- stairs
- balconies
- parking
- other major spaces

## 7. House model

A structured JSON model sits between understanding and rendering. The 3D view consumes this model. It does not contain a hardcoded house, room count, or layout. The sample plan is only a test input.

```
House
 ├── plot
 ├── floors
 │    ├── rooms
 │    ├── walls
 │    ├── doors
 │    ├── windows
 │    └── stairs
 └── metadata
```

Coordinates are in metres. Each floor carries its rooms, walls, openings, and stairs. Metadata records the name, source (sample or upload), units, and any reading notes.

Visualization defaults, used only when the drawing does not say:

- storey height about 2.8 m
- exterior wall about 0.22 m, interior wall about 0.15 m
- door about 0.9 m by 2.1 m
- window about 1.2 m wide, sill about 0.9 m
- a single entrance if no door can be placed, so the house can be entered

## 8. 3D experience

Built with Next.js, TypeScript, React, React Three Fiber, Three.js, and `@react-three/drei`. Not Unity.

The house is generated from the House model:

- walls, floors, ceilings or roof
- doors and windows
- stairs
- balcony and parking when the plan shows them
- basic materials
- daylight and interior light
- orbit controls
- walkable navigation (look around, WASD to move, collision with walls, movement up stairs)

## 9. Visual quality bar

The picture has to communicate the house, not the drawing.

From outside: a calm modern building, with a readable roof, openings, ground, and shadow.

From inside: distinct rooms, floors underfoot, light from windows and rooms, doors you can pass, and a stair you can climb.

A flat single-colour box with one opening does not meet this bar, even if the pipeline from plan to JSON to mesh is working.

## 10. Explicitly out of scope

- house design generation
- floor-plan generation
- architectural review
- Vastu
- structural analysis
- construction estimation
- CAD editor
- furniture designer
- architect assistant
- user accounts
- payments
- collaboration
- a mobile application
- dashboards

## 11. V1 is done when

- A sample architect PDF and an uploaded PDF, PNG, or JPG each produce a House model.
- The 3D scene is built only from that model.
- The person can orbit the house and walk through the rooms that the plan described.
- The result looks like their house, at the quality in section 9.
