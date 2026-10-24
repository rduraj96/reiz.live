import { describe, expect, it } from "vitest";
import {
  BAND_GAP,
  DIAL_SLOTS,
  STATION_GAP,
  bandAt,
  buildLayout,
  frequencyOf,
  nearestStation,
  positionOf,
  type DialBand,
} from "@/lib/dial/layout";
import type { Station } from "@/lib/radio/types";

const st = (id: string): Station => ({
  id,
  name: id,
  streamUrl: `https://x/${id}`,
  homepage: "",
  favicon: "",
  country: "",
  countryCode: "",
  language: "",
  tags: [],
  codec: "mp3",
  bitrate: 128,
});
const stations = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => st(`${prefix}${i}`));
const band = (
  genre: string,
  state: DialBand["state"],
  n = 0,
): DialBand => ({ genre, label: genre.toUpperCase(), state, stations: stations(genre, n) });

describe("dial layout", () => {
  const two = () => buildLayout([band("jazz", "ready", 12), band("rock", "ready", 3)]);

  it("spaces stations and bands", () => {
    const l = two();
    expect(l.bands[1].start).toBe(DIAL_SLOTS * STATION_GAP + BAND_GAP);
    expect(l.ticks[1].x - l.ticks[0].x).toBe(72);
    expect(l.bands[0].end).toBe(11 * 72);
    expect(l.width).toBe(l.bands[1].end);
  });

  it("leaves unused slots null", () => {
    const l = two();
    const rock = l.ticks.filter((t) => t.band === "rock");
    expect(rock).toHaveLength(12);
    expect(rock.filter((t) => t.stationId === null)).toHaveLength(9);
  });

  it("maps frequencies linearly over all slots", () => {
    const l = two();
    expect(frequencyOf(l, "jazz0")).toBe("87.5");
    expect(frequencyOf(l, "rock2")).not.toBeNull();
    expect(frequencyOf(l, "nope")).toBeNull();
    const full = buildLayout([band("a", "ready", 12), band("b", "ready", 12)]);
    expect(frequencyOf(full, "b11")).toBe("108.0");
  });

  it("keeps frequencies stable when a band becomes ready", () => {
    const before = buildLayout([band("a", "ready", 12), band("b", "ready", 12), band("c", "idle")]);
    const after = buildLayout([band("a", "ready", 12), band("b", "ready", 12), band("c", "ready", 12)]);
    expect(frequencyOf(after, "a5")).toBe(frequencyOf(before, "a5"));
    expect(frequencyOf(after, "b3")).toBe(frequencyOf(before, "b3"));
  });

  it("finds the nearest station", () => {
    const l = two();
    expect(nearestStation(l, 72 + 10)).toEqual({ stationId: "jazz1", x: 72 });
    expect(nearestStation(l, 72 + 40)).toEqual({ stationId: "jazz2", x: 144 });
  });

  it("returns null when no band has stations", () => {
    const l = buildLayout([band("a", "idle"), band("b", "empty"), band("c", "error")]);
    expect(nearestStation(l, 100)).toBeNull();
  });

  it("does not place stations from non-ready bands", () => {
    const l = buildLayout([band("a", "loading", 5)]);
    expect(l.ticks.every((t) => t.stationId === null)).toBe(true);
    expect(l.ticks).toHaveLength(12);
  });

  it("positionOf and bandAt", () => {
    const l = two();
    expect(positionOf(l, "rock1")).toBe(l.bands[1].start + 72);
    expect(positionOf(l, "nope")).toBeNull();
    expect(bandAt(l, 0)).toBe("jazz");
    expect(bandAt(l, l.bands[0].end)).toBe("jazz");
    expect(bandAt(l, l.bands[1].start + 5)).toBe("rock");
    expect(bandAt(l, l.bands[0].end + 10)).toBeNull();
  });

  it("adds a leading off-dial band", () => {
    const l = buildLayout([band("jazz", "ready", 12)], { station: st("shared"), label: "Shared" });
    expect(l.bands[0]).toMatchObject({ label: "Shared", genre: "__offdial", start: 0, end: 0, state: "ready" });
    expect(l.bands[1].start).toBe(72 + 60);
    expect(positionOf(l, "shared")).toBe(0);
    expect(frequencyOf(l, "shared")).toBeNull();
    const plain = buildLayout([band("a", "ready", 12), band("b", "ready", 12)]);
    const withOff = buildLayout([band("a", "ready", 12), band("b", "ready", 12)], { station: st("shared"), label: "Shared" });
    expect(frequencyOf(withOff, "a0")).toBe("87.5");
    expect(frequencyOf(withOff, "b11")).toBe("108.0");
    expect(frequencyOf(withOff, "a5")).toBe(frequencyOf(plain, "a5"));
  });
});
