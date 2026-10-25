import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Station } from "@/lib/radio/types";

const { byTag, search, byId, countries, playableOnly, RadioBrowserError } = vi.hoisted(() => {
  class RadioBrowserError extends Error {}
  return {
    byTag: vi.fn(),
    search: vi.fn(),
    byId: vi.fn(),
    countries: vi.fn(),
    playableOnly: vi.fn(),
    RadioBrowserError,
  };
});

vi.mock("@/lib/radio/client", () => ({ byTag, search, byId, countries, RadioBrowserError }));
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  connection: async () => {},
}));
vi.mock("@/lib/radio/verify", () => ({ playableOnly }));

import { GET as list } from "@/app/api/stations/route";
import { GET as searchRoute } from "@/app/api/stations/search/route";
import { GET as random } from "@/app/api/stations/random/route";
import { GET as byIdRoute } from "@/app/api/stations/[id]/route";
import { GET as countriesRoute } from "@/app/api/countries/route";

const CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

function st(id: string): Station {
  return {
    id,
    name: id,
    streamUrl: `https://example.com/${id}`,
    homepage: null,
    favicon: null,
    country: "",
    countryCode: "",
    language: "",
    tags: [],
    codec: "MP3",
    bitrate: 128,
  };
}

const req = (path: string) => new NextRequest(`http://localhost${path}`);

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/stations", () => {
  it("returns stations for genre and language with cache header", async () => {
    byTag.mockResolvedValue([st("a"), st("b")]);
    playableOnly.mockResolvedValue([st("b")]);
    const res = await list(req("/api/stations?genre=house&language=english"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([st("b")]);
    expect(byTag).toHaveBeenCalledWith("house", "english");
    expect(playableOnly).toHaveBeenCalledWith([st("a"), st("b")], 50, 24); // answers once 24 have passed
    expect(res.headers.get("Cache-Control")).toBe(CACHE);
  });

  it("treats language=any and missing language as null", async () => {
    byTag.mockResolvedValue([]);
    playableOnly.mockResolvedValue([]);
    await list(req("/api/stations?genre=house&language=any"));
    expect(byTag).toHaveBeenLastCalledWith("house", null);
    await list(req("/api/stations?genre=house"));
    expect(byTag).toHaveBeenLastCalledWith("house", null);
  });

  it("400s without genre", async () => {
    const res = await list(req("/api/stations"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "genre is required" });
  });

  it("maps RadioBrowserError to 502", async () => {
    byTag.mockRejectedValue(new RadioBrowserError("down"));
    const res = await list(req("/api/stations?genre=house"));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Radio directory unavailable" });
  });

  it("does not swallow other errors", async () => {
    byTag.mockRejectedValue(new TypeError("boom"));
    await expect(list(req("/api/stations?genre=house"))).rejects.toThrow("boom");
  });
});

describe("GET /api/stations/search", () => {
  it("searches by name and country", async () => {
    search.mockResolvedValue([st("a"), st("b")]);
    playableOnly.mockResolvedValue([st("b")]);
    const res = await searchRoute(req("/api/stations/search?q=jazz&country=FR"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([st("b")]);
    expect(playableOnly).toHaveBeenCalledWith([st("a"), st("b")]);
    expect(search).toHaveBeenCalledWith("jazz", "FR");
    expect(res.headers.get("Cache-Control")).toBe(CACHE);
  });

  it("passes null country when absent", async () => {
    search.mockResolvedValue([]);
    playableOnly.mockResolvedValue([]);
    await searchRoute(req("/api/stations/search?q=jazz"));
    expect(search).toHaveBeenCalledWith("jazz", null);
  });

  it("400s when q is shorter than 2 chars or missing", async () => {
    expect((await searchRoute(req("/api/stations/search?q=a"))).status).toBe(400);
    expect((await searchRoute(req("/api/stations/search"))).status).toBe(400);
    expect(search).not.toHaveBeenCalled();
  });

  it("maps RadioBrowserError to 502", async () => {
    search.mockRejectedValue(new RadioBrowserError("down"));
    const res = await searchRoute(req("/api/stations/search?q=jazz"));
    expect(res.status).toBe(502);
  });
});

describe("GET /api/stations/random", () => {
  it("picks from playable stations using Math.random", async () => {
    const all = [st("a"), st("b"), st("c")];
    byTag.mockResolvedValue(all);
    playableOnly.mockResolvedValue([st("b"), st("c")]);
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const res = await random(req("/api/stations/random?genre=house"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(st("c"));
    expect(byTag).toHaveBeenCalledWith("house", null);
    expect(playableOnly).toHaveBeenCalledWith(all);
  });

  it("404s when none playable", async () => {
    byTag.mockResolvedValue([st("a")]);
    playableOnly.mockResolvedValue([]);
    const res = await random(req("/api/stations/random?genre=house"));
    expect(res.status).toBe(404);
  });

  it("400s without genre", async () => {
    const res = await random(req("/api/stations/random"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "genre is required" });
  });

  it("maps RadioBrowserError to 502", async () => {
    byTag.mockRejectedValue(new RadioBrowserError("down"));
    const res = await random(req("/api/stations/random?genre=house"));
    expect(res.status).toBe(502);
  });
});

describe("GET /api/stations/:id", () => {
  const call = (id: string) => byIdRoute(req(`/api/stations/${id}`), { params: Promise.resolve({ id }) });

  it("returns the station without verifying it", async () => {
    byId.mockResolvedValue(st("x"));
    const res = await call("x");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(st("x"));
    expect(playableOnly).not.toHaveBeenCalled();
  });

  it("404s when unknown", async () => {
    byId.mockResolvedValue(null);
    expect((await call("nope")).status).toBe(404);
  });

  it("maps RadioBrowserError to 502", async () => {
    byId.mockRejectedValue(new RadioBrowserError("down"));
    expect((await call("x")).status).toBe(502);
  });
});

describe("GET /api/countries", () => {
  it("returns countries with cache header", async () => {
    countries.mockResolvedValue([{ code: "FR", name: "France" }]);
    const res = await countriesRoute();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ code: "FR", name: "France" }]);
    expect(res.headers.get("Cache-Control")).toBe(CACHE);
  });

  it("maps RadioBrowserError to 502", async () => {
    countries.mockRejectedValue(new RadioBrowserError("down"));
    expect((await countriesRoute()).status).toBe(502);
  });
});
