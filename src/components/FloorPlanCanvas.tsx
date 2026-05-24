"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Image as KImage, Rect, Circle, Line, Text, Group, Label, Tag, Arc, Wedge } from "react-konva";
import Konva from "konva";
import useImage from "use-image";
import { getCatalogItem } from "@/lib/catalog";
import { useDesignStore } from "@/lib/store";
import type { CatalogItem, Door, FixtureMarker, PlacedFurniture, Point, Wall, TrafficPath } from "@/lib/types";
import { footprintPolygon, polygonDistance, pxDistance } from "@/lib/geometry";
import { formatFeet } from "@/lib/format";
import { computeSunArc } from "@/lib/sunPath";
import { runValidation } from "@/lib/validation";

type Size = { width: number; height: number };

const ALIGN_THRESHOLD_FT = 0.25;
const WALL_SNAP_FT = 0.5;

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
  const trafficPaths = useDesignStore((s) => s.trafficPaths);
  const fixtures = useDesignStore((s) => s.fixtures);
  const selectedId = useDesignStore((s) => s.selectedId);
  const selectedIds = useDesignStore((s) => s.selectedIds);
  const toolMode = useDesignStore((s) => s.toolMode);
  const pendingCatalogId = useDesignStore((s) => s.pendingCatalogId);
  const pendingFixtureKind = useDesignStore((s) => s.pendingFixtureKind);
  const clearanceMode = useDesignStore((s) => s.clearanceMode);
  const showDimensions = useDesignStore((s) => s.showDimensions);
  const showGrid = useDesignStore((s) => s.showGrid);
  const showSunPath = useDesignStore((s) => s.showSunPath);
  const layers = useDesignStore((s) => s.layers);
  const zoom = useDesignStore((s) => s.zoom);
  const pan = useDesignStore((s) => s.pan);
  const northDeg = useDesignStore((s) => s.northDeg);
  const fitRequest = useDesignStore((s) => s.fitRequest);

  const setCalibration = useDesignStore((s) => s.setCalibration);
  const addFurniture = useDesignStore((s) => s.addFurniture);
  const updateFurniture = useDesignStore((s) => s.updateFurniture);
  const setSelected = useDesignStore((s) => s.setSelected);
  const toggleInSelection = useDesignStore((s) => s.toggleInSelection);
  const setZoom = useDesignStore((s) => s.setZoom);
  const setPan = useDesignStore((s) => s.setPan);
  const addWall = useDesignStore((s) => s.addWall);
  const addDoor = useDesignStore((s) => s.addDoor);
  const addWindow = useDesignStore((s) => s.addWindow);
  const removeWindow = useDesignStore((s) => s.removeWindow);
  const addAnnotation = useDesignStore((s) => s.addAnnotation);
  const addTrafficPath = useDesignStore((s) => s.addTrafficPath);
  const addFixture = useDesignStore((s) => s.addFixture);
  const removeFixture = useDesignStore((s) => s.removeFixture);
  const setToolMode = useDesignStore((s) => s.setToolMode);

  const [calibPoints, setCalibPoints] = useState<Point[]>([]);
  const [distancePrompt, setDistancePrompt] = useState<{ p1: Point; p2: Point } | null>(null);
  const [distanceValue, setDistanceValue] = useState("");
  const [wallStart, setWallStart] = useState<Point | null>(null);
  const [measureStart, setMeasureStart] = useState<Point | null>(null);
  const [trafficPoints, setTrafficPoints] = useState<Point[]>([]);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [lassoStart, setLassoStart] = useState<Point | null>(null);
  const [lassoEnd, setLassoEnd] = useState<Point | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; itemId: string } | null>(null);
  const [rotating, setRotating] = useState<{ id: string; startAngle: number; startRot: number } | null>(null);
  const [alignLines, setAlignLines] = useState<{ vertical?: number; horizontal?: number }>({});

  const [image] = useImage(floorPlan?.imageDataUrl ?? "", "anonymous");

  // Issue map for inline badges on pieces
  const issueMap = useMemo(() => {
    const issues = runValidation({ placed, walls, doors, trafficPaths, fixtures });
    const map = new Map<string, "error" | "warn">();
    for (const i of issues) {
      if (!i.furnitureId) continue;
      const cur = map.get(i.furnitureId);
      if (!cur || (cur === "warn" && i.severity === "error")) {
        map.set(i.furnitureId, i.severity === "info" ? "warn" : i.severity);
      }
    }
    return map;
  }, [placed, walls, doors, trafficPaths, fixtures]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    (window as unknown as { __designStage?: Konva.Stage | null }).__designStage = stageRef.current;
    return () => {
      (window as unknown as { __designStage?: Konva.Stage | null }).__designStage = null;
    };
  });

  const ppf = floorPlan?.pixelsPerFoot ?? null;
  const imagePxToFeet = (px: number) => (ppf ? px / ppf : px);

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
    if (lassoStart) setLassoEnd(scene.feet);
    if (rotating && ppf) {
      const item = placed.find((p) => p.id === rotating.id);
      if (!item) return;
      const angleNow = Math.atan2(scene.feet.y - item.y, scene.feet.x - item.x);
      let degDelta = ((angleNow - rotating.startAngle) * 180) / Math.PI;
      let newRot = rotating.startRot + degDelta;
      const evt = e.evt as MouseEvent;
      const step = evt.shiftKey ? 15 : 5;
      newRot = Math.round(newRot / step) * step;
      updateFurniture(rotating.id, { rotation: ((newRot % 360) + 360) % 360 });
    }
  };

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const scene = eventToScene(e);
    if (!scene) return;
    const target = e.target;
    const stage = target.getStage();
    // Lasso starts only when we're in select mode and the mousedown landed on empty canvas
    if (toolMode === "select" && (target === stage || target.name() === "floor-image" || target.name() === "room-fill")) {
      const evt = e.evt as MouseEvent;
      // Right-button is reserved for context menu, never start lasso
      if (evt.button === 2) return;
      setLassoStart(scene.feet);
      setLassoEnd(scene.feet);
    }
  };

  const handleStageMouseUp = () => {
    if (lassoStart && lassoEnd) {
      const x0 = Math.min(lassoStart.x, lassoEnd.x);
      const x1 = Math.max(lassoStart.x, lassoEnd.x);
      const y0 = Math.min(lassoStart.y, lassoEnd.y);
      const y1 = Math.max(lassoStart.y, lassoEnd.y);
      const hit = placed.filter(
        (p) => !p.hidden && p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1,
      );
      if (hit.length > 1) {
        // Apply selection via the store directly
        useDesignStore.setState({ selectedIds: hit.map((h) => h.id), selectedId: hit[hit.length - 1].id });
      } else if (hit.length === 1) {
        setSelected(hit[0].id);
      }
    }
    setLassoStart(null);
    setLassoEnd(null);
    if (rotating) setRotating(null);
  };

  const handleContextMenu = (e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
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
      // Snap-to-wall if dropping near a wall
      const snapped = snapToNearestWall(feet, cat, 0, walls);
      addFurniture({
        id: crypto.randomUUID(),
        catalogId: cat.id,
        label: cat.name,
        x: snapped.x,
        y: snapped.y,
        rotation: snapped.rotation,
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

    if (toolMode === "draw-window" && ppf) {
      const wall = nearestWall(feet, walls, 1.5);
      if (!wall) {
        alert("Click closer to a wall — windows must sit on a wall.");
        return;
      }
      const proj = projectOntoWall(feet, wall);
      const angleDeg = (Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x) * 180) / Math.PI;
      addWindow({
        id: crypto.randomUUID(),
        position: proj,
        widthFt: 3,
        angleDeg,
        label: "Window",
      });
      setToolMode("select");
      return;
    }

    if (toolMode === "measure" && ppf) {
      if (!measureStart) {
        setMeasureStart(feet);
      } else {
        addAnnotation({ id: crypto.randomUUID(), type: "measure", a: measureStart, b: feet });
        setMeasureStart(null);
        setToolMode("select");
      }
      return;
    }

    if (toolMode === "traffic" && ppf) {
      // Double-click finishes; single click adds point
      setTrafficPoints((prev) => [...prev, feet]);
      return;
    }

    if (toolMode === "fixture" && ppf) {
      const kind = pendingFixtureKind ?? "outlet";
      addFixture({
        id: crypto.randomUUID(),
        position: feet,
        kind,
      });
      return;
    }

    if (toolMode === "note" && ppf) {
      const text = prompt("Note text:");
      if (text) addAnnotation({ id: crypto.randomUUID(), type: "note", position: feet, text });
      setToolMode("select");
      return;
    }

    const stage = e.target.getStage();
    if (e.target === stage || e.target.name() === "floor-image" || e.target.name() === "room-fill") {
      setSelected(null);
    }
  };

  const handleStageDblClick = () => {
    if (toolMode === "traffic" && trafficPoints.length >= 2) {
      addTrafficPath({
        id: crypto.randomUUID(),
        points: trafficPoints,
        minWidthFt: 3,
        label: "Traffic path",
      });
      setTrafficPoints([]);
      setToolMode("select");
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

  // Fit image to viewport on initial load + fit requests
  const fitToView = () => {
    if (!image || !size.width || !size.height) return;
    const padding = 40;
    const sx = (size.width - padding * 2) / image.width;
    const sy = (size.height - padding * 2) / image.height;
    const z = Math.min(sx, sy, 1);
    setZoom(z);
    setPan({
      x: (size.width - image.width * z) / 2,
      y: (size.height - image.height * z) / 2,
    });
  };

  useEffect(() => {
    if (!image) return;
    fitToView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, size.width, size.height]);

  useEffect(() => {
    if (fitRequest > 0) fitToView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitRequest]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setWallStart(null);
        setMeasureStart(null);
        setTrafficPoints([]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!floorPlan) {
    return (
      <div ref={containerRef} className="h-full w-full grid place-items-center text-ink-500">
        <div className="text-center max-w-sm px-6">
          <div className="w-16 h-16 rounded-2xl bg-paper-200 mx-auto mb-4 grid place-items-center shadow-soft">
            <svg className="w-7 h-7 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 3v18" />
            </svg>
          </div>
          <h2 className="font-display text-xl mb-1 text-ink-800">Start with a floor plan</h2>
          <p className="text-sm text-ink-500 leading-relaxed">
            Upload a PNG or JPG floor plan from the top bar, then calibrate the scale by clicking two points on a wall whose length you know.
          </p>
        </div>
      </div>
    );
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!ppf) return;
    const catalogId = e.dataTransfer.getData("application/x-catalog-id");
    if (!catalogId) return;
    const cat = getCatalogItem(catalogId);
    if (!cat) return;
    // Translate the drop client coords into scene feet
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const imgX = (localX - pan.x) / zoom;
    const imgY = (localY - pan.y) / zoom;
    const feet = { x: imgX / ppf, y: imgY / ppf };
    const snapped = snapToNearestWall(feet, cat, 0, walls);
    addFurniture({
      id: crypto.randomUUID(),
      catalogId: cat.id,
      label: cat.name,
      x: snapped.x,
      y: snapped.y,
      rotation: snapped.rotation,
    });
  };

  return (
    <div
      ref={containerRef}
      className="h-full w-full relative bg-paper-200/30"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/x-catalog-id")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={handleDrop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        scaleX={zoom}
        scaleY={zoom}
        x={pan.x}
        y={pan.y}
        draggable={toolMode === "select" && !lassoStart}
        onDragMove={onDragStage}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onDblClick={handleStageDblClick}
        onMouseMove={handleStageMouseMove}
        onMouseDown={handleStageMouseDown}
        onMouseUp={handleStageMouseUp}
        onContextMenu={handleContextMenu}
        onWheel={handleWheel}
        style={{ cursor: cursorFor(toolMode) }}
      >
        <Layer>
          {image && <KImage image={image} name="floor-image" listening opacity={ppf ? 0.95 : 0.75} />}
          {showGrid && ppf && image && <GridLayer width={image.width} height={image.height} ppf={ppf} />}
        </Layer>

        {ppf && rooms.length > 0 && layers.rooms && (
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
                    fill={r.color ?? "rgba(180, 83, 9, 0.05)"}
                    stroke="rgba(28, 25, 23, 0.15)"
                    strokeWidth={0.5 / zoom}
                    dash={[8 / zoom, 4 / zoom]}
                  />
                  <Label x={cx * ppf} y={cy * ppf}>
                    <Tag fill="rgba(250, 246, 238, 0.92)" stroke="rgba(28,25,23,0.15)" strokeWidth={1 / zoom} cornerRadius={4} />
                    <Text
                      text={r.name}
                      fontSize={11 / zoom}
                      fill="#44403c"
                      padding={4 / zoom}
                      fontStyle="600"
                    />
                  </Label>
                </Group>
              );
            })}
          </Layer>
        )}

        {ppf && (layers.walls || layers.doors || layers.windows) && (
          <Layer>
            {layers.walls && walls.map((w) => {
              const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
              const mx = ((w.a.x + w.b.x) / 2) * ppf;
              const my = ((w.a.y + w.b.y) / 2) * ppf;
              return (
                <Group key={w.id}>
                  <Line
                    points={[w.a.x * ppf, w.a.y * ppf, w.b.x * ppf, w.b.y * ppf]}
                    stroke="#1c1917"
                    strokeWidth={Math.max(3, (w.thicknessFt ?? 0.4) * ppf)}
                    lineCap="round"
                    listening={false}
                  />
                  {showDimensions && len > 1 && (
                    <Label x={mx} y={my} opacity={0.85}>
                      <Tag fill="rgba(250, 246, 238, 0.9)" cornerRadius={2} />
                      <Text text={formatFeet(len)} fontSize={9 / zoom} fill="#1c1917" padding={2 / zoom} />
                    </Label>
                  )}
                </Group>
              );
            })}
            {layers.windows && windows.map((wn) => (
              <WindowMark key={wn.id} w={wn} ppf={ppf} zoom={zoom} onRemove={() => removeWindow(wn.id)} />
            ))}
            {layers.doors && doors.map((d) => (
              <DoorMark key={d.id} door={d} ppf={ppf} zoom={zoom} />
            ))}

            {toolMode === "draw-wall" && wallStart && cursor && (
              <Group listening={false}>
                <Line
                  points={[
                    wallStart.x * ppf,
                    wallStart.y * ppf,
                    snapOrtho(wallStart, cursor).x * ppf,
                    snapOrtho(wallStart, cursor).y * ppf,
                  ]}
                  stroke="#b45309"
                  strokeWidth={3 / zoom}
                  dash={[8 / zoom, 4 / zoom]}
                />
                <Circle x={wallStart.x * ppf} y={wallStart.y * ppf} radius={4 / zoom} fill="#b45309" />
              </Group>
            )}
          </Layer>
        )}

        <Layer listening={false}>
          {toolMode === "calibrate" &&
            calibPoints.map((p, i) => (
              <Circle key={i} x={p.x} y={p.y} radius={6 / zoom} fill="#b45309" stroke="white" strokeWidth={2 / zoom} />
            ))}
        </Layer>

        {/* Light cones (rendered below fixtures for proper z-order) */}
        {ppf && layers.fixtures && fixtures.some((f) => f.kind === "ceiling-light" || f.kind === "wall-light") && (
          <Layer listening={false}>
            {fixtures.map((f) => (
              <LightCone key={`l-${f.id}`} fixture={f} ppf={ppf} zoom={zoom} />
            ))}
          </Layer>
        )}

        {/* Fixtures */}
        {ppf && layers.fixtures && fixtures.length > 0 && (
          <Layer>
            {fixtures.map((f) => (
              <FixtureRender key={f.id} fixture={f} ppf={ppf} zoom={zoom} onRemove={() => removeFixture(f.id)} />
            ))}
          </Layer>
        )}

        {/* Sun path */}
        {ppf && showSunPath && image && (
          <Layer listening={false}>
            <SunPathRender ppf={ppf} zoom={zoom} centerFt={{ x: image.width / ppf / 2, y: image.height / ppf / 2 }} northDeg={northDeg} radiusFt={Math.max(image.width, image.height) / ppf / 1.6} />
          </Layer>
        )}

        {/* Traffic paths */}
        {ppf && layers.trafficPaths && (
          <Layer>
            {trafficPaths.map((p) => (
              <TrafficPathRender key={p.id} path={p} ppf={ppf} zoom={zoom} />
            ))}
            {toolMode === "traffic" && trafficPoints.length > 0 && (
              <Group listening={false}>
                <Line
                  points={[
                    ...trafficPoints.flatMap((p) => [p.x * ppf, p.y * ppf]),
                    ...(cursor ? [cursor.x * ppf, cursor.y * ppf] : []),
                  ]}
                  stroke="#0ea5e9"
                  strokeWidth={3 / zoom}
                  dash={[10 / zoom, 6 / zoom]}
                />
                {trafficPoints.map((p, i) => (
                  <Circle key={i} x={p.x * ppf} y={p.y * ppf} radius={5 / zoom} fill="#0ea5e9" stroke="white" strokeWidth={2 / zoom} />
                ))}
              </Group>
            )}
          </Layer>
        )}

        {ppf && layers.furniture && (
          <Layer>
            {layers.zones && <ZonesOverlay ppf={ppf} zoom={zoom} />}
            {placed.filter((p) => !p.hidden).map((item) => (
              <FurnitureShape
                key={item.id}
                item={item}
                catalog={getCatalogItem(item.catalogId)!}
                ppf={ppf}
                zoom={zoom}
                selected={selectedIds.includes(item.id) || item.id === selectedId}
                showDimensions={showDimensions}
                walls={walls}
                allItems={placed}
                hasIssue={issueMap.get(item.id)}
                onAlignLines={setAlignLines}
                onSelect={(additive) => {
                  if (additive) toggleInSelection(item.id);
                  else setSelected(item.id);
                }}
                onContextMenu={(x, y) => setContextMenu({ x, y, itemId: item.id })}
                onChange={(partial) => updateFurniture(item.id, partial)}
              />
            ))}
            {alignLines.vertical !== undefined && image && (
              <Line
                points={[alignLines.vertical * ppf, 0, alignLines.vertical * ppf, image.height]}
                stroke="#b45309"
                strokeWidth={1 / zoom}
                dash={[6 / zoom, 4 / zoom]}
                listening={false}
                opacity={0.6}
              />
            )}
            {alignLines.horizontal !== undefined && image && (
              <Line
                points={[0, alignLines.horizontal * ppf, image.width, alignLines.horizontal * ppf]}
                stroke="#b45309"
                strokeWidth={1 / zoom}
                dash={[6 / zoom, 4 / zoom]}
                listening={false}
                opacity={0.6}
              />
            )}
          </Layer>
        )}

        {ppf && layers.annotations && (
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
                      <Text text={formatFeet(dist)} fontSize={11 / zoom} fill="#0369a1" padding={3 / zoom} fontStyle="600" />
                    </Label>
                  </Group>
                );
              }
              return (
                <Label key={a.id} x={a.position.x * ppf} y={a.position.y * ppf}>
                  <Tag fill="#fef3c7" stroke="#92400e" strokeWidth={1 / zoom} cornerRadius={4} />
                  <Text text={a.text} fontSize={11 / zoom} fill="#78350f" padding={4 / zoom} />
                </Label>
              );
            })}

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

        {ppf && clearanceMode !== "off" && (
          <Layer listening={false}>
            <ClearanceOverlay ppf={ppf} zoom={zoom} mode={clearanceMode} walls={walls} />
          </Layer>
        )}

        {/* Hover ghost while placing */}
        {ppf && toolMode === "place" && pendingCatalogId && cursor && (
          <Layer listening={false}>
            <PlaceGhost
              catalogId={pendingCatalogId}
              cursor={cursor}
              walls={walls}
              ppf={ppf}
              zoom={zoom}
            />
          </Layer>
        )}

        {/* Lasso marquee */}
        {ppf && lassoStart && lassoEnd && (
          <Layer listening={false}>
            <Rect
              x={Math.min(lassoStart.x, lassoEnd.x) * ppf}
              y={Math.min(lassoStart.y, lassoEnd.y) * ppf}
              width={Math.abs(lassoEnd.x - lassoStart.x) * ppf}
              height={Math.abs(lassoEnd.y - lassoStart.y) * ppf}
              fill="rgba(180, 83, 9, 0.08)"
              stroke="#b45309"
              strokeWidth={1 / zoom}
              dash={[5 / zoom, 4 / zoom]}
            />
          </Layer>
        )}

        {/* Rotation handle for selected piece */}
        {ppf && selectedId && (
          <Layer>
            <RotationHandle
              itemId={selectedId}
              ppf={ppf}
              zoom={zoom}
              onStart={(angle, rot) => setRotating({ id: selectedId, startAngle: angle, startRot: rot })}
            />
          </Layer>
        )}

        {ppf && (
          <Layer listening={false}>
            <NorthArrow zoom={zoom} pan={pan} stageSize={size} northDeg={northDeg} />
          </Layer>
        )}
      </Stage>

      {distancePrompt && <CalibrationModal onSubmit={handleCalibrationSubmit} value={distanceValue} setValue={setDistanceValue} onCancel={() => { setDistancePrompt(null); setDistanceValue(""); }} />}

      {ppf && cursor && (
        <div className="absolute bottom-3 left-3 bg-ink-900/90 backdrop-blur text-paper-50 text-xs px-3 py-1.5 rounded-lg font-mono shadow-float pointer-events-none">
          {cursor.x.toFixed(1)}' × {cursor.y.toFixed(1)}'
        </div>
      )}

      {ppf && (
        <div className="absolute bottom-3 right-3 bg-ink-900/90 backdrop-blur text-paper-50 text-[10px] px-2.5 py-1 rounded-lg font-mono shadow-float pointer-events-none uppercase tracking-wider">
          1 ft = {ppf.toFixed(1)} px
        </div>
      )}

      {!ppf && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-6 bg-ink-900 text-paper-50 text-sm rounded-xl px-4 py-2.5 max-w-md shadow-float flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-500 animate-pulse" />
          <span className="font-medium">Calibrate scale:</span>
          <span className="text-paper-100/80">click "Calibrate" then click two points on a known wall.</span>
        </div>
      )}

      {toolMode === "traffic" && trafficPoints.length > 0 && (
        <div className="absolute left-1/2 -translate-x-1/2 top-4 bg-ink-900 text-paper-50 text-xs rounded-lg px-3 py-1.5 shadow-float">
          Click to add points · Double-click to finish · Esc to cancel
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          itemId={contextMenu.itemId}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

function ContextMenu({
  x,
  y,
  itemId,
  onClose,
}: {
  x: number;
  y: number;
  itemId: string;
  onClose: () => void;
}) {
  const item = useDesignStore((s) => s.placed.find((p) => p.id === itemId));
  const updateFurniture = useDesignStore((s) => s.updateFurniture);
  const removeFurniture = useDesignStore((s) => s.removeFurniture);
  const duplicateFurniture = useDesignStore((s) => s.duplicateFurniture);
  const groupSelection = useDesignStore((s) => s.groupSelection);
  const ungroupSelection = useDesignStore((s) => s.ungroupSelection);
  const selectedIds = useDesignStore((s) => s.selectedIds);

  if (!item) return null;

  const actions: { label: string; shortcut?: string; onClick: () => void; danger?: boolean; disabled?: boolean }[] = [
    { label: "Duplicate", shortcut: "⌘D", onClick: () => duplicateFurniture(item.id) },
    { label: "Rotate 90°", shortcut: "Dbl-click", onClick: () => updateFurniture(item.id, { rotation: (item.rotation + 90) % 360 }) },
    { label: item.locked ? "Unlock" : "Lock", onClick: () => updateFurniture(item.id, { locked: !item.locked }) },
    { label: item.hidden ? "Show" : "Hide", onClick: () => updateFurniture(item.id, { hidden: !item.hidden }) },
    { label: "Group selection", onClick: () => groupSelection(), disabled: selectedIds.length < 2 },
    { label: "Ungroup", onClick: () => ungroupSelection(), disabled: !item.groupId },
    { label: "Delete", shortcut: "Del", onClick: () => removeFurniture(item.id), danger: true },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        className="absolute z-50 card shadow-float py-1 w-44 animate-fade-in"
        style={{ left: x + 2, top: y + 2 }}
      >
        {actions.map((a, i) => (
          <button
            key={i}
            disabled={a.disabled}
            onClick={() => {
              a.onClick();
              onClose();
            }}
            className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-ink-100 disabled:opacity-30 disabled:cursor-not-allowed ${
              a.danger ? "text-red-700 hover:bg-red-50" : ""
            }`}
          >
            <span>{a.label}</span>
            {a.shortcut && <span className="text-[9px] font-mono text-ink-400">{a.shortcut}</span>}
          </button>
        ))}
      </div>
    </>
  );
}

function CalibrationModal({
  onSubmit,
  onCancel,
  value,
  setValue,
}: {
  onSubmit: () => void;
  onCancel: () => void;
  value: string;
  setValue: (v: string) => void;
}) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-ink-900/40 backdrop-blur-sm animate-fade-in z-30">
      <div className="card shadow-float p-6 w-[360px] animate-slide-up">
        <h3 className="font-display text-lg mb-1.5">Calibrate scale</h3>
        <p className="text-sm text-ink-500 mb-4 leading-relaxed">
          What's the real-world distance between the two points you clicked?
        </p>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
            if (e.key === "Escape") onCancel();
          }}
          placeholder={`11   ·   11.58   ·   11'7"`}
          className="input font-mono"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="btn-outline btn-md">
            Cancel
          </button>
          <button onClick={onSubmit} className="btn-accent btn-md">
            Set scale
          </button>
        </div>
      </div>
    </div>
  );
}

function cursorFor(mode: string): string {
  if (mode === "calibrate" || mode === "draw-wall" || mode === "measure" || mode === "traffic") return "crosshair";
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

/**
 * Snap a piece's center against the nearest wall: if a wall is within WALL_SNAP_FT
 * of the requested center, push the piece so its back edge sits flush on the wall.
 * Returns the snapped center plus the rotation that orients the piece's back to the wall.
 */
function snapToNearestWall(
  center: Point,
  cat: CatalogItem,
  curRotation: number,
  walls: Wall[],
): { x: number; y: number; rotation: number } {
  const wall = nearestWall(center, walls, WALL_SNAP_FT * 6);
  if (!wall) return { x: center.x, y: center.y, rotation: curRotation };
  const proj = projectOntoWall(center, wall);
  const dist = Math.hypot(center.x - proj.x, center.y - proj.y);
  if (dist > WALL_SNAP_FT * 6) return { x: center.x, y: center.y, rotation: curRotation };
  const wallAngle = Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x);
  // Normal pointing from wall toward center
  const nx = center.x - proj.x;
  const ny = center.y - proj.y;
  const nLen = Math.hypot(nx, ny) || 1;
  const nux = nx / nLen;
  const nuy = ny / nLen;
  const depth = cat.depth / 2;
  return {
    x: proj.x + nux * depth,
    y: proj.y + nuy * depth,
    rotation: ((wallAngle * 180) / Math.PI + 90) % 360,
  };
}

// ---------------------------------------------------------------------------
// Furniture
// ---------------------------------------------------------------------------

/**
 * Move every selected piece by the same delta. If the dragged piece is part
 * of a group, every piece in the group moves too. Locked pieces are skipped.
 */
function applyMoveToSelection(draggedId: string, dx: number, dy: number, rotationOverride?: number) {
  const state = useDesignStore.getState();
  const ids = state.selectedIds.includes(draggedId) && state.selectedIds.length > 1
    ? state.selectedIds
    : [draggedId];
  const dragged = state.placed.find((p) => p.id === draggedId);
  let allIds = ids;
  if (dragged?.groupId) {
    const groupMates = state.placed.filter((p) => p.groupId === dragged.groupId).map((p) => p.id);
    allIds = Array.from(new Set([...ids, ...groupMates]));
  }
  for (const id of allIds) {
    const piece = state.placed.find((p) => p.id === id);
    if (!piece || piece.locked) continue;
    const update: Partial<PlacedFurniture> = { x: piece.x + dx, y: piece.y + dy };
    if (id === draggedId && rotationOverride !== undefined) update.rotation = rotationOverride;
    state.updateFurniture(id, update);
  }
}

function FurnitureShape({
  item,
  catalog,
  ppf,
  zoom,
  selected,
  showDimensions,
  walls,
  allItems,
  hasIssue,
  onAlignLines,
  onSelect,
  onContextMenu,
  onChange,
}: {
  item: PlacedFurniture;
  catalog: CatalogItem;
  ppf: number;
  zoom: number;
  selected: boolean;
  showDimensions: boolean;
  walls: Wall[];
  allItems: PlacedFurniture[];
  hasIssue?: "error" | "warn";
  onAlignLines: (lines: { vertical?: number; horizontal?: number }) => void;
  onSelect: (additive: boolean) => void;
  onContextMenu: (x: number, y: number) => void;
  onChange: (partial: Partial<PlacedFurniture>) => void;
}) {
  if (!catalog) return null;
  const w = (item.widthOverride ?? catalog.width) * ppf;
  const d = (item.depthOverride ?? catalog.depth) * ppf;
  const statusColor =
    item.status === "owned" ? "#5d7a5a"
    : item.status === "ordered" ? "#0369a1"
    : item.status === "wishlist" ? "#b45309"
    : item.status === "considering" ? "#78716c"
    : null;
  const stroke = selected ? "#b45309" : statusColor ?? "#1c1917";
  const strokeWidth = (selected ? 2.5 : 1.25) / zoom;

  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (item.locked) return;
    const node = e.target;
    let x = node.x() / ppf;
    let y = node.y() / ppf;
    let alignV: number | undefined;
    let alignH: number | undefined;
    const myW = item.widthOverride ?? catalog.width;
    const myD = item.depthOverride ?? catalog.depth;
    for (const other of allItems) {
      if (other.id === item.id || other.hidden) continue;
      const oCat = getCatalogItem(other.catalogId);
      if (!oCat) continue;
      const oW = other.widthOverride ?? oCat.width;
      const oD = other.depthOverride ?? oCat.depth;
      // Center alignment
      if (Math.abs(other.x - x) < ALIGN_THRESHOLD_FT) {
        x = other.x;
        alignV = other.x;
      }
      if (Math.abs(other.y - y) < ALIGN_THRESHOLD_FT) {
        y = other.y;
        alignH = other.y;
      }
      // Edge-to-edge snap (left edge to left, right edge to right, etc.)
      const myLeft = x - myW / 2;
      const myRight = x + myW / 2;
      const myTop = y - myD / 2;
      const myBottom = y + myD / 2;
      const oLeft = other.x - oW / 2;
      const oRight = other.x + oW / 2;
      const oTop = other.y - oD / 2;
      const oBottom = other.y + oD / 2;
      if (Math.abs(myLeft - oLeft) < ALIGN_THRESHOLD_FT) { x = oLeft + myW / 2; alignV = oLeft; }
      else if (Math.abs(myRight - oRight) < ALIGN_THRESHOLD_FT) { x = oRight - myW / 2; alignV = oRight; }
      else if (Math.abs(myLeft - oRight) < ALIGN_THRESHOLD_FT) { x = oRight + myW / 2; alignV = oRight; }
      else if (Math.abs(myRight - oLeft) < ALIGN_THRESHOLD_FT) { x = oLeft - myW / 2; alignV = oLeft; }
      if (Math.abs(myTop - oTop) < ALIGN_THRESHOLD_FT) { y = oTop + myD / 2; alignH = oTop; }
      else if (Math.abs(myBottom - oBottom) < ALIGN_THRESHOLD_FT) { y = oBottom - myD / 2; alignH = oBottom; }
      else if (Math.abs(myTop - oBottom) < ALIGN_THRESHOLD_FT) { y = oBottom + myD / 2; alignH = oBottom; }
      else if (Math.abs(myBottom - oTop) < ALIGN_THRESHOLD_FT) { y = oTop - myD / 2; alignH = oTop; }
    }
    node.x(x * ppf);
    node.y(y * ppf);
    onAlignLines({ vertical: alignV, horizontal: alignH });
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (item.locked) return;
    const node = e.target;
    let x = node.x() / ppf;
    let y = node.y() / ppf;
    const dx = x - item.x;
    const dy = y - item.y;
    // Try wall snap at release time
    if (walls.length && catalog.category !== "rugs") {
      const snap = snapToNearestWall({ x, y }, catalog, item.rotation, walls);
      const dist = Math.hypot(snap.x - x, snap.y - y);
      if (dist < WALL_SNAP_FT) {
        x = snap.x;
        y = snap.y;
        const wallDx = x - item.x;
        const wallDy = y - item.y;
        applyMoveToSelection(item.id, wallDx, wallDy, snap.rotation);
        onAlignLines({});
        return;
      }
    }
    applyMoveToSelection(item.id, dx, dy);
    onAlignLines({});
  };

  const handleDblClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    if (item.locked) return;
    const step = e.evt.shiftKey ? 5 : 90;
    onChange({ rotation: (item.rotation + step) % 360 });
  };

  return (
    <Group
      x={item.x * ppf}
      y={item.y * ppf}
      rotation={item.rotation}
      draggable={!item.locked}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect(e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey);
      }}
      onTap={() => onSelect(false)}
      onMouseDown={() => onSelect(false)}
      onContextMenu={(e) => {
        e.evt.preventDefault();
        e.cancelBubble = true;
        onSelect(false);
        const stage = e.target.getStage();
        const ptr = stage?.getPointerPosition();
        if (ptr) onContextMenu(ptr.x, ptr.y);
      }}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDblClick={handleDblClick}
    >
      {selected && (
        <Rect
          x={-w / 2 - 4 / zoom}
          y={-d / 2 - 4 / zoom}
          width={w + 8 / zoom}
          height={d + 8 / zoom}
          stroke="#b45309"
          strokeWidth={1 / zoom}
          dash={[3 / zoom, 3 / zoom]}
          fill="rgba(180, 83, 9, 0.04)"
          cornerRadius={2 / zoom}
        />
      )}
      {catalog.shape === "circle" ? (
        <Circle
          radius={w / 2}
          fill={item.colorOverride ?? catalog.color}
          stroke={stroke}
          strokeWidth={strokeWidth}
          opacity={catalog.category === "rugs" ? 0.5 : 0.92}
          shadowColor="rgba(0,0,0,0.25)"
          shadowBlur={selected ? 8 / zoom : 0}
          shadowOpacity={selected ? 0.4 : 0}
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
          cornerRadius={Math.min(w, d) * 0.06}
          opacity={catalog.category === "rugs" ? 0.5 : 0.92}
        />
      )}

      {item.imageDataUrl && <FurnitureImage url={item.imageDataUrl} width={w} depth={d} catalog={catalog} />}

      {catalog.shape !== "circle" && catalog.category !== "rugs" && (
        <Line points={[0, -d / 2, 0, -d / 2 + Math.min(d * 0.2, 14 / zoom)]} stroke="white" strokeWidth={2 / zoom} />
      )}

      {(showDimensions || selected) && (
        // Counter-rotate so the label sits in scene-aligned coords (always horizontal),
        // and offset it just outside the piece's bounding circle so it never covers the shape.
        <Group rotation={-item.rotation} listening={false}>
          <Label x={0} y={-Math.max(w, d) / 2 - 6 / zoom}>
            <Tag
              fill={selected ? "rgba(180, 83, 9, 0.95)" : "rgba(250, 246, 238, 0.96)"}
              stroke={selected ? "rgba(180, 83, 9, 1)" : "rgba(28, 25, 23, 0.18)"}
              strokeWidth={0.75 / zoom}
              cornerRadius={3}
              pointerDirection="down"
              pointerWidth={6 / zoom}
              pointerHeight={4 / zoom}
            />
            <Text
              text={`${item.label} · ${formatFeet(item.widthOverride ?? catalog.width)}×${formatFeet(item.depthOverride ?? catalog.depth)}`}
              fontSize={10 / zoom}
              fill={selected ? "#fafaf9" : "#1c1917"}
              padding={4 / zoom}
              align="center"
              lineHeight={1.2}
            />
          </Label>
        </Group>
      )}

      {/* Inline issue badge (top-right corner) */}
      {hasIssue && (
        <Group x={w / 2 - 6 / zoom} y={-d / 2 + 6 / zoom} listening={false}>
          <Circle radius={6 / zoom} fill={hasIssue === "error" ? "#dc2626" : "#f59e0b"} stroke="white" strokeWidth={1.5 / zoom} />
          <Text
            text="!"
            x={-3 / zoom}
            y={-5 / zoom}
            width={6 / zoom}
            align="center"
            fontSize={9 / zoom}
            fontStyle="700"
            fill="white"
          />
        </Group>
      )}

      {/* Lock indicator (top-left corner) */}
      {item.locked && (
        <Group x={-w / 2 + 6 / zoom} y={-d / 2 + 6 / zoom} listening={false}>
          <Circle radius={6 / zoom} fill="#1c1917" stroke="white" strokeWidth={1.5 / zoom} />
          <Text
            text="🔒"
            x={-5 / zoom}
            y={-5 / zoom}
            width={10 / zoom}
            align="center"
            fontSize={8 / zoom}
          />
        </Group>
      )}
    </Group>
  );
}

function RotationHandle({
  itemId,
  ppf,
  zoom,
  onStart,
}: {
  itemId: string;
  ppf: number;
  zoom: number;
  onStart: (startAngle: number, startRot: number) => void;
}) {
  const item = useDesignStore((s) => s.placed.find((p) => p.id === itemId));
  if (!item) return null;
  const cat = getCatalogItem(item.catalogId);
  if (!cat) return null;
  const d = (item.depthOverride ?? cat.depth) * ppf;
  // Position the handle 18px (scene px) above the piece's local top edge
  // The handle is a small circle that the user drags to rotate
  const localOffsetY = -d / 2 - 22 / zoom;
  const rad = (item.rotation * Math.PI) / 180;
  const hx = item.x * ppf + Math.sin(rad) * -localOffsetY * -1; // rotate offset vector
  const hy = item.y * ppf + Math.cos(rad) * localOffsetY;
  // Simpler approach: render handle in a rotated group
  return (
    <Group x={item.x * ppf} y={item.y * ppf} rotation={item.rotation} listening>
      <Line
        points={[0, -d / 2, 0, localOffsetY + 5 / zoom]}
        stroke="#b45309"
        strokeWidth={1 / zoom}
        dash={[3 / zoom, 3 / zoom]}
        listening={false}
      />
      <Circle
        x={0}
        y={localOffsetY}
        radius={5 / zoom}
        fill="#b45309"
        stroke="white"
        strokeWidth={1.5 / zoom}
        onMouseDown={(e) => {
          e.cancelBubble = true;
          // Capture starting cursor angle relative to item center, in world coords
          const stage = e.target.getStage();
          if (!stage) return;
          const ptr = stage.getPointerPosition();
          if (!ptr) return;
          const pan = useDesignStore.getState().pan;
          const zm = useDesignStore.getState().zoom;
          const worldX = (ptr.x - pan.x) / zm / ppf;
          const worldY = (ptr.y - pan.y) / zm / ppf;
          const startAngle = Math.atan2(worldY - item.y, worldX - item.x);
          onStart(startAngle, item.rotation);
        }}
      />
      {/* Suppress unused vars */}
      {void hx}
      {void hy}
    </Group>
  );
}

function FurnitureImage({
  url,
  width,
  depth,
  catalog,
}: {
  url: string;
  width: number;
  depth: number;
  catalog: CatalogItem;
}) {
  const [img] = useImage(url, "anonymous");
  if (!img) return null;
  // Compute clip path matching the catalog shape so the image conforms
  if (catalog.shape === "circle") {
    return (
      <KImage
        image={img}
        x={-width / 2}
        y={-depth / 2}
        width={width}
        height={depth}
        opacity={0.95}
        listening={false}
      />
    );
  }
  return (
    <KImage
      image={img}
      x={-width / 2}
      y={-depth / 2}
      width={width}
      height={depth}
      opacity={0.95}
      listening={false}
    />
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
  return <Line points={pts} closed fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={0.92} />;
}

function DoorMark({ door, ppf, zoom }: { door: Door; ppf: number; zoom: number }) {
  const r = door.widthFt * ppf;
  const open = door.openDeg ?? 90;
  const angleOffset = door.swing === "left" ? 0 : -open;
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
        stroke="#92400e"
        strokeWidth={1 / zoom}
        dash={[4 / zoom, 3 / zoom]}
        opacity={0.6}
      />
      <Line
        points={[door.position.x * ppf, door.position.y * ppf, leafEnd.x, leafEnd.y]}
        stroke="#92400e"
        strokeWidth={2 / zoom}
      />
      <Circle x={door.position.x * ppf} y={door.position.y * ppf} radius={3 / zoom} fill="#92400e" />
    </Group>
  );
}

function WindowMark({
  w,
  ppf,
  zoom,
  onRemove,
}: {
  w: { position: Point; widthFt: number; angleDeg: number };
  ppf: number;
  zoom: number;
  onRemove?: () => void;
}) {
  const r = w.widthFt * ppf;
  const cos = Math.cos((w.angleDeg * Math.PI) / 180);
  const sin = Math.sin((w.angleDeg * Math.PI) / 180);
  const end = { x: w.position.x * ppf + r * cos, y: w.position.y * ppf + r * sin };
  // Render as a doubled line (glass between frames) with two end caps
  const perp = { x: -sin, y: cos };
  const off = 1.5 / zoom;
  return (
    <Group
      onClick={(e) => {
        e.cancelBubble = true;
        if ((e.evt.shiftKey || e.evt.metaKey) && onRemove) onRemove();
      }}
    >
      <Line
        points={[w.position.x * ppf, w.position.y * ppf, end.x, end.y]}
        stroke="#faf6ee"
        strokeWidth={5 / zoom}
        lineCap="butt"
      />
      <Line
        points={[w.position.x * ppf + perp.x * off, w.position.y * ppf + perp.y * off, end.x + perp.x * off, end.y + perp.y * off]}
        stroke="#7aa6c7"
        strokeWidth={1.5 / zoom}
        lineCap="butt"
      />
      <Line
        points={[w.position.x * ppf - perp.x * off, w.position.y * ppf - perp.y * off, end.x - perp.x * off, end.y - perp.y * off]}
        stroke="#7aa6c7"
        strokeWidth={1.5 / zoom}
        lineCap="butt"
      />
      <Circle x={w.position.x * ppf} y={w.position.y * ppf} radius={2 / zoom} fill="#7aa6c7" />
      <Circle x={end.x} y={end.y} radius={2 / zoom} fill="#7aa6c7" />
    </Group>
  );
}

function TrafficPathRender({ path, ppf, zoom }: { path: TrafficPath; ppf: number; zoom: number }) {
  const pts = path.points.flatMap((p) => [p.x * ppf, p.y * ppf]);
  // Determine path length midpoint for label
  let midX = 0;
  let midY = 0;
  if (path.points.length >= 2) {
    const middleIdx = Math.floor(path.points.length / 2);
    midX = path.points[middleIdx].x * ppf;
    midY = path.points[middleIdx].y * ppf;
  }
  return (
    <Group listening={false}>
      <Line
        points={pts}
        stroke="#0ea5e9"
        strokeWidth={path.minWidthFt * ppf}
        opacity={0.1}
        lineCap="round"
        lineJoin="round"
      />
      <Line points={pts} stroke="#0ea5e9" strokeWidth={2 / zoom} dash={[8 / zoom, 4 / zoom]} />
      <Label x={midX} y={midY}>
        <Tag fill="rgba(14, 165, 233, 0.95)" cornerRadius={3} />
        <Text text={`${path.label ?? "Path"} · ${formatFeet(path.minWidthFt)}`} fontSize={10 / zoom} fill="white" padding={3 / zoom} fontStyle="600" />
      </Label>
    </Group>
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
  const margin = 30;
  const sx = (stageSize.width - margin - pan.x) / zoom;
  const sy = (margin - pan.y) / zoom;
  const size = 22 / zoom;
  const rad = ((northDeg - 90) * Math.PI) / 180;
  const tipX = sx + size * Math.cos(rad);
  const tipY = sy + size * Math.sin(rad);
  return (
    <Group>
      <Circle x={sx} y={sy} radius={size + 5 / zoom} stroke="#1c1917" strokeWidth={1 / zoom} fill="rgba(250,246,238,0.92)" />
      <Line points={[sx, sy, tipX, tipY]} stroke="#b45309" strokeWidth={2 / zoom} lineCap="round" />
      <Text
        x={tipX - 4 / zoom}
        y={tipY - 14 / zoom}
        text="N"
        fontSize={11 / zoom}
        fontStyle="700"
        fill="#1c1917"
      />
    </Group>
  );
}

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
          stroke={l.major ? "rgba(28,25,23,0.18)" : "rgba(28,25,23,0.07)"}
          strokeWidth={l.major ? 1 : 0.5}
        />
      ))}
    </>
  );
}

