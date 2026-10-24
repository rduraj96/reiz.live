import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useViz } from "@/store/visualizer";
import { createSpectrumReader, SILENT_AFTER_S } from "@/visualizer/spectrum";

const touch = (isTouch: boolean) =>
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: isTouch && q.includes("pointer: coarse"), media: q }));

beforeEach(() => {
  localStorage.clear();
  useViz.setState(useViz.getInitialState(), true);
});
afterEach(() => vi.unstubAllGlobals());

describe("visualizer mode", () => {
  it("defaults to 2D on touch devices and 3D elsewhere", () => {
    touch(true);
    useViz.getState().resolve();
    expect(useViz.getState().mode).toBe("2d");

    useViz.setState(useViz.getInitialState(), true);
    touch(false);
    useViz.getState().resolve();
    expect(useViz.getState().mode).toBe("3d");
  });

  it("a saved choice beats the device default and survives a reload", () => {
    touch(true);
    useViz.getState().resolve();
    useViz.getState().setMode("3d");
    useViz.setState(useViz.getInitialState(), true);
    useViz.getState().resolve();
    expect(useViz.getState().mode).toBe("3d");
  });
});

/** A fake analyser whose spectrum is all `level`. */
const analyser = (level: () => number) =>
  ({
    frequencyBinCount: 8,
    context: { sampleRate: 44100 },
    getByteFrequencyData: (a: Uint8Array) => a.fill(level()),
  }) as unknown as AnalyserNode;

describe("spectrum reader", () => {
  it("reads nothing while inactive", () => {
    const r = createSpectrumReader(() => analyser(() => 100));
    expect(r.read(false, 0.016)).toBeNull();
    expect(r.read(true, 0.016)?.freq[0]).toBe(100);
  });

  it("gives up on an analyser that only hears silence, and recovers when sound arrives", () => {
    let level = 0;
    const r = createSpectrumReader(() => analyser(() => level));
    expect(r.read(true, SILENT_AFTER_S / 2)).not.toBeNull(); // a short gap is just a quiet moment
    expect(r.read(true, SILENT_AFTER_S / 2)).toBeNull();
    level = 40;
    expect(r.read(true, 0.016)?.freq[0]).toBe(40);
  });
});
