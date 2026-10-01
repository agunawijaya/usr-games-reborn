import { describe, expect, it } from 'vitest';
import { arenaProblems } from '../engine/arena';
import { CLASSIC_ARENAS } from './classic';
import { ENDLESS_ARENAS } from './library';

describe('the arena library', () => {
  it('offers at least twenty arenas, all fifteen classics among them', () => {
    expect(ENDLESS_ARENAS.length).toBeGreaterThanOrEqual(20);
    expect(CLASSIC_ARENAS.map((a) => a.classic)).toEqual([...Array(15).keys()].map((i) => i + 1));
  });

  it('gives every arena a unique id', () => {
    expect(new Set(ENDLESS_ARENAS.map((a) => a.id)).size).toBe(ENDLESS_ARENAS.length);
  });

  for (const arena of ENDLESS_ARENAS) {
    it(`${arena.name} is a well-formed sky`, () => {
      expect(arenaProblems(arena)).toEqual([]);
    });
  }

  it('keeps the classic speeds: from seven seconds a tick down to one', () => {
    const speeds = CLASSIC_ARENAS.map((a) => a.tickSeconds);
    expect(Math.max(...speeds)).toBe(7);
    expect(Math.min(...speeds)).toBe(1);
  });
});
