"use client";

import { useEffect } from "react";
import { getAudioEngine } from "@/lib/audio/engine";
import { addRecent } from "@/lib/library/recents";
import { usePlayer } from "@/store/player";

/** Play/pause button behaviour, driven by the store's status. */
export function togglePlay() {
  const { status, current } = usePlayer.getState();
  const engine = getAudioEngine();
  if (status === "playing") engine.pause();
  else if (status === "paused" || status === "blocked") void engine.play();
  else if (current && status !== "loading") void engine.load(current);
}

/** The single place where store and audio engine are kept in sync. Mount once. */
export function useEngineBridge() {
  useEffect(() => {
    const engine = getAudioEngine();
    const store = usePlayer;
    const initial = store.getState();
    engine.setVolume(initial.volume);
    engine.setMuted(initial.muted);
    if (initial.current) void engine.load(initial.current);

    const offs = [
      engine.on("playing", (station) => {
        store.getState().setStatus("playing");
        addRecent(station);
      }),
      engine.on("paused", () => store.getState().setStatus("paused")),
      engine.on("blocked", () => store.getState().setStatus("blocked")),
      engine.on("failed", (station) => store.getState().reportFailure(station)),
    ];

    const unsubscribe = store.subscribe((state, prev) => {
      if (state.volume !== prev.volume) engine.setVolume(state.volume);
      if (state.muted !== prev.muted) engine.setMuted(state.muted);
      if (state.current && state.current !== prev.current) void engine.load(state.current);
    });

    return () => {
      unsubscribe();
      offs.forEach((off) => off());
    };
  }, []);
}
