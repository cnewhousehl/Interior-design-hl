import type { Theme } from "./types";

export type Palette = {
  name: string;
  swatches: { hex: string; label: string }[];
  materials: string[];
  paintIdeas: { brand: string; name: string; hex: string }[];
  notes: string;
};

/**
 * Curated mood-board data for each theme: palettes, materials and example paint pairings.
 * These are sensible starting points — adjust to taste.
 */
export const MOODBOARDS: Record<Theme, Palette> = {
  "mid-century-modern": {
    name: "Mid-century modern",
    swatches: [
      { hex: "#3b3024", label: "Walnut" },
      { hex: "#d9c19a", label: "Cream" },
      { hex: "#b8531a", label: "Burnt orange" },
      { hex: "#1f4e3d", label: "Forest" },
      { hex: "#c9a227", label: "Mustard" },
    ],
    materials: ["Walnut veneer", "Brass hardware", "Boucle", "Leather", "Velvet"],
    paintIdeas: [
      { brand: "Farrow & Ball", name: "Setting Plaster", hex: "#e7c8b3" },
      { brand: "Benjamin Moore", name: "Hale Navy", hex: "#3c4654" },
    ],
    notes: "Tapered legs, organic curves, low-profile silhouettes. Mix one bold color with warm neutrals.",
  },
  scandi: {
    name: "Scandinavian",
    swatches: [
      { hex: "#f7f3ec", label: "Bone" },
      { hex: "#d2c5b1", label: "Oat" },
      { hex: "#7a6c5d", label: "Stone" },
      { hex: "#a7c0b0", label: "Sage" },
      { hex: "#2c2a26", label: "Charcoal" },
    ],
    materials: ["White oak", "Linen", "Wool throw", "Matte black metal", "Sheepskin"],
    paintIdeas: [
      { brand: "Farrow & Ball", name: "Wevet", hex: "#eee8e0" },
      { brand: "Benjamin Moore", name: "Chantilly Lace", hex: "#f4f4f0" },
    ],
    notes: "Light woods, lots of white, soft textiles. Keep walls bright to maximize the small footprint.",
  },
  industrial: {
    name: "Industrial",
    swatches: [
      { hex: "#1c1c1c", label: "Iron" },
      { hex: "#6b3e2a", label: "Saddle leather" },
      { hex: "#9c917d", label: "Concrete" },
      { hex: "#c4a168", label: "Brass" },
      { hex: "#7b1f1f", label: "Oxblood" },
    ],
    materials: ["Blackened steel", "Reclaimed wood", "Cognac leather", "Concrete", "Edison bulbs"],
    paintIdeas: [
      { brand: "Farrow & Ball", name: "Off-Black", hex: "#3a3a37" },
      { brand: "Benjamin Moore", name: "Iron Mountain", hex: "#52514c" },
    ],
    notes: "Pair raw materials with warm wood and leather to keep the space from feeling cold.",
  },
  japandi: {
    name: "Japandi",
    swatches: [
      { hex: "#efe9dd", label: "Paper" },
      { hex: "#b09a7e", label: "Tatami" },
      { hex: "#2e2a25", label: "Sumi" },
      { hex: "#7f6e54", label: "Tea" },
      { hex: "#c5c3bc", label: "Mist" },
    ],
    materials: ["Light oak", "Rattan", "Linen", "Ceramic", "Washi paper"],
    paintIdeas: [
      { brand: "Farrow & Ball", name: "Shadow White", hex: "#e5dfd0" },
      { brand: "Benjamin Moore", name: "Black Beauty", hex: "#272a2f" },
    ],
    notes: "Low furniture, lots of negative space. One statement piece per room, max.",
  },
  coastal: {
    name: "Coastal",
    swatches: [
      { hex: "#f3f7fa", label: "Cloud" },
      { hex: "#a8c4d6", label: "Sea glass" },
      { hex: "#2c4f6a", label: "Navy" },
      { hex: "#dccbb1", label: "Sand" },
      { hex: "#76a08c", label: "Driftwood green" },
    ],
    materials: ["Whitewashed oak", "Rattan", "Linen", "Jute rug", "Brushed nickel"],
    paintIdeas: [
      { brand: "Farrow & Ball", name: "Borrowed Light", hex: "#dbe4e6" },
      { brand: "Benjamin Moore", name: "Hale Navy", hex: "#3c4654" },
    ],
    notes: "Breezy and light. Lean into texture (rattan, jute, linen) rather than literal seashells.",
  },
  boho: {
    name: "Boho",
    swatches: [
      { hex: "#caa472", label: "Camel" },
      { hex: "#a13d2d", label: "Terracotta" },
      { hex: "#5a4633", label: "Bark" },
      { hex: "#d9c79b", label: "Linen" },
      { hex: "#3a5a3a", label: "Plant green" },
    ],
    materials: ["Rattan", "Layered rugs", "Macramé", "Reclaimed wood", "Live plants"],
    paintIdeas: [
      { brand: "Farrow & Ball", name: "Joa's White", hex: "#e4dcc7" },
      { brand: "Benjamin Moore", name: "Persimmon", hex: "#bc593a" },
    ],
    notes: "Layer rugs, mix patterns, add greenery. Aim for collected-over-time, not matchy.",
  },
  "modern-farmhouse": {
    name: "Modern farmhouse",
    swatches: [
      { hex: "#f7f1e6", label: "Whitewash" },
      { hex: "#7c6a55", label: "Aged oak" },
      { hex: "#1f2226", label: "Soft black" },
      { hex: "#cbb997", label: "Linen" },
      { hex: "#5e7556", label: "Sage" },
    ],
    materials: ["Shaker cabinetry", "Distressed oak", "Black iron", "Linen slipcovers", "Shiplap"],
    paintIdeas: [
      { brand: "Farrow & Ball", name: "Cornforth White", hex: "#dcd8cc" },
      { brand: "Benjamin Moore", name: "Soot", hex: "#383b3c" },
    ],
    notes: "Mix country textures (linen, shaker, oak) with crisp black-and-white contrast.",
  },
  minimalist: {
    name: "Minimalist",
    swatches: [
      { hex: "#ffffff", label: "White" },
      { hex: "#e8e6e0", label: "Bone" },
      { hex: "#bdb9ae", label: "Putty" },
      { hex: "#1a1a1a", label: "Ink" },
      { hex: "#9c8b75", label: "Oak" },
    ],
    materials: ["Microcement", "Pale oak", "Matte plaster", "Linen", "Smooth steel"],
    paintIdeas: [
      { brand: "Farrow & Ball", name: "Strong White", hex: "#ebe7df" },
      { brand: "Benjamin Moore", name: "Decorator's White", hex: "#f1efe6" },
    ],
    notes: "Editorial discipline: 1 sofa, 1 rug, 1 art piece, 1 plant. Resist the urge to fill.",
  },
  "art-deco": {
    name: "Art deco",
    swatches: [
      { hex: "#1d2735", label: "Midnight" },
      { hex: "#c8a04b", label: "Brushed brass" },
      { hex: "#7a1f33", label: "Wine velvet" },
      { hex: "#e3d8b2", label: "Champagne" },
      { hex: "#0e3b3d", label: "Emerald" },
    ],
    materials: ["Velvet", "Polished brass", "Lacquer", "Smoked glass", "Marble"],
    paintIdeas: [
      { brand: "Farrow & Ball", name: "Studio Green", hex: "#2b3a31" },
      { brand: "Benjamin Moore", name: "Stunning", hex: "#3a444a" },
    ],
    notes: "Geometric forms, jewel tones, polished surfaces. One showpiece per zone.",
  },
};
