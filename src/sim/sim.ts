// The game rules, with no three.js in it: the runner, obstacles, coins, power-ups, score.
// Collision is lane based: every obstacle is an interval along the track, across its lane, and in height,
// and the runner is a small box. Plain interval checks, so the result is the same every time.
import {
  PLAYER, GRAVITY, JUMP_V, SUPER_JUMP_V, OB, laneX, speedAt, POWER_TIME, MAGNET_RANGE, VIEW_AHEAD, LANE_COUNT,
} from '../config';
import type { Ob, Coin, Power, SimEvent, ObKind, PowerKind, Hint } from './types';
import { Track, type Spec } from './track';

const MAX_STEP = 1 / 120;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);

export class Sim {
  // runner
  lane = 1;
  fromX = 0;
  laneT = 1;
  x = 0;
  y = 0;
  vy = 0;
  grounded = true;
  groundY = 0;
  slideT = 0;
  fastFall = false;
  slideQueued = false;
  coyoteT = 0;
  jumpBufT = 0;
  d = 0;
  speed = 0;
  alive = true;
  running = false; // false on the title screen
  time = 0;
  sinceStumble = 99;
  stumbleSlow = 0;
  ignoreId = -1;
  ignoreT = 0;
  airTime = 0;
  peakY = 0;
  // pickups / score
  coins = 0;
  coinStreak = 0;
  coinStreakT = 0;
  score = 0;
  power: Record<PowerKind, number> = { magnet: 0, shoes: 0, double: 0 };
  baseMult = 1;
  // world
  obs: Ob[] = [];
  coinList: Coin[] = [];
  powers: Power[] = [];
  events: SimEvent[] = [];
  track: Track;
  invincible = false; // test switch
  noSpawn = false; // test switch
  speedOverride = 0;
  private nextId = 1;
  // pools: removed objects are kept and reused, so a long run does not keep allocating
  private freeObs: Ob[] = [];
  private freeCoins: Coin[] = [];
  private freePowers: Power[] = [];
  created = { obs: 0, coins: 0, powers: 0 };

  constructor(seed = 1) {
    this.track = new Track(seed, {
      ob: (s) => this.addOb(s),
      coin: (lane, d, y) => this.addCoin(lane, d, y),
      power: (kind, lane, d, y) => this.addPower(kind, lane, d, y),
    });
  }

  reset(seed: number, tutorial: boolean) {
    for (const o of this.obs) this.freeObs.push(o);
    for (const c of this.coinList) this.freeCoins.push(c);
    for (const p of this.powers) this.freePowers.push(p);
    this.obs.length = 0;
    this.coinList.length = 0;
    this.powers.length = 0;
    this.events.length = 0;
    Object.assign(this, {
      lane: 1, fromX: 0, laneT: 1, x: 0, y: 0, vy: 0, grounded: true, groundY: 0, slideT: 0, fastFall: false,
      slideQueued: false, coyoteT: 0, jumpBufT: 0, d: 0, speed: 0, alive: true, running: false, time: 0,
      sinceStumble: 99, stumbleSlow: 0, ignoreId: -1, ignoreT: 0, airTime: 0, peakY: 0, coins: 0, coinStreak: 0,
      coinStreakT: 0, score: 0, baseMult: 1,
    });
    this.power = { magnet: 0, shoes: 0, double: 0 };
    this.track.reset(seed, tutorial);
    if (!this.noSpawn) this.track.ensure(VIEW_AHEAD);
  }

  // ------------------------------------------------------------------ pools
  addOb(s: Spec): Ob {
    const o = this.freeObs.pop() || ({} as Ob);
    if (!o.id) this.created.obs++;
    const shape = OB[s.kind];
    Object.assign(o, {
      id: this.nextId++, kind: s.kind, lane: s.lane, d0: s.d0, d1: s.d1, yb: shape.yb, yt: shape.yt, halfW: shape.halfW,
      walk: shape.walk, cars: s.cars || 1, variant: s.variant || 0, hint: s.hint || null, hinted: false,
    });
    this.obs.push(o);
    return o;
  }
  addCoin(lane: number, d: number, y: number) {
    const c = this.freeCoins.pop() || ({} as Coin);
    if (!c.id) this.created.coins++;
    Object.assign(c, { id: this.nextId++, lane, d, y, x: laneX(lane), pulled: false });
    this.coinList.push(c);
  }
  addPower(kind: PowerKind, lane: number, d: number, y: number) {
    const p = this.freePowers.pop() || ({} as Power);
    if (!p.id) this.created.powers++;
    Object.assign(p, { id: this.nextId++, kind, lane, d, y });
    this.powers.push(p);
  }
  clearWorld() {
    for (const o of this.obs) this.freeObs.push(o);
    for (const c of this.coinList) this.freeCoins.push(c);
    for (const p of this.powers) this.freePowers.push(p);
    this.obs.length = 0;
    this.coinList.length = 0;
    this.powers.length = 0;
  }

