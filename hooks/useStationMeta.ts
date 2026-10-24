"use client";

import { useEffect, useState } from "react";
import { tunerApi } from "@/components/Tuner";
import { useDial } from "@/store/dial";
import { usePlayer } from "@/store/player";

export type StationMeta = {
  id: string;
  name: string;
  /** Dial frequency ("98.3"), or null off the dial / before the layout exists. */
  freq: string | null;
  /** On the dial, the band it sits in; off it (shared, searched), its first tag. Uppercase. */
  genre: string | undefined;
  /** Uppercase country code. */
  cc: string;
};

/**
 * The dial frequency of `id`, re-read when the bands (and so the dial layout) change. Read after commit: the
 * Tuner syncs its layout in a layout effect, so reading during render would see the previous layout.
 */
export function useFrequency(id: string | null): string | null {
  const bands = useDial((s) => s.bands);
  const [read, setRead] = useState<{ id: string; freq: string | null } | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the layout lives in the Tuner's ref, not in state
    setRead(id ? { id, freq: tunerApi.frequencyOf(id) } : null);
  }, [id, bands]);
  return read && read.id === id ? read.freq : null;
}

/** What the readout says about the current station: name, frequency, genre and country. */
export function useStationMeta(): StationMeta | null {
  const current = usePlayer((s) => s.current);
  // bandLabelOf reads the dial's bands: subscribe so a band change re-renders.
  useDial((s) => s.bands);
  const freq = useFrequency(current?.id ?? null);
  if (!current) return null;
  return {
    id: current.id,
    name: current.name,
    freq,
    genre: (tunerApi.bandLabelOf(current.id) ?? current.tags[0])?.toUpperCase(),
    cc: current.countryCode.toUpperCase(),
  };
}
