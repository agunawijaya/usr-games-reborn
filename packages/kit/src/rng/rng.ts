/**
 * Seeded random numbers for everything that must replay identically: daily puzzles, AI
 * choices, attract-mode demos and the weekly cron jobs.
 *
 * The generator is sfc32 (small fast counter): 128 bits of state, excellent statistical
 * quality for games, and trivially serialisable so a save can resume the exact stream.
 */

export type RngState = readonly [number, number, number, number];

export interface Rng {
  /** A float in [0, 1). */
  next(): number;
  /** An unsigned 32-bit integer. */
  nextUint32(): number;
  /** An integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** A float in [min, max). */
  float(min: number, max: number): number;
  /** True with probability `p`. */
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** A shuffled copy; the input is never mutated. */
  shuffle<T>(items: readonly T[]): T[];
  weighted<T>(entries: readonly { value: T; weight: number }[]): T;
  /**
   * A child stream derived from this stream's current state and a label. Splitting does not
   * advance the parent, so `split('ai')` and `split('board')` stay independent even when one
   * of them is consumed more than the other.
   */
  split(label: string): Rng;
  state(): RngState;
}

/** A 32-bit FNV-1a hash; stable across platforms and good enough to spread seed strings. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Expands a seed string into four well-mixed words (cyrb128), so similar seeds diverge fast. */
function seedWords(seed: string): RngState {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const code = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ code, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ code, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ code, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ code, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

export function createRng(seed: string | number): Rng {
  const rng = restoreRng(seedWords(String(seed)));
  // sfc32 needs a few rounds before weakly mixed seeds stop showing through.
  for (let i = 0; i < 12; i++) rng.nextUint32();
  return rng;
}

export function restoreRng(saved: RngState): Rng {
  let [a, b, c, d] = saved;

  function nextUint32(): number {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  }

  function next(): number {
    return nextUint32() / 4294967296;
  }

  function int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`int(${min}, ${max}) needs integers with min <= max`);
    }
    return min + Math.floor(next() * (max - min + 1));
  }

  function pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('pick() from an empty list');
    return items[Math.floor(next() * items.length)] as T;
  }

  function shuffle<T>(items: readonly T[]): T[] {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
    }
    return copy;
  }

  function weighted<T>(entries: readonly { value: T; weight: number }[]): T {
    const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
    if (total <= 0) throw new RangeError('weighted() needs at least one positive weight');
    let roll = next() * total;
    for (const entry of entries) {
      roll -= Math.max(0, entry.weight);
      if (roll < 0) return entry.value;
    }
    return (entries[entries.length - 1] as { value: T }).value;
  }

  const rng: Rng = {
    next,
    nextUint32,
    int,
    float: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
    pick,
    shuffle,
    weighted,
    split: (label) => createRng(`${a}:${b}:${c}:${d}/${label}`),
    state: () => [a >>> 0, b >>> 0, c >>> 0, d >>> 0],
  };
  return rng;
}
