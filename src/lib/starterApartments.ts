import type { Door, Room, Wall, FloorPlan } from "./types";

/**
 * Starter apartment templates — walls + rooms + doors only, no furniture.
 * Used as a "blank canvas" alternative for users who don't have a floor plan
 * image: pick a typical apartment shape and start placing furniture in feet.
 *
 * Coordinates are in feet, top-left of the canvas at (0, 0).
 */
export type StarterApartment = {
  id: string;
  name: string;
  description: string;
  widthFt: number;
  depthFt: number;
  walls: Omit<Wall, "id">[];
  doors: Omit<Door, "id">[];
  rooms: Omit<Room, "id">[];
};

export const STARTER_APARTMENTS: StarterApartment[] = [
  {
    id: "studio-400",
    name: "Studio · 400 sqft",
    description: "Single rectangular room with a bathroom. Typical NYC studio.",
    widthFt: 20,
    depthFt: 22,
    walls: [
      // perimeter
      { a: { x: 0, y: 0 }, b: { x: 20, y: 0 }, thicknessFt: 0.5 },
      { a: { x: 20, y: 0 }, b: { x: 20, y: 22 }, thicknessFt: 0.5 },
      { a: { x: 20, y: 22 }, b: { x: 0, y: 22 }, thicknessFt: 0.5 },
      { a: { x: 0, y: 22 }, b: { x: 0, y: 0 }, thicknessFt: 0.5 },
      // bathroom partition (bottom-right corner)
      { a: { x: 14, y: 22 }, b: { x: 14, y: 16 }, thicknessFt: 0.4 },
      { a: { x: 14, y: 16 }, b: { x: 20, y: 16 }, thicknessFt: 0.4 },
    ],
    doors: [
      { position: { x: 4, y: 22 }, widthFt: 3, angleDeg: 180, swing: "right", openDeg: 90, label: "Entry" },
      { position: { x: 17, y: 16 }, widthFt: 2.5, angleDeg: 0, swing: "left", openDeg: 90, label: "Bathroom" },
    ],
    rooms: [
      { name: "Living / Sleep", polygon: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 16 }, { x: 14, y: 16 }, { x: 14, y: 22 }, { x: 0, y: 22 }] },
      { name: "Bathroom", polygon: [{ x: 14, y: 16 }, { x: 20, y: 16 }, { x: 20, y: 22 }, { x: 14, y: 22 }] },
    ],
  },
  {
    id: "1br-600",
    name: "1-Bedroom · 600 sqft",
    description: "Open living / dining / kitchen + bedroom + bathroom.",
    widthFt: 22,
    depthFt: 28,
    walls: [
      { a: { x: 0, y: 0 }, b: { x: 22, y: 0 }, thicknessFt: 0.5 },
      { a: { x: 22, y: 0 }, b: { x: 22, y: 28 }, thicknessFt: 0.5 },
      { a: { x: 22, y: 28 }, b: { x: 0, y: 28 }, thicknessFt: 0.5 },
      { a: { x: 0, y: 28 }, b: { x: 0, y: 0 }, thicknessFt: 0.5 },
      // bedroom wall
      { a: { x: 0, y: 17 }, b: { x: 13, y: 17 }, thicknessFt: 0.4 },
      { a: { x: 13, y: 17 }, b: { x: 13, y: 28 }, thicknessFt: 0.4 },
      // bathroom
      { a: { x: 16, y: 17 }, b: { x: 22, y: 17 }, thicknessFt: 0.4 },
      { a: { x: 16, y: 17 }, b: { x: 16, y: 23 }, thicknessFt: 0.4 },
      { a: { x: 16, y: 23 }, b: { x: 22, y: 23 }, thicknessFt: 0.4 },
    ],
    doors: [
      { position: { x: 19, y: 28 }, widthFt: 3, angleDeg: 180, swing: "left", openDeg: 90, label: "Entry" },
      { position: { x: 11, y: 17 }, widthFt: 2.83, angleDeg: 0, swing: "right", openDeg: 90, label: "Bedroom" },
      { position: { x: 19, y: 17 }, widthFt: 2.5, angleDeg: 0, swing: "right", openDeg: 90, label: "Bathroom" },
    ],
    rooms: [
      { name: "Living / Dining / Kitchen", polygon: [{ x: 0, y: 0 }, { x: 22, y: 0 }, { x: 22, y: 17 }, { x: 0, y: 17 }] },
      { name: "Bedroom", polygon: [{ x: 0, y: 17 }, { x: 13, y: 17 }, { x: 13, y: 28 }, { x: 0, y: 28 }] },
      { name: "Bathroom", polygon: [{ x: 16, y: 17 }, { x: 22, y: 17 }, { x: 22, y: 23 }, { x: 16, y: 23 }] },
      { name: "Hall", polygon: [{ x: 13, y: 17 }, { x: 22, y: 17 }, { x: 22, y: 28 }, { x: 13, y: 28 }, { x: 13, y: 23 }, { x: 16, y: 23 }, { x: 16, y: 17 }] },
    ],
  },
  {
    id: "2br-900",
    name: "2-Bedroom · 900 sqft",
    description: "Living + kitchen + 2 bedrooms + 1.5 baths.",
    widthFt: 30,
    depthFt: 30,
    walls: [
      { a: { x: 0, y: 0 }, b: { x: 30, y: 0 }, thicknessFt: 0.5 },
      { a: { x: 30, y: 0 }, b: { x: 30, y: 30 }, thicknessFt: 0.5 },
      { a: { x: 30, y: 30 }, b: { x: 0, y: 30 }, thicknessFt: 0.5 },
      { a: { x: 0, y: 30 }, b: { x: 0, y: 0 }, thicknessFt: 0.5 },
      // kitchen partition
      { a: { x: 18, y: 0 }, b: { x: 18, y: 8 }, thicknessFt: 0.4 },
      { a: { x: 18, y: 8 }, b: { x: 30, y: 8 }, thicknessFt: 0.4 },
      // bedrooms wall
      { a: { x: 0, y: 18 }, b: { x: 30, y: 18 }, thicknessFt: 0.4 },
      // bedroom divider
      { a: { x: 14, y: 18 }, b: { x: 14, y: 30 }, thicknessFt: 0.4 },
      // bathrooms
      { a: { x: 18, y: 8 }, b: { x: 22, y: 8 }, thicknessFt: 0.4 },
      { a: { x: 22, y: 8 }, b: { x: 22, y: 14 }, thicknessFt: 0.4 },
      { a: { x: 22, y: 14 }, b: { x: 30, y: 14 }, thicknessFt: 0.4 },
    ],
    doors: [
      { position: { x: 26, y: 30 }, widthFt: 3, angleDeg: 180, swing: "left", openDeg: 90, label: "Entry" },
      { position: { x: 18, y: 4 }, widthFt: 2.83, angleDeg: 90, swing: "right", openDeg: 90, label: "Kitchen" },
      { position: { x: 6, y: 18 }, widthFt: 2.83, angleDeg: 0, swing: "left", openDeg: 90, label: "BR 1" },
      { position: { x: 22, y: 18 }, widthFt: 2.83, angleDeg: 0, swing: "right", openDeg: 90, label: "BR 2" },
      { position: { x: 20, y: 8 }, widthFt: 2.33, angleDeg: 90, swing: "left", openDeg: 90, label: "Half bath" },
      { position: { x: 26, y: 14 }, widthFt: 2.5, angleDeg: 0, swing: "left", openDeg: 90, label: "Full bath" },
    ],
    rooms: [
      { name: "Living / Dining", polygon: [{ x: 0, y: 0 }, { x: 18, y: 0 }, { x: 18, y: 18 }, { x: 0, y: 18 }] },
      { name: "Kitchen", polygon: [{ x: 18, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 8 }, { x: 18, y: 8 }] },
      { name: "Half bath", polygon: [{ x: 18, y: 8 }, { x: 22, y: 8 }, { x: 22, y: 14 }, { x: 18, y: 14 }] },
      { name: "Full bath", polygon: [{ x: 22, y: 8 }, { x: 30, y: 8 }, { x: 30, y: 14 }, { x: 22, y: 14 }] },
      { name: "Hall", polygon: [{ x: 18, y: 14 }, { x: 30, y: 14 }, { x: 30, y: 18 }, { x: 18, y: 18 }] },
      { name: "Bedroom 1", polygon: [{ x: 0, y: 18 }, { x: 14, y: 18 }, { x: 14, y: 30 }, { x: 0, y: 30 }] },
      { name: "Bedroom 2", polygon: [{ x: 14, y: 18 }, { x: 30, y: 18 }, { x: 30, y: 30 }, { x: 14, y: 30 }] },
    ],
  },
  {
    id: "loft-700",
    name: "Loft · 700 sqft",
    description: "Open plan loft with mezzanine sleep area.",
    widthFt: 24,
    depthFt: 30,
    walls: [
      { a: { x: 0, y: 0 }, b: { x: 24, y: 0 }, thicknessFt: 0.5 },
      { a: { x: 24, y: 0 }, b: { x: 24, y: 30 }, thicknessFt: 0.5 },
      { a: { x: 24, y: 30 }, b: { x: 0, y: 30 }, thicknessFt: 0.5 },
      { a: { x: 0, y: 30 }, b: { x: 0, y: 0 }, thicknessFt: 0.5 },
      // bathroom only
      { a: { x: 18, y: 24 }, b: { x: 24, y: 24 }, thicknessFt: 0.4 },
      { a: { x: 18, y: 24 }, b: { x: 18, y: 30 }, thicknessFt: 0.4 },
    ],
    doors: [
      { position: { x: 4, y: 30 }, widthFt: 3, angleDeg: 180, swing: "right", openDeg: 90, label: "Entry" },
      { position: { x: 20, y: 24 }, widthFt: 2.5, angleDeg: 0, swing: "left", openDeg: 90, label: "Bathroom" },
    ],
    rooms: [
      { name: "Open plan", polygon: [{ x: 0, y: 0 }, { x: 24, y: 0 }, { x: 24, y: 24 }, { x: 18, y: 24 }, { x: 18, y: 30 }, { x: 0, y: 30 }] },
      { name: "Bathroom", polygon: [{ x: 18, y: 24 }, { x: 24, y: 24 }, { x: 24, y: 30 }, { x: 18, y: 30 }] },
    ],
  },
];

