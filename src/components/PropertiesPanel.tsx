"use client";

import { useMemo, useState } from "react";
import {
  RotateCw,
  Copy,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
  Eye,
  EyeOff,
  Download,
  Link2,
  Sparkles,
  ExternalLink,
  ListTree,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { useDesignStore } from "@/lib/store";
import { CATALOG, defaultPrice, getCatalogItem } from "@/lib/catalog";
import { ALL_THEMES, type FurnitureStatus, type Theme } from "@/lib/types";
import { formatFeet, formatSqft } from "@/lib/format";
import { runValidation, polygonAreaSqft, findRoomAt } from "@/lib/validation";
import { MOODBOARDS } from "@/lib/moodboard";
import { downloadShoppingCsv, buildShoppingList } from "@/lib/shoppingList";
import { encodeShareUrl } from "@/lib/share";
import { getApiKey, settings } from "@/lib/settings";
import { computeWalkability } from "@/lib/walkability";

type Tab = "props" | "issues" | "mood" | "shop";

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
  const trafficPaths = useDesignStore((s) => s.trafficPaths);
  const rooms = useDesignStore((s) => s.rooms);
  const theme = useDesignStore((s) => s.theme);

  const fixtures = useDesignStore((s) => s.fixtures);
  const issues = useMemo(
    () => runValidation({ placed, walls, doors, trafficPaths, fixtures }),
    [placed, walls, doors, trafficPaths, fixtures],
  );

  const totalSqft = useMemo(
    () =>
      placed.reduce((acc, p) => {
        const c = getCatalogItem(p.catalogId);
        if (!c || p.hidden) return acc;
        return acc + (p.widthOverride ?? c.width) * (p.depthOverride ?? c.depth);
      }, 0),
    [placed],
  );

  const totalCost = useMemo(() => placed.reduce((acc, p) => acc + (p.priceUsd ?? 0), 0), [placed]);
  const roomSqft = useMemo(() => rooms.reduce((acc, r) => acc + polygonAreaSqft(r.polygon), 0), [rooms]);

  const issueCount = issues.length;
  const errorCount = issues.filter((i) => i.severity === "error").length;

  return (
    <aside className="w-[22rem] border-l border-ink-200/70 bg-paper-50 flex flex-col overflow-hidden">
      <div className="flex border-b border-ink-200/70 bg-paper-100">
        <TabBtn id="props" current={tab} onClick={setTab} label="Inspect" />
        <TabBtn
          id="issues"
          current={tab}
          onClick={setTab}
          label={`Issues${issueCount ? ` · ${issueCount}` : ""}`}
          badge={errorCount ? "error" : issueCount ? "warn" : undefined}
        />
        <TabBtn id="mood" current={tab} onClick={setTab} label="Theme" />
        <TabBtn id="shop" current={tab} onClick={setTab} label="Shop" />
      </div>

      {/* Summary strip */}
      <div className="px-4 py-2.5 border-b border-ink-200/70 flex items-center justify-between gap-2 text-[11px] text-ink-500 font-mono tabular-nums bg-paper-100/60">
        <span>
          <span className="text-ink-900">{placed.length}</span> pieces
        </span>
        <span>
          <span className="text-ink-900">{formatSqft(totalSqft).replace(" sq ft", "")}</span> sqft
        </span>
        {totalCost > 0 && (
          <span>
            <span className="text-ink-900">${totalCost.toLocaleString()}</span>
          </span>
        )}
        {roomSqft > 0 && (
          <span title="Total room area">
            <span className="text-ink-900">{roomSqft.toFixed(0)}</span> rm
          </span>
        )}
      </div>

      {tab === "props" && <PropertiesTab />}
      {tab === "issues" && <IssuesTab />}
      {tab === "mood" && <MoodTab theme={theme} />}
      {tab === "shop" && <ShopTab />}
    </aside>
  );
}

