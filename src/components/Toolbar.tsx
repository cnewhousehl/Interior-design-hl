"use client";

import { useRef } from "react";
import { useDesignStore } from "@/lib/store";

export default function Toolbar() {
  const fileRef = useRef<HTMLInputElement>(null);
  const floorPlan = useDesignStore((s) => s.floorPlan);
  const toolMode = useDesignStore((s) => s.toolMode);
  const clearanceMode = useDesignStore((s) => s.clearanceMode);
  const showDimensions = useDesignStore((s) => s.showDimensions);
  const showGrid = useDesignStore((s) => s.showGrid);
  const zoom = useDesignStore((s) => s.zoom);

  const setFloorPlan = useDesignStore((s) => s.setFloorPlan);
  const setToolMode = useDesignStore((s) => s.setToolMode);
  const setClearanceMode = useDesignStore((s) => s.setClearanceMode);
  const toggleDimensions = useDesignStore((s) => s.toggleDimensions);
  const toggleGrid = useDesignStore((s) => s.toggleGrid);
  const reset = useDesignStore((s) => s.reset);
  const setZoom = useDesignStore((s) => s.setZoom);

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
    <div className="h-12 border-b border-ink/10 bg-paper flex items-center px-3 gap-2">
      <div className="font-semibold text-lg pr-3">Studio</div>

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
        className="px-3 py-1.5 text-sm rounded border border-ink/20 hover:bg-ink/5"
      >
        Upload floor plan
      </button>

      <button
        onClick={() => setToolMode(toolMode === "calibrate" ? "select" : "calibrate")}
        disabled={!floorPlan}
        className={`px-3 py-1.5 text-sm rounded border ${
          toolMode === "calibrate" ? "bg-accent text-white border-accent" : "border-ink/20 hover:bg-ink/5"
        } disabled:opacity-40`}
      >
        {floorPlan?.pixelsPerFoot ? "Re-calibrate" : "Calibrate scale"}
      </button>

      <div className="h-6 w-px bg-ink/10 mx-1" />

      <ToggleBtn active={showDimensions} onClick={toggleDimensions} label="Labels" />
      <ToggleBtn active={showGrid} onClick={toggleGrid} label="Grid (1')" />

      <div className="h-6 w-px bg-ink/10 mx-1" />

      <span className="text-xs text-ink/60 pr-1">Clearance:</span>
      <SegBtn
        value={clearanceMode}
        options={[
          { v: "off", label: "Off" },
          { v: "selected", label: "Selected" },
          { v: "all", label: "All" },
        ]}
        onChange={(v) => setClearanceMode(v as "off" | "selected" | "all")}
      />

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => setZoom(Math.max(0.1, zoom / 1.2))}
          className="px-2 py-1 text-sm rounded border border-ink/20 hover:bg-ink/5"
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="text-xs tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom(Math.min(8, zoom * 1.2))}
          className="px-2 py-1 text-sm rounded border border-ink/20 hover:bg-ink/5"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => {
            if (confirm("Clear floor plan and all placed furniture?")) reset();
          }}
          className="px-3 py-1.5 text-sm rounded border border-ink/20 hover:bg-ink/5 ml-2"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function ToggleBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded border ${
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
    <div className="inline-flex rounded border border-ink/20 overflow-hidden text-sm">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`px-2.5 py-1 ${value === o.v ? "bg-ink text-paper" : "hover:bg-ink/5"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
