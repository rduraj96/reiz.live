import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  AsciiEffect,
  OrbitControls,
  EffectComposer,
  RenderPass,
  GlitchPass,
  SSAOPass,
  DotScreenPass,
  ShaderPass,
  RGBShiftShader,
} from "three-stdlib";
import { createNoise3D } from "simplex-noise";
import { AnimatePresence } from "framer-motion";
import { Pause, Play } from "lucide-react";

type AudioVizualizerBlobProps = {
  stationURL: string | null;
};

const AudioVizualizerBlob: React.FC<AudioVizualizerBlobProps> = ({
  stationURL,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setPlaying] = useState(false);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const initAudio = () => {
    if (isPlaying) {
      audioElementRef.current?.pause();
      setPlaying(false);
    } else {
      if (!stationURL) return;
      audioElementRef.current = new Audio(stationURL);
      audioElementRef.current.preload = "auto";
      audioElementRef.current.crossOrigin = "anonymous";

      const audioContext = new AudioContext();
      analyserRef.current = audioContext.createAnalyser();
      analyserRef.current.fftSize = 512;

      const audioSource = audioContext.createMediaElementSource(
        audioElementRef.current
      );
      audioSource.connect(analyserRef.current);
      analyserRef.current.connect(audioContext.destination);

      audioElementRef.current.play().catch((error) => {
        console.error("Failed to play audio:", error);
      });
      setPlaying(true);
    }
  };

  useEffect(() => {
    let camera: THREE.PerspectiveCamera;
    let orbitControls: OrbitControls;
    let scene: THREE.Scene;
    let blobMesh: THREE.Mesh<
      THREE.BufferGeometry,
      THREE.Material | THREE.Material[]
    >;
    let boxMesh: THREE.Mesh<
      THREE.BufferGeometry,
      THREE.Material | THREE.Material[]
    >;
    let renderer: THREE.WebGLRenderer;
    let asciiEffect: AsciiEffect;
    let composer: EffectComposer;
    let shaderMaterial: THREE.ShaderMaterial;
    let glitchPass: GlitchPass;

    const init = () => {
      const container = canvasRef.current;
      if (!container || scene) return;

      const width = window.innerWidth;
      const height = window.innerHeight;

      scene = new THREE.Scene();
      scene.position.set(0, 0, 0);

      camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      camera.position.set(0, 0, 100);
      camera.lookAt(scene.position);
      scene.add(camera);

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(width, height);

      renderer.outputColorSpace = THREE.SRGBColorSpace;

      // Create texture blob geometry
      const texture = new THREE.DataTexture();
      // const loader = new RGBELoader();
      // loader.load("/texture/studio2.hdr", function (texture) {
      //   texture.mapping = THREE.EquirectangularReflectionMapping;
      //   // scene.background = texture;
      //   scene.environment = texture;
      // });
      // blobMesh = new THREE.Mesh(
      //   new THREE.SphereGeometry(10, 100, 100),
      //   new THREE.MeshPhysicalMaterial({
      //     roughness: 0.28,
      //     metalness: 0.88,
      //     transmission: 0,

      //     ior: 2.33,
      //     // envMap: texture,
      //     envMapIntensity: 0.6,
      //     clearcoat: 1,
      //     color: 0xffffff,
      //     reflectivity: 1,
      //   })
      // );
      // scene.add(blobMesh);

      // const boxGeometry = new THREE.BoxGeometry(100, 100, 100, 20, 20, 20);
      // // gui.add()
      // const boxMaterial = new THREE.MeshStandardMaterial({
      //   color: 0x373937,
      //   wireframe: true,
      // });
      // boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
      // boxMesh.position.set(0, 0, 0);
      // scene.add(boxMesh);

      const blobGeometry = new THREE.IcosahedronGeometry(10, 30);
      const blobMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        wireframe: true,
      });
      blobMesh = new THREE.Mesh(blobGeometry, blobMaterial);
      blobMesh.position.set(0, 0, 0);
      scene.add(blobMesh);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.5);
      dirLight1.position.set(1, 1, 50);

      // Create an EffectComposer
      composer = new EffectComposer(renderer);

      // Create a RenderPass and add it to the composer
      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

      const effect2 = new ShaderPass(RGBShiftShader);
      effect2.uniforms["amount"].value = 0.005;
      composer.addPass(effect2);

      //Create a GlitchPass and add it to the composer
      glitchPass = new GlitchPass();
      glitchPass.enabled = false;
      glitchPass.curF = 0;
      composer.addPass(glitchPass);

      // const dotScreenPass = new DotScreenPass();
      // dotScreenPass.enabled = true;
      // composer.addPass(dotScreenPass);

      // const filmPass = new FilmPass();
      // composer.addPass(filmPass);

      // const _SSAOPass = new SSAOPass(scene, camera);
      // composer.addPass(_SSAOPass);

      // asciiEffect = new AsciiEffect(renderer, " .:-+*=%@#", { invert: true });
      // asciiEffect.setSize(window.innerWidth, window.innerHeight);
      // asciiEffect.domElement.style.color = "white";
      // asciiEffect.domElement.style.backgroundColor = "black";

      // controls = new TrackballControls(camera, renderer.domElement);
      orbitControls = new OrbitControls(camera, renderer.domElement);
      container.appendChild(renderer.domElement);
      window.addEventListener("resize", handleResize);
      document.addEventListener("mousemove", onMouseMove, false);
      document.addEventListener("mousedown", onMouseDown, false);
    };

    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      renderer.setSize(width, height);
      composer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    function onMouseDown(event: MouseEvent) {
      glitchPass.enabled = true;
      setTimeout(() => {
        glitchPass.enabled = false;
      }, 500);
    }

    function onMouseMove(event: MouseEvent) {
      const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
      const mouseY = (event.clientY / window.innerHeight) * 2 - 1;

      blobMesh.rotation.x = mouseY * 1.75;
      blobMesh.rotation.y = mouseX * 1.5;
    }

    const animate = () => {
      requestAnimationFrame(animate);
      if (blobMesh) {
        blobMesh.rotation.y += 0.005;
        blobMesh.rotation.x += 0.005;
      }

      if (boxMesh) {
        boxMesh.rotation.y += 0.001;
        boxMesh.rotation.x += 0.001;
      }

      render();
    };

    const render = () => {
      if (blobMesh && analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        const lowerHalfArray: number[] = Array.from(
          dataArray.slice(0, dataArray.length / 2 - 1)
        );
        const upperHalfArray: number[] = Array.from(
          dataArray.slice(dataArray.length / 2 - 1, dataArray.length - 1)
        );
        const lowerMax = max(lowerHalfArray);
        const upperAvg = avg(upperHalfArray);
        const lowerMaxFr = lowerMax / lowerHalfArray.length;
        const upperAvgFr = upperAvg / upperHalfArray.length;

        makeRoughBall(
          blobMesh,
          modulate(Math.pow(lowerMaxFr, 0.8), 0, 1, 0, 8),
          modulate(upperAvgFr, 0, 1, 0, 4)
        );
      }
      // controls.update();
      orbitControls.update();
      composer.render();
    };

    const simplex = createNoise3D();
    const makeRoughBall = (
      mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>,
      bassFrequency: number,
      trebleFrequency: number
      // dataArray:
    ) => {
      const geometry = mesh.geometry as THREE.BufferGeometry;
      const positions = geometry.getAttribute(
        "position"
      ) as THREE.BufferAttribute;
      const amp = 5;
      const time = window.performance.now();
      const positionAttribute = geometry.getAttribute("position");
      const vertex = new THREE.Vector3();
      const hf = 0.00001;
      for (let i = 0; i < positionAttribute.count; i++) {
        vertex.fromBufferAttribute(positionAttribute, i);
        vertex.normalize();
        const distance =
          10 +
          bassFrequency +
          simplex(
            vertex.x + time * hf * 7,
            vertex.y + time * hf * 8,
            vertex.z + time * hf * 9
          ) *
            amp *
            trebleFrequency;
        vertex.multiplyScalar(distance);
        positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
      }
      positions.needsUpdate = true;
      geometry.computeVertexNormals();
    };

    function fractionate(val: number, minVal: number, maxVal: number): number {
      return (val - minVal) / (maxVal - minVal);
    }

    function modulate(
      val: number,
      minVal: number,
      maxVal: number,
      outMin: number,
      outMax: number
    ): number {
      const fr = fractionate(val, minVal, maxVal);
      const delta = outMax - outMin;
      return outMin + fr * delta;
    }

    function avg(arr: number[]): number {
      const total = arr.reduce((sum, b) => sum + b);
      return total / arr.length;
    }

    function max(arr: number[]): number {
      return arr.reduce((a, b) => Math.max(a, b));
    }

    init();
    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", onMouseMove);
      renderer.dispose();
    };
  }, []);

  return (
    <div className="flex flex-col justify-center">
      <div ref={canvasRef} />
      <AnimatePresence>
        {stationURL && (
          <div className="absolute z-10 left-1/2 bottom-[10%] sm:bottom-0 sm:mb-10 flex justify-between items-center gap-10 -translate-x-1/2 -translate-y-1/2">
            <h3 className="text-white font-bold">PREV</h3>
            <button
              onClick={() => {
                initAudio();
              }}
              className="hover:cursor-pointer text-white"
            >
              {isPlaying ? <Pause size={56} /> : <Play size={56} />}
            </button>
            <h3 className="text-white font-bold">NEXT</h3>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AudioVizualizerBlob;
