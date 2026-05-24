/**
 * Compute a stylized sun path for a small-room overlay. This is intentionally
 * coarse — we don't take latitude/longitude/date as inputs; instead we draw an
 * arc that approximates a generic mid-latitude summer day, with the user's
 * `northDeg` rotating the geometry to match their floor plan's orientation.
 */
import type { Point } from "./types";

export type SunMark = { position: Point; label: string; intensity: number };

export function computeSunArc(opts: {
  centerFt: Point;
  radiusFt: number;
  northDeg: number;
}): { arcPath: Point[]; marks: SunMark[] } {
  const { centerFt, radiusFt, northDeg } = opts;
  // Sun arcs roughly East → South → West (in northern hemisphere), spanning
  // azimuth 90° → 180° → 270° measured clockwise from north.
  const points: Point[] = [];
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Azimuth from 90° (sunrise) to 270° (sunset) — center of arc at 180° (south)
    const azimuth = 90 + t * 180; // clockwise from north in scene's compass
    // Plate the azimuth onto scene coordinates: rotate by -northDeg (scene "up" may not be north)
    const sceneAngleDeg = azimuth - northDeg;
    // For arc shape, we make it a half-ellipse so it visually arcs upward
    const azRad = (sceneAngleDeg * Math.PI) / 180;
    const altRad = Math.sin(t * Math.PI) * (Math.PI / 4); // up to ~45° altitude
    // Project onto plan view: x toward azimuth, y inversely with altitude (so arc bulges)
    const horiz = Math.cos(altRad) * radiusFt;
    const x = centerFt.x + horiz * Math.sin(azRad);
    const y = centerFt.y - horiz * Math.cos(azRad);
    points.push({ x, y });
  }
  // Sample 3 marks: morning (t=0.15), noon (t=0.5), afternoon (t=0.85)
  const marks: SunMark[] = [0.15, 0.5, 0.85].map((t) => {
    const idx = Math.round(t * steps);
    return {
      position: points[idx],
      label: t < 0.3 ? "9am" : t < 0.7 ? "noon" : "4pm",
      intensity: t < 0.3 || t > 0.7 ? 0.6 : 1,
    };
  });
  return { arcPath: points, marks };
}
