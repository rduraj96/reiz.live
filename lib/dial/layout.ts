import type { Station } from "@/lib/radio/types";

export type BandState = "idle" | "loading" | "ready" | "empty" | "error";
export type DialBand = { genre: string; label: string; state: BandState; stations: Station[] };
export type DialLayout = {
  bands: { genre: string; label: string; start: number; end: number; state: BandState }[];
  ticks: { x: number; stationId: string | null; band: string }[];
  width: number;
};

export const DIAL_SLOTS = 12;
export const STATION_GAP = 72;
export const BAND_GAP = 60;
export const OFF_DIAL_GENRE = "__offdial";

const FREQ_MIN = 87.5;
const FREQ_MAX = 108.0;

export function buildLayout(
  bands: DialBand[],
  offDial?: { station: Station; label: string },
): DialLayout {
  const all: (DialBand & { slots: number })[] = [];
  if (offDial) {
    all.push({
      genre: OFF_DIAL_GENRE,
      label: offDial.label,
      state: "ready",
      stations: [offDial.station],
      slots: 1,
    });
  }
  for (const b of bands) all.push({ ...b, slots: DIAL_SLOTS });

  const out: DialLayout = { bands: [], ticks: [], width: 0 };
  let start = 0;
  for (const b of all) {
    const ready = b.state === "ready";
    for (let k = 0; k < b.slots; k++) {
      out.ticks.push({
        x: start + k * STATION_GAP,
        stationId: ready ? (b.stations[k]?.id ?? null) : null,
        band: b.genre,
      });
    }
    const end = start + (b.slots - 1) * STATION_GAP;
    out.bands.push({ genre: b.genre, label: b.label, start, end, state: b.state });
    out.width = end;
    start += b.slots * STATION_GAP + BAND_GAP;
  }
  return out;
}

export function nearestStation(
  layout: DialLayout,
  x: number,
): { stationId: string; x: number } | null {
  let best: { stationId: string; x: number } | null = null;
  for (const t of layout.ticks) {
    if (t.stationId === null) continue;
    if (best === null || Math.abs(t.x - x) < Math.abs(best.x - x)) {
      best = { stationId: t.stationId, x: t.x };
    }
  }
  return best;
}

export function positionOf(layout: DialLayout, id: string): number | null {
  return layout.ticks.find((t) => t.stationId === id)?.x ?? null;
}

export function bandAt(layout: DialLayout, x: number): string | null {
  return layout.bands.find((b) => x >= b.start && x <= b.end)?.genre ?? null;
}

/** Frequencies span the genre-band slots only; the off-dial slot has none, so a station keeps its number when it comes or goes. */
export function frequencyOf(layout: DialLayout, id: string): string | null {
  const genre = layout.ticks.filter((t) => t.band !== OFF_DIAL_GENRE);
  const i = genre.findIndex((t) => t.stationId === id);
  if (i < 0) return null;
  const n = genre.length;
  if (n === 1) return FREQ_MIN.toFixed(1);
  return (FREQ_MIN + ((FREQ_MAX - FREQ_MIN) * i) / (n - 1)).toFixed(1);
}
