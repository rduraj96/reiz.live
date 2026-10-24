import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RadioBrowserError,
  byId,
  byTag,
  countries,
  MIRRORS,
  normalize,
  resetMirrors,
  search,
} from "@/lib/radio/client";
import type { RawStation } from "@/lib/radio/types";

const BASE = "http://radio.test";

const raw: RawStation = {
  stationuuid: "abc-123",
  name: "Test FM",
  url_resolved: "https://stream.test/live",
  homepage: "https://test.fm",
  favicon: "https://test.fm/icon.png",
  country: "Germany",
  countrycode: "DE",
  language: "german",
  tags: "house, techno,, ,deep ",
  codec: "MP3",
  bitrate: 128,
};

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.RADIO_BROWSER_BASE = BASE;
  fetchMock = vi.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  delete process.env.RADIO_BROWSER_BASE;
});

describe("normalize", () => {
  it("maps ids, urls and splits tags", () => {
    const s = normalize(raw);
    expect(s.id).toBe("abc-123");
    expect(s.streamUrl).toBe("https://stream.test/live");
    expect(s.tags).toEqual(["house", "techno", "deep"]);
    expect(s.countryCode).toBe("DE");
    expect(s.bitrate).toBe(128);
  });

  it("turns empty favicon/homepage into null", () => {
    const s = normalize({ ...raw, favicon: "", homepage: "" });
    expect(s.favicon).toBeNull();
    expect(s.homepage).toBeNull();
  });

  it("handles empty tags", () => {
    expect(normalize({ ...raw, tags: "" }).tags).toEqual([]);
  });
});

describe("byTag", () => {
  it("builds the search URL and sends a User-Agent", async () => {
    fetchMock.mockResolvedValue(ok([raw]));
    const res = await byTag("house", "english");
    expect(res).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `${BASE}/json/stations/search?tag=house&language=english&order=votes&reverse=true&hidebroken=true&limit=150`,
    );
    expect(init.headers["User-Agent"]).toBe("reiz.live");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("omits language when null", async () => {
    fetchMock.mockResolvedValue(ok([]));
    await byTag("house", null);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${BASE}/json/stations/search?tag=house&order=votes&reverse=true&hidebroken=true&limit=150`,
    );
  });
});

describe("search", () => {
  it("uses name and countrycode", async () => {
    fetchMock.mockResolvedValue(ok([]));
    await search("jazz fm", "GB", 20);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${BASE}/json/stations/search?name=jazz+fm&countrycode=GB&order=votes&reverse=true&hidebroken=true&limit=20`,
    );
  });

  it("omits countrycode when null", async () => {
    fetchMock.mockResolvedValue(ok([]));
    await search("jazz", null);
    expect(fetchMock.mock.calls[0][0]).not.toContain("countrycode");
  });
});

describe("byId", () => {
  it("hits byuuid and returns a station", async () => {
    fetchMock.mockResolvedValue(ok([raw]));
    const s = await byId("abc-123");
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/json/stations/byuuid/abc-123`);
    expect(s?.id).toBe("abc-123");
  });

  it("returns null for an empty array", async () => {
    fetchMock.mockResolvedValue(ok([]));
    expect(await byId("nope")).toBeNull();
  });
});

describe("countries", () => {
  it("keeps stationcount >= 50 and sorts by name", async () => {
    fetchMock.mockResolvedValue(
      ok([
        { name: "Zambia", iso_3166_1: "ZM", stationcount: 80 },
        { name: "Tuvalu", iso_3166_1: "TV", stationcount: 49 },
        { name: "Albania", iso_3166_1: "AL", stationcount: 50 },
      ]),
    );
    expect(await countries()).toEqual([
      { code: "AL", name: "Albania" },
      { code: "ZM", name: "Zambia" },
    ]);
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/json/countries`);
  });
});

describe("errors", () => {
  it("throws RadioBrowserError on non-OK", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502 } as Response);
    await expect(byTag("house", null)).rejects.toBeInstanceOf(RadioBrowserError);
  });

  it("throws RadioBrowserError on fetch rejection", async () => {
    fetchMock.mockRejectedValue(new Error("boom"));
    await expect(countries()).rejects.toBeInstanceOf(RadioBrowserError);
  });
});

describe("mirror fallback", () => {
  const status = (code: number) => ({ ok: code < 400, status: code, json: async () => [] }) as Response;
  const hostOf = (call: unknown[]) => new URL(call[0] as string).host;

  beforeEach(() => {
    delete process.env.RADIO_BROWSER_BASE;
    resetMirrors();
  });

  it("lists de1, de2 and fi1", () => {
    expect(MIRRORS).toEqual([
      "https://de1.api.radio-browser.info",
      "https://de2.api.radio-browser.info",
      "https://fi1.api.radio-browser.info",
    ]);
  });

  it("moves to the next mirror on a 5xx and starts there next time", async () => {
    fetchMock.mockResolvedValueOnce(status(502)).mockResolvedValueOnce(ok([raw])).mockResolvedValueOnce(ok([raw]));
    await expect(byId("abc-123")).resolves.toMatchObject({ id: "abc-123" });
    expect(fetchMock.mock.calls.map(hostOf)).toEqual(["de1.api.radio-browser.info", "de2.api.radio-browser.info"]);
    await byId("abc-123");
    expect(hostOf(fetchMock.mock.calls[2])).toBe("de2.api.radio-browser.info");
  });

  it("moves on after a network error or timeout", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"))
      .mockResolvedValueOnce(ok([raw]));
    await expect(byId("abc-123")).resolves.toMatchObject({ id: "abc-123" });
    expect(fetchMock.mock.calls.map(hostOf)).toEqual([
      "de1.api.radio-browser.info",
      "de2.api.radio-browser.info",
      "fi1.api.radio-browser.info",
    ]);
  });

  it("treats a 4xx as final", async () => {
    fetchMock.mockResolvedValue(status(404));
    await expect(byId("abc-123")).rejects.toBeInstanceOf(RadioBrowserError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws once every mirror has failed", async () => {
    fetchMock.mockResolvedValue(status(503));
    await expect(byId("abc-123")).rejects.toThrow("Radio Browser responded 503");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("RADIO_BROWSER_BASE pins a single server", async () => {
    process.env.RADIO_BROWSER_BASE = BASE;
    fetchMock.mockResolvedValue(status(503));
    await expect(byId("abc-123")).rejects.toBeInstanceOf(RadioBrowserError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toMatch(/^http:\/\/radio\.test\//);
  });
});
