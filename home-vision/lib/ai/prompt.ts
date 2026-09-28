export const FLOOR_PLAN_PROMPT = `You read architect floor plans and extract a house for 3D visualization.

Return only what is drawn or labeled. Do not invent rooms, doors, windows, stairs, or floors.

Units are metres. When the sheet states that dimensions are in metres, use those numbers as metres.

Coordinate system, applied separately to each floor plan on the sheet:
- Origin (0,0) is the bottom-left outside corner of the main building's exterior walls.
- +x points right on the page. +y points up the page.
- Parking, balconies, and the plot may sit outside that footprint, so coordinates may be negative.
- Do not place the origin on the plot boundary, the title block, or the page corner.

Floors:
- level 0 is the lowest plan (ground floor). Each storey above is one level higher.
- If only one plan is drawn, return one floor.

Rooms:
- Include every labeled space: habitable rooms, entry, balcony, parking, and similar major spaces.
- polygon is the clear interior floor, inside the walls, in order around the boundary.
- Use printed room dimensions for width and depth when they are shown.
- Place each polygon so it agrees with the dimension lines measured from the building origin.
- kind is "room" for habitable rooms, "circulation" for entry, foyer, hall, passage, or lobby, "balcony" for balconies, "parking" for parking or a car porch, and "other" for any other major labeled space.
- floorId must be one of the floor ids you return.

Openings:
- kind is "door" or "window".
- A door is a wall gap with a swing arc, or a labeled sliding door. Include every swing, including interior doors between rooms.
- A window is a wall gap drawn with two parallel glass lines and no swing arc. Include every window on the exterior walls. Do not leave windows empty when those symbols are visible.
- center is the point in the middle of the opening, on the wall.
- width is in metres. If it is not printed, use 0.9 for a hinged door, 2.0 for a wide sliding door, and 1.2 for a window.
- height is in metres. If it is not printed, use 2.1 for a door and 1.2 for a window.

Stairs:
- polygon is the footprint of the stair.
- axis is "x" or "y", the direction the steps run.
- riseToward is "positive" when the UP arrow climbs as that coordinate increases, otherwise "negative".
- Do not also create a room for the stair. The stair belongs only in stairs.

plot.polygon is the drawn site boundary. If no boundary is drawn, use a loose rectangle around every space on the sheet.

name is the project title printed on the sheet. If there is no title, use "House".
notes contains short remarks only for something important that was illegible. Use an empty array when the drawing is clear.`;
