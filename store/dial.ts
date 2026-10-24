import { create } from "zustand";
import { genres } from "@/lib/catalog";
import type { DialBand } from "@/lib/dial/layout";

type DialState = {
  bands: DialBand[];
  needleGenre: string | null;
  /** The language key of the data currently loaded (set by resetForLanguage); usePlayer.language is the source of truth. */
  language: string;
  /** Flips true once, when the first band becomes ready; never reset by resetForLanguage. */
  firstBandReady: boolean;
};

type DialActions = {
  setNeedleGenre: (g: string | null) => void;
  patchBand: (genre: string, patch: Partial<DialBand>) => void;
  resetForLanguage: (language: string) => void;
  retryAll: () => void;
};

const initialBands = (): DialBand[] =>
  genres.map((g) => ({ genre: g.value, label: g.label, state: "idle", stations: [] }));

export const useDial = create<DialState & DialActions>()((set) => ({
  bands: initialBands(),
  needleGenre: null,
  language: "any",
  firstBandReady: false,

  setNeedleGenre: (needleGenre) => set({ needleGenre }),

  patchBand: (genre, patch) =>
    set((s) => ({
      bands: s.bands.map((b) => (b.genre === genre ? { ...b, ...patch } : b)),
      firstBandReady: s.firstBandReady || patch.state === "ready",
    })),

  resetForLanguage: (language) =>
    set((s) => ({
      language,
      bands: s.bands.map((b) => ({ ...b, state: "idle", stations: [] })),
    })),

  retryAll: () =>
    set((s) => ({
      bands: s.bands.map((b) => (b.state === "error" ? { ...b, state: "idle" } : b)),
    })),
}));
