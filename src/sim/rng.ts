// Small seeded random generator (mulberry32), so a map can be replayed in tests.
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number) {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number) {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p: number) {
    return this.next() < p;
  }
  weighted<T extends string>(w: Record<T, number>): T {
    let total = 0;
    for (const k in w) total += Math.max(0, w[k]);
    let r = this.next() * total;
    for (const k in w) {
      r -= Math.max(0, w[k]);
      if (r <= 0) return k;
    }
    return Object.keys(w)[0] as T;
  }
}
