// Keyboard and swipe input. A swipe fires as soon as the finger has moved far enough (not on release),
// and the same touch can swipe again in another direction.
export type Action = 'left' | 'right' | 'up' | 'down' | 'pause' | 'confirm' | 'mute';

export function bindInput(target: HTMLElement, on: (a: Action) => void, canSwipe: () => boolean) {
  const keys: Record<string, Action> = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', Space: 'up', ArrowDown: 'down', KeyS: 'down',
    Escape: 'pause', KeyP: 'pause', Enter: 'confirm', KeyM: 'mute',
  };
  window.addEventListener('keydown', (e) => {
    const a = keys[e.code];
    if (!a) return;
    if ((e.target as HTMLElement)?.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter')) return;
    e.preventDefault();
    if (e.repeat && a !== 'left' && a !== 'right') return;
    on(a);
  });
  let id = -1, sx = 0, sy = 0, t0 = 0;
  const dist = () => Math.max(18, Math.min(window.innerWidth, window.innerHeight) * 0.045);
  target.addEventListener('pointerdown', (e) => {
    if (!canSwipe()) return;
    id = e.pointerId;
    sx = e.clientX;
    sy = e.clientY;
    t0 = performance.now();
    try { target.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });
  target.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    const D = dist();
    if (Math.abs(dx) < D && Math.abs(dy) < D) return;
    if (Math.abs(dx) > Math.abs(dy)) on(dx > 0 ? 'right' : 'left');
    else on(dy > 0 ? 'down' : 'up');
    // re-arm from here so one touch can make a second swipe
    sx = e.clientX;
    sy = e.clientY;
    t0 = performance.now();
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId === id) id = -1;
    void t0;
  };
  target.addEventListener('pointerup', end);
  target.addEventListener('pointercancel', end);
}
