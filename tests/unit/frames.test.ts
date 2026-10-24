import { describe, expect, it } from "vitest";
import { frameLength, splitFrames } from "@/lib/audio/frames";

/** MPEG-1 Layer III 128 kbps 44.1 kHz: 417 bytes; with the padding bit: 418. */
const mp3 = (padded = false) => {
  const f = new Uint8Array(padded ? 418 : 417);
  f.set([0xff, 0xfb, padded ? 0x92 : 0x90, 0x64]);
  return f;
};
/** ADTS AAC frame of `len` bytes. */
const adts = (len: number) => {
  const f = new Uint8Array(len);
  f.set([0xff, 0xf1, 0x50, 0x80 | ((len >> 11) & 3), (len >> 3) & 0xff, ((len & 7) << 5) | 0x1f, 0xfc]);
  return f;
};
const join = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

describe("frameLength", () => {
  it("reads MP3 and ADTS headers", () => {
    expect(frameLength(mp3(), 0)).toBe(417);
    expect(frameLength(mp3(true), 0)).toBe(418);
    expect(frameLength(adts(371), 0)).toBe(371);
    expect(frameLength(new Uint8Array(8), 0)).toBe(0);
  });
});

describe("splitFrames", () => {
  it("drops the partial frame in front, keeps whole frames, carries the partial frame at the end", () => {
    const tail = mp3().subarray(0, 100);
    const buf = join(mp3().subarray(300), mp3(), mp3(true), mp3(), tail);
    const { frames, rest } = splitFrames(buf);
    expect(frames?.length).toBe(417 + 418 + 417);
    expect([frames![0], frames![1]]).toEqual([0xff, 0xfb]);
    expect(rest).toEqual(tail);
  });

  it("frames ADTS AAC the same way", () => {
    const { frames, rest } = splitFrames(join(new Uint8Array(37), adts(300), adts(310), adts(320).subarray(0, 50)));
    expect(frames?.length).toBe(610);
    expect(rest.length).toBe(50);
  });

  it("ignores a stray sync pattern that the next frame doesn't confirm", () => {
    const fake = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 1, 2, 3, 4, 5, 6]);
    const { frames } = splitFrames(join(fake, mp3(), mp3()));
    expect(frames?.length).toBe(834); // both real frames, nothing from the fake header in front
  });

  it("waits for more data when there is no whole frame yet, and doesn't hoard non-audio bytes", () => {
    expect(splitFrames(mp3().subarray(0, 200))).toMatchObject({ frames: null });
    expect(splitFrames(new Uint8Array(70_000)).rest.length).toBe(8);
  });
});
