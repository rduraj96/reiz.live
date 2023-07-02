import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { AsciiEffect } from "three/examples/jsm/effects/AsciiEffect";

const WaveformVisualizer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const asciiEffectRef = useRef<AsciiEffect | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    let container: HTMLDivElement | null = containerRef.current;
    let isMounted = true;

    if (!container) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 5);

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const asciiEffect = new AsciiEffect(renderer);
    asciiEffect.setSize(window.innerWidth, window.innerHeight);
    asciiEffect.domElement.style.color = "white";
    container.appendChild(asciiEffect.domElement);
    asciiEffectRef.current = asciiEffect;

    // Plane setup
    const planeGeometry = new THREE.PlaneGeometry(5, 5, 256, 256);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
    });

    const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
    scene.add(planeMesh);

    // Controls setup
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = true;

    // Animation loop
    const animate = () => {
      if (!isMounted) return;

      requestAnimationFrame(animate);
      controls.update();
      asciiEffect.render(scene, camera);
    };

    animate();

    return () => {
      isMounted = false;

      // Clean up Three.js objects
      scene.remove(planeMesh);
      //   asciiEffect.dispose();
      renderer.dispose();

      if (container && asciiEffectRef.current) {
        container.removeChild(asciiEffectRef.current.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} />;
};

export default WaveformVisualizer;
