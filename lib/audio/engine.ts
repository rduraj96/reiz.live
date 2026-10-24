import type { Station } from "@/lib/radio/types";

export type AudioEngineEvent = "playing" | "paused" | "blocked" | "failed";

export interface AudioEngine {
  load(station: Station): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  setVolume(v: number): void;
  setMuted(m: boolean): void;
  readonly analyser: AnalyserNode | null;
  on(event: AudioEngineEvent, cb: (station: Station) => void): () => void;
}

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
  let current: Station | null = null;
  let token = 0;
  let failedToken = 0;
  let volume = 1;
  let muted = false;

  // A dead source fires `error` and rejects play(); report it once per load.
  function emitFailed(forToken: number, station: Station) {
    if (failedToken === forToken) return;
    failedToken = forToken;
    emit("failed", station);
  }

  function ensureAudio(): HTMLAudioElement {
    if (audio) return audio;
    const el = createAudio();
    el.crossOrigin = "anonymous";
    el.volume = volume;
    el.muted = muted;
    // Events always describe the current load: setting a new src replaces the old one.
    el.addEventListener("playing", () => {
      if (current) emit("playing", current);
    });
    el.addEventListener("error", () => {
      if (current) emitFailed(token, current);
    });
    audio = el;
    return el;
  }

  // Wired once: MediaElementSource can only be created once per element.
  function ensureGraph(el: HTMLAudioElement) {
    if (ctx) return;
    try {
      const c = createContext();
      const source = c.createMediaElementSource(el);
      const node = c.createAnalyser();
      node.fftSize = 512;
      source.connect(node);
      node.connect(c.destination);
      ctx = c;
      analyser = node;
    } catch {
      // No Web Audio: playback still works, the visualizer just has no analyser.
    }
  }

  async function start(myToken: number, station: Station): Promise<void> {
    const el = ensureAudio();
    try {
      // Kick off resume synchronously so it stays inside the user gesture.
      ctx?.resume().catch(() => {});
      await el.play();
    } catch (err) {
      if (myToken !== token) return;
      const name = err instanceof DOMException ? err.name : "";
      if (name === "AbortError") return;
      if (name === "NotAllowedError") emit("blocked", station);
      else emitFailed(myToken, station);
    }
  }

  return {
    get analyser() {
      return analyser;
    },
    load(station) {
      const myToken = ++token;
      current = station;
      const el = ensureAudio();
      ensureGraph(el);
      el.src = station.streamUrl;
      return start(myToken, station);
    },
    play() {
      if (!current) return Promise.resolve();
      return start(token, current);
    },
    pause() {
      audio?.pause();
      if (current) emit("paused", current);
    },
    setVolume(v) {
      volume = Math.min(1, Math.max(0, v));
      if (audio) audio.volume = volume;
    },
    setMuted(m) {
      muted = m;
      if (audio) audio.muted = m;
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
