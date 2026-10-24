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

/** Station for a share link; null when unknown or when the directory is unreachable. */
export async function shareLinkStation(id: string): Promise<Station | null> {
  try {
    return await cachedById(id);
  } catch {
    return null;
  }
}
