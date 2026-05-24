import * as THREE from "three";

/**
 * Procedural CanvasTextures for the 3D scene. Generated once on demand and
 * cached so we don't redraw the canvas every render.
 */

let woodTex: THREE.CanvasTexture | null = null;
let tileTex: THREE.CanvasTexture | null = null;
let grassTex: THREE.CanvasTexture | null = null;
let deckTex: THREE.CanvasTexture | null = null;
let rugTex: THREE.CanvasTexture | null = null;
let fabricTex: THREE.CanvasTexture | null = null;

const SIZE = 512;

function newCanvas(): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  return { c, ctx: c.getContext("2d")! };
}

function texFrom(c: HTMLCanvasElement, repeat = 4): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}

/** Hardwood planks, warm honey tone with subtle grain. */
export function woodFloorTexture(): THREE.CanvasTexture {
  if (woodTex) return woodTex;
  const { c, ctx } = newCanvas();
  ctx.fillStyle = "#c69a6a";
  ctx.fillRect(0, 0, SIZE, SIZE);
  const plankH = 64;
  for (let row = 0; row < SIZE / plankH; row++) {
    const y = row * plankH;
    const tones = ["#b5895f", "#caa377", "#a37549", "#d4ab7d", "#b08560"];
    let x = (row % 2) * 90;
    while (x < SIZE) {
      const w = 80 + Math.random() * 90;
      ctx.fillStyle = tones[(row + x) % tones.length];
      ctx.fillRect(x, y, w, plankH);
      // Plank edge shadow
      ctx.fillStyle = "rgba(40, 22, 8, 0.35)";
      ctx.fillRect(x + w - 1, y, 1, plankH);
      ctx.fillRect(x, y + plankH - 1, w, 1);
      // Grain noise
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = "#3a2410";
      for (let i = 0; i < 4; i++) {
        const gx = x + Math.random() * w;
        ctx.fillRect(gx, y + 4, 1, plankH - 8);
      }
      ctx.globalAlpha = 1;
      x += w;
    }
  }
  woodTex = texFrom(c, 3);
  return woodTex;
}

/** Square tile floor, off-white grout. */
export function tileFloorTexture(): THREE.CanvasTexture {
  if (tileTex) return tileTex;
  const { c, ctx } = newCanvas();
  ctx.fillStyle = "#a8a29e";
  ctx.fillRect(0, 0, SIZE, SIZE);
  const tile = 64;
  ctx.fillStyle = "#e7e2d6";
  for (let y = 0; y < SIZE; y += tile) {
    for (let x = 0; x < SIZE; x += tile) {
      ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
    }
  }
  // Subtle speckle
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = "#000";
  for (let i = 0; i < 600; i++) {
    ctx.fillRect(Math.random() * SIZE, Math.random() * SIZE, 1, 1);
  }
  ctx.globalAlpha = 1;
  tileTex = texFrom(c, 6);
  return tileTex;
}

/** Grass texture for outdoor / lawn areas. */
export function grassTexture(): THREE.CanvasTexture {
  if (grassTex) return grassTex;
  const { c, ctx } = newCanvas();
  ctx.fillStyle = "#5d7a4a";
  ctx.fillRect(0, 0, SIZE, SIZE);
  const tones = ["#4d6b3a", "#6d8a55", "#3f5a30", "#7a9764"];
  for (let i = 0; i < 6000; i++) {
    ctx.fillStyle = tones[i % tones.length];
    ctx.fillRect(Math.random() * SIZE, Math.random() * SIZE, 1 + Math.random() * 2, 1 + Math.random() * 3);
  }
  grassTex = texFrom(c, 16);
  return grassTex;
}

/** Composite deck planks for terrace/outdoor. */
export function deckTexture(): THREE.CanvasTexture {
  if (deckTex) return deckTex;
  const { c, ctx } = newCanvas();
  ctx.fillStyle = "#a07a55";
  ctx.fillRect(0, 0, SIZE, SIZE);
  const plankH = 48;
  for (let y = 0; y < SIZE; y += plankH) {
    ctx.fillStyle = y % (plankH * 2) === 0 ? "#9a7250" : "#a87f5b";
    ctx.fillRect(0, y, SIZE, plankH);
    ctx.fillStyle = "rgba(60, 30, 10, 0.35)";
    ctx.fillRect(0, y + plankH - 1, SIZE, 1);
    // Light grain stripes
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#5a3d22";
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(0, y + 6 + i * 14, SIZE, 1);
    }
    ctx.globalAlpha = 1;
  }
  deckTex = texFrom(c, 4);
  return deckTex;
}

/** Geometric rug pattern. */
export function rugTexture(): THREE.CanvasTexture {
  if (rugTex) return rugTex;
  const { c, ctx } = newCanvas();
  ctx.fillStyle = "#d6c9b0";
  ctx.fillRect(0, 0, SIZE, SIZE);
  // Border
  ctx.strokeStyle = "#8b6f47";
  ctx.lineWidth = 14;
  ctx.strokeRect(28, 28, SIZE - 56, SIZE - 56);
  ctx.lineWidth = 4;
  ctx.strokeRect(52, 52, SIZE - 104, SIZE - 104);
  // Diamonds
  ctx.fillStyle = "rgba(139, 111, 71, 0.5)";
  const step = 64;
  for (let y = 90; y < SIZE - 90; y += step) {
    for (let x = 90; x < SIZE - 90; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, y - 14);
      ctx.lineTo(x + 14, y);
      ctx.lineTo(x, y + 14);
      ctx.lineTo(x - 14, y);
      ctx.closePath();
      ctx.fill();
    }
  }
  rugTex = texFrom(c, 1);
  return rugTex;
}

/** Subtle woven fabric for upholstery — used as a normal-style accent. */
export function fabricTexture(): THREE.CanvasTexture {
  if (fabricTex) return fabricTex;
  const { c, ctx } = newCanvas();
  ctx.fillStyle = "#888";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.globalAlpha = 0.15;
  for (let y = 0; y < SIZE; y += 3) {
    ctx.fillStyle = y % 6 === 0 ? "#fff" : "#000";
    ctx.fillRect(0, y, SIZE, 1);
  }
  for (let x = 0; x < SIZE; x += 3) {
    ctx.fillStyle = x % 6 === 0 ? "#fff" : "#000";
    ctx.fillRect(x, 0, 1, SIZE);
  }
  ctx.globalAlpha = 1;
  fabricTex = texFrom(c, 8);
  return fabricTex;
}
