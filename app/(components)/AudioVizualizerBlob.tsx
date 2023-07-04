import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { AsciiEffect, TrackballControls, OrbitControls } from "three-stdlib";
import { createNoise3D } from "simplex-noise";

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
      audioElementRef.current = new Audio(
        // "https://streams.rautemusik.fm/techno/mp3-192/?ref=radiobrowser"
        // "https://main-high.rautemusik.fm/?ref=radiobrowser"
        stationURL
      );
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
    let controls: TrackballControls;
    let orbitControls: OrbitControls;
    let scene: THREE.Scene | null = null;
    let blobMesh: THREE.Mesh<
      THREE.BufferGeometry,
      THREE.Material | THREE.Material[]
    >;
    let renderer: THREE.WebGLRenderer;
    let asciiEffect: AsciiEffect;
    // let light1: THREE.PointLight,
    //   light2: THREE.PointLight,
    //   light3: THREE.PointLight,
    //   light4: THREE.PointLight;
    // const clock = new THREE.Clock();

    const init = () => {
      const container = canvasRef.current;
      if (!container || scene) return;

      const width = window.innerWidth;
      const height = window.innerHeight;

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0, 0, 0);

      camera = new THREE.PerspectiveCamera(70, width / height, 1, 1000);
      camera.position.set(0, 0, 100);
      camera.lookAt(scene.position);
      scene.add(camera);

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(width, height);

      // Create custom blob geometry
      const blobGeometry = new THREE.IcosahedronGeometry(29, 15);
      const blobMaterial = new THREE.MeshLambertMaterial({
        color: "rgb(84, 81, 81)",
        wireframe: true,
      });
      blobMesh = new THREE.Mesh(blobGeometry, blobMaterial);
      blobMesh.position.set(0, 0, 0);
      scene.add(blobMesh);

      const ambientLight = new THREE.AmbientLight(0xffffff, 1);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(1, 1, 1);
      scene.add(directionalLight);

      // asciiEffect = new AsciiEffect(renderer, " .:-+*=%@#", { invert: true });
      // asciiEffect.setSize(window.innerWidth, window.innerHeight);
      // asciiEffect.domElement.style.color = "white";
      // asciiEffect.domElement.style.backgroundColor = "black";

      controls = new TrackballControls(camera, renderer.domElement);
      orbitControls = new OrbitControls(camera, renderer.domElement);
      container.appendChild(renderer.domElement);
      window.addEventListener("resize", handleResize);
    };

    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const animate = () => {
      requestAnimationFrame(animate);
      blobMesh.rotation.y += 0.005;
      blobMesh.rotation.x += 0.005;
      render();
    };

    const render = () => {
      if (blobMesh && analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        // const bass = getBassFrequency(dataArray);
        // const treble = getTrebleFrequency(dataArray);

        const lowerHalfArray: number[] = Array.from(
          dataArray.slice(0, dataArray.length / 2 - 1)
        );
        const upperHalfArray: number[] = Array.from(
          dataArray.slice(dataArray.length / 2 - 1, dataArray.length - 1)
        );

        // const overallAvg = avg(dataArray);
        const lowerMax = max(lowerHalfArray);
        const lowerAvg = avg(lowerHalfArray);
        const upperMax = max(upperHalfArray);
        const upperAvg = avg(upperHalfArray);

        const lowerMaxFr = lowerMax / lowerHalfArray.length;
        const lowerAvgFr = lowerAvg / lowerHalfArray.length;
        const upperMaxFr = upperMax / upperHalfArray.length;
        const upperAvgFr = upperAvg / upperHalfArray.length;

        makeRoughBall(
          blobMesh,
          modulate(Math.pow(lowerMaxFr, 0.8), 0, 1, 0, 8),
          modulate(upperAvgFr, 0, 1, 0, 4)
        );

        // makeRoughBall(blobMesh, bass, treble);
      }

      controls.update();
      orbitControls.update();
      renderer.render(scene!, camera);
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
      const boundingSphere = new THREE.Sphere();
      geometry.computeBoundingSphere();
      const offset = boundingSphere.radius;
      const amp = 7;
      const time = window.performance.now();
      const positionAttribute = geometry.getAttribute("position");
      const vertex = new THREE.Vector3();
      for (let i = 0; i < positionAttribute.count; i++) {
        vertex.fromBufferAttribute(positionAttribute, i);
        vertex.normalize();
        const distance =
          29 +
          bassFrequency +
          simplex(
            vertex.x + time * 0.00007,
            vertex.y + time * 0.00008,
            vertex.z + time * 0.00009
          ) *
            amp *
            trebleFrequency;
        vertex.multiplyScalar(distance);
        positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
      }
      positions.needsUpdate = true;
      geometry.computeVertexNormals();
    };

    const getBassFrequency = (dataArray: Uint8Array) => {
      const bassArray = dataArray.slice(0, dataArray.length / 4);
      const bassSum = bassArray.reduce((sum, value) => sum + value, 0);
      const bassAvg = bassSum / bassArray.length;
      return bassAvg / 255; // Normalize the value between 0 and 1
    };

    const getTrebleFrequency = (dataArray: Uint8Array) => {
      const trebleArray = dataArray.slice(
        dataArray.length / 4,
        dataArray.length
      );
      const trebleSum = trebleArray.reduce((sum, value) => sum + value, 0);
      const trebleAvg = trebleSum / trebleArray.length;
      return trebleAvg / 255; // Normalize the value between 0 and 1
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
      renderer.renderLists.dispose();
    };
  }, []);

  return (
    <div>
      <div ref={canvasRef} />
      {stationURL && (
        <button
          onClick={initAudio}
          className="border p-3 bg-black text-white absolute z-10 top-2/3 left-1/2 rounded-lg"
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
      )}
    </div>
  );
};

export default AudioVizualizerBlob;
