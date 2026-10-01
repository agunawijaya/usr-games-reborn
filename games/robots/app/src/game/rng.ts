// Mulberry32 — small deterministic seedable PRNG. Sufficient for
// game-side randomness (robot placement, teleport target). Not for
// cryptographic use.
export class RNG {
  private state: number;

  constructor(seed: number = Date.now()) {
    this.state = seed >>> 0;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) {
      throw new RangeError('Cannot pick from empty array');
    }
    return arr[this.int(0, arr.length - 1)];
  }
}
