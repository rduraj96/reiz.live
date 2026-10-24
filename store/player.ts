import { create } from "zustand";
import type { Station } from "@/lib/radio/types";

export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "blocked" | "error";

const MAX_FAILED_IN_A_ROW = 5;

type PlayerState = {
  list: Station[];
  current: Station | null;
  status: PlayerStatus;
  genre: string;
  language: string;
  muted: boolean;
  volume: number;
  failedInARow: number;
  listError: string | null;
};

type PlayerActions = {
  setList: (list: Station[]) => void;
  select: (station: Station) => void;
  next: () => void;
  prev: () => void;
  markFailed: (station: Station) => void;
  setGenre: (g: string) => void;
  setLanguage: (l: string) => void;
  setStatus: (s: PlayerStatus) => void;
  toggleMute: () => void;
  setVolume: (v: number) => void;
};

export const usePlayer = create<PlayerState & PlayerActions>()((set, get) => {
  const step = (delta: 1 | -1) => {
    const { list, current } = get();
    if (list.length === 0) return;
    const i = current ? list.findIndex((s) => s.id === current.id) : -1;
    const target =
      i === -1 ? (delta === 1 ? 0 : list.length - 1) : (i + delta + list.length) % list.length;
    get().select(list[target]);
  };

  return {
    list: [],
    current: null,
    status: "idle",
    genre: "house",
    language: "english",
    muted: false,
    volume: 0.8,
    failedInARow: 0,
    listError: null,

    setList: (list) => set({ list }),
    select: (station) => set({ current: station, status: "loading" }),
    next: () => step(1),
    prev: () => step(-1),
    markFailed: (station) => {
      const { list, failedInARow } = get();
      const i = list.findIndex((s) => s.id === station.id);
      const rest = list.filter((s) => s.id !== station.id);
      const failed = failedInARow + 1;
      if (rest.length === 0 || failed >= MAX_FAILED_IN_A_ROW) {
        set({ list: rest, failedInARow: failed, status: "error", current: null });
        return;
      }
      // After removal the station that followed `station` sits at its old index.
      const following = rest[(i === -1 ? 0 : i) % rest.length];
      set({ list: rest, failedInARow: failed, current: following, status: "loading" });
    },
    setGenre: (genre) => set({ genre }),
    setLanguage: (language) => set({ language }),
    setStatus: (status) =>
      set(status === "playing" ? { status, failedInARow: 0 } : { status }),
    toggleMute: () => set((s) => ({ muted: !s.muted })),
    setVolume: (v) => set({ volume: Math.min(1, Math.max(0, v)) }),
  };
});
