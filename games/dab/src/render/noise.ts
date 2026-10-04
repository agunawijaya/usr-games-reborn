/**
 * Seeded variation for drawn things: the same line always has the same chalk grain, the same
 * box the same hatching. A small integer hash is plenty here.
 */
export function hash(a: number, b: number, seed = 0): number {
  let h =
    Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(seed | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** A tiny deterministic generator for painting many specks in a row. */
export function painter(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const channel = (shift: number) => Math.round(lerp((pa >> shift) & 255, (pb >> shift) & 255, t));
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, '0')}`;
}

export function rgba(hex: string, alpha: number): string {
  const p = parseInt(hex.slice(1), 16);
  return `rgba(${(p >> 16) & 255}, ${(p >> 8) & 255}, ${p & 255}, ${alpha})`;
}

export function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

export function easeOut(t: number): number {
  return 1 - Math.pow(1 - clamp01(t), 3);
}
