import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NOW_PLAYING_POLL_MS, useNowPlaying } from "@/hooks/useNowPlaying";
import type { Station } from "@/lib/radio/types";
import { usePlayer } from "@/store/player";

const st = (id: string): Station => ({
  id,
  name: id,
  streamUrl: `https://x/${id}`,
  homepage: null,
  favicon: null,
  country: "",
  countryCode: "",
  language: "",
  tags: [],
  codec: "MP3",
  bitrate: 128,
});

let titles: Record<string, string | null> = {};
let fetchMock: ReturnType<typeof vi.fn>;
let hidden = false;

beforeEach(() => {
  vi.useFakeTimers();
  hidden = false;
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  titles = { a: "Artist A - Song 1", b: "Artist B - Song 2" };
  fetchMock = vi.fn(async (url: string) => {
    const id = new URL(url, "http://x").searchParams.get("id")!;
    return { ok: true, json: async () => ({ title: titles[id] ?? null }) } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  usePlayer.setState(usePlayer.getInitialState(), true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const settle = () => act(() => vi.advanceTimersByTimeAsync(0));

describe("useNowPlaying", () => {
  it("fetches the title while playing and polls every 20 s", async () => {
    expect(NOW_PLAYING_POLL_MS).toBe(20_000);
    usePlayer.setState({ current: st("a"), status: "playing" });
    renderHook(() => useNowPlaying());
    await settle();
    expect(usePlayer.getState().nowPlaying).toBe("Artist A - Song 1");
    titles.a = "Artist A - Song 2";
    await act(() => vi.advanceTimersByTimeAsync(NOW_PLAYING_POLL_MS));
    expect(usePlayer.getState().nowPlaying).toBe("Artist A - Song 2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does nothing while paused or hidden", async () => {
    usePlayer.setState({ current: st("a"), status: "paused" });
    renderHook(() => useNowPlaying());
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(fetchMock).not.toHaveBeenCalled();

    hidden = true;
    act(() => usePlayer.setState({ status: "playing" }));
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(fetchMock).not.toHaveBeenCalled();

    hidden = false;
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("clears the title the moment the station changes", async () => {
    usePlayer.setState({ current: st("a"), status: "playing" });
    renderHook(() => useNowPlaying());
    await settle();
    expect(usePlayer.getState().nowPlaying).toBe("Artist A - Song 1");
    act(() => usePlayer.setState({ current: st("b"), status: "loading" }));
    expect(usePlayer.getState().nowPlaying).toBeNull();
    act(() => usePlayer.setState({ status: "playing" }));
    await settle();
    expect(usePlayer.getState().nowPlaying).toBe("Artist B - Song 2");
  });

  it("ignores a late answer for the previous station", async () => {
    let release!: () => void;
    fetchMock.mockImplementationOnce(
      () => new Promise((r) => (release = () => r({ ok: true, json: async () => ({ title: "stale" }) } as Response))),
    );
    usePlayer.setState({ current: st("a"), status: "playing" });
    renderHook(() => useNowPlaying());
    act(() => usePlayer.setState({ current: st("b") }));
    await settle();
    release();
    await settle();
    expect(usePlayer.getState().nowPlaying).toBe("Artist B - Song 2");
  });
});
