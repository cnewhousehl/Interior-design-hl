import { create } from "zustand";
import { temporal } from "zundo";
import type { StateCreator } from "zustand";
import type {
  Annotation,
  CalibrationPoints,
  ClearanceMode,
  Door,
  FixtureMarker,
  FloorPlan,
  PlacedFurniture,
  Room,
  SavedLayout,
  Theme,
  ToolMode,
  TrafficPath,
  ViewMode,
  Wall,
  WindowOpening,
} from "./types";

type StoreState = {
  floorPlan: FloorPlan | null;
  placed: PlacedFurniture[];
  walls: Wall[];
  doors: Door[];
  windows: WindowOpening[];
  rooms: Room[];
  annotations: Annotation[];
  trafficPaths: TrafficPath[];
  fixtures: FixtureMarker[];
  selectedId: string | null;
  selectedIds: string[];
  toolMode: ToolMode;
  pendingCatalogId: string | null;
  clearanceMode: ClearanceMode;
  showDimensions: boolean;
  showGrid: boolean;
  showWalls: boolean;
  showIssues: boolean;
  theme: Theme | null;
  zoom: number;
  pan: { x: number; y: number };
  northDeg: number;
  ceilingHeightFt: number;
  view: ViewMode;
  fitRequest: number;

  setFloorPlan: (fp: FloorPlan | null) => void;
  setCalibration: (cal: CalibrationPoints, pixelsPerFoot: number) => void;

  addFurniture: (item: PlacedFurniture) => void;
  updateFurniture: (id: string, partial: Partial<PlacedFurniture>) => void;
  removeFurniture: (id: string) => void;
  duplicateFurniture: (id: string) => void;

  addWall: (wall: Wall) => void;
  updateWall: (id: string, partial: Partial<Wall>) => void;
  removeWall: (id: string) => void;
  setWalls: (walls: Wall[]) => void;

  addDoor: (door: Door) => void;
  updateDoor: (id: string, partial: Partial<Door>) => void;
  removeDoor: (id: string) => void;
  setDoors: (doors: Door[]) => void;

  addWindow: (w: WindowOpening) => void;
  removeWindow: (id: string) => void;

  addAnnotation: (a: Annotation) => void;
  removeAnnotation: (id: string) => void;

  addTrafficPath: (p: TrafficPath) => void;
  removeTrafficPath: (id: string) => void;

  addFixture: (f: FixtureMarker) => void;
  removeFixture: (id: string) => void;

  setRooms: (rooms: Room[]) => void;
  updateRoom: (id: string, partial: Partial<Room>) => void;

  setSelected: (id: string | null) => void;
  toggleInSelection: (id: string) => void;
  clearSelection: () => void;

  setToolMode: (mode: ToolMode, catalogId?: string | null) => void;
  setClearanceMode: (mode: ClearanceMode) => void;
  toggleDimensions: () => void;
  toggleGrid: () => void;
  toggleWalls: () => void;
  toggleIssues: () => void;
  setTheme: (theme: Theme | null) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setNorth: (deg: number) => void;
  setCeilingHeight: (ft: number) => void;
  setView: (v: ViewMode) => void;
  fitToView: () => void;
  reset: () => void;

  importScene: (partial: Partial<SavedLayout>) => void;
};

const initial = {
  floorPlan: null,
  placed: [],
  walls: [],
  doors: [],
  windows: [],
  rooms: [],
  annotations: [],
  trafficPaths: [],
  fixtures: [],
  selectedId: null,
  selectedIds: [],
  toolMode: "select" as ToolMode,
  pendingCatalogId: null,
  clearanceMode: "selected" as ClearanceMode,
  showDimensions: true,
  showGrid: false,
  showWalls: true,
  showIssues: false,
  theme: null,
  zoom: 1,
  pan: { x: 0, y: 0 },
  northDeg: 0,
  ceilingHeightFt: 9,
  view: "2d" as ViewMode,
  fitRequest: 0,
};

