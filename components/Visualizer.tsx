"use client";

import { useEffect, useRef, useState } from "react";
import { getAudioEngine } from "@/lib/audio/engine";
import { usePlayer } from "@/store/player";
import { useViz } from "@/store/visualizer";
import { FIRST_FRAME_EVENT } from "@/visualizer/events";
import type { Visualizer as Viz } from "@/visualizer/scene";

type Create = typeof import("@/visualizer/scene").createVisualizer;

/** Loads the renderer for a mode: 3D pulls in three.js, 2D is a plain canvas. Both only in the browser, after mount. */
const loaders: Record<"2d" | "3d", () => Promise<Create>> = {
  "3d": () => import("@/visualizer/scene").then((m) => m.createVisualizer),
  "2d": () => import("@/visualizer/flat").then((m) => m.createFlatVisualizer),
};

/** The chrome blob (3D) or its light 2D take, in a centred square. Nothing re-renders per frame. */
export function Visualizer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);
  const chosen = useViz((s) => s.mode);
  // No WebGL: the 2D canvas stands in for the 3D blob.
  const [noWebGL, setNoWebGL] = useState(false);
  const mode = chosen === "3d" && noWebGL ? "2d" : chosen;

  useEffect(() => useViz.getState().resolve(), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mode === null) return;

    let cancelled = false;
    let teardown: (() => void) | null = null;

    loaders[mode]()
      .then((create) => {
        if (cancelled) return;
        let viz: Viz;
        try {
          viz = create(container, () => getAudioEngine().analyser, {
            reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          });
        } catch {
          if (mode === "3d") setNoWebGL(true);
          else setFallback(true); // Not even Canvas 2D: a CSS disc stands in for the blob.
          return;
        }
        const sync = (state: ReturnType<typeof usePlayer.getState>) => {
          viz.setActive(state.status === "playing");
          viz.setTuning(state.tuning);
        };
        sync(usePlayer.getState());
        const unsubscribe = usePlayer.subscribe(sync);
        teardown = () => {
          unsubscribe();
          viz.dispose();
        };
      })
      .catch(() => {
        if (!cancelled) setFallback(true);
      });

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, [mode]);

  useEffect(() => {
    if (fallback) window.dispatchEvent(new Event(FIRST_FRAME_EVENT));
  }, [fallback]);

  return (
    // Fills its positioned parent (the blob button) and centres the blob square in it.
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
      <div ref={containerRef} className="relative aspect-square w-[min(70vw,360px)]">
        {fallback && (
          <div
            data-testid="visualizer-fallback"
            className="absolute inset-0 rounded-full"
            style={{ background: "radial-gradient(circle, #ee2647 0%, #2b7bff 45%, transparent 70%)" }}
          />
        )}
      </div>
    </div>
  );
}
