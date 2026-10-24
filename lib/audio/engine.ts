import type { Station } from "@/lib/radio/types";
import { createStreamTap, type StreamTap } from "./tap";

export type AudioEngineEvent = "playing" | "paused" | "blocked" | "failed";

export interface AudioEngine {
  load(station: Station): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  setVolume(v: number): void;
  /** Dial-tuning static: stream ducks, noise rises. Off fades back (held while a load is pending, up to 3 s). */
  setTuning(on: boolean): void;
  readonly analyser: AnalyserNode | null;
  /** The silent second stream feeding the visualizer where Web Audio hears nothing (iOS); null until needed. */
  readonly tap: StreamTap | null;
  on(event: AudioEngineEvent, cb: (station: Station) => void): () => void;
}

/** A load that hasn't reached `playing`, or sits in `waiting`, this long is treated as dead. */
export const STALL_TIMEOUT_MS = 15_000;

/** Longest the static lingers after tuning ends while waiting for the new station's `playing`. */
export const TUNING_HOLD_MS = 3000;
const STREAM_TUNING_GAIN = 0.08;
const STATIC_TUNING_GAIN = 0.45;
const GAIN_TIME_CONSTANT = 0.05;
/** How often the probe checks whether Web Audio can hear the playing stream. */
const PROBE_MS = 250;
/** A playing stream the probe hears nothing from for this long means this browser hides it from Web Audio (iOS). */
const DEAF_AFTER_MS = 3000;

export type AudioEngineDeps = {
  createAudio?: () => HTMLAudioElement;
  createContext?: () => AudioContext;
};

