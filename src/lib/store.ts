import { create } from "zustand";
import type {
  CalibrationPoints,
  ClearanceMode,
  FloorPlan,
  PlacedFurniture,
  Theme,
  ToolMode,
} from "./types";

type StoreState = {
  floorPlan: FloorPlan | null;
  placed: PlacedFurniture[];
  selectedId: string | null;
  toolMode: ToolMode;
  pendingCatalogId: string | null; // when toolMode === "place"
  clearanceMode: ClearanceMode;
  showDimensions: boolean;
  showGrid: boolean;
  theme: Theme | null;
  zoom: number; // canvas zoom multiplier
  pan: { x: number; y: number };

  // actions
  setFloorPlan: (fp: FloorPlan | null) => void;
  setCalibration: (cal: CalibrationPoints, pixelsPerFoot: number) => void;
  addFurniture: (item: PlacedFurniture) => void;
  updateFurniture: (id: string, partial: Partial<PlacedFurniture>) => void;
  removeFurniture: (id: string) => void;
  duplicateFurniture: (id: string) => void;
  setSelected: (id: string | null) => void;
  setToolMode: (mode: ToolMode, catalogId?: string | null) => void;
  setClearanceMode: (mode: ClearanceMode) => void;
  toggleDimensions: () => void;
  toggleGrid: () => void;
  setTheme: (theme: Theme | null) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  reset: () => void;
};

export const useDesignStore = create<StoreState>((set, get) => ({
  floorPlan: null,
  placed: [],
  selectedId: null,
  toolMode: "select",
  pendingCatalogId: null,
  clearanceMode: "selected",
  showDimensions: true,
  showGrid: false,
  theme: null,
  zoom: 1,
  pan: { x: 0, y: 0 },

  setFloorPlan: (fp) => set({ floorPlan: fp, placed: [], selectedId: null }),

  setCalibration: (cal, ppf) =>
    set((s) =>
      s.floorPlan
        ? {
            floorPlan: {
              ...s.floorPlan,
              calibration: cal,
              pixelsPerFoot: ppf,
            },
            toolMode: "select",
          }
        : {},
    ),

  addFurniture: (item) =>
    set((s) => ({
      placed: [...s.placed, item],
      selectedId: item.id,
      toolMode: "select",
      pendingCatalogId: null,
    })),

  updateFurniture: (id, partial) =>
    set((s) => ({
      placed: s.placed.map((p) => (p.id === id ? { ...p, ...partial } : p)),
    })),

  removeFurniture: (id) =>
    set((s) => ({
      placed: s.placed.filter((p) => p.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  duplicateFurniture: (id) => {
    const src = get().placed.find((p) => p.id === id);
    if (!src) return;
    const copy: PlacedFurniture = {
      ...src,
      id: crypto.randomUUID(),
      label: src.label ? `${src.label} (copy)` : src.label,
      x: src.x + 1,
      y: src.y + 1,
    };
    set((s) => ({ placed: [...s.placed, copy], selectedId: copy.id }));
  },

  setSelected: (id) => set({ selectedId: id }),

  setToolMode: (mode, catalogId = null) =>
    set({ toolMode: mode, pendingCatalogId: catalogId }),

  setClearanceMode: (mode) => set({ clearanceMode: mode }),
  toggleDimensions: () => set((s) => ({ showDimensions: !s.showDimensions })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),

  setTheme: (theme) => set({ theme }),

  setZoom: (zoom) => set({ zoom }),
  setPan: (pan) => set({ pan }),

  reset: () =>
    set({
      floorPlan: null,
      placed: [],
      selectedId: null,
      toolMode: "select",
      pendingCatalogId: null,
      theme: null,
      zoom: 1,
      pan: { x: 0, y: 0 },
    }),
}));
