"use client";

import { useMemo, useState } from "react";
import { Stage, Layer, Line, Rect, Text, Group } from "react-konva";
import { useDesignStore } from "@/lib/store";
import { defaultHeight, getCatalogItem } from "@/lib/catalog";
import { formatFeet } from "@/lib/format";
import type { PlacedFurniture, Point, Wall } from "@/lib/types";

/**
 * Side elevation: pick a wall, look at it perpendicular. We project every piece
 * within `depthFt` of the wall onto the wall's length axis and stack them at
 * floor level with their catalog heights. The view is intentionally simple —
 * a designer presentation drawing, not photorealism.
 */
export default function ElevationView() {
  const walls = useDesignStore((s) => s.walls);
  const placed = useDesignStore((s) => s.placed);
  const ceilingHeightFt = useDesignStore((s) => s.ceilingHeightFt);
  const doors = useDesignStore((s) => s.doors);
  const windows = useDesignStore((s) => s.windows);

  const [selectedWallId, setSelectedWallId] = useState<string | null>(walls[0]?.id ?? null);
  const [depthFt, setDepthFt] = useState(4);

  const wall = walls.find((w) => w.id === selectedWallId) ?? walls[0] ?? null;

  if (!walls.length) {
    return (
      <div className="h-full w-full grid place-items-center text-ink-500 text-sm">
        Draw at least one wall to use elevation view.
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-paper-200/40">
      <div className="h-12 border-b border-ink-200/70 bg-paper-50 flex items-center px-4 gap-3 shrink-0">
        <span className="label">Looking at wall</span>
        <select
          value={selectedWallId ?? ""}
          onChange={(e) => setSelectedWallId(e.target.value)}
          className="input input-sm w-56"
        >
          {walls.map((w, i) => {
            const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
            return (
              <option key={w.id} value={w.id}>
                Wall {i + 1} · {formatFeet(len)}
              </option>
            );
          })}
        </select>
        <span className="label ml-3">Depth from wall</span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={12}
            step={0.5}
            value={depthFt}
            onChange={(e) => setDepthFt(parseFloat(e.target.value))}
            className="accent-accent-500"
          />
          <span className="text-xs font-mono tabular-nums w-12 text-ink-600">{depthFt}'</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {wall && (
          <ElevationStage
            wall={wall}
            placed={placed}
            ceilingHeightFt={ceilingHeightFt}
            depthFt={depthFt}
            doors={doors}
            windows={windows}
          />
        )}
      </div>
    </div>
  );
}

