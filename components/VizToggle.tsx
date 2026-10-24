"use client";

import { useViz } from "@/store/visualizer";

/** Switches between the 3D chrome blob and the lighter 2D visualizer; the choice is remembered on this device. */
export function VizToggle({ className }: { className?: string }) {
  const mode = useViz((s) => s.mode);
  const setMode = useViz((s) => s.setMode);
  const next = mode === "2d" ? "3d" : "2d";

  return (
    <button
      type="button"
      disabled={mode === null}
      // Starts with the visible text (label-in-name), then says what a press does.
      aria-label={mode === null ? "Visualizer" : `${mode.toUpperCase()} visualizer, switch to ${next.toUpperCase()}`}
      title={mode === "2d" ? "2D visualizer (lighter). Switch to 3D" : "3D visualizer. Switch to the lighter 2D"}
      onClick={() => setMode(next)}
      className={`${className} text-[11px] font-bold tracking-[0.06em]`}
    >
      <span aria-hidden="true">{mode === null ? "" : mode.toUpperCase()}</span>
    </button>
  );
}
