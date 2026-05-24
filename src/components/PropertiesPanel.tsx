"use client";

import { useMemo, useState } from "react";
import { useDesignStore } from "@/lib/store";
import { getCatalogItem } from "@/lib/catalog";
import { ALL_THEMES, type Theme } from "@/lib/types";
import { formatFeet, formatSqft } from "@/lib/format";

type Recommendation = {
  catalogId?: string | null;
  name: string;
  category: string;
  widthFt?: number;
  depthFt?: number;
  why: string;
};

export default function PropertiesPanel() {
  const selectedId = useDesignStore((s) => s.selectedId);
  const placed = useDesignStore((s) => s.placed);
  const updateFurniture = useDesignStore((s) => s.updateFurniture);
  const removeFurniture = useDesignStore((s) => s.removeFurniture);
  const duplicateFurniture = useDesignStore((s) => s.duplicateFurniture);
  const theme = useDesignStore((s) => s.theme);
  const setTheme = useDesignStore((s) => s.setTheme);
  const setToolMode = useDesignStore((s) => s.setToolMode);
  const addFurniture = useDesignStore((s) => s.addFurniture);

  const selected = placed.find((p) => p.id === selectedId) ?? null;
  const cat = selected ? getCatalogItem(selected.catalogId) : null;

  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [recsSource, setRecsSource] = useState<"claude" | "catalog" | null>(null);

  const totalSqft = useMemo(() => {
    return placed.reduce((acc, p) => {
      const c = getCatalogItem(p.catalogId);
      if (!c) return acc;
      const w = p.widthOverride ?? c.width;
      const d = p.depthOverride ?? c.depth;
      return acc + w * d;
    }, 0);
  }, [placed]);

  const fetchRecs = async () => {
    if (!theme) return;
    setLoadingRecs(true);
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          theme,
          placed: placed.map((p) => ({ catalogId: p.catalogId, label: p.label })),
          roomNotes:
            "Small NYC apartment: living/dining ~11'×23'6\", bedroom 11'×11'7\", terrace 165.5 sqft, L-shaped kitchen along the wall.",
        }),
      });
      const data = await res.json();
      setRecs(data.recommendations ?? []);
      setRecsSource(data.source ?? null);
    } finally {
      setLoadingRecs(false);
    }
  };

  return (
    <aside className="w-72 border-l border-ink/10 bg-paper flex flex-col overflow-hidden">
      {/* ----- selected item ----- */}
      <div className="p-3 border-b border-ink/10">
        <div className="text-xs uppercase tracking-wider text-ink/60 mb-2">Selected</div>
        {!selected || !cat ? (
          <p className="text-sm text-ink/50">Select a piece on the canvas to edit it.</p>
        ) : (
          <div className="space-y-2 text-sm">
            <label className="block">
              <div className="text-xs text-ink/60">Label</div>
              <input
                value={selected.label}
                onChange={(e) => updateFurniture(selected.id, { label: e.target.value })}
                className="w-full border border-ink/20 rounded px-2 py-1 mt-0.5"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="Width (ft)"
                value={selected.widthOverride ?? cat.width}
                onChange={(v) => updateFurniture(selected.id, { widthOverride: v })}
              />
              <NumberField
                label="Depth (ft)"
                value={selected.depthOverride ?? cat.depth}
                onChange={(v) => updateFurniture(selected.id, { depthOverride: v })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="X (ft)"
                value={selected.x}
                onChange={(v) => updateFurniture(selected.id, { x: v })}
                step={0.1}
              />
              <NumberField
                label="Y (ft)"
                value={selected.y}
                onChange={(v) => updateFurniture(selected.id, { y: v })}
                step={0.1}
              />
            </div>

            <label className="block">
              <div className="text-xs text-ink/60">Rotation (°)</div>
              <div className="flex gap-1 mt-0.5">
                <input
                  type="number"
                  value={selected.rotation}
                  onChange={(e) =>
                    updateFurniture(selected.id, { rotation: parseFloat(e.target.value) || 0 })
                  }
                  className="flex-1 border border-ink/20 rounded px-2 py-1"
                />
                <button
                  onClick={() => updateFurniture(selected.id, { rotation: (selected.rotation + 90) % 360 })}
                  className="px-2 py-1 border border-ink/20 rounded hover:bg-ink/5"
                  title="Rotate 90°"
                >
                  ↻
                </button>
              </div>
            </label>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => duplicateFurniture(selected.id)}
                className="flex-1 px-2 py-1.5 text-sm border border-ink/20 rounded hover:bg-ink/5"
              >
                Duplicate
              </button>
              <button
                onClick={() => removeFurniture(selected.id)}
                className="flex-1 px-2 py-1.5 text-sm border border-red-700/40 text-red-700 rounded hover:bg-red-700/5"
              >
                Delete
              </button>
            </div>

            <div className="text-xs text-ink/60 pt-1">
              Catalog: <span className="text-ink">{cat.name}</span>
              {cat.recommendedClearance ? (
                <>
                  {" · "}clearance ≥ {formatFeet(cat.recommendedClearance)}
                </>
              ) : null}
            </div>
            {cat.description && <div className="text-xs text-ink/60">{cat.description}</div>}
          </div>
        )}
      </div>

      {/* ----- summary ----- */}
      <div className="px-3 py-2 border-b border-ink/10 text-xs flex justify-between text-ink/70">
        <span>{placed.length} pieces placed</span>
        <span>{formatSqft(totalSqft)} footprint</span>
      </div>

      {/* ----- theme + recs ----- */}
      <div className="p-3 border-b border-ink/10">
        <div className="text-xs uppercase tracking-wider text-ink/60 mb-2">Theme</div>
        <select
          value={theme ?? ""}
          onChange={(e) => setTheme((e.target.value || null) as Theme | null)}
          className="w-full text-sm border border-ink/20 rounded px-2 py-1.5"
        >
          <option value="">— pick a style —</option>
          {ALL_THEMES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        {theme && (
          <p className="text-xs text-ink/60 mt-1.5">
            {ALL_THEMES.find((t) => t.id === theme)?.description}
          </p>
        )}
        <button
          disabled={!theme || loadingRecs}
          onClick={fetchRecs}
          className="mt-2 w-full px-2 py-1.5 text-sm rounded bg-ink text-paper hover:opacity-90 disabled:opacity-40"
        >
          {loadingRecs ? "Thinking..." : recs.length ? "Refresh recommendations" : "Get recommendations"}
        </button>
        {recsSource && (
          <div className="text-[10px] text-ink/40 mt-1">
            Source: {recsSource === "claude" ? "Claude API" : "Local catalog"}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-2">
        {recs.map((r, i) => {
          const inCatalog = r.catalogId ? getCatalogItem(r.catalogId) : null;
          return (
            <div key={i} className="border border-ink/15 rounded p-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium">{r.name}</div>
                {inCatalog && (
                  <button
                    onClick={() => setToolMode("place", inCatalog.id)}
                    className="text-xs px-2 py-0.5 rounded bg-accent text-white hover:opacity-90 shrink-0"
                  >
                    Place
                  </button>
                )}
              </div>
              <div className="text-xs text-ink/60 mt-0.5">
                {r.category}
                {r.widthFt && r.depthFt
                  ? ` · ${formatFeet(r.widthFt)} × ${formatFeet(r.depthFt)}`
                  : inCatalog
                    ? ` · ${formatFeet(inCatalog.width)} × ${formatFeet(inCatalog.depth)}`
                    : ""}
              </div>
              <div className="text-xs mt-1 leading-snug">{r.why}</div>
            </div>
          );
        })}
        {!recs.length && !loadingRecs && (
          <p className="text-xs text-ink/50">
            Pick a theme and click "Get recommendations" — Claude (or the local catalog if no API key) will suggest pieces that suit the style.
          </p>
        )}
      </div>
    </aside>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 0.1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="block">
      <div className="text-xs text-ink/60">{label}</div>
      <input
        type="number"
        value={Number.isFinite(value) ? Number(value.toFixed(3)) : 0}
        step={step}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
        className="w-full border border-ink/20 rounded px-2 py-1 mt-0.5"
      />
    </label>
  );
}
