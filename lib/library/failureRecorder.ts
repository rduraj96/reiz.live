import { recordDead } from "./deadStations";

/**
 * Decides which failures mean a station is dead: only a load that never reached `playing`, and only while the
 * device is online. A station that played and then dropped (a stall, the listener's own connection) is kept.
 */
export function createFailureRecorder(
  deps: { record?: (id: string) => void; online?: () => boolean } = {},
) {
  const record = deps.record ?? ((id: string) => recordDead(id));
  const online = deps.online ?? (() => typeof navigator === "undefined" || navigator.onLine !== false);
  let played: string | null = null;
  return {
    /** A new load starts: whatever played before doesn't count for it. */
    loaded() {
      played = null;
    },
    playing(id: string) {
      played = id;
    },
    failed(id: string) {
      if (played !== id && online()) record(id);
    },
  };
}
