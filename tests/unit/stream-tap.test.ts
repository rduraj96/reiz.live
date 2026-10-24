import { afterEach, describe, expect, it, vi } from "vitest";
import { createAudioEngine } from "@/lib/audio/engine";
import { createStreamTap } from "@/lib/audio/tap";
import type { Station } from "@/lib/radio/types";

/** A fake AudioContext: buffers "decode" to 1 s per 20 kB, sources record when they start. */
function fakeCtx(opts: { decodeFails?: boolean; probeLevel?: () => number } = {}) {
  const started: { at: number; duration: number }[] = [];
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const analysers: Record<string, unknown>[] = [];
  const ctx = {
    currentTime: 0,
    sampleRate: 48000,
    destination: {},
    createAnalyser: vi.fn(() => {
      const a = {
        ...node(),
        fftSize: 2048,
        smoothingTimeConstant: 0.8,
        getByteTimeDomainData: (d: Uint8Array) => d.fill(opts.probeLevel?.() ?? 128),
      };
      analysers.push(a);
      return a;
    }),
    createGain: vi.fn(() => ({ ...node(), gain: { value: 1, setTargetAtTime: vi.fn() } })),
    createBiquadFilter: vi.fn(() => ({ ...node(), type: "", frequency: { value: 0 }, Q: { value: 0 } })),
    createBuffer: vi.fn((_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) })),
    createMediaElementSource: vi.fn(() => node()),
    createBufferSource: vi.fn(() => {
      const src = {
        ...node(),
        buffer: null as { duration: number } | null,
        loop: false,
        onended: null,
        start: vi.fn((at?: number) => src.buffer && started.push({ at: at ?? 0, duration: src.buffer.duration })),
      };
      return src;
    }),
    decodeAudioData: vi.fn((buf: ArrayBuffer) =>
      opts.decodeFails ? Promise.reject(new Error("bad")) : Promise.resolve({ duration: buf.byteLength / 20000 }),
    ),
    resume: vi.fn(() => Promise.resolve()),
  };
  return { ctx, started, analysers };
}

/** MPEG-1 Layer III, 128 kbps, 44.1 kHz, no padding: a 417-byte frame. */
const FRAME = (() => {
  const f = new Uint8Array(417);
  f.set([0xff, 0xfb, 0x90, 0x64]);
  return f;
})();
/** `size` bytes of back-to-back MP3 frames, starting `offset` bytes into the frame sequence (mid-frame). */
function mp3Bytes(size: number, offset: number): Uint8Array {
  const out = new Uint8Array(size);
  for (let i = 0; i < size; i++) out[i] = FRAME[(i + offset) % FRAME.length];
  return out;
}

/** A fetch whose body yields `chunks` chunks of `size` MP3 bytes cut at arbitrary points, `gapMs` apart, then stays
 * open until aborted. */
