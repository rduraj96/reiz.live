import { afterEach, describe, expect, it, vi } from "vitest";
import { createAudioEngine } from "@/lib/audio/engine";
import type { Station } from "@/lib/radio/types";

const st = (id: string): Station => ({
  id,
  name: id,
  streamUrl: `https://example.com/${id}`,
  homepage: null,
  favicon: null,
  country: "",
  countryCode: "",
  language: "english",
  tags: [],
  codec: "MP3",
  bitrate: 128,
});

function setup() {
  const target = new EventTarget();
  const plays: { src: string; resolve: () => void; reject: (e: unknown) => void }[] = [];
  const audio = Object.assign(target, {
    src: "",
    crossOrigin: null as string | null,
    volume: 1,
    muted: false,
    paused: true,
    pause: vi.fn(() => {
      audio.paused = true;
    }),
    play: vi.fn(() => {
      audio.paused = false;
      return new Promise<void>((resolve, reject) => {
        plays.push({ src: audio.src, resolve, reject });
      });
    }),
  });
  const source = { connect: vi.fn() };
  const analyser = { fftSize: 0, connect: vi.fn() };
  const gains: { gain: { value: number; setTargetAtTime: ReturnType<typeof vi.fn> }; connect: ReturnType<typeof vi.fn> }[] = [];
  const bufferSource = { buffer: null as unknown, loop: false, connect: vi.fn(), start: vi.fn() };
  const biquad = { type: "", frequency: { value: 0 }, Q: { value: 0 }, connect: vi.fn() };
  const ctx = {
    destination: {},
    currentTime: 0,
    sampleRate: 100,
    createGain: vi.fn(() => {
      const g = { gain: { value: 1, setTargetAtTime: vi.fn() }, connect: vi.fn() };
      gains.push(g);
      return g;
    }),
    createBiquadFilter: vi.fn(() => biquad),
    createBufferSource: vi.fn(() => bufferSource),
    createBuffer: vi.fn((_ch: number, len: number) => ({ getChannelData: () => new Float32Array(len) })),
    resume: vi.fn(() => Promise.resolve()),
    createMediaElementSource: vi.fn(() => source),
    createAnalyser: vi.fn(() => analyser),
  };
  const createContext = vi.fn(() => ctx as unknown as AudioContext);
  const engine = createAudioEngine({
    createAudio: () => audio as unknown as HTMLAudioElement,
    createContext,
  });
  // Graph creation order: streamGain first, then the static's gain.
  const targets = (i: 0 | 1) => gains[i]?.gain.setTargetAtTime.mock.calls.map((c) => c[0] as number) ?? [];
  const lastTarget = (i: 0 | 1) => targets(i).at(-1);
  return { engine, audio, ctx, plays, createContext, analyser, gains, bufferSource, biquad, targets, lastTarget };
}

const domErr = (name: string) => new DOMException("x", name);

