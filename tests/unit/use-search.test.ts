import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSearch } from "@/hooks/useSearch";
import type { Station } from "@/lib/radio/types";

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

const ok = (stations: Station[]) => ({ ok: true, json: async () => stations }) as Response;

describe("useSearch", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("debounces rapid typing into one fetch for the final query", async () => {
    fetchMock.mockResolvedValue(ok([st("a")]));
    const { result, rerender } = renderHook(({ q }) => useSearch(q, null), { initialProps: { q: "ja" } });
    rerender({ q: "jaz" });
    rerender({ q: "jazz" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/stations/search?q=jazz");
    expect(result.current.results).toEqual([st("a")]);
    expect(result.current.loading).toBe(false);
  });

  it("does not fetch for a single character", async () => {
    const { result } = renderHook(() => useSearch("j", null));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.results).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("ignores a response for a stale query", async () => {
    let resolveFirst!: (r: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)));
    fetchMock.mockResolvedValueOnce(ok([st("new")]));
    const { result, rerender } = renderHook(({ q }) => useSearch(q, null), { initialProps: { q: "jazz" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    rerender({ q: "lofi" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    await act(async () => {
      resolveFirst(ok([st("old")]));
    });
    expect(result.current.results).toEqual([st("new")]);
  });

  it("aborts the in-flight request when q changes", async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const { rerender } = renderHook(({ q }) => useSearch(q, null), { initialProps: { q: "jazz" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    rerender({ q: "lofi" });
    expect(signal.aborted).toBe(true);
  });

  it("refetches with country when it changes", async () => {
    fetchMock.mockResolvedValue(ok([]));
    const { rerender } = renderHook(({ c }) => useSearch("jazz", c), { initialProps: { c: null as string | null } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    rerender({ c: "DE" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/stations/search?q=jazz&country=DE");
  });

  it("surfaces an error from a failed response", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "Radio directory unavailable" }) });
    const { result } = renderHook(() => useSearch("jazz", null));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(result.current.error).toBe("Radio directory unavailable");
    expect(result.current.loading).toBe(false);
  });
});
