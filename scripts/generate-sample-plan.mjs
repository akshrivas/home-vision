import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const S = 36;
const ox = 86;
const oy = 228;
const black = rgb(0.1, 0.1, 0.1);
const white = rgb(1, 1, 1);
const gray = rgb(0.28, 0.28, 0.28);
const wash = rgb(0.94, 0.94, 0.94);

const doc = await PDFDocument.create();
const page = doc.addPage([1190.55, 841.89]);
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);

const X = (x) => ox + x * S;
const Y = (y) => oy + y * S;

page.drawRectangle({
  x: 24,
  y: 24,
  width: page.getWidth() - 48,
  height: page.getHeight() - 48,
  borderColor: black,
  borderWidth: 1.1,
  color: white,
});

page.drawText("SAMPLE RESIDENCE", { x: 48, y: 792, size: 18, font: bold, color: black });
page.drawText("GROUND FLOOR PLAN", { x: 48, y: 772, size: 11, font, color: black });
page.drawText("SCALE 1:100    ALL DIMENSIONS IN METRES    ROOM SIZES ARE CLEAR INTERNAL DIMENSIONS", {
  x: 48,
  y: 754,
  size: 8,
  font,
  color: gray,
});

function rect(x, y, w, h, color = black) {
  page.drawRectangle({ x: X(x), y: Y(y), width: w * S, height: h * S, color, borderWidth: 0 });
}

function line(x1, y1, x2, y2, thickness = 0.8, color = black) {
  page.drawLine({
    start: { x: X(x1), y: Y(y1) },
    end: { x: X(x2), y: Y(y2) },
    thickness,
    color,
  });
}

function dashed(x1, y1, x2, y2) {
  const px1 = X(x1);
  const py1 = Y(y1);
  const px2 = X(x2);
  const py2 = Y(y2);
  const length = Math.hypot(px2 - px1, py2 - py1);
  const dx = (px2 - px1) / length;
  const dy = (py2 - py1) / length;
  for (let traveled = 0; traveled < length; traveled += 11) {
    const end = Math.min(length, traveled + 6);
    page.drawLine({
      start: { x: px1 + dx * traveled, y: py1 + dy * traveled },
      end: { x: px1 + dx * end, y: py1 + dy * end },
      thickness: 0.7,
      color: gray,
    });
  }
}

function label(name, sizeText, x, y, w, h) {
  const nameSize = fit(bold, name, w * S - 10, 12);
  const sizeSize = fit(font, sizeText, w * S - 10, 8);
  const nameWidth = bold.widthOfTextAtSize(name, nameSize);
  const sizeWidth = font.widthOfTextAtSize(sizeText, sizeSize);
  page.drawText(name, {
    x: X(x + w / 2) - nameWidth / 2,
    y: Y(y + h / 2) + 2,
    size: nameSize,
    font: bold,
    color: black,
  });
  page.drawText(sizeText, {
    x: X(x + w / 2) - sizeWidth / 2,
    y: Y(y + h / 2) - 12,
    size: sizeSize,
    font,
    color: gray,
  });
}

function fit(face, text, maxWidth, size) {
  let next = size;
  while (next > 6.5 && face.widthOfTextAtSize(text, next) > maxWidth) next -= 0.5;
  return next;
}

function dim(x1, y1, x2, y2, text) {
  line(x1, y1, x2, y2, 0.6, gray);
  const horizontal = Math.abs(y1 - y2) < 0.01;
  if (horizontal) {
    line(x1, y1 - 0.12, x1, y1 + 0.12, 0.6, gray);
    line(x2, y2 - 0.12, x2, y2 + 0.12, 0.6, gray);
    const width = font.widthOfTextAtSize(text, 8);
    page.drawText(text, { x: X((x1 + x2) / 2) - width / 2, y: Y(y1) + 4, size: 8, font, color: black });
  } else {
    line(x1 - 0.12, y1, x1 + 0.12, y1, 0.6, gray);
    line(x2 - 0.12, y2, x2 + 0.12, y2, 0.6, gray);
    page.drawText(text, { x: X(x1) + 4, y: Y((y1 + y2) / 2) - 3, size: 8, font, color: black });
  }
}