const creator: StateCreator<StoreState> = (set, get) => ({
  ...initial,

  setFloorPlan: (fp) =>
    set({
      ...initial,
      floorPlan: fp,
    }),

  setCalibration: (cal, ppf) =>
    set((s) =>
      s.floorPlan
        ? {
            floorPlan: { ...s.floorPlan, calibration: cal, pixelsPerFoot: ppf },
            toolMode: "select",
          }
        : {},
    ),

  addFurniture: (item) =>
    set((s) => ({
      placed: [...s.placed, item],
      selectedId: item.id,
      selectedIds: [item.id],
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
      selectedIds: s.selectedIds.filter((x) => x !== id),
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
    set((s) => ({ placed: [...s.placed, copy], selectedId: copy.id, selectedIds: [copy.id] }));
  },

  addWall: (wall) => set((s) => ({ walls: [...s.walls, wall] })),
  updateWall: (id, partial) =>
    set((s) => ({ walls: s.walls.map((w) => (w.id === id ? { ...w, ...partial } : w)) })),
  removeWall: (id) => set((s) => ({ walls: s.walls.filter((w) => w.id !== id) })),
  setWalls: (walls) => set({ walls }),

  addDoor: (door) => set((s) => ({ doors: [...s.doors, door] })),
  updateDoor: (id, partial) =>
    set((s) => ({ doors: s.doors.map((d) => (d.id === id ? { ...d, ...partial } : d)) })),
  removeDoor: (id) => set((s) => ({ doors: s.doors.filter((d) => d.id !== id) })),
  setDoors: (doors) => set({ doors }),

  addWindow: (w) => set((s) => ({ windows: [...s.windows, w] })),
  removeWindow: (id) => set((s) => ({ windows: s.windows.filter((x) => x.id !== id) })),

  addAnnotation: (a) => set((s) => ({ annotations: [...s.annotations, a] })),
  removeAnnotation: (id) => set((s) => ({ annotations: s.annotations.filter((x) => x.id !== id) })),

  addTrafficPath: (p) => set((s) => ({ trafficPaths: [...s.trafficPaths, p] })),
  removeTrafficPath: (id) => set((s) => ({ trafficPaths: s.trafficPaths.filter((p) => p.id !== id) })),

  addFixture: (f) => set((s) => ({ fixtures: [...s.fixtures, f] })),
  removeFixture: (id) => set((s) => ({ fixtures: s.fixtures.filter((f) => f.id !== id) })),

  setRooms: (rooms) => set({ rooms }),
  updateRoom: (id, partial) =>
    set((s) => ({ rooms: s.rooms.map((r) => (r.id === id ? { ...r, ...partial } : r)) })),

  setSelected: (id) => set({ selectedId: id, selectedIds: id ? [id] : [] }),
  toggleInSelection: (id) =>
    set((s) => {
      const has = s.selectedIds.includes(id);
      const next = has ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id];
      return { selectedIds: next, selectedId: next[next.length - 1] ?? null };
    }),
  clearSelection: () => set({ selectedId: null, selectedIds: [] }),

  setToolMode: (mode, catalogId = null) => set({ toolMode: mode, pendingCatalogId: catalogId }),
  setClearanceMode: (mode) => set({ clearanceMode: mode }),
  toggleDimensions: () => set((s) => ({ showDimensions: !s.showDimensions })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleWalls: () => set((s) => ({ showWalls: !s.showWalls })),
  toggleIssues: () => set((s) => ({ showIssues: !s.showIssues })),
  setTheme: (theme) => set({ theme }),
  setZoom: (zoom) => set({ zoom }),
  setPan: (pan) => set({ pan }),
  setNorth: (deg) => set({ northDeg: ((deg % 360) + 360) % 360 }),
  setCeilingHeight: (ft) => set({ ceilingHeightFt: Math.max(6, Math.min(20, ft)) }),
  setView: (v) => set({ view: v }),
  fitToView: () => set((s) => ({ fitRequest: s.fitRequest + 1 })),

  reset: () => set({ ...initial }),

  importScene: (partial) =>
    set((s) => ({
      ...s,
      ...partial,
      selectedId: null,
      selectedIds: [],
      toolMode: "select",
      pendingCatalogId: null,
    })),
});

export const useDesignStore = create<StoreState>()(
  temporal(creator, {
    partialize: (state) => {
      const {
        floorPlan,
        placed,
        walls,
        doors,
        windows,
        rooms,
        annotations,
        trafficPaths,
        fixtures,
        theme,
        northDeg,
        ceilingHeightFt,
      } = state;
      return {
        floorPlan,
        placed,
        walls,
        doors,
        windows,
        rooms,
        annotations,
        trafficPaths,
        fixtures,
        theme,
        northDeg,
        ceilingHeightFt,
      } as Partial<StoreState>;
    },
    limit: 100,
    equality: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  }),
);

export const useTemporalStore = useDesignStore.temporal;
