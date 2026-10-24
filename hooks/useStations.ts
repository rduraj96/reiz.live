"use client";

import { useCallback, useEffect, useState } from "react";
import type { Station } from "@/lib/radio/types";
import { usePlayer } from "@/store/player";

const UNAVAILABLE = "Radio directory unavailable";

/** Fetches the station list for the selected genre + language and feeds the store. */
export function useStations() {
  const genre = usePlayer((s) => s.genre);
  const language = usePlayer((s) => s.language);
  const [attempt, setAttempt] = useState(0);
  // The key of the last request that settled; loading = the current key hasn't settled yet.
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const key = `${genre}|${language}|${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    const { setList, setGenreList, setListError } = usePlayer.getState();
    const params = new URLSearchParams({ genre, language });

    fetch(`/api/stations?${params}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? UNAVAILABLE);
        }
        return (await res.json()) as Station[];
      })
      .then((list) => {
        setListError(null);
        setGenreList(list);
        setList(list);
        // A fresh list (e.g. after Retry) clears the "nothing played" state.
        if (usePlayer.getState().status === "error") usePlayer.getState().setStatus("idle");
        setSettledKey(key);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setGenreList([]);
        setList([]);
        setListError(err instanceof Error ? err.message : UNAVAILABLE);
        setSettledKey(key);
      });

    return () => controller.abort();
  }, [genre, language, key]);

  const retry = useCallback(() => {
    usePlayer.getState().setListError(null);
    setAttempt((n) => n + 1);
  }, []);

  return { loading: settledKey !== key, retry };
}
