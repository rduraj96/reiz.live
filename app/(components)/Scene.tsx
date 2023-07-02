import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  AsciiEffect,
  TrackballControls,
  GLTFLoader,
  OrbitControls,
} from "three-stdlib";
import { GUI } from "dat-gui";

const AsciiEffectScene: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  //   const gui = new GUI();

  useEffect(() => {
    let camera: THREE.PerspectiveCamera | null = null;
    let controls: TrackballControls | null = null;
    let effect: AsciiEffect | null = null;
    let scene: THREE.Scene | null = null;
    let model: THREE.Object3D | null = null;
    let orbitControls: OrbitControls | null = null;

    const init = async () => {
      const container = canvasRef.current;

      if (!container) return;

      const width = window.innerWidth;
      const height = window.innerHeight;

      camera = new THREE.PerspectiveCamera(70, width / height, 1, 1000);
      camera.position.y = 150;
      camera.position.z = 500;

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0, 0, 0);

      const pointLight1 = new THREE.PointLight(0xffffff, 3, 0, 0);
      pointLight1.position.set(500, 500, 500);
      scene.add(pointLight1);

      const pointLight2 = new THREE.PointLight(0xffffff, 1, 0, 0);
      pointLight2.position.set(-500, -500, -500);
      scene.add(pointLight2);

      const renderer = new THREE.WebGLRenderer();
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);

      effect = new AsciiEffect(renderer, " .:-+*=%@#", {
        invert: true,
      });
      effect.setSize(width, height);

      container.appendChild(effect.domElement);
      //   container.appendChild(gui.domElement);

      controls = new TrackballControls(camera!, effect.domElement);
      orbitControls = new OrbitControls(camera!, effect.domElement);

      window.addEventListener("resize", handleResize);

      // Load model
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync("/blob.glb");
      model = gltf.scene;
      model.scale.set(1.2, 1.2, 1.2);
      scene.add(model);
    };

    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      if (camera) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }

      if (effect) {
        effect.setSize(width, height);
      }
    };

    const animate = () => {
      requestAnimationFrame(animate);
      render();
    };

    const render = () => {
      if (model && scene && effect) {
        const timer = Date.now();
        // model.rotation.y = timer * 0.0002;
        // model.rotation.x = timer * 0.0001;
      }

      if (controls) {
        controls.update();
      }

      if (orbitControls) {
        orbitControls.update();
      }

      effect?.render(scene!, camera!);
    };

    init();
    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return <div ref={canvasRef} />;
};

export default AsciiEffectScene;
