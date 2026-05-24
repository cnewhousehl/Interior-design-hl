"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Grid } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { useDesignStore } from "@/lib/store";
import { defaultHeight, getCatalogItem } from "@/lib/catalog";
import type { CatalogItem, PlacedFurniture, Wall } from "@/lib/types";

/**
 * Lightweight 2.5D walk-around view: walls become extruded boxes, floor is a plane,
 * furniture renders as colored boxes (or shaped meshes for L-sectionals / circles)
 * at their catalog-default heights. Useful for proportion checks; not photorealistic.
 */
export default function Scene3D() {
  const placed = useDesignStore((s) => s.placed);
  const walls = useDesignStore((s) => s.walls);
  const rooms = useDesignStore((s) => s.rooms);
  const ceilingHeightFt = useDesignStore((s) => s.ceilingHeightFt);
  const floorPlan = useDesignStore((s) => s.floorPlan);

  // Compute scene bounds for camera framing
  const bounds = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const w of walls) {
      xs.push(w.a.x, w.b.x);
      ys.push(w.a.y, w.b.y);
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
  }, [walls, placed]);

  if (!floorPlan) {
    return (
      <div className="h-full w-full grid place-items-center text-ink-500 text-sm">
        Upload a floor plan to enable 3D view.
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-ink-100">
      <Canvas
        shadows
        camera={{
          position: [bounds.cx - bounds.span * 0.7, bounds.span * 1.0, bounds.cy + bounds.span * 0.7],
          fov: 45,
        }}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <color attach="background" args={["#f5f1e7"]} />
          <fog attach="fog" args={["#f5f1e7", bounds.span * 1.5, bounds.span * 4]} />
          <ambientLight intensity={0.45} />
          <directionalLight
            position={[bounds.cx + bounds.span, bounds.span * 1.5, bounds.cy - bounds.span]}
            intensity={1.1}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <directionalLight
            position={[bounds.cx - bounds.span, bounds.span, bounds.cy + bounds.span]}
            intensity={0.5}
          />

          {/* Ground / floor */}
          <Floor bounds={bounds} />

          {/* Subtle grid on the floor */}
          <Grid
            args={[bounds.span * 4, bounds.span * 4]}
            cellSize={1}
            cellThickness={0.5}
            cellColor="#d6c9b0"
            sectionSize={5}
            sectionThickness={1}
            sectionColor="#a8a29e"
            fadeDistance={bounds.span * 2.5}
            position={[bounds.cx, 0.005, bounds.cy]}
            infiniteGrid
          />

          {/* Walls */}
          {walls.map((w) => (
            <Wall3D key={w.id} wall={w} height={ceilingHeightFt} />
          ))}

          {/* Room floor tints */}
          {rooms.map((r) => (
            <RoomFloor key={r.id} polygon={r.polygon} />
          ))}

          {/* Furniture */}
          {placed.filter((p) => !p.hidden).map((p) => {
            const cat = getCatalogItem(p.catalogId);
            if (!cat) return null;
            return <Furniture3D key={p.id} item={p} cat={cat} />;
          })}

          <Environment preset="apartment" />
          <OrbitControls
            target={[bounds.cx, 1, bounds.cy]}
            enableDamping
            dampingFactor={0.08}
            maxPolarAngle={Math.PI / 2 - 0.02}
            minDistance={2}
            maxDistance={bounds.span * 4}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

function Floor({ bounds }: { bounds: { cx: number; cy: number; span: number } }) {
  return (
    <mesh receiveShadow position={[bounds.cx, 0, bounds.cy]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[bounds.span * 6, bounds.span * 6]} />
      <meshStandardMaterial color="#e8dec1" roughness={0.85} />
    </mesh>
  );
}

function RoomFloor({ polygon }: { polygon: { x: number; y: number }[] }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    polygon.forEach((p, i) => {
      if (i === 0) s.moveTo(p.x, -p.y);
      else s.lineTo(p.x, -p.y);
    });
    s.closePath();
    return s;
  }, [polygon]);
  return (
    <mesh receiveShadow position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial color="#f3ecd9" roughness={0.9} />
    </mesh>
  );
}

function Wall3D({ wall, height }: { wall: Wall; height: number }) {
  const thickness = wall.thicknessFt ?? 0.4;
  const dx = wall.b.x - wall.a.x;
  const dy = wall.b.y - wall.a.y;
  const len = Math.hypot(dx, dy);
  const cx = (wall.a.x + wall.b.x) / 2;
  const cy = (wall.a.y + wall.b.y) / 2;
  const angle = Math.atan2(dy, dx);
  // In three's coordinate frame we use X = scene X, Z = scene Y (so y is up).
  // Rotation around Y by -angle aligns local X with the wall direction.
  return (
    <mesh position={[cx, height / 2, cy]} rotation={[0, -angle, 0]} castShadow receiveShadow>
      <boxGeometry args={[len, height, thickness]} />
      <meshStandardMaterial color="#fbf7ee" roughness={0.9} />
    </mesh>
  );
}

function Furniture3D({ item, cat }: { item: PlacedFurniture; cat: CatalogItem }) {
  const w = item.widthOverride ?? cat.width;
  const d = item.depthOverride ?? cat.depth;
  const h = item.heightOverride ?? defaultHeight(cat);
  const color = item.colorOverride ?? cat.color;
  const angle = -(item.rotation * Math.PI) / 180;
  const yPos = cat.category === "rugs" ? 0.01 : h / 2;

  if (cat.shape === "circle") {
    return (
      <mesh
        position={[item.x, yPos, item.y]}
        rotation={[0, angle, 0]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[w / 2, w / 2, h, 32]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
    );
  }

  if (cat.shape === "l-shape" && cat.lShape) {
    const nw = cat.lShape.notchWidth;
    const nd = cat.lShape.notchDepth;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, -d / 2);
    shape.lineTo(w / 2 - nw, -d / 2);
    shape.lineTo(w / 2 - nw, -d / 2 + nd);
    shape.lineTo(w / 2, -d / 2 + nd);
    shape.lineTo(w / 2, d / 2);
    shape.lineTo(-w / 2, d / 2);
    shape.closePath();
    return (
      <mesh position={[item.x, 0, item.y]} rotation={[0, angle, 0]} castShadow receiveShadow>
        <extrudeGeometry args={[shape, { depth: h, bevelEnabled: false }]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
    );
  }

  return (
    <mesh position={[item.x, yPos, item.y]} rotation={[0, angle, 0]} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  );
}