function TabBtn({
  id,
  current,
  onClick,
  label,
  badge,
}: {
  id: Tab;
  current: Tab;
  onClick: (t: Tab) => void;
  label: string;
  badge?: "error" | "warn";
}) {
  const active = current === id;
  return (
    <button onClick={() => onClick(id)} className={`tab ${active ? "tab-active" : "tab-idle"} relative`}>
      <span className="flex items-center justify-center gap-1.5">
        {label}
        {badge === "error" && <span className="w-1.5 h-1.5 rounded-full bg-red-600" />}
        {badge === "warn" && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Properties (Inspect) tab
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
    return <NoSelectionPanel />;
  }

  const statusOpts: { v: FurnitureStatus | ""; label: string; color: string }[] = [
    { v: "", label: "—", color: "bg-ink-200" },
    { v: "considering", label: "Considering", color: "bg-ink-400" },
    { v: "wishlist", label: "Wishlist", color: "bg-amber-500" },
    { v: "ordered", label: "Ordered", color: "bg-sky-600" },
    { v: "owned", label: "Owned", color: "bg-sage-500" },
  ];

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4 text-sm animate-fade-in">
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-lg shrink-0 ring-1 ring-ink-200"
          style={{ background: selected.colorOverride ?? cat.color }}
        />
        <div className="flex-1 min-w-0">
          <input
            value={selected.label}
            onChange={(e) => updateFurniture(selected.id, { label: e.target.value })}
            className="input input-sm font-medium"
          />
          <div className="text-[11px] text-ink-500 mt-1 truncate">{cat.name}</div>
        </div>
        <button
          onClick={() => updateFurniture(selected.id, { hidden: !selected.hidden })}
          title={selected.hidden ? "Show" : "Hide"}
          className="btn-ghost btn-icon"
        >
          {selected.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      <FieldGroup label="Dimensions (ft)">
        <div className="grid grid-cols-3 gap-2">
          <NumberInput
            label="Width"
            value={selected.widthOverride ?? cat.width}
            onChange={(v) => updateFurniture(selected.id, { widthOverride: v })}
          />
          <NumberInput
            label="Depth"
            value={selected.depthOverride ?? cat.depth}
            onChange={(v) => updateFurniture(selected.id, { depthOverride: v })}
          />
          <NumberInput
            label="Height"
            value={selected.heightOverride ?? cat.height ?? 0}
            onChange={(v) => updateFurniture(selected.id, { heightOverride: v })}
          />
        </div>
      </FieldGroup>

      <FieldGroup label="Position (ft)">
        <div className="grid grid-cols-3 gap-2">
          <NumberInput label="X" value={selected.x} onChange={(v) => updateFurniture(selected.id, { x: v })} />
          <NumberInput label="Y" value={selected.y} onChange={(v) => updateFurniture(selected.id, { y: v })} />
          <div>
            <div className="label">Rotation</div>
            <div className="flex gap-1 mt-1">
              <input
                type="number"
                value={selected.rotation}
                onChange={(e) => updateFurniture(selected.id, { rotation: parseFloat(e.target.value) || 0 })}
                className="input input-sm flex-1"
              />
              <button
                onClick={() => updateFurniture(selected.id, { rotation: (selected.rotation + 90) % 360 })}
                className="btn-outline btn-sm btn-icon"
                title="Rotate 90°"
              >
                <RotateCw className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </FieldGroup>

      <FieldGroup label="Status">
        <div className="flex gap-1">
          {statusOpts.map((opt) => {
            const active = (selected.status ?? "") === opt.v;
            return (
              <button
                key={opt.v}
                onClick={() =>
                  updateFurniture(selected.id, { status: opt.v === "" ? undefined : (opt.v as FurnitureStatus) })
                }
                className={`flex-1 text-[10px] uppercase tracking-wider py-1 rounded border transition-colors flex items-center justify-center gap-1 ${
                  active ? "border-ink-900 bg-ink-900 text-paper-50" : "border-ink-200 hover:border-ink-300"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${opt.color}`} />
                <span className="hidden xl:inline">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </FieldGroup>

      <FieldGroup label="Price & retailer">
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-400">$</span>
            <input
              type="number"
              value={selected.priceUsd ?? ""}
              onChange={(e) =>
                updateFurniture(selected.id, {
                  priceUsd: e.target.value === "" ? undefined : parseFloat(e.target.value),
                })
              }
              placeholder={(() => {
                const [lo, hi] = defaultPrice(cat);
                return `${lo}-${hi}`;
              })()}
              className="input input-sm pl-5"
            />
          </div>
          <input
            type="text"
            value={selected.retailer ?? ""}
            onChange={(e) => updateFurniture(selected.id, { retailer: e.target.value })}
            placeholder="e.g. West Elm"
            className="input input-sm"
          />
        </div>
        <input
          type="url"
          value={selected.productUrl ?? ""}
          onChange={(e) => updateFurniture(selected.id, { productUrl: e.target.value })}
          placeholder="Product URL"
          className="input input-sm mt-2"
        />
        {selected.productUrl && (
          <a
            href={selected.productUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-accent-500 hover:underline mt-1 inline-flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" /> Open
          </a>
        )}
      </FieldGroup>

      <FieldGroup label="Color">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={selected.colorOverride ?? cat.color}
            onChange={(e) => updateFurniture(selected.id, { colorOverride: e.target.value })}
            className="w-10 h-8 border border-ink-200 rounded-md cursor-pointer"
          />
          <input
            type="text"
            value={selected.colorOverride ?? cat.color}
            onChange={(e) => updateFurniture(selected.id, { colorOverride: e.target.value })}
            className="input input-sm flex-1 font-mono text-xs"
          />
          {selected.colorOverride && (
            <button
              onClick={() => updateFurniture(selected.id, { colorOverride: undefined })}
              className="text-[10px] uppercase text-ink-500 hover:text-ink-900"
            >
              Reset
            </button>
          )}
        </div>
      </FieldGroup>

      <FieldGroup label="Photo">
        <div className="flex items-center gap-2">
          {selected.imageDataUrl ? (
            <div className="relative">
              <img
                src={selected.imageDataUrl}
                className="w-16 h-12 object-cover rounded-md ring-1 ring-ink-200"
                alt={selected.label}
              />
              <button
                onClick={() => updateFurniture(selected.id, { imageDataUrl: undefined })}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-ink-900 text-paper-50 grid place-items-center hover:bg-red-700"
                title="Remove photo"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ) : (
            <div className="w-16 h-12 rounded-md border border-dashed border-ink-300 grid place-items-center text-ink-400">
              <ImageIcon className="w-4 h-4" />
            </div>
          )}
          <label className="btn-outline btn-sm cursor-pointer flex-1 justify-center">
            <ImageIcon className="w-3 h-3" />
            {selected.imageDataUrl ? "Replace" : "Upload product photo"}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => updateFurniture(selected.id, { imageDataUrl: String(reader.result) });
                reader.readAsDataURL(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </FieldGroup>

      <FieldGroup label="Notes">
        <textarea
          value={selected.notes ?? ""}
          onChange={(e) => updateFurniture(selected.id, { notes: e.target.value })}
          rows={3}
          placeholder="e.g. West Elm Andes, walnut legs, ordered 5/24"
          className="input resize-y"
        />
      </FieldGroup>

      <FieldGroup label="Replace with catalog item">
        <select
          value={selected.catalogId}
          onChange={(e) => useDesignStore.getState().replaceCatalogId(selected.id, e.target.value)}
          className="input input-sm"
        >
          {CATALOG.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {formatFeet(c.width)}×{formatFeet(c.depth)}
            </option>
          ))}
        </select>
      </FieldGroup>

      <div className="grid grid-cols-3 gap-2 pt-1">
        <button onClick={() => duplicateFurniture(selected.id)} className="btn-outline btn-md">
          <Copy className="w-3.5 h-3.5" /> Dup
        </button>
        <button
          onClick={() => updateFurniture(selected.id, { locked: !selected.locked })}
          className={`btn-md ${selected.locked ? "btn-primary" : "btn-outline"}`}
          title={selected.locked ? "Unlock" : "Lock — prevent accidental moves"}
        >
          {selected.locked ? "Unlock" : "Lock"}
        </button>
        <button
          onClick={() => removeFurniture(selected.id)}
          className="btn-md border-red-600/30 text-red-700 bg-red-50/50 hover:bg-red-100 rounded-lg border"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      </div>

      {cat.recommendedClearance ? (
        <div className="text-[11px] text-ink-500 pt-2 border-t border-ink-200/70">
          Recommended clearance: {formatFeet(cat.recommendedClearance)}.{" "}
          {cat.description}
        </div>
      ) : (
        cat.description && (
          <div className="text-[11px] text-ink-500 pt-2 border-t border-ink-200/70">{cat.description}</div>
        )
      )}
    </div>
  );
}

function BudgetCard({ knownTotal, total }: { knownTotal: number; total: number }) {
  const budget = settings.get().budgetUsd;
  const over = budget && total > budget;
  return (
    <div className={`card p-3 grid grid-cols-2 gap-2 text-xs ${over ? "ring-1 ring-red-300 bg-red-50" : ""}`}>
      <div>
        <div className="label">Booked</div>
        <div className="font-mono text-lg text-ink-900">${knownTotal.toLocaleString()}</div>
      </div>
      <div>
        <div className="label">Est. total</div>
        <div className={`font-mono text-lg ${over ? "text-red-700" : "text-ink-900"}`}>~${Math.round(total).toLocaleString()}</div>
      </div>
      {budget && (
        <div className="col-span-2 pt-1 border-t border-ink-200/70">
          <div className="flex items-center justify-between">
            <span className="label">Budget</span>
            <span className="font-mono text-xs">${budget.toLocaleString()}</span>
          </div>
          <div className="h-1.5 mt-1 rounded-full bg-ink-100 overflow-hidden">
            <div
              className={`h-full ${over ? "bg-red-500" : "bg-sage-500"}`}
              style={{ width: `${Math.min(100, (total / budget) * 100).toFixed(0)}%` }}
            />
          </div>
          <div className="text-[10px] text-ink-500 mt-1">
            {over
              ? `Over budget by ~$${Math.round(total - budget).toLocaleString()}`
              : `${Math.round((1 - total / budget) * 100)}% headroom`}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryBreakdown({ rows, total }: { rows: ShopRow[]; total: number }) {
  const cats = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const v = r.price || (r.priceLow + r.priceHigh) / 2;
      m.set(r.category, (m.get(r.category) ?? 0) + v);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const palette = ["#b45309", "#5d7a5a", "#0369a1", "#7c3aed", "#dc2626", "#1c1917", "#a8a29e"];
  return (
    <div className="card p-3">
      <div className="label mb-2">Cost by category</div>
      <div className="space-y-1">
        {cats.map(([name, v], i) => {
          const pct = total > 0 ? (v / total) * 100 : 0;
          return (
            <div key={name} className="text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 capitalize">
                  <span className="w-2 h-2 rounded-full" style={{ background: palette[i % palette.length] }} />
                  {name}
                </span>
                <span className="font-mono text-ink-500">~${Math.round(v).toLocaleString()}</span>
              </div>
              <div className="h-1 mt-0.5 rounded-full bg-ink-100 overflow-hidden">
                <div className="h-full" style={{ width: `${pct}%`, background: palette[i % palette.length] }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ShopRow = {
  label: string;
  catalogName: string;
  category: string;
  width: number;
  depth: number;
  status: string;
  price: number;
  priceLow: number;
  priceHigh: number;
  retailer: string;
  url: string;
  notes: string;
};

function WalkabilityCard() {
  const placed = useDesignStore((s) => s.placed);
  const rooms = useDesignStore((s) => s.rooms);
  const scores = useMemo(() => computeWalkability({ placed, rooms }), [placed, rooms]);
  if (!rooms.length) return null;
  return (
    <div className="card p-3">
      <div className="label mb-2">Walkability per room</div>
      <ul className="space-y-1.5">
        {scores.map((s) => {
          const color =
            s.score >= 70 ? "bg-sage-500"
            : s.score >= 40 ? "bg-amber-500"
            : "bg-red-500";
          return (
            <li key={s.roomId} className="text-xs">
              <div className="flex items-center justify-between">
                <span className="truncate">{s.roomName}</span>
                <span className={`font-mono text-ink-700`}>{s.score}/100</span>
              </div>
              <div className="h-1 mt-0.5 rounded-full bg-ink-100 overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${s.score}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="text-[10px] text-ink-500 mt-2 leading-relaxed">
        % of room area more than 1.5' from any furniture. Lower = harder to walk through.
      </div>
    </div>
  );
}

function NoSelectionPanel() {
  const pendingFixtureKind = useDesignStore((s) => s.pendingFixtureKind);
  const setPendingFixtureKind = useDesignStore((s) => s.setPendingFixtureKind);
  const toolMode = useDesignStore((s) => s.toolMode);
  const fixtures = useDesignStore((s) => s.fixtures);
  const removeFixture = useDesignStore((s) => s.removeFixture);

  const fixtureKinds: { v: typeof pendingFixtureKind; label: string; color: string }[] = [
    { v: "outlet", label: "Outlet", color: "#1c1917" },
    { v: "switch", label: "Switch", color: "#0369a1" },
    { v: "vent", label: "Vent", color: "#7c3aed" },
    { v: "ceiling-light", label: "Ceiling", color: "#eab308" },
    { v: "wall-light", label: "Wall", color: "#eab308" },
    { v: "radiator", label: "Radiator", color: "#dc2626" },
    { v: "plumbing", label: "Plumbing", color: "#0ea5e9" },
    { v: "sink", label: "Sink", color: "#0ea5e9" },
    { v: "range", label: "Range", color: "#dc2626" },
    { v: "fridge", label: "Fridge", color: "#0369a1" },
    { v: "dishwasher", label: "Dishwasher", color: "#0891b2" },
    { v: "washer-dryer", label: "W/D", color: "#7c3aed" },
    { v: "toilet", label: "Toilet", color: "#0f766e" },
    { v: "shower", label: "Shower", color: "#0ea5e9" },
    { v: "tub", label: "Tub", color: "#0ea5e9" },
  ];

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4 text-sm">
      {toolMode === "fixture" ? (
        <div className="card p-3 space-y-2 animate-slide-up">
          <div className="label">Place fixture · click canvas to drop</div>
          <div className="grid grid-cols-2 gap-1.5">
            {fixtureKinds.map((k) => {
              const active = pendingFixtureKind === k.v;
              return (
                <button
                  key={k.v ?? "x"}
                  onClick={() => setPendingFixtureKind(k.v)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs ${
                    active ? "border-ink-900 bg-ink-900 text-paper-50" : "border-ink-200 hover:bg-ink-100"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: k.color }} />
                  <span>{k.label}</span>
                </button>
              );
            })}
          </div>
          <div className="text-[11px] text-ink-500 leading-snug pt-1">
            Tip: shift-click an existing fixture on the canvas to remove it.
          </div>
        </div>
      ) : (
        <div className="grid place-items-center text-center py-4">
          <div className="max-w-[240px]">
            <div className="w-12 h-12 rounded-full bg-paper-200 mx-auto mb-3 grid place-items-center">
              <ListTree className="w-5 h-5 text-ink-400" />
            </div>
            <div className="font-medium text-sm text-ink-700 mb-1">Nothing selected</div>
            <div className="text-xs text-ink-500 leading-snug">
              Click a piece on the canvas to edit it. Shift-click to add to selection.
            </div>
          </div>
        </div>
      )}

      {fixtures.length > 0 && (
        <div className="card p-3 animate-slide-up">
          <div className="label mb-2">Fixtures · {fixtures.length}</div>
          <ul className="space-y-1">
            {fixtures.map((f) => {
              const k = fixtureKinds.find((x) => x.v === f.kind);
              return (
                <li key={f.id} className="flex items-center gap-2 text-xs py-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: k?.color ?? "#1c1917" }} />
                  <span className="flex-1 capitalize">{f.kind.replace("-", " ")}</span>
                  <span className="font-mono text-ink-400">
                    {f.position.x.toFixed(1)}, {f.position.y.toFixed(1)}
                  </span>
                  <button
                    onClick={() => removeFixture(f.id)}
                    className="text-ink-400 hover:text-red-700"
                    title="Remove"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      {label && <div className="label">{label}</div>}
      <input
        type="number"
        step={0.1}
        value={Number.isFinite(value) ? Number(value.toFixed(3)) : 0}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
        className="input input-sm mt-1 font-mono tabular-nums"
      />
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
  const trafficPaths = useDesignStore((s) => s.trafficPaths);
  const setSelected = useDesignStore((s) => s.setSelected);
  const fixtures = useDesignStore((s) => s.fixtures);
  const issues = useMemo(
    () => runValidation({ placed, walls, doors, trafficPaths, fixtures }),
    [placed, walls, doors, trafficPaths, fixtures],
  );

  if (!issues.length) {
    return (
      <div className="flex-1 grid place-items-center p-6 text-center animate-fade-in">
        <div className="max-w-[260px]">
          <div className="w-12 h-12 rounded-full bg-sage-50 mx-auto mb-3 grid place-items-center">
            <CheckCircle2 className="w-6 h-6 text-sage-500" strokeWidth={2} />
          </div>
          <div className="font-medium text-sm mb-1 text-sage-600">All clear</div>
          <div className="text-xs text-ink-500 leading-snug">
            Nothing overlaps, no walls crossed, all clearances look reasonable.
            {!walls.length && (
              <div className="mt-2 text-[10px] uppercase tracking-wider">
                Draw walls or use Auto-detect to enable wall checks.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-3 space-y-1.5 animate-fade-in">
      {issues.map((i) => {
        const Icon = i.severity === "error" ? AlertTriangle : i.severity === "warn" ? AlertTriangle : Info;
        const colors =
          i.severity === "error"
            ? "border-red-200 bg-red-50 hover:bg-red-100"
            : i.severity === "warn"
              ? "border-amber-200 bg-amber-50 hover:bg-amber-100"
              : "border-ink-200 bg-paper-100 hover:bg-paper-200";
        const iconColor =
          i.severity === "error" ? "text-red-600" : i.severity === "warn" ? "text-amber-600" : "text-ink-500";
        return (
          <button
            key={i.id}
            onClick={() => i.furnitureId && setSelected(i.furnitureId)}
            className={`w-full text-left text-sm border rounded-lg p-2.5 flex items-start gap-2 ${colors}`}
          >
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColor}`} />
            <span className="flex-1 leading-snug">{i.message}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Theme / Mood tab
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
          apiKey: getApiKey(),
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
    <div className="flex-1 overflow-auto p-4 space-y-4 text-sm animate-fade-in">
      <div>
        <div className="label mb-1.5">Theme</div>
        <select
          value={theme ?? ""}
          onChange={(e) => setTheme((e.target.value || null) as Theme | null)}
          className="input"
        >
          <option value="">— pick a style —</option>
          {ALL_THEMES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {palette && (
        <div className="card p-4 space-y-3 animate-slide-up">
          <div className="text-[11px] text-ink-600 leading-snug italic">{palette.notes}</div>

          <div>
            <div className="label mb-1.5">Palette</div>
            <div className="flex gap-1.5">
              {palette.swatches.map((s) => (
                <div key={s.hex} title={`${s.label} ${s.hex}`} className="flex-1">
                  <div className="h-12 rounded-md ring-1 ring-ink-200" style={{ background: s.hex }} />
                  <div className="text-[9px] mt-1 text-center truncate text-ink-500 uppercase tracking-wider">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="label mb-1.5">Paint pairings</div>
            <ul className="space-y-1.5">
              {palette.paintIdeas.map((p) => (
                <li key={p.hex} className="flex items-center gap-2 text-xs">
                  <span className="w-6 h-6 rounded-md ring-1 ring-ink-200" style={{ background: p.hex }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-[10px] text-ink-500 uppercase tracking-wider">{p.brand}</div>
                  </div>
                  <span className="text-[10px] font-mono text-ink-400">{p.hex.toUpperCase()}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="label mb-1.5">Materials</div>
            <div className="flex flex-wrap gap-1">
              {palette.materials.map((m) => (
                <span
                  key={m}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-paper-200 border border-ink-200/70 text-ink-700"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {theme && (
        <button onClick={fetchRecs} disabled={loading} className="btn-primary btn-md w-full">
          <Sparkles className={`w-3.5 h-3.5 ${loading ? "animate-pulse" : ""}`} />
          {loading ? "Thinking…" : recs.length ? "Refresh recommendations" : "Get recommendations"}
        </button>
      )}
      {recsSource && (
        <div className="text-[10px] text-ink-400 uppercase tracking-wider">
          via {recsSource === "claude" ? "Claude API" : "Local catalog"}
        </div>
      )}

      {recs.map((r, i) => {
        const inCatalog = r.catalogId ? getCatalogItem(r.catalogId) : null;
        return (
          <div key={i} className="card p-3 animate-slide-up">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-sm">{r.name}</div>
              {inCatalog && (
                <button
                  onClick={() => setToolMode("place", inCatalog.id)}
                  className="btn-accent btn-sm shrink-0"
                >
                  Place
                </button>
              )}
            </div>
            <div className="text-[11px] text-ink-500 mt-0.5 font-mono">
              {r.category}
              {r.widthFt && r.depthFt
                ? ` · ${formatFeet(r.widthFt)} × ${formatFeet(r.depthFt)}`
                : inCatalog
                  ? ` · ${formatFeet(inCatalog.width)} × ${formatFeet(inCatalog.depth)}`
                  : ""}
            </div>
            <div className="text-xs mt-1.5 leading-snug">{r.why}</div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shopping list tab
// ---------------------------------------------------------------------------

function ShopTab() {
  const placed = useDesignStore((s) => s.placed);
  const rooms = useDesignStore((s) => s.rooms);
  const setSelected = useDesignStore((s) => s.setSelected);
  const [groupBy, setGroupBy] = useState<"status" | "room">("status");
  const rows = buildShoppingList();

  const roomNameForPiece = (label: string): string => {
    const p = placed.find((x) => x.label === label);
    if (!p) return "Unassigned";
    const id = findRoomAt({ x: p.x, y: p.y }, rooms);
    return rooms.find((r) => r.id === id)?.name ?? "Unassigned";
  };

  const grouped = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = groupBy === "status" ? r.status || "unassigned" : roomNameForPiece(r.label);
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, groupBy, rooms, placed]);

  const total = rows.reduce((acc, r) => acc + (r.price || (r.priceLow + r.priceHigh) / 2), 0);
  const knownTotal = rows.reduce((acc, r) => acc + (r.price || 0), 0);

  const shareUrl = () => {
    const url = encodeShareUrl();
    navigator.clipboard.writeText(url);
    alert("Share URL copied to clipboard. The viewer needs to upload the same floor plan separately.");
  };

  return (
    <div className="flex-1 overflow-auto p-4 space-y-3 text-sm animate-fade-in">
      <div className="grid grid-cols-2 gap-2">
        <button onClick={downloadShoppingCsv} disabled={!rows.length} className="btn-outline btn-md">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
        <button onClick={shareUrl} disabled={!placed.length} className="btn-outline btn-md">
          <Link2 className="w-3.5 h-3.5" /> Share URL
        </button>
      </div>

      {rows.length > 0 && (
        <BudgetCard knownTotal={knownTotal} total={total} />
      )}

      {rows.length > 0 && <CategoryBreakdown rows={rows} total={total} />}

      <WalkabilityCard />

      <div className="seg">
        {(["status", "room"] as const).map((g) => (
          <button
            key={g}
            onClick={() => setGroupBy(g)}
            className={`seg-btn flex-1 ${groupBy === g ? "seg-btn-active" : ""}`}
          >
            By {g}
          </button>
        ))}
      </div>

      {Array.from(grouped.entries()).map(([key, items]) => {
        const labelsStatus: Record<string, string> = {
          owned: "Owned",
          ordered: "Ordered",
          wishlist: "Wishlist",
          considering: "Considering",
          unassigned: "Unassigned",
        };
        const dotColorStatus: Record<string, string> = {
          owned: "bg-sage-500",
          ordered: "bg-sky-600",
          wishlist: "bg-amber-500",
          considering: "bg-ink-400",
          unassigned: "bg-ink-200",
        };
        const headerLabel = groupBy === "status" ? labelsStatus[key] ?? key : key;
        const groupTotal = items.reduce((acc, r) => acc + (r.price || (r.priceLow + r.priceHigh) / 2), 0);
        return (
          <div key={key} className="card overflow-hidden">
            <div className="px-3 py-2 bg-paper-100 border-b border-ink-200/70 flex items-center gap-2">
              {groupBy === "status" ? (
                <span className={`w-2 h-2 rounded-full ${dotColorStatus[key] ?? "bg-ink-200"}`} />
              ) : (
                <span className="w-2 h-2 rounded-full bg-accent-500" />
              )}
              <span className="text-[11px] uppercase tracking-wider font-medium">{headerLabel}</span>
              <span className="ml-auto text-[10px] font-mono text-ink-500">
                {items.length} · ~${Math.round(groupTotal).toLocaleString()}
              </span>
            </div>
            <ul>
              {items.map((r, i) => {
                const p = placed.find((x) => x.label === r.label && x.catalogId);
                return (
                  <li
                    key={i}
                    onClick={() => p && setSelected(p.id)}
                    className="px-3 py-2 border-t border-ink-200/40 first:border-t-0 hover:bg-ink-100 cursor-pointer flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{r.label}</div>
                      <div className="text-[10px] text-ink-500 font-mono truncate">
                        {r.catalogName} · {formatFeet(r.width)}×{formatFeet(r.depth)}
                        {r.retailer && ` · ${r.retailer}`}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-mono tabular-nums">
                        {r.price ? `$${r.price.toLocaleString()}` : (
                          <span className="text-ink-400">~${Math.round((r.priceLow + r.priceHigh) / 2)}</span>
                        )}
                      </div>
                      {r.url && (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] text-accent-500 hover:underline inline-flex items-center gap-0.5"
                        >
                          <ExternalLink className="w-2.5 h-2.5" /> link
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {!rows.length && (
        <div className="text-xs text-ink-500 text-center py-8">Place furniture to start your shopping list.</div>
      )}
    </div>
  );
}
