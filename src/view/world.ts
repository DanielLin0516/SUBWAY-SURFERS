// The three.js scene. The runner stays at z = 0 and the world is drawn relative to it, so numbers stay small.
// Light count, materials and meshes are all made up front; play only moves instances.
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Instanced } from './pools';
import { Fx } from './fx';
import { PlayerView } from './player';
import { trackTexture, pavingTexture, groundTexture, skyTexture, glowTexture, powerTexture, rampTexture, HORIZON } from './textures';
import { LANE_W, laneX, CAR_LEN, CAR_GAP, VIEW_AHEAD, OB } from '../config';
import type { Sim } from '../sim/sim';
import type { SimEvent, PowerKind } from '../sim/types';
import { Rng } from '../sim/rng';

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const v = new THREE.Vector3();
const one = new THREE.Vector3(1, 1, 1);
const sc = new THREE.Vector3();
const TRAIN_TINTS = [new THREE.Color(1, 1, 1), new THREE.Color(0.7, 0.85, 1), new THREE.Color(1, 0.72, 0.66)];
const POWER_COLORS: Record<PowerKind, THREE.Color> = {
  magnet: new THREE.Color('#ff5a64'), shoes: new THREE.Color('#3ee08a'), double: new THREE.Color('#ffc23d'),
};
const GROUND_LEN = 300;
const SIDEWALK_IN = 3.9; // inner edge of the sidewalk from the track centre
const SIDEWALK_OUT = 7.4;

interface House { type: number; side: number; d: number; len: number; depth: number }

export class World {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;
  player: PlayerView;
  fx: Fx;
  private pools: Record<string, Instanced> = {};
  private coins: Instanced;
  private halos: Instanced;
  private powerCards: Record<PowerKind, Instanced>;
  private poles: Instanced;
  private scrollTex: THREE.Texture[] = [];
  private houses: Instanced[] = [];
  private houseSize: { len: number; depth: number }[] = [];
  private placed: House[] = [];
  private nextHouse = [0, 0];
  private rng = new Rng(99);
  private camY = 0;
  private shake = 0;
  private flash = 0;
  private aspect = 1;
  time = 0;

  constructor(core: GLTF, quality: { shadowSize: number }) {
    const s = this.scene;
    s.background = skyTexture();
    s.fog = new THREE.Fog(HORIZON, 40, 180);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.3, 260);
    // lights: fixed for the whole game
    const hemi = new THREE.HemisphereLight(0xdcecff, 0x8a7a62, 1.35);
    s.add(hemi);
    this.sun = new THREE.DirectionalLight(0xfff1dc, 2.1);
    this.sun.position.set(9, 22, 4);
    this.sun.target.position.set(0, 0, -14);
    this.sun.castShadow = true;
    const sh = this.sun.shadow;
    sh.mapSize.set(quality.shadowSize, quality.shadowSize);
    Object.assign(sh.camera, { left: -16, right: 16, top: 30, bottom: -30, near: 2, far: 70 });
    sh.bias = -0.0008;
    sh.normalBias = 0.03;
    s.add(this.sun, this.sun.target);

    this.buildGround();
    // poles along the track, every 16 m
    const post = new THREE.BoxGeometry(0.18, 6.9, 0.18).translate(0, 3.45, 0);
    const arm = new THREE.BoxGeometry(1.9, 0.12, 0.12).translate(-0.85, 6.6, 0);
    const lamp = new THREE.BoxGeometry(0.5, 0.14, 0.3).translate(-1.7, 6.48, 0);
    const poleGeo = mergeGeometries([post, arm, lamp])!;
    const poleMesh = new THREE.Mesh(poleGeo, new THREE.MeshLambertMaterial({ color: 0x59606b }));
    this.poles = new Instanced(poleMesh, 40, s, { cast: true, name: 'pole' });

