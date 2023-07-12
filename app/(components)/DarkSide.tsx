import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GUI } from "dat.gui";
import {
  BokehPass,
  EffectComposer,
  RGBELoader,
  RGBShiftShader,
  RenderPass,
  SSAOPass,
  ShaderPass,
  UnrealBloomPass,
} from "three-stdlib";
import ReactAudioPlayer from "react-audio-player";
import YouTubeAudioPlayer from "./YouTubeAudioPlayer";

const DarkSide: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isReady, setReady] = useState<boolean>(false);
  const params = {
    threshold: 0,
    strength: 1,
    radius: 0,
    exposure: 1,
  };

  useEffect(() => {
    let camera: THREE.PerspectiveCamera;
    let orbitControls: OrbitControls;
    let scene: THREE.Scene;
    let renderer: THREE.WebGLRenderer;
    let prismMesh: THREE.Mesh<
      THREE.BufferGeometry,
      THREE.Material | THREE.Material[]
    >;
    let lightBeam: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
    let rainbowBeam: THREE.Mesh<
      THREE.BufferGeometry<THREE.NormalBufferAttributes>,
      THREE.MeshBasicMaterial
    >;
    let composer: EffectComposer;
    let planeGroup: THREE.Group;

    const init = () => {
      const container = canvasRef.current;
      if (!container || scene) return;

      const width = window.innerWidth;
      const height = window.innerHeight;

      scene = new THREE.Scene();
      scene.position.set(0, 0, 0);

      camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      camera.position.set(0, 1, 5);
      camera.lookAt(scene.position);
      scene.add(camera);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, height);
      renderer.setClearColor(0x000000);

      const textureLoader = new THREE.TextureLoader();

      const lightBeamGeometry = new THREE.CylinderGeometry(0.02, 0.02, 10, 32);
      const lightBeamMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.7,
      });
      lightBeam = new THREE.Mesh(lightBeamGeometry, lightBeamMaterial);
      lightBeam.position.set(-5, -0.5, 0.4);
      lightBeam.rotation.z = 1.76;
      scene.add(lightBeam);

      const conBeamTexture = textureLoader.load("/texture/rainbow2.jpg");
      const conBeamGeometry = new THREE.CylinderGeometry(0.05, 0.09, 0.83, 32);
      const conBeamMaterial = new THREE.MeshBasicMaterial({
        lightMap: conBeamTexture,
        color: 0xffffff,
      });
      conBeamMaterial.opacity = 0.6;
      const conBeam = new THREE.Mesh(conBeamGeometry, conBeamMaterial);
      conBeam.position.set(0, 0.3, 0);
      conBeam.rotation.z = 1.62;
      scene.add(conBeam);
      const planeWidth = 10;
      const planeHeightLeft = 0.08;
      const planeHeightRight = 0.08;
      const planeCount = 6;
      const planeSpacing = 0.06;

      // Create a group to hold the planes
      planeGroup = new THREE.Group();

      // Create a material for the planes
      const planeMaterial = new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        // transparent: true,
      });

      const colors = [
        0xff0000, // Red
        0xff7f00, // Orange
        0xffff00, // Yellow
        0x00ff00, // Green
        0x0000ff, // Blue
        0x2e2b5f, // Indigo
        0x8b00ff, // Violet
      ];

      // Loop to create the planes
      for (let i = 0; i < planeCount; i++) {
        // Calculate the position of each plane
        const yPos = -(planeCount - 1) * planeSpacing * 0.5 + i * planeSpacing;

        // Create the geometry for each plane
        const planeGeometry = new THREE.PlaneGeometry(
          planeWidth,
          planeHeightRight - planeHeightLeft
        );

        // Modify the position of the vertices to create the desired shape
        planeGeometry.attributes.position.setXYZ(
          1,
          planeWidth * 0.5,
          planeHeightLeft,
          0
        );
        planeGeometry.attributes.position.setXYZ(
          2,
          -planeWidth * 0.5,
          planeHeightLeft,
          0
        );
        planeGeometry.attributes.position.setXYZ(
          5,
          planeWidth * 0.5,
          planeHeightRight,
          0
        );
        planeGeometry.attributes.position.setXYZ(
          6,
          -planeWidth * 0.5,
          planeHeightRight,
          0
        );

        // Create a mesh for each plane with a different color
        const plane = new THREE.Mesh(planeGeometry, planeMaterial.clone());
        plane.position.set(0, yPos, 0);

        // Set the color of each plane based on the position
        const color = new THREE.Color(colors[i]);
        plane.material.color = color;

        // Add the plane to the group
        planeGroup.add(plane);
      }

      // Add the plane group to the scene
      planeGroup.position.set(4.9, -0.3, -1.5);
      planeGroup.rotation.set(3, 0.6, 0.1);
      scene.add(planeGroup);
      // renderer.outputColorSpace = THREE.SRGBColorSpace;
      // renderer.toneMapping = THREE.ACESFilmicToneMapping;

      // const loader = new RGBELoader();
      // loader.load("/night.hdr", function (texture) {
      //   texture.mapping = THREE.EquirectangularReflectionMapping;
      //   // scene.background = texture;
      //   scene.environment = texture;
      // });

      const scuffedGlassTexture = textureLoader.load("/texture/6.png");
      const prismGeometry = new THREE.CylinderGeometry(1, 1, 1.5, 3, 1);
      const prismMaterial = new THREE.MeshPhysicalMaterial({
        reflectivity: 1.0,
        transmission: 0.9,
        // transparent: true,
        roughness: 0.32,
        map: scuffedGlassTexture,
        lightMap: conBeamTexture,
        lightMapIntensity: 0.5,
        metalness: 0.0,
        // clearcoat: 0.3,
        // clearcoatRoughness: 0.25,
        // color: new THREE.Color(0xffffff),
        ior: 1.2,
        thickness: 6.8,
      });
      prismMesh = new THREE.Mesh(prismGeometry, prismMaterial);
      prismMesh.position.set(0, 0.1, 0.3);
      prismMesh.rotation.set(1.34, 3.11, 3.39);
      scene.add(prismMesh);

      const edgesGeometry = new THREE.EdgesGeometry(prismGeometry);
      const edgesMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
      edgesMaterial.linewidth = 3;
      const edgesMesh = new THREE.LineSegments(edgesGeometry, edgesMaterial);
      prismMesh.add(edgesMesh);

      const ambientLight = new THREE.AmbientLight(0xffffff, 1);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0);
      // directionalLight.position.set(0, 1, 1);
      directionalLight.lookAt(prismMesh.position);
      scene.add(directionalLight);

      const spotLight = new THREE.SpotLight(0xffffff, 0);
      spotLight.lookAt(prismMesh.position);
      scene.add(spotLight);

      // Create an EffectComposer
      composer = new EffectComposer(renderer);

      // Create a RenderPass and add it to the composer
      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

      //  const effect2 = new ShaderPass(RGBShiftShader);
      //  effect2.uniforms["amount"].value = 0.005;
      //  composer.addPass(effect2);

      const _SSAOPass = new SSAOPass(scene, camera);
      composer.addPass(_SSAOPass);

      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.6,
        0.1,
        0.2
      );
      bloomPass.threshold = params.threshold;
      bloomPass.strength = params.strength;
      bloomPass.radius = params.radius;
      composer.addPass(bloomPass);

      // const bokehPass = new BokehPass(scene, camera, {
      //   focus: 1.0,
      //   aperture: 0.0001,
      //   maxblur: 1.0,
      //   width: window.innerWidth,
      //   height: window.innerHeight,
      // });
      // composer.addPass(bokehPass);

      orbitControls = new OrbitControls(camera, renderer.domElement);
      container.appendChild(renderer.domElement);
      window.addEventListener("resize", handleResize);

      // GUI Controls
      const gui = new GUI();
      const bloomFolder = gui.addFolder("bloom");

      bloomFolder.add(params, "threshold", 0.0, 1.0).onChange(function (value) {
        bloomPass.threshold = Number(value);
      });

      bloomFolder.add(params, "strength", 0.0, 3.0).onChange(function (value) {
        bloomPass.strength = Number(value);
      });

      gui.add(planeGroup.position, "x", -10, 10, 0.1);
      gui.add(planeGroup.position, "y", -10, 10, 0.1);
      gui.add(planeGroup.position, "z", -10, 10, 0.1);
      gui.add(planeGroup.rotation, "x", -5, 5, 0.1);
      gui.add(planeGroup.rotation, "y", -5, 5, 0.1);
      gui.add(planeGroup.rotation, "z", -5, 5, 0.1);

      gui
        .add(params, "radius", 0.0, 1.0)
        .step(0.01)
        .onChange(function (value) {
          bloomPass.radius = Number(value);
        });
      const prismFolder = gui.addFolder("Prism");
      prismFolder.add(prismMesh, "visible").name("Visible");
      prismFolder
        .add(prismMaterial, "metalness", 0, 1.0, 0.01)
        .name("Metalness");
      prismFolder
        .add(prismMaterial, "roughness", 0, 1.0, 0.01)
        .name("Roughness");
      prismFolder
        .add(prismMaterial, "transmission", 0, 1.0, 0.01)
        .name("Transmission");
      prismFolder
        .add(prismMaterial, "clearcoat", 0, 1.0, 0.01)
        .name("Clearcoat");
      prismFolder
        .add(prismMaterial, "clearcoatRoughness", 0, 1.0, 0.01)
        .name("ClearcoatRoughness");
      prismFolder
        .add(prismMaterial, "reflectivity", 0, 1.0, 0.01)
        .name("Reflectivity");
      prismFolder.add(prismMaterial, "ior", 1.0, 2.333, 0.01).name("IOR");
      prismFolder
        .add(prismMaterial, "thickness", 0, 50.0, 0.1)
        .name("thickness");
      prismFolder.open();
      const prismMeshFolder = gui.addFolder("Prism Mesh");
      prismMeshFolder
        .add(prismMesh.position, "x", -5, 5, 0.1)
        .name("X Position");
      prismMeshFolder
        .add(prismMesh.position, "y", -5, 5, 0.1)
        .name("Y Position");
      prismMeshFolder
        .add(prismMesh.position, "z", -5, 5, 0.1)
        .name("Z Position");
      const prismMeshRotationFolder = prismMeshFolder.addFolder("Rotation");
      prismMeshRotationFolder
        .add(prismMesh.rotation, "x", 0, Math.PI * 2, 0.01)
        .name("X Rotation");
      prismMeshRotationFolder
        .add(prismMesh.rotation, "y", 0, Math.PI * 2, 0.01)
        .name("Y Rotation");
      prismMeshRotationFolder
        .add(prismMesh.rotation, "z", 0, Math.PI * 2, 0.01)
        .name("Z Rotation");
      // prismMeshFolder.open();

      const lightsFolder = gui.addFolder("Lights");
      lightsFolder
        .add(directionalLight.position, "x", -5, 5, 0.1)
        .name("Directional Light X");
      lightsFolder
        .add(directionalLight.position, "y", -5, 5, 0.1)
        .name("Directional Light Y");
      lightsFolder
        .add(directionalLight.position, "z", -5, 5, 0.1)
        .name("Directional Light Z");
      lightsFolder
        .add(directionalLight, "intensity", 0, 2, 0.1)
        .name("Directional Light Intensity");
      lightsFolder
        .add(spotLight.position, "x", -5, 5, 0.1)
        .name("Spot Light X");
      lightsFolder
        .add(spotLight.position, "y", -5, 5, 0.1)
        .name("Spot Light Y");
      lightsFolder
        .add(spotLight.position, "z", -5, 5, 0.1)
        .name("Spot Light Z");
      lightsFolder
        .add(spotLight, "intensity", 0, 2, 0.1)
        .name("Spot Light Intensity");
      // lightsFolder.open();

      const lightBeamFolder = gui.addFolder("Light Beam");
      lightBeamFolder
        .add(lightBeam.position, "x", -5, 5, 0.1)
        .name("X Position");
      lightBeamFolder
        .add(lightBeam.position, "y", -5, 5, 0.1)
        .name("Y Position");
      lightBeamFolder
        .add(lightBeam.position, "z", -5, 5, 0.1)
        .name("Z Position");
      const lightBeamRotationFolder = lightBeamFolder.addFolder("Rotation");
      lightBeamRotationFolder
        .add(lightBeam.rotation, "x", 0, Math.PI * 2, 0.01)
        .name("X Rotation");
      lightBeamRotationFolder
        .add(lightBeam.rotation, "y", 0, Math.PI * 2, 0.01)
        .name("Y Rotation");
      lightBeamRotationFolder
        .add(lightBeam.rotation, "z", 0, Math.PI * 2, 0.01)
        .name("Z Rotation");
      // lightBeamFolder.open();

      // const rainbowBeamFolder = gui.addFolder("Rainbow Beam");
      // rainbowBeamFolder
      //   .add(rainbowBeam.position, "x", -5, 5, 0.1)
      //   .name("X Position");
      // rainbowBeamFolder
      //   .add(rainbowBeam.position, "y", -5, 5, 0.1)
      //   .name("Y Position");
      // rainbowBeamFolder
      //   .add(rainbowBeam.position, "z", -5, 5, 0.1)
      //   .name("Z Position");
      // const rainbowBeamRotationFolder = rainbowBeamFolder.addFolder("Rotation");
      // rainbowBeamRotationFolder
      //   .add(rainbowBeam.rotation, "x", 0, Math.PI * 2, 0.01)
      //   .name("X Rotation");
      // rainbowBeamRotationFolder
      //   .add(rainbowBeam.rotation, "y", 0, Math.PI * 2, 0.01)
      //   .name("Y Rotation");
      // rainbowBeamRotationFolder
      //   .add(rainbowBeam.rotation, "z", 0, Math.PI * 2, 0.01)
      //   .name("Z Rotation");

      const conBeamFolder = gui.addFolder("Connection Beam");
      conBeamFolder.add(conBeam.position, "x", -5, 5, 0.1).name("X Position");
      conBeamFolder.add(conBeam.position, "y", -5, 5, 0.1).name("Y Position");
      conBeamFolder.add(conBeam.position, "z", -5, 5, 0.1).name("Z Position");
      const conBeamRotationFolder = conBeamFolder.addFolder("Rotation");
      conBeamRotationFolder
        .add(conBeam.rotation, "x", 0, Math.PI * 2, 0.01)
        .name("X Rotation");
      conBeamRotationFolder
        .add(conBeam.rotation, "y", 0, Math.PI * 2, 0.01)
        .name("Y Rotation");
      conBeamRotationFolder
        .add(conBeam.rotation, "z", 0, Math.PI * 2, 0.01)
        .name("Z Rotation");
      // conBeamFolder.open();
    };

    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      composer.setSize(width, height);
      camera.updateProjectionMatrix();
    };

    const animateColors = () => {
      // Calculate the time-based color values
      const time = Date.now() * 0.001; // Convert time to seconds
      const colorSpeed = 0.05; // Color change speed
      const colorRange = 0.35; // Color variation range

      // Loop through each plane and update its color
      planeGroup.children.forEach((plane, index) => {
        // Calculate the color value based on time and index
        const hue = ((time + index * colorSpeed) % 1) * 360;
        const saturation = 100;
        const lightness = 50 + Math.sin(time * colorSpeed + index) * colorRange;

        // Set the new color of the plane
        (plane as any).material.color.setHSL(
          hue / 360,
          saturation / 100,
          lightness / 100
        );
      });

      // Render the updated scene
      renderer.render(scene, camera);

      // Request the next animation frame
      requestAnimationFrame(animateColors);
    };

    const animate = () => {
      requestAnimationFrame(animate);
      // prismMesh.rotation.y += 0.01;
      // animateColors();
      render();
    };

    const render = () => {
      orbitControls.update();
      composer.render();
    };

    init();
    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
    };
  }, []);

  return (
    <div>
      <div ref={canvasRef} />
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white bg-transparent">
        <YouTubeAudioPlayer />
      </div>
    </div>
  );
};

export default DarkSide;
