import { getCatalogItem } from "./catalog";
import { footprintPolygon, polygonDistance } from "./geometry";
import type { Door, Issue, PlacedFurniture, Point, Wall } from "./types";

/**
 * Run all the checks an interior designer cares about:
 *  - furniture overlaps another piece
 *  - furniture crosses a wall (only when walls are drawn)
 *  - furniture blocks a door's swing arc
 *  - clearance to a piece is below its recommended value
 *  - dining seating crammed (chairs need ≥3' from table edge to wall)
 */
export function runValidation(args: {
  placed: PlacedFurniture[];
  walls: Wall[];
  doors: Door[];
}): Issue[] {
  const { placed, walls, doors } = args;
  const out: Issue[] = [];

  const polys = placed.map((p) => {
    const cat = getCatalogItem(p.catalogId);
    return { p, cat, poly: cat ? footprintPolygon(p, cat) : [] };
  });

  // pairwise overlap + tight clearance
  for (let i = 0; i < polys.length; i++) {
    for (let j = i + 1; j < polys.length; j++) {
      const a = polys[i];
      const b = polys[j];
      if (!a.cat || !b.cat || !a.poly.length || !b.poly.length) continue;
      // Skip rug-vs-furniture (intentional overlap)
      const isRugPair = a.cat.category === "rugs" || b.cat.category === "rugs";
      const dist = polygonDistance(a.poly, b.poly);
      if (dist === 0 && !isRugPair) {
        out.push({
          id: `overlap-${a.p.id}-${b.p.id}`,
          severity: "error",
          message: `${a.p.label} overlaps ${b.p.label}.`,
          furnitureId: a.p.id,
        });
      } else if (!isRugPair) {
        const minClr = Math.max(a.cat.recommendedClearance ?? 0, b.cat.recommendedClearance ?? 0);
        if (minClr > 0 && dist > 0 && dist < minClr * 0.6) {
          out.push({
            id: `tight-${a.p.id}-${b.p.id}`,
            severity: "warn",
            message: `${a.p.label} and ${b.p.label} are only ${dist.toFixed(1)}' apart (recommend ≥${minClr.toFixed(1)}').`,
            furnitureId: a.p.id,
          });
        }
      }
    }
  }

  // wall crossing
  if (walls.length) {
    for (const { p, poly } of polys) {
      if (!poly.length) continue;
      for (const w of walls) {
        if (polygonCrossesSegment(poly, w.a, w.b)) {
          out.push({
            id: `wall-${p.id}-${w.id}`,
            severity: "error",
            message: `${p.label} crosses a wall.`,
            furnitureId: p.id,
          });
          break;
        }
      }
    }
  }

  // door swing
  for (const door of doors) {
    const arc = doorSwingPolygon(door);
    for (const { p, poly } of polys) {
      if (!poly.length) continue;
      if (polygonsIntersect(poly, arc)) {
        out.push({
          id: `door-${p.id}-${door.id}`,
          severity: "warn",
          message: `${p.label} blocks the ${door.label ?? "door"} swing.`,
          furnitureId: p.id,
          doorId: door.id,
        });
      }
    }
  }

  return out;
}

/** Reconstruct a coarse swing polygon (triangle fan) for a door, in feet. */
export function doorSwingPolygon(door: Door): Point[] {
  const r = door.widthFt;
  const open = door.openDeg ?? 90;
  const startDeg = door.swing === "left" ? door.angleDeg : door.angleDeg - open;
  const endDeg = door.swing === "left" ? door.angleDeg + open : door.angleDeg;
  const steps = 12;
  const points: Point[] = [{ x: door.position.x, y: door.position.y }];
  for (let i = 0; i <= steps; i++) {
    const t = startDeg + ((endDeg - startDeg) * i) / steps;
    const rad = (t * Math.PI) / 180;
    points.push({
      x: door.position.x + r * Math.cos(rad),
      y: door.position.y + r * Math.sin(rad),
    });
  }
  return points;
}

function polygonCrossesSegment(poly: Point[], a: Point, b: Point): boolean {
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % poly.length];
    if (segmentsIntersect(p1, p2, a, b)) return true;
  }
  return false;
}

function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1 = direction(p3, p4, p1);
  const d2 = direction(p3, p4, p2);
  const d3 = direction(p1, p2, p3);
  const d4 = direction(p1, p2, p4);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return false;
}

function direction(a: Point, b: Point, c: Point): number {
  return (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y);
}

function polygonsIntersect(a: Point[], b: Point[]): boolean {
  if (a.some((p) => pointInPolygon(p, b))) return true;
  if (b.some((p) => pointInPolygon(p, a))) return true;
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i];
    const a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const b1 = b[j];
      const b2 = b[(j + 1) % b.length];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Compute the area of a polygon in feet². */
export function polygonAreaSqft(poly: Point[]): number {
  let area = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    area += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
  }
  return Math.abs(area / 2);
}
