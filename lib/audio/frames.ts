// Safari's decodeAudioData only accepts a slice of a live stream that starts on a frame boundary (Chrome takes any
// slice), so the tap cuts the stream into whole MP3 / ADTS-AAC frames before decoding.

const MP3_KBPS = {
  v1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  v2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const MP3_RATES: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
/** Give up looking for a frame in a buffer this big: it isn't MP3 or AAC. */
const MAX_UNSYNCED = 64 * 1024;

/** Byte length of the MP3 (Layer III) or ADTS AAC frame whose header starts at `i`, or 0 if there is none. */
export function frameLength(a: Uint8Array, i: number): number {
  if (i + 6 > a.length || a[i] !== 0xff) return 0;
  const b1 = a[i + 1];
  // ADTS: 12-bit sync, layer 00.
  if ((b1 & 0xf6) === 0xf0) {
    const len = ((a[i + 3] & 0x03) << 11) | (a[i + 4] << 3) | (a[i + 5] >> 5);
    return len >= 7 ? len : 0;
  }
  if ((b1 & 0xe0) !== 0xe0) return 0;
  const version = (b1 >> 3) & 3; // 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5, 1 = reserved
  const layer = (b1 >> 1) & 3; // 1 = Layer III
  if (version === 1 || layer !== 1) return 0;
  const bitrateIndex = a[i + 2] >> 4;
  const rateIndex = (a[i + 2] >> 2) & 3;
  if (bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) return 0;
  const kbps = (version === 3 ? MP3_KBPS.v1 : MP3_KBPS.v2)[bitrateIndex];
  const padding = (a[i + 2] >> 1) & 1;
  return Math.floor(((version === 3 ? 144 : 72) * kbps * 1000) / MP3_RATES[version][rateIndex]) + padding;
}

/** A frame header at `i` that the next frame confirms (a lone 0xFF byte pair in audio data is common). */
function confirmedAt(a: Uint8Array, i: number): boolean {
  const len = frameLength(a, i);
  return len > 0 && frameLength(a, i + len) > 0;
}

/**
 * Splits buffered stream bytes into the whole frames that can be decoded now and the rest, to keep for the next
 * chunk. `frames` is null when no complete frame is available yet.
 */
export function splitFrames(buf: Uint8Array): { frames: Uint8Array | null; rest: Uint8Array } {
  let start = -1;
  for (let i = 0; i + 6 <= buf.length; i++) {
    if (buf[i] === 0xff && confirmedAt(buf, i)) {
      start = i;
      break;
    }
  }
  if (start < 0) {
    // Not MP3/AAC, or no frame yet: keep a tail that could hold the start of a header.
    return { frames: null, rest: buf.length > MAX_UNSYNCED ? buf.slice(-8) : buf };
  }
  let end = start;
  for (let len = frameLength(buf, end); len > 0 && end + len <= buf.length; len = frameLength(buf, end)) end += len;
  return { frames: end > start ? buf.slice(start, end) : null, rest: buf.slice(end) };
}