  // ------------------------------------------------------------------ input
  start() {
    this.running = true;
  }
  left() { this.changeLane(-1); }
  right() { this.changeLane(1); }
  private changeLane(dir: number) {
    if (!this.alive || !this.running) return;
    const target = this.lane + dir;
    if (target < 0 || target >= LANE_COUNT) {
      this.events.push({ type: 'bump', dir });
      return;
    }
    this.fromX = this.x;
    this.lane = target;
    this.laneT = 0;
    this.events.push({ type: 'lane', dir });
  }
  jump() {
    if (!this.alive || !this.running) return;
    if (this.grounded || this.coyoteT > 0) this.doJump();
    else this.jumpBufT = PLAYER.buffer;
  }
  down() {
    if (!this.alive || !this.running) return;
    this.jumpBufT = 0;
    if (this.grounded) this.startSlide();
    else {
      this.fastFall = true;
      this.slideQueued = true;
    }
  }
  private doJump() {
    const sup = this.power.shoes > 0;
    this.vy = sup ? SUPER_JUMP_V : JUMP_V;
    this.grounded = false;
    this.coyoteT = 0;
    this.jumpBufT = 0;
    this.slideT = 0;
    this.fastFall = false;
    this.slideQueued = false;
    this.airTime = 0;
    this.peakY = this.y;
    this.events.push({ type: 'jump', super: sup });
  }
  private startSlide() {
    this.slideT = PLAYER.slideTime;
    this.events.push({ type: 'slide' });
  }

  get spawned() { return this.nextId - 1; }
  get sliding() { return this.slideT > 0; }
  get bodyH() { return this.sliding ? PLAYER.slideHeight : PLAYER.height; }
  get mult() { return this.baseMult * (this.power.double > 0 ? 2 : 1); }

  // ------------------------------------------------------------------ update
  update(dt: number) {
    if (!this.running) return;
    let left = Math.min(dt, 0.1);
    while (left > 1e-6) {
      const h = Math.min(MAX_STEP, left);
      this.step(h);
      left -= h;
    }
  }

  private step(dt: number) {
    this.time += dt;
    if (!this.alive) {
      this.speed = 0;
      if (!this.grounded) {
        this.vy -= GRAVITY * dt;
        this.y = Math.max(this.groundY, this.y + this.vy * dt);
        if (this.y <= this.groundY) this.grounded = true;
      }
      return;
    }
    const prevX = this.x, prevY = this.y, prevD = this.d, prevH = this.bodyH;
    // timers
    this.sinceStumble += dt;
    this.stumbleSlow = Math.max(0, this.stumbleSlow - dt);
    this.ignoreT = Math.max(0, this.ignoreT - dt);
    this.coyoteT = Math.max(0, this.coyoteT - dt);
    this.jumpBufT = Math.max(0, this.jumpBufT - dt);
    this.coinStreakT = Math.max(0, this.coinStreakT - dt);
    if (this.coinStreakT === 0) this.coinStreak = 0;
    if (this.slideT > 0) this.slideT = Math.max(0, this.slideT - dt);
    for (const k of ['magnet', 'shoes', 'double'] as PowerKind[]) {
      if (this.power[k] > 0) {
        this.power[k] = Math.max(0, this.power[k] - dt);
        if (this.power[k] === 0) this.events.push({ type: 'powerEnd', kind: k });
      }
    }
    // speed
    const base = this.speedOverride || speedAt(this.d);
    this.speed = base * (this.stumbleSlow > 0 ? 0.82 : 1);
    this.d += this.speed * dt;
    const mult = 1 + Math.min(5, Math.floor(this.d / 800));
    if (mult !== this.baseMult) {
      this.baseMult = mult;
      this.events.push({ type: 'level', mult });
    }
    this.score += this.speed * dt * 0.5 * this.mult;
    // sideways
    if (this.laneT < 1) {
      this.laneT = Math.min(1, this.laneT + dt / PLAYER.laneTime);
      this.x = this.fromX + (laneX(this.lane) - this.fromX) * easeOut(this.laneT);
    } else this.x = laneX(this.lane);
    // up and down
    if (!this.grounded) {
      this.airTime += dt;
      this.vy -= GRAVITY * dt * (this.vy < 0 ? 1.15 : 1);
      if (this.fastFall) this.vy = Math.min(this.vy, -PLAYER.fastFallSpeed);
      this.y += this.vy * dt;
      this.peakY = Math.max(this.peakY, this.y);
    }
    this.groundY = this.supportAt(this.x, this.d, this.grounded ? this.y : Math.max(this.y, prevY));
    if (this.grounded) {
      if (this.groundY < this.y - 0.05) {
        // ran off an edge
        this.grounded = false;
        this.coyoteT = PLAYER.coyote;
        this.vy = 0;
        this.airTime = 0;
        this.peakY = this.y;
      } else this.y = this.groundY;
    }
    if (!this.grounded && this.y <= this.groundY && this.vy <= 0) this.land();

    this.collide(prevX, prevY, prevD, prevH);
    if (!this.alive) return;
    this.pickups(dt);
    this.hints();
    // keep the map ahead, drop what is behind
    if (!this.noSpawn) this.track.ensure(this.d + VIEW_AHEAD);
    this.recycle();
  }

