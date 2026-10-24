import { create } from "zustand";

type AmbientState = {
  /** Ambient mode: just the visualizer and a small bar, for leaving the radio on. */
  on: boolean;
  /** No pointer or key activity for a while: the bar and cursor hide. */
  idle: boolean;
  /** We put the page in browser fullscreen, so leaving fullscreen also leaves ambient mode (and exit undoes it). */
  ownsFullscreen: boolean;
  enter: (opts?: { fullscreen?: boolean }) => void;
  exit: () => void;
  toggle: (opts?: { fullscreen?: boolean }) => void;
  setIdle: (idle: boolean) => void;
};

export const useAmbient = create<AmbientState>()((set, get) => ({
  on: false,
  idle: false,
  ownsFullscreen: false,
  enter: (opts) => {
    if (get().on) return;
    set({ on: true, idle: false });
    const root = typeof document !== "undefined" ? document.documentElement : null;
    if (opts?.fullscreen && root?.requestFullscreen && !document.fullscreenElement) {
      // Needs the click or key press that called us; refusal just means no fullscreen.
      root.requestFullscreen().then(
        () => set({ ownsFullscreen: true }),
        () => {},
      );
    }
  },
  exit: () => {
    if (!get().on) return;
    const owned = get().ownsFullscreen;
    set({ on: false, idle: false, ownsFullscreen: false });
    if (owned && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  },
  toggle: (opts) => (get().on ? get().exit() : get().enter(opts)),
  setIdle: (idle) => set({ idle }),
}));
