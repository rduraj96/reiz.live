/** Stations that failed to play on this device, hidden from the dial for a day. */

const KEY = "reizdio:dead";
export const DEAD_TTL_MS = 24 * 60 * 60 * 1000;
const MAX = 200;

type Dead = Record<string, number>;

function read(now: number): Dead {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (typeof data !== "object" || data === null) return {};
    const fresh: Dead = {};
    for (const [id, at] of Object.entries(data)) {
      if (typeof at === "number" && now - at <= DEAD_TTL_MS) fresh[id] = at;
    }
    return fresh;
  } catch {
    return {};
  }
}

export function recordDead(id: string, now = Date.now()): void {
  const dead = read(now);
  dead[id] = now;
  const kept = Object.entries(dead)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    // Private mode or blocked storage: nothing is remembered.
  }
}

export function isDead(id: string, now = Date.now()): boolean {
  return id in read(now);
}

export function dropDead<T extends { id: string }>(list: T[], now = Date.now()): T[] {
  const dead = read(now);
  return list.filter((s) => !(s.id in dead));
}