export function createAudioEngine(deps: AudioEngineDeps = {}): AudioEngine {
  const createAudio =
    deps.createAudio ??
    (() => {
      const a = new Audio();
      a.preload = "none";
      return a;
    });
  const createContext = deps.createContext ?? (() => new AudioContext());

  const listeners: Record<AudioEngineEvent, Set<(s: Station) => void>> = {
    playing: new Set(),
    paused: new Set(),
    blocked: new Set(),
    failed: new Set(),
  };
  const emit = (event: AudioEngineEvent, station: Station) => {
    listeners[event].forEach((cb) => cb(station));
  };

  let audio: HTMLAudioElement | null = null;
  let ctx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let streamGain: GainNode | null = null;
  let staticGain: GainNode | null = null;
  let tuning = false;
  // A load was started and hasn't reached `playing` yet.
  let pending = false;
  let paused = false;
  // Tuning ended while a load was pending: static lingers until `playing` or the hold timer.
  let holding = false;
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let current: Station | null = null;
  let token = 0;
  let failedToken = 0;
  let volume = 1;
  // `paused` was already emitted for the current load: the element's own pause event must not repeat it.
  let pausedEmitted = false;
  let stallTimer: ReturnType<typeof setTimeout> | null = null;
  // Web Audio can't hear the stream here: the visualizer reads from `tap` instead. Cleared if the probe ever hears it.
  let probe: AnalyserNode | null = null;
  let probeData = new Uint8Array(0);
  let deafFor = 0;
  let deaf = false;
  let tap: StreamTap | null = null;

  function applyGains() {
    if (!ctx || !streamGain || !staticGain) return;
    const noisy = tuning || holding;
    const t = ctx.currentTime;
    streamGain.gain.setTargetAtTime(noisy ? STREAM_TUNING_GAIN : 1, t, GAIN_TIME_CONSTANT);
    staticGain.gain.setTargetAtTime(noisy && !paused ? STATIC_TUNING_GAIN * volume : 0, t, GAIN_TIME_CONSTANT);
  }

  function endHold() {
    if (holdTimer !== null) clearTimeout(holdTimer);
    holdTimer = null;
    if (!holding) return;
    holding = false;
    applyGains();
  }

  function settlePending() {
    pending = false;
    endHold();
  }

  function clearStall() {
    if (stallTimer !== null) clearTimeout(stallTimer);
    stallTimer = null;
  }

  // Armed when playback starts and on `waiting`; only `playing` (or pause/supersede) disarms it.
  function armStall() {
    if (stallTimer !== null || !current) return;
    const myToken = token;
    const station = current;
    stallTimer = setTimeout(() => {
      stallTimer = null;
      if (myToken === token) emitFailed(myToken, station);
    }, STALL_TIMEOUT_MS);
  }

  // A dead source fires `error` and rejects play(); report it once per load.
  function emitFailed(forToken: number, station: Station) {
    clearStall();
    settlePending();
    if (failedToken === forToken) return;
    failedToken = forToken;
    emit("failed", station);
  }

  function emitPaused() {
    clearStall();
    if (pausedEmitted || !current) return;
    pausedEmitted = true;
    paused = true;
    settlePending();
    applyGains();
    emit("paused", current);
  }

  function ensureAudio(): HTMLAudioElement {
    if (audio) return audio;
    const el = createAudio();
    el.crossOrigin = "anonymous";
    el.volume = volume;
    // Events always describe the current load: setting a new src replaces the old one.
    el.addEventListener("playing", () => {
      clearStall();
      paused = false;
      settlePending();
      if (current) emit("playing", current);
    });
    el.addEventListener("waiting", armStall);
    el.addEventListener("error", () => {
      if (current) emitFailed(token, current);
    });
    // A live stream that ends is a dead stream.
    el.addEventListener("ended", () => {
      if (current) emitFailed(token, current);
    });
    // Paused from outside the engine (OS media controls, headphones unplugged, ...).
    // A stale event from a superseded load arrives after play() un-paused the element: ignore it.
    el.addEventListener("pause", () => {
      if (el.paused) emitPaused();
    });
    audio = el;
    return el;
  }

  function createNoise(c: AudioContext): AudioBufferSourceNode {
    const buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
  }

  /**
   * Runs every PROBE_MS once the graph exists: decides whether Web Audio hears the stream, and keeps the tap running
   * only while it's needed — playing, page visible, and the stream deaf to Web Audio.
   */
  function probeTick() {
    const el = audio;
    const playingNow = !!el && !el.paused && !pending && !paused && current !== null;
    if (probe && playingNow && typeof probe.getByteTimeDomainData === "function") {
      if (probeData.length !== probe.fftSize) probeData = new Uint8Array(probe.fftSize);
      probe.getByteTimeDomainData(probeData);
      let heard = false;
      for (let i = 0; i < probeData.length; i++) {
        if (Math.abs(probeData[i] - 128) > 1) {
          heard = true;
          break;
        }
      }
      if (heard) {
        deafFor = 0;
        deaf = false;
      } else if ((deafFor += PROBE_MS) >= DEAF_AFTER_MS) deaf = true;
    } else deafFor = 0;

    const hidden = typeof document !== "undefined" && document.hidden;
    const want = deaf && playingNow && !hidden;
    if (want && ctx && current && !tap?.running) {
      tap ??= createStreamTap(ctx);
      tap.start(current.streamUrl);
    } else if (!want && tap?.running) tap.stop();
  }

  // Wired once: MediaElementSource can only be created once per element.
  function ensureGraph(el: HTMLAudioElement) {
    if (ctx) return;
    try {
      const c = createContext();
      const source = c.createMediaElementSource(el);
      const node = c.createAnalyser();
      node.fftSize = 512;
      node.smoothingTimeConstant = 0.5; // crisper than the 0.8 default, so kicks read as onsets
      const stream = c.createGain();
      source.connect(stream);
      stream.connect(node);
      const noise = createNoise(c);
      const band = c.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = 2600;
      band.Q.value = 0.4;
      const hiss = c.createGain();
      hiss.gain.value = 0;
      noise.connect(band);
      band.connect(hiss);
      hiss.connect(node);
      noise.start();
      node.connect(c.destination);
      // The probe listens to the stream alone (no static), through a muted gain so it is always processed.
      const p = c.createAnalyser();
      p.fftSize = 256;
      const probeMute = c.createGain();
      probeMute.gain.value = 0;
      stream.connect(p);
      p.connect(probeMute);
      probeMute.connect(c.destination);
      ctx = c;
      analyser = node;
      probe = p;
      streamGain = stream;
      staticGain = hiss;
      applyGains();
      setInterval(probeTick, PROBE_MS);
    } catch {
      // No Web Audio: playback still works, the visualizer just has no analyser.
    }
  }

  async function start(myToken: number, station: Station): Promise<void> {
    const el = ensureAudio();
    pausedEmitted = false;
    paused = false;
    pending = true;
    applyGains();
    armStall();
    try {
      // Kick off resume synchronously so it stays inside the user gesture.
      ctx?.resume().catch(() => {});
      await el.play();
    } catch (err) {
      if (myToken !== token) return;
      const name = err instanceof DOMException ? err.name : "";
      if (name === "AbortError") return;
      if (name === "NotAllowedError") {
        // Waiting for a tap is not a stall.
        clearStall();
        paused = true;
        settlePending();
        applyGains();
        emit("blocked", station);
      } else emitFailed(myToken, station);
    }
  }

  return {
    get analyser() {
      return deaf && tap?.running ? tap.analyser : analyser;
    },
    get tap() {
      return tap;
    },
    load(station) {
      const myToken = ++token;
      clearStall();
      current = station;
      const el = ensureAudio();
      ensureGraph(el);
      tap?.stop(); // the probe restarts it on the new stream once that plays
      el.src = station.streamUrl;
      return start(myToken, station);
    },
    play() {
      if (!current) return Promise.resolve();
      return start(token, current);
    },
    pause() {
      audio?.pause();
      emitPaused();
    },
    setVolume(v) {
      volume = Math.min(1, Math.max(0, v));
      if (audio) audio.volume = volume;
      applyGains();
    },
    setTuning(on) {
      const was = tuning;
      tuning = on;
      if (on) {
        endHold();
      } else if (was && pending && !holding) {
        holding = true;
        holdTimer = setTimeout(() => {
          holdTimer = null;
          endHold();
        }, TUNING_HOLD_MS);
      }
      applyGains();
    },
    on(event, cb) {
      listeners[event].add(cb);
      return () => {
        listeners[event].delete(cb);
      };
    },
  };
}

let singleton: AudioEngine | null = null;

/** Lazy browser singleton. Safe to import on the server; only call it in the browser. */
export function getAudioEngine(): AudioEngine {
  singleton ??= createAudioEngine();
  return singleton;
}
