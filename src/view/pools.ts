// Draws many copies of one model with one InstancedMesh per part. Instances are written fresh each frame
// from the game state, so nothing is created or disposed while playing.
import * as THREE from 'three';

const tmp = new THREE.Matrix4();
const white = new THREE.Color(1, 1, 1);

export class Instanced {
  parts: { mesh: THREE.InstancedMesh; local: THREE.Matrix4 }[] = [];
  count = 0;
  constructor(
    proto: THREE.Object3D,
    public capacity: number,
    parent: THREE.Object3D,
    opts: { cast?: boolean; receive?: boolean; colors?: boolean; material?: THREE.Material; name?: string } = {},
  ) {
    proto.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(proto.matrixWorld).invert();
    proto.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mesh = new THREE.InstancedMesh(m.geometry, opts.material || (m.material as THREE.Material), capacity);
      mesh.name = (opts.name || proto.name) + ':' + m.name;
      mesh.castShadow = !!opts.cast;
      mesh.receiveShadow = !!opts.receive;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (opts.colors) {
        // create the colour buffer now: adding it later would compile a new shader mid-game
        for (let i = 0; i < capacity; i++) mesh.setColorAt(i, white);
        mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
      }
      mesh.count = 0;
      mesh.visible = false;
      parent.add(mesh);
      this.parts.push({ mesh, local: new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld) });
    });
  }
  begin() {
    this.count = 0;
  }
  add(m: THREE.Matrix4, color?: THREE.Color) {
    if (this.count >= this.capacity) return false;
    for (const p of this.parts) {
      p.mesh.setMatrixAt(this.count, tmp.multiplyMatrices(m, p.local));
      if (color && p.mesh.instanceColor) p.mesh.setColorAt(this.count, color);
    }
    this.count++;
    return true;
  }
  end() {
    for (const p of this.parts) {
      p.mesh.count = this.count;
      p.mesh.visible = this.count > 0;
      if (this.count === 0) continue;
      p.mesh.instanceMatrix.updateRange.offset = 0;
      p.mesh.instanceMatrix.updateRange.count = this.count * 16;
      p.mesh.instanceMatrix.needsUpdate = true;
      if (p.mesh.instanceColor) {
        p.mesh.instanceColor.updateRange.offset = 0;
        p.mesh.instanceColor.updateRange.count = this.count * 3;
        p.mesh.instanceColor.needsUpdate = true;
      }
    }
  }
}