function windowOpening(x, y, w, h, horizontal) {
  rect(x, y, w, h, white);
  if (horizontal) {
    line(x, y + h * 0.38, x + w, y + h * 0.38, 1.3);
    line(x, y + h * 0.62, x + w, y + h * 0.62, 1.3);
    line(x, y, x, y + h, 1);
    line(x + w, y, x + w, y + h, 1);
  } else {
    line(x + w * 0.38, y, x + w * 0.38, y + h, 1.3);
    line(x + w * 0.62, y, x + w * 0.62, y + h, 1.3);
    line(x, y, x + w, y, 1);
    line(x, y + h, x + w, y + h, 1);
  }
}

function door(x, y, w, h, hingeX, hingeY, angle, sweep, width) {
  rect(x, y, w, h, white);
  line(hingeX, hingeY, hingeX + Math.cos(angle + sweep) * width, hingeY + Math.sin(angle + sweep) * width, 1);
  const steps = 14;
  for (let index = 1; index <= steps; index += 1) {
    const a0 = angle + sweep * ((index - 1) / steps);
    const a1 = angle + sweep * (index / steps);
    line(
      hingeX + Math.cos(a0) * width,
      hingeY + Math.sin(a0) * width,
      hingeX + Math.cos(a1) * width,
      hingeY + Math.sin(a1) * width,
      0.7,
      gray,
    );
  }
}

const plot = { x: -1.6, y: -5.4, w: 18, h: 17 };
dashed(plot.x, plot.y, plot.x + plot.w, plot.y);
dashed(plot.x + plot.w, plot.y, plot.x + plot.w, plot.y + plot.h);
dashed(plot.x + plot.w, plot.y + plot.h, plot.x, plot.y + plot.h);
dashed(plot.x, plot.y + plot.h, plot.x, plot.y);
page.drawText("PLOT BOUNDARY", { x: X(plot.x + 0.2), y: Y(plot.y + plot.h) + 6, size: 8, font, color: gray });

rect(0.2, -4.3, 6.2, 3.5, wash);
line(0.2, -4.3, 6.4, -4.3, 0.8, gray);
line(6.4, -4.3, 6.4, -0.8, 0.8, gray);
line(6.4, -0.8, 0.2, -0.8, 0.8, gray);
line(0.2, -0.8, 0.2, -4.3, 0.8, gray);
label("PARKING", "6.20 x 3.50 m", 0.2, -4.3, 6.2, 3.5);

rect(0, 0, 15, 9, black);
rect(0.2, 0.2, 14.6, 8.6, white);
rect(4.5, 0.2, 0.15, 4.3, black);
rect(8.5, 0.2, 0.15, 8.6, black);
rect(0.2, 4.5, 14.6, 0.15, black);
rect(12.2, 4.65, 0.15, 4.15, black);

rect(0.2, 9, 8.3, 1.25, wash);
line(0.2, 10.25, 8.5, 10.25, 1.1);
line(0.2, 9, 0.2, 10.25, 1.1);
line(8.5, 9, 8.5, 10.25, 1.1);
label("BALCONY", "8.30 x 1.25 m", 0.2, 9, 8.3, 1.25);

const stair = { x: 6.35, y: 0.85, w: 1.95, h: 3.15 };
line(stair.x, stair.y, stair.x + stair.w, stair.y, 1);
line(stair.x + stair.w, stair.y, stair.x + stair.w, stair.y + stair.h, 1);
line(stair.x + stair.w, stair.y + stair.h, stair.x, stair.y + stair.h, 1);
line(stair.x, stair.y + stair.h, stair.x, stair.y, 1);
for (let y = stair.y + 0.28; y < stair.y + stair.h - 0.05; y += 0.28) line(stair.x, y, stair.x + stair.w, y, 0.55);
line(stair.x + stair.w / 2, stair.y + 0.35, stair.x + stair.w / 2, stair.y + stair.h - 0.25, 1.1);
line(stair.x + stair.w / 2, stair.y + stair.h - 0.25, stair.x + stair.w / 2 - 0.18, stair.y + stair.h - 0.55, 1.1);
line(stair.x + stair.w / 2, stair.y + stair.h - 0.25, stair.x + stair.w / 2 + 0.18, stair.y + stair.h - 0.55, 1.1);
page.drawText("STAIR", {
  x: X(stair.x + 0.35),
  y: Y(stair.y + stair.h / 2) + 4,
  size: 8,
  font: bold,
  color: black,
});
page.drawText("UP", {
  x: X(stair.x + 0.55),
  y: Y(stair.y + stair.h / 2) - 8,
  size: 8,
  font,
  color: black,
});

