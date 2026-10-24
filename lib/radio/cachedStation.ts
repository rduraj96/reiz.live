import "server-only";
import { cacheLife } from "next/cache";
import { RadioBrowserError, byId } from "./client";
import type { Station } from "./types";

async function cachedById(id: string): Promise<Station | null> {
  "use cache";
  cacheLife("hours");
  // Throws on directory errors, which "use cache" does not cache.
  return byId(id);
}

/**
 * Station for a share link; null when unknown or when the directory is unreachable.
 * Directory errors are logged and mapped to null; anything else is a bug and rethrown.
 */
export async function shareLinkStation(id: string): Promise<Station | null> {
  try {
    return await cachedById(id);
  } catch (err) {
    console.error(`share link lookup failed for station ${id}`, err);
    // Name check as well: instanceof may not survive the "use cache" boundary.
    if (err instanceof RadioBrowserError || (err instanceof Error && err.name === "RadioBrowserError")) {
      return null;
    }
    throw err;
  }
}