  private land() {
    const fall = this.peakY - this.groundY;
    this.y = this.groundY;
    this.vy = 0;
    this.grounded = true;
    this.fastFall = false;
    this.events.push({ type: 'land', fall });
    if (this.jumpBufT > 0) this.doJump();
    else if (this.slideQueued) {
      this.slideQueued = false;
      this.startSlide();
    }
  }

  /** Highest surface under the runner that it can stand on, given its feet are at `feet`. */
  supportAt(x: number, d: number, feet: number) {
    let g = 0;
    for (const o of this.obs) {
      if (!o.walk) continue;
      if (d + PLAYER.halfD * 0.5 < o.d0 || d - PLAYER.halfD * 0.5 > o.d1) continue;
      if (Math.abs(x - laneX(o.lane)) > o.halfW + PLAYER.halfW - 0.25) continue;
      const top = this.topAt(o, d);
      if (feet >= top - PLAYER.stepUp && top > g) g = top;
    }
    return g;
  }

  topAt(o: Ob, d: number) {
    if (o.kind === 'ramp') return Math.max(0, Math.min(1, (d - o.d0) / (o.d1 - o.d0))) * o.yt;
    return o.yt;
  }

  private overlaps(o: Ob, x: number, y: number, d: number, h: number) {
    if (d + PLAYER.halfD <= o.d0 || d - PLAYER.halfD >= o.d1) return false;
    if (Math.abs(x - laneX(o.lane)) >= o.halfW + PLAYER.halfW) return false;
    const top = this.topAt(o, d);
    const feet = y + PLAYER.feetTol, head = y + h - PLAYER.headTol;
    if (o.walk && y >= top - PLAYER.stepUp) return false; // standing on it (or stepping up)
    return head > o.yb && feet < top;
  }

  private collide(px: number, py: number, pd: number, ph: number) {
    const h = this.bodyH;
    for (const o of this.obs) {
      if (o.d0 > this.d + 8 || o.d1 < this.d - 8) continue;
      if (o.id === this.ignoreId && this.ignoreT > 0) continue;
      if (!this.overlaps(o, this.x, this.y, this.d, h)) continue;
      const dx = Math.abs(this.x - laneX(o.lane));
      const dBefore = !(pd + PLAYER.halfD <= o.d0 || pd - PLAYER.halfD >= o.d1);
      const xBefore = Math.abs(px - laneX(o.lane)) < o.halfW + PLAYER.halfW;
      if (!dBefore) {
        // ran into its front
        if (o.walk && this.y >= this.topAt(o, this.d) - PLAYER.stepUp * 1.6) {
          // nearly on top: climb up instead of dying
          this.y = this.topAt(o, this.d);
          this.groundY = this.y;
          if (!this.grounded) this.land();
          continue;
        }
        if (dx > PLAYER.grazeX) {
          // clipped a front corner
          const away = Math.sign(this.x - px) === Math.sign(this.x - laneX(o.lane));
          if (away) {
            // already leaving that lane: let it go
            this.ignoreId = o.id;
            this.ignoreT = 0.4;
            continue;
          }
          this.bounce(o);
        } else this.crash(o.kind, o);
        return;
      }
      if (!xBefore) {
        // came in from the side while changing lanes
        this.bounce(o);
        return;
      }
      // came in from above or below
      const wasOver = py >= this.topAt(o, pd) - 0.05;
      if (wasOver) {
        if (o.walk) {
          this.y = this.topAt(o, this.d);
          this.groundY = this.y;
          if (!this.grounded) this.land();
        }
        // a bar from above: let it pass
        continue;
      }
      if (py + ph - PLAYER.headTol <= o.yb + 0.05 && this.vy > 0) {
        // head bump from below: stop rising
        this.vy = 0;
        this.y = Math.max(this.groundY, o.yb - h + PLAYER.headTol - 0.01);
        continue;
      }
      this.bounce(o);
      return;
    }
  }

