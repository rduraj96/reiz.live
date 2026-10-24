import type { Station } from "@/lib/radio/types";
import type { PlayerStatus } from "@/store/player";

export type MediaActions = { play(): void; pause(): void; next(): void; prev(): void };

function playbackState(station: Station | null, status: PlayerStatus): MediaSessionPlaybackState {
  if (!station) return "none";
  return status === "playing" ? "playing" : "paused";
}

const APP_ICON: MediaImage = { src: "/icon-512.png", sizes: "512x512" };

/**
 * MediaMetadata throws a TypeError for artwork URLs it cannot resolve (e.g. a favicon of "https://").
 * Try the favicon, then the app icon, then no artwork, so a bad favicon never blocks playback.
 */
function metadataFor(station: Station): MediaMetadata | null {
  const base = {
    title: station.name,
    artist: [station.country, station.tags[0]].filter(Boolean).join(" · "),
    album: "REIZDIO",
  };
  const artworks: (MediaImage[] | undefined)[] = [
    ...(station.favicon ? [[{ src: station.favicon }]] : []),
    [APP_ICON],
    undefined,
  ];
  for (const artwork of artworks) {
    try {
      return new MediaMetadata(artwork ? { ...base, artwork } : base);
    } catch {
      // Try the next fallback.
    }
  }
  return null;
}

/** Mirrors the current station and status into the OS media controls (lock screen, media keys). */
export function syncMediaSession(
  station: Station | null,
  status: PlayerStatus,
  actions: MediaActions,
): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  const session = navigator.mediaSession;

  session.metadata = station ? metadataFor(station) : null;
  session.playbackState = playbackState(station, status);

  const handlers: [MediaSessionAction, () => void][] = [
    ["play", () => actions.play()],
    ["pause", () => actions.pause()],
    ["nexttrack", () => actions.next()],
    ["previoustrack", () => actions.prev()],
  ];
  for (const [action, handler] of handlers) {
    try {
      session.setActionHandler(action, handler);
    } catch {
      // Unsupported action in this browser: the others still work.
    }
  }
}
