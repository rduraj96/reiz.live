import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isSaved, toggleSaved, useSaved } from "@/lib/library/saved";
import type { Station } from "@/lib/radio/types";

const st = (id: string): Station => ({
  id,
  name: `Station ${id}`,
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

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("saved stations in this browser", () => {
  it("a heart saves a station (newest first) and a second one removes it", () => {
    toggleSaved(st("a"));
    toggleSaved(st("b"));
    expect(JSON.parse(localStorage.getItem("reizdio:saved")!).map((s: Station) => s.id)).toEqual(["b", "a"]);
    expect(isSaved("a")).toBe(true);
    toggleSaved(st("a"));
    expect(isSaved("a")).toBe(false);
  });

  it("re-renders listeners", () => {
    const { result } = renderHook(() => useSaved());
    expect(result.current).toEqual([]);
    act(() => toggleSaved(st("a")));
    expect(result.current.map((s) => s.id)).toEqual(["a"]);
  });

  it("follows changes made in another tab", () => {
    const { result } = renderHook(() => useSaved());
    act(() => {
      localStorage.setItem("reizdio:saved", JSON.stringify([st("z")]));
      window.dispatchEvent(new StorageEvent("storage", { key: "reizdio:saved" }));
    });
    expect(result.current.map((s) => s.id)).toEqual(["z"]);
  });

  it("ignores junk in storage, and still works in memory when storage is blocked", () => {
    localStorage.setItem("reizdio:saved", "{not json");
    expect(isSaved("a")).toBe(false);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => toggleSaved(st("a"))).not.toThrow();
    expect(isSaved("a")).toBe(true);
  });
});
