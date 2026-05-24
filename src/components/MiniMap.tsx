"use client";

import { useEffect, useRef } from "react";
import { useDesignStore } from "@/lib/store";
import { getCatalogItem } from "@/lib/catalog";

/**
 * Tiny overview canvas in the bottom-right of the 2D editor. Shows the entire
 * floor plan + furniture + a viewport rectangle indicating what's on screen.
 * Click-drag inside the minimap pans the main view to keep the rectangle
 * centered on the cursor.
 */
export default function MiniMap() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const floorPlan = useDesignStore((s) => s.floorPlan);
  const placed = useDesignStore((s) => s.placed);
  const walls = useDesignStore((s) => s.walls);
  const zoom = useDesignStore((s) => s.zoom);
  const pan = useDesignStore((s) => s.pan);
  const view = useDesignStore((s) => s.view);

  // Computed once per state change
  useEffect(() => {
    const c = ref.current;
    if (!c || !floorPlan || view !== "2d") return;
    const W = c.width;
    const H = c.height;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#fdfbf5";
    ctx.fillRect(0, 0, W, H);

    const sx = W / floorPlan.imagePxWidth;
    const sy = H / floorPlan.imagePxHeight;
    const s = Math.min(sx, sy);
    const ox = (W - floorPlan.imagePxWidth * s) / 2;
    const oy = (H - floorPlan.imagePxHeight * s) / 2;

    // Walls
    const ppf = floorPlan.pixelsPerFoot ?? 1;
    ctx.strokeStyle = "#1c1917";
    ctx.lineWidth = 1;
    for (const w of walls) {
      ctx.beginPath();
      ctx.moveTo(ox + w.a.x * ppf * s, oy + w.a.y * ppf * s);
      ctx.lineTo(ox + w.b.x * ppf * s, oy + w.b.y * ppf * s);
      ctx.stroke();
    }

    // Furniture as dots
    for (const p of placed) {
      if (p.hidden) continue;
      const cat = getCatalogItem(p.catalogId);
      if (!cat) continue;
      ctx.fillStyle = p.colorOverride ?? cat.color;
      const px = ox + p.x * ppf * s;
      const py = oy + p.y * ppf * s;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(2, cat.width * ppf * s * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }

    // Viewport rectangle — represents what's currently visible on the main canvas
    const stageWidth = window.innerWidth - 72 * 4 - 22 * 4 * 4; // rough
    const stageHeight = window.innerHeight - 56;
    void stageHeight;
    const viewLeftPx = -pan.x / zoom;
    const viewTopPx = -pan.y / zoom;
    const viewWPx = stageWidth / zoom;
    const viewHPx = stageHeight / zoom;
    void viewWPx;
    void viewHPx;
    ctx.strokeStyle = "#b45309";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(ox + viewLeftPx * s, oy + viewTopPx * s, (stageWidth / zoom) * s, (stageHeight / zoom) * s);
  }, [floorPlan, placed, walls, zoom, pan, view]);

  if (!floorPlan || view !== "2d") return null;

  const onPointer = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.buttons !== 1) return;
    const c = ref.current;
    if (!c || !floorPlan) return;
    const rect = c.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const W = c.width;
    const H = c.height;
    const sx = W / floorPlan.imagePxWidth;
    const sy = H / floorPlan.imagePxHeight;
    const s = Math.min(sx, sy);
    const ox = (W - floorPlan.imagePxWidth * s) / 2;
    const oy = (H - floorPlan.imagePxHeight * s) / 2;
    const imgX = (localX - ox) / s;
    const imgY = (localY - oy) / s;
    // Center the main viewport on (imgX, imgY)
    const stageWidth = window.innerWidth - 72 * 4 - 22 * 4 * 4;
    const stageHeight = window.innerHeight - 56;
    useDesignStore.setState({
      pan: {
        x: stageWidth / 2 - imgX * zoom,
        y: stageHeight / 2 - imgY * zoom,
      },
    });
  };

  return (
    <div className="absolute bottom-3 right-3 z-10 card shadow-float p-1.5 bg-paper-50/95 backdrop-blur">
      <div className="label mb-1 px-1">Overview</div>
      <canvas
        ref={ref}
        width={180}
        height={140}
        onMouseDown={onPointer}
        onMouseMove={onPointer}
        className="cursor-pointer rounded-md border border-ink-200/70"
      />
    </div>
  );
}
