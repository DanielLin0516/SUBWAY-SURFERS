// Browser tests: collision for every obstacle x action, controls feel (buffer, coyote time, fast fall,
// air lane change), the map always having a way through, pools not growing, shader programs constant.
// usage: CDP_PORT=9222 GAME_URL=http://127.0.0.1:4173/ node tests/e2e.mjs
import { open } from './cdp.mjs';

const p = await open({ url: (process.env.GAME_URL || 'http://127.0.0.1:4173/') + '?test' });
if (!(await p.ready())) { console.log('page did not become ready', p.problems); process.exit(1); }
await p.ev('__run.sceneryReady');

// helpers that run inside the page
await p.ev(`(() => {
  const R = __run, S = R.sim, X = (l) => (l - 1) * 2.5;
  const T = window.__t = {};
  T.fresh = (lane = 1, speed = 14) => {
    R.start({ seed: 1, noSpawn: true, speed }); R.clear();
    S.lane = lane; S.x = X(lane); S.fromX = S.x; S.laneT = 1; S.sinceStumble = 99;
    R.step(0.05, 1 / 120);
  };
  T.until = (fn, max = 6) => { let t = 0; while (!fn() && t < max && S.alive) { R.step(1 / 120, 1 / 120); t += 1 / 120; } return fn(); };
  T.ob = (id) => S.obs.find((o) => o.id === id);
  T.passed = (id, extra = 3) => { const o = T.ob(id); const end = o ? o.d1 : S.d; T.until(() => S.d > end + extra, 8); };
  T.result = () => ({ alive: S.alive, stumbled: S.sinceStumble < 50, lane: S.lane, y: +S.y.toFixed(2) });
  T.outcome = (r) => (!r.alive ? 'crash' : r.stumbled ? 'bounce' : 'pass');
  // one obstacle kind x one action
  T.case = (kind, action) => {
    if (action === 'side') {
      T.fresh(0);
      const id = R.place(kind, 1, kind === 'train' ? -3 : 0, 2);
      R.input('right');
      T.until(() => S.laneT >= 1 && Math.abs(S.x - X(S.lane)) < 0.01, 1);
      R.step(0.3, 1 / 120);
      return { ...T.result(), id };
    }
    T.fresh(1);
    const id = R.place(kind, 1, 14, 2);
    const o = T.ob(id);
    if (action === 'jump') { T.until(() => o.d0 - S.d <= 3.0); R.input('up'); }
    if (action === 'slide') { T.until(() => o.d0 - S.d <= 2.5); R.input('down'); }
    T.passed(id);
    return T.result();
  };
})()`);

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + JSON.stringify(detail) : '')); };

// ---------------------------------------------------------------- collision matrix
const expect = {
  low: { run: 'crash', jump: 'pass', slide: 'crash', side: 'bounce' },
  hurdle: { run: 'crash', jump: 'pass', slide: 'pass', side: 'bounce' },
  overhead: { run: 'crash', jump: 'crash', slide: 'pass', side: 'bounce' },
  train: { run: 'crash', jump: 'crash', slide: 'crash', side: 'bounce' },
};
for (const kind of Object.keys(expect)) {
  for (const action of Object.keys(expect[kind])) {
    const r = await p.ev(`__t.case('${kind}', '${action}')`);
    const got = r.alive ? (r.stumbled ? 'bounce' : 'pass') : 'crash';
    const sideOk = action !== 'side' || (r.alive && r.lane === 0);
    check(`${kind} x ${action} -> ${expect[kind][action]}`, got === expect[kind][action] && sideOk, r);
  }
}

