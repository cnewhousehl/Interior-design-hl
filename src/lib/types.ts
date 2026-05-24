export type Point = { x: number; y: number };

export type FurnitureCategory =
  | "seating"
  | "tables"
  | "beds"
  | "storage"
  | "rugs"
  | "lighting"
  | "misc";

export type FurnitureShape = "rect" | "circle" | "l-shape";

export type Theme =
  | "mid-century-modern"
  | "scandi"
  | "industrial"
  | "japandi"
  | "coastal"
  | "boho"
  | "modern-farmhouse"
  | "minimalist"
  | "art-deco";

export const ALL_THEMES: { id: Theme; label: string; description: string }[] = [
  { id: "mid-century-modern", label: "Mid-century modern", description: "Walnut, tapered legs, clean lines, mustard/teal accents." },
  { id: "scandi", label: "Scandinavian", description: "Light woods, white walls, cozy textiles, functional." },
  { id: "industrial", label: "Industrial", description: "Black metal, leather, exposed wood, edison bulbs." },
  { id: "japandi", label: "Japandi", description: "Low-profile, natural wood, muted tones, minimal." },
  { id: "coastal", label: "Coastal", description: "Whites, blues, linen, rattan, breezy." },
  { id: "boho", label: "Boho", description: "Layered rugs, plants, warm earthy tones, eclectic." },
  { id: "modern-farmhouse", label: "Modern farmhouse", description: "Shaker, distressed wood, neutral palette." },
  { id: "minimalist", label: "Minimalist", description: "Monochrome, few pieces, lots of negative space." },
  { id: "art-deco", label: "Art deco", description: "Brass, velvet, geometric patterns, jewel tones." },
];

/**
 * A piece of furniture as defined in the catalog. Dimensions are real-world (feet).
 * `lShape` describes the cutout for L-shaped pieces, measured from the bottom-left corner.
 */
export type CatalogItem = {
  id: string;
  name: string;
  category: FurnitureCategory;
  shape: FurnitureShape;
  width: number; // feet (along local X)
  depth: number; // feet (along local Y)
  themes: Theme[];
  color: string;
  // For l-shape: a notch cut from the top-right corner with these dimensions
  lShape?: { notchWidth: number; notchDepth: number };
  // Recommended clearance around the piece in feet (for traffic/seating zones)
  recommendedClearance?: number;
  description?: string;
};

/**
 * An instance of furniture placed on the canvas.
 * Position is in real-world feet (scene coordinates), measured at the piece's center.
 * Rotation is in degrees, clockwise.
 */
export type FurnitureStatus = "owned" | "wishlist" | "ordered" | "considering";

export type PlacedFurniture = {
  id: string;
  catalogId: string;
  label: string;
  x: number; // feet, scene coords
  y: number; // feet, scene coords
  rotation: number; // degrees
  // Optional override of catalog dimensions (e.g. user resized their actual couch)
  widthOverride?: number;
  depthOverride?: number;
  status?: FurnitureStatus;
  priceUsd?: number;
  notes?: string;
  colorOverride?: string;
};

/** A wall segment between two points (in feet, scene coords). */
export type Wall = {
  id: string;
  a: Point;
  b: Point;
  thicknessFt?: number; // default ~0.4
};

/** A door anchored on a wall, with a swing arc. */
export type Door = {
  id: string;
  position: Point; // hinge point in feet, scene coords
  widthFt: number;
  angleDeg: number; // angle of the wall the door sits in
  swing: "left" | "right";
  openDeg?: number; // how far open to display, default 90
  label?: string;
};

/** A window on a wall (visual only — doesn't constrain furniture). */
export type WindowOpening = {
  id: string;
  position: Point;
  widthFt: number;
  angleDeg: number;
  label?: string;
};

/** A room polygon (auto-built from walls, or drawn). */
export type Room = {
  id: string;
  name: string;
  polygon: Point[]; // feet, scene coords, clockwise
  color?: string;
};

/** Measurement / note annotations on the canvas. */
export type Annotation =
  | { id: string; type: "measure"; a: Point; b: Point }
  | { id: string; type: "note"; position: Point; text: string };

/** A complete saved layout that can be persisted/restored. */
export type SavedLayout = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  floorPlan: FloorPlan | null;
  placed: PlacedFurniture[];
  walls: Wall[];
  doors: Door[];
  windows: WindowOpening[];
  rooms: Room[];
  annotations: Annotation[];
  theme: Theme | null;
  northDeg: number; // compass orientation of "up" in degrees clockwise from north
};

export type CalibrationPoints = {
  p1: Point; // pixel coordinates on the source image
  p2: Point;
  realDistanceFeet: number;
};

export type FloorPlan = {
  imageDataUrl: string;
  imagePxWidth: number;
  imagePxHeight: number;
  // pixels per foot. null until calibrated.
  pixelsPerFoot: number | null;
  calibration: CalibrationPoints | null;
};

export type ToolMode =
  | "select"
  | "place" // user has selected a catalog item and is placing it
  | "calibrate" // user is clicking 2 points on the floor plan to set scale
  | "draw-wall"
  | "draw-door"
  | "draw-window"
  | "measure"
  | "note";

export type ClearanceMode = "off" | "all" | "selected";

export type Issue = {
  id: string;
  severity: "error" | "warn" | "info";
  message: string;
  furnitureId?: string;
  doorId?: string;
};
