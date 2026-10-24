import type { Station } from "@/lib/radio/types";
import type { PlayerStatus } from "@/store/player";

export type MediaActions = { play(): void; pause(): void; next(): void; prev(): void };

function playbackState(station: Station | null, status: PlayerStatus): MediaSessionPlaybackState {
  if (!station) return "none";
  return status === "playing" ? "playing" : "paused";
}

/** Mirrors the current station and status into the OS media controls (lock screen, media keys). */
export function syncMediaSession(
  station: Station | null,
  status: PlayerStatus,
  actions: MediaActions,
): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  const session = navigator.mediaSession;

  session.metadata = station
    ? new MediaMetadata({
        title: station.name,
        artist: [station.country, station.tags[0]].filter(Boolean).join(" · "),
        album: "REIZDIO",
        artwork: station.favicon
          ? [{ src: station.favicon }]
          : [{ src: "/icon-512.png", sizes: "512x512" }],
      })
    : null;
  session.playbackState = playbackState(station, status);

  session.setActionHandler("play", () => actions.play());
  session.setActionHandler("pause", () => actions.pause());
  session.setActionHandler("nexttrack", () => actions.next());
  session.setActionHandler("previoustrack", () => actions.prev());
}
