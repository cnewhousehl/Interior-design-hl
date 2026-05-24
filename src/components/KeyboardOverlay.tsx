"use client";

import { useEffect, useState } from "react";
import { X, Keyboard } from "lucide-react";

const SHORTCUTS: { section: string; rows: { keys: string[]; label: string }[] }[] = [
  {
    section: "Tools",
    rows: [
      { keys: ["V"], label: "Select" },
      { keys: ["W"], label: "Draw wall" },
      { keys: ["D"], label: "Draw door" },
      { keys: ["M"], label: "Measure" },
      { keys: ["T"], label: "Traffic path" },
      { keys: ["O"], label: "Drop fixture (outlet)" },
      { keys: ["N"], label: "Add note" },
    ],
  },
  {
    section: "Selection",
    rows: [
      { keys: ["Click"], label: "Select" },
      { keys: ["⇧", "Click"], label: "Add to selection" },
      { keys: ["Drag"], label: "Lasso multi-select" },
      { keys: ["⌘", "A"], label: "Select all" },
      { keys: ["Esc"], label: "Clear selection / exit tool" },
    ],
  },
  {
    section: "Editing",
    rows: [
      { keys: ["Double-click"], label: "Rotate 90° (Shift = 5°)" },
      { keys: ["Arrow keys"], label: "Nudge 0.1' (Shift = 1')" },
      { keys: ["⌘", "D"], label: "Duplicate" },
      { keys: ["⌘", "G"], label: "Group" },
      { keys: ["⌘", "⇧", "G"], label: "Ungroup" },
      { keys: ["L"], label: "Lock/unlock selection" },
      { keys: ["Delete"], label: "Remove selection" },
      { keys: ["Right-click"], label: "Context menu" },
    ],
  },
  {
    section: "View",
    rows: [
      { keys: ["F"], label: "Fit to view" },
      { keys: ["Wheel"], label: "Zoom" },
      { keys: ["Drag empty"], label: "Pan canvas" },
      { keys: ["⌘", "Z"], label: "Undo" },
      { keys: ["⌘", "⇧", "Z"], label: "Redo" },
      { keys: ["⌘", "K"], label: "Command palette" },
      { keys: ["?"], label: "This overlay" },
    ],
  },
];

export default function KeyboardOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && /input|textarea|select/i.test(target.tagName)) return;
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink-900/40 backdrop-blur-sm animate-fade-in p-4" onClick={() => setOpen(false)}>
      <div className="card shadow-float w-[760px] max-w-[95vw] max-h-[85vh] flex flex-col animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-200/70">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-accent-500" />
            <h3 className="font-display text-lg">Keyboard shortcuts</h3>
          </div>
          <button onClick={() => setOpen(false)} className="btn-ghost btn-icon"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-auto p-5 grid grid-cols-2 gap-x-8 gap-y-6">
          {SHORTCUTS.map((sec) => (
            <div key={sec.section}>
              <div className="label mb-2">{sec.section}</div>
              <ul className="space-y-1">
                {sec.rows.map((row, i) => (
                  <li key={i} className="flex items-center text-sm gap-3">
                    <span className="flex-1 text-ink-700">{row.label}</span>
                    <span className="flex gap-1 shrink-0">
                      {row.keys.map((k, j) => (
                        <kbd
                          key={j}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-ink-200 bg-paper-100 text-ink-700"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="px-5 py-2 border-t border-ink-200/70 text-[10px] text-ink-500 text-center">
          Press <kbd className="font-mono">?</kbd> any time to open this · <kbd className="font-mono">esc</kbd> to close
        </div>
      </div>
    </div>
  );
}
