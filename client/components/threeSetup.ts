import { avg, max, modulate } from "@/lib/utils";
import {
  iridescentFragmentShader,
  iridescentVertexShader,
} from "@/shaders/shaders";
import * as THREE from "three";
import { OrbitControls } from "three-stdlib";
import Stats from "three/examples/jsm/libs/stats.module";

export function setupThreeScene(
  container: HTMLDivElement,
  analyserRef: React.RefObject<AnalyserNode>
) {
  let camera: THREE.PerspectiveCamera;
  let orbitControls: OrbitControls;
  let scene: THREE.Scene;
  let innerBlob: THREE.Mesh<THREE.IcosahedronGeometry, THREE.ShaderMaterial>;
  let outerBlob: THREE.Mesh;
  let renderer: THREE.WebGLRenderer;
  let clock: THREE.Clock;
  let stats: Stats;

  const init = () => {
    console.log("Initializing Three.js scene");
    const width = window.innerWidth;
    const height = window.innerHeight;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000);
    camera.position.set(0, 0, 3);
    camera.lookAt(scene.position);

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);

    stats = new Stats();
    stats.showPanel(0);
    // container.appendChild(stats.dom);

    const envMap = new THREE.CubeTextureLoader().load([
      "/cubemap/px.jpg",
      "/cubemap/nx.jpg",
      "/cubemap/py.jpg",
      "/cubemap/ny.jpg",
      "/cubemap/pz.jpg",
      "/cubemap/nz.jpg",
    ]);

    const iridescentMaterial = new THREE.ShaderMaterial({
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

    const testMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#ffffff"),
      wireframe: true,
    });

    const innerGeometry = new THREE.IcosahedronGeometry(0.8, 64);
    innerBlob = new THREE.Mesh(innerGeometry, iridescentMaterial);
    scene.add(innerBlob);

    const outerGeometry = new THREE.IcosahedronGeometry(1.1, 50);
    const outerMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#ffffff").multiplyScalar(0.1),
      metalness: 0.1,
      roughness: 0.07,
      transmission: 1,
      thickness: 0.5,
      envMapIntensity: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0,
      ior: 1,
      transparent: true,
      side: THREE.DoubleSide,
    });
    outerBlob = new THREE.Mesh(outerGeometry, outerMaterial);
    // scene.add(outerBlob);

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;

    container.appendChild(renderer.domElement);

    window.addEventListener("resize", handleResize);
    clock = new THREE.Clock();

    console.log("Three.js scene initialized");
  };

  const handleResize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const animate = () => {
    requestAnimationFrame(animate);
    stats.begin();

    const elapsedTime = clock.getElapsedTime();
    const time = performance.now() * 0.001;

    if (innerBlob) {
      innerBlob.rotation.x = time * 0.5;
      innerBlob.rotation.y = time * 0.25;
    }

    if (innerBlob.material instanceof THREE.ShaderMaterial) {
      innerBlob.material.uniforms.time.value = time;
    }

    render(elapsedTime);
    orbitControls.update();
    renderer.render(scene, camera);

    stats.end();
  };

  const render = (time: number) => {
    if (innerBlob && outerBlob && analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);

      const lowerHalfArray = Array.from(
        dataArray.slice(0, dataArray.length / 2 - 1)
      );
      const upperHalfArray = Array.from(
        dataArray.slice(dataArray.length / 2 - 1, dataArray.length - 1)
      );
      const lowerMax = max(lowerHalfArray);
      const upperAvg = avg(upperHalfArray);
      const lowerMaxFr = lowerMax / lowerHalfArray.length;
      const upperAvgFr = upperAvg / upperHalfArray.length;

      if (innerBlob.material instanceof THREE.ShaderMaterial) {
        innerBlob.material.uniforms.time.value += time + 0.5;
        innerBlob.material.uniforms.bassFrequency.value = modulate(
          Math.pow(lowerMaxFr, 0.8),
          0,
          1,
          0,
          0.5
        );
        innerBlob.material.uniforms.trebleFrequency.value = modulate(
          upperAvgFr,
          0,
          1,
          0,
          0.5
        );
      }
    }
  };

  init();
  animate();

  return () => {
    console.log("Cleaning up Three.js scene");
    window.removeEventListener("resize", handleResize);
    renderer.dispose();
    if (scene.environment instanceof THREE.Texture) {
      scene.environment.dispose();
    }
    stats.dom.remove();
  };
}
