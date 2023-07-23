import { AsciiEffect } from "three/examples/jsm/effects/AsciiEffect";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { WebGLRenderer, Scene, PerspectiveCamera } from "three";

const AsciiEffectRenderer = (targetDiv: HTMLElement) => {
  const renderer = new WebGLRenderer({ alpha: true });
  renderer.setSize(targetDiv.clientWidth, targetDiv.clientHeight);

  const scene = new Scene();
  const camera = new PerspectiveCamera(
    75,
    targetDiv.clientWidth / targetDiv.clientHeight,
    0.1,
    1000
  );
  camera.position.z = 5;

  const loader = new GLTFLoader();

  const asciiEffect = new AsciiEffect(renderer);
  asciiEffect.setSize(targetDiv.clientWidth, targetDiv.clientHeight);

  const animate = () => {
    requestAnimationFrame(animate);

    // Update the model animation if needed

    renderer.setClearColor(0x000000, 0);
    asciiEffect.render(scene, camera);
  };

  const loadModel = () => {
    loader.load("/blob.glb", (gltf) => {
      scene.add(gltf.scene);

      animate();
    });
  };

  targetDiv.appendChild(renderer.domElement);

  loadModel();
};

export default AsciiEffectRenderer;
