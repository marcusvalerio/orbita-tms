// PRNG determinístico (mulberry32). Mesma seed = mesmos dados sempre.
// Isso garante que a simulação da Atlas Distribuição não mude a cada render.

export function createRng(seed: number) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function pickMany<T>(rng: () => number, arr: readonly T[], count: number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

export function intBetween(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function floatBetween(rng: () => number, min: number, max: number, decimals = 1): number {
  const v = rng() * (max - min) + min;
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

export function chance(rng: () => number, probability: number): boolean {
  return rng() < probability;
}
