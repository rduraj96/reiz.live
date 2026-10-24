import type { Station } from "@/lib/radio/types";

export const shareUrl = (station: Station, origin = "https://reiz.live"): string =>
  `${origin}/s/${station.id}`;

/** Native share sheet when available, clipboard otherwise. A cancelled share still counts as shared. */
export async function shareStation(station: Station): Promise<"shared" | "copied" | "failed"> {
  const url = shareUrl(station, window.location.origin);
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: `${station.name} on REIZDIO`, url });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "shared";
      return "failed";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}
