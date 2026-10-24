export const BAND_COUNT = 32;

const F_MIN = 30;
const F_MAX = 16000;
const PREVIEW_BPM = 124;

export type Analysis = {
  bands: Float32Array;
  bass: number;
  mid: number;
  treb: number;
  snare: number;
  kickDir: [number, number, number];
  kickAge: number;
  kickAmp: number;
  squash: number;
  flash: number;
};

type Internal = {
  rand: () => number;
  raw: Float32Array;
  peak: number;
  prevBass: number;
  squashVel: number;
  /** Levelled lowest bands from the previous frame, and the new bass energy that arrived since (spectral flux). */
  prevLow: Float32Array;
  flux: number;
  fluxAvg: number;
};

/** Bands whose rise counts towards a kick. */
const LOW_BANDS = 5;
/** A kick: bass flux at least this, and this many times its own running average. */
const FLUX_MIN = 0.12;
const FLUX_RATIO = 2.2;
const KICK_GAP_S = 0.18;

const internals = new WeakMap<Analysis, Internal>();

export function createAnalysis(rand: () => number = Math.random): Analysis {
  const a: Analysis = {
    bands: new Float32Array(BAND_COUNT),
    bass: 0,
    mid: 0,
    treb: 0,
    snare: 0,
    kickDir: [0, 1, 0],
    kickAge: 9,
    kickAmp: 0,
    squash: 0,
    flash: 0,
  };
  internals.set(a, {
    rand,
    raw: new Float32Array(BAND_COUNT),
    peak: 0.4,
    prevBass: 0,
    squashVel: 0,
    prevLow: new Float32Array(LOW_BANDS),
    flux: 0,
    fluxAvg: 0,
  });
  return a;
}

function average(bands: Float32Array, from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += bands[i];
  return sum / (to - from);
}

function readSpectrum(a: Analysis, s: Internal, freq: Uint8Array, sampleRate: number, dt: number): void {
  const nyquist = sampleRate / 2;
  const binCount = freq.length;
  const ratio = F_MAX / F_MIN;
  let max = 0;
  for (let b = 0; b < BAND_COUNT; b++) {
    const f0 = F_MIN * Math.pow(ratio, b / BAND_COUNT);
    const f1 = F_MIN * Math.pow(ratio, (b + 1) / BAND_COUNT);
    const i0 = Math.floor((f0 / nyquist) * binCount);
    const i1 = Math.max(i0 + 1, Math.ceil((f1 / nyquist) * binCount));
    let sum = 0;
    for (let i = i0; i < i1 && i < binCount; i++) sum += freq[i];
    // lift the quieter highs a little
    const v = (sum / (i1 - i0) / 255) * (1 + (b / BAND_COUNT) * 0.8);
    s.raw[b] = v;
    if (v > max) max = v;
  }
  // level control: normalise to a slow-decaying peak so quiet stations still move
  // Unsmoothed, so a kick still shows over a bassline that keeps the smoothed bass high. Measured against last frame's
  // peak: a kick that sets a new peak would otherwise level itself away.
  s.flux = 0;
  for (let b = 0; b < LOW_BANDS; b++) {
    const v = s.raw[b] / s.peak;
    s.flux += Math.max(0, v - s.prevLow[b]);
    s.prevLow[b] = v;
  }
  s.peak = Math.max(max, s.peak * Math.exp(-dt * 0.4), 0.15);
  for (let b = 0; b < BAND_COUNT; b++) {
    const v = Math.pow(Math.max(0, s.raw[b] / s.peak - 0.18) / 0.82, 1.6);
    const k = v > a.bands[b] ? 0.6 : 0.16;
    a.bands[b] += (v - a.bands[b]) * k;
  }
}

function breathe(a: Analysis, t: number): void {
  const beat = 60 / PREVIEW_BPM;
  const phase = (t % beat) / beat;
  const k = Math.exp(-6 * phase);
  for (let b = 0; b < BAND_COUNT; b++) {
    const x = b / BAND_COUNT;
    const v =
      (k * Math.exp(-9 * x) + 0.2 * (0.5 + 0.5 * Math.sin(1.3 * t + 0.4 * b)) * Math.exp(-4 * Math.abs(x - 0.4))) * 0.25;
    a.bands[b] += (v - a.bands[b]) * 0.3;
  }
}

export function stepAnalysis(a: Analysis, freq: Uint8Array | null, sampleRate: number, dt: number, t: number): void {
  const s = internals.get(a);
  if (!s) throw new Error("stepAnalysis: Analysis was not created by createAnalysis");

  if (freq) readSpectrum(a, s, freq, sampleRate, dt);
  else {
    breathe(a, t);
    s.flux = 0;
    s.prevLow.fill(0);
  }

  a.bass = average(a.bands, 0, 6);
  a.mid = average(a.bands, 8, 20);
  a.treb = average(a.bands, 22, 32);
  const snareNow = average(a.bands, 18, 24);
  a.snare += ((snareNow > 0.45 ? 1 : 0) - a.snare) * 0.2;

  // kickAge is advanced first so it reads exactly 0 on the frame a kick lands
  a.kickAge += dt;
  // Live audio: an onset in the bass flux. The preview pulse has no flux, so it keys off its own bass jumps.
  const onset = freq ? s.flux > Math.max(FLUX_MIN, s.fluxAvg * FLUX_RATIO) : a.bass - s.prevBass > 0.12;
  s.fluxAvg += (s.flux - s.fluxAvg) * Math.min(1, dt * 3);
  if (onset && a.kickAge > KICK_GAP_S) {
    a.kickAge = 0;
    a.kickAmp = Math.min(1, a.bass * 1.4);
    const theta = s.rand() * Math.PI * 2;
    const z = s.rand() * 1.6 - 0.8;
    const r = Math.sqrt(1 - z * z);
    a.kickDir = [r * Math.cos(theta), z, r * Math.sin(theta)];
    s.squashVel += 2.4 * a.kickAmp;
    a.flash = Math.max(a.flash, a.kickAmp);
  }
  s.prevBass = a.bass;

  // jelly spring
  s.squashVel += (-90 * a.squash - 9 * s.squashVel) * dt;
  a.squash += s.squashVel * dt;
  a.flash *= Math.exp(-7 * dt);
}
