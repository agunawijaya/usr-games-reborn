/** Small seeded randomness for the scenery, so a garden or a lake is the same every time it is drawn. */

export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number in [0, 1) fixed for `n`: a piece's own tilt, phase or pattern. */
export function hash01(n: number): number {
  return seeded(n * 2654435761)();
}
