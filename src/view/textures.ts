// Textures drawn on a canvas at start-up: no image files to download for the ground, sky, glow and icons.
import * as THREE from 'three';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d') as CanvasRenderingContext2D };
}
function tex(c: HTMLCanvasElement, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
// deterministic noise so every load looks the same
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** One lane of track, 2.5 m x 2.5 m: gravel, two sleepers' worth of wood, two rails. */
export function trackTexture() {
  const S = 256;
  const { c, g } = canvas(S, S);
  g.fillStyle = '#8d8478';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    const v = 95 + rnd() * 70;
    g.fillStyle = `rgb(${v + 10},${v + 4},${v - 6})`;
    g.fillRect(rnd() * S, rnd() * S, 2 + rnd() * 3, 2 + rnd() * 3);
  }
  // sleepers
  for (let k = 0; k < 4; k++) {
    const y = k * (S / 4) + 10;
    g.fillStyle = '#5b4434';
    g.fillRect(18, y, S - 36, 24);
    g.fillStyle = '#6e5442';
    g.fillRect(18, y, S - 36, 7);
  }
  // rails
  for (const x of [0.24, 0.76]) {
    g.fillStyle = '#4c4f55';
    g.fillRect(x * S - 7, 0, 14, S);
    g.fillStyle = '#c9ced6';
    g.fillRect(x * S - 4, 0, 8, S);
  }
  return tex(c);
}

/** Paving slabs for the sidewalks. */
export function pavingTexture() {
  const S = 256;
  const { c, g } = canvas(S, S);
  g.fillStyle = '#c7bfb1';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) {
    const v = 175 + rnd() * 40;
    g.fillStyle = `rgba(${v},${v - 6},${v - 16},0.5)`;
    g.fillRect(rnd() * S, rnd() * S, 2, 2);
  }
  g.strokeStyle = '#9d9587';
  g.lineWidth = 4;
  for (let k = 0; k <= 2; k++) {
    g.beginPath(); g.moveTo(0, k * 128); g.lineTo(S, k * 128); g.stroke();
    g.beginPath(); g.moveTo(k * 128, 0); g.lineTo(k * 128, S); g.stroke();
  }
  return tex(c);
}

export function groundTexture() {
  const S = 128;
  const { c, g } = canvas(S, S);
  g.fillStyle = '#7d9a5c';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 500; i++) {
    const v = rnd();
    g.fillStyle = v > 0.5 ? 'rgba(95,125,70,0.6)' : 'rgba(140,165,95,0.5)';
    g.fillRect(rnd() * S, rnd() * S, 3, 3);
  }
  return tex(c);
}

export function skyTexture() {
  const { c, g } = canvas(4, 256);
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#3f8fe0');
  gr.addColorStop(0.45, '#8cc4f0');
  gr.addColorStop(0.62, '#ffe6c7');
  gr.addColorStop(1, '#ffd9b0');
  g.fillStyle = gr;
  g.fillRect(0, 0, 4, 256);
  const t = tex(c, false);
  return t;
}
export const HORIZON = new THREE.Color('#f6dcc0');

/** Soft round dot for glows and sparks. */
export function glowTexture() {
  const S = 64;
  const { c, g } = canvas(S, S);
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.65)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S);
  return tex(c, false);
}

/** Power-up cards: a rounded tile with a simple drawn icon. */
export function powerTexture(kind: 'magnet' | 'shoes' | 'double') {
  const S = 128;
  const { c, g } = canvas(S, S);
  const bg = { magnet: '#e8414b', shoes: '#2fb36b', double: '#f2a516' }[kind];
  g.fillStyle = 'rgba(255,255,255,0.95)';
  round(g, 4, 4, S - 8, S - 8, 26);
  g.fill();
  g.fillStyle = bg;
  round(g, 12, 12, S - 24, S - 24, 20);
  g.fill();
  g.lineCap = 'round';
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  if (kind === 'magnet') {
    g.lineWidth = 18;
    g.beginPath();
    g.arc(64, 60, 26, Math.PI, 0, true);
    g.stroke();
    g.beginPath(); g.moveTo(38, 60); g.lineTo(38, 88); g.moveTo(90, 60); g.lineTo(90, 88); g.stroke();
    g.strokeStyle = '#2a2a2a';
    g.lineWidth = 18;
    g.lineCap = 'butt';
    g.beginPath(); g.moveTo(38, 84); g.lineTo(38, 98); g.moveTo(90, 84); g.lineTo(90, 98); g.stroke();
  } else if (kind === 'shoes') {
    // a sneaker on a spring
    g.beginPath();
    g.moveTo(30, 70); g.lineTo(30, 40); g.lineTo(52, 40); g.quadraticCurveTo(60, 58, 96, 62);
    g.quadraticCurveTo(104, 64, 102, 74); g.lineTo(30, 74); g.closePath();
    g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = 6;
    g.beginPath();
    for (let i = 0; i < 4; i++) { g.moveTo(44, 82 + i * 6); g.lineTo(84, 85 + i * 6); }
    g.stroke();
  } else {
    g.font = 'bold 64px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('×2', 64, 68);
  }
  return tex(c, false);
}

function round(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Yellow and black hazard stripes for the ramps. */
export function rampTexture() {
  const S = 128;
  const { c, g } = canvas(S, S);
  g.fillStyle = '#f2c230';
  g.fillRect(0, 0, S, S);
  g.fillStyle = '#2a2a2a';
  for (let k = -2; k < 4; k++) {
    g.beginPath();
    g.moveTo(k * 48, S); g.lineTo(k * 48 + 24, S); g.lineTo(k * 48 + 24 + S, 0); g.lineTo(k * 48 + S, 0);
    g.closePath();
    g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.12)';
  for (let y = 0; y < S; y += 16) g.fillRect(0, y, S, 3);
  return tex(c);
}
