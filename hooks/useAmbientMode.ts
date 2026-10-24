"use client";

import { useEffect } from "react";
import { useAmbient } from "@/store/ambient";

/** Typing somewhere, or a panel is open: single-letter shortcuts belong to that. */
function keyIsForSomethingElse(e: KeyboardEvent): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey) return true;
  const el = e.target as HTMLElement | null;
  if (el?.closest("input, textarea, select, [contenteditable='true']")) return true;
  return document.querySelector("[role='dialog']") !== null;
}

/** The F key, Esc, leaving fullscreen, and the screen wake lock for ambient mode. Mount once. */
export function useAmbientMode() {
  const on = useAmbient((s) => s.on);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && useAmbient.getState().on) {
        useAmbient.getState().exit();
      } else if ((e.key === "f" || e.key === "F") && !e.repeat && !keyIsForSomethingElse(e)) {
        e.preventDefault();
        useAmbient.getState().toggle({ fullscreen: true });
      }
    };
    // Esc in fullscreen is taken by the browser: it only tells us fullscreen ended.
    const onFullscreen = () => {
      const s = useAmbient.getState();
      if (!document.fullscreenElement && s.on && s.ownsFullscreen) s.exit();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, []);

  // Keep the screen on while ambient; the lock drops when the page hides, so take it again on return.
  useEffect(() => {
    if (!on || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = () => {
      if (document.hidden) return;
      navigator.wakeLock.request("screen").then(
        (l) => {
          if (cancelled) void l.release();
          else lock = l;
        },
        () => {},
      );
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release();
    };
  }, [on]);
}
