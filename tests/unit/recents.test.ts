import { beforeEach, describe, expect, it } from "vitest";
import { addRecent, clearRecents, loadRecents } from "@/lib/library/recents";
import type { Station } from "@/lib/radio/types";

const KEY = "reizdio:recents";

function st(id: string): Station {
  return {
    id,
    name: `Station ${id}`,
    streamUrl: `https://example.com/${id}`,
    homepage: null,
    favicon: null,
    country: "X",
    countryCode: "XX",
    language: "en",
    tags: [],
    codec: "MP3",
    bitrate: 128,
  };
}

describe("recents", () => {
  beforeEach(() => localStorage.clear());

  it("moves a re-played station to the front without duplicating", () => {
    addRecent(st("A"));
    addRecent(st("B"));
    const list = addRecent(st("A"));
    expect(list.map((s) => s.id)).toEqual(["A", "B"]);
    expect(loadRecents().map((s) => s.id)).toEqual(["A", "B"]);
  });

  it("caps at 20, newest first", () => {
    for (let i = 0; i < 25; i++) addRecent(st(String(i)));
    const list = loadRecents();
    expect(list).toHaveLength(20);
    expect(list[0].id).toBe("24");
    expect(list[19].id).toBe("5");
  });

  it("returns [] for corrupt JSON", () => {
    localStorage.setItem(KEY, "{not json");
    expect(loadRecents()).toEqual([]);
  });

  it("drops entries missing id", () => {
    localStorage.setItem(KEY, JSON.stringify([st("A"), { name: "x", streamUrl: "u" }, null, st("B")]));
    expect(loadRecents().map((s) => s.id)).toEqual(["A", "B"]);
  });

  it("clearRecents empties the list", () => {
    addRecent(st("A"));
    clearRecents();
    expect(loadRecents()).toEqual([]);
  });

  it("addRecent does not throw when storage throws", () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("quota");
    };
    try {
      expect(addRecent(st("A")).map((s) => s.id)).toEqual(["A"]);
    } finally {
      Storage.prototype.setItem = orig;
    }
  });
});
