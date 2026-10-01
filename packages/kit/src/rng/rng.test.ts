import { describe, expect, it } from 'vitest';
import { createRng, hashString, restoreRng } from './rng';

describe('createRng', () => {
  it('replays the same stream for the same seed', () => {
    const a = createRng('atc:2026-09-28');
    const b = createRng('atc:2026-09-28');
    const runA = Array.from({ length: 50 }, () => a.nextUint32());
    const runB = Array.from({ length: 50 }, () => b.nextUint32());
    expect(runA).toEqual(runB);
  });

  it('diverges immediately for neighbouring seeds', () => {
    expect(createRng('day-1').next()).not.toBe(createRng('day-2').next());
  });

  it('keeps floats in [0, 1) and spreads them evenly', () => {
    const rng = createRng(42);
    const buckets = new Array<number>(10).fill(0);
    for (let i = 0; i < 20_000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      buckets[Math.floor(value * 10)]! += 1;
    }
    for (const count of buckets) expect(count).toBeGreaterThan(1_800);
  });

  it('draws inclusive integers and rejects bad ranges', () => {
    const rng = createRng('dice');
    const seen = new Set<number>();
    for (let i = 0; i < 600; i++) seen.add(rng.int(1, 6));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(() => rng.int(3, 1)).toThrow(RangeError);
    expect(() => rng.int(0.5, 2)).toThrow(RangeError);
  });

  it('shuffles into a permutation without touching the input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = createRng('deck').shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...shuffled].sort((x, y) => x - y)).toEqual(input);
  });

  it('respects weights', () => {
    const rng = createRng('weights');
    let heavy = 0;
    for (let i = 0; i < 5_000; i++) {
      if (
        rng.weighted([
          { value: 'heavy', weight: 9 },
          { value: 'light', weight: 1 },
        ]) === 'heavy'
      ) {
        heavy++;
      }
    }
    expect(heavy / 5_000).toBeGreaterThan(0.86);
    expect(heavy / 5_000).toBeLessThan(0.94);
    expect(() => rng.weighted([{ value: 'x', weight: 0 }])).toThrow(RangeError);
  });

  it('refuses to pick from an empty list', () => {
    expect(() => createRng(1).pick([])).toThrow(RangeError);
  });
});

describe('split', () => {
  it('derives stable, labelled child streams without advancing the parent', () => {
    const parent = createRng('game');
    const before = parent.state();
    const ai = parent.split('ai').next();
    expect(parent.state()).toEqual(before);
    expect(createRng('game').split('ai').next()).toBe(ai);
    expect(parent.split('board').next()).not.toBe(ai);
  });
});

describe('state and restore', () => {
  it('resumes exactly where a saved stream stopped', () => {
    const rng = createRng('save-me');
    for (let i = 0; i < 17; i++) rng.next();
    const resumed = restoreRng(rng.state());
    expect(resumed.nextUint32()).toBe(rng.nextUint32());
    expect(JSON.parse(JSON.stringify(rng.state()))).toEqual(rng.state());
  });
});

describe('hashString', () => {
  it('is stable and unsigned', () => {
    expect(hashString('usr-games')).toBe(hashString('usr-games'));
    expect(hashString('a')).not.toBe(hashString('b'));
    expect(hashString('anything')).toBeGreaterThanOrEqual(0);
  });
});
