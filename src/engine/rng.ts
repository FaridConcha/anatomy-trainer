export type Rng = () => number;

export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pick<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

export function weightedSample<T>(items: T[], weight: (t: T) => number, n: number, rng: Rng): T[] {
  const pool = items.map((item) => ({ item, w: Math.max(0, weight(item)) })).filter((p) => p.w > 0);
  const out: T[] = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((s, p) => s + p.w, 0);
    let r = rng() * total;
    let k = 0;
    for (; k < pool.length - 1; k++) {
      r -= pool[k].w;
      if (r <= 0) break;
    }
    out.push(pool[k].item);
    pool.splice(k, 1);
  }
  return out;
}