function LightCone({ fixture, ppf, zoom }: { fixture: FixtureMarker; ppf: number; zoom: number }) {
  if (fixture.kind !== "ceiling-light" && fixture.kind !== "wall-light") return null;
  const r = (fixture.kind === "ceiling-light" ? 7 : 4) * ppf;
  return (
    <Circle
      x={fixture.position.x * ppf}
      y={fixture.position.y * ppf}
      radius={r}
      fill="rgba(250, 204, 21, 0.10)"
      stroke="rgba(217, 119, 6, 0.45)"
      strokeWidth={0.75 / zoom}
      dash={[6 / zoom, 6 / zoom]}
      listening={false}
    />
  );
}

function FixtureRender({
  fixture,
  ppf,
  zoom,
  onRemove,
}: {
  fixture: FixtureMarker;
  ppf: number;
  zoom: number;
  onRemove: () => void;
}) {
  const cx = fixture.position.x * ppf;
  const cy = fixture.position.y * ppf;
  const r = 8 / zoom;
  const palette: Record<string, { fill: string; symbol: string }> = {
    outlet: { fill: "#1c1917", symbol: "⏚" },
    switch: { fill: "#0369a1", symbol: "S" },
    vent: { fill: "#7c3aed", symbol: "V" },
    "ceiling-light": { fill: "#eab308", symbol: "○" },
    "wall-light": { fill: "#eab308", symbol: "◐" },
    radiator: { fill: "#dc2626", symbol: "R" },
    plumbing: { fill: "#0ea5e9", symbol: "P" },
    sink: { fill: "#0ea5e9", symbol: "⌀" },
    range: { fill: "#dc2626", symbol: "♨" },
    fridge: { fill: "#0369a1", symbol: "F" },
    dishwasher: { fill: "#0891b2", symbol: "DW" },
    "washer-dryer": { fill: "#7c3aed", symbol: "W/D" },
    toilet: { fill: "#0f766e", symbol: "T" },
    shower: { fill: "#0ea5e9", symbol: "▤" },
    tub: { fill: "#0ea5e9", symbol: "▭" },
  };
  const { fill, symbol } = palette[fixture.kind] ?? palette.outlet;
  // Shrink font for multi-char symbols so they fit inside the circle.
  const fontSize = symbol.length <= 1 ? r * 1.2 : symbol.length === 2 ? r * 0.9 : r * 0.7;
  return (
    <Group
      x={cx}
      y={cy}
      onClick={(e) => {
        e.cancelBubble = true;
        if (e.evt.shiftKey || e.evt.metaKey) onRemove();
      }}
      onTap={() => {}}
    >
      <Circle radius={r} fill="white" stroke={fill} strokeWidth={1.5 / zoom} />
      <Text
        text={symbol}
        x={-r}
        y={-r * 0.85}
        width={r * 2}
        height={r * 1.7}
        align="center"
        verticalAlign="middle"
        fontSize={fontSize}
        fill={fill}
        fontStyle="700"
      />
      {fixture.label && (
        <Text
          text={fixture.label}
          x={-30 / zoom}
          y={r + 2 / zoom}
          width={60 / zoom}
          align="center"
          fontSize={9 / zoom}
          fill="#44403c"
          fontStyle="600"
          listening={false}
        />
      )}
    </Group>
  );
}

