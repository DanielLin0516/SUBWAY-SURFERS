// Touch swipes and keyboard, sent as real input events through the DevTools protocol.
// usage: CDP_PORT=9222 GAME_URL=http://127.0.0.1:4173/ node tests/input.mjs
import { open } from './cdp.mjs';

const p = await open({ w: 390, h: 844, mobile: true, url: (process.env.GAME_URL || 'http://127.0.0.1:4173/') + '?test' });
if (!(await p.ready())) { console.log('not ready'); process.exit(1); }
await p.ev(`(() => { __run.start({ seed: 1, noSpawn: true }); __run.clear(); return 1; })()`);
const touch = (type, x, y) => p.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
const swipe = async (dx, dy) => { await touch('touchStart', 195, 500); await touch('touchMove', 195 + dx * 0.5, 500 + dy * 0.5); await touch('touchMove', 195 + dx, 500 + dy); await touch('touchEnd'); };
const key = async (key, code) => { await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code }); await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code }); };
const results = [];
const check = (name, ok, v) => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + ' ' + JSON.stringify(v)); };

await swipe(-80, 0);
let v = await p.ev('__run.sim.lane'); check('swipe left changes lane', v === 0, v);
await swipe(80, 0); await p.ev('__run.step(0.3)'); await swipe(80, 0);
v = await p.ev('__run.sim.lane'); check('two swipes right', v === 2, v);
await swipe(0, -80);
v = await p.ev('__run.sim.vy'); check('swipe up jumps', v > 5, v);
await p.ev('__run.step(1)');
await swipe(0, 80);
v = await p.ev('__run.sim.sliding'); check('swipe down rolls', v === true, v);
await touch('touchStart', 195, 500); await touch('touchMove', 150, 500); await touch('touchMove', 100, 500);
v = await p.ev('__run.sim.lane'); check('nothing happens before the finger lifts', v === 2, v);
await touch('touchEnd');
v = await p.ev('__run.sim.lane'); check('one touch moves one lane, read on lifting', v === 1, v);
await touch('touchStart', 195, 500); await touch('touchMove', 200, 505); await touch('touchEnd');
v = await p.ev('__run.sim.lane'); check('a tap that barely moves does nothing', v === 1, v);
await p.ev('__run.step(0.5)');
await key('ArrowRight', 'ArrowRight'); await p.ev('__run.step(0.2)'); await key('d', 'KeyD'); await p.ev('__run.step(0.2)');
v = await p.ev('__run.sim.lane'); check('arrow / D keys', v === 2, v);
await key(' ', 'Space');
v = await p.ev('__run.sim.vy'); check('space jumps', v > 5, v);
await key('Escape', 'Escape');
v = await p.ev('__run.state().screen'); check('Esc pauses', v === 'pause', v);
await key('Escape', 'Escape');
v = await p.ev('__run.state().screen'); check('Esc again resumes', v === 'play', v);
await key('m', 'KeyM');
v = await p.ev('JSON.parse(localStorage.getItem("subway.muted"))'); check('M toggles mute and remembers it', v === true, v);
await key('m', 'KeyM');
console.log(`${results.filter(Boolean).length}/${results.length} passed`, p.problems.length ? p.problems : '');
await p.close();
process.exit(results.every(Boolean) ? 0 : 1);
