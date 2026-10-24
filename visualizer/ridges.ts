import { BAND_COUNT, createAnalysis, stepAnalysis } from "./analysis";
import { FIRST_FRAME_EVENT } from "./events";
import type { Visualizer } from "./scene";
import { createSpectrumReader } from "./spectrum";

/** Lines in the field, and points per line. */
const ROWS = 50;
const COLS = 96;
/** A new line of signal enters at the front this often (slower with reduced motion). */
const ROW_MS = 45;
const ROW_MS_REDUCED = 180;
const FRAME_MS = 1000 / 30;
const MAX_DT = 0.08;
const TUNE_UP_RATE = 7;
const TUNE_DOWN_RATE = 3.5;
const REDUCED_MOTION_SCALE = 0.4;
const HOT = "238, 38, 71";
/** Each line is filled with the page colour below it, so it hides the lines behind. */
const BACKING = "#0a0a0a";

type Row = { v: Float32Array; kick: number };

/**
 * Signal ridges: lines of the live spectrum stacked in perspective, rolling toward the viewer. The bass sits in the
 * middle of each line (mirrored out to the treble at the edges); a kick sends a red line forward. Fills its container
 * (the whole stage). Same contract as the 3D scene.
 */
export function createRidgesVisualizer(
  container: HTMLElement,
  getAnalyser: () => AnalyserNode | null,
  opts: { reducedMotion: boolean },
): Visualizer {
  const motion = opts.reducedMotion ? REDUCED_MOTION_SCALE : 1;
  const rowMs = opts.reducedMotion ? ROW_MS_REDUCED : ROW_MS;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", display: "block" });
  canvas.dataset.viz = "ridges";

  const resize = (w: number, h: number) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
  };
  resize(container.clientWidth, container.clientHeight);
  container.appendChild(canvas);

  const analysis = createAnalysis();
  const reader = createSpectrumReader(getAnalyser);
  const rows: Row[] = Array.from({ length: ROWS }, () => ({ v: new Float32Array(COLS), kick: 0 }));
  let active = false;
  let tuneTarget = 0;
  let tune = 0;
  let pendingKick = 0;
  let sinceRow = 0;
  let announced = false;
  let raf = 0;
  let last = 0;
  let t = 0;

  /** The newest line enters at the front; the oldest drops off the back. */
  function pushRow() {
    const row = rows.pop()!;
    for (let c = 0; c < COLS; c++) {
      const x = c / (COLS - 1);
      const centre = Math.exp(-(((x - 0.5) / 0.2) ** 2));
      const band = analysis.bands[Math.min(BAND_COUNT - 1, Math.floor(Math.abs(x - 0.5) * 2 * (BAND_COUNT - 1)))];
      const drift = 0.04 * (Math.sin(c * 1.9 + t * 3) + Math.sin(c * 3.7 - t * 5));
      const noise = tune * (Math.random() - 0.5) * 0.5;
      row.v[c] = Math.max(0, ((band * (1 - 0.6 * tune) + drift) * motion + noise + 0.05) * centre + 0.015 * Math.random());
    }
    row.kick = pendingKick;
    pendingKick = 0;
    rows.unshift(row);
  }

  function draw() {
    const W = canvas.width;
    const H = canvas.height;
    const lineScale = Math.min(window.devicePixelRatio || 1, 2);
    ctx!.clearRect(0, 0, W, H);
    const top = H * 0.08;
    const bottom = H * 0.97;
    // Back to front: each line is filled below so it hides the ones behind it.
    for (let r = ROWS - 1; r >= 0; r--) {
      const depth = 1 - r / (ROWS - 1); // 1 = the front line
      const y0 = top + (bottom - top) * depth ** 1.6;
      const half = W * (0.2 + 0.3 * depth);
      const amp = H * (0.1 + 0.32 * depth);
      const row = rows[r];
      const line = new Path2D();
      for (let c = 0; c < COLS; c++) {
        const x = W / 2 + (c / (COLS - 1) - 0.5) * 2 * half;
        const y = y0 - row.v[c] * amp;
        if (c === 0) line.moveTo(x, y);
        else line.lineTo(x, y);
      }
      // Fill down to the floor, but stroke only the line itself.
      const body = new Path2D(line);
      body.lineTo(W / 2 + half, H);
      body.lineTo(W / 2 - half, H);
      body.closePath();
      ctx!.fillStyle = BACKING;
      ctx!.fill(body);
      const hot = row.kick > 0;
      ctx!.lineWidth = (hot ? 2.2 : 1.2) * lineScale * (0.6 + 0.6 * depth);
      ctx!.strokeStyle = hot
        ? `rgba(${HOT}, ${(0.5 + 0.5 * depth) * Math.min(1, 0.5 + row.kick)})`
        : `rgba(240, 240, 240, ${0.18 + 0.8 * depth * depth})`;
      ctx!.stroke(line);
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
    if (analysis.kickAge === 0) pendingKick = Math.max(pendingKick, analysis.kickAmp * (1 - tune));
    sinceRow += dt * 1000;
    while (sinceRow >= rowMs) {
      sinceRow -= rowMs;
      pushRow();
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
    resize(box.width, box.height);
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
