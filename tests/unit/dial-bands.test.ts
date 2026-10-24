import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDialBands } from "@/hooks/useDialBands";
import { genres } from "@/lib/catalog";
import type { Station } from "@/lib/radio/types";
import { useDial } from "@/store/dial";
import { usePlayer } from "@/store/player";

const st = (id: string): Station => ({
  id,
  name: id,
  streamUrl: "https://x/" + id,
  homepage: null,
  favicon: null,
  country: "Germany",
  countryCode: "DE",
  language: "english",
  tags: [],
  codec: "MP3",
  bitrate: 128,
});
const many = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => st(`${prefix}${i}`));

type Pending = { genre: string; language: string; resolve: (r: Response) => void };
let pending: Pending[] = [];
let maxConcurrent = 0;
let concurrent = 0;
let requested: string[] = [];

const respond = (p: Pending, body: unknown, status = 200) => {
  concurrent--;
  p.resolve({ ok: status < 400, status, json: async () => body } as Response);
};
const g = (i: number) => genres[i].value;
const take = (genre: string) => pending.find((p) => p.genre === genre)!;
const band = (genre: string) => useDial.getState().bands.find((b) => b.genre === genre)!;

beforeEach(() => {
  pending = [];
  requested = [];
  maxConcurrent = 0;
  concurrent = 0;
  useDial.setState(useDial.getInitialState(), true);
  usePlayer.setState(usePlayer.getInitialState(), true);
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      const q = new URL(url, "http://x").searchParams;
      const genre = q.get("genre")!;
      const language = q.get("language")!;
      requested.push(genre);
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      return new Promise<Response>((resolve) => pending.push({ genre, language, resolve }));
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useDialBands", () => {
  it("requests the needle band and its two neighbours", async () => {
    useDial.setState({ needleGenre: g(5) });
    renderHook(() => useDialBands());
    await waitFor(() => expect(requested.length).toBe(3));
    expect([...requested].sort()).toEqual([g(4), g(5), g(6)].sort());
  });

  it("moving the needle requests the new window, never more than 3 in flight", async () => {
    useDial.setState({ needleGenre: g(5) });
    renderHook(() => useDialBands());
    await waitFor(() => expect(requested.length).toBe(3));
    act(() => useDial.getState().setNeedleGenre(g(9)));
    // 3 still in flight: nothing new until one finishes.
    expect(requested.length).toBe(3);
    await act(async () => respond(take(g(5)), many("a", 3)));
    await waitFor(() => expect(requested).toContain(g(9)));
    await act(async () => respond(take(g(4)), many("a", 3)));
    await act(async () => respond(take(g(6)), many("a", 3)));
    await waitFor(() => expect(requested.length).toBe(6));
    expect(requested.slice(3).sort()).toEqual([g(8), g(9), g(10)].sort());
    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });

  it("only requests bands the needle settles on, not ones it passes through", async () => {
    vi.useFakeTimers();
    try {
      renderHook(() => useDialBands());
      for (let k = 0; k <= 10; k++) {
        act(() => useDial.getState().setNeedleGenre(g(k)));
        await act(async () => {
          await vi.advanceTimersByTimeAsync(20);
        });
      }
      expect(requested).toEqual([]);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      expect([...requested].sort()).toEqual([g(9), g(10), g(11)].sort());
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the first 12 stations and marks the band ready", async () => {
    useDial.setState({ needleGenre: g(0) });
    renderHook(() => useDialBands());
    await waitFor(() => expect(requested).toContain(g(0)));
    await act(async () => respond(take(g(0)), many("s", 20)));
    expect(band(g(0)).state).toBe("ready");
    expect(band(g(0)).stations).toHaveLength(12);
  });

  it("marks a 502 as error and retries when the needle re-enters", async () => {
    useDial.setState({ needleGenre: g(5) });
    renderHook(() => useDialBands());
    await waitFor(() => expect(requested.length).toBe(3));
    await act(async () => respond(take(g(5)), { error: "down" }, 502));
    expect(band(g(5)).state).toBe("error");
    for (const k of [4, 6]) await act(async () => respond(take(g(k)), []));
    expect(band(g(4)).state).toBe("empty");
    expect(requested.filter((x) => x === g(5))).toHaveLength(1);
    act(() => useDial.getState().setNeedleGenre(g(9)));
    await waitFor(() => expect(requested.length).toBe(6));
    // Free the 3 slots so re-entering band 5 can start a request.
    for (const k of [8, 9, 10]) await act(async () => respond(take(g(k)), many("b", 2)));
    act(() => useDial.getState().setNeedleGenre(g(5)));
    await waitFor(() => expect(requested.filter((x) => x === g(5))).toHaveLength(2));
  });

  it("retryAll re-requests error bands", async () => {
    useDial.setState({ needleGenre: g(0) });
    renderHook(() => useDialBands());
    await waitFor(() => expect(requested).toContain(g(0)));
    await act(async () => respond(take(g(0)), {}, 502));
    expect(band(g(0)).state).toBe("error");
    act(() => useDial.getState().retryAll());
    await waitFor(() => expect(requested.filter((x) => x === g(0))).toHaveLength(2));
  });

  it("Review Focus 2: a stale english response never fills a band after a language switch", async () => {
    useDial.setState({ needleGenre: g(5) });
    renderHook(() => useDialBands());
    await waitFor(() => expect(requested.length).toBe(3));
    const stale = take(g(5));
    expect(stale.language).toBe("any");
    act(() => usePlayer.setState({ language: "german" }));
    await waitFor(() => expect(useDial.getState().language).toBe("german"));
    await act(async () => respond(stale, many("en", 5)));
    expect(band(g(5)).state).not.toBe("ready");
    expect(band(g(5)).stations).toEqual([]);
    // The new language's request for the same genre is separate and fills it.
    await waitFor(() => expect(pending.some((p) => p.language === "german" && p.genre === g(5))).toBe(true));
    const fresh = pending.find((p) => p.language === "german" && p.genre === g(5))!;
    await act(async () => respond(fresh, many("de", 2)));
    expect(band(g(5)).stations[0].id).toBe("de0");
  });

  it("a language switch from the UI (setLanguage + resetForLanguage) with 3 requests pending loads the new language", async () => {
    useDial.setState({ needleGenre: g(5) });
    renderHook(() => useDialBands());
    await waitFor(() => expect(requested.length).toBe(3));
    // Exactly what LanguageSwitch.choose() does.
    act(() => {
      usePlayer.getState().setLanguage("german");
      useDial.getState().resetForLanguage("german");
    });
    await waitFor(() =>
      expect(pending.filter((p) => p.language === "german").map((p) => p.genre).sort()).toEqual(
        [g(4), g(5), g(6)].sort(),
      ),
    );
    const fresh = pending.find((p) => p.language === "german" && p.genre === g(5))!;
    await act(async () => respond(fresh, many("de", 2)));
    expect(band(g(5)).state).toBe("ready");
    expect(band(g(5)).stations[0].id).toBe("de0");
  });

  it("firstBandReady flips true once and survives a language reset", async () => {
    useDial.setState({ needleGenre: g(0) });
    renderHook(() => useDialBands());
    expect(useDial.getState().firstBandReady).toBe(false);
    await waitFor(() => expect(requested).toContain(g(0)));
    await act(async () => respond(take(g(0)), many("s", 2)));
    expect(useDial.getState().firstBandReady).toBe(true);
    act(() => useDial.getState().resetForLanguage("german"));
    expect(useDial.getState().firstBandReady).toBe(true);
  });
});
