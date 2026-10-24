import { describe, expect, it } from "vitest";
import { computeBands, smoothBands } from "@/visualizer/bands";

describe("computeBands", () => {
  it("returns all zeros for silence", () => {
    expect(computeBands(new Uint8Array(256))).toEqual({ bass: 0, mid: 0, treble: 0 });
  });

  it("returns all ones for a full-scale spectrum", () => {
    expect(computeBands(new Uint8Array(256).fill(255))).toEqual({ bass: 1, mid: 1, treble: 1 });
  });

  it("puts energy in the first 10% of bins into bass only", () => {
    const freq = new Uint8Array(256);
    freq.fill(255, 0, Math.floor(256 * 0.1));
    const bands = computeBands(freq);
    expect(bands.bass).toBeGreaterThan(0.9);
    expect(bands.treble).toBe(0);
  });

  it("can write into an existing object to avoid per-frame allocation", () => {
    const out = { bass: 0, mid: 0, treble: 0 };
    expect(computeBands(new Uint8Array(100).fill(255), out)).toBe(out);
    expect(out).toEqual({ bass: 1, mid: 1, treble: 1 });
  });

  it("returns zeros for an empty array", () => {
    expect(computeBands(new Uint8Array(0))).toEqual({ bass: 0, mid: 0, treble: 0 });
  });
});

describe("smoothBands", () => {
  it("rises by the attack fraction toward a higher value", () => {
    const prev = { bass: 0, mid: 0.2, treble: 0 };
    const next = { bass: 1, mid: 0.6, treble: 0.5 };
    const out = smoothBands(prev, next, 0.5, 0.12);
    expect(out.bass).toBeCloseTo(0.5);
    expect(out.mid).toBeCloseTo(0.4);
    expect(out.treble).toBeCloseTo(0.25);
  });

  it("falls by the release fraction toward a lower value", () => {
    const prev = { bass: 1, mid: 0.5, treble: 1 };
    const next = { bass: 0, mid: 0, treble: 0.5 };
    const out = smoothBands(prev, next, 0.5, 0.12);
    expect(out.bass).toBeCloseTo(0.88);
    expect(out.mid).toBeCloseTo(0.44);
    expect(out.treble).toBeCloseTo(0.94);
  });

  it("uses attack 0.5 and release 0.12 by default", () => {
    const up = smoothBands({ bass: 0, mid: 0, treble: 0 }, { bass: 1, mid: 1, treble: 1 });
    expect(up.bass).toBeCloseTo(0.5);
    const down = smoothBands({ bass: 1, mid: 1, treble: 1 }, { bass: 0, mid: 0, treble: 0 });
    expect(down.bass).toBeCloseTo(0.88);
  });

  it("can write into an existing object to avoid per-frame allocation", () => {
    const prev = { bass: 0, mid: 0, treble: 0 };
    const out = smoothBands(prev, { bass: 1, mid: 1, treble: 1 }, 0.5, 0.12, prev);
    expect(out).toBe(prev);
    expect(prev.bass).toBeCloseTo(0.5);
  });
});
