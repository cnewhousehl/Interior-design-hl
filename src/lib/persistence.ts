import type { SavedLayout } from "./types";
import { useDesignStore } from "./store";

const KEY = "interior-design-hl:layouts";

export function listLayouts(): SavedLayout[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as SavedLayout[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(list: SavedLayout[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch (err) {
    // Most likely localStorage quota — the floor plan image is the heavy part.
    console.warn("[persistence] save failed", err);
    alert("Save failed — your floor plan image may be too large for browser storage. Try a smaller image.");
  }
}

export function saveCurrentAs(name: string): SavedLayout {
  const s = useDesignStore.getState();
  const now = Date.now();
  const layout: SavedLayout = {
    id: crypto.randomUUID(),
    name: name.trim() || `Layout ${new Date(now).toLocaleString()}`,
    createdAt: now,
    updatedAt: now,
    floorPlan: s.floorPlan,
    placed: s.placed,
    walls: s.walls,
    doors: s.doors,
    windows: s.windows,
    rooms: s.rooms,
    annotations: s.annotations,
    theme: s.theme,
    northDeg: s.northDeg,
  };
  const list = listLayouts();
  writeAll([...list, layout]);
  return layout;
}

export function overwriteLayout(id: string): SavedLayout | null {
  const s = useDesignStore.getState();
  const list = listLayouts();
  const idx = list.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  const updated: SavedLayout = {
    ...list[idx],
    updatedAt: Date.now(),
    floorPlan: s.floorPlan,
    placed: s.placed,
    walls: s.walls,
    doors: s.doors,
    windows: s.windows,
    rooms: s.rooms,
    annotations: s.annotations,
    theme: s.theme,
    northDeg: s.northDeg,
  };
  list[idx] = updated;
  writeAll(list);
  return updated;
}

export function loadLayout(id: string): SavedLayout | null {
  const layout = listLayouts().find((l) => l.id === id);
  if (!layout) return null;
  useDesignStore.getState().importScene(layout);
  return layout;
}

export function deleteLayout(id: string) {
  writeAll(listLayouts().filter((l) => l.id !== id));
}

export function renameLayout(id: string, name: string) {
  const list = listLayouts();
  const idx = list.findIndex((l) => l.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], name: name.trim() || list[idx].name, updatedAt: Date.now() };
  writeAll(list);
}
