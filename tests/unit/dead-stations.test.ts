import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEAD_TTL_MS, dropDead, isDead, recordDead } from "@/lib/library/deadStations";

const T0 = 1_000_000;

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("dead stations on this device", () => {
  it("remembers a failed station for 24 hours", () => {
    recordDead("a", T0);
    expect(isDead("a", T0 + 1000)).toBe(true);
    expect(isDead("b", T0 + 1000)).toBe(false);
    expect(isDead("a", T0 + DEAD_TTL_MS + 1)).toBe(false);
    expect(DEAD_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("keeps at most 200, dropping the oldest", () => {
    for (let k = 0; k <= 200; k++) recordDead(`s${k}`, T0 + k);
    expect(isDead("s0", T0 + 300)).toBe(false);
    expect(isDead("s1", T0 + 300)).toBe(true);
    expect(isDead("s200", T0 + 300)).toBe(true);
  });

  it("drops dead stations from a list", () => {
    recordDead("b", T0);
    expect(dropDead([{ id: "a" }, { id: "b" }, { id: "c" }], T0 + 1).map((s) => s.id)).toEqual(["a", "c"]);
  });

  it("does nothing when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => recordDead("a", T0)).not.toThrow();
    expect(isDead("a", T0)).toBe(false);
    expect(dropDead([{ id: "a" }], T0)).toEqual([{ id: "a" }]);
  });
});
