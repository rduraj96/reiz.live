import { describe, expect, it } from "vitest";
import { introTarget, stepIntro } from "@/lib/intro/progress";

const DT = 16;

/** Runs the stepper at 16 ms frames to `untilMs`, returning each (elapsed, shown). */
function run(target: number | ((t: number) => number), untilMs: number) {
  const out: { t: number; v: number }[] = [];
  let v = 0;
  for (let t = DT; t <= untilMs; t += DT) {
    v = stepIntro(v, typeof target === "number" ? target : target(t), t, DT);
    out.push({ t, v });
  }
  return out;
}

describe("introTarget", () => {
  it("maps milestones to 0, 0.2, 0.7 and 1", () => {
    expect(introTarget({ fonts: false, band: false, frame: false })).toBe(0);
    expect(introTarget({ fonts: true, band: false, frame: false })).toBe(0.2);
    expect(introTarget({ fonts: true, band: true, frame: false })).toBe(0.7);
    expect(introTarget({ fonts: true, band: true, frame: true })).toBe(1);
  });
});

describe("stepIntro", () => {
  it("never decreases, even when the target drops", () => {
    const frames = run((t) => (t < 1000 ? 0.7 : 0.2), 3000);
    for (let i = 1; i < frames.length; i++) expect(frames[i].v).toBeGreaterThanOrEqual(frames[i - 1].v);
  });

  it("stays at or below 0.99 until 1600 ms with every milestone done, then reaches 1 shortly after", () => {
    const frames = run(1, 2000);
    for (const f of frames.filter((f) => f.t < 1600)) expect(f.v).toBeLessThanOrEqual(0.99);
    expect(frames.find((f) => f.v === 1)!.t).toBeLessThanOrEqual(1700);
  });

  it("is forced to 1 at 6000 ms with no milestone ever done", () => {
    const frames = run(0, 6200);
    for (const f of frames.filter((f) => f.t < 6000)) expect(f.v).toBeLessThan(1);
    expect(frames.find((f) => f.t >= 6000)!.v).toBe(1);
  });

  it("eases toward a mid milestone without jumping", () => {
    const frames = run(0.7, 1200);
    expect(frames[0].v).toBeLessThan(0.1);
    expect(frames.at(-1)!.v).toBeCloseTo(0.7, 1);
  });
});
