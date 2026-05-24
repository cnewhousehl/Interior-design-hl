"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Image as KImage, Rect, Circle, Line, Text, Group, Label, Tag } from "react-konva";
import Konva from "konva";
import useImage from "use-image";
import { CATALOG, getCatalogItem } from "@/lib/catalog";
import { useDesignStore } from "@/lib/store";
import type { CatalogItem, PlacedFurniture, Point } from "@/lib/types";
import { footprintPolygon, polygonDistance, pxDistance } from "@/lib/geometry";
import { formatFeet } from "@/lib/format";

type Size = { width: number; height: number };

export default function FloorPlanCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState<Size>({ width: 800, height: 600 });

  const floorPlan = useDesignStore((s) => s.floorPlan);
  const placed = useDesignStore((s) => s.placed);
  const selectedId = useDesignStore((s) => s.selectedId);
  const toolMode = useDesignStore((s) => s.toolMode);
  const pendingCatalogId = useDesignStore((s) => s.pendingCatalogId);
  const clearanceMode = useDesignStore((s) => s.clearanceMode);
  const showDimensions = useDesignStore((s) => s.showDimensions);
  const showGrid = useDesignStore((s) => s.showGrid);
  const zoom = useDesignStore((s) => s.zoom);
  const pan = useDesignStore((s) => s.pan);

  const setCalibration = useDesignStore((s) => s.setCalibration);
  const addFurniture = useDesignStore((s) => s.addFurniture);
  const updateFurniture = useDesignStore((s) => s.updateFurniture);
  const setSelected = useDesignStore((s) => s.setSelected);
  const setZoom = useDesignStore((s) => s.setZoom);
  const setPan = useDesignStore((s) => s.setPan);

  const [calibPoints, setCalibPoints] = useState<Point[]>([]);
  const [distancePrompt, setDistancePrompt] = useState<{ p1: Point; p2: Point } | null>(null);
  const [distanceValue, setDistanceValue] = useState("");

  const [image] = useImage(floorPlan?.imageDataUrl ?? "", "anonymous");

  // Resize observer to keep canvas filling its container.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // ---------- coordinate conversions ----------
  // We render the image at its native pixel size; everything is then scaled by `zoom` and
  // panned by `pan`. Furniture is stored in real-world feet (scene coords). We convert to
  // image-pixel space using `pixelsPerFoot`, then Konva handles zoom/pan via Stage scale.
  const ppf = floorPlan?.pixelsPerFoot ?? null;

  const feetToImagePx = (feet: number) => (ppf ? feet * ppf : feet);
  const imagePxToFeet = (px: number) => (ppf ? px / ppf : px);

  // ---------- event handlers ----------
  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    // Convert pointer to image-pixel coordinates
    const imgPx: Point = {
      x: (pos.x - pan.x) / zoom,
      y: (pos.y - pan.y) / zoom,
    };

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
      const sceneX = imagePxToFeet(imgPx.x);
      const sceneY = imagePxToFeet(imgPx.y);
      addFurniture({
        id: crypto.randomUUID(),
        catalogId: cat.id,
        label: cat.name,
        x: sceneX,
        y: sceneY,
        rotation: 0,
      });
      return;
    }

    // Click on empty area deselects
    if (e.target === stage || e.target.name() === "floor-image") {
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
    // Zoom around pointer
    const mousePointTo = {
      x: (pointer.x - pan.x) / zoom,
      y: (pointer.y - pan.y) / zoom,
    };
    setZoom(newZoom);
    setPan({
      x: pointer.x - mousePointTo.x * newZoom,
      y: pointer.y - mousePointTo.y * newZoom,
    });
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
    const pixelsPerFoot = pxDist / feet;
    setCalibration({ p1: distancePrompt.p1, p2: distancePrompt.p2, realDistanceFeet: feet }, pixelsPerFoot);
    setDistancePrompt(null);
    setDistanceValue("");
  };

  // Fit image to canvas when loaded
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

  if (!floorPlan) {
    return (
      <div ref={containerRef} className="h-full w-full grid place-items-center text-ink/50">
        <div className="text-center">
          <div className="text-lg font-medium">No floor plan loaded</div>
          <div className="text-sm mt-1">Upload an image or load the example apartment from the top bar.</div>
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
        onWheel={handleWheel}
        style={{ cursor: cursorFor(toolMode) }}
      >
        <Layer>
          {image && (
            <KImage
              image={image}
              name="floor-image"
              listening
              opacity={ppf ? 1 : 0.85}
            />
          )}
          {showGrid && ppf && image && <GridLayer width={image.width} height={image.height} ppf={ppf} />}
        </Layer>

        {/* Calibration overlay */}
        <Layer listening={false}>
          {toolMode === "calibrate" &&
            calibPoints.map((p, i) => (
              <Circle key={i} x={p.x} y={p.y} radius={5 / zoom} fill="#c2410c" stroke="white" strokeWidth={1 / zoom} />
            ))}
          {floorPlan.calibration && (
            <Group opacity={0.4}>
              <Line
                points={[
                  floorPlan.calibration.p1.x,
                  floorPlan.calibration.p1.y,
                  floorPlan.calibration.p2.x,
                  floorPlan.calibration.p2.y,
                ]}
                stroke="#c2410c"
                strokeWidth={2 / zoom}
                dash={[6 / zoom, 4 / zoom]}
              />
            </Group>
          )}
        </Layer>

        {/* Furniture layer */}
        {ppf && (
          <Layer>
            {placed.map((item) => (
              <FurnitureShape
                key={item.id}
                item={item}
                catalog={getCatalogItem(item.catalogId)!}
                ppf={ppf}
                zoom={zoom}
                selected={item.id === selectedId}
                showDimensions={showDimensions}
                onSelect={() => setSelected(item.id)}
                onChange={(partial) => updateFurniture(item.id, partial)}
              />
            ))}
          </Layer>
        )}

        {/* Clearance / distance overlay */}
        {ppf && clearanceMode !== "off" && (
          <Layer listening={false}>
            <ClearanceOverlay ppf={ppf} zoom={zoom} mode={clearanceMode} />
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

      {!ppf && (
        <div className="absolute left-4 bottom-4 bg-ink text-paper text-sm rounded-lg px-3 py-2 max-w-sm shadow">
          <span className="font-medium">Calibrate scale:</span> click "Calibrate" in the toolbar, then click two points on a wall whose length you know.
        </div>
      )}
    </div>
  );
}

function cursorFor(mode: string): string {
  if (mode === "calibrate") return "crosshair";
  if (mode === "place") return "copy";
  return "default";
}

/** Parse "11" or "11.5" or "11'7" or "11'7\"" into feet. */
function parseFeetInput(input: string): number | null {
  const t = input.trim();
  if (!t) return null;
  const ftIn = t.match(/^(\d+(?:\.\d+)?)\s*['′]\s*(\d+(?:\.\d+)?)?\s*["″]?$/);
  if (ftIn) {
    const ft = parseFloat(ftIn[1]);
    const inches = ftIn[2] ? parseFloat(ftIn[2]) : 0;
    return ft + inches / 12;
  }
  const n = parseFloat(t);
  return isFinite(n) ? n : null;
}

// ----------------------------------------------------------------------------
// Furniture rendering
// ----------------------------------------------------------------------------

function FurnitureShape({
  item,
  catalog,
  ppf,
  zoom,
  selected,
  showDimensions,
  onSelect,
  onChange,
}: {
  item: PlacedFurniture;
  catalog: CatalogItem;
  ppf: number;
  zoom: number;
  selected: boolean;
  showDimensions: boolean;
  onSelect: () => void;
  onChange: (partial: Partial<PlacedFurniture>) => void;
}) {
  if (!catalog) return null;
  const w = (item.widthOverride ?? catalog.width) * ppf;
  const d = (item.depthOverride ?? catalog.depth) * ppf;

  const stroke = selected ? "#c2410c" : "#1a1a1a";
  const strokeWidth = (selected ? 2.5 : 1.25) / zoom;

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    onChange({ x: node.x() / ppf, y: node.y() / ppf });
  };

  const handleDblClick = () => {
    const next = (item.rotation + 90) % 360;
    onChange({ rotation: next });
  };

  return (
    <Group
      x={item.x * ppf}
      y={item.y * ppf}
      rotation={item.rotation}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onMouseDown={onSelect}
      onDragEnd={handleDragEnd}
      onDblClick={handleDblClick}
    >
      {catalog.shape === "circle" ? (
        <Circle
          radius={w / 2}
          fill={catalog.color}
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
          fill={catalog.color}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      ) : (
        <Rect
          x={-w / 2}
          y={-d / 2}
          width={w}
          height={d}
          fill={catalog.color}
          stroke={stroke}
          strokeWidth={strokeWidth}
          cornerRadius={Math.min(w, d) * 0.04}
          opacity={catalog.category === "rugs" ? 0.55 : 0.9}
        />
      )}

      {/* Direction arrow — short tick at "front" (top) */}
      {catalog.shape !== "circle" && catalog.category !== "rugs" && (
        <Line
          points={[0, -d / 2, 0, -d / 2 + Math.min(d * 0.18, 14)]}
          stroke="white"
          strokeWidth={2 / zoom}
        />
      )}

      {showDimensions && (
        <Label x={0} y={0} offsetX={0} offsetY={0}>
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
  const pts = [
    -w, -d,
    w - notchWidth, -d,
    w - notchWidth, -d + notchDepth,
    w, -d + notchDepth,
    w, d,
    -w, d,
  ];
  return (
    <Line
      points={pts}
      closed
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      opacity={0.9}
    />
  );
}

// ----------------------------------------------------------------------------
// Grid + clearance overlay
// ----------------------------------------------------------------------------

function GridLayer({ width, height, ppf }: { width: number; height: number; ppf: number }) {
  const lines = useMemo(() => {
    const arr: { points: number[]; major: boolean }[] = [];
    const stepFt = 1;
    for (let f = 0; f <= width / ppf; f += stepFt) {
      const x = f * ppf;
      arr.push({ points: [x, 0, x, height], major: f % 5 === 0 });
    }
    for (let f = 0; f <= height / ppf; f += stepFt) {
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
  const selectedId = useDesignStore((s) => s.selectedId);

  const items = useMemo(() => {
    if (mode === "all") return placed;
    const sel = placed.find((p) => p.id === selectedId);
    return sel ? [sel] : [];
  }, [mode, placed, selectedId]);

  // Pairwise distances from focus item(s) to other items
  const focusPolys = useMemo(
    () =>
      items.map((p) => {
        const cat = getCatalogItem(p.catalogId);
        return { item: p, poly: cat ? footprintPolygon(p, cat) : [], cat };
      }),
    [items],
  );

  const otherPolys = useMemo(
    () =>
      placed.map((p) => {
        const cat = getCatalogItem(p.catalogId);
        return { item: p, poly: cat ? footprintPolygon(p, cat) : [], cat };
      }),
    [placed],
  );

  return (
    <>
      {/* Recommended clearance ring around each focus item */}
      {focusPolys.map(({ item, cat }) => {
        if (!cat?.recommendedClearance) return null;
        const r = cat.recommendedClearance;
        const w = ((item.widthOverride ?? cat.width) + r * 2) * ppf;
        const d = ((item.depthOverride ?? cat.depth) + r * 2) * ppf;
        return (
          <Group
            key={`clr-${item.id}`}
            x={item.x * ppf}
            y={item.y * ppf}
            rotation={item.rotation}
          >
            {cat.shape === "circle" ? (
              <Circle
                radius={w / 2}
                stroke="#c2410c"
                strokeWidth={1.25 / zoom}
                dash={[6 / zoom, 4 / zoom]}
              />
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

      {/* Distance labels: from each focus item to every other item */}
      {focusPolys.flatMap(({ item: fItem, poly: fPoly }) =>
        otherPolys
          .filter(({ item }) => item.id !== fItem.id)
          .map(({ item: oItem, poly: oPoly }) => {
            if (!fPoly.length || !oPoly.length) return null;
            const distFt = polygonDistance(fPoly, oPoly);
            // Skip if very far (>20ft) to reduce clutter
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
                  <Text
                    text={formatFeet(distFt)}
                    fontSize={11 / zoom}
                    fill={color}
                    padding={3 / zoom}
                  />
                </Label>
              </Group>
            );
          }),
      )}
    </>
  );
}
