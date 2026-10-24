import { BAND_COUNT, createAnalysis, stepAnalysis } from "./analysis";
import { FIRST_FRAME_EVENT } from "./events";
import type { Visualizer } from "./scene";
import { createSpectrumReader } from "./spectrum";

const REDUCED_MOTION_SCALE = 0.4;
/** Same overhang as the 3D canvas so kicks and squash aren't clipped. */
const BLEED = 0.12;
/** Half the 3D frame rate: the point of the 2D mode is a light load. */
const FRAME_MS = 1000 / 30;
const MAX_DT = 0.08;
const TUNE_UP_RATE = 7;
const TUNE_DOWN_RATE = 3.5;
/** Dots across the field's diameter. */
const GRID = 23;
/** Field radius as a share of the container (the 3D blob is about this size). */
const FIELD = 0.48;
const RIPPLE_SPEED = 0.9;
const RIPPLE_WIDTH = 0.07;
const RIPPLE_DECAY = 2.2;
const MAX_RIPPLES = 8;
const HOT = "#ee2647";
/** Above what the spectrum alone reaches, so only a kick ripple turns dots red. */
const HOT_LEVEL = 1;
const BACKING = "#0a0a0a";

export function createFlatVisualizer(
  container: HTMLElement,
  getAnalyser: () => AnalyserNode | null,
  opts: { reducedMotion: boolean },
): Visualizer {
  const motion = opts.reducedMotion ? REDUCED_MOTION_SCALE : 1;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  const inset = `${-BLEED * 100}%`;
  const extent = `${(1 + 2 * BLEED) * 100}%`;
  Object.assign(canvas.style, {
    position: "absolute",
    top: inset,
    left: inset,
    width: extent,
    height: extent,
    display: "block",
    pointerEvents: "none",
  });
  canvas.dataset.viz = "2d";

  let side = 1;
  const resize = (box: number) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    side = Math.max(1, Math.round(box * (1 + 2 * BLEED) * dpr));
    canvas.width = side;
    canvas.height = side;
  };
  resize(container.clientWidth);
  container.appendChild(canvas);

  const analysis = createAnalysis();
  const reader = createSpectrumReader(getAnalyser);
  /** Kick ripples: age in seconds and strength. */
  const ripples: { age: number; amp: number }[] = [];
  let active = false;
  let tuneTarget = 0;
  let tune = 0;
  let announced = false;
  let raf = 0;
  let last = 0;
  let t = 0;

  function draw() {
    const c = side / 2;
    const fieldR = (side / (1 + 2 * BLEED)) * FIELD;
    const step = (2 * fieldR) / GRID;
    const quiet = 1 - 0.5 * tune;
    ctx!.clearRect(0, 0, side, side);
    // A dark disc behind the field, so the big name behind it doesn't show through the gaps (the 3D blob hides it too).
    ctx!.fillStyle = BACKING;
    ctx!.beginPath();
    ctx!.arc(c, c, fieldR + step * 0.7, 0, Math.PI * 2);
    ctx!.fill();
    for (let yi = 0; yi <= GRID; yi++) {
      for (let xi = 0; xi <= GRID; xi++) {
        const x = c - fieldR + xi * step;
        const y = c - fieldR + yi * step;
        const d = Math.hypot(x - c, y - c) / fieldR;
        if (d > 1) continue;
        // Centre = bass, rim = treble.
        let v = analysis.bands[Math.min(BAND_COUNT - 1, Math.floor(d * BAND_COUNT))] * 0.95;
        for (const r of ripples) {
          v += r.amp * Math.exp(-(((d - r.age * RIPPLE_SPEED) / RIPPLE_WIDTH) ** 2)) * Math.exp(-r.age * RIPPLE_DECAY);
        }
        const jitter = tune * (Math.sin(xi * 12.9 + yi * 78.2 + t * 47) * 0.5 + 0.5);
        v = Math.min(1.15, (v * quiet + jitter * 0.6) * motion + 0.04);
        ctx!.fillStyle = v > HOT_LEVEL ? HOT : `hsl(0 0% ${35 + v * 60}%)`;
        ctx!.beginPath();
        ctx!.arc(x + jitter * step * 0.3, y, step * (0.08 + 0.42 * v), 0, Math.PI * 2);
        ctx!.fill();
      }
    }
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (last && now - last < FRAME_MS - 2) return;
    const dt = last ? Math.min((now - last) / 1000, MAX_DT) : FRAME_MS / 1000;
    last = now;
    t += dt;

    const read = reader.read(active, dt);
    stepAnalysis(analysis, read?.freq ?? null, read?.sampleRate ?? 0, dt, t);
    tune += (tuneTarget - tune) * Math.min(1, (tuneTarget > tune ? TUNE_UP_RATE : TUNE_DOWN_RATE) * dt);
    for (const r of ripples) r.age += dt;
    while (ripples.length && ripples[0].age * RIPPLE_SPEED > 1.2) ripples.shift();
    if (analysis.kickAge === 0 && !opts.reducedMotion) {
      ripples.push({ age: 0, amp: analysis.kickAmp * (1 - tune) });
      if (ripples.length > MAX_RIPPLES) ripples.shift();
    }
    draw();

    if (!announced) {
      announced = true;
      window.dispatchEvent(new Event(FIRST_FRAME_EVENT));
    }
  }

  const start = () => {
    if (!raf) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener("visibilitychange", onVisibility);

  const resizeObserver = new ResizeObserver((entries) => {
    const box = entries[0]?.contentRect;
    if (!box || box.width === 0) return;
    resize(box.width);
  });
  resizeObserver.observe(container);

  if (!document.hidden) start();

  return {
    setActive(next: boolean) {
      active = next;
    },
    setTuning(on: boolean) {
      tuneTarget = on ? 1 : 0;
    },
    dispose() {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      resizeObserver.disconnect();
      canvas.remove();
    },
  };
}
