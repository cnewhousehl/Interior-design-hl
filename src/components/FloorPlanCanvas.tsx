"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Image as KImage, Rect, Circle, Line, Text, Group, Label, Tag, Arc } from "react-konva";
import Konva from "konva";
import useImage from "use-image";
import { getCatalogItem } from "@/lib/catalog";
import { useDesignStore } from "@/lib/store";
import type { CatalogItem, Door, PlacedFurniture, Point, Wall } from "@/lib/types";
import { footprintPolygon, polygonDistance, pxDistance } from "@/lib/geometry";
import { formatFeet } from "@/lib/format";
import { doorSwingPolygon } from "@/lib/validation";

type Size = { width: number; height: number };

const SNAP_DEG_STEP = 5;
const ALIGN_THRESHOLD_FT = 0.25;

export default function FloorPlanCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState<Size>({ width: 800, height: 600 });

  const floorPlan = useDesignStore((s) => s.floorPlan);
  const placed = useDesignStore((s) => s.placed);
  const walls = useDesignStore((s) => s.walls);
  const doors = useDesignStore((s) => s.doors);
  const windows = useDesignStore((s) => s.windows);
  const rooms = useDesignStore((s) => s.rooms);
  const annotations = useDesignStore((s) => s.annotations);
  const selectedId = useDesignStore((s) => s.selectedId);
  const selectedIds = useDesignStore((s) => s.selectedIds);
  const toolMode = useDesignStore((s) => s.toolMode);
  const pendingCatalogId = useDesignStore((s) => s.pendingCatalogId);
  const clearanceMode = useDesignStore((s) => s.clearanceMode);
  const showDimensions = useDesignStore((s) => s.showDimensions);
  const showGrid = useDesignStore((s) => s.showGrid);
  const showWalls = useDesignStore((s) => s.showWalls);
  const zoom = useDesignStore((s) => s.zoom);
  const pan = useDesignStore((s) => s.pan);
  const northDeg = useDesignStore((s) => s.northDeg);

  const setCalibration = useDesignStore((s) => s.setCalibration);
  const addFurniture = useDesignStore((s) => s.addFurniture);
  const updateFurniture = useDesignStore((s) => s.updateFurniture);
  const setSelected = useDesignStore((s) => s.setSelected);
  const toggleInSelection = useDesignStore((s) => s.toggleInSelection);
  const setZoom = useDesignStore((s) => s.setZoom);
  const setPan = useDesignStore((s) => s.setPan);
  const addWall = useDesignStore((s) => s.addWall);
  const addDoor = useDesignStore((s) => s.addDoor);
  const addAnnotation = useDesignStore((s) => s.addAnnotation);
  const setToolMode = useDesignStore((s) => s.setToolMode);

  const [calibPoints, setCalibPoints] = useState<Point[]>([]);
  const [distancePrompt, setDistancePrompt] = useState<{ p1: Point; p2: Point } | null>(null);
  const [distanceValue, setDistanceValue] = useState("");
  const [wallStart, setWallStart] = useState<Point | null>(null);
  const [measureStart, setMeasureStart] = useState<Point | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [alignLines, setAlignLines] = useState<{ vertical?: number; horizontal?: number }>({});

  const [image] = useImage(floorPlan?.imageDataUrl ?? "", "anonymous");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Expose stage on window so the toolbar's PNG export can reach it
  useEffect(() => {
    (window as unknown as { __designStage?: Konva.Stage | null }).__designStage = stageRef.current;
    return () => {
      (window as unknown as { __designStage?: Konva.Stage | null }).__designStage = null;
    };
  });

  const ppf = floorPlan?.pixelsPerFoot ?? null;

  // ---------- coord conversion ----------
  const imagePxToFeet = (px: number) => (ppf ? px / ppf : px);

  /** Translate a Konva stage event into image-pixel coordinates and feet. */
  const eventToScene = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    const imgPx = { x: (pos.x - pan.x) / zoom, y: (pos.y - pan.y) / zoom };
    const feet = { x: imagePxToFeet(imgPx.x), y: imagePxToFeet(imgPx.y) };
    return { imgPx, feet };
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const scene = eventToScene(e);
    if (!scene) return;
    setCursor(scene.feet);
  };

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const scene = eventToScene(e);
    if (!scene) return;
    const { imgPx, feet } = scene;

    if (toolMode === "calibrate") {
      const next = [...calibPoints, imgPx];
      if (next.length === 2) {
        setDistancePrompt({ p1: next[0], p2: next[1] });
        setCalibPoints([]);
      } else {
        setCalibPoints(next);
      }
      return;
    }

    if (toolMode === "place" && pendingCatalogId && ppf) {
      const cat = getCatalogItem(pendingCatalogId);
      if (!cat) return;
      addFurniture({
        id: crypto.randomUUID(),
        catalogId: cat.id,
        label: cat.name,
        x: feet.x,
        y: feet.y,
        rotation: 0,
      });
      return;
    }

    if (toolMode === "draw-wall" && ppf) {
      if (!wallStart) {
        setWallStart(feet);
      } else {
        const snapped = snapOrtho(wallStart, feet);
        addWall({
          id: crypto.randomUUID(),
          a: wallStart,
          b: snapped,
          thicknessFt: 0.4,
        });
        // chain — next click continues from the endpoint
        setWallStart(snapped);
      }
      return;
    }

    if (toolMode === "draw-door" && ppf) {
      const wall = nearestWall(feet, walls, 1.5);
      if (!wall) {
        alert("Click closer to a wall — doors must sit on a wall.");
        return;
      }
      const proj = projectOntoWall(feet, wall);
      const angleDeg = (Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x) * 180) / Math.PI;
      addDoor({
        id: crypto.randomUUID(),
        position: proj,
        widthFt: 2.83,
        angleDeg,
        swing: "right",
        openDeg: 90,
        label: "Door",
      });
      setToolMode("select");
      return;
    }

    if (toolMode === "measure" && ppf) {
      if (!measureStart) {
        setMeasureStart(feet);
      } else {
        addAnnotation({
          id: crypto.randomUUID(),
          type: "measure",
          a: measureStart,
          b: feet,
        });
        setMeasureStart(null);
        setToolMode("select");
      }
      return;
    }

    if (toolMode === "note" && ppf) {
      const text = prompt("Note text:");
      if (text) {
        addAnnotation({ id: crypto.randomUUID(), type: "note", position: feet, text });
      }
      setToolMode("select");
      return;
    }

    // deselect on empty click
    const stage = e.target.getStage();
    if (e.target === stage || e.target.name() === "floor-image" || e.target.name() === "room-fill") {
      setSelected(null);
    }
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const factor = 1.08;
    const newZoom = Math.min(8, Math.max(0.1, zoom * (direction > 0 ? factor : 1 / factor)));
    const mousePointTo = { x: (pointer.x - pan.x) / zoom, y: (pointer.y - pan.y) / zoom };
    setZoom(newZoom);
    setPan({ x: pointer.x - mousePointTo.x * newZoom, y: pointer.y - mousePointTo.y * newZoom });
  };

  const onDragStage = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (e.target !== e.target.getStage()) return;
    setPan({ x: e.target.x(), y: e.target.y() });
  };

  const handleCalibrationSubmit = () => {
    if (!distancePrompt) return;
    const feet = parseFeetInput(distanceValue);
    if (!feet || feet <= 0) {
      alert("Enter a positive number in feet (e.g. 11 or 11.58 or 11'7).");
      return;
    }
    const pxDist = pxDistance(distancePrompt.p1, distancePrompt.p2);
    setCalibration({ p1: distancePrompt.p1, p2: distancePrompt.p2, realDistanceFeet: feet }, pxDist / feet);
    setDistancePrompt(null);
    setDistanceValue("");
  };

  // Fit image when loaded
  useEffect(() => {
    if (!image || !size.width || !size.height) return;
    const padding = 40;
    const sx = (size.width - padding * 2) / image.width;
    const sy = (size.height - padding * 2) / image.height;
    const initial = Math.min(sx, sy, 1);
    setZoom(initial);
    setPan({
      x: (size.width - image.width * initial) / 2,
      y: (size.height - image.height * initial) / 2,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, size.width, size.height]);

  // ESC clears the drawing in-progress
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setWallStart(null);
        setMeasureStart(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!floorPlan) {
    return (
      <div ref={containerRef} className="h-full w-full grid place-items-center text-ink/50">
        <div className="text-center">
          <div className="text-lg font-medium">No floor plan loaded</div>
          <div className="text-sm mt-1">Upload an image or load a layout from the top bar.</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full relative bg-paper">
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        scaleX={zoom}
        scaleY={zoom}
        x={pan.x}
        y={pan.y}
        draggable={toolMode === "select"}
        onDragMove={onDragStage}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onMouseMove={handleStageMouseMove}
        onWheel={handleWheel}
        style={{ cursor: cursorFor(toolMode) }}
      >
        <Layer>
          {image && <KImage image={image} name="floor-image" listening opacity={ppf ? 1 : 0.85} />}
          {showGrid && ppf && image && <GridLayer width={image.width} height={image.height} ppf={ppf} />}
        </Layer>

        {/* Rooms */}
        {ppf && rooms.length > 0 && (
          <Layer>
            {rooms.map((r) => {
              const pts = r.polygon.flatMap((p) => [p.x * ppf, p.y * ppf]);
              const cx = r.polygon.reduce((s, p) => s + p.x, 0) / r.polygon.length;
              const cy = r.polygon.reduce((s, p) => s + p.y, 0) / r.polygon.length;
              return (
                <Group key={r.id} listening={false}>
                  <Line
                    points={pts}
                    closed
                    name="room-fill"
                    fill={r.color ?? "rgba(120, 160, 200, 0.07)"}
                    stroke="rgba(0,0,0,0.15)"
                    strokeWidth={0.5 / zoom}
                  />
                  <Label x={cx * ppf} y={cy * ppf}>
                    <Tag fill="rgba(255,255,255,0.7)" cornerRadius={3} />
                    <Text
                      text={r.name}
                      fontSize={12 / zoom}
                      fill="#333"
                      padding={3 / zoom}
                      fontStyle="600"
                    />
                  </Label>
                </Group>
              );
            })}
          </Layer>
        )}

        {/* Walls + doors + windows */}
        {ppf && showWalls && (
          <Layer>
            {walls.map((w) => (
              <Line
                key={w.id}
                points={[w.a.x * ppf, w.a.y * ppf, w.b.x * ppf, w.b.y * ppf]}
                stroke="#2b2b2b"
                strokeWidth={Math.max(3, (w.thicknessFt ?? 0.4) * ppf) / zoom * zoom}
                lineCap="round"
              />
            ))}
            {windows.map((wn) => (
              <WindowMark key={wn.id} w={wn} ppf={ppf} zoom={zoom} />
            ))}
            {doors.map((d) => (
              <DoorMark key={d.id} door={d} ppf={ppf} zoom={zoom} />
            ))}

            {/* in-progress wall */}
            {toolMode === "draw-wall" && wallStart && cursor && (
              <Line
                points={[
                  wallStart.x * ppf,
                  wallStart.y * ppf,
                  snapOrtho(wallStart, cursor).x * ppf,
                  snapOrtho(wallStart, cursor).y * ppf,
                ]}
                stroke="#c2410c"
                strokeWidth={3 / zoom}
                dash={[8 / zoom, 4 / zoom]}
              />
            )}
          </Layer>
        )}

        {/* Calibration overlay */}
        <Layer listening={false}>
          {toolMode === "calibrate" &&
            calibPoints.map((p, i) => (
              <Circle key={i} x={p.x} y={p.y} radius={5 / zoom} fill="#c2410c" stroke="white" strokeWidth={1 / zoom} />
            ))}
        </Layer>

        {/* Furniture */}
        {ppf && (
          <Layer>
            {placed.map((item) => (
              <FurnitureShape
                key={item.id}
                item={item}
                catalog={getCatalogItem(item.catalogId)!}
                ppf={ppf}
                zoom={zoom}
                selected={selectedIds.includes(item.id) || item.id === selectedId}
                showDimensions={showDimensions}
                allItems={placed}
                onAlignLines={setAlignLines}
                onSelect={(additive) => {
                  if (additive) toggleInSelection(item.id);
                  else setSelected(item.id);
                }}
                onChange={(partial) => updateFurniture(item.id, partial)}
              />
            ))}
            {/* alignment guides */}
            {alignLines.vertical !== undefined && image && (
              <Line
                points={[alignLines.vertical * ppf, 0, alignLines.vertical * ppf, image.height]}
                stroke="#a855f7"
                strokeWidth={1 / zoom}
                dash={[6 / zoom, 4 / zoom]}
                listening={false}
              />
            )}
            {alignLines.horizontal !== undefined && image && (
              <Line
                points={[0, alignLines.horizontal * ppf, image.width, alignLines.horizontal * ppf]}
                stroke="#a855f7"
                strokeWidth={1 / zoom}
                dash={[6 / zoom, 4 / zoom]}
                listening={false}
              />
            )}
          </Layer>
        )}

        {/* Annotations: measurements + notes */}
        {ppf && (
          <Layer>
            {annotations.map((a) => {
              if (a.type === "measure") {
                const dx = a.b.x - a.a.x;
                const dy = a.b.y - a.a.y;
                const dist = Math.hypot(dx, dy);
                const mx = ((a.a.x + a.b.x) / 2) * ppf;
                const my = ((a.a.y + a.b.y) / 2) * ppf;
                return (
                  <Group key={a.id}>
                    <Line
                      points={[a.a.x * ppf, a.a.y * ppf, a.b.x * ppf, a.b.y * ppf]}
                      stroke="#0ea5e9"
                      strokeWidth={1.5 / zoom}
                    />
                    <Circle x={a.a.x * ppf} y={a.a.y * ppf} radius={3 / zoom} fill="#0ea5e9" />
                    <Circle x={a.b.x * ppf} y={a.b.y * ppf} radius={3 / zoom} fill="#0ea5e9" />
                    <Label x={mx} y={my}>
                      <Tag fill="white" stroke="#0ea5e9" strokeWidth={1 / zoom} cornerRadius={3} />
                      <Text text={formatFeet(dist)} fontSize={12 / zoom} fill="#0ea5e9" padding={3 / zoom} />
                    </Label>
                  </Group>
                );
              }
              return (
                <Label key={a.id} x={a.position.x * ppf} y={a.position.y * ppf}>
                  <Tag fill="#fef9c3" stroke="#a16207" strokeWidth={1 / zoom} cornerRadius={3} />
                  <Text text={a.text} fontSize={11 / zoom} fill="#713f12" padding={3 / zoom} />
                </Label>
              );
            })}

            {/* in-progress measure */}
            {toolMode === "measure" && measureStart && cursor && (
              <Line
                points={[measureStart.x * ppf, measureStart.y * ppf, cursor.x * ppf, cursor.y * ppf]}
                stroke="#0ea5e9"
                strokeWidth={1.5 / zoom}
                dash={[6 / zoom, 4 / zoom]}
                listening={false}
              />
            )}
          </Layer>
        )}

        {/* Clearance overlay */}
        {ppf && clearanceMode !== "off" && (
          <Layer listening={false}>
            <ClearanceOverlay ppf={ppf} zoom={zoom} mode={clearanceMode} />
          </Layer>
        )}

        {/* North arrow */}
        {ppf && (
          <Layer listening={false}>
            <NorthArrow zoom={zoom} pan={pan} stageSize={size} northDeg={northDeg} />
          </Layer>
        )}
      </Stage>

      {distancePrompt && (
        <div className="absolute inset-0 grid place-items-center bg-black/30">
          <div className="bg-paper border border-ink/20 rounded-lg p-5 shadow-xl w-[340px]">
            <h3 className="font-medium mb-2">How long is that segment?</h3>
            <p className="text-sm text-ink/70 mb-3">Enter the real-world distance between the two points you clicked.</p>
            <input
              autoFocus
              value={distanceValue}
              onChange={(e) => setDistanceValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCalibrationSubmit();
                if (e.key === "Escape") {
                  setDistancePrompt(null);
                  setDistanceValue("");
                }
              }}
              placeholder={`e.g. 11, 11.58, or 11'7"`}
              className="w-full border border-ink/30 rounded px-2 py-1.5 mb-3"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setDistancePrompt(null);
                  setDistanceValue("");
                }}
                className="px-3 py-1.5 rounded border border-ink/20 hover:bg-ink/5"
              >
                Cancel
              </button>
              <button
                onClick={handleCalibrationSubmit}
                className="px-3 py-1.5 rounded bg-accent text-white hover:opacity-90"
              >
                Set scale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status bar — cursor coords in feet */}
      {ppf && cursor && (
        <div className="absolute bottom-3 left-3 bg-ink text-paper text-xs px-2.5 py-1 rounded font-mono pointer-events-none">
          {cursor.x.toFixed(1)}', {cursor.y.toFixed(1)}'
        </div>
      )}

      {!ppf && (
        <div className="absolute left-4 bottom-4 bg-ink text-paper text-sm rounded-lg px-3 py-2 max-w-sm shadow">
          <span className="font-medium">Calibrate scale:</span> click "Calibrate" in the toolbar, then click two points on a wall whose length you know.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cursorFor(mode: string): string {
  if (mode === "calibrate" || mode === "draw-wall" || mode === "measure") return "crosshair";
  if (mode === "place" || mode === "draw-door" || mode === "note") return "copy";
  return "default";
}

function parseFeetInput(input: string): number | null {
  const t = input.trim();
  if (!t) return null;
  const ftIn = t.match(/^(\d+(?:\.\d+)?)\s*['′]\s*(\d+(?:\.\d+)?)?\s*["″]?$/);
  if (ftIn) return parseFloat(ftIn[1]) + (ftIn[2] ? parseFloat(ftIn[2]) / 12 : 0);
  const n = parseFloat(t);
  return isFinite(n) ? n : null;
}

/** Snap second point to horizontal or vertical from start if close to ortho. */
function snapOrtho(a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) > Math.abs(dy) * 3) return { x: b.x, y: a.y };
  if (Math.abs(dy) > Math.abs(dx) * 3) return { x: a.x, y: b.y };
  return b;
}

function nearestWall(p: Point, walls: Wall[], maxDistFt: number): Wall | null {
  let best: Wall | null = null;
  let bestDist = maxDistFt;
  for (const w of walls) {
    const d = pointToSegment(p, w.a, w.b);
    if (d < bestDist) {
      bestDist = d;
      best = w;
    }
  }
  return best;
}

function projectOntoWall(p: Point, w: Wall): Point {
  const dx = w.b.x - w.a.x;
  const dy = w.b.y - w.a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return w.a;
  let t = ((p.x - w.a.x) * dx + (p.y - w.a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: w.a.x + t * dx, y: w.a.y + t * dy };
}

function pointToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// ---------------------------------------------------------------------------
// Furniture rendering with alignment guides + rotation snap
// ---------------------------------------------------------------------------

function FurnitureShape({
  item,
  catalog,
  ppf,
  zoom,
  selected,
  showDimensions,
  allItems,
  onAlignLines,
  onSelect,
  onChange,
}: {
  item: PlacedFurniture;
  catalog: CatalogItem;
  ppf: number;
  zoom: number;
  selected: boolean;
  showDimensions: boolean;
  allItems: PlacedFurniture[];
  onAlignLines: (lines: { vertical?: number; horizontal?: number }) => void;
  onSelect: (additive: boolean) => void;
  onChange: (partial: Partial<PlacedFurniture>) => void;
}) {
  if (!catalog) return null;
  const w = (item.widthOverride ?? catalog.width) * ppf;
  const d = (item.depthOverride ?? catalog.depth) * ppf;
  const statusColor =
    item.status === "owned" ? "#0e7c4d"
    : item.status === "ordered" ? "#0369a1"
    : item.status === "wishlist" ? "#a16207"
    : null;
  const stroke = selected ? "#c2410c" : statusColor ?? "#1a1a1a";
  const strokeWidth = (selected ? 2.5 : 1.25) / zoom;

  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    let x = node.x() / ppf;
    let y = node.y() / ppf;
    let alignV: number | undefined;
    let alignH: number | undefined;
    // Try to align center with any other piece's center
    for (const other of allItems) {
      if (other.id === item.id) continue;
      if (Math.abs(other.x - x) < ALIGN_THRESHOLD_FT) {
        x = other.x;
        alignV = other.x;
      }
      if (Math.abs(other.y - y) < ALIGN_THRESHOLD_FT) {
        y = other.y;
        alignH = other.y;
      }
    }
    node.x(x * ppf);
    node.y(y * ppf);
    onAlignLines({ vertical: alignV, horizontal: alignH });
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    onChange({ x: node.x() / ppf, y: node.y() / ppf });
    onAlignLines({});
  };

  const handleDblClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    const step = e.evt.shiftKey ? SNAP_DEG_STEP : 90;
    onChange({ rotation: (item.rotation + step) % 360 });
  };

  return (
    <Group
      x={item.x * ppf}
      y={item.y * ppf}
      rotation={item.rotation}
      draggable
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect(e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey);
      }}
      onTap={() => onSelect(false)}
      onMouseDown={() => onSelect(false)}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDblClick={handleDblClick}
    >
      {catalog.shape === "circle" ? (
        <Circle
          radius={w / 2}
          fill={item.colorOverride ?? catalog.color}
          stroke={stroke}
          strokeWidth={strokeWidth}
          opacity={catalog.category === "rugs" ? 0.55 : 0.9}
        />
      ) : catalog.shape === "l-shape" && catalog.lShape ? (
        <LShape
          width={w}
          depth={d}
          notchWidth={catalog.lShape.notchWidth * ppf}
          notchDepth={catalog.lShape.notchDepth * ppf}
          fill={item.colorOverride ?? catalog.color}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      ) : (
        <Rect
          x={-w / 2}
          y={-d / 2}
          width={w}
          height={d}
          fill={item.colorOverride ?? catalog.color}
          stroke={stroke}
          strokeWidth={strokeWidth}
          cornerRadius={Math.min(w, d) * 0.04}
          opacity={catalog.category === "rugs" ? 0.55 : 0.9}
        />
      )}

      {catalog.shape !== "circle" && catalog.category !== "rugs" && (
        <Line points={[0, -d / 2, 0, -d / 2 + Math.min(d * 0.18, 14)]} stroke="white" strokeWidth={2 / zoom} />
      )}

      {showDimensions && (
        <Label x={0} y={0}>
          <Tag fill="rgba(26,26,26,0.78)" cornerRadius={3} />
          <Text
            text={`${item.label}\n${formatFeet(item.widthOverride ?? catalog.width)} × ${formatFeet(item.depthOverride ?? catalog.depth)}`}
            fontSize={11 / zoom}
            fill="#fafaf7"
            padding={4 / zoom}
            align="center"
            rotation={-item.rotation}
          />
        </Label>
      )}
    </Group>
  );
}

function LShape({
  width,
  depth,
  notchWidth,
  notchDepth,
  fill,
  stroke,
  strokeWidth,
}: {
  width: number;
  depth: number;
  notchWidth: number;
  notchDepth: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}) {
  const w = width / 2;
  const d = depth / 2;
  const pts = [-w, -d, w - notchWidth, -d, w - notchWidth, -d + notchDepth, w, -d + notchDepth, w, d, -w, d];
  return <Line points={pts} closed fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={0.9} />;
}

function DoorMark({ door, ppf, zoom }: { door: Door; ppf: number; zoom: number }) {
  const r = door.widthFt * ppf;
  const open = door.openDeg ?? 90;
  const angleOffset = door.swing === "left" ? 0 : -open;
  // Door leaf line
  const leafEndDeg = door.swing === "left" ? door.angleDeg + 0 : door.angleDeg - 0;
  const leafEnd = {
    x: door.position.x * ppf + r * Math.cos(((door.angleDeg + (door.swing === "left" ? 0 : -open)) * Math.PI) / 180),
    y: door.position.y * ppf + r * Math.sin(((door.angleDeg + (door.swing === "left" ? 0 : -open)) * Math.PI) / 180),
  };
  return (
    <Group>
      <Arc
        x={door.position.x * ppf}
        y={door.position.y * ppf}
        innerRadius={0}
        outerRadius={r}
        angle={open}
        rotation={door.angleDeg + angleOffset}
        stroke="#7a6147"
        strokeWidth={1 / zoom}
        dash={[4 / zoom, 3 / zoom]}
        opacity={0.7}
      />
      <Line
        points={[door.position.x * ppf, door.position.y * ppf, leafEnd.x, leafEnd.y]}
        stroke="#7a6147"
        strokeWidth={2 / zoom}
      />
      <Circle x={door.position.x * ppf} y={door.position.y * ppf} radius={3 / zoom} fill="#7a6147" />
      {void leafEndDeg}
    </Group>
  );
}

function WindowMark({
  w,
  ppf,
  zoom,
}: {
  w: { position: Point; widthFt: number; angleDeg: number };
  ppf: number;
  zoom: number;
}) {
  const r = w.widthFt * ppf;
  const cos = Math.cos((w.angleDeg * Math.PI) / 180);
  const sin = Math.sin((w.angleDeg * Math.PI) / 180);
  const end = { x: w.position.x * ppf + r * cos, y: w.position.y * ppf + r * sin };
  return (
    <Line
      points={[w.position.x * ppf, w.position.y * ppf, end.x, end.y]}
      stroke="#7aa6c7"
      strokeWidth={4 / zoom}
      lineCap="round"
    />
  );
}

function NorthArrow({
  zoom,
  pan,
  stageSize,
  northDeg,
}: {
  zoom: number;
  pan: { x: number; y: number };
  stageSize: { width: number; height: number };
  northDeg: number;
}) {
  // Position in stage coords (top-right corner). Convert to scene coords because the layer is scaled.
  const margin = 30;
  const sx = (stageSize.width - margin - pan.x) / zoom;
  const sy = (margin - pan.y) / zoom;
  const size = 20 / zoom;
  const rad = ((northDeg - 90) * Math.PI) / 180; // -90 because north = up
  const tipX = sx + size * Math.cos(rad);
  const tipY = sy + size * Math.sin(rad);
  return (
    <Group>
      <Circle x={sx} y={sy} radius={size + 4 / zoom} stroke="#1a1a1a" strokeWidth={1 / zoom} fill="white" opacity={0.85} />
      <Line points={[sx, sy, tipX, tipY]} stroke="#c2410c" strokeWidth={2 / zoom} />
      <Text
        x={tipX - 4 / zoom}
        y={tipY - 14 / zoom}
        text="N"
        fontSize={12 / zoom}
        fontStyle="700"
        fill="#1a1a1a"
      />
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Grid + clearance
// ---------------------------------------------------------------------------

function GridLayer({ width, height, ppf }: { width: number; height: number; ppf: number }) {
  const lines = useMemo(() => {
    const arr: { points: number[]; major: boolean }[] = [];
    for (let f = 0; f <= width / ppf; f += 1) {
      const x = f * ppf;
      arr.push({ points: [x, 0, x, height], major: f % 5 === 0 });
    }
    for (let f = 0; f <= height / ppf; f += 1) {
      const y = f * ppf;
      arr.push({ points: [0, y, width, y], major: f % 5 === 0 });
    }
    return arr;
  }, [width, height, ppf]);
  return (
    <>
      {lines.map((l, i) => (
        <Line
          key={i}
          points={l.points}
          stroke={l.major ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.07)"}
          strokeWidth={l.major ? 1 : 0.5}
        />
      ))}
    </>
  );
}

function ClearanceOverlay({ ppf, zoom, mode }: { ppf: number; zoom: number; mode: "all" | "selected" }) {
  const placed = useDesignStore((s) => s.placed);
  const selectedIds = useDesignStore((s) => s.selectedIds);
  const items = useMemo(() => {
    if (mode === "all") return placed;
    return placed.filter((p) => selectedIds.includes(p.id));
  }, [mode, placed, selectedIds]);

  const focus = useMemo(
    () => items.map((p) => {
      const cat = getCatalogItem(p.catalogId);
      return { item: p, poly: cat ? footprintPolygon(p, cat) : [], cat };
    }),
    [items],
  );
  const all = useMemo(
    () => placed.map((p) => {
      const cat = getCatalogItem(p.catalogId);
      return { item: p, poly: cat ? footprintPolygon(p, cat) : [], cat };
    }),
    [placed],
  );

  return (
    <>
      {focus.map(({ item, cat }) => {
        if (!cat?.recommendedClearance) return null;
        const r = cat.recommendedClearance;
        const w = ((item.widthOverride ?? cat.width) + r * 2) * ppf;
        const d = ((item.depthOverride ?? cat.depth) + r * 2) * ppf;
        return (
          <Group key={`clr-${item.id}`} x={item.x * ppf} y={item.y * ppf} rotation={item.rotation}>
            {cat.shape === "circle" ? (
              <Circle radius={w / 2} stroke="#c2410c" strokeWidth={1.25 / zoom} dash={[6 / zoom, 4 / zoom]} />
            ) : (
              <Rect
                x={-w / 2}
                y={-d / 2}
                width={w}
                height={d}
                stroke="#c2410c"
                strokeWidth={1.25 / zoom}
                dash={[6 / zoom, 4 / zoom]}
                cornerRadius={6 / zoom}
              />
            )}
          </Group>
        );
      })}

      {focus.flatMap(({ item: fItem, poly: fPoly }) =>
        all
          .filter(({ item }) => item.id !== fItem.id)
          .map(({ item: oItem, poly: oPoly }) => {
            if (!fPoly.length || !oPoly.length) return null;
            const distFt = polygonDistance(fPoly, oPoly);
            if (distFt > 20) return null;
            const midX = ((fItem.x + oItem.x) / 2) * ppf;
            const midY = ((fItem.y + oItem.y) / 2) * ppf;
            const color = distFt < 2 ? "#b91c1c" : distFt < 3 ? "#b45309" : "#15803d";
            return (
              <Group key={`d-${fItem.id}-${oItem.id}`}>
                <Line
                  points={[fItem.x * ppf, fItem.y * ppf, oItem.x * ppf, oItem.y * ppf]}
                  stroke={color}
                  strokeWidth={1 / zoom}
                  dash={[4 / zoom, 4 / zoom]}
                  opacity={0.65}
                />
                <Label x={midX} y={midY}>
                  <Tag fill="white" stroke={color} strokeWidth={1 / zoom} cornerRadius={3} />
                  <Text text={formatFeet(distFt)} fontSize={11 / zoom} fill={color} padding={3 / zoom} />
                </Label>
              </Group>
            );
          }),
      )}
    </>
  );
}

export function exportStageToPng(): string | null {
  const stage = (window as unknown as { __designStage?: Konva.Stage }).__designStage;
  void stage;
  return null;
}
