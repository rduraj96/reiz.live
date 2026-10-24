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
  const ctx = {
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    createMediaElementSource: vi.fn(() => source),
    createAnalyser: vi.fn(() => analyser),
  };
  const createContext = vi.fn(() => ctx as unknown as AudioContext);
  const engine = createAudioEngine({
    createAudio: () => audio as unknown as HTMLAudioElement,
    createContext,
  });
  return { engine, audio, ctx, plays, createContext, analyser };
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
