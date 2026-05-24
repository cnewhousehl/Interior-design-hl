"use client";

import { useMemo, useState } from "react";
import { useDesignStore } from "@/lib/store";
import { getCatalogItem } from "@/lib/catalog";
import { ALL_THEMES, type FurnitureStatus, type Theme } from "@/lib/types";
import { formatFeet, formatSqft } from "@/lib/format";
import { runValidation } from "@/lib/validation";
import { polygonAreaSqft } from "@/lib/validation";
import { MOODBOARDS } from "@/lib/moodboard";

type Tab = "props" | "issues" | "mood";

type Recommendation = {
  catalogId?: string | null;
  name: string;
  category: string;
  widthFt?: number;
  depthFt?: number;
  why: string;
};

export default function PropertiesPanel() {
  const [tab, setTab] = useState<Tab>("props");
  const placed = useDesignStore((s) => s.placed);
  const walls = useDesignStore((s) => s.walls);
  const doors = useDesignStore((s) => s.doors);
  const rooms = useDesignStore((s) => s.rooms);
  const theme = useDesignStore((s) => s.theme);

  const issues = useMemo(() => runValidation({ placed, walls, doors }), [placed, walls, doors]);

  const totalSqft = useMemo(
    () =>
      placed.reduce((acc, p) => {
        const c = getCatalogItem(p.catalogId);
        if (!c) return acc;
        return acc + (p.widthOverride ?? c.width) * (p.depthOverride ?? c.depth);
      }, 0),
    [placed],
  );

  const totalCost = useMemo(() => placed.reduce((acc, p) => acc + (p.priceUsd ?? 0), 0), [placed]);
  const roomSqft = useMemo(() => rooms.reduce((acc, r) => acc + polygonAreaSqft(r.polygon), 0), [rooms]);

  return (
    <aside className="w-80 border-l border-ink/10 bg-paper flex flex-col overflow-hidden">
      <div className="flex border-b border-ink/10 text-sm">
        <TabBtn id="props" current={tab} onClick={setTab} label="Properties" />
        <TabBtn id="issues" current={tab} onClick={setTab} label={`Issues${issues.length ? ` (${issues.length})` : ""}`} />
        <TabBtn id="mood" current={tab} onClick={setTab} label="Theme" />
      </div>

      <div className="px-3 py-2 border-b border-ink/10 text-xs flex justify-between text-ink/70 gap-2">
        <span>{placed.length} pieces</span>
        <span>{formatSqft(totalSqft)} footprint</span>
        {totalCost > 0 && <span>${totalCost.toLocaleString()}</span>}
        {roomSqft > 0 && <span title="Total room area">· {roomSqft.toFixed(0)} sqft rooms</span>}
      </div>

      {tab === "props" && <PropertiesTab />}
      {tab === "issues" && <IssuesTab />}
      {tab === "mood" && <MoodTab theme={theme} />}
    </aside>
  );
}

