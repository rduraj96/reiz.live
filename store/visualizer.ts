import { create } from "zustand";

export type VizMode = "2d" | "3d";

const KEY = "reizdio:viz";

/** Touch-first devices (phones, tablets) start on the light 2D visualizer; everything else on the 3D blob. */
export function defaultVizMode(): VizMode {
  try {
    return window.matchMedia("(hover: none) and (pointer: coarse)").matches ? "2d" : "3d";
  } catch {
    return "3d";
  }
}

function readSaved(): VizMode | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "2d" || v === "3d" ? v : null;
  } catch {
    return null;
  }
}

type VizState = {
  /** null until resolved in the browser (saved choice, else the device default). */
  mode: VizMode | null;
  resolve: () => void;
  setMode: (mode: VizMode) => void;
};

export const useViz = create<VizState>()((set, get) => ({
  mode: null,
  resolve: () => {
    if (get().mode === null) set({ mode: readSaved() ?? defaultVizMode() });
  },
  setMode: (mode) => {
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      // Private mode or blocked storage: the choice just lasts for this visit.
    }
    set({ mode });
  },
}));
