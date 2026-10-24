"use client";

import { useState } from "react";
import type { Station } from "@/lib/radio/types";
import { usePlayer } from "@/store/player";
import { useToast } from "@/store/toast";

export function SurpriseButton({ className }: { className?: string }) {
  const [busy, setBusy] = useState(false);

  async function surprise() {
    const { genre } = usePlayer.getState();
    const { show } = useToast.getState();
    setBusy(true);
    try {
      const res = await fetch(`/api/stations/random?genre=${encodeURIComponent(genre)}`);
      if (res.status === 404) return show("Nothing playable in this genre right now");
      if (!res.ok) return show("Radio directory unavailable");
      const station = (await res.json()) as Station;
      const { list, setList, select } = usePlayer.getState();
      // Keep the current genre list reachable via next/prev, with the surprise first.
      setList([station, ...list.filter((s) => s.id !== station.id)]);
      select(station);
    } catch {
      show("Radio directory unavailable");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={surprise} disabled={busy} className={className}>
      SURPRISE ME
    </button>
  );
}
