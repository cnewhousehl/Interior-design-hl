"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import Toolbar from "@/components/Toolbar";
import FurniturePalette from "@/components/FurniturePalette";
import PropertiesPanel from "@/components/PropertiesPanel";
import { useDesignStore, useTemporalStore } from "@/lib/store";

const FloorPlanCanvas = dynamic(() => import("@/components/FloorPlanCanvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full grid place-items-center text-ink/40 text-sm">Loading canvas…</div>,
});

export default function Page() {
  const removeFurniture = useDesignStore((s) => s.removeFurniture);
  const selectedId = useDesignStore((s) => s.selectedId);
  const selectedIds = useDesignStore((s) => s.selectedIds);
  const setToolMode = useDesignStore((s) => s.setToolMode);
  const clearSelection = useDesignStore((s) => s.clearSelection);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && /input|textarea|select/i.test(target.tagName)) return;
      const meta = e.metaKey || e.ctrlKey;

      // Undo / Redo
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

      // Tool shortcuts
      if (!meta && !e.shiftKey) {
        if (e.key === "v") return setToolMode("select");
        if (e.key === "w") return setToolMode("draw-wall");
        if (e.key === "d") return setToolMode("draw-door");
        if (e.key === "m") return setToolMode("measure");
        if (e.key === "n") return setToolMode("note");
      }

      if ((e.key === "Backspace" || e.key === "Delete") && (selectedId || selectedIds.length)) {
        e.preventDefault();
        const ids = selectedIds.length ? selectedIds : selectedId ? [selectedId] : [];
        ids.forEach((id) => removeFurniture(id));
        clearSelection();
      } else if (e.key === "Escape") {
        setToolMode("select", null);
        clearSelection();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, selectedIds, removeFurniture, setToolMode, clearSelection]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <Toolbar />
      <div className="flex-1 flex overflow-hidden">
        <FurniturePalette />
        <main className="flex-1 relative bg-paper overflow-hidden">
          <FloorPlanCanvas />
        </main>
        <PropertiesPanel />
      </div>
    </div>
  );
}
