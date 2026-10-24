import "server-only";
import { cacheLife } from "next/cache";
import { byId } from "./client";
import type { Station } from "./types";

async function cachedById(id: string): Promise<Station | null> {
  "use cache";
  cacheLife("hours");
  // Throws on directory errors, which "use cache" does not cache.
  return byId(id);
}

/**
 * Station for a share link; null when unknown or when the lookup fails for any reason.
 * Errors crossing the "use cache" boundary lose their name and message in production,
 * so they cannot be told apart: every failure is logged and degrades to "not found".
 */
export async function shareLinkStation(id: string): Promise<Station | null> {
  try {
    return await cachedById(id);
  } catch (err) {
    console.error(`share link lookup failed for station ${id}`, err);
    return null;
  }
}
