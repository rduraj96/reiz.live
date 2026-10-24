"use client";

import { useEffect, useRef, useState } from "react";
import { introTarget, stepIntro } from "@/lib/intro/progress";
import { useDial } from "@/store/dial";
import { usePlayer } from "@/store/player";
import { tunerApi } from "@/components/Tuner";
import styles from "./Intro.module.css";

const FIRST_FRAME_EVENT = "visualizer-first-frame";
const FREQ_MIN = 87.5;
const FREQ_SPAN = 20.5;
const HOLD_MS = 350;
const SPLIT_MS = 850;
const REVEAL_MS = 1100;
const FADE_MS = 400;
const SPLIT_EASE = "cubic-bezier(.76,0,.24,1)";
const SPLIT_FROM = "polygon(0 0, 100% 0, 100% 50%, 0 50%, 0 50%, 100% 50%, 100% 100%, 0 100%)";
const SPLIT_TO = "polygon(0 0, 100% 0, 100% 0, 0 0, 0 100%, 100% 100%, 100% 100%, 0 100%)";
const GLIDE_RETRY_MS = 2000;

/** Set once the intro has finished: later mounts (client navigation) skip it. */
let introDone = false;

/**
 * The visualizer's first frame can land before Intro mounts (Visualizer is a child of the same page), so the
 * listener is attached when this module loads, which is before any component mounts.
 */
let frameDrawn = false;
if (typeof window !== "undefined") {
  window.addEventListener(FIRST_FRAME_EVENT, () => (frameDrawn = true), { once: true });
}

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The needle's band if it is ready, else the first ready band; its first station. */
function firstStationId(): string | null {
  const { bands, needleGenre } = useDial.getState();
  const ready = (b: (typeof bands)[number]) => b.state === "ready" && b.stations.length > 0;
  const band = bands.find((b) => b.genre === needleGenre && ready(b)) ?? bands.find(ready);
  return band?.stations[0].id ?? null;
}

/** Glide the dial onto `id`, retrying a few frames while the Tuner hasn't registered yet. */
function glideWhenReady(id: string, fromOffset: number | undefined, deadline = performance.now() + GLIDE_RETRY_MS) {
  if (tunerApi.frequencyOf(id) !== null) {
    tunerApi.glideTo(id, { fromOffset, prime: true });
  } else if (performance.now() < deadline) {
    requestAnimationFrame(() => glideWhenReady(id, fromOffset, deadline));
  }
}

/** Frequency loader: the needle sweeps 87.5 to 108.0 MHz as real loading progresses, then the screen splits open. */
export function Intro() {
  const [shown, setShown] = useState(!introDone);
  const layerRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const capRef = useRef<HTMLSpanElement>(null);
  const needleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (introDone) return;
    const layer = layerRef.current;
    if (!layer) return;
    const reduced = prefersReducedMotion();
    const main = document.querySelector("main");
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const animations: Animation[] = [];
    let unsubBand = () => {};

    const finish = () => {
      introDone = true;
      setShown(false);
    };

    // Autoplay is blocked: prime the first station rather than selecting it. A shared station is already current.
    // The band may still be loading (cold start, or the directory is down until Retry): then prime as soon as one is
    // ready, from wherever the dial is (no glide-in from the left).
    const primeFirst = (fromOffset?: number) => {
      const id = firstStationId();
      if (id) {
        if (!usePlayer.getState().current) glideWhenReady(id, fromOffset);
        return;
      }
      unsubBand();
      unsubBand = useDial.subscribe(() => {
        const late = firstStationId();
        // Not while the user is turning the dial: a later dial change (needle, bands) retries.
        if (!late || usePlayer.getState().tuning) return;
        unsubBand();
        if (!usePlayer.getState().current) glideWhenReady(late, undefined);
      });
    };

    if (reduced) {
      const fade = layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, fill: "forwards" });
      animations.push(fade);
      fade.finished.then(() => !cancelled && finish()).catch(() => {});
      primeFirst();
      return () => {
        cancelled = true;
        unsubBand();
        animations.forEach((a) => a.cancel());
      };
    }

    let fonts = false;
    document.fonts.ready.then(() => (fonts = true));

    const render = (p: number) => {
      if (numRef.current) numRef.current.textContent = (FREQ_MIN + p * FREQ_SPAN).toFixed(1);
      if (needleRef.current) needleRef.current.style.left = `${8 + 84 * p}%`;
    };

    const reveal = () => {
      // Marked once the exit begins (not at effect start: StrictMode's dev double-run would otherwise skip run 2).
      introDone = true;
      if (capRef.current) capRef.current.textContent = "MHz · signal locked";
      timer = setTimeout(() => {
        if (cancelled) return;
        animations.push(
          layer.animate([{ clipPath: SPLIT_FROM }, { clipPath: SPLIT_TO }], {
            duration: SPLIT_MS,
            easing: SPLIT_EASE,
            fill: "forwards",
          }),
        );
        if (main) {
          animations.push(
            main.animate(
              [
                { transform: "scale(1.08)", filter: "brightness(0.55)" },
                { transform: "scale(1)", filter: "brightness(1)" },
              ],
              { duration: REVEAL_MS, easing: SPLIT_EASE },
            ),
          );
        }
        primeFirst(-700);
        timer = setTimeout(finish, SPLIT_MS);
      }, HOLD_MS);
    };

    const start = performance.now();
    let last = start;
    let p = 0;
    const tick = (now: number) => {
      const target = introTarget({
        fonts,
        band: useDial.getState().firstBandReady,
        frame: frameDrawn,
      });
      p = stepIntro(p, target, now - start, now - last);
      last = now;
      render(p);
      if (p >= 1) reveal();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      unsubBand();
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      animations.forEach((a) => a.cancel());
    };
  }, []);

  if (!shown) return null;
  return (
    <div
      ref={layerRef}
      role="status"
      data-testid="intro"
      className={`${styles.layer} fixed inset-0 z-[100]`}
    >
      <div className={styles.read}>
        <span ref={numRef} data-testid="intro-reading" aria-hidden="true" className={styles.num}>
          87.5
        </span>
        <span ref={capRef} aria-live="polite" className={styles.cap}>
          MHz · tuning in
        </span>
      </div>
      <div aria-hidden="true" className={styles.scale} />
      <div aria-hidden="true" ref={needleRef} className={styles.needle} />
      <div aria-hidden="true" className={styles.ends}>
        <span>87.5</span>
        <span>98</span>
        <span>108</span>
      </div>
    </div>
  );
}
