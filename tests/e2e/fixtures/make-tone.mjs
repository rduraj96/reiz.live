// Writes a 30 s 220 Hz sine, 8 kHz mono 16-bit PCM WAV next to this file.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rate = 8000;
const seconds = 30;
const samples = rate * seconds;
const buf = Buffer.alloc(44 + samples * 2);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + samples * 2, 4);
buf.write("WAVEfmt ", 8);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20); // PCM
buf.writeUInt16LE(1, 22); // mono
buf.writeUInt32LE(rate, 24);
buf.writeUInt32LE(rate * 2, 28);
buf.writeUInt16LE(2, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(samples * 2, 40);
for (let i = 0; i < samples; i++) {
  buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * i) / rate) * 0.5 * 32767), 44 + i * 2);
}
writeFileSync(fileURLToPath(new URL("./tone.wav", import.meta.url)), buf);
