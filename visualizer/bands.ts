export type Bands = { bass: number; mid: number; treble: number };

function sliceMean(freq: Uint8Array, start: number, end: number): number {
  if (end <= start) return 0;
  let sum = 0;
  for (let i = start; i < end; i++) sum += freq[i];
  return sum / (end - start) / 255;
}

/**
 * Splits a byte spectrum into three 0..1 bands: bins 0–10% → bass,
 * 10–40% → mid, 40–100% → treble; each is the slice mean ÷ 255.
 * Pass `out` to reuse an object across frames.
 */
export function computeBands(
  freq: Uint8Array,
  out: Bands = { bass: 0, mid: 0, treble: 0 },
): Bands {
  const n = freq.length;
  const bassEnd = Math.floor(n * 0.1);
  const midEnd = Math.floor(n * 0.4);
  out.bass = sliceMean(freq, 0, bassEnd);
  out.mid = sliceMean(freq, bassEnd, midEnd);
  out.treble = sliceMean(freq, midEnd, n);
  return out;
}

function step(prev: number, next: number, attack: number, release: number): number {
  return prev + (next - prev) * (next > prev ? attack : release);
}

/**
 * Per-band exponential smoothing: moves `attack` of the way toward a higher
 * value and `release` of the way toward a lower one. Pass `out` to reuse an
 * object across frames.
 */
export function smoothBands(
  prev: Bands,
  next: Bands,
  attack = 0.5,
  release = 0.12,
  out: Bands = { bass: 0, mid: 0, treble: 0 },
): Bands {
  out.bass = step(prev.bass, next.bass, attack, release);
  out.mid = step(prev.mid, next.mid, attack, release);
  out.treble = step(prev.treble, next.treble, attack, release);
  return out;
}
