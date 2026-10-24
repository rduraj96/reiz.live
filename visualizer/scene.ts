import * as THREE from "three";
import { type Bands, computeBands, smoothBands } from "./bands";
import { iridescentFragmentShader, iridescentVertexShader } from "./shaders";

export type Visualizer = {
  setActive(active: boolean): void;
  dispose(): void;
};

const REDUCED_MOTION_SCALE = 0.4;

/**
 * Mounts the audio-reactive blob into `container`. Reads the analyser each
 * frame while active; breathes slowly while idle. Throws if WebGL is unavailable.
 */
export function createVisualizer(
  container: HTMLElement,
  getAnalyser: () => AnalyserNode | null,
  opts: { reducedMotion: boolean },
): Visualizer {
  const motion = opts.reducedMotion ? REDUCED_MOTION_SCALE : 1;
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;

  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCoarsePointer ? 1.5 : 2));
  renderer.setSize(width, height);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.style.display = "block";

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000);
  camera.position.set(0, 0, 3);
  camera.lookAt(scene.position);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      rimLightIntensity: { value: 0.6 },
      pulseIntensity: { value: 0.3 },
      pulseSpeed: { value: 2.0 },
      bassFrequency: { value: 0 },
      trebleFrequency: { value: 0 },
      radius: { value: 0.8 },
    },
    vertexShader: iridescentVertexShader,
    fragmentShader: iridescentFragmentShader,
    side: THREE.DoubleSide,
  });
  const geometry = new THREE.IcosahedronGeometry(0.8, 64);
  const blob = new THREE.Mesh(geometry, material);
  scene.add(blob);

  container.appendChild(renderer.domElement);

  const timer = new THREE.Timer();
  timer.connect(document);

  // Reused every frame: no allocations in the loop.
  let freq = new Uint8Array(0);
  const target: Bands = { bass: 0, mid: 0, treble: 0 };
  const smoothed: Bands = { bass: 0, mid: 0, treble: 0 };
  let active = false;

  const uniforms = material.uniforms;

  function frame(timestamp: number) {
    timer.update(timestamp);
    const t = timer.getElapsed();

    const analyser = active ? getAnalyser() : null;
    if (analyser) {
      if (freq.length !== analyser.frequencyBinCount) {
        freq = new Uint8Array(analyser.frequencyBinCount);
      }
      analyser.getByteFrequencyData(freq);
      computeBands(freq, target);
    } else {
      // Idle breathing; smoothBands crossfades to and from it.
      target.bass = 0.08 + 0.04 * Math.sin(t * 1.2);
      target.mid = 0;
      target.treble = 0;
    }
    smoothBands(smoothed, target, 0.5, 0.12, smoothed);

    blob.rotation.x = t * 0.5 * motion;
    blob.rotation.y = t * 0.25 * motion;

    // The legacy scene's time uniform advanced at about 2x wall-clock seconds.
    uniforms.time.value = t * 2;
    uniforms.bassFrequency.value = 0.5 * smoothed.bass ** 0.8 * motion;
    uniforms.trebleFrequency.value = 0.5 * smoothed.treble * motion;
    uniforms.pulseIntensity.value = 0.3 + 0.15 * smoothed.mid * motion;

    renderer.render(scene, camera);
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
    if (!box || box.width === 0 || box.height === 0) return;
    renderer.setSize(box.width, box.height);
    camera.aspect = box.width / box.height;
    camera.updateProjectionMatrix();
  });
  resizeObserver.observe(container);

  if (!document.hidden) start();

  return {
    setActive(next: boolean) {
      active = next;
    },
    dispose() {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      resizeObserver.disconnect();
      timer.dispose();
      scene.remove(blob);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
