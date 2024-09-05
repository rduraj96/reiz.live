import * as THREE from "three";
import { createNoise3D } from "simplex-noise";

const simplex = createNoise3D();

export function visualizeBlob(
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>,
  bassFrequency: number,
  trebleFrequency: number,
  radius: number
) {
  const time = window.performance.now();
  const geometry = mesh.geometry as THREE.BufferGeometry;
  const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
  const amp = 1;
  const vertex = new THREE.Vector3();

  for (let i = 0; i < positions.count; i++) {
    vertex.fromBufferAttribute(positions, i);
    const originalLength = vertex.length();
    vertex.normalize();

    const noise = simplex(
      vertex.x + time * 0.00007,
      vertex.y + time * 0.00008,
      vertex.z + time * 0.00009
    );

    const displacement =
      (1 + noise * amp * trebleFrequency) * (1 + bassFrequency * 0.05);

    vertex.multiplyScalar(radius * displacement);

    positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
}
