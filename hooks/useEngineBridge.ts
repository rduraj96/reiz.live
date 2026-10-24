"use client";

import { useEffect } from "react";
import { getAudioEngine } from "@/lib/audio/engine";
import { syncMediaSession } from "@/lib/audio/mediaSession";
import { recordDead } from "@/lib/library/deadStations";
import { addRecent } from "@/lib/library/recents";
import { usePlayer } from "@/store/player";

/** Play/pause button behaviour, driven by the store's status. */
export function togglePlay() {
  const { status, current, primed } = usePlayer.getState();
  const engine = getAudioEngine();
  if (primed && current) {
    // Share-link station: nothing is loaded yet, so the first tap loads it.
    usePlayer.setState({ primed: false, status: "loading" });
    void engine.load(current);
    return;
  }
  if (status === "playing") engine.pause();
  else if (status === "paused" || status === "blocked") void engine.play();
  else if (current && status !== "loading") void engine.load(current);
}

const mediaActions = {
  play: togglePlay,
  pause: () => getAudioEngine().pause(),
  next: () => usePlayer.getState().next(),
  prev: () => usePlayer.getState().prev(),
};

function syncFromStore() {
  const { current, status, nowPlaying } = usePlayer.getState();
  syncMediaSession(current, status, mediaActions, nowPlaying);
}

/** The single place where store and audio engine are kept in sync. Mount once. */
export function useEngineBridge() {
  useEffect(() => {
    const engine = getAudioEngine();
    const store = usePlayer;
    const initial = store.getState();
    engine.setVolume(initial.volume);
    engine.setTuning(initial.tuning);
    if (initial.current && !initial.primed) void engine.load(initial.current);

    const offs = [
      engine.on("playing", (station) => {
        store.getState().setStatus("playing");
        addRecent(station);
      }),
      engine.on("paused", () => store.getState().setStatus("paused")),
      engine.on("blocked", () => store.getState().setStatus("blocked")),
      engine.on("failed", (station) => {
        recordDead(station.id);
        store.getState().reportFailure(station);
      }),
    ];

    syncFromStore();
    const unsubscribe = store.subscribe((state, prev) => {
      // Load first: nothing in the media-session sync may stand between a pick and playback.
      if (state.current && state.current !== prev.current && !state.primed) void engine.load(state.current);
      if (state.volume !== prev.volume) engine.setVolume(state.volume);
      if (state.tuning !== prev.tuning) engine.setTuning(state.tuning);
      if (state.current !== prev.current || state.status !== prev.status || state.nowPlaying !== prev.nowPlaying) {
        syncFromStore();
      }
    });

    return () => {
      unsubscribe();
      offs.forEach((off) => off());
    };
  }, []);
}