// ---------------------------------------------------------------- surfaces
check('ramp + train: run up the ramp onto the roof, then off the end', await p.ev(`(() => {
  const R = __run, S = R.sim; __t.fresh(1);
  R.place('ramp', 1, 10); const id = R.place('train', 1, 17, 2);
  const t = __t.ob(id);
  __t.until(() => S.d > t.d0 + 3); const onTop = S.y; const grounded = S.grounded;
  __t.passed(id, 10);
  return onTop === 3.4 && grounded && S.alive && S.y === 0;
})()`));
check('spring shoes: jump onto a train roof from the ground', await p.ev(`(() => {
  const R = __run, S = R.sim; __t.fresh(1); S.power.shoes = 10;
  const id = R.place('train', 1, 16, 3); const t = __t.ob(id);
  __t.until(() => t.d0 - S.d <= 7); R.input('up');
  __t.until(() => S.grounded && S.d > t.d0 + 2);
  return S.alive && S.y === 3.4;
})()`));
check('roof to roof: change lanes across two trains side by side', await p.ev(`(() => {
  const R = __run, S = R.sim; __t.fresh(1);
  R.place('ramp', 1, 10); const id = R.place('train', 1, 17, 3); R.place('train', 2, 17, 3);
  const t = __t.ob(id);
  __t.until(() => S.d > t.d0 + 2); R.input('right'); R.step(0.4, 1 / 120);
  return S.alive && S.lane === 2 && S.y === 3.4 && S.sinceStumble > 50;
})()`));
check('drop off the side of a roof onto the ground', await p.ev(`(() => {
  const R = __run, S = R.sim; __t.fresh(1);
  R.place('ramp', 1, 10); const id = R.place('train', 1, 17, 3); const t = __t.ob(id);
  __t.until(() => S.d > t.d0 + 2); R.input('left'); R.step(1, 1 / 120);
  return S.alive && S.lane === 0 && S.y === 0 && S.grounded;
})()`));
check('ramp alone: up and back down, no crash', await p.ev(`(() => {
  const R = __run, S = R.sim; __t.fresh(1); const id = R.place('ramp', 1, 10); __t.passed(id, 12); return S.alive && S.y === 0;
})()`));
check('change lane into the side of a ramp low end: fine; high end: bounce', await p.ev(`(() => {
  const R = __run, S = R.sim; __t.fresh(0); R.place('ramp', 1, -0.2); R.input('right'); R.step(0.3, 1 / 120);
  const low = S.alive && S.lane === 1 && S.sinceStumble > 50;
  __t.fresh(0); R.place('ramp', 1, -5); R.input('right'); R.step(0.3, 1 / 120);
  const high = S.alive && S.lane === 0 && S.sinceStumble < 50;
  return low && high;
})()`));

// ---------------------------------------------------------------- forgiving edges
check('front corner graze while leaving the lane: passes, no stumble', await p.ev(`(() => {
  const R = __run, S = R.sim; __t.fresh(1); const id = R.place('train', 1, 14, 2); const t = __t.ob(id);
  __t.until(() => t.d0 - S.d <= 0.9); R.input('left'); __t.passed(id);
  return S.alive && S.sinceStumble > 50 && S.lane === 0;
})()`));
check('two side hits within 4.5 s: caught', await p.ev(`(() => {
  const R = __run, S = R.sim; __t.fresh(0); R.place('train', 1, -3, 3); R.input('right'); R.step(0.6, 1 / 120);
  const first = S.alive; R.input('right'); R.step(0.6, 1 / 120);
  return first && !S.alive;
})()`));
check('two side hits 5 s apart: still running', await p.ev(`(() => {
  const R = __run, S = R.sim; __t.fresh(0); R.place('train', 1, -3, 3); R.input('right'); R.step(5, 1 / 120);
  R.place('train', 1, -3, 3); R.input('right'); R.step(0.6, 1 / 120);
  return S.alive && S.lane === 0;
})()`));
check('steer into the edge of the track: bump only', await p.ev(`(() => {
  const R = __run, S = R.sim; __t.fresh(0); R.input('left'); R.step(0.3, 1 / 120); return S.alive && S.lane === 0 && S.sinceStumble > 50;
})()`));
check('come down onto a low barrier at the end of a long jump: land on top, no crash', await p.ev(`(() => {
  const R = __run, S = R.sim; __t.fresh(1); const id = R.place('low', 1, 14); const o = __t.ob(id);
  __t.until(() => o.d0 - S.d <= 8.6); R.input('up'); let stood = false;
  while (S.d < o.d1 + 3 && S.alive) { R.step(1 / 120, 1 / 120); if (S.grounded && S.y > 0.9) stood = true; }
  return S.alive && stood;
})()`));

