"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import Toolbar from "@/components/Toolbar";
import FurniturePalette from "@/components/FurniturePalette";
import PropertiesPanel from "@/components/PropertiesPanel";
import { useDesignStore, useTemporalStore } from "@/lib/store";
import { tryLoadFromHash } from "@/lib/share";

const FloorPlanCanvas = dynamic(() => import("@/components/FloorPlanCanvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full grid place-items-center text-ink-400 text-sm">Loading canvas…</div>,
});

const Scene3D = dynamic(() => import("@/components/Scene3D"), {
  ssr: false,
  loading: () => <div className="h-full w-full grid place-items-center text-ink-400 text-sm">Loading 3D view…</div>,
});

export default function Page() {
  const removeFurniture = useDesignStore((s) => s.removeFurniture);
  const selectedId = useDesignStore((s) => s.selectedId);
  const selectedIds = useDesignStore((s) => s.selectedIds);
  const setToolMode = useDesignStore((s) => s.setToolMode);
  const clearSelection = useDesignStore((s) => s.clearSelection);
  const updateFurniture = useDesignStore((s) => s.updateFurniture);
  const placed = useDesignStore((s) => s.placed);
  const fitToView = useDesignStore((s) => s.fitToView);
  const view = useDesignStore((s) => s.view);

  // Restore from share URL on mount
  useEffect(() => {
    tryLoadFromHash();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && /input|textarea|select/i.test(target.tagName)) return;
      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) useTemporalStore.getState().redo();
        else useTemporalStore.getState().undo();
        return;
      }
      if (meta && e.key.toLowerCase() === "y") {
        e.preventDefault();
        useTemporalStore.getState().redo();
        return;
      }

      // Arrow nudge for selection
      const ids = selectedIds.length ? selectedIds : selectedId ? [selectedId] : [];
      if (ids.length && (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 0.1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        for (const id of ids) {
          const item = placed.find((p) => p.id === id);
          if (item) updateFurniture(id, { x: item.x + dx, y: item.y + dy });
        }
        return;
      }

      if (!meta && !e.shiftKey) {
        if (e.key === "v") return setToolMode("select");
        if (e.key === "w") return setToolMode("draw-wall");
        if (e.key === "d") return setToolMode("draw-door");
        if (e.key === "m") return setToolMode("measure");
        if (e.key === "n") return setToolMode("note");
        if (e.key === "t") return setToolMode("traffic");
        if (e.key === "f") return fitToView();
      }

      if ((e.key === "Backspace" || e.key === "Delete") && ids.length) {
        e.preventDefault();
        ids.forEach((id) => removeFurniture(id));
        clearSelection();
      } else if (e.key === "Escape") {
        setToolMode("select", null);
        clearSelection();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, selectedIds, removeFurniture, setToolMode, clearSelection, updateFurniture, placed, fitToView]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-paper-100">
      <Toolbar />
      <div className="flex-1 flex overflow-hidden">
        <FurniturePalette />
        <main className="flex-1 relative overflow-hidden">
          {view === "2d" ? <FloorPlanCanvas /> : <Scene3D />}
        </main>
        <PropertiesPanel />
      </div>
    </div>
  );
}
