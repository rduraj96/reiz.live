/** How long an all-zero spectrum may last while playing before it counts as an analyser that can't hear the stream. */
export const SILENT_AFTER_S = 1.5;

/**
 * Reads the analyser's byte spectrum each frame. Returns null when there is nothing to read — inactive, no analyser,
 * or a spectrum that has stayed all zeros for SILENT_AFTER_S (iOS Safari can hand live streams to the speaker while the
 * analyser hears silence) — so the caller falls back to its built-in pulse instead of freezing.
 */
export function createSpectrumReader(getAnalyser: () => AnalyserNode | null) {
  let freq = new Uint8Array(0);
  let silentFor = 0;

  return {
    read(active: boolean, dt: number): { freq: Uint8Array; sampleRate: number } | null {
      const analyser = active ? getAnalyser() : null;
      if (!analyser) {
        silentFor = 0;
        return null;
      }
      if (freq.length !== analyser.frequencyBinCount) freq = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freq);
      let any = false;
      for (let i = 0; i < freq.length; i++) {
        if (freq[i] !== 0) {
          any = true;
          break;
        }
      }
      silentFor = any ? 0 : silentFor + dt;
      return silentFor >= SILENT_AFTER_S ? null : { freq, sampleRate: analyser.context.sampleRate };
    },
  };
}
