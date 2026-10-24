"use client";

import { useEffect, useState } from "react";
import { getAudioEngine } from "@/lib/audio/engine";
import { usePlayer } from "@/store/player";

/** `?debug` only: what the audio graph actually sees, for diagnosing devices (iOS) where the visualizer hears nothing. */
export function AudioDebug() {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("debug")) return;
    if (params.get("debug") === "tap") getAudioEngine().forceTap();
    let freq = new Uint8Array(0);
    let wave = new Uint8Array(0);
    const id = setInterval(() => {
      const { analyser, element } = getAudioEngine();
      const out = [`status ${usePlayer.getState().status}  tuning ${usePlayer.getState().tuning}`];
      if (element) {
        let host = "";
        try {
          host = new URL(element.currentSrc).host;
        } catch {}
        out.push(
          `el paused ${element.paused}  ready ${element.readyState}  net ${element.networkState}  t ${element.currentTime.toFixed(1)}`,
          `src ${host}  cors ${element.crossOrigin}`,
        );
      } else out.push("no audio element yet");
      if (analyser) {
        if (freq.length !== analyser.frequencyBinCount) freq = new Uint8Array(analyser.frequencyBinCount);
        if (wave.length !== analyser.fftSize) wave = new Uint8Array(analyser.fftSize);
        analyser.getByteFrequencyData(freq);
        analyser.getByteTimeDomainData(wave);
        let fmax = 0;
        let fsum = 0;
        for (const v of freq) {
          fmax = Math.max(fmax, v);
          fsum += v;
        }
        let dev = 0;
        for (const v of wave) dev = Math.max(dev, Math.abs(v - 128));
        const c = analyser.context as AudioContext;
        out.push(
          `ctx ${c.state}  rate ${c.sampleRate}  base ${c.baseLatency?.toFixed?.(3) ?? "?"}`,
          `freq max ${fmax}  avg ${(fsum / freq.length).toFixed(1)}  wave dev ${dev}`,
        );
      } else out.push("no analyser (no Web Audio graph)");
      const tap = getAudioEngine().tap;
      out.push(
        tap
          ? `tap ${tap.running ? "on" : "off"}  chunks ${tap.stats.chunks}  fails ${tap.stats.failures}${tap.stats.gaveUp ? "  gave up" : ""}`
          : "tap not needed",
      );
      out.push(navigator.userAgent.replace(/^Mozilla\/5\.0 /, "").slice(0, 90));
      setLines(out);
    }, 500);
    return () => clearInterval(id);
  }, []);

  if (lines.length === 0) return null;
  return (
    <pre className="pointer-events-none fixed left-2 top-20 z-[60] max-w-[calc(100vw-1rem)] whitespace-pre-wrap rounded bg-black/85 p-2 font-mono text-[10px] leading-snug text-[#7CFC00]">
      {lines.join("\n")}
    </pre>
  );
}