/** Create a synthetic floor plan that draws the apartment outline as a PNG data URL. */
export function renderStarterToFloorPlan(s: StarterApartment): FloorPlan {
  const margin = 30;
  const pxPerFt = 20;
  const width = Math.round(s.widthFt * pxPerFt) + margin * 2;
  const height = Math.round(s.depthFt * pxPerFt) + margin * 2;
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#faf6ee";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#1c1917";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  // Draw walls
  for (const w of s.walls) {
    ctx.beginPath();
    ctx.moveTo(margin + w.a.x * pxPerFt, margin + w.a.y * pxPerFt);
    ctx.lineTo(margin + w.b.x * pxPerFt, margin + w.b.y * pxPerFt);
    ctx.stroke();
  }
  // Label rooms
  ctx.fillStyle = "rgba(120, 113, 108, 0.85)";
  ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  for (const r of s.rooms) {
    const cx = r.polygon.reduce((sum, p) => sum + p.x, 0) / r.polygon.length;
    const cy = r.polygon.reduce((sum, p) => sum + p.y, 0) / r.polygon.length;
    ctx.fillText(r.name, margin + cx * pxPerFt, margin + cy * pxPerFt);
  }
  return {
    imageDataUrl: c.toDataURL("image/png"),
    imagePxWidth: width,
    imagePxHeight: height,
    pixelsPerFoot: pxPerFt,
    calibration: {
      p1: { x: margin, y: margin },
      p2: { x: margin + s.widthFt * pxPerFt, y: margin },
      realDistanceFeet: s.widthFt,
    },
  };
}
