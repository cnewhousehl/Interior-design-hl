import { create } from "zustand";
import { temporal } from "zundo";
import type { StateCreator } from "zustand";
import type {
  Annotation,
  CalibrationPoints,
  ClearanceMode,
  Door,
  FixtureKind,
  FixtureMarker,
  Floor,
  FloorPlan,
  LayerVisibility,
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
  pendingFixtureKind: FixtureKind | null;
  showSunPath: boolean;
  showZones: boolean;
  showAllFloors3D: boolean;
  layers: LayerVisibility;
  /** Other floors of the project. The "current" floor's data lives in the
   *  top-level state fields (placed, walls, etc) for editing; this array
   *  stores the non-current floors. `currentFloorId` is the id of the floor
   *  whose data is currently active. */
  floors: Floor[];
  currentFloorId: string;

  setFloorPlan: (fp: FloorPlan | null) => void;
  setCalibration: (cal: CalibrationPoints, pixelsPerFoot: number) => void;

  addFurniture: (item: PlacedFurniture) => void;
  addFurnitureBatch: (items: PlacedFurniture[]) => void;
  updateFurniture: (id: string, partial: Partial<PlacedFurniture>) => void;
  removeFurniture: (id: string) => void;
  duplicateFurniture: (id: string) => void;
  replaceCatalogId: (id: string, newCatalogId: string) => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  alignSelection: (axis: "left" | "right" | "top" | "bottom" | "centerX" | "centerY") => void;
  distributeSelection: (axis: "horizontal" | "vertical") => void;

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
  setFixtures: (fixtures: FixtureMarker[]) => void;

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
  // Multi-floor
  addFloor: (name?: string, copyCurrent?: boolean) => void;
  switchFloor: (id: string) => void;
  renameFloor: (id: string, name: string) => void;
  removeFloor: (id: string) => void;
  setFloorElevation: (id: string, ftFromGround: number) => void;
  toggleShowAllFloors3D: () => void;
  setView: (v: ViewMode) => void;
  fitToView: () => void;
  setPendingFixtureKind: (k: FixtureKind | null) => void;
  toggleSunPath: () => void;
  toggleZones: () => void;
  setLayer: <K extends keyof LayerVisibility>(k: K, on: boolean) => void;
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
  pendingFixtureKind: null,
  showSunPath: false,
  showZones: true,
  showAllFloors3D: false,
  layers: {
    furniture: true,
    walls: true,
    doors: true,
    windows: true,
    rooms: true,
    annotations: true,
    trafficPaths: true,
    fixtures: true,
    zones: true,
  } as LayerVisibility,
  floors: [] as Floor[],
  currentFloorId: "floor-1",
};

const FIRST_FLOOR_ID = "floor-1";
void FIRST_FLOOR_ID;

function snapshotFloor(s: StoreState, id: string): Floor {
  const existing = s.floors.find((f) => f.id === id);
  return {
    id,
    name: existing?.name ?? "Floor 1",
    elevationFt: existing?.elevationFt ?? 0,
    floorPlan: s.floorPlan,
    placed: s.placed,
    walls: s.walls,
    doors: s.doors,
    windows: s.windows,
    rooms: s.rooms,
    annotations: s.annotations,
    trafficPaths: s.trafficPaths,
    fixtures: s.fixtures,
    ceilingHeightFt: s.ceilingHeightFt,
  };
}

