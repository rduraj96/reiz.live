"use client";

import { useEffect } from "react";
import { useAmbient } from "@/store/ambient";
import { usePlayer } from "@/store/player";

/** The bar and cursor hide after this long without pointer, touch or key activity. */
export const AMBIENT_IDLE_MS = 3000;

/** Ambient mode's only chrome: station · song and an exit button, fading out when idle. */
export function AmbientControls() {
  const on = useAmbient((s) => s.on);
  const idle = useAmbient((s) => s.idle);
  const exit = useAmbient((s) => s.exit);
  const name = usePlayer((s) => s.current?.name ?? "");
  const song = usePlayer((s) => s.nowPlaying);

  useEffect(() => {
    if (!on) return;
    let timer = setTimeout(() => useAmbient.getState().setIdle(true), AMBIENT_IDLE_MS);
    const wake = () => {
      clearTimeout(timer);
      if (useAmbient.getState().idle) useAmbient.getState().setIdle(false);
      timer = setTimeout(() => useAmbient.getState().setIdle(true), AMBIENT_IDLE_MS);
    };
    const events = ["pointermove", "pointerdown", "keydown", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, wake));
    };
  }, [on]);

  if (!on) return null;
  return (
    <div
      data-testid="ambient-bar"
      data-idle={idle || undefined}
      className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-between gap-4 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 transition-opacity duration-700 data-[idle]:pointer-events-none data-[idle]:opacity-0 motion-reduce:transition-none md:px-8 min-[1440px]:px-16"
    >
      <p className="min-w-0 truncate text-sm text-muted">
        <span className="text-foreground">{name}</span>
        {song && <span> · {song}</span>}
      </p>
      <button
        type="button"
        onClick={exit}
        className="flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-[hsl(0_0%_22%)] px-4 text-xs uppercase tracking-[0.14em] text-muted transition-colors hover:border-foreground hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
        </svg>
        Exit ambient mode
      </button>
    </div>
  );
}