function TabBtn({
  id,
  current,
  onClick,
  label,
}: {
  id: Tab;
  current: Tab;
  onClick: (t: Tab) => void;
  label: string;
}) {
  const active = current === id;
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex-1 px-3 py-2 ${active ? "bg-ink text-paper" : "hover:bg-ink/5 text-ink/70"}`}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Properties tab
// ---------------------------------------------------------------------------

function PropertiesTab() {
  const selectedId = useDesignStore((s) => s.selectedId);
  const placed = useDesignStore((s) => s.placed);
  const updateFurniture = useDesignStore((s) => s.updateFurniture);
  const removeFurniture = useDesignStore((s) => s.removeFurniture);
  const duplicateFurniture = useDesignStore((s) => s.duplicateFurniture);

  const selected = placed.find((p) => p.id === selectedId) ?? null;
  const cat = selected ? getCatalogItem(selected.catalogId) : null;

  if (!selected || !cat) {
    return (
      <div className="p-3 text-sm text-ink/50">
        Select a piece on the canvas to edit it. Shift-click to add to selection.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-3 space-y-3 text-sm">
      <label className="block">
        <div className="text-xs text-ink/60">Label</div>
        <input
          value={selected.label}
          onChange={(e) => updateFurniture(selected.id, { label: e.target.value })}
          className="w-full border border-ink/20 rounded px-2 py-1 mt-0.5"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Width (ft)" value={selected.widthOverride ?? cat.width} onChange={(v) => updateFurniture(selected.id, { widthOverride: v })} />
        <NumberField label="Depth (ft)" value={selected.depthOverride ?? cat.depth} onChange={(v) => updateFurniture(selected.id, { depthOverride: v })} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <NumberField label="X (ft)" value={selected.x} onChange={(v) => updateFurniture(selected.id, { x: v })} />
        <NumberField label="Y (ft)" value={selected.y} onChange={(v) => updateFurniture(selected.id, { y: v })} />
      </div>

      <label className="block">
        <div className="text-xs text-ink/60">Rotation (°)</div>
        <div className="flex gap-1 mt-0.5">
          <input
            type="number"
            value={selected.rotation}
            onChange={(e) => updateFurniture(selected.id, { rotation: parseFloat(e.target.value) || 0 })}
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

      <label className="block">
        <div className="text-xs text-ink/60">Status</div>
        <select
          value={selected.status ?? ""}
          onChange={(e) =>
            updateFurniture(selected.id, { status: (e.target.value || undefined) as FurnitureStatus | undefined })
          }
          className="w-full border border-ink/20 rounded px-2 py-1 mt-0.5"
        >
          <option value="">— none —</option>
          <option value="considering">Considering</option>
          <option value="wishlist">Wishlist</option>
          <option value="ordered">Ordered</option>
          <option value="owned">Owned</option>
        </select>
      </label>

      <label className="block">
        <div className="text-xs text-ink/60">Price (USD)</div>
        <input
          type="number"
          value={selected.priceUsd ?? ""}
          onChange={(e) =>
            updateFurniture(selected.id, {
              priceUsd: e.target.value === "" ? undefined : parseFloat(e.target.value),
            })
          }
          placeholder="0"
          className="w-full border border-ink/20 rounded px-2 py-1 mt-0.5"
        />
      </label>

      <label className="block">
        <div className="text-xs text-ink/60">Color</div>
        <div className="flex gap-1 mt-0.5">
          <input
            type="color"
            value={selected.colorOverride ?? cat.color}
            onChange={(e) => updateFurniture(selected.id, { colorOverride: e.target.value })}
            className="w-10 h-8 border border-ink/20 rounded"
          />
          {selected.colorOverride && (
            <button
              onClick={() => updateFurniture(selected.id, { colorOverride: undefined })}
              className="px-2 text-xs border border-ink/20 rounded hover:bg-ink/5"
            >
              Reset
            </button>
          )}
        </div>
      </label>

      <label className="block">
        <div className="text-xs text-ink/60">Notes</div>
        <textarea
          value={selected.notes ?? ""}
          onChange={(e) => updateFurniture(selected.id, { notes: e.target.value })}
          rows={3}
          placeholder="e.g. West Elm Andes sofa, walnut legs"
          className="w-full border border-ink/20 rounded px-2 py-1 mt-0.5 resize-y"
        />
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
        {cat.recommendedClearance ? <> · clearance ≥ {formatFeet(cat.recommendedClearance)}</> : null}
      </div>
      {cat.description && <div className="text-xs text-ink/60">{cat.description}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Issues tab
// ---------------------------------------------------------------------------

function IssuesTab() {
  const placed = useDesignStore((s) => s.placed);
  const walls = useDesignStore((s) => s.walls);
  const doors = useDesignStore((s) => s.doors);
  const setSelected = useDesignStore((s) => s.setSelected);
  const issues = useMemo(() => runValidation({ placed, walls, doors }), [placed, walls, doors]);

  if (!issues.length) {
    return (
      <div className="flex-1 p-4 text-sm text-ink/60">
        <div className="text-green-700 font-medium mb-1">✓ No issues</div>
        Nothing overlaps, no walls are crossed, all clearances look reasonable.
        {!walls.length && (
          <div className="text-xs text-ink/50 mt-3 leading-snug">
            Tip: draw walls (Walls tool) or use Auto-detect to enable wall-crossing checks.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-2 space-y-1.5">
      {issues.map((i) => (
        <button
          key={i.id}
          onClick={() => i.furnitureId && setSelected(i.furnitureId)}
          className={`w-full text-left text-sm border rounded p-2 hover:bg-ink/5 ${
            i.severity === "error"
              ? "border-red-700/40 bg-red-50/40"
              : i.severity === "warn"
                ? "border-amber-700/40 bg-amber-50/40"
                : "border-ink/20"
          }`}
        >
          <div className="flex items-start gap-2">
            <span
              className={`mt-0.5 text-xs rounded px-1.5 py-0.5 ${
                i.severity === "error"
                  ? "bg-red-700 text-white"
                  : i.severity === "warn"
                    ? "bg-amber-600 text-white"
                    : "bg-ink/30 text-white"
              }`}
            >
              {i.severity === "error" ? "ERR" : i.severity === "warn" ? "WARN" : "INFO"}
            </span>
            <span className="flex-1">{i.message}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Theme / mood board tab
// ---------------------------------------------------------------------------

function MoodTab({ theme }: { theme: Theme | null }) {
  const setTheme = useDesignStore((s) => s.setTheme);
  const placed = useDesignStore((s) => s.placed);
  const setToolMode = useDesignStore((s) => s.setToolMode);

  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [recsSource, setRecsSource] = useState<"claude" | "catalog" | null>(null);

  const fetchRecs = async () => {
    if (!theme) return;
    setLoading(true);
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
      setLoading(false);
    }
  };

  const palette = theme ? MOODBOARDS[theme] : null;

  return (
    <div className="flex-1 overflow-auto p-3 space-y-3 text-sm">
      <label className="block">
        <div className="text-xs uppercase tracking-wider text-ink/60 mb-1">Theme</div>
        <select
          value={theme ?? ""}
          onChange={(e) => setTheme((e.target.value || null) as Theme | null)}
          className="w-full border border-ink/20 rounded px-2 py-1.5"
        >
          <option value="">— pick a style —</option>
          {ALL_THEMES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      {palette && (
        <>
          <div className="text-xs text-ink/70 leading-snug">{palette.notes}</div>

          <div>
            <div className="text-xs text-ink/60 mb-1">Palette</div>
            <div className="flex gap-1">
              {palette.swatches.map((s) => (
                <div key={s.hex} title={`${s.label} ${s.hex}`} className="flex-1">
                  <div className="h-10 rounded border border-ink/10" style={{ background: s.hex }} />
                  <div className="text-[10px] mt-0.5 text-center truncate text-ink/60">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-ink/60 mb-1">Paint pairings</div>
            <ul className="space-y-1">
              {palette.paintIdeas.map((p) => (
                <li key={p.hex} className="flex items-center gap-2 text-xs">
                  <span className="w-5 h-5 rounded border border-ink/20" style={{ background: p.hex }} />
                  <span className="font-medium">{p.name}</span>
                  <span className="text-ink/50">· {p.brand}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-xs text-ink/60 mb-1">Materials</div>
            <div className="flex flex-wrap gap-1">
              {palette.materials.map((m) => (
                <span key={m} className="text-[11px] px-1.5 py-0.5 rounded bg-ink/5 border border-ink/10">
                  {m}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {theme && (
        <button
          disabled={loading}
          onClick={fetchRecs}
          className="w-full px-2 py-1.5 text-sm rounded bg-ink text-paper hover:opacity-90 disabled:opacity-40"
        >
          {loading ? "Thinking…" : recs.length ? "Refresh recommendations" : "Get recommendations"}
        </button>
      )}
      {recsSource && (
        <div className="text-[10px] text-ink/40">
          Source: {recsSource === "claude" ? "Claude API" : "Local catalog"}
        </div>
      )}

      {recs.map((r, i) => {
        const inCatalog = r.catalogId ? getCatalogItem(r.catalogId) : null;
        return (
          <div key={i} className="border border-ink/15 rounded p-2">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-sm">{r.name}</div>
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
    </div>
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
