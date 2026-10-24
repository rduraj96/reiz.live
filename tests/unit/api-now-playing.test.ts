import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Station } from "@/lib/radio/types";

const { byId, readIcyTitle, RadioBrowserError } = vi.hoisted(() => {
  class RadioBrowserError extends Error {}
  return { byId: vi.fn(), readIcyTitle: vi.fn(), RadioBrowserError };
});
vi.mock("@/lib/radio/client", () => ({ byId, RadioBrowserError }));
vi.mock("@/lib/radio/icy", async (orig) => ({ ...(await orig<typeof import("@/lib/radio/icy")>()), readIcyTitle }));

import { GET } from "@/app/api/now-playing/route";

const ID = "9617a958-0601-11e8-ae97-52543be04c81";
const station = (streamUrl = "https://radio.example/live", name = "Jazz FM"): Station => ({
  id: ID,
  name,
  streamUrl,
  homepage: null,
  favicon: null,
  country: "",
  countryCode: "",
  language: "",
  tags: [],
  codec: "MP3",
  bitrate: 128,
});
const get = (id: string | null) =>
  GET(new NextRequest(`http://localhost/api/now-playing${id === null ? "" : `?id=${encodeURIComponent(id)}`}`));

beforeEach(() => {
  byId.mockReset();
  readIcyTitle.mockReset();
});

describe("GET /api/now-playing", () => {
  it("returns the stream's current title, cached briefly", async () => {
    byId.mockResolvedValue(station());
    readIcyTitle.mockResolvedValue("Miles Davis - So What");
    const res = await get(ID);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ title: "Miles Davis - So What" });
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=15, stale-while-revalidate=30");
    expect(readIcyTitle).toHaveBeenCalledWith("https://radio.example/live");
  });

  it("rejects a missing or malformed id without touching the directory", async () => {
    expect((await get(null)).status).toBe(400);
    expect((await get("https://evil.example/")).status).toBe(400);
    expect(byId).not.toHaveBeenCalled();
  });

  it("404s an unknown station", async () => {
    byId.mockResolvedValue(null);
    expect((await get(ID)).status).toBe(404);
  });

  it("never reads a stream on a private or loopback host", async () => {
    byId.mockResolvedValue(station("http://169.254.169.254/latest"));
    expect(await (await get(ID)).json()).toEqual({ title: null });
    expect(readIcyTitle).not.toHaveBeenCalled();
  });

  it("hides a title that just repeats the station name", async () => {
    byId.mockResolvedValue(station(undefined, "Jazz FM"));
    readIcyTitle.mockResolvedValue("jazz fm");
    expect(await (await get(ID)).json()).toEqual({ title: null });
  });

  it("502s when the directory is down", async () => {
    byId.mockRejectedValue(new RadioBrowserError("down"));
    expect((await get(ID)).status).toBe(502);
  });
});