function SunPathRender({
  ppf,
  zoom,
  centerFt,
  radiusFt,
  northDeg,
}: {
  ppf: number;
  zoom: number;
  centerFt: Point;
  radiusFt: number;
  northDeg: number;
}) {
  const { arcPath, marks } = computeSunArc({ centerFt, radiusFt, northDeg });
  const points = arcPath.flatMap((p) => [p.x * ppf, p.y * ppf]);
  return (
    <Group opacity={0.85}>
      <Line points={points} stroke="#f59e0b" strokeWidth={2 / zoom} dash={[6 / zoom, 4 / zoom]} />
      {marks.map((m, i) => (
        <Group key={i} opacity={m.intensity}>
          <Circle x={m.position.x * ppf} y={m.position.y * ppf} radius={8 / zoom} fill="#fbbf24" stroke="#92400e" strokeWidth={1 / zoom} />
          <Text
            text={m.label}
            x={m.position.x * ppf - 12 / zoom}
            y={m.position.y * ppf - 22 / zoom}
            width={24 / zoom}
            align="center"
            fontSize={9 / zoom}
            fontStyle="700"
            fill="#92400e"
          />
        </Group>
      ))}
    </Group>
  );
}

function ZonesOverlay({ ppf, zoom }: { ppf: number; zoom: number }) {
  const placed = useDesignStore((s) => s.placed);
  const selectedIds = useDesignStore((s) => s.selectedIds);
  // Only render zones for selected pieces to reduce noise
  const focus = placed.filter((p) => selectedIds.includes(p.id) && !p.hidden);
  return (
    <>
      {focus.map((p) => {
        const cat = getCatalogItem(p.catalogId);
        if (!cat) return null;
        // Conversation zone around seating
        if (cat.category === "seating" && !cat.id.includes("dining") && !cat.id.includes("barstool")) {
          return (
            <Group key={`conv-${p.id}`} x={p.x * ppf} y={p.y * ppf}>
              <Circle
                radius={5 * ppf}
                stroke="#5d7a5a"
                strokeWidth={1 / zoom}
                dash={[6 / zoom, 4 / zoom]}
                fill="rgba(93, 122, 90, 0.04)"
                opacity={0.7}
              />
              <Label x={0} y={-5 * ppf - 14 / zoom}>
                <Tag fill="rgba(93, 122, 90, 0.92)" cornerRadius={3} />
                <Text text="Conversation zone · 10'" fontSize={9 / zoom} fill="white" padding={2 / zoom} fontStyle="600" />
              </Label>
            </Group>
          );
        }
        // TV viewing wedge in front of TV stand (front = local -Y)
        if (cat.id === "tv-stand") {
          const w = p.widthOverride ?? cat.width;
          const screenDiag = w * 0.85; // approximate TV diagonal as 85% of stand width
          const minDist = screenDiag * 1.5;
          const maxDist = screenDiag * 2.5;
          return (
            <Group key={`tv-${p.id}`} x={p.x * ppf} y={p.y * ppf} rotation={p.rotation - 90}>
              <Wedge
                radius={maxDist * ppf}
                angle={60}
                rotation={-30}
                fill="rgba(180, 83, 9, 0.06)"
                stroke="#b45309"
                strokeWidth={1 / zoom}
                dash={[6 / zoom, 4 / zoom]}
                opacity={0.7}
              />
              <Circle radius={minDist * ppf} stroke="#b45309" strokeWidth={1 / zoom} dash={[4 / zoom, 4 / zoom]} opacity={0.5} />
              <Label x={(maxDist * ppf) / 1.5} y={-14 / zoom} rotation={90 - p.rotation}>
                <Tag fill="rgba(180, 83, 9, 0.92)" cornerRadius={3} />
                <Text text={`Viewing ${minDist.toFixed(1)}–${maxDist.toFixed(1)}'`} fontSize={9 / zoom} fill="white" padding={2 / zoom} fontStyle="600" />
              </Label>
            </Group>
          );
        }
        return null;
      })}
    </>
  );
}

