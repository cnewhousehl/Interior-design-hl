import { defaultPrice, getCatalogItem } from "./catalog";
import { useDesignStore } from "./store";
import type { FurnitureStatus } from "./types";

export type ShoppingRow = {
  label: string;
  catalogName: string;
  category: string;
  width: number;
  depth: number;
  status: FurnitureStatus | "";
  price: number;
  priceLow: number;
  priceHigh: number;
  retailer: string;
  url: string;
  notes: string;
};

export function buildShoppingList(): ShoppingRow[] {
  const placed = useDesignStore.getState().placed;
  return placed
    .filter((p) => !p.hidden)
    .map((p) => {
      const cat = getCatalogItem(p.catalogId);
      const range = cat ? defaultPrice(cat) : [0, 0];
      return {
        label: p.label,
        catalogName: cat?.name ?? p.catalogId,
        category: cat?.category ?? "—",
        width: p.widthOverride ?? cat?.width ?? 0,
        depth: p.depthOverride ?? cat?.depth ?? 0,
        status: (p.status ?? "") as FurnitureStatus | "",
        price: p.priceUsd ?? 0,
        priceLow: range[0],
        priceHigh: range[1],
        retailer: p.retailer ?? "",
        url: p.productUrl ?? "",
        notes: p.notes ?? "",
      } satisfies ShoppingRow;
    });
}

export function toCsv(rows: ShoppingRow[]): string {
  const header = [
    "Label",
    "Catalog item",
    "Category",
    "Width (ft)",
    "Depth (ft)",
    "Status",
    "Price (USD)",
    "Est. low",
    "Est. high",
    "Retailer",
    "URL",
    "Notes",
  ];
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = rows.map((r) =>
    [
      r.label,
      r.catalogName,
      r.category,
      r.width.toFixed(2),
      r.depth.toFixed(2),
      r.status,
      r.price || "",
      r.priceLow,
      r.priceHigh,
      r.retailer,
      r.url,
      r.notes,
    ]
      .map(escape)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export function downloadShoppingCsv() {
  const rows = buildShoppingList();
  if (!rows.length) {
    alert("No furniture placed yet.");
    return;
  }
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `shopping-list-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
