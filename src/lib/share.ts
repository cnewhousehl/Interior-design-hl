import { useDesignStore } from "./store";
import type { SavedLayout } from "./types";

/**
 * Encode the current scene (minus the heavy floor-plan image) to a base64 URL fragment.
 * The image is omitted because it would blow past URL length limits — viewers need to
 * upload the same plan separately, or the layout loads against whatever plan they
 * already have open.
 */
export function encodeShareUrl(): string {
  const s = useDesignStore.getState();
  const payload: Partial<SavedLayout> & { _v: number } = {
    _v: 1,
    placed: s.placed,
    walls: s.walls,
    doors: s.doors,
    windows: s.windows,
    rooms: s.rooms,
    annotations: s.annotations,
    trafficPaths: s.trafficPaths,
    fixtures: s.fixtures,
    theme: s.theme,
    northDeg: s.northDeg,
    ceilingHeightFt: s.ceilingHeightFt,
  };
  const json = JSON.stringify(payload);
  const b64 = typeof window !== "undefined" ? btoa(unescape(encodeURIComponent(json))) : "";
  return `${typeof window !== "undefined" ? window.location.origin + window.location.pathname : ""}#scene=${b64}`;
}

export function tryLoadFromHash() {
  if (typeof window === "undefined") return;
  const match = window.location.hash.match(/scene=([^&]+)/);
  if (!match) return;
  try {
    const json = decodeURIComponent(escape(atob(match[1])));
    const data = JSON.parse(json);
    useDesignStore.getState().importScene(data);
    // Clear the hash so reload doesn't re-import after the user has changed things
    history.replaceState(null, "", window.location.pathname + window.location.search);
  } catch (err) {
    console.warn("Bad share URL", err);
  }
}