function streamFetch(chunks: number, size = 5000, gapMs = 300, type = "audio/mpeg") {
  return vi.fn(async (_url: unknown, init?: RequestInit) => {
    let i = 0;
    const body = new ReadableStream<Uint8Array>({
      async pull(c) {
        if (i++ >= chunks) {
          await new Promise<void>((resolve) => init?.signal?.addEventListener("abort", () => resolve()));
          c.close();
          return;
        }
        await new Promise((r) => setTimeout(r, gapMs));
        c.enqueue(mp3Bytes(size, 100 + (i - 1) * size));
      },
    });
    return new Response(body, { headers: { "content-type": type } });
  }) as unknown as typeof fetch;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("stream tap", () => {
  it("decodes the stream in chunks and schedules them back to back, muted", async () => {
    vi.useFakeTimers();
    const { ctx, started } = fakeCtx();
    const tap = createStreamTap(ctx as unknown as AudioContext, streamFetch(4));
    tap.start("https://radio.example/live");
    await vi.advanceTimersByTimeAsync(1500);
    expect(tap.running).toBe(true);
    expect(tap.stats.chunks).toBeGreaterThanOrEqual(2);
    // Only whole frames are decoded: every decoded slice is a multiple of the frame size.
    for (const call of ctx.decodeAudioData.mock.calls) {
      const bytes = new Uint8Array(call[0] as ArrayBuffer);
      expect(bytes.length % FRAME.length).toBe(0);
      expect([bytes[0], bytes[1]]).toEqual([0xff, 0xfb]);
    }
    for (let i = 1; i < started.length; i++) {
      expect(started[i].at).toBeCloseTo(started[i - 1].at + started[i - 1].duration, 6);
    }
    tap.stop();
    expect(tap.running).toBe(false);
  });

  it("gives up on a stream it can't decode, and doesn't retry it", async () => {
    vi.useFakeTimers();
    const { ctx } = fakeCtx({ decodeFails: true });
    const fetchImpl = streamFetch(12);
    const tap = createStreamTap(ctx as unknown as AudioContext, fetchImpl);
    tap.start("https://radio.example/live");
    await vi.advanceTimersByTimeAsync(5000);
    expect(tap.stats.gaveUp).toBe("https://radio.example/live");
    tap.start("https://radio.example/live");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("won't tap an HLS playlist", async () => {
    const { ctx } = fakeCtx();
    const tap = createStreamTap(ctx as unknown as AudioContext, streamFetch(1, 10, 0, "application/vnd.apple.mpegurl"));
    tap.start("https://radio.example/live.m3u8");
    await vi.waitFor(() => expect(tap.stats.gaveUp).toBe("https://radio.example/live.m3u8"));
  });
});

const station: Station = {
  id: "a",
  name: "A",
  streamUrl: "https://radio.example/live",
  homepage: null,
  favicon: null,
  country: "",
  countryCode: "",
  language: "",
  tags: [],
  codec: "MP3",
  bitrate: 128,
};

function playing(probeLevel: () => number) {
  vi.useFakeTimers();
  const fetchImpl = streamFetch(100);
  vi.stubGlobal("fetch", fetchImpl);
  const { ctx } = fakeCtx({ probeLevel });
  const audio = Object.assign(new EventTarget(), {
    src: "",
    crossOrigin: null,
    volume: 1,
    paused: true,
    pause() {
      audio.paused = true;
      audio.dispatchEvent(new Event("pause"));
    },
    play() {
      audio.paused = false;
      return Promise.resolve();
    },
  });
  const engine = createAudioEngine({
    createAudio: () => audio as unknown as HTMLAudioElement,
    createContext: () => ctx as unknown as AudioContext,
  });
  void engine.load(station);
  audio.dispatchEvent(new Event("playing"));
  return { engine, fetchImpl, audio };
}

describe("engine: a stream Web Audio can't hear (iOS)", () => {
  it("after 3 s of silence while playing, feeds the visualizer from a tap of the same stream", async () => {
    const { engine, fetchImpl } = playing(() => 128);
    const own = engine.analyser;
    await vi.advanceTimersByTimeAsync(2500);
    expect(fetchImpl).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchImpl).toHaveBeenCalledWith(station.streamUrl, expect.anything());
    expect(engine.tap?.running).toBe(true);
    expect(engine.analyser).toBe(engine.tap?.analyser);
    expect(engine.analyser).not.toBe(own);
  });

  it("never taps a stream Web Audio can hear", async () => {
    let t = 0;
    const { engine, fetchImpl } = playing(() => (t++ % 2 ? 140 : 116));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(engine.tap).toBeNull();
  });

  it("stops the tap when playback pauses", async () => {
    const { engine, audio } = playing(() => 128);
    await vi.advanceTimersByTimeAsync(3500);
    expect(engine.tap?.running).toBe(true);
    audio.pause();
    await vi.advanceTimersByTimeAsync(300);
    expect(engine.tap?.running).toBe(false);
  });
});
