"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X, Sofa, Table, BedDouble, Archive, Layers as LayersIcon, Lamp, Sparkles, Package } from "lucide-react";
import { CATALOG } from "@/lib/catalog";
import { TEMPLATES } from "@/lib/templates";
import { useDesignStore } from "@/lib/store";
import { listLayouts, loadLayout } from "@/lib/persistence";
import { ALL_THEMES, type Theme } from "@/lib/types";

/**
 * Cmd+K command palette: fuzzy search across catalog, templates, saved layouts,
 * themes, and a small set of common commands. Single keyboard entry point that
 * replaces "where is that button again?" digging.
 */
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery("");
        setHi(0);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  type Cmd = {
    id: string;
    label: string;
    hint: string;
    section: string;
    icon: React.ReactNode;
    run: () => void;
  };

  const items = useMemo<Cmd[]>(() => {
    const list: Cmd[] = [];

    for (const c of CATALOG) {
      list.push({
        id: `cat-${c.id}`,
        label: c.name,
        hint: `Place · ${c.category} · ${c.width}'×${c.depth}'`,
        section: "Furniture",
        icon: <span className="w-3 h-3 rounded-sm" style={{ background: c.color }} />,
        run: () => useDesignStore.getState().setToolMode("place", c.id),
      });
    }

    for (const t of TEMPLATES) {
      list.push({
        id: `tpl-${t.id}`,
        label: t.name,
        hint: `Template · ${t.pieces.length} pieces`,
        section: "Templates",
        icon: <Package className="w-3 h-3 text-ink-500" />,
        run: () => {
          const fp = useDesignStore.getState().floorPlan;
          if (!fp || !fp.pixelsPerFoot) return;
          const ppf = fp.pixelsPerFoot;
          const cx = fp.imagePxWidth / ppf / 2;
          const cy = fp.imagePxHeight / ppf / 2;
          useDesignStore.getState().addFurnitureBatch(
            t.pieces.map((p) => ({ ...p, id: crypto.randomUUID(), x: cx + p.x, y: cy + p.y })),
          );
        },
      });
    }

    for (const l of listLayouts()) {
      list.push({
        id: `layout-${l.id}`,
        label: l.name,
        hint: `Load layout · ${l.placed.length} pieces`,
        section: "Saved layouts",
        icon: <Archive className="w-3 h-3 text-ink-500" />,
        run: () => loadLayout(l.id),
      });
    }

    for (const t of ALL_THEMES) {
      list.push({
        id: `theme-${t.id}`,
        label: t.label,
        hint: `Theme · ${t.description}`,
        section: "Themes",
        icon: <Sparkles className="w-3 h-3 text-accent-500" />,
        run: () => useDesignStore.getState().setTheme(t.id as Theme),
      });
    }

    // commands
    const commands: { label: string; hint: string; run: () => void }[] = [
      { label: "View — 2D editor", hint: "Switch view", run: () => useDesignStore.getState().setView("2d") },
      { label: "View — 3D render", hint: "Switch view", run: () => useDesignStore.getState().setView("3d") },
      { label: "View — Elevation", hint: "Switch view", run: () => useDesignStore.getState().setView("elevation") },
      { label: "View — Compare (AB)", hint: "Switch view", run: () => useDesignStore.getState().setView("compare") },
      { label: "Fit to view", hint: "F", run: () => useDesignStore.getState().fitToView() },
      { label: "Toggle labels", hint: "Show dimensions on pieces", run: () => useDesignStore.getState().toggleDimensions() },
      { label: "Toggle grid", hint: "1' grid overlay", run: () => useDesignStore.getState().toggleGrid() },
      { label: "Toggle sun path", hint: "East→South→West arc", run: () => useDesignStore.getState().toggleSunPath() },
      { label: "Clearance — off", hint: "", run: () => useDesignStore.getState().setClearanceMode("off") },
      { label: "Clearance — selected", hint: "", run: () => useDesignStore.getState().setClearanceMode("selected") },
      { label: "Clearance — all", hint: "", run: () => useDesignStore.getState().setClearanceMode("all") },
      { label: "Reset scene", hint: "Clear floor plan + all furniture", run: () => { if (confirm("Reset the entire scene?")) useDesignStore.getState().reset(); } },
    ];
    for (const c of commands) {
      list.push({
        id: `cmd-${c.label}`,
        label: c.label,
        hint: c.hint,
        section: "Commands",
        icon: <span className="w-3 h-3" />,
        run: c.run,
      });
    }

    return list;
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 60);
    const scored = items
      .map((it) => {
        const hay = (it.label + " " + it.hint + " " + it.section).toLowerCase();
        const idx = hay.indexOf(q);
        if (idx === -1) return null;
        return { it, score: idx };
      })
      .filter((x): x is { it: Cmd; score: number } => x !== null)
      .sort((a, b) => a.score - b.score)
      .slice(0, 60)
      .map((x) => x.it);
    return scored;
  }, [items, query]);

  useEffect(() => {
    if (hi >= filtered.length) setHi(0);
  }, [filtered, hi]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-start pt-24 bg-ink-900/30 backdrop-blur-sm animate-fade-in" onClick={() => setOpen(false)}>
      <div className="card shadow-float w-[640px] max-w-[95vw] max-h-[70vh] flex flex-col animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-ink-200/70">
          <Search className="w-4 h-4 text-ink-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setHi(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(filtered.length - 1, h + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
              if (e.key === "Enter") {
                e.preventDefault();
                const it = filtered[hi];
                if (it) { it.run(); setOpen(false); }
              }
            }}
            placeholder="Search furniture, templates, layouts, themes, commands…"
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <kbd className="text-[10px] font-mono text-ink-400 px-1.5 py-0.5 rounded border border-ink-200">esc</kbd>
          <button onClick={() => setOpen(false)} className="btn-ghost btn-icon">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {filtered.length === 0 && <div className="px-4 py-6 text-sm text-ink-500 text-center">No results.</div>}
          {filtered.map((it, i) => (
            <button
              key={it.id}
              onClick={() => { it.run(); setOpen(false); }}
              onMouseEnter={() => setHi(i)}
              className={`w-full text-left px-4 py-2 flex items-center gap-3 text-sm border-l-2 ${
                i === hi ? "bg-accent-50 border-accent-500" : "border-transparent hover:bg-ink-100"
              }`}
            >
              {it.icon}
              <div className="flex-1 min-w-0">
                <div className="truncate">{it.label}</div>
                <div className="text-[10px] text-ink-500 truncate">{it.section} · {it.hint}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-ink-200/70 flex items-center justify-between text-[10px] text-ink-500">
          <span>↑↓ navigate · ↵ select · esc close</span>
          <span>{filtered.length} results</span>
        </div>
      </div>
    </div>
  );
}
