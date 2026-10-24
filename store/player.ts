import { create } from "zustand";
import type { Station } from "@/lib/radio/types";
import { useToast } from "@/store/toast";

export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "blocked" | "error";

const MAX_FAILED_IN_A_ROW = 5;

export type PanelTab = "browse" | "recent" | "saved";

type PlayerState = {
  /** The play queue: next/prev walk it. Whichever tab the last pick came from. */
  list: Station[];
  /** The genre + language list shown in Browse; only useStations replaces it. */
  genreList: Station[];
  current: Station | null;
  status: PlayerStatus;
  genre: string;
  language: string;
  muted: boolean;
  volume: number;
  failedInARow: number;
  /** Current station came from a share link and hasn't been loaded yet (autoplay is blocked until a tap). */
  primed: boolean;
  listError: string | null;
  panel: { open: boolean; tab: PanelTab };
};

type PlayerActions = {
  setList: (list: Station[]) => void;
  setGenreList: (genreList: Station[]) => void;
  prime: (station: Station) => void;
  select: (station: Station) => void;
  next: () => void;
  prev: () => void;
  markFailed: (station: Station) => void;
  reportFailure: (station: Station) => void;
  setGenre: (g: string) => void;
  setLanguage: (l: string) => void;
  setStatus: (s: PlayerStatus) => void;
  toggleMute: () => void;
  setVolume: (v: number) => void;
  setListError: (e: string | null) => void;
  openPanel: (tab: PanelTab) => void;
  closePanel: () => void;
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
    genreList: [],
    current: null,
    status: "idle",
    genre: "house",
    language: "english",
    muted: false,
    volume: 0.8,
    failedInARow: 0,
    primed: false,
    listError: null,
    panel: { open: false, tab: "browse" },

    setList: (list) => set({ list, failedInARow: 0 }),
    setGenreList: (genreList) => set({ genreList }),
    prime: (station) =>
      set({ list: [station], current: station, status: "blocked", primed: true, failedInARow: 0 }),
    select: (station) => {
      if (get().current?.id === station.id) return; // re-selecting the active station is a no-op
      set({ current: station, status: "loading", failedInARow: 0, primed: false });
    },
    next: () => step(1),
    prev: () => step(-1),
    markFailed: (station) => {
      const { list, genreList, failedInARow } = get();
      const i = list.findIndex((s) => s.id === station.id);
      if (i === -1) return; // already handled (e.g. duplicate failure report)
      const rest = list.filter((s) => s.id !== station.id);
      // A dead station disappears from Browse too.
      const browse = genreList.filter((s) => s.id !== station.id);
      const failed = failedInARow + 1;
      if (rest.length === 0 || failed >= MAX_FAILED_IN_A_ROW) {
        set({ list: rest, genreList: browse, failedInARow: failed, status: "error", current: null });
        return;
      }
      // After removal the station that followed `station` sits at its old index.
      const following = rest[i % rest.length];
      set({ list: rest, genreList: browse, failedInARow: failed, current: following, status: "loading", primed: false });
    },
    reportFailure: (station) => {
      const { list, current } = get();
      if (list.some((s) => s.id === station.id)) return get().markFailed(station);
      // The list changed since this station loaded: keep it as current so Play retries.
      if (current?.id === station.id) {
        set({ status: "idle" });
        useToast.getState().show("Couldn't play this station");
      }
    },
    setGenre: (genre) => set({ genre }),
    setLanguage: (language) => set({ language }),
    setStatus: (status) =>
      set(status === "playing" ? { status, failedInARow: 0 } : { status }),
    toggleMute: () => set((s) => ({ muted: !s.muted })),
    setVolume: (v) => set({ volume: Math.min(1, Math.max(0, v)) }),
    setListError: (listError) => set({ listError }),
    openPanel: (tab) => set({ panel: { open: true, tab } }),
    closePanel: () => set((s) => ({ panel: { ...s.panel, open: false } })),
  };
});