function PlaceGhost({
  catalogId,
  cursor,
  walls,
  ppf,
  zoom,
}: {
  catalogId: string;
  cursor: Point;
  walls: Wall[];
  ppf: number;
  zoom: number;
}) {
  const cat = getCatalogItem(catalogId);
  if (!cat) return null;
  const snap = snapToNearestWall(cursor, cat, 0, walls);
  const w = cat.width * ppf;
  const d = cat.depth * ppf;
  return (
    <Group x={snap.x * ppf} y={snap.y * ppf} rotation={snap.rotation} opacity={0.55}>
      {cat.shape === "circle" ? (
        <Circle radius={w / 2} fill={cat.color} stroke="#b45309" strokeWidth={1.5 / zoom} dash={[4 / zoom, 3 / zoom]} />
      ) : cat.shape === "l-shape" && cat.lShape ? (
        <LShape
          width={w}
          depth={d}
          notchWidth={cat.lShape.notchWidth * ppf}
          notchDepth={cat.lShape.notchDepth * ppf}
          fill={cat.color}
          stroke="#b45309"
          strokeWidth={1.5 / zoom}
        />
      ) : (
        <Rect
          x={-w / 2}
          y={-d / 2}
          width={w}
          height={d}
          fill={cat.color}
          stroke="#b45309"
          strokeWidth={1.5 / zoom}
          dash={[4 / zoom, 3 / zoom]}
          cornerRadius={Math.min(w, d) * 0.05}
        />
      )}
    </Group>
  );
}