    // obstacles from core.glb
    const node = (n: string) => {
      const o = core.scene.getObjectByName(n);
      if (!o) throw new Error('missing model ' + n);
      return o;
    };
    this.pools.train = new Instanced(node('train'), 60, s, { cast: true, receive: true, colors: true });
    this.pools.low = new Instanced(node('low'), 24, s, { cast: true, receive: true });
    this.pools.hurdle = new Instanced(node('hurdle'), 24, s, { cast: true, receive: true });
    this.pools.overhead = new Instanced(node('overhead'), 24, s, { cast: true, receive: true });
    this.pools.ramp = new Instanced(rampMesh(), 16, s, { cast: true, receive: true });
    const coin = node('coin');
    coin.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) (m.material as THREE.MeshLambertMaterial).emissive = new THREE.Color(0x6b4300);
    });
    this.coins = new Instanced(coin, 320, s, { cast: false });
    const glowMat = new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat);
    glow.name = 'glow';
    this.halos = new Instanced(glow, 340, s, { colors: true });
    for (const p of this.halos.parts) p.mesh.renderOrder = 4;
    const card = (k: PowerKind) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: powerTexture(k), transparent: true, alphaTest: 0.1 }));
      m.name = 'power-' + k;
      return new Instanced(m, 4, s);
    };
    this.powerCards = { magnet: card('magnet'), shoes: card('shoes'), double: card('double') };

    this.player = new PlayerView(core, s);
    this.fx = new Fx(s);
  }

  private buildGround() {
    const s = this.scene;
    const z = -GROUND_LEN / 2 + 30;
    const track = trackTexture();
    track.repeat.set(3, GROUND_LEN / LANE_W);
    const trackMesh = new THREE.Mesh(new THREE.PlaneGeometry(LANE_W * 3, GROUND_LEN), new THREE.MeshLambertMaterial({ map: track }));
    trackMesh.rotation.x = -Math.PI / 2;
    trackMesh.position.set(0, 0, z);
    trackMesh.receiveShadow = true;
    s.add(trackMesh);
    // gravel strip between the tracks and the sidewalk
    const edge = trackTexture();
    edge.repeat.set(0.3, GROUND_LEN / LANE_W);
    edge.offset.x = 0.35;
    for (const side of [-1, 1]) {
      const w = SIDEWALK_IN - LANE_W * 1.5;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, GROUND_LEN), new THREE.MeshLambertMaterial({ map: edge }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(side * (LANE_W * 1.5 + w / 2), 0, z);
      m.receiveShadow = true;
      s.add(m);
    }
    const pave = pavingTexture();
    pave.repeat.set(2, GROUND_LEN / 1.75);
    const paveMat = new THREE.MeshLambertMaterial({ map: pave });
    const curbMat = new THREE.MeshLambertMaterial({ color: 0x9a9286 });
    for (const side of [-1, 1]) {
      const w = SIDEWALK_OUT - SIDEWALK_IN;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, GROUND_LEN), paveMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(side * (SIDEWALK_IN + w / 2), 0.25, z);
      m.receiveShadow = true;
      s.add(m);
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, GROUND_LEN), curbMat);
      curb.position.set(side * (SIDEWALK_IN - 0.1), 0.125, z);
      curb.receiveShadow = true;
      s.add(curb);
    }
    const grass = groundTexture();
    grass.repeat.set(20, GROUND_LEN / 6);
    const g = new THREE.Mesh(new THREE.PlaneGeometry(120, GROUND_LEN), new THREE.MeshLambertMaterial({ map: grass }));
    g.rotation.x = -Math.PI / 2;
    g.position.set(0, -0.02, z);
    g.receiveShadow = true;
    s.add(g);
    // overhead wires: uniform along the track, so they never need to move
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x2b2f36 });
    for (let l = 0; l < 3; l++) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, GROUND_LEN), wireMat);
      w.position.set(laneX(l), 6.45, z);
      s.add(w);
    }
    this.scrollTex = [track, edge, pave, grass];
  }

  /** Houses arrive later (scenery.glb loads in the background). */
  addScenery(gltf: GLTF) {
    for (let i = 1; i <= 5; i++) {
      const o = gltf.scene.getObjectByName('house' + i);
      if (!o) continue;
      const box = new THREE.Box3().setFromObject(o);
      const size = box.getSize(new THREE.Vector3());
      // same settings as the barrier pools, so no new shader is needed
      this.houses.push(new Instanced(o, 14, this.scene, { cast: true, receive: true, name: 'house' + i }));
      this.houseSize.push({ len: size.x, depth: size.z });
    }
  }
  /** Houses use the same shader as the barriers, so only their textures need uploading; no full warm-up
   *  (that would disturb a run already in progress). */
  warmScenery(renderer: THREE.WebGLRenderer) {
    for (const h of this.houses) for (const p of h.parts) {
      const m = p.mesh.material as THREE.MeshLambertMaterial;
      if (m.map) renderer.initTexture(m.map);
    }
  }
  get hasScenery() {
    return this.houses.length > 0;
  }

  resize(w: number, h: number) {
    this.aspect = w / h;
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
  }

  event(ev: SimEvent) {
    const fx = this.fx;
    switch (ev.type) {
      case 'coin':
        fx.burst(ev.x, ev.y, 0, 5, 0xffd75a, { speed: 2.4, up: 1.5, size: 0.4, life: 0.35, grav: 3 });
        break;
      case 'power':
        fx.burst(ev.x, ev.y, 0, 26, POWER_COLORS[ev.kind], { speed: 5, up: 2, size: 0.55, life: 0.6, grav: 2 });
        this.flash = 0.25;
        break;
      case 'land':
        if (ev.fall > 0.6) fx.burst(this.player.root.position.x, this.player.root.position.y + 0.1, 0.2, 6, 0x9a8f80, { speed: 2, up: 0.6, size: 0.5, life: 0.4, grav: 1 });
        break;
      case 'stumble':
        this.shake = 0.35;
        fx.burst(ev.x, ev.y + 1, -0.3, 10, 0xffffff, { speed: 3.5, up: 1, size: 0.35, life: 0.35 });
        break;
      case 'bump':
        this.shake = 0.15;
        break;
      case 'crash':
        this.shake = 0.8;
        fx.burst(ev.x, ev.y + 1, -0.6, 28, 0xffb347, { speed: 6, up: 2, size: 0.6, life: 0.6, grav: 5 });
        break;
    }
  }

  sync(sim: Sim, dt: number, menu: boolean) {
    this.time += dt;
    const pd = sim.d;
    const zOf = (d: number) => -(d - pd);
    // scrolling ground
    for (const t of this.scrollTex) t.offset.y = (pd / (GROUND_LEN / t.repeat.y)) % 1;
    // obstacles
    for (const k in this.pools) this.pools[k].begin();
    for (const o of sim.obs) {
      if (o.d0 > pd + VIEW_AHEAD || o.d1 < pd - 12) continue;
      const x = laneX(o.lane);
      if (o.kind === 'train') {
        for (let c = 0; c < o.cars; c++) {
          const dc = o.d0 + c * (CAR_LEN + CAR_GAP) + CAR_LEN / 2;
          m4.makeTranslation(x, 0, zOf(dc));
          this.pools.train.add(m4, TRAIN_TINTS[o.variant % 3]);
        }
      } else {
        m4.makeTranslation(x, 0, zOf((o.d0 + o.d1) / 2));
        this.pools[o.kind].add(m4);
      }
    }
    for (const k in this.pools) this.pools[k].end();
    // coins + glow
    this.coins.begin();
    this.halos.begin();
    q.setFromEuler(e.set(0, this.time * 3.2, 0));
    const camQ = this.camera.quaternion;
    const gold = new THREE.Color(1.0, 0.75, 0.25).multiplyScalar(0.55);
    for (const c of sim.coinList) {
      if (c.d > pd + VIEW_AHEAD - 20) continue;
      const z = zOf(c.d);
      m4.compose(v.set(c.x, c.y, z), q, one);
      this.coins.add(m4);
      m4.compose(v.set(c.x, c.y, z + 0.05), camQ, sc.set(1.5, 1.5, 1.5));
      this.halos.add(m4, gold);
    }
    // power-up cards
    for (const k in this.powerCards) this.powerCards[k as PowerKind].begin();
    for (const p of sim.powers) {
      if (p.d > pd + VIEW_AHEAD - 20) continue;
      const z = zOf(p.d);
      const bob = Math.sin(this.time * 3 + p.d) * 0.12;
      m4.compose(v.set(laneX(p.lane), p.y + bob, z), camQ, sc.set(1.1, 1.1, 1.1));
      this.powerCards[p.kind].add(m4);
      m4.compose(v.set(laneX(p.lane), p.y + bob, z + 0.05), camQ, sc.set(2.6, 2.6, 2.6));
      this.halos.add(m4, POWER_COLORS[p.kind]);
    }
    for (const k in this.powerCards) this.powerCards[k as PowerKind].end();
    this.coins.end();
    this.halos.end();
    // poles
    this.poles.begin();
    const first = Math.floor((pd - 10) / 16) * 16;
    for (let d = first; d < pd + VIEW_AHEAD; d += 16) {
      m4.makeTranslation(SIDEWALK_IN + 0.3, 0.25, zOf(d));
      this.poles.add(m4);
      m4.makeRotationY(Math.PI).setPosition(-SIDEWALK_IN - 0.3, 0.25, zOf(d + 8));
      this.poles.add(m4);
    }
    this.poles.end();
    this.syncHouses(pd, zOf);
    // runner, camera, effects
    if (menu) this.player.menu(dt);
    this.updateCamera(sim, dt, menu);
    const speedFactor = menu || !sim.alive ? 0 : Math.max(0, Math.min(1, (sim.speed - 14) / 12));
    this.fx.update(dt, this.camera, menu || !sim.alive ? 0 : sim.speed, speedFactor);
    // power trails
    if (!menu && sim.alive) {
      const px = sim.x, py = sim.y;
      if (sim.power.shoes > 0 && Math.random() < dt * 30) this.fx.burst(px + (Math.random() - 0.5) * 0.4, py + 0.1, 0.3, 1, 0x3ee08a, { speed: 0.6, up: 0.4, size: 0.3, life: 0.4, grav: 0 });
      if (sim.power.magnet > 0 && Math.random() < dt * 20) this.fx.burst(px, py + 1.2, 0, 1, 0xff5a64, { speed: 1.5, up: 0, size: 0.25, life: 0.3, grav: 0, world: false });
      if (sim.power.double > 0 && Math.random() < dt * 12) this.fx.burst(px, py + 2.0, 0, 1, 0xffc23d, { speed: 0.8, up: 0.8, size: 0.25, life: 0.5, grav: 0, world: false });
    }
  }

  private syncHouses(pd: number, zOf: (d: number) => number) {
    if (!this.houses.length) return;
    // drop houses behind, add houses ahead
    this.placed = this.placed.filter((h) => h.d + h.len / 2 > pd - 60);
    for (const side of [0, 1]) {
      if (this.nextHouse[side] < pd - 60) this.nextHouse[side] = pd - 60;
      let guard = 0;
      while (this.nextHouse[side] < pd + VIEW_AHEAD && guard++ < 30) {
        const used = new Array(this.houses.length).fill(0);
        for (const h of this.placed) used[h.type]++;
        const choices = this.houses.map((_, i) => i).filter((i) => used[i] < this.houses[i].capacity);
        if (!choices.length) break;
        const type = this.rng.pick(choices);
        const { len, depth } = this.houseSize[type];
        this.placed.push({ type, side, d: this.nextHouse[side] + len / 2, len, depth });
        this.nextHouse[side] += len + this.rng.range(1, 5);
      }
    }
    for (const h of this.houses) h.begin();
    for (const h of this.placed) {
      const sgn = h.side === 0 ? 1 : -1;
      m4.makeRotationY(sgn > 0 ? -Math.PI / 2 : Math.PI / 2).setPosition(sgn * (SIDEWALK_OUT + 0.6 + h.depth / 2), 0, zOf(h.d));
      this.houses[h.type].add(m4);
    }
    for (const h of this.houses) h.end();
  }

  resetScenery() {
    this.placed = [];
    this.nextHouse = [-60, -60];
    this.player.reset();
  }

  private updateCamera(sim: Sim, dt: number, menu: boolean) {
    const cam = this.camera;
    const portrait = Math.max(0, Math.min(1, (1.2 - this.aspect) / 0.72));
    if (menu) {
      // in front of the runner, looking back at it; the runner sits above the panel (portrait)
      // or to the left of it (landscape)
      const t = this.time * 0.15;
      const wide = this.aspect > 1.25;
      cam.position.set(Math.sin(t) * 0.8 + (wide ? -1.2 : 0), 1.7 + portrait * 0.5, -4.6 - portrait * 1.6);
      cam.fov = 50 + portrait * 16;
      cam.updateProjectionMatrix();
      cam.lookAt(wide ? -2.2 : 0, wide ? 0.95 : 0.25 - portrait * 0.35, 0);
      this.camY = 0;
      return;
    }
    const target = sim.grounded ? sim.y : Math.max(sim.groundY, Math.min(sim.y, this.camY + 1.0));
    this.camY += (target - this.camY) * Math.min(1, dt * 5);
    const dist = 5.4 + portrait * 2.4;
    const height = 2.75 + portrait * 1.5;
    const sx = sim.x * 0.72;
    let ox = 0, oy = 0;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const a = this.shake * 0.5;
      ox = (Math.random() - 0.5) * a;
      oy = (Math.random() - 0.5) * a;
    }
    cam.position.set(sx + ox, this.camY + height + oy, dist);
    const speedFactor = Math.max(0, Math.min(1, (sim.speed - 12) / 15));
    const fov = 58 + portrait * 17 + speedFactor * 10;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov += (fov - cam.fov) * Math.min(1, dt * 3);
      cam.updateProjectionMatrix();
    }
    cam.lookAt(sim.x * 0.85, this.camY + 1.25, -8);
  }

  takeFlash() {
    const f = this.flash;
    this.flash = 0;
    return f;
  }

  /** Put one of every instanced thing in view, so every shader (and shadow shader) compiles now, not mid-run. */
  warm(renderer: THREE.WebGLRenderer) {
    const all = [...Object.values(this.pools), this.coins, this.halos, this.poles, ...Object.values(this.powerCards), ...this.houses];
    for (const p of all) {
      p.begin();
      m4.makeTranslation(0, 1, -6);
      p.add(m4, new THREE.Color(1, 1, 1));
      p.end();
    }
    this.fx.warm(this.camera);
    for (const a of Object.values(this.player.actions)) a.play();
    renderer.compile(this.scene, this.camera);
    renderer.render(this.scene, this.camera);
    for (const a of Object.values(this.player.actions)) a.stop();
    this.player.current = null;
    for (const p of all) { p.begin(); p.end(); }
    this.fx.clear();
  }
}

/** A wedge: 0 m high at the near end (+z), the train's height at the far end (-z). */
function rampMesh() {
  const w = OB.ramp.halfW, L = OB.ramp.depth / 2, H = OB.ramp.yt;
  // near-left, near-right, far-left, far-right (bottom), far-left, far-right (top)
  const p = [
    [-w, 0, L], [w, 0, L], [-w, 0, -L], [w, 0, -L], [-w, H, -L], [w, H, -L],
  ];
  const tris: number[][] = [
    [0, 1, 5], [0, 5, 4], // slope
    [0, 4, 2], // left side
    [1, 3, 5], // right side
    [2, 4, 5], [2, 5, 3], // back
  ];
  const pos: number[] = [], uv: number[] = [];
  for (const t of tris) for (const i of t) {
    pos.push(...p[i]);
    uv.push((p[i][0] + w) / (2 * w), (L - p[i][2]) / (2 * L) * 3 + p[i][1] * 0.3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: rampTexture(), side: THREE.FrontSide }));
  m.name = 'ramp';
  return m;
}
