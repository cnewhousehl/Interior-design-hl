"use client";

import { useMemo, useState } from "react";
import { CATALOG, CATEGORIES } from "@/lib/catalog";
import { useDesignStore } from "@/lib/store";
import type { CatalogItem, Theme } from "@/lib/types";
import { formatFeet } from "@/lib/format";

export default function FurniturePalette() {
  const [query, setQuery] = useState("");
  const [openCat, setOpenCat] = useState<string | null>("seating");
  const toolMode = useDesignStore((s) => s.toolMode);
  const pendingCatalogId = useDesignStore((s) => s.pendingCatalogId);
  const setToolMode = useDesignStore((s) => s.setToolMode);
  const floorPlan = useDesignStore((s) => s.floorPlan);
  const theme = useDesignStore((s) => s.theme);

  const calibrated = !!floorPlan?.pixelsPerFoot;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATALOG;
    return CATALOG.filter(
      (c) => c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q),
    );
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogItem[]>();
    for (const c of filtered) {
      const list = map.get(c.category) ?? [];
      list.push(c);
      map.set(c.category, list);
    }
    return map;
  }, [filtered]);

  return (
    <aside className="w-64 border-r border-ink/10 bg-paper flex flex-col overflow-hidden">
      <div className="p-3 border-b border-ink/10">
        <div className="text-xs uppercase tracking-wider text-ink/60 mb-1.5">Furniture</div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="w-full text-sm border border-ink/20 rounded px-2 py-1.5"
        />
        {!calibrated && (
          <p className="text-xs text-ink/60 mt-2 leading-snug">
            Upload + calibrate a floor plan first, then click an item below and click on the canvas to place it.
          </p>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {CATEGORIES.map((cat) => {
          const items = grouped.get(cat.id) ?? [];
          if (!items.length) return null;
          const isOpen = openCat === cat.id || !!query;
          return (
            <div key={cat.id} className="border-b border-ink/10">
              <button
                onClick={() => setOpenCat(isOpen ? null : cat.id)}
                className="w-full text-left px-3 py-2 text-sm font-medium hover:bg-ink/5 flex items-center justify-between"
              >
                <span>{cat.label}</span>
                <span className="text-ink/40 text-xs">{items.length}</span>
              </button>
              {isOpen && (
                <ul className="pb-2">
                  {items.map((c) => {
                    const onTheme = theme && c.themes.includes(theme as Theme);
                    const selected = pendingCatalogId === c.id && toolMode === "place";
                    return (
                      <li key={c.id}>
                        <button
                          disabled={!calibrated}
                          onClick={() => setToolMode("place", c.id)}
                          className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-ink/5 disabled:opacity-40 disabled:cursor-not-allowed ${
                            selected ? "bg-accent/10 ring-1 ring-accent/40" : ""
                          }`}
                          title={c.description}
                        >
                          <span
                            className="inline-block w-3 h-3 rounded-sm shrink-0"
                            style={{ background: c.color }}
                          />
                          <span className="flex-1 truncate">{c.name}</span>
                          <span className="text-[10px] text-ink/50 tabular-nums shrink-0">
                            {formatFeet(c.width)}×{formatFeet(c.depth)}
                          </span>
                          {onTheme && (
                            <span className="text-[10px] text-accent shrink-0" title="Matches selected theme">
                              ★
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
