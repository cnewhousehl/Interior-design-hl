"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows, Sky, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Camera as CameraIcon, Eye, Sun, Maximize2, Play, Pause } from "lucide-react";
import { useDesignStore } from "@/lib/store";
import { defaultHeight, getCatalogItem } from "@/lib/catalog";
import type { CatalogItem, PlacedFurniture, Wall } from "@/lib/types";
import {
  woodFloorTexture,
  tileFloorTexture,
  grassTexture,
  deckTexture,
  rugTexture,
} from "@/lib/three-textures";

type ViewKind = "orbit" | "top";

/**
 * Photorealistic-leaning top-down 3D preview. Walls extrude to ceiling height,
 * room polygons get a textured floor (wood by default, tile for bathrooms /
 * kitchens, deck for terraces), and each furniture piece is rendered with
 * category-specific detail meshes (bed → frame + mattress + pillows + duvet,
 * sofa → base + back + segmented cushions, etc.) rather than a single box.
 */
export default function Scene3D() {
  const placed = useDesignStore((s) => s.placed);
  const walls = useDesignStore((s) => s.walls);
  const rooms = useDesignStore((s) => s.rooms);
  const ceilingHeightFt = useDesignStore((s) => s.ceilingHeightFt);
  const floorPlan = useDesignStore((s) => s.floorPlan);

  const [view, setView] = useState<ViewKind>("orbit");
  const [timeOfDay, setTimeOfDay] = useState(0.5); // 0 = sunrise, 0.5 = noon, 1 = sunset, >1 = night
  const [preset, setPreset] = useState<"day" | "golden" | "sunset" | "night" | "overcast">("day");
  const [zoom, setZoom] = useState(1);
  const [walkthroughOn, setWalkthroughOn] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const trafficPaths = useDesignStore((s) => s.trafficPaths);
  const showAllFloors3D = useDesignStore((s) => s.showAllFloors3D);
  const floors = useDesignStore((s) => s.floors);
  const currentFloorId = useDesignStore((s) => s.currentFloorId);
  const currentElevation = floors.find((f) => f.id === currentFloorId)?.elevationFt ?? 0;
  const allFloors = floors.filter((f) => f.id !== currentFloorId);

  // Map preset → time-of-day + atmosphere
  useEffect(() => {
    if (preset === "day") setTimeOfDay(0.5);
    else if (preset === "golden") setTimeOfDay(0.15);
    else if (preset === "sunset") setTimeOfDay(0.92);
    else if (preset === "night") setTimeOfDay(1.3);
    else if (preset === "overcast") setTimeOfDay(0.5);
  }, [preset]);

  const atmosphere = useMemo(() => atmosphereFor(timeOfDay, preset === "overcast"), [timeOfDay, preset]);

  const bounds = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const w of walls) {
      xs.push(w.a.x, w.b.x);
      ys.push(w.a.y, w.b.y);
    }
    for (const r of rooms) {
      for (const p of r.polygon) {
        xs.push(p.x);
        ys.push(p.y);
      }
    }
    for (const p of placed) {
      xs.push(p.x);
      ys.push(p.y);
    }
    if (!xs.length) return { cx: 0, cy: 0, span: 30 };
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      span: Math.max(maxX - minX, maxY - minY, 10),
    };
  }, [walls, placed, rooms]);

  const snapshot = () => {
    const el = canvasRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!el) return;
    const link = document.createElement("a");
    link.download = `render-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = el.toDataURL("image/png");
    link.click();
  };

  if (!floorPlan) {
    return (
      <div className="h-full w-full grid place-items-center text-ink-500 text-sm">
        Upload a floor plan to enable 3D view.
      </div>
    );
  }

  return (
    <div ref={canvasRef} className="h-full w-full relative bg-ink-100">
      <Canvas shadows gl={{ antialias: true, preserveDrawingBuffer: true }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <color attach="background" args={[atmosphere.skyColor]} />
          <fog attach="fog" args={[atmosphere.fogColor, bounds.span * 2, bounds.span * 6]} />

          {view === "orbit" ? (
            <PerspectiveCamera
              makeDefault
              position={[bounds.cx - bounds.span * 0.7, bounds.span * 1.0, bounds.cy + bounds.span * 0.7]}
              fov={45}
            />
          ) : (
            <OrthographicCamera
              makeDefault
              position={[bounds.cx, bounds.span * 2, bounds.cy]}
              zoom={(40 / bounds.span) * zoom * 10}
              near={0.1}
              far={bounds.span * 8}
            />
          )}

          {/* Lighting — driven by time-of-day */}
          <ambientLight intensity={atmosphere.ambient} color={atmosphere.ambientColor} />
          <directionalLight
            position={[
              bounds.cx + atmosphere.sunDir.x * bounds.span,
              atmosphere.sunDir.y * bounds.span,
              bounds.cy + atmosphere.sunDir.z * bounds.span,
            ]}
            intensity={atmosphere.sunIntensity}
            color={atmosphere.sunColor}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-left={-bounds.span * 1.5}
            shadow-camera-right={bounds.span * 1.5}
            shadow-camera-top={bounds.span * 1.5}
            shadow-camera-bottom={-bounds.span * 1.5}
            shadow-camera-near={0.1}
            shadow-camera-far={bounds.span * 5}
            shadow-bias={-0.001}
          />
          <directionalLight
            position={[bounds.cx - bounds.span, bounds.span, bounds.cy + bounds.span]}
            intensity={atmosphere.fillIntensity}
            color={atmosphere.fillColor}
          />

          {atmosphere.showSky && (
            <Sky
              distance={450000}
              sunPosition={[
                bounds.cx + atmosphere.sunDir.x * bounds.span * 1.5,
                atmosphere.sunDir.y * bounds.span * 1.5,
                bounds.cy + atmosphere.sunDir.z * bounds.span * 1.5,
              ]}
              inclination={atmosphere.skyInclination}
              azimuth={0.25}
              turbidity={atmosphere.turbidity}
              rayleigh={atmosphere.rayleigh}
            />
          )}
          <Environment preset={atmosphere.envPreset} />

          {/* Walkthrough animated dot */}
          {walkthroughOn && trafficPaths.length > 0 && (
            <WalkthroughDot paths={trafficPaths} />
          )}

          {/* Ground (grass) extending beyond building */}
          <mesh receiveShadow position={[bounds.cx, -0.01, bounds.cy]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[bounds.span * 8, bounds.span * 8]} />
            <meshStandardMaterial map={grassTexture()} roughness={1} />
          </mesh>

          {/* Default building floor (hardwood) — covers everything inside walls' bounding box */}
          <BuildingFloor bounds={bounds} placedRoomIds={rooms.map((r) => r.id)} />

          {/* Current floor */}
          <FloorScene
            rooms={rooms}
            walls={walls}
            placed={placed}
            ceilingHeightFt={ceilingHeightFt}
            yOffset={0}
            opacity={1}
          />

          {/* Other floors stacked when enabled */}
          {showAllFloors3D && allFloors.map((f) => (
            <FloorScene
              key={f.id}
              rooms={f.rooms}
              walls={f.walls}
              placed={f.placed}
              ceilingHeightFt={f.ceilingHeightFt}
              yOffset={f.elevationFt - currentElevation}
              opacity={f.id === currentFloorId ? 1 : 0.6}
            />
          ))}

          {/* Soft grounded shadow under everything */}
          <ContactShadows
            position={[bounds.cx, 0.02, bounds.cy]}
            opacity={0.35}
            scale={bounds.span * 4}
            blur={2}
            far={6}
            resolution={1024}
            color="#1a1500"
          />

          {view === "orbit" && (
            <OrbitControls
              target={[bounds.cx, 1.5, bounds.cy]}
              enableDamping
              dampingFactor={0.08}
              maxPolarAngle={Math.PI / 2 - 0.05}
              minDistance={3}
              maxDistance={bounds.span * 5}
            />
          )}
        </Suspense>
      </Canvas>

      {/* View overlay controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        <div className="seg bg-paper-50/95 backdrop-blur shadow-float">
          {(["orbit", "top"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`seg-btn flex items-center gap-1 ${view === v ? "seg-btn-active" : ""}`}
              title={v === "orbit" ? "Orbit camera" : "Top-down render"}
            >
              {v === "orbit" ? <Eye className="w-3 h-3" /> : <CameraIcon className="w-3 h-3" />}
              {v === "orbit" ? "Orbit" : "Top"}
            </button>
          ))}
        </div>
        <div className="card p-2 shadow-float">
          <div className="label mb-1 flex items-center gap-1"><Sun className="w-3 h-3" /> Time of day</div>
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.01}
            value={timeOfDay}
            onChange={(e) => setTimeOfDay(parseFloat(e.target.value))}
            className="accent-accent-500 w-28 block"
          />
          <div className="text-[10px] font-mono text-ink-500 mt-0.5 text-center">{labelForTime(timeOfDay)}</div>
          <div className="flex gap-1 mt-1.5">
            {(["day", "golden", "sunset", "night", "overcast"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`flex-1 text-[9px] uppercase tracking-wider py-0.5 rounded border ${
                  preset === p ? "bg-ink-900 text-paper-50 border-ink-900" : "border-ink-200 hover:bg-ink-100"
                }`}
                title={p}
              >
                {p[0]}
              </button>
            ))}
          </div>
        </div>
        {view === "top" && (
          <div className="card p-2 shadow-float">
            <div className="label mb-1">Zoom</div>
            <input
              type="range"
              min={0.4}
              max={2.5}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="accent-accent-500 w-24"
            />
          </div>
        )}
        {trafficPaths.length > 0 && (
          <button
            onClick={() => setWalkthroughOn((x) => !x)}
            className={`btn-md shadow-float ${walkthroughOn ? "btn-primary" : "btn-outline"}`}
            title="Animate a dot walking the traffic paths"
          >
            {walkthroughOn ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{walkthroughOn ? "Stop" : "Walk"}</span>
          </button>
        )}
        <button
          onClick={snapshot}
          className="btn-outline btn-md shadow-float"
          title="Save render as PNG"
        >
          <CameraIcon className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Render</span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Floors
// ---------------------------------------------------------------------------

function FloorScene({
  rooms,
  walls,
  placed,
  ceilingHeightFt,
  yOffset,
  opacity,
}: {
  rooms: { id: string; name: string; polygon: { x: number; y: number }[]; color?: string }[];
  walls: Wall[];
  placed: PlacedFurniture[];
  ceilingHeightFt: number;
  yOffset: number;
  opacity: number;
}) {
  return (
    <group position={[0, yOffset, 0]}>
      {rooms.map((r) => (
        <RoomFloor key={r.id} room={r} />
      ))}
      {walls.map((w) => (
        <Wall3D key={w.id} wall={w} height={ceilingHeightFt} opacity={opacity} />
      ))}
      {placed.filter((p) => !p.hidden).map((p) => {
        const cat = getCatalogItem(p.catalogId);
        if (!cat) return null;
        return <Furniture3D key={p.id} item={p} cat={cat} />;
      })}
    </group>
  );
}

function BuildingFloor({ bounds, placedRoomIds }: { bounds: { cx: number; cy: number; span: number }; placedRoomIds: string[] }) {
  // Hardwood floor matching the building extent. Per-room floors render on top
  // for kitchens / bathrooms / terraces and physically shadow this layer.
  void placedRoomIds;
  return (
    <mesh receiveShadow position={[bounds.cx, 0.005, bounds.cy]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[bounds.span * 1.4, bounds.span * 1.4]} />
      <meshStandardMaterial map={woodFloorTexture()} roughness={0.85} />
    </mesh>
  );
}

function RoomFloor({ room }: { room: { id: string; name: string; polygon: { x: number; y: number }[] } }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    room.polygon.forEach((p, i) => {
      if (i === 0) s.moveTo(p.x, -p.y);
      else s.lineTo(p.x, -p.y);
    });
    s.closePath();
    return s;
  }, [room.polygon]);

  // Choose material by room name
  const name = room.name.toLowerCase();
  let map: THREE.Texture = woodFloorTexture();
  let color = "#ffffff";
  let roughness = 0.85;
  let yOffset = 0.012;
  if (name.includes("bath") || name.includes("laundry") || name.includes("kitchen")) {
    map = tileFloorTexture();
    color = "#f7f3ec";
  } else if (name.includes("terrace") || name.includes("deck") || name.includes("balcony") || name.includes("porch")) {
    map = deckTexture();
    color = "#ffffff";
    yOffset = 0.04;
  } else if (name.includes("closet") || name.includes("stor")) {
    color = "#f3ecd9";
    roughness = 0.9;
  }

  return (
    <mesh receiveShadow position={[0, yOffset, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial map={map} color={color} roughness={roughness} />
    </mesh>
  );
}

function Wall3D({ wall, height, opacity = 1 }: { wall: Wall; height: number; opacity?: number }) {
  const thickness = wall.thicknessFt ?? 0.4;
  const dx = wall.b.x - wall.a.x;
  const dy = wall.b.y - wall.a.y;
  const len = Math.hypot(dx, dy);
  const cx = (wall.a.x + wall.b.x) / 2;
  const cy = (wall.a.y + wall.b.y) / 2;
  const angle = Math.atan2(dy, dx);
  return (
    <mesh position={[cx, height / 2, cy]} rotation={[0, -angle, 0]} castShadow receiveShadow>
      <boxGeometry args={[len + thickness, height, thickness]} />
      <meshStandardMaterial color="#f7f0e1" roughness={0.95} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Furniture (category-aware)
// ---------------------------------------------------------------------------

function Furniture3D({ item, cat }: { item: PlacedFurniture; cat: CatalogItem }) {
  const w = item.widthOverride ?? cat.width;
  const d = item.depthOverride ?? cat.depth;
  const h = item.heightOverride ?? cat.height ?? defaultHeight(cat);
  const color = item.colorOverride ?? cat.color;
  const angle = -(item.rotation * Math.PI) / 180;

  return (
    <group position={[item.x, 0, item.y]} rotation={[0, angle, 0]}>
      {renderCategory({ cat, w, d, h, color })}
    </group>
  );
}

function renderCategory({ cat, w, d, h, color }: { cat: CatalogItem; w: number; d: number; h: number; color: string }) {
  switch (cat.category) {
    case "beds":
      return <BedMesh w={w} d={d} h={h} color={color} />;
    case "seating":
      if (cat.shape === "l-shape" && cat.lShape) return <LSofaMesh w={w} d={d} h={h} color={color} l={cat.lShape} />;
      if (cat.id.includes("chair") || cat.id.includes("stool")) return <ChairMesh w={w} d={d} h={h} color={color} />;
      return <SofaMesh w={w} d={d} h={h} color={color} />;
    case "tables":
      if (cat.id.includes("dining")) return <DiningTableMesh w={w} d={d} h={h} shape={cat.shape} />;
      if (cat.id.includes("coffee")) return <CoffeeTableMesh w={w} d={d} h={h} shape={cat.shape} />;
      if (cat.id.includes("desk")) return <DeskMesh w={w} d={d} h={h} />;
      return <SideTableMesh w={w} d={d} h={h} shape={cat.shape} />;
    case "storage":
      if (cat.id.includes("tv-stand")) return <TVStandMesh w={w} d={d} h={h} />;
      if (cat.id.includes("bookshelf")) return <BookshelfMesh w={w} d={d} h={h} />;
      return <DresserMesh w={w} d={d} h={h} color={color} />;
    case "rugs":
      return <RugMesh w={w} d={d} color={color} shape={cat.shape} />;
    case "lighting":
      return <FloorLampMesh h={h} />;
    case "misc":
      if (cat.id.includes("plant")) return <PlantMesh w={w} h={h} />;
      return <OttomanMesh w={w} d={d} h={h} color={color} />;
  }
}

// ----- bedroom -----

function BedMesh({ w, d, h, color }: { w: number; d: number; h: number; color: string }) {
  return (
    <group>
      {/* Frame */}
      <mesh position={[0, h * 0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h * 0.36, d]} />
        <meshStandardMaterial color="#3d2e22" roughness={0.7} />
      </mesh>
      {/* Headboard */}
      <mesh position={[0, h * 0.55, -d / 2 + 0.15]} castShadow>
        <boxGeometry args={[w, h * 0.7, 0.3]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      {/* Mattress */}
      <mesh position={[0, h * 0.45, 0.05]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.96, h * 0.18, d * 0.95]} />
        <meshStandardMaterial color="#ece5d3" roughness={0.85} />
      </mesh>
      {/* Duvet folded back */}
      <mesh position={[0, h * 0.55, d * 0.18]} castShadow>
        <boxGeometry args={[w * 0.96, h * 0.05, d * 0.55]} />
        <meshStandardMaterial color="#7a6147" roughness={0.85} />
      </mesh>
      {/* Pillows */}
      <mesh position={[-w * 0.22, h * 0.6, -d * 0.32]} castShadow>
        <boxGeometry args={[w * 0.36, h * 0.08, d * 0.22]} />
        <meshStandardMaterial color="#fafaf7" roughness={0.9} />
      </mesh>
      <mesh position={[w * 0.22, h * 0.6, -d * 0.32]} castShadow>
        <boxGeometry args={[w * 0.36, h * 0.08, d * 0.22]} />
        <meshStandardMaterial color="#fafaf7" roughness={0.9} />
      </mesh>
    </group>
  );
}

// ----- seating -----

function SofaMesh({ w, d, h, color }: { w: number; d: number; h: number; color: string }) {
  // base + arms + back + segmented seat & back cushions
  return (
    <group>
      {/* Base */}
      <mesh position={[0, h * 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h * 0.4, d]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {/* Back */}
      <mesh position={[0, h * 0.6, -d * 0.4]} castShadow>
        <boxGeometry args={[w, h * 0.6, d * 0.2]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {/* Arms */}
      <mesh position={[-w / 2 + 0.18, h * 0.5, 0]} castShadow>
        <boxGeometry args={[0.35, h * 0.5, d]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      <mesh position={[w / 2 - 0.18, h * 0.5, 0]} castShadow>
        <boxGeometry args={[0.35, h * 0.5, d]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {/* Seat cushions (3) */}
      {[-1, 0, 1].map((i) => (
        <mesh key={`s${i}`} position={[(w / 3.4) * i, h * 0.46, d * 0.05]} castShadow>
          <boxGeometry args={[w / 3.6, h * 0.18, d * 0.65]} />
          <meshStandardMaterial color={lighten(color, 0.08)} roughness={0.9} />
        </mesh>
      ))}
      {/* Back cushions (3) */}
      {[-1, 0, 1].map((i) => (
        <mesh key={`b${i}`} position={[(w / 3.4) * i, h * 0.72, -d * 0.28]} castShadow>
          <boxGeometry args={[w / 3.6, h * 0.42, d * 0.18]} />
          <meshStandardMaterial color={lighten(color, 0.05)} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function LSofaMesh({ w, d, h, color, l }: { w: number; d: number; h: number; color: string; l: { notchWidth: number; notchDepth: number } }) {
  const shape = useMemo(() => {
    const nw = l.notchWidth;
    const nd = l.notchDepth;
    const s = new THREE.Shape();
    s.moveTo(-w / 2, -d / 2);
    s.lineTo(w / 2 - nw, -d / 2);
    s.lineTo(w / 2 - nw, -d / 2 + nd);
    s.lineTo(w / 2, -d / 2 + nd);
    s.lineTo(w / 2, d / 2);
    s.lineTo(-w / 2, d / 2);
    s.closePath();
    return s;
  }, [w, d, l.notchWidth, l.notchDepth]);
  return (
    <group>
      {/* Base */}
      <mesh castShadow receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, h * 0.25, 0]}>
        <extrudeGeometry args={[shape, { depth: h * 0.5, bevelEnabled: false }]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {/* Cushion strip running along the long edge */}
      <mesh castShadow position={[0, h * 0.55, d * 0.1]}>
        <boxGeometry args={[w * 0.9, h * 0.2, d * 0.55]} />
        <meshStandardMaterial color={lighten(color, 0.08)} roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, h * 0.78, -d * 0.32]}>
        <boxGeometry args={[w * 0.9, h * 0.35, d * 0.18]} />
        <meshStandardMaterial color={lighten(color, 0.05)} roughness={0.9} />
      </mesh>
    </group>
  );
}

function ChairMesh({ w, d, h, color }: { w: number; d: number; h: number; color: string }) {
  return (
    <group>
      {/* Seat */}
      <mesh position={[0, h * 0.45, 0]} castShadow>
        <boxGeometry args={[w * 0.9, h * 0.08, d * 0.9]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {/* Back */}
      <mesh position={[0, h * 0.75, -d * 0.4]} castShadow>
        <boxGeometry args={[w * 0.9, h * 0.5, 0.12]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {/* Legs */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * w * 0.4, h * 0.22, sz * d * 0.4]} castShadow>
          <boxGeometry args={[0.08, h * 0.44, 0.08]} />
          <meshStandardMaterial color="#3a2e22" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

// ----- tables -----

function DiningTableMesh({ w, d, h, shape }: { w: number; d: number; h: number; shape: string }) {
  return (
    <group>
      {shape === "circle" ? (
        <mesh position={[0, h * 0.92, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[w / 2, w / 2, h * 0.1, 48]} />
          <meshStandardMaterial color="#6b4a30" roughness={0.6} />
        </mesh>
      ) : (
        <mesh position={[0, h * 0.92, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, h * 0.1, d]} />
          <meshStandardMaterial color="#6b4a30" roughness={0.6} />
        </mesh>
      )}
      {/* Centerpiece */}
      <mesh position={[0, h * 1.03, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.4, 0.4, 16]} />
        <meshStandardMaterial color="#5d7a4a" roughness={0.8} />
      </mesh>
      {/* Legs (rect) or pedestal (round) */}
      {shape === "circle" ? (
        <mesh position={[0, h * 0.45, 0]} castShadow>
          <cylinderGeometry args={[0.35, 0.5, h * 0.9, 16]} />
          <meshStandardMaterial color="#5a4030" roughness={0.7} />
        </mesh>
      ) : (
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
          <mesh key={i} position={[sx * (w / 2 - 0.2), h * 0.45, sz * (d / 2 - 0.2)]} castShadow>
            <boxGeometry args={[0.12, h * 0.9, 0.12]} />
            <meshStandardMaterial color="#5a4030" roughness={0.7} />
          </mesh>
        ))
      )}
    </group>
  );
}

function CoffeeTableMesh({ w, d, h, shape }: { w: number; d: number; h: number; shape: string }) {
  return (
    <group>
      {shape === "circle" ? (
        <mesh position={[0, h * 0.85, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[w / 2, w / 2, h * 0.15, 36]} />
          <meshStandardMaterial color="#5a4030" roughness={0.5} />
        </mesh>
      ) : (
        <mesh position={[0, h * 0.85, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, h * 0.15, d]} />
          <meshStandardMaterial color="#5a4030" roughness={0.5} />
        </mesh>
      )}
      <mesh position={[0, h * 0.4, 0]} castShadow>
        <boxGeometry args={[w * 0.7, h * 0.7, d * 0.7]} />
        <meshStandardMaterial color="#4d3a2a" roughness={0.7} />
      </mesh>
      {/* Book / object on top */}
      <mesh position={[w * 0.2, h * 0.97, d * 0.1]} castShadow>
        <boxGeometry args={[w * 0.18, 0.08, d * 0.25]} />
        <meshStandardMaterial color="#a16207" roughness={0.7} />
      </mesh>
    </group>
  );
}

function DeskMesh({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      <mesh position={[0, h * 0.96, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.12, d]} />
        <meshStandardMaterial color="#4d3a2a" roughness={0.55} />
      </mesh>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * (w / 2 - 0.1), h * 0.48, sz * (d / 2 - 0.1)]} castShadow>
          <boxGeometry args={[0.1, h * 0.95, 0.1]} />
          <meshStandardMaterial color="#1c1917" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      {/* Monitor */}
      <mesh position={[0, h * 1.4, -d * 0.3]} castShadow>
        <boxGeometry args={[w * 0.5, 0.7, 0.08]} />
        <meshStandardMaterial color="#1c1917" roughness={0.4} />
      </mesh>
    </group>
  );
}

function SideTableMesh({ w, d, h, shape }: { w: number; d: number; h: number; shape: string }) {
  return (
    <group>
      {shape === "circle" ? (
        <mesh position={[0, h * 0.95, 0]} castShadow>
          <cylinderGeometry args={[w / 2, w / 2, h * 0.1, 24]} />
          <meshStandardMaterial color="#604535" roughness={0.6} />
        </mesh>
      ) : (
        <mesh position={[0, h * 0.95, 0]} castShadow>
          <boxGeometry args={[w, h * 0.1, d]} />
          <meshStandardMaterial color="#604535" roughness={0.6} />
        </mesh>
      )}
      <mesh position={[0, h * 0.47, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, h * 0.9, 12]} />
        <meshStandardMaterial color="#1c1917" metalness={0.4} roughness={0.5} />
      </mesh>
    </group>
  );
}

// ----- storage -----

function TVStandMesh({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      <mesh position={[0, h * 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#1c1917" roughness={0.45} metalness={0.2} />
      </mesh>
      {/* Visual hint of shelves */}
      <mesh position={[0, h * 0.55, d * 0.51]}>
        <boxGeometry args={[w * 0.95, 0.04, 0.02]} />
        <meshStandardMaterial color="#3a3633" />
      </mesh>
      {/* TV behind */}
      <mesh position={[0, h * 1.7, -d * 0.45]} castShadow>
        <boxGeometry args={[w * 0.85, h * 1.4, 0.1]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.3} metalness={0.5} />
      </mesh>
    </group>
  );
}

function BookshelfMesh({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#3d2e22" roughness={0.75} />
      </mesh>
      {/* Books strewn across shelves */}
      {Array.from({ length: 5 }).map((_, row) => (
        Array.from({ length: 6 }).map((_, col) => (
          <mesh
            key={`${row}-${col}`}
            position={[
              -w / 2 + 0.1 + (col + 0.5) * (w / 6) - 0.06,
              0.4 + row * (h / 5.5) + 0.18,
              -d * 0.1,
            ]}
            castShadow
          >
            <boxGeometry args={[w / 8, h / 7, d * 0.6]} />
            <meshStandardMaterial color={`hsl(${(row * 60 + col * 33) % 360}, 35%, 40%)`} roughness={0.8} />
          </mesh>
        ))
      ))}
    </group>
  );
}

function DresserMesh({ w, d, h, color }: { w: number; d: number; h: number; color: string }) {
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      {/* Drawer pulls */}
      {Array.from({ length: 3 }).map((_, row) => (
        Array.from({ length: 2 }).map((_, col) => (
          <mesh
            key={`${row}-${col}`}
            position={[(col - 0.5) * w * 0.5, h - 0.3 - row * (h / 3), d / 2 + 0.05]}
          >
            <boxGeometry args={[0.18, 0.05, 0.1]} />
            <meshStandardMaterial color="#caa168" roughness={0.4} metalness={0.7} />
          </mesh>
        ))
      ))}
    </group>
  );
}

// ----- accent / misc -----

function RugMesh({ w, d, color, shape }: { w: number; d: number; color: string; shape: string }) {
  return shape === "circle" ? (
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[w / 2, 36]} />
      <meshStandardMaterial map={rugTexture()} color={color} roughness={0.95} />
    </mesh>
  ) : (
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial map={rugTexture()} color={color} roughness={0.95} />
    </mesh>
  );
}

function FloorLampMesh({ h }: { h: number }) {
  return (
    <group>
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 0.1, 24]} />
        <meshStandardMaterial color="#1c1917" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, h * 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, h, 12]} />
        <meshStandardMaterial color="#1c1917" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, h - 0.3, 0]} castShadow>
        <coneGeometry args={[0.5, 0.6, 24, 1, true]} />
        <meshStandardMaterial color="#ece5d3" roughness={0.5} emissive="#fff5e1" emissiveIntensity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <pointLight position={[0, h - 0.4, 0]} intensity={0.6} distance={6} color="#fff5e1" />
    </group>
  );
}

function PlantMesh({ w, h }: { w: number; h: number }) {
  return (
    <group>
      <mesh position={[0, w * 0.3, 0]} castShadow>
        <cylinderGeometry args={[w * 0.45, w * 0.35, w * 0.6, 16]} />
        <meshStandardMaterial color="#5a4030" roughness={0.85} />
      </mesh>
      {/* Foliage as a cluster of small spheres */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const r = w * 0.3 + (i % 3) * 0.1;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * r, w * 0.6 + (i % 4) * h * 0.18, Math.sin(a) * r]}
            castShadow
          >
            <sphereGeometry args={[w * 0.25, 8, 8]} />
            <meshStandardMaterial color="#3a5a3a" roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
}

function OttomanMesh({ w, d, h, color }: { w: number; d: number; h: number; color: string }) {
  return (
    <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/**
 * Map time-of-day [0..1.5] (0 = sunrise, 0.5 = noon, 1 = sunset, 1.5 = deep night)
 * to a coherent set of lighting parameters: sun position, color, intensity, sky.
 */
type Atmosphere = {
  skyColor: string;
  fogColor: string;
  ambient: number;
  ambientColor: string;
  sunDir: { x: number; y: number; z: number };
  sunIntensity: number;
  sunColor: string;
  fillIntensity: number;
  fillColor: string;
  showSky: boolean;
  skyInclination: number;
  turbidity: number;
  rayleigh: number;
  envPreset: "apartment" | "city" | "dawn" | "sunset" | "night" | "park";
};

function atmosphereFor(t: number, overcast = false): Atmosphere {
  // Clamp
  const u = Math.max(0, Math.min(1.5, t));
  // Sun position arcs: at u=0 sun is low east (+X), u=0.5 high overhead, u=1 low west (-X)
  const phase = u <= 1 ? u * Math.PI : Math.PI; // 0..π
  const altitude = u <= 1 ? Math.sin(phase) : -0.4; // height above horizon (-1..1)
  const sunX = u <= 1 ? Math.cos(phase) : -0.6;
  const sunZ = -0.4;
  const sunY = Math.max(0.05, altitude * 1.5);

  const night = u >= 1.1;
  const goldenHour = (u < 0.18 || (u > 0.82 && u < 1)) && !night;
  const sunset = u > 0.85 && u <= 1;

  let skyColor = "#bcd9e8";
  let fogColor = "#bcd9e8";
  let sunColor = "#fff5e1";
  let sunIntensity = 1.4;
  let ambient = 0.5;
  let ambientColor = "#ffffff";
  let fillIntensity = 0.3;
  let fillColor = "#cfd9eb";
  let envPreset: Atmosphere["envPreset"] = "apartment";
  let skyInclination = 0.6;
  let turbidity = 8;
  let rayleigh = 1.5;

  if (overcast) {
    skyColor = "#c8ccd2";
    fogColor = "#d6dade";
    sunColor = "#dadfe5";
    sunIntensity = 0.6;
    ambient = 0.65;
    fillIntensity = 0.4;
    envPreset = "park";
    turbidity = 14;
    rayleigh = 3;
  } else if (night) {
    skyColor = "#0c1224";
    fogColor = "#0c1224";
    sunColor = "#a8b5d6";
    sunIntensity = 0.25;
    ambient = 0.28;
    ambientColor = "#9bb1d6";
    fillIntensity = 0.5;
    fillColor = "#6b88c2";
    envPreset = "night";
    turbidity = 1;
    rayleigh = 0.5;
  } else if (sunset) {
    skyColor = "#f5a86d";
    fogColor = "#e29a6b";
    sunColor = "#ff8b3c";
    sunIntensity = 1.3;
    ambient = 0.42;
    fillColor = "#a98ec2";
    envPreset = "sunset";
    turbidity = 16;
    rayleigh = 4;
  } else if (goldenHour) {
    skyColor = "#ffd8a8";
    fogColor = "#f5c898";
    sunColor = "#ffb56e";
    sunIntensity = 1.5;
    ambient = 0.5;
    envPreset = "dawn";
    turbidity = 12;
    rayleigh = 3;
  }

  skyInclination = Math.max(0.05, 0.5 - altitude * 0.45);

  return {
    skyColor,
    fogColor,
    ambient,
    ambientColor,
    sunDir: { x: sunX, y: sunY, z: sunZ },
    sunIntensity,
    sunColor,
    fillIntensity,
    fillColor,
    showSky: !night,
    skyInclination,
    turbidity,
    rayleigh,
    envPreset,
  };
}

function labelForTime(t: number): string {
  if (t >= 1.1) return "night";
  if (t > 0.85) return "sunset";
  if (t > 0.65) return "afternoon";
  if (t >= 0.4 && t <= 0.6) return "noon";
  if (t > 0.18) return "morning";
  return "sunrise";
}

/** Walks a small dot at human speed (~3 ft/s) along the first traffic path, loops. */
function WalkthroughDot({ paths }: { paths: { points: { x: number; y: number }[] }[] }) {
  const ref = useRef<THREE.Mesh>(null);
  // Concatenate all path points into one polyline for now
  const segments = useMemo(() => {
    const all = paths.flatMap((p) => p.points);
    const segs: { a: { x: number; y: number }; b: { x: number; y: number }; len: number }[] = [];
    for (let i = 0; i < all.length - 1; i++) {
      const a = all[i];
      const b = all[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len > 0) segs.push({ a, b, len });
    }
    return segs;
  }, [paths]);
  const totalLen = useMemo(() => segments.reduce((s, x) => s + x.len, 0), [segments]);

  useFrame((_, delta) => {
    if (!ref.current || !totalLen) return;
    ref.current.userData.t = ((ref.current.userData.t ?? 0) + delta * 3) % totalLen; // 3 ft / sec
    let acc = 0;
    const t = ref.current.userData.t as number;
    for (const seg of segments) {
      if (acc + seg.len >= t) {
        const u = (t - acc) / seg.len;
        const x = seg.a.x + (seg.b.x - seg.a.x) * u;
        const y = seg.a.y + (seg.b.y - seg.a.y) * u;
        ref.current.position.set(x, 1.2, y);
        return;
      }
      acc += seg.len;
    }
  });

  return (
    <mesh ref={ref} castShadow>
      <cylinderGeometry args={[0.6, 0.6, 2.5, 12]} />
      <meshStandardMaterial color="#b45309" emissive="#c2410c" emissiveIntensity={0.4} roughness={0.4} />
    </mesh>
  );
}

function lighten(hex: string, amt: number): string {
  // Lighten a hex color by `amt` (0-1). Keeps it simple, no color libs.
  const m = hex.replace("#", "").match(/.{1,2}/g);
  if (!m) return hex;
  const [r, g, b] = m.map((x) => parseInt(x, 16));
  const blend = (c: number) => Math.min(255, Math.round(c + (255 - c) * amt));
  return `#${[blend(r), blend(g), blend(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

// Avoid unused import warning when useThree is reserved for future overlays
void useThree;
