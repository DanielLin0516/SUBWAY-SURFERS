# SUBWAY-SURFERS

English ｜ [中文](./README_ZH.md)

A three-lane endless runner made with three.js and TypeScript.

> The online version at <https://subway-surfers-threejs.vercel.app/> is still the **old** version until this branch is deployed.

## Play

| | Keyboard | Touch |
|---|---|---|
| Change lane | ← → or A D | swipe left / right |
| Jump | ↑, W or Space | swipe up |
| Roll (in the air: drop fast, then roll) | ↓ or S | swipe down |
| Pause | Esc or P | pause button |
| Sound on/off | M | sound button |

A swipe fires as soon as the finger has moved far enough, and one touch can swipe twice. Works in portrait and landscape.

## Features

- **Lane-based collision.** Each obstacle is an interval along the track, across its lane, and in height; the runner is a small box. Results are exact and repeatable. Forgiving edges: clipping a corner while leaving a lane is ignored; steering into the side of something bounces you back with a stumble (two stumbles within 4.5 s and you are caught); coming down onto a low barrier or a roof lets you stand on it.
- **Obstacles:** low barriers (jump), hurdles (jump or roll), overhead gates (roll), trains (dodge, or run up a ramp and along the roofs).
- **Feel:** fast eased lane changes (0.15 s), lane changes in the air, jump buffer (a jump pressed just before landing still happens), coyote time, fast fall, jump out of a roll, speed rising slowly from 12 to 27 m/s.
- **Endless map** built in ~100 m chunks. Every chunk is checked with a path search before it is used, so there is always a way through; difficulty grows with distance. Coins are laid along that way.
- **Coins, score multiplier** (rises every 800 m), **best score** and coin bank saved in localStorage.
- **Power-ups:** magnet, spring shoes (jump onto trains), double score.
- **Sound** synthesised with WebAudio (no audio files), with a simple beat that speeds up with you.
- **Screens:** loading (real byte-count progress), title, pause, result. Traditional Chinese, Simplified Chinese and English, picked from the browser.
- **Performance:** everything repeated is an InstancedMesh written fresh each frame from the game state (no objects created during play), a fixed light set and every shader compiled before play, pixel ratio capped at 2 and lowered automatically when frames are slow.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + build to dist/
npm run preview    # serve dist/ on http://localhost:4173
```

### Models

`public/assets/core.glb` (runner, trains, barriers, coin; needed for the first screen) and `public/assets/scenery.glb` (houses; loaded in the background) are generated from the source models in `art/source-glb/` with Blender:

```bash
npm run assets     # Blender in background mode: tools/build_assets.py, then tools/slim_glb.mjs
```

### Tests

The tests drive the built game in headless Chrome through the DevTools protocol. Open the page with `?test` to get `window.__run` (step time, place obstacles, send input, read state).

```bash
npm run build && npm run preview &
google-chrome --headless=new --remote-debugging-port=9222 &
CDP_PORT=9222 GAME_URL=http://127.0.0.1:4173/ node tests/e2e.mjs     # collision, feel, map, pools, shaders
CDP_PORT=9222 GAME_URL=http://127.0.0.1:4173/ node tests/input.mjs   # swipes and keys
```

## Layout

```
src/sim/      game rules, no three.js: sim.ts (runner, collision, pickups), track.ts (map + path search)
src/view/     three.js: world.ts (scene, camera), player.ts, pools.ts (instancing), fx.ts, textures.ts
src/          main.ts (states, loop, test hook), ui.ts, input.ts, audio.ts, i18n.ts, storage.ts
tools/        build_assets.py (Blender), slim_glb.mjs
tests/        browser tests
```