function applyFloor(f: Floor): Partial<StoreState> {
  return {
    floorPlan: f.floorPlan,
    placed: f.placed,
    walls: f.walls,
    doors: f.doors,
    windows: f.windows,
    rooms: f.rooms,
    annotations: f.annotations,
    trafficPaths: f.trafficPaths,
    fixtures: f.fixtures,
    ceilingHeightFt: f.ceilingHeightFt,
  };
}

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

  addFurnitureBatch: (items) =>
    set((s) => ({
      placed: [...s.placed, ...items],
      selectedIds: items.map((i) => i.id),
      selectedId: items[items.length - 1]?.id ?? null,
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
      groupId: undefined,
      locked: false,
    };
    set((s) => ({ placed: [...s.placed, copy], selectedId: copy.id, selectedIds: [copy.id] }));
  },

  replaceCatalogId: (id, newCatalogId) =>
    set((s) => ({
      placed: s.placed.map((p) =>
        p.id === id
          ? {
              ...p,
              catalogId: newCatalogId,
              // Reset overrides since dimensions change
              widthOverride: undefined,
              depthOverride: undefined,
              heightOverride: undefined,
            }
          : p,
      ),
    })),

  groupSelection: () => {
    const groupId = crypto.randomUUID();
    set((s) => ({
      placed: s.placed.map((p) => (s.selectedIds.includes(p.id) ? { ...p, groupId } : p)),
    }));
  },

  ungroupSelection: () =>
    set((s) => ({
      placed: s.placed.map((p) => (s.selectedIds.includes(p.id) ? { ...p, groupId: undefined } : p)),
    })),

  alignSelection: (axis) => {
    const ids = get().selectedIds;
    if (ids.length < 2) return;
    const selected = get().placed.filter((p) => ids.includes(p.id));
    let target = 0;
    if (axis === "left") target = Math.min(...selected.map((p) => p.x));
    else if (axis === "right") target = Math.max(...selected.map((p) => p.x));
    else if (axis === "top") target = Math.min(...selected.map((p) => p.y));
    else if (axis === "bottom") target = Math.max(...selected.map((p) => p.y));
    else if (axis === "centerX") target = selected.reduce((a, p) => a + p.x, 0) / selected.length;
    else if (axis === "centerY") target = selected.reduce((a, p) => a + p.y, 0) / selected.length;
    set((s) => ({
      placed: s.placed.map((p) =>
        ids.includes(p.id)
          ? {
              ...p,
              ...(axis === "left" || axis === "right" || axis === "centerX" ? { x: target } : {}),
              ...(axis === "top" || axis === "bottom" || axis === "centerY" ? { y: target } : {}),
            }
          : p,
      ),
    }));
  },

  distributeSelection: (axis) => {
    const ids = get().selectedIds;
    if (ids.length < 3) return;
    const sel = get().placed.filter((p) => ids.includes(p.id));
    const key = axis === "horizontal" ? "x" : "y";
    const sorted = [...sel].sort((a, b) => a[key] - b[key]);
    const first = sorted[0][key];
    const last = sorted[sorted.length - 1][key];
    const step = (last - first) / (sorted.length - 1);
    const updates = new Map<string, number>();
    sorted.forEach((p, i) => updates.set(p.id, first + step * i));
    set((s) => ({
      placed: s.placed.map((p) =>
        updates.has(p.id) ? { ...p, [key]: updates.get(p.id)! } : p,
      ),
    }));
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
  setFixtures: (fixtures) => set({ fixtures }),

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

  addFloor: (name, copyCurrent) =>
    set((s) => {
      const id = crypto.randomUUID();
      const snapshot = snapshotFloor(s, s.currentFloorId);
      const newFloor: Floor = copyCurrent
        ? { ...snapshot, id, name: name || `Floor ${(s.floors.length + 2)}`, elevationFt: (snapshot.elevationFt ?? 0) + snapshot.ceilingHeightFt }
        : {
            id,
            name: name || `Floor ${s.floors.length + 2}`,
            elevationFt: (snapshot.elevationFt ?? 0) + snapshot.ceilingHeightFt,
            floorPlan: null,
            placed: [],
            walls: [],
            doors: [],
            windows: [],
            rooms: [],
            annotations: [],
            trafficPaths: [],
            fixtures: [],
            ceilingHeightFt: 9,
          };
      // Stash the current scene as a floor, switch to the new one
      return {
        floors: [...s.floors.filter((f) => f.id !== s.currentFloorId), snapshot, newFloor],
        currentFloorId: id,
        ...applyFloor(newFloor),
        selectedId: null,
        selectedIds: [],
      };
    }),

  switchFloor: (id) =>
    set((s) => {
      if (id === s.currentFloorId) return {};
      const target = s.floors.find((f) => f.id === id);
      if (!target) return {};
      const snapshot = snapshotFloor(s, s.currentFloorId);
      return {
        floors: [...s.floors.filter((f) => f.id !== s.currentFloorId && f.id !== id), snapshot],
        currentFloorId: id,
        ...applyFloor(target),
        selectedId: null,
        selectedIds: [],
      };
    }),

  renameFloor: (id, name) =>
    set((s) => ({
      floors: s.floors.map((f) => (f.id === id ? { ...f, name } : f)),
    })),

  removeFloor: (id) =>
    set((s) => {
      if (id === s.currentFloorId) return {};
      return { floors: s.floors.filter((f) => f.id !== id) };
    }),

  setFloorElevation: (id, ft) =>
    set((s) => ({
      floors: s.floors.map((f) => (f.id === id ? { ...f, elevationFt: ft } : f)),
    })),

  toggleShowAllFloors3D: () => set((s) => ({ showAllFloors3D: !s.showAllFloors3D })),
  setView: (v) => set({ view: v }),
  fitToView: () => set((s) => ({ fitRequest: s.fitRequest + 1 })),
  setPendingFixtureKind: (k) => set({ pendingFixtureKind: k }),
  toggleSunPath: () => set((s) => ({ showSunPath: !s.showSunPath })),
  toggleZones: () => set((s) => ({ showZones: !s.showZones })),
  setLayer: (k, on) => set((s) => ({ layers: { ...s.layers, [k]: on } })),

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
