// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { shareStation, shareUrl } from "@/lib/share";
import type { Station } from "@/lib/radio/types";

const station: Station = {
  id: "abc-123",
  name: "Alpha FM",
  streamUrl: "https://example.com/s",
  homepage: null,
  favicon: null,
  country: "Germany",
  countryCode: "DE",
  language: "english",
  tags: [],
  codec: "MP3",
  bitrate: 128,
};

function setNavigator(props: Record<string, unknown>) {
  for (const key of ["share", "clipboard"]) {
    Object.defineProperty(navigator, key, { value: props[key], configurable: true });
  }
}

afterEach(() => setNavigator({}));

describe("shareUrl", () => {
  it("builds /s/<id> on the default origin", () => {
    expect(shareUrl(station)).toBe("https://reiz.live/s/abc-123");
  });
  it("accepts another origin", () => {
    expect(shareUrl(station, "http://localhost:3000")).toBe("http://localhost:3000/s/abc-123");
  });
});

describe("shareStation", () => {
  const url = `${window.location.origin}/s/abc-123`;

  it("uses navigator.share when present", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator({ share });
    expect(await shareStation(station)).toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: "Alpha FM on REIZDIO", url });
  });

  it("treats a cancelled share as shared", async () => {
    setNavigator({ share: vi.fn().mockRejectedValue(new DOMException("x", "AbortError")) });
    expect(await shareStation(station)).toBe("shared");
  });

  it("copies to the clipboard without navigator.share", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator({ clipboard: { writeText } });
    expect(await shareStation(station)).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(url);
  });

  it("fails when the clipboard rejects", async () => {
    setNavigator({ clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    expect(await shareStation(station)).toBe("failed");
  });
});
