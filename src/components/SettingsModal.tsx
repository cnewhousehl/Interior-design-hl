"use client";

import { useEffect, useState } from "react";
import { X, Settings as SettingsIcon, Key, DollarSign, FileText } from "lucide-react";
import { settings, type AppSettings } from "@/lib/settings";

export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [draft, setDraft] = useState<AppSettings>({});
  const [revealKey, setRevealKey] = useState(false);

  useEffect(() => {
    if (open) setDraft(settings.get());
  }, [open]);

  if (!open) return null;

  const save = () => {
    settings.set(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink-900/40 backdrop-blur-sm animate-fade-in p-4" onClick={onClose}>
      <div className="card shadow-float w-[520px] max-w-[95vw] flex flex-col animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-200/70">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-accent-500" />
            <h3 className="font-display text-lg">Settings</h3>
          </div>
          <button onClick={onClose} className="btn-ghost btn-icon"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-5 text-sm">
          <div>
            <div className="label mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3 h-3" /> Project name
            </div>
            <input
              type="text"
              value={draft.projectName ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, projectName: e.target.value }))}
              placeholder="Apartment plan"
              className="input"
            />
            <div className="text-[11px] text-ink-500 mt-1">Used in PDF exports.</div>
          </div>

          <div>
            <div className="label mb-1.5 flex items-center gap-1.5">
              <DollarSign className="w-3 h-3" /> Budget (USD)
            </div>
            <input
              type="number"
              value={draft.budgetUsd ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, budgetUsd: e.target.value ? Number(e.target.value) : undefined }))}
              placeholder="No budget set"
              className="input"
            />
            <div className="text-[11px] text-ink-500 mt-1">A budget alarm shows in the Shop tab when your estimated total exceeds this.</div>
          </div>

          <div>
            <div className="label mb-1.5 flex items-center gap-1.5">
              <Key className="w-3 h-3" /> Anthropic API key (optional)
            </div>
            <div className="flex items-center gap-2">
              <input
                type={revealKey ? "text" : "password"}
                value={draft.anthropicApiKey ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, anthropicApiKey: e.target.value || undefined }))}
                placeholder="sk-ant-…"
                className="input font-mono"
              />
              <button
                type="button"
                onClick={() => setRevealKey((r) => !r)}
                className="btn-outline btn-sm shrink-0"
              >
                {revealKey ? "Hide" : "Show"}
              </button>
            </div>
            <div className="text-[11px] text-ink-500 mt-1 leading-relaxed">
              Stored locally in your browser, never persisted to the repo. Used by the auto-detect, photo-identify, and recommendations features. Get one at{" "}
              <a className="underline" href="https://console.anthropic.com/" target="_blank" rel="noreferrer">
                console.anthropic.com
              </a>.
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-ink-200/70 flex justify-end gap-2">
          <button onClick={() => { settings.clear(); setDraft({}); }} className="btn-outline btn-md">Clear all</button>
          <button onClick={onClose} className="btn-outline btn-md">Cancel</button>
          <button onClick={save} className="btn-primary btn-md">Save</button>
        </div>
      </div>
    </div>
  );
}