function ElevationStage({
  wall,
  placed,
  ceilingHeightFt,
  depthFt,
  doors,
  windows,
}: {
  wall: Wall;
  placed: PlacedFurniture[];
  ceilingHeightFt: number;
  depthFt: number;
  doors: { id: string; position: Point; widthFt: number; label?: string }[];
  windows: { id: string; position: Point; widthFt: number; label?: string }[];
}) {
  const [size, setSize] = useState({ width: 800, height: 400 });

  const wallLenFt = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
  const wallAngle = Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x);
  const cos = Math.cos(wallAngle);
  const sin = Math.sin(wallAngle);

  /** Project a scene-coords point onto the wall's local frame: (along-wall, perpendicular). */
  const projectToWall = (p: Point): { along: number; perp: number } => {
    const dx = p.x - wall.a.x;
    const dy = p.y - wall.a.y;
    return {
      along: dx * cos + dy * sin,
      perp: -dx * sin + dy * cos,
    };
  };

  type Box = { item: PlacedFurniture; along: number; widthFt: number; heightFt: number; perp: number };

  const boxes = useMemo<Box[]>(() => {
    return placed
      .filter((p) => !p.hidden)
      .map((p) => {
        const cat = getCatalogItem(p.catalogId);
        if (!cat || cat.category === "rugs") return null;
        const proj = projectToWall({ x: p.x, y: p.y });
        // Only include pieces in front of the wall (perp positive, which side depends on geometry)
        // and within depthFt of it
        if (Math.abs(proj.perp) > depthFt) return null;
        if (proj.along < -1 || proj.along > wallLenFt + 1) return null;
        const w = p.widthOverride ?? cat.width;
        const d = p.depthOverride ?? cat.depth;
        const h = p.heightOverride ?? cat.height ?? defaultHeight(cat);
        // Effective width along the wall depends on rotation
        const rot = (p.rotation * Math.PI) / 180;
        const longAxis = Math.abs(Math.cos(rot - wallAngle)) * w + Math.abs(Math.sin(rot - wallAngle)) * d;
        return { item: p, along: proj.along, widthFt: longAxis, heightFt: h, perp: Math.abs(proj.perp) };
      })
      .filter((x): x is Box => x !== null)
      .sort((a, b) => a.perp - b.perp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed, wall.id, depthFt]);

  // Doors / windows that sit on this wall
  const wallOpenings = useMemo(() => {
    const toLocal = (p: Point) => projectToWall(p);
    const doorOnWall = doors
      .map((d) => ({ ...d, ...toLocal(d.position) }))
      .filter((d) => Math.abs(d.perp) < 0.5 && d.along >= -0.5 && d.along <= wallLenFt + 0.5);
    const windowOnWall = windows
      .map((w) => ({ ...w, ...toLocal(w.position) }))
      .filter((w) => Math.abs(w.perp) < 0.5 && w.along >= -0.5 && w.along <= wallLenFt + 0.5);
    return { doors: doorOnWall, windows: windowOnWall };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doors, windows, wall.id]);

  // Scale: fit wall length and ceiling height inside the canvas with padding
  const padding = 60;
  const pxPerFtX = (size.width - padding * 2) / wallLenFt;
  const pxPerFtY = (size.height - padding * 2) / (ceilingHeightFt + 1);
  const pxPerFt = Math.min(pxPerFtX, pxPerFtY);

  const originX = padding;
  const floorY = size.height - padding;

  const toCanvas = (alongFt: number, heightFt: number) => ({
    x: originX + alongFt * pxPerFt,
    y: floorY - heightFt * pxPerFt,
  });

  return (
    <div
      ref={(el) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (Math.abs(r.width - size.width) > 1 || Math.abs(r.height - size.height) > 1) {
          setSize({ width: r.width, height: r.height });
        }
      }}
      className="h-full w-full relative"
    >
      <Stage width={size.width} height={size.height}>
        <Layer>
          {/* Wall outline */}
          <Rect
            x={originX}
            y={floorY - ceilingHeightFt * pxPerFt}
            width={wallLenFt * pxPerFt}
            height={ceilingHeightFt * pxPerFt}
            fill="#fbf7ee"
            stroke="#1c1917"
            strokeWidth={2}
          />
          {/* Floor */}
          <Line
            points={[originX - 20, floorY, originX + wallLenFt * pxPerFt + 20, floorY]}
            stroke="#1c1917"
            strokeWidth={3}
          />
          {/* Ceiling label */}
          <Text
            x={originX}
            y={floorY - ceilingHeightFt * pxPerFt - 20}
            text={`Ceiling · ${formatFeet(ceilingHeightFt)}`}
            fontSize={11}
            fill="#78716c"
          />
          {/* Wall length label */}
          <Text
            x={originX}
            y={floorY + 10}
            text={`Wall · ${formatFeet(wallLenFt)}`}
            fontSize={11}
            fill="#78716c"
          />

          {/* Openings (doors / windows on this wall) */}
          {wallOpenings.doors.map((d) => {
            const left = toCanvas(d.along, 6.67);
            return (
              <Group key={d.id} opacity={0.6}>
                <Rect
                  x={left.x}
                  y={floorY - 6.67 * pxPerFt}
                  width={d.widthFt * pxPerFt}
                  height={6.67 * pxPerFt}
                  stroke="#92400e"
                  strokeWidth={1}
                  dash={[4, 3]}
                  fill="rgba(146, 64, 14, 0.05)"
                />
                <Text
                  x={left.x}
                  y={floorY - 6.67 * pxPerFt - 14}
                  text={d.label ?? "Door"}
                  fontSize={9}
                  fill="#92400e"
                />
              </Group>
            );
          })}
          {wallOpenings.windows.map((w) => {
            const left = toCanvas(w.along, 4.5);
            return (
              <Group key={w.id} opacity={0.7}>
                <Rect
                  x={left.x}
                  y={floorY - 5.5 * pxPerFt}
                  width={w.widthFt * pxPerFt}
                  height={3 * pxPerFt}
                  stroke="#7aa6c7"
                  strokeWidth={1.5}
                  fill="rgba(122, 166, 199, 0.18)"
                />
                <Text
                  x={left.x}
                  y={floorY - 5.5 * pxPerFt - 14}
                  text={w.label ?? "Window"}
                  fontSize={9}
                  fill="#0369a1"
                />
              </Group>
            );
          })}

          {/* Furniture rectangles */}
          {boxes.map((b) => {
            const cat = getCatalogItem(b.item.catalogId);
            const color = b.item.colorOverride ?? cat?.color ?? "#8b6f47";
            const opacity = Math.max(0.4, 1 - b.perp * 0.12);
            return (
              <Group key={b.item.id}>
                <Rect
                  x={originX + (b.along - b.widthFt / 2) * pxPerFt}
                  y={floorY - b.heightFt * pxPerFt}
                  width={b.widthFt * pxPerFt}
                  height={b.heightFt * pxPerFt}
                  fill={color}
                  stroke="#1c1917"
                  strokeWidth={1.25}
                  opacity={opacity}
                  cornerRadius={2}
                />
                <Text
                  x={originX + (b.along - b.widthFt / 2) * pxPerFt}
                  y={floorY - b.heightFt * pxPerFt - 14}
                  width={b.widthFt * pxPerFt}
                  align="center"
                  text={`${b.item.label} · ${formatFeet(b.heightFt)}`}
                  fontSize={10}
                  fill="#1c1917"
                  fontStyle="600"
                />
                <Text
                  x={originX + (b.along - b.widthFt / 2) * pxPerFt}
                  y={floorY + 4}
                  width={b.widthFt * pxPerFt}
                  align="center"
                  text={`${b.perp.toFixed(1)}' from wall`}
                  fontSize={8}
                  fill="#78716c"
                />
              </Group>
            );
          })}

          {/* Height gridlines */}
          {Array.from({ length: Math.floor(ceilingHeightFt) }).map((_, i) => {
            const ft = i + 1;
            return (
              <Group key={ft} opacity={ft % 5 === 0 ? 0.35 : 0.1}>
                <Line
                  points={[
                    originX,
                    floorY - ft * pxPerFt,
                    originX + wallLenFt * pxPerFt,
                    floorY - ft * pxPerFt,
                  ]}
                  stroke="#1c1917"
                  strokeWidth={ft % 5 === 0 ? 1 : 0.5}
                  dash={[3, 4]}
                />
                <Text
                  x={originX - 28}
                  y={floorY - ft * pxPerFt - 5}
                  text={`${ft}'`}
                  fontSize={9}
                  fill="#78716c"
                />
              </Group>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
