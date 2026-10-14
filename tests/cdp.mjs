// Minimal Chrome DevTools Protocol client for the browser tests (Node 22+, no dependencies).
// Start Chrome yourself with --remote-debugging-port=$CDP_PORT and serve dist/ on $GAME_URL.
import { writeFileSync } from 'node:fs';

export const CDP_PORT = process.env.CDP_PORT || '9222';
export const GAME_URL = process.env.GAME_URL || 'http://127.0.0.1:4173/';
export const SHOTS = process.env.SHOTS || '';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function open({ w = 1280, h = 800, mobile = false, scale = 1, url = GAME_URL, throttle = null, init = null } = {}) {
  const tab = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const waiting = new Map();
  const problems = [];
  const net = { bytes: 0, reqs: 0, list: [] };
  const listeners = [];
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d.result || d.error); waiting.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') problems.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).slice(0, 400));
    if (d.method === 'Runtime.consoleAPICalled' && (d.params.type === 'error' || d.params.type === 'warning')) problems.push(d.params.type + ' ' + d.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 300));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') problems.push('LOG ' + d.params.entry.text.slice(0, 300));
    if (d.method === 'Network.loadingFinished') { net.bytes += d.params.encodedDataLength; net.reqs++; }
    for (const f of listeners) f(d);
  });
  const send = (method, params = {}) => new Promise((r) => { waiting.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result?.value;
  };
  const shot = async (name) => {
    if (!SHOTS) return null;
    const s = await send('Page.captureScreenshot', { format: 'png' });
    const f = SHOTS + name + '.png';
    writeFileSync(f, Buffer.from(s.data, 'base64'));
    return f;
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
  if (throttle) await send('Network.emulateNetworkConditions', { offline: false, ...throttle });
  if (init) await send('Page.addScriptToEvaluateOnNewDocument', { source: init });
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: scale, mobile });
  if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const t0 = Date.now();
  if (url) await send('Page.navigate', { url });
  const close = async () => { try { ws.close(); } catch { /* */ } await fetch(`http://127.0.0.1:${CDP_PORT}/json/close/` + tab.id); };
  const ready = async (ms = 120000) => {
    const s = Date.now();
    while (Date.now() - s < ms) { if (await ev('!!(window.__run && __run.ready)').catch(() => false)) return true; await sleep(250); }
    return false;
  };
  return { send, ev, shot, problems, net, close, ready, t0, listeners };
}
