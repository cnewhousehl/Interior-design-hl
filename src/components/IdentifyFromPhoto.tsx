"use client";

import { useRef, useState } from "react";
import { Camera, X, Sparkles, Plus, CircleCheck } from "lucide-react";
import { useDesignStore } from "@/lib/store";
import { getCatalogItem } from "@/lib/catalog";
import { formatFeet } from "@/lib/format";
import { getApiKey } from "@/lib/settings";

type IdentifiedItem = {
  catalogId: string | null;
  label: string;
  widthFt: number;
  depthFt: number;
  positionHint: string;
  confidence: number;
};

export default function IdentifyFromPhoto() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [items, setItems] = useState<IdentifiedItem[]>([]);
  const [placed, setPlaced] = useState<Set<number>>(new Set());

  const floorPlan = useDesignStore((s) => s.floorPlan);
  const addFurniture = useDesignStore((s) => s.addFurniture);
  const setToolMode = useDesignStore((s) => s.setToolMode);
  const calibrated = !!floorPlan?.pixelsPerFoot;

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setPhotoUrl(dataUrl);
      const base64 = dataUrl.split(",")[1];
      const mediaType = dataUrl.match(/^data:(.*?);/)?.[1] ?? "image/jpeg";
      const res = await fetch("/api/identify-furniture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType, apiKey: getApiKey() }),
      });
      const data = await res.json();
      if (data.error) {
        alert(`Identification failed: ${data.error}`);
        return;
      }
      setItems(data.items ?? []);
      setPlaced(new Set());
    } catch (err) {
      alert(`Error: ${err}`);
    } finally {
      setBusy(false);
    }
  };

  const placeItem = (idx: number) => {
    if (!floorPlan || !floorPlan.pixelsPerFoot) return;
    const item = items[idx];
    const ppf = floorPlan.pixelsPerFoot;
    // Drop near the center of the floor plan, offset slightly so multiple items don't stack
    const cx = floorPlan.imagePxWidth / ppf / 2;
    const cy = floorPlan.imagePxHeight / ppf / 2;
    const offset = placed.size * 1.5;
    const fallback = item.catalogId && getCatalogItem(item.catalogId);
    const catId = fallback ? item.catalogId! : (closestCatalogId(item) ?? "armchair");
    const cat = getCatalogItem(catId)!;
    addFurniture({
      id: crypto.randomUUID(),
      catalogId: catId,
      label: item.label,
      x: cx + offset,
      y: cy + offset,
      rotation: 0,
      widthOverride: item.widthFt || cat.width,
      depthOverride: item.depthFt || cat.depth,
      status: "owned",
    });
    setPlaced((p) => new Set([...p, idx]));
  };

  const placeAll = () => {
    items.forEach((_, i) => {
      if (!placed.has(i)) placeItem(i);
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={!calibrated}
        title="Identify furniture from a room photo"
        className="btn-outline btn-md shrink-0"
      >
        <Camera className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">From photo</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 backdrop-blur-sm animate-fade-in p-4">
          <div className="card shadow-float w-full max-w-3xl max-h-[85vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between px-5 py-3 border-b border-ink-200/70">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent-500" />
                <h3 className="font-display text-lg">Identify furniture from photo</h3>
              </div>
              <button onClick={() => setOpen(false)} className="btn-ghost btn-icon">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5">
              {!photoUrl ? (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full h-64 rounded-xl border-2 border-dashed border-ink-300 hover:border-accent-500 hover:bg-paper-200/40 transition-colors flex flex-col items-center justify-center gap-2"
                >
                  <Camera className="w-8 h-8 text-ink-400" />
                  <div className="font-medium text-sm">Upload a room photo</div>
                  <div className="text-xs text-ink-500 max-w-xs text-center leading-snug">
                    Claude will identify the major furniture pieces and let you drop them onto your floor plan.
                  </div>
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <img src={photoUrl} className="rounded-lg w-full" alt="Room" />
                    <button
                      onClick={() => {
                        setPhotoUrl(null);
                        setItems([]);
                        setPlaced(new Set());
                      }}
                      className="btn-outline btn-sm mt-2 w-full"
                    >
                      Use a different photo
                    </button>
                  </div>
                  <div className="space-y-2">
                    {busy && (
                      <div className="text-center py-8">
                        <Sparkles className="w-8 h-8 text-accent-500 mx-auto animate-pulse" />
                        <div className="text-sm text-ink-600 mt-2">Identifying furniture…</div>
                      </div>
                    )}
                    {!busy && items.length === 0 && photoUrl && (
                      <div className="text-sm text-ink-500 text-center py-8">No furniture identified.</div>
                    )}
                    {items.map((it, i) => {
                      const cat = it.catalogId ? getCatalogItem(it.catalogId) : null;
                      const isPlaced = placed.has(i);
                      return (
                        <div key={i} className="card p-3 flex items-start gap-3">
                          <div
                            className="w-10 h-10 rounded-md shrink-0 ring-1 ring-ink-200"
                            style={{ background: cat?.color ?? "#a8a29e" }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{it.label}</div>
                            <div className="text-[11px] text-ink-500 font-mono">
                              {formatFeet(it.widthFt)}×{formatFeet(it.depthFt)} · {it.positionHint}
                            </div>
                            <div className="text-[10px] text-ink-400 mt-0.5">
                              {cat ? `Matches "${cat.name}"` : "No catalog match"} · {Math.round(it.confidence * 100)}% confident
                            </div>
                          </div>
                          {isPlaced ? (
                            <span className="text-sage-500 text-xs flex items-center gap-0.5">
                              <CircleCheck className="w-3.5 h-3.5" /> Placed
                            </span>
                          ) : (
                            <button onClick={() => placeItem(i)} className="btn-accent btn-sm">
                              <Plus className="w-3 h-3" /> Place
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
            </div>

            {items.length > 0 && (
              <div className="px-5 py-3 border-t border-ink-200/70 flex justify-between gap-2">
                <span className="text-xs text-ink-500 self-center">
                  Pieces drop near the center of your floor plan — drag them into the right room after.
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setOpen(false)} className="btn-outline btn-md">
                    Close
                  </button>
                  <button
                    onClick={() => {
                      placeAll();
                      setToolMode("select");
                    }}
                    disabled={placed.size === items.length}
                    className="btn-primary btn-md"
                  >
                    Place all ({items.length - placed.size})
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function closestCatalogId(_item: IdentifiedItem): string | null {
  // The vision call already does its own matching — if it returned null we just fall back to armchair.
  return null;
}
