// Deterministic PRNG (mulberry32) so game boards are reproducible in tests.
export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng: Rng, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive);
}

export function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pick<T>(rng: Rng, arr: T[]): T {
  return arr[randInt(rng, arr.length)];
}

/** k random items via the seeded Fisher-Yates shuffle (uniform, testable). */
export function sample<T>(rng: Rng, arr: T[], k: number): T[] {
  return shuffle(rng, arr).slice(0, Math.min(k, arr.length));
}
