"use client";

import { useMemo, useState } from "react";
import { Search, Sofa, Table, BedDouble, Archive, Layers, Lamp, Sparkles, ChevronRight, Star, Compass, Package } from "lucide-react";
import { CATALOG, CATEGORIES } from "@/lib/catalog";
import { useDesignStore } from "@/lib/store";
import type { CatalogItem, FurnitureCategory, Theme } from "@/lib/types";
import { formatFeet } from "@/lib/format";
import { TEMPLATES } from "@/lib/templates";

const ICON_MAP: Record<FurnitureCategory, React.ComponentType<{ className?: string }>> = {
  seating: Sofa,
  tables: Table,
  beds: BedDouble,
  storage: Archive,
  rugs: Layers,
  lighting: Lamp,
  misc: Sparkles,
};

type PaletteTab = "catalog" | "templates";

export default function FurniturePalette() {
  const [tab, setTab] = useState<PaletteTab>("catalog");
  const [query, setQuery] = useState("");
  const [openCats, setOpenCats] = useState<Set<string>>(new Set(["seating"]));
  const toolMode = useDesignStore((s) => s.toolMode);
  const pendingCatalogId = useDesignStore((s) => s.pendingCatalogId);
  const setToolMode = useDesignStore((s) => s.setToolMode);
  const floorPlan = useDesignStore((s) => s.floorPlan);
  const theme = useDesignStore((s) => s.theme);
  const northDeg = useDesignStore((s) => s.northDeg);
  const setNorth = useDesignStore((s) => s.setNorth);
  const ceilingHeightFt = useDesignStore((s) => s.ceilingHeightFt);
  const setCeilingHeight = useDesignStore((s) => s.setCeilingHeight);
  const addFurnitureBatch = useDesignStore((s) => s.addFurnitureBatch);

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

  const toggleCat = (id: string) => {
    setOpenCats((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const dropTemplate = (tplId: string) => {
    if (!calibrated || !floorPlan) return;
    const tpl = TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    // Anchor at center of the floor plan in feet
    const ppf = floorPlan.pixelsPerFoot!;
    const cx = floorPlan.imagePxWidth / ppf / 2;
    const cy = floorPlan.imagePxHeight / ppf / 2;
    const items = tpl.pieces.map((p) => ({
      ...p,
      id: crypto.randomUUID(),
      x: cx + p.x,
      y: cy + p.y,
    }));
    addFurnitureBatch(items);
  };

  return (
    <aside className="w-72 border-r border-ink-200/70 bg-paper-50 flex flex-col overflow-hidden">
      <div className="flex border-b border-ink-200/70">
        <button
          onClick={() => setTab("catalog")}
          className={`tab ${tab === "catalog" ? "tab-active" : "tab-idle"}`}
        >
          Catalog
        </button>
        <button
          onClick={() => setTab("templates")}
          className={`tab ${tab === "templates" ? "tab-active" : "tab-idle"}`}
        >
          Templates
        </button>
      </div>

      {tab === "catalog" && (
        <>
          <div className="px-4 pt-3 pb-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-ink-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search furniture…"
                className="input pl-8"
              />
            </div>
            {!calibrated && (
              <div className="mt-3 text-[11px] text-ink-500 leading-snug bg-paper-200/60 rounded-lg p-2 border border-ink-200/50">
                Upload + calibrate a floor plan first, then click a piece and click the canvas to place.
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {CATEGORIES.map((cat) => {
              const items = grouped.get(cat.id) ?? [];
              if (!items.length) return null;
              const isOpen = openCats.has(cat.id) || !!query;
              const Icon = ICON_MAP[cat.id];
              return (
                <div key={cat.id} className="border-b border-ink-200/50 last:border-b-0">
                  <button
                    onClick={() => toggleCat(cat.id)}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-ink-100 flex items-center gap-2.5 group"
                  >
                    <Icon className="w-4 h-4 text-ink-500 group-hover:text-ink-700" />
                    <span className="flex-1">{cat.label}</span>
                    <span className="text-[10px] font-mono text-ink-400">{items.length}</span>
                    <ChevronRight className={`w-3.5 h-3.5 text-ink-400 transition-transform ${isOpen ? "rotate-90" : ""}`} />
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
                              className={`w-full text-left pl-10 pr-3 py-1.5 text-sm flex items-center gap-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                                selected
                                  ? "bg-accent-50 ring-1 ring-inset ring-accent-500/40 text-ink-900"
                                  : "hover:bg-ink-100"
                              }`}
                              title={c.description}
                            >
                              <span
                                className="inline-block w-3 h-3 rounded-sm shrink-0 ring-1 ring-ink-200"
                                style={{ background: c.color }}
                              />
                              <span className="flex-1 truncate">{c.name}</span>
                              <span className="text-[10px] font-mono text-ink-400 tabular-nums shrink-0">
                                {formatFeet(c.width)}×{formatFeet(c.depth)}
                              </span>
                              {onTheme && <Star className="w-3 h-3 text-accent-500 shrink-0 fill-accent-100" />}
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
        </>
      )}

      {tab === "templates" && (
        <div className="flex-1 overflow-auto p-3 space-y-2">
          {!calibrated && (
            <div className="text-[11px] text-ink-500 leading-snug bg-paper-200/60 rounded-lg p-2 border border-ink-200/50">
              Calibrate a floor plan first — templates drop centered on the plan, then you can drag the group into the right room.
            </div>
          )}
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              disabled={!calibrated}
              onClick={() => dropTemplate(t.id)}
              className="card w-full text-left p-3 hover:bg-paper-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors group animate-fade-in"
            >
              <div className="flex items-start gap-2">
                <Package className="w-4 h-4 text-ink-500 mt-0.5 shrink-0 group-hover:text-accent-500" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{t.name}</div>
                  <div className="text-[11px] text-ink-500 mt-0.5 leading-snug">{t.description}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {t.pieces.map((p, i) => (
                      <span key={i} className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-paper-200 border border-ink-200/40 text-ink-600">
                        {p.catalogId.replace(/-/g, " ").replace(/sofa /g, "")}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-ink-200/70 p-3 space-y-3 bg-paper-100">
        <div>
          <div className="label mb-1.5 flex items-center gap-1.5">
            <Compass className="w-3 h-3" /> North rotation
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={359}
              value={northDeg}
              onChange={(e) => setNorth(parseInt(e.target.value))}
              className="flex-1 accent-accent-500"
            />
            <span className="text-xs font-mono tabular-nums w-12 text-right text-ink-600">{northDeg}°</span>
          </div>
        </div>
        <div>
          <div className="label mb-1.5">Ceiling height</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step={0.5}
              min={6}
              max={20}
              value={ceilingHeightFt}
              onChange={(e) => setCeilingHeight(parseFloat(e.target.value) || 9)}
              className="input input-sm flex-1"
            />
            <span className="text-xs font-mono text-ink-500">ft</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
