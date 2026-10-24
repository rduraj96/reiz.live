"use client";

import { useEffect, useRef } from "react";
import { DIAL_SLOTS } from "@/lib/dial/layout";
import { dropDead } from "@/lib/library/deadStations";
import type { Station } from "@/lib/radio/types";
import { useDial } from "@/store/dial";
import { usePlayer } from "@/store/player";

const MAX_IN_FLIGHT = 3;
/** The needle must rest this long on a band before new requests start. */
const SETTLE_MS = 140;

/**
 * Lazily loads the needle's band and its two neighbours, at most 3 requests at a time.
 * Mount once: the in-flight map is per instance.
 */
export function useDialBands() {
  const needleGenre = useDial((s) => s.needleGenre);
  const bands = useDial((s) => s.bands);
  const playerLanguage = usePlayer((s) => s.language);
  // genre|language -> controller, for requests in flight.
  const inFlight = useRef(new Map<string, AbortController>());
  const lastNeedle = useRef<string | null>(null);
  // The needle value that has rested for SETTLE_MS; re-runs for other reasons start immediately.
  const settledNeedle = useRef<string | null>(null);

  useEffect(() => {
    const dial = useDial.getState();

    if (playerLanguage !== dial.language) {
      // Late responses are also dropped by key, but abort so slots free up immediately.
      for (const c of inFlight.current.values()) c.abort();
      inFlight.current.clear();
      dial.resetForLanguage(playerLanguage);
      return; // the reset changes `bands`, which re-runs this effect
    }

    const start = () => {
      const entered = needleGenre !== lastNeedle.current;
      lastNeedle.current = needleGenre;
      if (needleGenre === null) return;
      const i = dial.bands.findIndex((b) => b.genre === needleGenre);
      if (i < 0) return;

      if (entered && dial.bands[i].state === "error") {
        dial.patchBand(needleGenre, { state: "idle" }); // re-runs via `bands`
        return;
      }

      const language = dial.language;
      // A reset can arrive without passing through the branch above (LanguageSwitch resets the dial
      // itself): drop requests for any other language so they don't hold the slots.
      for (const [key, c] of inFlight.current) {
        if (key.slice(key.indexOf("|") + 1) !== language) {
          c.abort();
          inFlight.current.delete(key);
        }
      }
      // Needle band first, then its neighbours; anything outside this window is simply not queued.
      const window = [i, i - 1, i + 1].filter(
        (k) => k >= 0 && k < dial.bands.length,
      );
      for (const k of window) {
        if (inFlight.current.size >= MAX_IN_FLIGHT) break;
        const band = dial.bands[k];
        const key = `${band.genre}|${language}`;
        if (band.state !== "idle" || inFlight.current.has(key)) continue;

        const controller = new AbortController();
        inFlight.current.set(key, controller);
        useDial.getState().patchBand(band.genre, { state: "loading" });
        void load(band.genre, language, controller.signal).then((result) => {
          if (inFlight.current.get(key) === controller)
            inFlight.current.delete(key);
          // Stale: the language changed while this was in flight (or we were aborted).
          if (
            controller.signal.aborted ||
            useDial.getState().language !== language
          )
            return;
          useDial.getState().patchBand(band.genre, result);
        });
      }
    };

    if (needleGenre === settledNeedle.current) {
      start();
      return;
    }
    const timer = setTimeout(() => {
      settledNeedle.current = needleGenre;
      start();
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [needleGenre, bands, playerLanguage]);

  useEffect(() => {
    const flights = inFlight.current;
    return () => {
      // Unmount: don't leave bands stuck in "loading".
      for (const [key, c] of flights) {
        c.abort();
        const [genre, language] = key.split("|");
        if (useDial.getState().language === language) {
          useDial.getState().patchBand(genre, { state: "idle" });
        }
      }
      flights.clear();
      lastNeedle.current = null;
      settledNeedle.current = null;
    };
  }, []);
}

type Result =
  { state: "ready" | "empty"; stations: Station[] } | { state: "error" };

async function load(
  genre: string,
  language: string,
  signal: AbortSignal,
): Promise<Result> {
  try {
    const params = new URLSearchParams({ genre, language });
    const res = await fetch(`/api/stations?${params}`, { signal });
    if (!res.ok) return { state: "error" };
    const body = (await res.json()) as Station[];
    // Stations that failed on this device in the last day stay off the dial (and so out of Shuffle).
    const list = Array.isArray(body) ? dropDead(body) : [];
    if (list.length === 0)
      return { state: "empty", stations: [] };
    return { state: "ready", stations: list.slice(0, DIAL_SLOTS) };
  } catch {
    return { state: "error" };
  }
}