function ClearanceOverlay({
  ppf,
  zoom,
  mode,
  walls,
}: {
  ppf: number;
  zoom: number;
  mode: "all" | "selected";
  walls: Wall[];
}) {
  const placed = useDesignStore((s) => s.placed);
  const selectedIds = useDesignStore((s) => s.selectedIds);
  const items = useMemo(() => {
    if (mode === "all") return placed.filter((p) => !p.hidden);
    return placed.filter((p) => selectedIds.includes(p.id) && !p.hidden);
  }, [mode, placed, selectedIds]);

  const focus = useMemo(
    () => items.map((p) => {
      const cat = getCatalogItem(p.catalogId);
      return { item: p, poly: cat ? footprintPolygon(p, cat) : [], cat };
    }),
    [items],
  );
  const all = useMemo(
    () => placed.filter((p) => !p.hidden).map((p) => {
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
              <Circle radius={w / 2} stroke="#b45309" strokeWidth={1.25 / zoom} dash={[6 / zoom, 4 / zoom]} opacity={0.7} />
            ) : (
              <Rect
                x={-w / 2}
                y={-d / 2}
                width={w}
                height={d}
                stroke="#b45309"
                strokeWidth={1.25 / zoom}
                dash={[6 / zoom, 4 / zoom]}
                cornerRadius={6 / zoom}
                opacity={0.7}
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
            const color = distFt < 2 ? "#b91c1c" : distFt < 3 ? "#b45309" : "#5d7a5a";
            return (
              <Group key={`d-${fItem.id}-${oItem.id}`}>
                <Line
                  points={[fItem.x * ppf, fItem.y * ppf, oItem.x * ppf, oItem.y * ppf]}
                  stroke={color}
                  strokeWidth={1 / zoom}
                  dash={[4 / zoom, 4 / zoom]}
                  opacity={0.55}
                />
                <Label x={midX} y={midY}>
                  <Tag fill="white" stroke={color} strokeWidth={1 / zoom} cornerRadius={3} />
                  <Text text={formatFeet(distFt)} fontSize={10 / zoom} fill={color} padding={3 / zoom} fontStyle="600" />
                </Label>
              </Group>
            );
          }),
      )}

      {/* Furniture-to-wall distance for focused items */}
      {focus.map(({ item, poly }) => {
        if (!poly.length || !walls.length) return null;
        // Find closest wall
        let best: { wall: Wall; foot: Point; from: Point; dist: number } | null = null;
        for (const w of walls) {
          for (const corner of poly) {
            const foot = projectOntoWall(corner, w);
            const dist = Math.hypot(corner.x - foot.x, corner.y - foot.y);
            if (!best || dist < best.dist) best = { wall: w, foot, from: corner, dist };
          }
        }
        if (!best || best.dist > 6) return null;
        const color = best.dist < 1 ? "#b91c1c" : best.dist < 2 ? "#b45309" : "#5d7a5a";
        return (
          <Group key={`wall-d-${item.id}`}>
            <Line
              points={[best.from.x * ppf, best.from.y * ppf, best.foot.x * ppf, best.foot.y * ppf]}
              stroke={color}
              strokeWidth={1 / zoom}
              dash={[3 / zoom, 3 / zoom]}
              opacity={0.6}
            />
            <Label x={((best.from.x + best.foot.x) / 2) * ppf} y={((best.from.y + best.foot.y) / 2) * ppf}>
              <Tag fill="white" stroke={color} strokeWidth={1 / zoom} cornerRadius={3} />
              <Text text={`wall: ${formatFeet(best.dist)}`} fontSize={9 / zoom} fill={color} padding={2 / zoom} fontStyle="600" />
            </Label>
          </Group>
        );
      })}
    </>
  );
}
