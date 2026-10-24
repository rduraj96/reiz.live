"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePlayer } from "@/store/player";

export const NOW_PLAYING_POLL_MS = 20_000;

const subscribeVisibility = (cb: () => void) => {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
};

/**
 * Keeps `nowPlaying` in the player store: asks /api/now-playing for the current station's song now and every 20 s,
 * only while it plays and the page is visible. Mount once.
 */
export function useNowPlaying() {
  const id = usePlayer((s) => s.current?.id ?? null);
  const playing = usePlayer((s) => s.status === "playing");
  const visible = useSyncExternalStore(subscribeVisibility, () => !document.hidden, () => false);

  // A new station's song isn't known yet.
  useEffect(() => usePlayer.getState().setNowPlaying(null), [id]);

  useEffect(() => {
    if (!id || !playing || !visible) return;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const res = await fetch(`/api/now-playing?id=${encodeURIComponent(id)}`, { signal: controller.signal });
        if (!res.ok) return;
        const { title } = (await res.json()) as { title: string | null };
        // A late answer for a station we've already left is dropped.
        if (!controller.signal.aborted) usePlayer.getState().setNowPlaying(title ?? null);
      } catch {
        // Offline or aborted: keep whatever was shown.
      }
    };
    void poll();
    const timer = setInterval(poll, NOW_PLAYING_POLL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [id, playing, visible]);
}