door(4.95, 0, 1.0, 0.2, 4.95, 0.2, 0, Math.PI / 2, 1);
door(4.5, 1.7, 0.15, 0.9, 4.65, 1.7, Math.PI / 2, -Math.PI / 2, 0.9);
door(5.3, 4.5, 1.1, 0.15, 5.3, 4.65, 0, Math.PI / 2, 1.1);
door(8.5, 1.8, 0.15, 0.9, 8.65, 1.8, Math.PI / 2, -Math.PI / 2, 0.9);
door(9.3, 4.5, 0.9, 0.15, 9.3, 4.65, 0, Math.PI / 2, 0.9);
door(12.2, 6.1, 0.15, 0.8, 12.35, 6.1, Math.PI / 2, -Math.PI / 2, 0.8);
windowOpening(2.5, 8.8, 2.2, 0.2, true);
page.drawText("SLIDING", { x: X(2.85), y: Y(8.35), size: 7, font, color: gray });

windowOpening(0, 6.05, 0.2, 1.7, false);
windowOpening(0, 1.55, 0.2, 1.5, false);
windowOpening(1.15, 0, 1.5, 0.2, true);
windowOpening(10.7, 0, 1.8, 0.2, true);
windowOpening(14.8, 1.5, 0.2, 1.8, false);
windowOpening(9.2, 8.8, 1.6, 0.2, true);
windowOpening(14.8, 6.15, 0.2, 1.0, false);

label("KITCHEN", "4.30 x 4.30 m", 0.2, 0.2, 4.3, 4.3);
label("ENTRY", "3.85 x 4.30 m", 4.72, 2.15, 1.5, 1.35);
label("BEDROOM 1", "6.15 x 4.30 m", 8.65, 0.2, 6.15, 4.3);
label("LIVING", "8.30 x 4.15 m", 0.2, 4.65, 8.3, 4.15);
label("BEDROOM 2", "3.55 x 4.15 m", 8.65, 4.65, 3.55, 4.15);
label("BATH", "2.45 x 4.15 m", 12.35, 4.65, 2.45, 4.15);

dim(0, -0.7, 4.65, -0.7, "4.65");
dim(4.65, -0.7, 8.65, -0.7, "4.00");
dim(8.65, -0.7, 15, -0.7, "6.35");
dim(0, -1.45, 15, -1.45, "15.00 m");
dim(-0.85, 0, -0.85, 4.65, "4.65");
dim(-0.85, 4.65, -0.85, 9, "4.35");
dim(15.55, 0, 15.55, 9, "9.00 m");

const northX = X(16.8);
const northY = Y(6.2);
page.drawLine({ start: { x: northX, y: northY }, end: { x: northX, y: northY + 42 }, thickness: 1.2, color: black });
page.drawLine({ start: { x: northX, y: northY + 42 }, end: { x: northX - 6, y: northY + 30 }, thickness: 1.2, color: black });
page.drawLine({ start: { x: northX, y: northY + 42 }, end: { x: northX + 6, y: northY + 30 }, thickness: 1.2, color: black });
page.drawText("N", { x: northX - 4, y: northY + 48, size: 11, font: bold, color: black });

let barX = 48;
const barY = 58;
for (let index = 0; index < 5; index += 1) {
  page.drawRectangle({
    x: barX,
    y: barY,
    width: S,
    height: 8,
    color: index % 2 === 0 ? black : white,
    borderColor: black,
    borderWidth: 0.6,
  });
  barX += S;
}
page.drawText("0", { x: 46, y: 46, size: 8, font, color: black });
page.drawText("5 m", { x: 48 + 5 * S - 16, y: 46, size: 8, font, color: black });

const out = path.join(process.cwd(), "public", "samples", "floor-plan.pdf");
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, await doc.save());
console.log(out);
