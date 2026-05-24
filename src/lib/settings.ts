/**
 * App-wide user settings persisted to localStorage. Kept outside the design
 * store so they survive a Reset.
 */

const KEY = "interior-design-hl:settings";

export type AppSettings = {
  anthropicApiKey?: string;
  budgetUsd?: number;
  projectName?: string;
};

function read(): AppSettings {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as AppSettings;
  } catch {
    return {};
  }
}

function write(s: AppSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

export const settings = {
  get(): AppSettings {
    return read();
  },
  set(partial: Partial<AppSettings>) {
    const cur = read();
    write({ ...cur, ...partial });
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(KEY);
  },
};

/** Read the API key — used by features that want to send it to the server. */
export function getApiKey(): string | undefined {
  return read().anthropicApiKey;
}
