import type { CatalogItem, PlacedFurniture, Point } from "./types";

/**
 * Returns the world-space bounding box corners of a piece of furniture, accounting for rotation.
 * For l-shape pieces, returns the bounding rectangle (useful for hit-tests / coarse clearance).
 * Use {@link footprintPolygon} for the actual L-shaped polygon.
 */
export function boundingCorners(item: PlacedFurniture, catalog: CatalogItem): Point[] {
  const w = (item.widthOverride ?? catalog.width) / 2;
  const d = (item.depthOverride ?? catalog.depth) / 2;
  const local: Point[] = [
    { x: -w, y: -d },
    { x: w, y: -d },
    { x: w, y: d },
    { x: -w, y: d },
  ];
  const r = (item.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return local.map((p) => ({
    x: item.x + p.x * cos - p.y * sin,
    y: item.y + p.x * sin + p.y * cos,
  }));
}

/**
 * Footprint polygon in world coords. For rect/circle returns 4 corners (axis-aligned box approx).
 * For L-shape returns 6 points cutting a notch from the top-right corner.
 */
export function footprintPolygon(item: PlacedFurniture, catalog: CatalogItem): Point[] {
  const w = (item.widthOverride ?? catalog.width) / 2;
  const d = (item.depthOverride ?? catalog.depth) / 2;
  let local: Point[];
  if (catalog.shape === "l-shape" && catalog.lShape) {
    const nw = catalog.lShape.notchWidth;
    const nd = catalog.lShape.notchDepth;
    // Cut a notch from the top-right corner. World convention: +x right, +y down.
    local = [
      { x: -w, y: -d },
      { x: w - nw, y: -d },
      { x: w - nw, y: -d + nd },
      { x: w, y: -d + nd },
      { x: w, y: d },
      { x: -w, y: d },
    ];
  } else {
    local = [
      { x: -w, y: -d },
      { x: w, y: -d },
      { x: w, y: d },
      { x: -w, y: d },
    ];
  }
  const r = (item.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return local.map((p) => ({
    x: item.x + p.x * cos - p.y * sin,
    y: item.y + p.x * sin + p.y * cos,
  }));
}

/** Shortest distance between two convex polygons. 0 if they overlap. */
export function polygonDistance(a: Point[], b: Point[]): number {
  if (polygonsIntersect(a, b)) return 0;
  let min = Infinity;
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i];
    const a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const b1 = b[j];
      const b2 = b[(j + 1) % b.length];
      const d = segmentSegmentDistance(a1, a2, b1, b2);
      if (d < min) min = d;
    }
  }
  return min;
}

function segmentSegmentDistance(p1: Point, p2: Point, p3: Point, p4: Point): number {
  // If segments intersect, distance is 0
  if (segmentsIntersect(p1, p2, p3, p4)) return 0;
  return Math.min(
    pointToSegmentDistance(p1, p3, p4),
    pointToSegmentDistance(p2, p3, p4),
    pointToSegmentDistance(p3, p1, p2),
    pointToSegmentDistance(p4, p1, p2),
  );
}

function pointToSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const x = a.x + t * dx;
  const y = a.y + t * dy;
  return Math.hypot(p.x - x, p.y - y);
}

function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1 = direction(p3, p4, p1);
  const d2 = direction(p3, p4, p2);
  const d3 = direction(p1, p2, p3);
  const d4 = direction(p1, p2, p4);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  if (d1 === 0 && onSegment(p3, p4, p1)) return true;
  if (d2 === 0 && onSegment(p3, p4, p2)) return true;
  if (d3 === 0 && onSegment(p1, p2, p3)) return true;
  if (d4 === 0 && onSegment(p1, p2, p4)) return true;
  return false;
}

function direction(a: Point, b: Point, c: Point): number {
  return (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y);
}

function onSegment(a: Point, b: Point, c: Point): boolean {
  return (
    Math.min(a.x, b.x) <= c.x &&
    c.x <= Math.max(a.x, b.x) &&
    Math.min(a.y, b.y) <= c.y &&
    c.y <= Math.max(a.y, b.y)
  );
}

function polygonsIntersect(a: Point[], b: Point[]): boolean {
  // Quick check: any point of a inside b, or vice versa, or any edges cross.
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

/** Distance between two points in pixels. */
export function pxDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
