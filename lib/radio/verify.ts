import "server-only";
import type { Station } from "./types";

const TIMEOUT_MS = 2000;
const TTL_MS = 24 * 60 * 60 * 1000;

const cache = new Map<string, { ok: boolean; at: number }>();

/** Clears the verdict cache. Tests only. */
export function __resetVerifyCache(): void {
  cache.clear();
}

async function probe(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Origin: "https://reiz.live", Range: "bytes=0-1" },
      signal: controller.signal,
    });
    const ok = res.headers.has("access-control-allow-origin");
    void res.body?.cancel();
    return ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** True iff the stream is https and answers with a CORS allow-origin header. */
export async function verifyStream(url: string): Promise<boolean> {
  if (!url.startsWith("https:")) return false;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at <= TTL_MS) return hit.ok;
  const ok = await probe(url);
  cache.set(url, { ok, at: Date.now() });
  return ok;
}

/**
 * Verifies all stations concurrently; returns up to `max` passing ones in input order. With `enough`, it answers
 * as soon as that many have passed instead of waiting for the slowest streams to time out.
 */
export function playableOnly(stations: Station[], max = 50, enough = Infinity): Promise<Station[]> {
  return new Promise((resolve) => {
    const passed = new Array<boolean>(stations.length).fill(false);
    let settled = 0;
    let count = 0;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(stations.filter((_, i) => passed[i]).slice(0, max));
    };
    if (stations.length === 0) return finish();
    stations.forEach((s, i) =>
      verifyStream(s.streamUrl).then((ok) => {
        passed[i] = ok;
        if (ok && ++count >= enough) finish();
        if (++settled === stations.length) finish();
      }),
    );
  });
}
