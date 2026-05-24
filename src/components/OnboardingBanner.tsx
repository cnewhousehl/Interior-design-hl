"use client";

import { useEffect, useState } from "react";
import { Check, Upload, Ruler, Sofa, X } from "lucide-react";
import { useDesignStore } from "@/lib/store";

const DISMISS_KEY = "plan-studio-onboarding-dismissed";

export default function OnboardingBanner() {
  const floorPlan = useDesignStore((s) => s.floorPlan);
  const placed = useDesignStore((s) => s.placed);
  const calibrated = !!floorPlan?.pixelsPerFoot;
  const placedCount = placed.length;

  const [dismissed, setDismissed] = useState(true); // start true to avoid SSR flicker

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const allDone = !!floorPlan && calibrated && placedCount > 0;
  if (dismissed || allDone) return null;

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-paper-50/95 backdrop-blur-md border border-ink-200/70 rounded-xl shadow-float px-3 py-2 flex items-center gap-3 animate-slide-up">
      <Step
        icon={<Upload className="w-3.5 h-3.5" />}
        label="Upload floor plan"
        done={!!floorPlan}
        active={!floorPlan}
      />
      <Sep />
      <Step
        icon={<Ruler className="w-3.5 h-3.5" />}
        label="Calibrate scale"
        done={calibrated}
        active={!!floorPlan && !calibrated}
        hint="Click Cal, then two points on a wall whose length you know"
      />
      <Sep />
      <Step
        icon={<Sofa className="w-3.5 h-3.5" />}
        label="Place furniture"
        done={placedCount > 0}
        active={calibrated && placedCount === 0}
        hint="Pick a piece from the left palette, then click the canvas"
      />
      <button
        onClick={dismiss}
        className="ml-1 p-1 rounded-md text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors"
        title="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function Step({
  icon,
  label,
  done,
  active,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  done: boolean;
  active: boolean;
  hint?: string;
}) {
  const tone = done
    ? "text-emerald-700"
    : active
      ? "text-accent-700"
      : "text-ink-400";
  const ringTone = done
    ? "bg-emerald-100 ring-emerald-300"
    : active
      ? "bg-accent-50 ring-accent-400 animate-pulse"
      : "bg-paper-100 ring-ink-200";
  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${tone}`} title={hint}>
      <span className={`w-5 h-5 rounded-full grid place-items-center ring-1 ${ringTone}`}>
        {done ? <Check className="w-3 h-3" /> : icon}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

function Sep() {
  return <span className="w-3 h-px bg-ink-300/60" aria-hidden />;
}