// ---------------------------------------------------------------- controls feel
check('input buffer: jump pressed just before landing jumps again on landing', await p.ev(`(() => {
  const R = __run, S = R.sim; __t.fresh(1); R.input('up');
  __t.until(() => S.vy < 0 && S.y < 0.35); R.input('up');
  __t.until(() => S.grounded || S.vy > 0, 1); R.step(1 / 60, 1 / 120);
  return S.vy > 5;
})()`));
check('coyote time: jump right after running off a roof still jumps', await p.ev(`(() => {
  const R = __run, S = R.sim; __t.fresh(1); R.place('ramp', 1, 10); const id = R.place('train', 1, 17, 1); const t = __t.ob(id);
  __t.until(() => !S.grounded && S.d > t.d1 - 1); R.step(0.05, 1 / 120); R.input('up'); R.step(1 / 60, 1 / 120);
  return S.vy > 5;
})()`));
check('coyote time is short: 0.25 s after running off, no jump', await p.ev(`(() => {
  const R = __run, S = R.sim; __t.fresh(1); R.place('ramp', 1, 10); const id = R.place('train', 1, 17, 1); const t = __t.ob(id);
  __t.until(() => !S.grounded && S.d > t.d1 - 1); R.step(0.25, 1 / 120); R.input('up'); R.step(1 / 60, 1 / 120);
  return S.vy < 0;
})()`));
check('fast fall: down in the air drops fast, then rolls on landing', await p.ev(`(() => {
  const R = __run, S = R.sim; __t.fresh(1); R.input('up'); R.step(0.2, 1 / 120); const y0 = S.y; R.input('down');
  R.step(1 / 60, 1 / 120); const fast = S.vy <= -20; let t = 0; while (!S.grounded && t < 1) { R.step(1 / 120, 1 / 120); t += 1 / 120; }
  return fast && y0 > 1 && t < 0.12 && S.sliding;
})()`));
check('lane change in the air', await p.ev(`(() => {
  const R = __run, S = R.sim; __t.fresh(1); R.input('up'); R.step(0.1, 1 / 120); R.input('left'); R.step(0.18, 1 / 120);
  return !S.grounded && S.lane === 0 && Math.abs(S.x + 2.5) < 0.01;
})()`));
check('lane change takes about 0.15 s', await p.ev(`(() => {
  const R = __run, S = R.sim; __t.fresh(1); R.input('right'); let t = 0; while (Math.abs(S.x - 2.5) > 0.01 && t < 1) { R.step(1 / 120, 1 / 120); t += 1 / 120; }
  return t > 0.1 && t < 0.2;
})()`));
check('jump out of a roll', await p.ev(`(() => {
  const R = __run, S = R.sim; __t.fresh(1); R.input('down'); R.step(0.1, 1 / 120); R.input('up'); R.step(1 / 60, 1 / 120); return !S.sliding && S.vy > 5;
})()`));

// ---------------------------------------------------------------- pickups
check('coins: pick up in lane; magnet pulls from the next lane', await p.ev(`(() => {
  const R = __run, S = R.sim; __t.fresh(1); R.coin(1, 5); R.coin(0, 9); R.step(1, 1 / 120); const a = S.coins;
  __t.fresh(1); S.power.magnet = 10; R.coin(0, 9); R.coin(2, 12); R.step(1.2, 1 / 120);
  return a === 1 && S.coins === 2;
})()`));
check('power-ups: double score, spring shoes, magnet all apply', await p.ev(`(() => {
  const R = __run, S = R.sim; __t.fresh(1); R.power('double', 1, 5); R.power('shoes', 1, 9); R.power('magnet', 1, 13); R.step(1.3, 1 / 120);
  return S.power.double > 0 && S.power.shoes > 0 && S.power.magnet > 0 && S.mult === 2;
})()`));
check('speed rises with distance and stays capped', await p.ev(`(() => { const R = __run, S = R.sim; R.start({ seed: 2, noSpawn: true }); const v0 = S.speed; S.d = 3000; R.step(0.1); const v1 = S.speed; S.d = 40000; R.step(0.1); return v1 > v0 + 5 && S.speed <= 27.01; })()`));

// ---------------------------------------------------------------- map: always a way through
for (const seed of [1, 2, 3, 4, 5, 42, 1234]) {
  const r = await p.ev(`__run.mapCheck(${seed}, 20000)`);
  check(`map seed ${seed}: 20 km has a way through`, r.ok && r.tight === 0, r);
}

// ---------------------------------------------------------------- long run: pools and shader programs
const long = await p.ev(`(() => {
  const R = __run, S = R.sim, out = [];
  R.render(); const programs0 = R.stats().programs;
  R.start({ seed: 9, invincible: true });
  for (const t of [60, 240, 300, 300]) {
    R.step(t, 1 / 30); R.render();
    const st = R.stats();
    out.push({ d: Math.round(S.d), objects: st.objects, programs: st.programs, created: { ...S.created }, spawned: S.spawned, live: S.obs.length + S.coinList.length });
  }
  return { programs0, out };
})()`);
const o = long.out;
check('long run (15 min of play): no new objects in the scene', o.every((x) => x.objects === o[0].objects), long);
check('long run: pools stay small while thousands of things are spawned (at most +2 between 9 and 15 min)', o[3].created.obs - o[2].created.obs <= 2 && o[3].created.coins - o[2].created.coins <= 10 && o[3].created.obs < 80 && o[3].created.coins < 400 && o[3].spawned > 5000, o.map((x) => ({ created: x.created, spawned: x.spawned })));
check('long run: shader programs constant from title screen to the end', o.every((x) => x.programs === long.programs0), { start: long.programs0, during: o.map((x) => x.programs) });

// a bot follows the solver's path through the real simulation (real collisions, real jump/roll timing)
for (const seed of [1, 2, 3, 4, 5]) {
  const r = await p.ev(`__run.autopilot(${seed}, 8000)`);
  check(`autopilot seed ${seed}: runs 8 km through the real game without a stumble`, r.ok && r.stumbles === 0, { d: r.d, jumps: r.jumps, slides: r.slides, lanes: r.lanes, near: r.near });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (p.problems.length) console.log('page problems:', p.problems);
await p.close();
process.exit(failed.length ? 1 : 0);
