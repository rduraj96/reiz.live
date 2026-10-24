import { describe, expect, it } from "vitest";
import { createAnalysis, stepAnalysis, type Analysis } from "@/visualizer/analysis";

const SR = 48000;
const BINS = 1024;
const DT = 0.01;

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const flat = (level: number) => new Uint8Array(BINS).fill(level);
const silence = flat(0);
// music-like: energy in the low bins only, so band 0 is the loudest band
const bassy = (level: number) => new Uint8Array(BINS).fill(level, 0, 8);

function run(a: Analysis, freq: Uint8Array | null, seconds: number, t0 = 0): number {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) stepAnalysis(a, freq, SR, DT, t0 + i * DT);
  return t0 + n * DT;
}

describe("level control", () => {
  it("converges a loud spectrum into the top of the range", () => {
    const a = createAnalysis(seeded(1));
    run(a, bassy(255), 3);
    expect(a.bands[0]).toBeGreaterThanOrEqual(0.6);
    expect(a.bands[0]).toBeLessThanOrEqual(1);
  });

  it("recovers a quieter spectrum after the peak decays", () => {
    const a = createAnalysis(seeded(1));
    run(a, bassy(255), 3);
    run(a, bassy(64), 10);
    expect(a.bands[0]).toBeGreaterThan(0.4);
  });
});

describe("kick detection", () => {
  it("fires on a bass jump with amplitude min(1, 1.4*bass)", () => {
    const a = createAnalysis(seeded(2));
    stepAnalysis(a, flat(255), SR, DT, 0);
    expect(a.kickAge).toBe(0);
    expect(a.kickAmp).toBeCloseTo(Math.min(1, 1.4 * a.bass), 10);
    expect(a.kickAmp).toBeGreaterThan(0);
  });

  it("ignores a second jump inside the 0.18 s refractory gap", () => {
    const a = createAnalysis(seeded(2));
    stepAnalysis(a, flat(255), SR, DT, 0);
    run(a, silence, 0.09);
    const before = a.kickAge;
    stepAnalysis(a, flat(255), SR, DT, 0.1);
    expect(a.kickAge).toBeCloseTo(before + DT, 10);
  });

  it("fires again after the gap", () => {
    const a = createAnalysis(seeded(2));
    stepAnalysis(a, flat(255), SR, DT, 0);
    run(a, silence, 0.19);
    stepAnalysis(a, flat(255), SR, DT, 0.2);
    expect(a.kickAge).toBe(0);
  });

  it("keeps kickDir a unit vector", () => {
    const a = createAnalysis(seeded(7));
    stepAnalysis(a, flat(255), SR, DT, 0);
    const [x, y, z] = a.kickDir;
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
  });
});

describe("spring and flash", () => {
  it("rings through zero and settles within 2 s", () => {
    const a = createAnalysis(seeded(3));
    stepAnalysis(a, flat(255), SR, DT, 0);
    let prev = a.squash;
    let flips = 0;
    for (let i = 0; i < 200; i++) {
      stepAnalysis(a, silence, SR, DT, (i + 1) * DT);
      if (Math.sign(a.squash) !== Math.sign(prev) && prev !== 0) flips++;
      prev = a.squash;
    }
    expect(flips).toBeGreaterThanOrEqual(1);
    expect(Math.abs(a.squash)).toBeLessThan(0.01);
  });

  it("decays flash at e^(-7 t)", () => {
    const a = createAnalysis(seeded(3));
    stepAnalysis(a, flat(255), SR, DT, 0);
    const peak = a.flash;
    expect(peak).toBeGreaterThan(0);
    run(a, silence, 1, DT);
    expect(a.flash).toBeLessThan(peak * Math.exp(-7) + 1e-3);
  });
});

describe("band ranges", () => {
  it("30-80 Hz energy raises bass only", () => {
    const a = createAnalysis(seeded(4));
    const freq = new Uint8Array(BINS);
    const bin = (hz: number) => (hz / (SR / 2)) * BINS;
    freq.fill(255, Math.ceil(bin(30)), Math.floor(bin(80)) + 1);
    run(a, freq, 1);
    expect(a.bass).toBeGreaterThan(0.05);
    expect(a.treb).toBe(0);
    expect(a.mid).toBe(0);
  });
});

describe("breathing preview", () => {
  it("keeps every band at or below 0.35", () => {
    const a = createAnalysis(seeded(5));
    let max = 0;
    for (let i = 0; i < 600; i++) {
      stepAnalysis(a, null, SR, DT, i * DT);
      for (const v of a.bands) max = Math.max(max, v);
    }
    expect(max).toBeGreaterThan(0.05);
    expect(max).toBeLessThanOrEqual(0.35);
  });
});
