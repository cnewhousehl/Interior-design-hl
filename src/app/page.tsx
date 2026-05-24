"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import Toolbar from "@/components/Toolbar";
import FurniturePalette from "@/components/FurniturePalette";
import PropertiesPanel from "@/components/PropertiesPanel";
import { useDesignStore } from "@/lib/store";

const FloorPlanCanvas = dynamic(() => import("@/components/FloorPlanCanvas"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full grid place-items-center text-ink/40 text-sm">Loading canvas…</div>
  ),
});

export default function Page() {
  const removeFurniture = useDesignStore((s) => s.removeFurniture);
  const selectedId = useDesignStore((s) => s.selectedId);
  const setToolMode = useDesignStore((s) => s.setToolMode);

  // Keyboard: Delete to remove selected, Esc to exit place/calibrate
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && /input|textarea|select/i.test(target.tagName)) return;
      if ((e.key === "Backspace" || e.key === "Delete") && selectedId) {
        e.preventDefault();
        removeFurniture(selectedId);
      } else if (e.key === "Escape") {
        setToolMode("select", null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, removeFurniture, setToolMode]);

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
