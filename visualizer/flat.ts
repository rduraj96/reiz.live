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
const POINTS = 64;
const TUNE_UP_RATE = 7;
const TUNE_DOWN_RATE = 3.5;
/** The blob's chrome palette, cycled around the rim. */
const RIM = ["#ff3cc8", "#ffd23c", "#6cff5a", "#3c8cff", "#ff3cc8"];

/**
 * A flat Canvas 2D take on the chrome blob: an outline pushed out by the spectrum (lows at the top, highs at the
 * bottom, mirrored left/right), a turning rim gradient over a dark core, at 30 fps. Same contract as the 3D scene.
 */
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
  const xs = new Float32Array(POINTS);
  const ys = new Float32Array(POINTS);
  let active = false;
  let tuneTarget = 0;
  let tune = 0;
  let announced = false;
  let raf = 0;
  let last = 0;
  let t = 0;

  function draw() {
    const c = side / 2;
    const base = (side / (1 + 2 * BLEED)) * 0.37;
    const calm = 1 - tune;
    const breath = 1 + (0.1 * analysis.bass + 0.08 * analysis.squash * calm) * motion;

    for (let i = 0; i < POINTS; i++) {
      const a = (i / POINTS) * Math.PI * 2;
      // 0 at the top, 1 at the bottom, the same on both sides.
      const band = analysis.bands[Math.min(BAND_COUNT - 1, Math.floor(((1 - Math.cos(a)) / 2) * BAND_COUNT))];
      const wobble =
        Math.sin(3 * a + t * 1.1) * (0.015 + 0.04 * analysis.mid) + Math.sin(5 * a - t * 1.7) * 0.012 * (1 + analysis.treb);
      const jitter = tune * 0.05 * (Math.sin(a * 23 + t * 40) + Math.sin(a * 37 - t * 53)) * 0.5;
      const r = base * (breath + (0.16 * band + wobble) * motion * (1 - 0.6 * tune) + jitter);
      xs[i] = c + Math.sin(a) * r;
      ys[i] = c - Math.cos(a) * r;
    }

    ctx!.clearRect(0, 0, side, side);
    ctx!.beginPath();
    // A smooth closed curve through the midpoints, using the points as control points.
    ctx!.moveTo((xs[POINTS - 1] + xs[0]) / 2, (ys[POINTS - 1] + ys[0]) / 2);
    for (let i = 0; i < POINTS; i++) {
      const j = (i + 1) % POINTS;
      ctx!.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[j]) / 2, (ys[i] + ys[j]) / 2);
    }
    ctx!.closePath();

    const turn = t * 0.35;
    let rim: CanvasGradient;
    if (typeof ctx!.createConicGradient === "function") {
      rim = ctx!.createConicGradient(turn, c, c);
      RIM.forEach((col, k) => rim.addColorStop(k / (RIM.length - 1), col));
    } else {
      rim = ctx!.createLinearGradient(0, 0, side, side);
      RIM.forEach((col, k) => rim.addColorStop(k / (RIM.length - 1), col));
    }
    ctx!.fillStyle = rim;
    ctx!.fill();

    // Dark core so only the rim shows colour, like the chrome blob; a kick briefly lifts it.
    const core = ctx!.createRadialGradient(c, c * 1.04, 0, c, c, base * breath);
    core.addColorStop(0, "rgba(0,0,0,0.97)");
    core.addColorStop(0.62 - 0.12 * analysis.flash * calm * motion, "rgba(0,0,0,0.9)");
    core.addColorStop(1, "rgba(0,0,0,0)");
    ctx!.fillStyle = core;
    ctx!.fill();

    // A soft specular highlight up and to the left.
    const hx = c - base * 0.42;
    const hy = c - base * 0.5;
    const shine = ctx!.createRadialGradient(hx, hy, 0, hx, hy, base * 0.5);
    shine.addColorStop(0, `rgba(255,255,255,${0.22 + 0.25 * analysis.flash * calm * motion})`);
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx!.fillStyle = shine;
    ctx!.fill();
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