describe("audio engine", () => {
  it("only the last loaded station emits playing; superseded AbortError is silent", async () => {
    const { engine, audio, plays } = setup();
    const playing = vi.fn();
    const failed = vi.fn();
    const blocked = vi.fn();
    engine.on("playing", playing);
    engine.on("failed", failed);
    engine.on("blocked", blocked);

    const a = engine.load(st("a"));
    const b = engine.load(st("b"));
    plays[0].reject(domErr("AbortError"));
    plays[1].resolve();
    audio.dispatchEvent(new Event("playing"));
    await Promise.all([a, b]);

    expect(playing).toHaveBeenCalledTimes(1);
    expect(playing.mock.calls[0][0].id).toBe("b");
    expect(failed).not.toHaveBeenCalled();
    expect(blocked).not.toHaveBeenCalled();
  });

  it("NotAllowedError emits blocked, not failed", async () => {
    const { engine, plays } = setup();
    const failed = vi.fn();
    const blocked = vi.fn();
    engine.on("failed", failed);
    engine.on("blocked", blocked);
    const p = engine.load(st("a"));
    plays[0].reject(domErr("NotAllowedError"));
    await p;
    expect(blocked).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
    expect(failed).not.toHaveBeenCalled();
  });

  it("other play() rejections emit failed for the current station", async () => {
    const { engine, plays } = setup();
    const failed = vi.fn();
    engine.on("failed", failed);
    const p = engine.load(st("a"));
    plays[0].reject(domErr("NotSupportedError"));
    await p;
    expect(failed).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
  });

  it("a superseded load's non-abort rejection is ignored", async () => {
    const { engine, plays } = setup();
    const failed = vi.fn();
    engine.on("failed", failed);
    const a = engine.load(st("a"));
    const b = engine.load(st("b"));
    plays[0].reject(domErr("NotSupportedError"));
    plays[1].resolve();
    await Promise.all([a, b]);
    expect(failed).not.toHaveBeenCalled();
  });

  it("an audio error event emits failed with the loaded station", async () => {
    const { engine, audio, plays } = setup();
    const failed = vi.fn();
    engine.on("failed", failed);
    const p = engine.load(st("a"));
    plays[0].resolve();
    await p;
    audio.dispatchEvent(new Event("error"));
    expect(failed).toHaveBeenCalledTimes(1);
    expect(failed.mock.calls[0][0].id).toBe("a");
  });

  it("a dead stream (error event + play rejection) emits failed once", async () => {
    const { engine, audio, plays } = setup();
    const failed = vi.fn();
    engine.on("failed", failed);
    const p = engine.load(st("a"));
    audio.dispatchEvent(new Event("error"));
    plays[0].reject(domErr("NotSupportedError"));
    await p;
    expect(failed).toHaveBeenCalledTimes(1);
  });

  it("pause emits paused", async () => {
    const { engine, audio, plays } = setup();
    const paused = vi.fn();
    engine.on("paused", paused);
    const p = engine.load(st("a"));
    plays[0].resolve();
    await p;
    engine.pause();
    expect(audio.pause).toHaveBeenCalled();
    expect(paused).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
  });

  it("unsubscribe stops delivery", async () => {
    const { engine, audio } = setup();
    const playing = vi.fn();
    const off = engine.on("playing", playing);
    void engine.load(st("a"));
    off();
    audio.dispatchEvent(new Event("playing"));
    expect(playing).not.toHaveBeenCalled();
  });

  it("three loads create one context and one media element source", async () => {
    const { engine, ctx, plays, createContext, analyser } = setup();
    expect(engine.analyser).toBeNull();
    const loads = [engine.load(st("a")), engine.load(st("b")), engine.load(st("c"))];
    plays.forEach((p) => p.resolve());
    await Promise.all(loads);
    expect(createContext).toHaveBeenCalledTimes(1);
    expect(ctx.createMediaElementSource).toHaveBeenCalledTimes(1);
    expect(ctx.resume).toHaveBeenCalled();
    expect(analyser.fftSize).toBe(512);
    expect(engine.analyser).toBe(analyser);
  });

  it("sets crossOrigin anonymous, src, volume and mute", async () => {
    const { engine, audio, plays } = setup();
    engine.setVolume(0.3);
    engine.setMuted(true);
    const p = engine.load(st("a"));
    plays[0].resolve();
    await p;
    expect(audio.crossOrigin).toBe("anonymous");
    expect(audio.src).toBe("https://example.com/a");
    expect(audio.volume).toBe(0.3);
    expect(audio.muted).toBe(true);
  });
});

describe("audio engine: element events and stall timeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function started() {
    vi.useFakeTimers();
    const t = setup();
    const events = { playing: vi.fn(), paused: vi.fn(), failed: vi.fn(), blocked: vi.fn() };
    for (const [name, cb] of Object.entries(events)) t.engine.on(name as keyof typeof events, cb);
    void t.engine.load(st("a"));
    return { ...t, events };
  }

  it("an external pause (e.g. OS media control) emits paused", () => {
    const { audio, events } = started();
    audio.dispatchEvent(new Event("playing"));
    audio.paused = true;
    audio.dispatchEvent(new Event("pause"));
    expect(events.paused).toHaveBeenCalledTimes(1);
    expect(events.paused.mock.calls[0][0].id).toBe("a");
  });

  it("engine.pause() and the element's resulting pause event emit paused once", () => {
    const { engine, audio, events } = started();
    audio.dispatchEvent(new Event("playing"));
    engine.pause();
    audio.dispatchEvent(new Event("pause"));
    expect(events.paused).toHaveBeenCalledTimes(1);
  });

  it("a stale pause event after a new load started is ignored", () => {
    const { engine, audio, events } = started();
    audio.dispatchEvent(new Event("playing"));
    void engine.load(st("b")); // play() leaves the element un-paused
    audio.dispatchEvent(new Event("pause"));
    expect(events.paused).not.toHaveBeenCalled();
  });

  it("ended emits failed: a live stream that ends is dead", () => {
    const { audio, events } = started();
    audio.dispatchEvent(new Event("playing"));
    audio.dispatchEvent(new Event("ended"));
    expect(events.failed).toHaveBeenCalledTimes(1);
    expect(events.failed.mock.calls[0][0].id).toBe("a");
  });

  it("no playing within 15 s of load emits failed once", () => {
    const { events } = started();
    vi.advanceTimersByTime(14_999);
    expect(events.failed).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(events.failed).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(events.failed).toHaveBeenCalledTimes(1);
  });

  it("playing at 14 s does not fail", () => {
    const { audio, events } = started();
    vi.advanceTimersByTime(14_000);
    audio.dispatchEvent(new Event("playing"));
    vi.advanceTimersByTime(60_000);
    expect(events.failed).not.toHaveBeenCalled();
  });

  it("waiting then playing within 15 s does not fail", () => {
    const { audio, events } = started();
    audio.dispatchEvent(new Event("playing"));
    audio.dispatchEvent(new Event("waiting"));
    vi.advanceTimersByTime(10_000);
    audio.dispatchEvent(new Event("playing"));
    vi.advanceTimersByTime(60_000);
    expect(events.failed).not.toHaveBeenCalled();
  });

  it("waiting for 15 s emits failed", () => {
    const { audio, events } = started();
    audio.dispatchEvent(new Event("playing"));
    vi.advanceTimersByTime(30_000);
    audio.dispatchEvent(new Event("waiting"));
    vi.advanceTimersByTime(15_000);
    expect(events.failed).toHaveBeenCalledTimes(1);
  });

  it("a superseded load's timer never fires", () => {
    const { engine, audio, events } = started();
    vi.advanceTimersByTime(10_000);
    void engine.load(st("b"));
    audio.dispatchEvent(new Event("playing"));
    vi.advanceTimersByTime(60_000);
    expect(events.failed).not.toHaveBeenCalled();
  });

  it("pausing before playing clears the stall timer", () => {
    const { engine, events } = started();
    engine.pause();
    vi.advanceTimersByTime(60_000);
    expect(events.failed).not.toHaveBeenCalled();
  });

  it("an autoplay block clears the stall timer (blocked is not bad)", async () => {
    const { plays, events } = started();
    plays[0].reject(domErr("NotAllowedError"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(events.blocked).toHaveBeenCalledTimes(1);
    expect(events.failed).not.toHaveBeenCalled();
  });
});

