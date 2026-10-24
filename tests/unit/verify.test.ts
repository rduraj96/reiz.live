import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetVerifyCache, playableOnly, verifyStream } from "@/lib/radio/verify";
import type { Station } from "@/lib/radio/types";

const HOUR = 60 * 60 * 1000;

function res(headers: Record<string, string> = {}) {
  return { headers: new Headers(headers), body: { cancel: vi.fn() } } as unknown as Response;
}

function station(id: string, streamUrl: string): Station {
  return {
    id,
    name: id,
    streamUrl,
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

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  __resetVerifyCache();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("verifyStream", () => {
  it("rejects http: URLs without fetching", async () => {
    expect(await verifyStream("http://a.example/s")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts a response with access-control-allow-origin", async () => {
    fetchMock.mockResolvedValue(res({ "access-control-allow-origin": "*" }));
    expect(await verifyStream("https://a.example/s")).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://a.example/s",
      expect.objectContaining({
        method: "GET",
        headers: { Origin: "https://reiz.live", Range: "bytes=0-1" },
      }),
    );
  });

  it("rejects a response without the header", async () => {
    fetchMock.mockResolvedValue(res());
    expect(await verifyStream("https://a.example/s")).toBe(false);
  });

  it("returns false after 3000 ms when fetch never resolves", async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const p = verifyStream("https://a.example/s");
    await vi.advanceTimersByTimeAsync(2999);
    let settled = false;
    void p.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toBe(false);
  });

  it("returns false when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new Error("boom"));
    expect(await verifyStream("https://a.example/s")).toBe(false);
  });

  it("caches the verdict for 24 h, then refetches", async () => {
    fetchMock.mockResolvedValue(res({ "access-control-allow-origin": "*" }));
    await verifyStream("https://a.example/s");
    await verifyStream("https://a.example/s");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(24 * HOUR + 1);
    await verifyStream("https://a.example/s");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("playableOnly", () => {
  it("keeps passing stations in original order", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("good") ? res({ "access-control-allow-origin": "*" }) : res(),
    );
    const input = [
      station("1", "https://good1.example/s"),
      station("2", "https://bad2.example/s"),
      station("3", "https://good3.example/s"),
      station("4", "http://good4.example/s"),
    ];
    const out = await playableOnly(input);
    expect(out.map((s) => s.id)).toEqual(["1", "3"]);
  });

  it("caps the result at 50", async () => {
    fetchMock.mockImplementation(async () => res({ "access-control-allow-origin": "*" }));
    const input = Array.from({ length: 60 }, (_, i) => station(String(i), `https://h${i}.example/s`));
    const out = await playableOnly(input);
    expect(out).toHaveLength(50);
    expect(out[0].id).toBe("0");
  });

  it("returns [] when all fail", async () => {
    fetchMock.mockRejectedValue(new Error("x"));
    const input = [station("1", "https://a.example/s"), station("2", "https://b.example/s")];
    expect(await playableOnly(input)).toEqual([]);
  });
});
