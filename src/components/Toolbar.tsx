"use client";

import { useEffect, useRef, useState } from "react";
import {
  Upload,
  MousePointer2,
  Ruler,
  Square,
  DoorOpen,
  Sparkles,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  Tag as TagIcon,
  Grid3x3,
  Download,
  ChevronDown,
  StickyNote,
  FolderOpen,
  Move3d,
  Sun,
  Plug,
  Layers as LayersIcon,
} from "lucide-react";
import type { LayerVisibility } from "@/lib/types";
import { useDesignStore, useTemporalStore } from "@/lib/store";
import { listLayouts, saveCurrentAs, loadLayout, deleteLayout, overwriteLayout, renameLayout } from "@/lib/persistence";
import type { SavedLayout, ToolMode } from "@/lib/types";

export default function Toolbar() {
  const fileRef = useRef<HTMLInputElement>(null);

  const floorPlan = useDesignStore((s) => s.floorPlan);
  const toolMode = useDesignStore((s) => s.toolMode);
  const clearanceMode = useDesignStore((s) => s.clearanceMode);
  const showDimensions = useDesignStore((s) => s.showDimensions);
  const showGrid = useDesignStore((s) => s.showGrid);
  const zoom = useDesignStore((s) => s.zoom);
  const view = useDesignStore((s) => s.view);

  const setFloorPlan = useDesignStore((s) => s.setFloorPlan);
  const setToolMode = useDesignStore((s) => s.setToolMode);
  const setClearanceMode = useDesignStore((s) => s.setClearanceMode);
  const toggleDimensions = useDesignStore((s) => s.toggleDimensions);
  const toggleGrid = useDesignStore((s) => s.toggleGrid);
  const reset = useDesignStore((s) => s.reset);
  const setZoom = useDesignStore((s) => s.setZoom);
  const fitToView = useDesignStore((s) => s.fitToView);
  const setView = useDesignStore((s) => s.setView);

  const [, force] = useState(0);
  useEffect(() => useTemporalStore.subscribe(() => force((x) => x + 1)), []);
  const { undo, redo, pastStates, futureStates } = useTemporalStore.getState();
  const canUndo = pastStates.length > 0;
  const canRedo = futureStates.length > 0;

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new Image();
      img.onload = () => {
        setFloorPlan({
          imageDataUrl: dataUrl,
          imagePxWidth: img.width,
          imagePxHeight: img.height,
          pixelsPerFoot: null,
          calibration: null,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const calibrated = !!floorPlan?.pixelsPerFoot;

  return (
    <header className="h-14 border-b border-ink-200/70 bg-paper-50/95 backdrop-blur-md flex items-center px-4 gap-1.5 overflow-x-auto shadow-soft">
      <div className="flex items-center gap-2 pr-3 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-ink-900 grid place-items-center text-paper-50">
          <Square className="w-3.5 h-3.5" strokeWidth={2.5} />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-display text-base font-medium tracking-tight">Plan</span>
          <span className="text-[9px] uppercase tracking-[0.12em] text-ink-500">Studio</span>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <IconBtn icon={<Upload className="w-3.5 h-3.5" />} label="Upload" onClick={() => fileRef.current?.click()} />

      <LayoutsMenu />

      <AutoDetectButton />

      <div className="divider-v" />

      <IconBtn
        icon={<Undo2 className="w-3.5 h-3.5" />}
        title="Undo (⌘Z)"
        onClick={() => undo()}
        disabled={!canUndo}
        compact
      />
      <IconBtn
        icon={<Redo2 className="w-3.5 h-3.5" />}
        title="Redo (⌘⇧Z)"
        onClick={() => redo()}
        disabled={!canRedo}
        compact
      />

      <div className="divider-v" />

      {/* Tool group */}
      <div className="seg">
        <ToolBtn mode="select" current={toolMode} onClick={setToolMode} icon={<MousePointer2 className="w-3.5 h-3.5" />} label="V" />
        <ToolBtn
          mode="calibrate"
          current={toolMode}
          onClick={setToolMode}
          icon={<Ruler className="w-3.5 h-3.5" />}
          label="Cal"
          disabled={!floorPlan}
        />
        <ToolBtn
          mode="draw-wall"
          current={toolMode}
          onClick={setToolMode}
          icon={<Square className="w-3.5 h-3.5" />}
          label="W"
          disabled={!calibrated}
        />
        <ToolBtn
          mode="draw-door"
          current={toolMode}
          onClick={setToolMode}
          icon={<DoorOpen className="w-3.5 h-3.5" />}
          label="D"
          disabled={!calibrated}
        />
        <ToolBtn
          mode="measure"
          current={toolMode}
          onClick={setToolMode}
          icon={<Ruler className="w-3.5 h-3.5" />}
          label="M"
          disabled={!calibrated}
        />
        <ToolBtn
          mode="traffic"
          current={toolMode}
          onClick={setToolMode}
          icon={<Move3d className="w-3.5 h-3.5" />}
          label="T"
          disabled={!calibrated}
        />
        <ToolBtn
          mode="fixture"
          current={toolMode}
          onClick={(m) => {
            setToolMode(m);
            useDesignStore.getState().setPendingFixtureKind("outlet");
          }}
          icon={<Plug className="w-3.5 h-3.5" />}
          label="O"
          disabled={!calibrated}
        />
        <ToolBtn
          mode="note"
          current={toolMode}
          onClick={setToolMode}
          icon={<StickyNote className="w-3.5 h-3.5" />}
          label="N"
          disabled={!calibrated}
        />
      </div>

      <div className="divider-v" />

      <Toggle active={showDimensions} onClick={toggleDimensions} icon={<TagIcon className="w-3.5 h-3.5" />} label="Labels" />
      <Toggle active={showGrid} onClick={toggleGrid} icon={<Grid3x3 className="w-3.5 h-3.5" />} label="Grid" />
      <SunPathToggle />
      <LayersMenu />

      <div className="divider-v" />

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="label">Clearance</span>
        <div className="seg">
          {(["off", "selected", "all"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setClearanceMode(v)}
              className={`seg-btn ${clearanceMode === v ? "seg-btn-active" : ""}`}
            >
              {v === "selected" ? "Sel" : v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1.5 shrink-0">
        <div className="seg">
          {(["2d", "3d", "compare"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`seg-btn flex items-center gap-1 ${view === v ? "seg-btn-active" : ""}`}
            >
              {v === "compare" ? "AB" : v.toUpperCase()}
            </button>
          ))}
        </div>

        <ExportPngButton />
        <IconBtn icon={<ZoomOut className="w-3.5 h-3.5" />} onClick={() => setZoom(Math.max(0.1, zoom / 1.2))} compact />
        <span className="text-[11px] font-mono tabular-nums w-10 text-center text-ink-500">{Math.round(zoom * 100)}%</span>
        <IconBtn icon={<ZoomIn className="w-3.5 h-3.5" />} onClick={() => setZoom(Math.min(8, zoom * 1.2))} compact />
        <IconBtn icon={<Maximize2 className="w-3.5 h-3.5" />} onClick={() => fitToView()} title="Fit to view (F)" compact />
        <button
          onClick={() => {
            if (confirm("Clear floor plan and all placed furniture?")) reset();
          }}
          className="btn-ghost btn-icon"
          title="Reset"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}

function IconBtn({
  icon,
  label,
  title,
  onClick,
  disabled,
  compact,
}: {
  icon: React.ReactNode;
  label?: string;
  title?: string;
  onClick: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      className={`btn-outline btn-md shrink-0 ${compact ? "btn-icon" : ""}`}
    >
      {icon}
      {label && !compact && <span>{label}</span>}
    </button>
  );
}

function ToolBtn({
  mode,
  current,
  onClick,
  icon,
  label,
  disabled,
}: {
  mode: ToolMode;
  current: ToolMode;
  onClick: (m: ToolMode) => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  const active = current === mode;
  return (
    <button
      onClick={() => onClick(mode)}
      disabled={disabled}
      title={mode}
      className={`seg-btn flex items-center gap-1 ${active ? "seg-btn-active" : ""} disabled:opacity-30`}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

function Toggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`btn-md shrink-0 ${active ? "btn-primary" : "btn-outline"}`}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Sun path toggle
// ---------------------------------------------------------------------------

function SunPathToggle() {
  const showSunPath = useDesignStore((s) => s.showSunPath);
  const toggleSunPath = useDesignStore((s) => s.toggleSunPath);
  return (
    <button
      onClick={toggleSunPath}
      title="Sun path overlay"
      className={`btn-md shrink-0 ${showSunPath ? "btn-primary" : "btn-outline"}`}
    >
      <Sun className="w-3.5 h-3.5" />
      <span className="hidden lg:inline">Sun</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Layers menu — toggle visibility of every element type
// ---------------------------------------------------------------------------

function LayersMenu() {
  const [open, setOpen] = useState(false);
  const layers = useDesignStore((s) => s.layers);
  const setLayer = useDesignStore((s) => s.setLayer);

  const rows: { key: keyof LayerVisibility; label: string }[] = [
    { key: "furniture", label: "Furniture" },
    { key: "walls", label: "Walls" },
    { key: "doors", label: "Doors" },
    { key: "windows", label: "Windows" },
    { key: "rooms", label: "Rooms" },
    { key: "annotations", label: "Notes & measurements" },
    { key: "trafficPaths", label: "Traffic paths" },
    { key: "fixtures", label: "Fixtures (outlets, etc)" },
    { key: "zones", label: "Conversation / TV zones" },
  ];

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Layers"
        className="btn-outline btn-md"
      >
        <LayersIcon className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">Layers</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 card shadow-float z-20 w-56 p-2 animate-slide-up">
            <div className="label px-2 py-1">Visibility</div>
            {rows.map((r) => (
              <label
                key={r.key}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-ink-100 cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  checked={layers[r.key]}
                  onChange={(e) => setLayer(r.key, e.target.checked)}
                  className="accent-accent-500"
                />
                <span className="flex-1">{r.label}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layouts dropdown
// ---------------------------------------------------------------------------

function LayoutsMenu() {
  const [open, setOpen] = useState(false);
  const [layouts, setLayouts] = useState<SavedLayout[]>([]);
  const refresh = () => setLayouts(listLayouts());
  useEffect(() => {
    if (open) refresh();
  }, [open]);

  return (
    <div className="relative shrink-0">
      <button onClick={() => setOpen((o) => !o)} className="btn-outline btn-md">
        <FolderOpen className="w-3.5 h-3.5" />
        <span>Layouts</span>
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 card shadow-float z-20 w-80 p-2 animate-slide-up">
            <button
              onClick={() => {
                const name = prompt("Name this layout:");
                if (name) {
                  saveCurrentAs(name);
                  refresh();
                }
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-ink-100 flex items-center gap-2"
            >
              <span className="w-5 h-5 rounded-md bg-accent-500 text-white grid place-items-center text-xs">+</span>
              <span>Save current as…</span>
            </button>
            <div className="border-t border-ink-200/70 my-1" />
            {layouts.length === 0 ? (
              <div className="px-3 py-3 text-xs text-ink-500">No saved layouts yet.</div>
            ) : (
              <ul className="max-h-72 overflow-auto">
                {layouts.map((l) => (
                  <li key={l.id} className="group">
                    <div className="flex items-center px-2 py-2 hover:bg-ink-100 rounded-lg gap-1">
                      <button
                        onClick={() => {
                          loadLayout(l.id);
                          setOpen(false);
                        }}
                        className="flex-1 text-left truncate"
                      >
                        <div className="font-medium text-sm truncate">{l.name}</div>
                        <div className="text-[10px] text-ink-500 mt-0.5 font-mono">
                          {new Date(l.updatedAt).toLocaleString()} · {l.placed.length} pieces
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Overwrite "${l.name}" with current scene?`)) {
                            overwriteLayout(l.id);
                            refresh();
                          }
                        }}
                        title="Overwrite"
                        className="opacity-0 group-hover:opacity-100 text-[10px] uppercase tracking-wider text-ink-500 hover:text-ink-900 px-1.5"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          const name = prompt("Rename:", l.name);
                          if (name) {
                            renameLayout(l.id, name);
                            refresh();
                          }
                        }}
                        title="Rename"
                        className="opacity-0 group-hover:opacity-100 text-xs text-ink-500 hover:text-ink-900 px-1"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${l.name}"?`)) {
                            deleteLayout(l.id);
                            refresh();
                          }
                        }}
                        title="Delete"
                        className="opacity-0 group-hover:opacity-100 text-xs text-red-600 hover:text-red-800 px-1"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auto-detect
// ---------------------------------------------------------------------------

function AutoDetectButton() {
  const floorPlan = useDesignStore((s) => s.floorPlan);
  const setRooms = useDesignStore((s) => s.setRooms);
  const setDoors = useDesignStore((s) => s.setDoors);
  const [busy, setBusy] = useState(false);
  const ppf = floorPlan?.pixelsPerFoot ?? null;

  const run = async () => {
    if (!floorPlan || !ppf) return;
    setBusy(true);
    try {
      const base64 = floorPlan.imageDataUrl.split(",")[1];
      const mediaType = floorPlan.imageDataUrl.match(/^data:(.*?);/)?.[1] ?? "image/png";
      const res = await fetch("/api/detect-rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mediaType,
          pixelsPerFoot: ppf,
          imageWidth: floorPlan.imagePxWidth,
          imageHeight: floorPlan.imagePxHeight,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        rooms?: { name: string; x: number; y: number; width: number; height: number }[];
        doors?: { label: string; x: number; y: number; widthFt: number; angleDeg: number; swing: "left" | "right" }[];
      };
      if (data.error) {
        alert(`Detection failed: ${data.error}`);
        return;
      }
      const rooms = (data.rooms ?? []).map((r) => ({
        id: crypto.randomUUID(),
        name: r.name,
        polygon: [
          { x: r.x / ppf, y: r.y / ppf },
          { x: (r.x + r.width) / ppf, y: r.y / ppf },
          { x: (r.x + r.width) / ppf, y: (r.y + r.height) / ppf },
          { x: r.x / ppf, y: (r.y + r.height) / ppf },
        ],
      }));
      const doors = (data.doors ?? []).map((d) => ({
        id: crypto.randomUUID(),
        position: { x: d.x / ppf, y: d.y / ppf },
        widthFt: d.widthFt,
        angleDeg: d.angleDeg,
        swing: d.swing,
        openDeg: 90,
        label: d.label,
      }));
      setRooms(rooms);
      setDoors(doors);
    } catch (err) {
      alert(`Detection error: ${err}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button onClick={run} disabled={!ppf || busy} className="btn-outline btn-md shrink-0">
      <Sparkles className={`w-3.5 h-3.5 ${busy ? "animate-pulse text-accent-500" : "text-accent-500"}`} />
      <span>{busy ? "Detecting…" : "Auto-detect"}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// PNG export
// ---------------------------------------------------------------------------

function ExportPngButton() {
  const floorPlan = useDesignStore((s) => s.floorPlan);

  const handle = () => {
    const stage = (window as unknown as { __designStage?: { toDataURL: (opts: { pixelRatio: number }) => string } })
      .__designStage;
    if (!stage) {
      alert("Canvas not ready.");
      return;
    }
    const dataUrl = stage.toDataURL({ pixelRatio: 2 });
    const link = document.createElement("a");
    link.download = `layout-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <button onClick={handle} disabled={!floorPlan} className="btn-outline btn-md btn-icon" title="Export PNG">
      <Download className="w-3.5 h-3.5" />
    </button>
  );
}
