// Makes an exported GLB smaller: drops animation channels that never move (Blender writes all
// translation/rotation/scale channels of every bone), and rewrites the binary without unused data.
// usage: node tools/slim_glb.mjs public/assets/core.glb
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
const b = readFileSync(file);
const jl = b.readUInt32LE(12);
const j = JSON.parse(b.subarray(20, 20 + jl).toString());
const binStart = 20 + jl + 8;
const bin = b.subarray(binStart, binStart + b.readUInt32LE(20 + jl));
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function readFloats(ai) {
  const a = j.accessors[ai];
  const v = j.bufferViews[a.bufferView];
  if (a.componentType !== 5126) return null;
  const n = a.count * SIZE[a.type];
  const off = (v.byteOffset || 0) + (a.byteOffset || 0);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = bin.readFloatLE(off + i * 4);
  return out;
}
const REST = { translation: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] };
const near = (a, b, eps) => a.every((x, i) => Math.abs(x - b[i]) < eps);
const sameVal = (path, a, b) => {
  const eps = path === 'rotation' ? 1e-4 : 1e-4;
  if (near(a, b, eps)) return true;
  return path === 'rotation' && near(a, b.map((x) => -x), eps);
};

// constant value of each (node, path) channel in each animation
const constOf = new Map(); // key -> {vals: [..per anim or null if moving]}
for (const anim of j.animations || []) {
  for (const ch of anim.channels) {
    const path = ch.target.path;
    if (!(path in REST)) continue;
    const out = readFloats(anim.samplers[ch.sampler].output);
    const k = SIZE[j.accessors[anim.samplers[ch.sampler].output].type];
    let constant = out !== null;
    if (out) for (let i = k; i < out.length && constant; i += k) if (!sameVal(path, Array.from(out.subarray(i, i + k)), Array.from(out.subarray(0, k)))) constant = false;
    ch._const = constant ? Array.from(out.subarray(0, k)) : null;
  }
}
// a (node, path) is dropped only if it sits at its rest value in every animation: then no clip ever
// moves it, so no clip can leave it posed when another one (without the track) takes over
const moves = new Set();
for (const anim of j.animations || []) for (const ch of anim.channels) {
  const node = j.nodes[ch.target.node];
  const rest = node[ch.target.path] || REST[ch.target.path];
  if (!ch._const || !sameVal(ch.target.path, ch._const, rest)) moves.add(ch.target.node + '/' + ch.target.path);
}
let dropped = 0, total = 0;
for (const anim of j.animations || []) {
  anim.channels = anim.channels.filter((ch) => {
    total++;
    if (!(ch.target.path in REST) || moves.has(ch.target.node + '/' + ch.target.path)) return true;
    dropped++;
    return false;
  });
  for (const ch of anim.channels) delete ch._const;
  // keep only samplers still used
  const used = [...new Set(anim.channels.map((c) => c.sampler))];
  const remap = new Map(used.map((s, i) => [s, i]));
  anim.samplers = used.map((s) => anim.samplers[s]);
  for (const ch of anim.channels) ch.sampler = remap.get(ch.sampler);
}

// collect accessors still referenced
const accUsed = new Set();
for (const m of j.meshes || []) for (const p of m.primitives) {
  for (const a of Object.values(p.attributes)) accUsed.add(a);
  if (p.indices !== undefined) accUsed.add(p.indices);
  for (const t of p.targets || []) for (const a of Object.values(t)) accUsed.add(a);
}
for (const s of j.skins || []) if (s.inverseBindMatrices !== undefined) accUsed.add(s.inverseBindMatrices);
for (const a of j.animations || []) for (const s of a.samplers) { accUsed.add(s.input); accUsed.add(s.output); }
const accList = [...accUsed].sort((a, b) => a - b);
const accMap = new Map(accList.map((a, i) => [a, i]));
// buffer views: those of used accessors and images
const bvUsed = new Set(accList.map((a) => j.accessors[a].bufferView));
for (const im of j.images || []) if (im.bufferView !== undefined) bvUsed.add(im.bufferView);
const bvList = [...bvUsed].sort((a, b) => a - b);
const bvMap = new Map(bvList.map((v, i) => [v, i]));
const chunks = [];
let off = 0;
const newViews = bvList.map((vi) => {
  const v = j.bufferViews[vi];
  const data = bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
  const pad = (4 - (off % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); off += pad; }
  const nv = { ...v, buffer: 0, byteOffset: off };
  chunks.push(data);
  off += v.byteLength;
  return nv;
});
j.bufferViews = newViews;
j.accessors = accList.map((a) => ({ ...j.accessors[a], bufferView: bvMap.get(j.accessors[a].bufferView) }));
for (const im of j.images || []) if (im.bufferView !== undefined) im.bufferView = bvMap.get(im.bufferView);
const ra = (a) => accMap.get(a);
for (const m of j.meshes || []) for (const p of m.primitives) {
  for (const k in p.attributes) p.attributes[k] = ra(p.attributes[k]);
  if (p.indices !== undefined) p.indices = ra(p.indices);
  for (const t of p.targets || []) for (const k in t) t[k] = ra(t[k]);
}
for (const s of j.skins || []) if (s.inverseBindMatrices !== undefined) s.inverseBindMatrices = ra(s.inverseBindMatrices);
for (const a of j.animations || []) for (const s of a.samplers) { s.input = ra(s.input); s.output = ra(s.output); }
let newBin = Buffer.concat(chunks);
newBin = Buffer.concat([newBin, Buffer.alloc((4 - (newBin.length % 4)) % 4)]);
j.buffers = [{ byteLength: newBin.length }];
let json = Buffer.from(JSON.stringify(j));
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
const head = Buffer.alloc(12);
head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + json.length + 8 + newBin.length, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(json.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(newBin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
const outBuf = Buffer.concat([head, jh, json, bh, newBin]);
writeFileSync(file, outBuf);
console.log(`slim ${file}: ${Math.round(b.length / 1024)} KB -> ${Math.round(outBuf.length / 1024)} KB, channels ${total} -> ${total - dropped}`);
