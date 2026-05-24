/**
 * Extract a dominant-color palette from an uploaded image entirely in-browser
 * via a small canvas + k-means-like quantization. No network round-trip, no
 * external dependency. Useful for seeding a custom theme from a mood photo.
 */
export async function extractPalette(imageDataUrl: string, k = 5): Promise<{ hex: string; weight: number }[]> {
  const img = await loadImage(imageDataUrl);
  const target = 96; // downsample for speed
  const scale = Math.min(target / img.width, target / img.height, 1);
  const w = Math.max(1, Math.floor(img.width * scale));
  const h = Math.max(1, Math.floor(img.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  // Collect pixels, drop near-white and near-black + very low saturation
  const pixels: [number, number, number][] = [];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 200) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max < 25 || min > 235) continue; // pure black / white
    pixels.push([r, g, b]);
  }
  if (pixels.length === 0) return [];

  // Seed centroids by spaced sampling
  const centroids: [number, number, number][] = [];
  for (let i = 0; i < k; i++) {
    centroids.push(pixels[Math.floor((i + 0.5) * pixels.length / k)]);
  }
  const assignments = new Array(pixels.length).fill(0);

  // k-means, 8 iterations
  for (let iter = 0; iter < 8; iter++) {
    for (let i = 0; i < pixels.length; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const dr = pixels[i][0] - centroids[c][0];
        const dg = pixels[i][1] - centroids[c][1];
        const db = pixels[i][2] - centroids[c][2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      assignments[i] = best;
    }
    const sums = centroids.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < pixels.length; i++) {
      const a = assignments[i];
      sums[a][0] += pixels[i][0];
      sums[a][1] += pixels[i][1];
      sums[a][2] += pixels[i][2];
      sums[a][3]++;
    }
    for (let c = 0; c < centroids.length; c++) {
      if (sums[c][3] > 0) {
        centroids[c] = [
          Math.round(sums[c][0] / sums[c][3]),
          Math.round(sums[c][1] / sums[c][3]),
          Math.round(sums[c][2] / sums[c][3]),
        ];
      }
    }
  }

  const counts = centroids.map(() => 0);
  for (const a of assignments) counts[a]++;
  return centroids
    .map((c, i) => ({ hex: rgbToHex(c[0], c[1], c[2]), weight: counts[i] }))
    .filter((c) => c.weight > 0)
    .sort((a, b) => b.weight - a.weight);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}
