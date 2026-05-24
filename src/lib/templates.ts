import type { PlacedFurniture } from "./types";

/**
 * Pre-built room kits. Each piece is positioned relative to the room's center
 * (0,0) — when the user drops a template, we translate every piece to the
 * chosen anchor point. Dimensions are in feet.
 */
export type RoomTemplate = {
  id: string;
  name: string;
  description: string;
  pieces: Omit<PlacedFurniture, "id">[];
};

export const TEMPLATES: RoomTemplate[] = [
  {
    id: "bedroom-queen-basic",
    name: "Bedroom · Queen + 2 nightstands",
    description: "Queen bed centered, nightstands flush left and right, dresser opposite.",
    pieces: [
      { catalogId: "bed-queen", label: "Queen bed", x: 0, y: 0, rotation: 0 },
      { catalogId: "nightstand", label: "Nightstand L", x: -3.5, y: -2.5, rotation: 0 },
      { catalogId: "nightstand", label: "Nightstand R", x: 3.5, y: -2.5, rotation: 0 },
      { catalogId: "dresser", label: "Dresser", x: 0, y: 6, rotation: 0 },
    ],
  },
  {
    id: "bedroom-king-full",
    name: "Bedroom · King + tallboy + chair",
    description: "King bed against a wall, tallboy, accent armchair.",
    pieces: [
      { catalogId: "bed-king", label: "King bed", x: 0, y: 0, rotation: 0 },
      { catalogId: "nightstand", label: "Nightstand L", x: -4, y: -2.5, rotation: 0 },
      { catalogId: "nightstand", label: "Nightstand R", x: 4, y: -2.5, rotation: 0 },
      { catalogId: "tallboy", label: "Tallboy", x: -5, y: 5, rotation: 0 },
      { catalogId: "armchair", label: "Accent chair", x: 4, y: 5, rotation: 180 },
    ],
  },
  {
    id: "living-room-sofa-tv",
    name: "Living · 7' sofa + coffee + TV",
    description: "Sofa, coffee table 18\" off the front, TV stand 9' opposite.",
    pieces: [
      { catalogId: "sofa-3seat-84", label: "Sofa", x: 0, y: 0, rotation: 0 },
      { catalogId: "coffee-table", label: "Coffee table", x: 0, y: 3, rotation: 0 },
      { catalogId: "tv-stand", label: "TV stand", x: 0, y: 9, rotation: 180 },
      { catalogId: "rug-8x10", label: "Area rug", x: 0, y: 2, rotation: 0 },
      { catalogId: "floor-lamp", label: "Floor lamp", x: -4, y: -0.5, rotation: 0 },
    ],
  },
  {
    id: "living-room-lshape",
    name: "Living · L-sectional + coffee + chair",
    description: "Compact L-sectional, round coffee table, accent chair.",
    pieces: [
      { catalogId: "sofa-lshape-small", label: "L-sectional", x: 0, y: 0, rotation: 0 },
      { catalogId: "coffee-table-round", label: "Coffee table", x: 0, y: 4, rotation: 0 },
      { catalogId: "armchair", label: "Accent chair", x: 6, y: 4, rotation: 180 },
      { catalogId: "rug-8x10", label: "Area rug", x: 0, y: 2.5, rotation: 0 },
    ],
  },
  {
    id: "dining-4",
    name: "Dining · 4-top + chairs",
    description: "Rectangular dining table with four chairs.",
    pieces: [
      { catalogId: "dining-table-4", label: "Dining table", x: 0, y: 0, rotation: 0 },
      { catalogId: "dining-chair", label: "Chair N1", x: -1.25, y: -2.4, rotation: 180 },
      { catalogId: "dining-chair", label: "Chair N2", x: 1.25, y: -2.4, rotation: 180 },
      { catalogId: "dining-chair", label: "Chair S1", x: -1.25, y: 2.4, rotation: 0 },
      { catalogId: "dining-chair", label: "Chair S2", x: 1.25, y: 2.4, rotation: 0 },
    ],
  },
  {
    id: "dining-6",
    name: "Dining · 6-top + chairs",
    description: "Six-person dining setup.",
    pieces: [
      { catalogId: "dining-table-6", label: "Dining table", x: 0, y: 0, rotation: 0 },
      { catalogId: "dining-chair", label: "Chair N1", x: -2, y: -2.5, rotation: 180 },
      { catalogId: "dining-chair", label: "Chair N2", x: 0, y: -2.5, rotation: 180 },
      { catalogId: "dining-chair", label: "Chair N3", x: 2, y: -2.5, rotation: 180 },
      { catalogId: "dining-chair", label: "Chair S1", x: -2, y: 2.5, rotation: 0 },
      { catalogId: "dining-chair", label: "Chair S2", x: 0, y: 2.5, rotation: 0 },
      { catalogId: "dining-chair", label: "Chair S3", x: 2, y: 2.5, rotation: 0 },
    ],
  },
  {
    id: "wfh-corner",
    name: "Home office · Desk + chair + light",
    description: "Desk against a wall, chair, floor lamp.",
    pieces: [
      { catalogId: "desk", label: "Desk", x: 0, y: 0, rotation: 0 },
      { catalogId: "armchair", label: "Desk chair", x: 0, y: 2, rotation: 0 },
      { catalogId: "floor-lamp", label: "Floor lamp", x: 3, y: -0.5, rotation: 0 },
      { catalogId: "bookshelf", label: "Bookshelf", x: -4, y: -0.5, rotation: 90 },
    ],
  },
];