  private bounce(o: Ob) {
    // go back toward the lane we came from
    const back = o.lane + (this.x < laneX(o.lane) ? -1 : 1);
    if (back < 0 || back >= LANE_COUNT) {
      this.crash(o.kind, o);
      return;
    }
    this.fromX = this.x;
    this.lane = back;
    this.laneT = 0;
    this.ignoreId = o.id;
    this.ignoreT = 0.35;
    this.stumble();
  }

  private stumble() {
    if (this.sinceStumble < PLAYER.stumbleWindow && !this.invincible) {
      this.crash('caught');
      return;
    }
    this.sinceStumble = 0;
    this.stumbleSlow = 0.6;
    this.events.push({ type: 'stumble', x: this.x, y: this.y });
  }

  private crash(kind: ObKind | 'caught', o?: Ob) {
    if (this.invincible) {
      // test switch: count it, then run through
      this.events.push({ type: 'stumble', x: this.x, y: this.y });
      if (o) { this.ignoreId = o.id; this.ignoreT = 2; }
      return;
    }
    this.alive = false;
    this.slideT = 0;
    this.events.push({ type: 'crash', kind, x: this.x, y: this.y });
  }

  private pickups(dt: number) {
    const h = this.bodyH;
    const magnet = this.power.magnet > 0;
    for (let i = this.coinList.length - 1; i >= 0; i--) {
      const c = this.coinList[i];
      const ahead = c.d - this.d;
      if (ahead > MAGNET_RANGE + 2) continue;
      if (magnet && ahead < MAGNET_RANGE && ahead > -2) c.pulled = true;
      if (c.pulled) {
        const k = Math.min(1, dt * 14);
        c.x += (this.x - c.x) * k;
        c.y += (this.y + 1 - c.y) * k;
        c.d += (this.d - c.d) * k + this.speed * dt * 0.3;
      }
      if (Math.abs(ahead) < 0.9 && Math.abs(c.x - this.x) < 1.0 && c.y > this.y - 0.4 && c.y < this.y + h + 0.5) {
        this.coins++;
        this.coinStreak++;
        this.coinStreakT = 0.6;
        this.score += 5 * this.mult;
        this.events.push({ type: 'coin', x: c.x, y: c.y, streak: this.coinStreak });
        this.freeCoins.push(c);
        this.coinList.splice(i, 1);
      }
    }
    for (let i = this.powers.length - 1; i >= 0; i--) {
      const p = this.powers[i];
      const x = laneX(p.lane);
      if (Math.abs(p.d - this.d) < 1.0 && Math.abs(x - this.x) < 1.1 && p.y > this.y - 0.5 && p.y < this.y + h + 0.6) {
        this.power[p.kind] = POWER_TIME[p.kind];
        this.events.push({ type: 'power', kind: p.kind, x, y: p.y });
        this.freePowers.push(p);
        this.powers.splice(i, 1);
      }
    }
  }

  private hints() {
    for (const o of this.obs) {
      if (o.hint && !o.hinted && o.d0 - this.d < this.speed * 1.5 && o.d0 > this.d) {
        o.hinted = true;
        this.events.push({ type: 'hint', hint: o.hint as Hint });
      }
    }
  }

  private recycle() {
    const behind = this.d - 14;
    for (let i = this.obs.length - 1; i >= 0; i--) {
      if (this.obs[i].d1 < behind) this.freeObs.push(this.obs.splice(i, 1)[0]);
    }
    for (let i = this.coinList.length - 1; i >= 0; i--) {
      if (this.coinList[i].d < behind) this.freeCoins.push(this.coinList.splice(i, 1)[0]);
    }
    for (let i = this.powers.length - 1; i >= 0; i--) {
      if (this.powers[i].d < behind) this.freePowers.push(this.powers.splice(i, 1)[0]);
    }
  }

  drainEvents(): SimEvent[] {
    const e = this.events.slice();
    this.events.length = 0;
    return e;
  }

  snapshot() {
    return {
      lane: this.lane, x: +this.x.toFixed(3), y: +this.y.toFixed(3), vy: +this.vy.toFixed(2), d: +this.d.toFixed(2),
      speed: +this.speed.toFixed(2), grounded: this.grounded, sliding: this.sliding, alive: this.alive, running: this.running,
      coins: this.coins, score: Math.floor(this.score), mult: this.mult, power: { ...this.power },
      sinceStumble: +this.sinceStumble.toFixed(2), groundY: +this.groundY.toFixed(2),
      obs: this.obs.length, coinCount: this.coinList.length, powers: this.powers.length,
      created: { ...this.created }, pooled: { obs: this.freeObs.length, coins: this.freeCoins.length, powers: this.freePowers.length },
    };
  }
}
