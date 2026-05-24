"use client";

import { useEffect, useRef, useState } from "react";
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
  const showWalls = useDesignStore((s) => s.showWalls);
  const zoom = useDesignStore((s) => s.zoom);

  const setFloorPlan = useDesignStore((s) => s.setFloorPlan);
  const setToolMode = useDesignStore((s) => s.setToolMode);
  const setClearanceMode = useDesignStore((s) => s.setClearanceMode);
  const toggleDimensions = useDesignStore((s) => s.toggleDimensions);
  const toggleGrid = useDesignStore((s) => s.toggleGrid);
  const toggleWalls = useDesignStore((s) => s.toggleWalls);
  const reset = useDesignStore((s) => s.reset);
  const setZoom = useDesignStore((s) => s.setZoom);

  const { undo, redo, pastStates, futureStates } = useTemporalStore.getState();
  const [, force] = useState(0);
  useEffect(() => useTemporalStore.subscribe(() => force((x) => x + 1)), []);

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

  return (
    <div className="h-12 border-b border-ink/10 bg-paper flex items-center px-3 gap-2 overflow-x-auto">
      <div className="font-semibold text-lg pr-2 shrink-0">Studio</div>

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
      <button
        onClick={() => fileRef.current?.click()}
        className="px-2.5 py-1.5 text-sm rounded border border-ink/20 hover:bg-ink/5 shrink-0"
      >
        Upload
      </button>

      <LayoutsMenu />

      <AutoDetectButton />

      <div className="h-6 w-px bg-ink/10 mx-0.5 shrink-0" />

      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={() => undo()}
          disabled={!canUndo}
          title="Undo (⌘Z)"
          className="px-2 py-1 text-sm rounded border border-ink/20 hover:bg-ink/5 disabled:opacity-30"
        >
          ↶
        </button>
        <button
          onClick={() => redo()}
          disabled={!canRedo}
          title="Redo (⌘⇧Z)"
          className="px-2 py-1 text-sm rounded border border-ink/20 hover:bg-ink/5 disabled:opacity-30"
        >
          ↷
        </button>
      </div>

      <div className="h-6 w-px bg-ink/10 mx-0.5 shrink-0" />

      {/* Tool mode selector */}
      <ToolBtn mode="select" current={toolMode} onClick={setToolMode} label="Select" shortcut="V" />
      <ToolBtn mode="calibrate" current={toolMode} onClick={setToolMode} label="Calibrate" disabled={!floorPlan} />
      <ToolBtn mode="draw-wall" current={toolMode} onClick={setToolMode} label="Walls" disabled={!floorPlan?.pixelsPerFoot} shortcut="W" />
      <ToolBtn mode="draw-door" current={toolMode} onClick={setToolMode} label="Door" disabled={!floorPlan?.pixelsPerFoot} shortcut="D" />
      <ToolBtn mode="measure" current={toolMode} onClick={setToolMode} label="Measure" disabled={!floorPlan?.pixelsPerFoot} shortcut="M" />
      <ToolBtn mode="note" current={toolMode} onClick={setToolMode} label="Note" disabled={!floorPlan?.pixelsPerFoot} shortcut="N" />

      <div className="h-6 w-px bg-ink/10 mx-0.5 shrink-0" />

      <ToggleBtn active={showDimensions} onClick={toggleDimensions} label="Labels" />
      <ToggleBtn active={showWalls} onClick={toggleWalls} label="Walls" />
      <ToggleBtn active={showGrid} onClick={toggleGrid} label="Grid" />

      <div className="h-6 w-px bg-ink/10 mx-0.5 shrink-0" />

      <span className="text-xs text-ink/60 pr-1 shrink-0">Clr:</span>
      <SegBtn
        value={clearanceMode}
        options={[
          { v: "off", label: "Off" },
          { v: "selected", label: "Sel" },
          { v: "all", label: "All" },
        ]}
        onChange={(v) => setClearanceMode(v as "off" | "selected" | "all")}
      />

      <div className="ml-auto flex items-center gap-1.5 shrink-0">
        <ExportPngButton />
        <button
          onClick={() => setZoom(Math.max(0.1, zoom / 1.2))}
          className="px-2 py-1 text-sm rounded border border-ink/20 hover:bg-ink/5"
        >
          −
        </button>
        <span className="text-xs tabular-nums w-9 text-center">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom(Math.min(8, zoom * 1.2))}
          className="px-2 py-1 text-sm rounded border border-ink/20 hover:bg-ink/5"
        >
          +
        </button>
        <button
          onClick={() => {
            if (confirm("Clear floor plan and all placed furniture?")) reset();
          }}
          className="px-2.5 py-1.5 text-sm rounded border border-ink/20 hover:bg-ink/5 ml-1"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function ToolBtn({
  mode,
  current,
  onClick,
  label,
  disabled,
  shortcut,
}: {
  mode: ToolMode;
  current: ToolMode;
  onClick: (m: ToolMode) => void;
  label: string;
  disabled?: boolean;
  shortcut?: string;
}) {
  const active = current === mode;
  return (
    <button
      onClick={() => onClick(mode)}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={`px-2.5 py-1.5 text-sm rounded border shrink-0 ${
        active ? "bg-accent text-white border-accent" : "border-ink/20 hover:bg-ink/5"
      } disabled:opacity-30`}
    >
      {label}
    </button>
  );
}

function ToggleBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1.5 text-sm rounded border shrink-0 ${
        active ? "bg-ink text-paper border-ink" : "border-ink/20 hover:bg-ink/5"
      }`}
    >
      {label}
    </button>
  );
}

function SegBtn({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { v: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex rounded border border-ink/20 overflow-hidden text-sm shrink-0">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`px-2 py-1 ${value === o.v ? "bg-ink text-paper" : "hover:bg-ink/5"}`}
        >
          {o.label}
        </button>
      ))}
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

  const handleSaveAs = () => {
    const name = prompt("Name this layout:");
    if (!name) return;
    saveCurrentAs(name);
    refresh();
  };

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-2.5 py-1.5 text-sm rounded border border-ink/20 hover:bg-ink/5"
      >
        Layouts ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 bg-paper border border-ink/20 rounded shadow-lg z-20 w-72 p-2">
            <button
              onClick={() => {
                handleSaveAs();
                setOpen(false);
              }}
              className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-ink/5"
            >
              + Save current as…
            </button>
            <div className="border-t border-ink/10 my-1" />
            {layouts.length === 0 ? (
              <div className="px-2 py-2 text-xs text-ink/50">No saved layouts yet.</div>
            ) : (
              <ul className="max-h-72 overflow-auto">
                {layouts.map((l) => (
                  <li key={l.id} className="text-sm group">
                    <div className="flex items-center px-2 py-1.5 hover:bg-ink/5 rounded gap-1">
                      <button
                        onClick={() => {
                          loadLayout(l.id);
                          setOpen(false);
                        }}
                        className="flex-1 text-left truncate"
                        title={l.name}
                      >
                        {l.name}
                        <div className="text-[10px] text-ink/50">
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
                        title="Overwrite with current"
                        className="opacity-0 group-hover:opacity-100 px-1 text-xs text-ink/60 hover:text-ink"
                      >
                        save
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
                        className="opacity-0 group-hover:opacity-100 px-1 text-xs text-ink/60 hover:text-ink"
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
                        className="opacity-0 group-hover:opacity-100 px-1 text-xs text-red-700 hover:text-red-900"
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
// Auto-detect rooms via Claude Vision
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
    <button
      onClick={run}
      disabled={!ppf || busy}
      title="Use Claude vision to auto-detect rooms and doors"
      className="px-2.5 py-1.5 text-sm rounded border border-ink/20 hover:bg-ink/5 disabled:opacity-30 shrink-0"
    >
      {busy ? "Detecting…" : "✨ Auto-detect"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// PNG export
// ---------------------------------------------------------------------------

function ExportPngButton() {
  const floorPlan = useDesignStore((s) => s.floorPlan);
  const placed = useDesignStore((s) => s.placed);
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
    <button
      onClick={handle}
      disabled={!floorPlan}
      title={`Export PNG (${placed.length} pieces)`}
      className="px-2 py-1 text-sm rounded border border-ink/20 hover:bg-ink/5 disabled:opacity-30"
    >
      PNG
    </button>
  );
}
