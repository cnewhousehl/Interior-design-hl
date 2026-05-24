"use client";

import { useMemo, useState } from "react";
import { Stage, Layer, Image as KImage, Rect, Circle, Line, Group } from "react-konva";
import useImage from "use-image";
import { useDesignStore } from "@/lib/store";
import { listLayouts } from "@/lib/persistence";
import { getCatalogItem } from "@/lib/catalog";
import type { SavedLayout } from "@/lib/types";

/**
 * Side-by-side comparison: live scene on the left vs. a chosen saved layout on the right.
 * Both halves render at the same scale so footprints and spacing are directly comparable.
 */
export default function CompareView() {
  const live = useDesignStore.getState();
  const layouts = useMemo(() => listLayouts(), []);
  const [rightId, setRightId] = useState<string | null>(layouts[0]?.id ?? null);
  const right = layouts.find((l) => l.id === rightId) ?? null;

  return (
    <div className="h-full w-full flex flex-col bg-paper-200/40">
      <div className="h-12 border-b border-ink-200/70 bg-paper-50 flex items-center px-4 gap-3 shrink-0">
        <span className="label">Compare with</span>
        <select
          value={rightId ?? ""}
          onChange={(e) => setRightId(e.target.value || null)}
          className="input input-sm w-72"
        >
          <option value="">— pick a saved layout —</option>
          {layouts.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <div className="ml-auto text-xs text-ink-500">Tip: save a few layouts via the Layouts menu first.</div>
      </div>
      <div className="flex-1 grid grid-cols-2 divide-x divide-ink-200/70 overflow-hidden">
        <Pane title="Live (current)" data={{
          floorPlan: live.floorPlan,
          placed: live.placed,
          walls: live.walls,
          doors: live.doors,
          rooms: live.rooms,
        }} />
        <Pane
          title={right?.name ?? "—"}
          data={right ? {
            floorPlan: right.floorPlan,
            placed: right.placed,
            walls: right.walls,
            doors: right.doors,
            rooms: right.rooms,
          } : null}
        />
      </div>
    </div>
  );
}

function Pane({
  title,
  data,
}: {
  title: string;
  data: {
    floorPlan: SavedLayout["floorPlan"];
    placed: SavedLayout["placed"];
    walls: SavedLayout["walls"];
    doors: SavedLayout["doors"];
    rooms: SavedLayout["rooms"];
  } | null;
}) {
  const [size, setSize] = useState({ width: 600, height: 400 });
  const [image] = useImage(data?.floorPlan?.imageDataUrl ?? "", "anonymous");
  const ppf = data?.floorPlan?.pixelsPerFoot ?? null;

  const { scale, offsetX, offsetY } = useMemo(() => {
    if (!image || !size.width || !size.height) return { scale: 1, offsetX: 0, offsetY: 0 };
    const pad = 24;
    const sx = (size.width - pad * 2) / image.width;
    const sy = (size.height - pad * 2) / image.height;
    const s = Math.min(sx, sy, 1);
    return {
      scale: s,
      offsetX: (size.width - image.width * s) / 2,
      offsetY: (size.height - image.height * s) / 2,
    };
  }, [image, size.width, size.height]);

  return (
    <div
      ref={(el) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (Math.abs(r.width - size.width) > 1 || Math.abs(r.height - size.height) > 1) {
          setSize({ width: r.width, height: r.height });
        }
      }}
      className="relative overflow-hidden"
    >
      <div className="absolute top-3 left-3 z-10 bg-ink-900/90 backdrop-blur text-paper-50 text-xs px-2.5 py-1 rounded-md font-medium shadow-float">
        {title}
      </div>
      {!data || !data.floorPlan ? (
        <div className="h-full grid place-items-center text-ink-500 text-sm">No layout</div>
      ) : (
        <Stage
          width={size.width}
          height={size.height}
          scaleX={scale}
          scaleY={scale}
          x={offsetX}
          y={offsetY}
        >
          <Layer>
            {image && <KImage image={image} opacity={0.85} />}
          </Layer>
          {ppf && (
            <Layer>
              {data.walls.map((w) => (
                <Line
                  key={w.id}
                  points={[w.a.x * ppf, w.a.y * ppf, w.b.x * ppf, w.b.y * ppf]}
                  stroke="#1c1917"
                  strokeWidth={Math.max(3, (w.thicknessFt ?? 0.4) * ppf)}
                  lineCap="round"
                />
              ))}
              {data.placed.filter((p) => !p.hidden).map((p) => {
                const c = getCatalogItem(p.catalogId);
                if (!c) return null;
                const w = (p.widthOverride ?? c.width) * ppf;
                const d = (p.depthOverride ?? c.depth) * ppf;
                return (
                  <Group key={p.id} x={p.x * ppf} y={p.y * ppf} rotation={p.rotation}>
                    {c.shape === "circle" ? (
                      <Circle radius={w / 2} fill={p.colorOverride ?? c.color} stroke="#1c1917" strokeWidth={1 / scale} />
                    ) : (
                      <Rect
                        x={-w / 2}
                        y={-d / 2}
                        width={w}
                        height={d}
                        fill={p.colorOverride ?? c.color}
                        stroke="#1c1917"
                        strokeWidth={1 / scale}
                        cornerRadius={Math.min(w, d) * 0.04}
                      />
                    )}
                  </Group>
                );
              })}
            </Layer>
          )}
        </Stage>
      )}
    </div>
  );
}
