// The runner: the skinned model from core.glb, its clips mixed by game state, plus leaning and squash.
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Sim } from '../sim/sim';
import type { SimEvent } from '../sim/types';
import { PLAYER, JUMP_V, SUPER_JUMP_V, GRAVITY } from '../config';

type Clip = 'idle' | 'run' | 'jump' | 'jumpup' | 'fall' | 'roll' | 'die' | 'runlookback';

export class PlayerView {
  root = new THREE.Group();
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions = {} as Record<Clip, THREE.AnimationAction>;
  current: Clip | null = null;
  private lean = 0;
  private squash = 0;
  private stumbleT = 0;
  private menuT = 0;

  constructor(gltf: GLTF, scene: THREE.Scene) {
    const model = gltf.scene.getObjectByName('player')!;
    model.removeFromParent();
    // keep the armature's own transform; turn a holder instead (the model faces +Z, the run goes toward -Z)
    const holder = new THREE.Group();
    holder.rotation.y = Math.PI;
    holder.add(model);
    this.model = holder;
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = false;
        m.frustumCulled = false;
      }
    });
    this.root.add(holder);
    scene.add(this.root);
    this.mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) {
      const name = clip.name as Clip;
      const a = this.mixer.clipAction(clip);
      if (['jump', 'jumpup', 'roll', 'die', 'runlookback'].includes(name)) {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      this.actions[name] = a;
    }
  }

  play(name: Clip, fade = 0.12, timeScale = 1) {
    const next = this.actions[name];
    if (!next) return;
    next.timeScale = timeScale;
    if (this.current === name && next.isRunning()) return;
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    const prev = this.current ? this.actions[this.current] : null;
    if (prev && prev !== next) prev.fadeOut(fade);
    this.current = name;
  }

  reset() {
    this.mixer.stopAllAction();
    this.current = null;
    this.lean = 0;
    this.squash = 0;
    this.stumbleT = 0;
    this.root.scale.set(1, 1, 1);
    this.root.rotation.set(0, 0, 0);
  }

  menu(dt: number) {
    this.menuT += dt;
    this.play('idle', 0.3);
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, Math.sin(this.menuT * 0.4) * 0.25, 0); // faces -Z, toward the title-screen camera
    this.mixer.update(dt);
  }

  update(sim: Sim, dt: number, events: SimEvent[]) {
    this.root.rotation.y = 0;
    for (const e of events) {
      if (e.type === 'jump') {
        const v0 = e.super ? SUPER_JUMP_V : JUMP_V;
        const air = (2 * v0) / GRAVITY;
        const d = this.actions.jump.getClip().duration;
        this.play('jump', 0.06, d / (air * 1.1));
      } else if (e.type === 'slide') {
        this.play('roll', 0.06, this.actions.roll.getClip().duration / (PLAYER.slideTime * 1.05));
      } else if (e.type === 'land') {
        this.squash = Math.min(0.22, 0.08 + e.fall * 0.04);
      } else if (e.type === 'stumble') {
        this.stumbleT = 0.55;
        this.play('runlookback', 0.08, 1.8);
      } else if (e.type === 'crash') {
        this.play('die', 0.08, 1.2);
      }
    }
    this.stumbleT = Math.max(0, this.stumbleT - dt);
    if (sim.alive) {
      const busy = (this.current === 'jump' && !sim.grounded) || (this.current === 'roll' && sim.sliding) || this.stumbleT > 0;
      if (!busy) {
        if (!sim.grounded && sim.vy < -3 && this.current !== 'jump') this.play('fall', 0.15);
        else if (sim.grounded && !sim.sliding) this.play('run', 0.12, 0.9 + sim.speed / 22);
      }
      // ended a slide early by jumping, or a jump clip finished in the air
      if (this.current === 'roll' && !sim.sliding && sim.grounded) this.play('run', 0.1, 0.9 + sim.speed / 22);
    }
    // lean into lane changes
    const target = sim.laneT < 1 ? Math.sign(sim.x - sim.fromX) * Math.sin(Math.PI * sim.laneT) : 0;
    this.lean += (target - this.lean) * Math.min(1, dt * 18);
    this.squash = Math.max(0, this.squash - dt * 1.4);
    this.root.position.set(sim.x, sim.y, 0);
    this.root.rotation.z = -this.lean * 0.2;
    this.model.rotation.y = Math.PI - this.lean * 0.35;
    const sq = this.squash;
    this.root.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
    this.mixer.update(dt);
  }
}
