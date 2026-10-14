// Parses the GLB files and swaps every material for a Lambert one
// (one look for all models, cheaper on phones, and a small fixed set of shader programs).
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export async function parseGLB(buf: ArrayBuffer): Promise<GLTF> {
  const gltf = await new GLTFLoader().parseAsync(buf, '');
  const done = new Map<string, THREE.Material>();
  gltf.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const old = m.material as THREE.MeshStandardMaterial;
    let nm = done.get(old.uuid);
    if (!nm) {
      const cut = old.transparent || old.alphaTest > 0;
      nm = new THREE.MeshLambertMaterial({
        map: old.map,
        color: old.map ? new THREE.Color(0xffffff) : old.color,
        alphaTest: cut ? 0.5 : 0,
      });
      nm.name = old.name;
      if (old.map) old.map.anisotropy = 4;
      done.set(old.uuid, nm);
      old.dispose();
    }
    m.material = nm;
  });
  return gltf;
}

export async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
  return r.arrayBuffer();
}
