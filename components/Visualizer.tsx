"use client";

import { useEffect, useRef } from "react";
import { getAudioEngine } from "@/lib/audio/engine";
import { usePlayer } from "@/store/player";

/** Full-viewport audio-reactive blob. Mount once; nothing re-renders per frame. */
export function Visualizer() {
  const containerRef = useRef<HTMLDivElement>(null);

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
          return; // No WebGL: the page works without the blob.
        }
        viz.setActive(usePlayer.getState().status === "playing");
        const unsubscribe = usePlayer.subscribe((state) => {
          viz.setActive(state.status === "playing");
        });
        teardown = () => {
          unsubscribe();
          viz.dispose();
        };
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    />
  );
}
