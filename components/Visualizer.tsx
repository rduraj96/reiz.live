"use client";

import { useEffect, useRef, useState } from "react";
import { getAudioEngine } from "@/lib/audio/engine";
import { usePlayer } from "@/store/player";

const FIRST_FRAME_EVENT = "visualizer-first-frame";

/** Liquid chrome blob in a centred square. Mount once; nothing re-renders per frame. */
export function Visualizer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let teardown: (() => void) | null = null;

    // three.js loads only in the browser, after mount.
    import("@/visualizer/scene")
      .then(({ createVisualizer }) => {
        if (cancelled) return;
        let viz;
        try {
          viz = createVisualizer(container, () => getAudioEngine().analyser, {
            reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          });
        } catch {
          setFallback(true); // No WebGL: a CSS disc stands in for the blob.
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
  }, []);

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
