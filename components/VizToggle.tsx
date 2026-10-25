"use client";

import { nextVizMode, useViz, VIZ_LABEL } from "@/store/visualizer";

/** Steps through the visualizers (3D blob, dots, signal lines); the choice is remembered on this device. */
export function VizToggle({ className }: { className?: string }) {
  const mode = useViz((s) => s.mode);
  const setMode = useViz((s) => s.setMode);
  const label = mode && VIZ_LABEL[mode];
  const next = mode && VIZ_LABEL[nextVizMode(mode)];

  return (
    <button
      type="button"
      disabled={mode === null}
      // Starts with the visible text (label-in-name), then says what a press does.
      aria-label={mode === null ? "Visualizer" : `${label} visualizer, switch to ${next}`}
      title={mode === null ? undefined : `${label} visualizer. Switch to ${next}`}
      onClick={() => mode && setMode(nextVizMode(mode))}
      className={`${className} text-[10px] font-bold uppercase tracking-[0.06em]`}
    >
      <span aria-hidden="true">{label ?? ""}</span>
    </button>
  );
}