describe("audio engine: tuning static", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function playingOn(id = "a") {
    vi.useFakeTimers();
    const t = setup();
    void t.engine.load(st(id));
    t.audio.dispatchEvent(new Event("playing"));
    return t;
  }

  it("setTuning(true) before any load builds nothing and does not throw", () => {
    const { engine, ctx, createContext } = setup();
    expect(() => engine.setTuning(true)).not.toThrow();
    expect(createContext).not.toHaveBeenCalled();
    expect(ctx.createBufferSource).not.toHaveBeenCalled();
  });

  it("builds a looping bandpass noise chain on first load", () => {
    const { engine, bufferSource, biquad, ctx } = setup();
    void engine.load(st("a"));
    expect(ctx.createGain).toHaveBeenCalledTimes(2);
    expect(bufferSource.loop).toBe(true);
    expect(bufferSource.start).toHaveBeenCalled();
    expect(biquad).toMatchObject({ type: "bandpass", frequency: { value: 2600 }, Q: { value: 0.4 } });
  });

  it("tuning on targets stream 0.08 and static 0.45 with time constant 0.05", () => {
    const { engine, gains } = playingOn();
    engine.setTuning(true);
    expect(gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(0.08, 0, 0.05);
    expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(0.45, 0, 0.05);
  });

  it("tuning off with no new load restores stream and silences static (same station)", () => {
    const { engine, lastTarget } = playingOn();
    engine.setTuning(true);
    engine.setTuning(false);
    expect(lastTarget(0)).toBe(1);
    expect(lastTarget(1)).toBe(0);
  });

  it("tuning off with a pending load holds static until playing", () => {
    const { engine, audio, lastTarget } = playingOn();
    engine.setTuning(true);
    void engine.load(st("b"));
    engine.setTuning(false);
    expect(lastTarget(1)).toBe(0.45);
    expect(lastTarget(0)).toBe(0.08);
    vi.advanceTimersByTime(2_999);
    expect(lastTarget(1)).toBe(0.45);
    audio.dispatchEvent(new Event("playing"));
    expect(lastTarget(1)).toBe(0);
    expect(lastTarget(0)).toBe(1);
  });

  it("the hold fades after 3000 ms without playing", () => {
    const { engine, lastTarget } = playingOn();
    engine.setTuning(true);
    void engine.load(st("b"));
    engine.setTuning(false);
    vi.advanceTimersByTime(3_000);
    expect(lastTarget(1)).toBe(0);
    expect(lastTarget(0)).toBe(1);
  });

  it("static stays silent while paused", () => {
    const { engine, lastTarget } = playingOn();
    engine.pause();
    engine.setTuning(true);
    expect(lastTarget(1)).toBe(0);
  });

  it("tuning on again cancels a hold", () => {
    const { engine, audio, lastTarget } = playingOn();
    engine.setTuning(true);
    void engine.load(st("b"));
    engine.setTuning(false);
    engine.setTuning(true);
    vi.advanceTimersByTime(5_000);
    expect(lastTarget(1)).toBe(0.45);
    audio.dispatchEvent(new Event("playing"));
    expect(lastTarget(1)).toBe(0.45);
  });
});
