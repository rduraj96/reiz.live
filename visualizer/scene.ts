import * as THREE from "three";
import { BAND_COUNT, createAnalysis, stepAnalysis } from "./analysis";
import { FIRST_FRAME_EVENT } from "./events";
import { createSpectrumReader } from "./spectrum";
import { blobFragmentShader, blobVertexShader } from "./shaders";

export type Visualizer = {
  setActive(active: boolean): void;
  setTuning(on: boolean): void;
  dispose(): void;
};

const REDUCED_MOTION_SCALE = 0.4;
/** The canvas overhangs the container by this fraction on each side so kicks and squash aren't clipped. */
const BLEED = 0.12;
const TUNE_UP_RATE = 7;
const TUNE_DOWN_RATE = 3.5;
const MAX_DT = 0.05;
const LARGE_BLOB_PX = 480;

/**
 * Mounts the raymarched liquid chrome blob into `container` (a square). Reads
 * the analyser each frame while active; breathes a calm preview otherwise.
 * Throws if WebGL is unavailable.
 */
export function createVisualizer(
  container: HTMLElement,
  getAnalyser: () => AnalyserNode | null,
  opts: { reducedMotion: boolean },
): Visualizer {
  const motion = opts.reducedMotion ? REDUCED_MOTION_SCALE : 1;
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, premultipliedAlpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCoarsePointer ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);

  const canvas = renderer.domElement;
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
  canvas.dataset.viz = "3d";

  const spectrumBytes = new Uint8Array(BAND_COUNT);
  const spectrum = new THREE.DataTexture(spectrumBytes, BAND_COUNT, 1, THREE.RedFormat, THREE.UnsignedByteType);
  spectrum.minFilter = THREE.LinearFilter;
  spectrum.magFilter = THREE.LinearFilter;
  spectrum.wrapS = THREE.ClampToEdgeWrapping;
  spectrum.wrapT = THREE.ClampToEdgeWrapping;
  spectrum.unpackAlignment = 1;
  spectrum.needsUpdate = true;

  const material = new THREE.ShaderMaterial({
    defines: { STEPS: isCoarsePointer ? 64 : 90 },
    uniforms: {
      res: { value: new THREE.Vector2(1, 1) },
      time: { value: 0 },
      bass: { value: 0 },
      mid: { value: 0 },
      treb: { value: 0 },
      snare: { value: 0 },
      tune: { value: 0 },
      kickDir: { value: new THREE.Vector3(0, 1, 0) },
      kickAge: { value: 9 },
      kickAmp: { value: 0 },
      squash: { value: 0 },
      flash: { value: 0 },
      spec: { value: spectrum },
    },
    vertexShader: blobVertexShader,
    fragmentShader: blobFragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(geometry, material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const resize = (side: number) => {
    // Every pixel is raymarched: a big blob on a retina screen renders at 1.5x, not 2x.
    const maxRatio = isCoarsePointer || side > LARGE_BLOB_PX ? 1.5 : 2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxRatio));
    const px = Math.max(1, side * (1 + 2 * BLEED));
    renderer.setSize(px, px, false);
    renderer.getDrawingBufferSize(material.uniforms.res.value);
  };
  resize(container.clientWidth);
  container.appendChild(canvas);

  const timer = new THREE.Timer();
  timer.connect(document);

  const analysis = createAnalysis();
  const reader = createSpectrumReader(getAnalyser);
  let active = false;
  let tuneTarget = 0;
  let tune = 0;
  let announced = false;
  const u = material.uniforms;

  function frame(timestamp: number) {
    timer.update(timestamp);
    const dt = Math.min(timer.getDelta(), MAX_DT);
    const t = timer.getElapsed();

    const read = reader.read(active, dt);
    stepAnalysis(analysis, read?.freq ?? null, read?.sampleRate ?? 0, dt, t);

    tune += (tuneTarget - tune) * Math.min(1, (tuneTarget > tune ? TUNE_UP_RATE : TUNE_DOWN_RATE) * dt);

    const spectrumGain = 255 * (1 - 0.7 * tune) * motion;
    for (let b = 0; b < BAND_COUNT; b++) {
      spectrumBytes[b] = Math.round(Math.min(1, analysis.bands[b]) * spectrumGain);
    }
    spectrum.needsUpdate = true;

    const calm = 1 - tune;
    const [kx, ky, kz] = analysis.kickDir; // reassigned on each kick: read it fresh
    u.time.value = t;
    u.bass.value = analysis.bass * motion;
    u.mid.value = analysis.mid * motion;
    u.treb.value = analysis.treb * motion;
    u.snare.value = analysis.snare * motion;
    u.tune.value = tune;
    u.kickDir.value.set(kx, ky, kz);
    u.kickAge.value = analysis.kickAge;
    u.kickAmp.value = opts.reducedMotion ? 0 : analysis.kickAmp * calm;
    u.squash.value = analysis.squash * calm * motion;
    u.flash.value = analysis.flash * calm * motion;

    renderer.render(scene, camera);

    if (!announced) {
      announced = true;
      window.dispatchEvent(new Event(FIRST_FRAME_EVENT));
    }
  }

  const start = () => renderer.setAnimationLoop(frame);
  const stop = () => renderer.setAnimationLoop(null);

  const onVisibility = () => {
    if (document.hidden) stop();
    else start();
  };
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
      timer.dispose();
      scene.remove(quad);
      geometry.dispose();
      material.dispose();
      spectrum.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
