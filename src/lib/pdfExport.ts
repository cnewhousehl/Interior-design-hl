import jsPDF from "jspdf";
import { useDesignStore } from "./store";
import { getCatalogItem, defaultPrice } from "./catalog";
import { buildShoppingList } from "./shoppingList";
import { formatFeet } from "./format";
import { polygonAreaSqft } from "./validation";

/**
 * Export the current scene as a designer-style 3-page PDF:
 *  Page 1 — Floor plan: title block + the live canvas snapshot at scale
 *  Page 2 — Inventory: every placed piece with dims, status, price
 *  Page 3 — Summary: rooms + totals + footprint summary
 */
export async function exportPdf(opts: { projectName?: string } = {}) {
  const s = useDesignStore.getState();
  if (!s.floorPlan) {
    alert("Upload a floor plan first.");
    return;
  }

  const stage = (window as unknown as { __designStage?: { toDataURL: (o: { pixelRatio: number }) => string } }).__designStage;
  if (!stage) {
    alert("Canvas not ready — switch to 2D view first.");
    return;
  }

  const projectName = opts.projectName ?? "Interior Design Plan";
  const today = new Date().toLocaleDateString();
  const ppf = s.floorPlan.pixelsPerFoot ?? 1;

  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const margin = 36;

  // ---------- Page 1: Floor plan ----------
  drawTitleBlock(pdf, { projectName, today, page: "Floor plan", pageNum: 1, total: 3, W, H, margin });

  const canvasImg = stage.toDataURL({ pixelRatio: 2 });
  const imgProps = pdf.getImageProperties(canvasImg);
  const drawableW = W - margin * 2;
  const drawableH = H - margin * 2 - 60; // leave room for title block
  const ratio = Math.min(drawableW / imgProps.width, drawableH / imgProps.height);
  const drawW = imgProps.width * ratio;
  const drawH = imgProps.height * ratio;
  const drawX = (W - drawW) / 2;
  const drawY = margin + 50;
  pdf.addImage(canvasImg, "PNG", drawX, drawY, drawW, drawH);

  // North arrow + scale bar in lower-right of the plan
  drawScaleBar(pdf, drawX + drawW - 110, drawY + drawH - 40, ppf, ratio);

  // ---------- Page 2: Inventory ----------
  pdf.addPage();
  drawTitleBlock(pdf, { projectName, today, page: "Inventory", pageNum: 2, total: 3, W, H, margin });

  const rows = buildShoppingList();
  const colWidths = [140, 120, 70, 70, 80, 80, 100, 110]; // 770pt
  const headers = ["Label", "Catalog", "W × D", "Status", "Price", "Est. low", "Retailer", "Notes"];
  let y = margin + 50;
  pdf.setFontSize(9).setFont("helvetica", "bold").setTextColor(120);
  let x = margin;
  headers.forEach((h, i) => {
    pdf.text(h.toUpperCase(), x, y);
    x += colWidths[i];
  });
  pdf.setFont("helvetica", "normal").setTextColor(30);
  y += 12;
  pdf.setDrawColor(220).line(margin, y - 6, W - margin, y - 6);

  for (const r of rows) {
    if (y > H - 50) {
      pdf.addPage();
      drawTitleBlock(pdf, { projectName, today, page: "Inventory (cont)", pageNum: 2, total: 3, W, H, margin });
      y = margin + 50;
    }
    x = margin;
    const range = (r as { priceLow: number; priceHigh: number });
    const cells = [
      truncate(r.label, 28),
      truncate(r.catalogName, 22),
      `${formatFeet(r.width)} × ${formatFeet(r.depth)}`,
      r.status || "—",
      r.price ? `$${r.price.toLocaleString()}` : "—",
      `~$${range.priceLow}-${range.priceHigh}`,
      truncate(r.retailer || "—", 18),
      truncate(r.notes || "", 20),
    ];
    cells.forEach((c, i) => {
      pdf.text(c, x, y);
      x += colWidths[i];
    });
    y += 14;
  }

  // Totals
  const total = rows.reduce((acc, r) => acc + (r.price || (r.priceLow + r.priceHigh) / 2), 0);
  const known = rows.reduce((acc, r) => acc + (r.price || 0), 0);
  y += 12;
  pdf.setDrawColor(80).line(margin, y - 6, W - margin, y - 6);
  pdf.setFont("helvetica", "bold").setFontSize(10);
  pdf.text(`Booked total: $${known.toLocaleString()}`, margin, y + 6);
  pdf.text(`Estimated total: ~$${Math.round(total).toLocaleString()}`, margin + 220, y + 6);

  // ---------- Page 3: Summary ----------
  pdf.addPage();
  drawTitleBlock(pdf, { projectName, today, page: "Summary", pageNum: 3, total: 3, W, H, margin });

  let sy = margin + 60;
  pdf.setFont("helvetica", "bold").setFontSize(11).setTextColor(30);
  pdf.text("Rooms", margin, sy);
  sy += 6;
  pdf.setDrawColor(220).line(margin, sy, margin + 250, sy);
  sy += 14;
  pdf.setFont("helvetica", "normal").setFontSize(10);

  for (const room of s.rooms) {
    const area = polygonAreaSqft(room.polygon);
    const piecesInRoom = s.placed.filter((p) => {
      // crude point-in-polygon
      let inside = false;
      for (let i = 0, j = room.polygon.length - 1; i < room.polygon.length; j = i++) {
        const xi = room.polygon[i].x;
        const yi = room.polygon[i].y;
        const xj = room.polygon[j].x;
        const yj = room.polygon[j].y;
        if (((yi > p.y) !== (yj > p.y)) && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi || 1e-9) + xi) inside = !inside;
      }
      return inside;
    });
    const cost = piecesInRoom.reduce((a, p) => {
      const c = getCatalogItem(p.catalogId);
      if (!c) return a;
      const [lo, hi] = defaultPrice(c);
      return a + (p.priceUsd || (lo + hi) / 2);
    }, 0);
    pdf.text(`${room.name} · ${area.toFixed(0)} sqft · ${piecesInRoom.length} pieces · ~$${Math.round(cost).toLocaleString()}`, margin, sy);
    sy += 14;
  }
  if (!s.rooms.length) {
    pdf.setTextColor(150).text("No rooms defined.", margin, sy);
    pdf.setTextColor(30);
    sy += 14;
  }

  sy += 14;
  pdf.setFont("helvetica", "bold").setFontSize(11);
  pdf.text("Project totals", margin, sy);
  sy += 6;
  pdf.setDrawColor(220).line(margin, sy, margin + 250, sy);
  sy += 14;
  pdf.setFont("helvetica", "normal").setFontSize(10);
  pdf.text(`Pieces placed: ${s.placed.filter((p) => !p.hidden).length}`, margin, sy); sy += 14;
  pdf.text(`Walls: ${s.walls.length}  ·  Doors: ${s.doors.length}  ·  Windows: ${s.windows.length}`, margin, sy); sy += 14;
  pdf.text(`Fixtures: ${s.fixtures.length}  ·  Annotations: ${s.annotations.length}`, margin, sy); sy += 14;
  pdf.text(`Ceiling height: ${formatFeet(s.ceilingHeightFt)}`, margin, sy); sy += 14;
  if (s.theme) {
    pdf.text(`Theme: ${s.theme}`, margin, sy); sy += 14;
  }

  pdf.save(`${slugify(projectName)}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function drawTitleBlock(
  pdf: jsPDF,
  opts: { projectName: string; today: string; page: string; pageNum: number; total: number; W: number; H: number; margin: number },
) {
  const { projectName, today, page, pageNum, total, W, margin } = opts;
  pdf.setDrawColor(28, 25, 23).setLineWidth(0.5);
  pdf.line(margin, margin + 28, W - margin, margin + 28);
  pdf.setFont("helvetica", "bold").setFontSize(14).setTextColor(28, 25, 23);
  pdf.text(projectName, margin, margin + 18);
  pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(120, 113, 108);
  pdf.text(page.toUpperCase(), margin + 240, margin + 18);
  pdf.text(`${today}  ·  Page ${pageNum} of ${total}`, W - margin, margin + 18, { align: "right" });
}

function drawScaleBar(pdf: jsPDF, x: number, y: number, ppf: number, ratio: number) {
  // 5 feet bar
  const fivePxOnPdf = 5 * ppf * ratio;
  pdf.setDrawColor(28, 25, 23).setLineWidth(1);
  pdf.line(x, y, x + fivePxOnPdf, y);
  pdf.line(x, y - 4, x, y + 4);
  pdf.line(x + fivePxOnPdf, y - 4, x + fivePxOnPdf, y + 4);
  pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(80);
  pdf.text(`5'`, x + fivePxOnPdf / 2 - 4, y + 14);
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
