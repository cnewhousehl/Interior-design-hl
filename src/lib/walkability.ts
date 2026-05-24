import { getCatalogItem } from "./catalog";
import { footprintPolygon, polygonDistance } from "./geometry";
import type { FurnitureCategory, PlacedFurniture, Room, Point } from "./types";

type FurnPoly = { poly: Point[]; category: FurnitureCategory };

/**
 * Quick-and-dirty walkability score: sample a coarse grid of points inside
 * each room polygon, count how many are at least `minClearanceFt` away from
 * the nearest piece of furniture. Score = (free samples / total samples) * 100.
 *
 * Not rigorous, but enough to flag a room that's been over-furnished.
 */
export function computeWalkability(opts: {
  placed: PlacedFurniture[];
  rooms: Room[];
  minClearanceFt?: number;
  gridStepFt?: number;
}): { roomId: string; roomName: string; score: number; samples: number; free: number }[] {
  const minClearance = opts.minClearanceFt ?? 1.5;
  const step = opts.gridStepFt ?? 1;

  const polys: FurnPoly[] = [];
  for (const p of opts.placed) {
    if (p.hidden) continue;
    const cat = getCatalogItem(p.catalogId);
    if (!cat) continue;
    if (cat.category === "rugs") continue;
    const poly = footprintPolygon(p, cat);
    if (!poly.length) continue;
    polys.push({ poly, category: cat.category });
  }

  return opts.rooms.map((room) => {
    if (!room.polygon.length) return { roomId: room.id, roomName: room.name, score: 100, samples: 0, free: 0 };
    const xs = room.polygon.map((p) => p.x);
    const ys = room.polygon.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    let total = 0;
    let free = 0;
    for (let x = minX; x <= maxX; x += step) {
      for (let y = minY; y <= maxY; y += step) {
        if (!pointInPolygon({ x, y }, room.polygon)) continue;
        total++;
        // Distance from the point to every furniture poly
        const samplePoly = [{ x, y }];
        let clear = true;
        for (const { poly } of polys) {
          if (polygonDistance(samplePoly, poly) < minClearance) {
            clear = false;
            break;
          }
        }
        if (clear) free++;
      }
    }
    const score = total === 0 ? 100 : Math.round((free / total) * 100);
    return { roomId: room.id, roomName: room.name, score, samples: total, free };
  });
}

function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    if (((yi > p.y) !== (yj > p.y)) && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi || 1e-9) + xi) inside = !inside;
  }
  return inside;
}
