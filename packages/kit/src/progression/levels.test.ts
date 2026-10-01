import { describe, expect, it } from 'vitest';
import { levelForXp, MAX_LEVEL } from './levels';
import { RANKS } from './ranks';

describe('levelForXp', () => {
  it('starts every rank on its own first level', () => {
    expect(levelForXp(0)).toMatchObject({ level: 1, rank: 'guest' });
    const firsts = RANKS.map((rank) => levelForXp(rank.threshold));
    expect(firsts.map((l) => `${l.level}:${l.rank}`)).toEqual([
      '1:guest',
      '2:user',
      '10:staff',
      '25:wheel',
      '40:root',
    ]);
  });

  it('never lets level and rank disagree just below a threshold', () => {
    for (let i = 1; i < RANKS.length; i++) {
      const below = levelForXp(RANKS[i]!.threshold - 1);
      expect(below.rank).toBe(RANKS[i - 1]!.id);
      expect(below.level).toBeLessThan(levelForXp(RANKS[i]!.threshold).level);
    }
  });

  it('climbs monotonically and reports progress inside the level', () => {
    let previous = 0;
    for (let xp = 0; xp < 120_000; xp += 97) {
      const { level, fraction, levelStart, nextLevelAt } = levelForXp(xp);
      expect(level).toBeGreaterThanOrEqual(previous);
      expect(fraction).toBeGreaterThanOrEqual(0);
      expect(fraction).toBeLessThanOrEqual(1);
      expect(xp).toBeGreaterThanOrEqual(levelStart);
      if (nextLevelAt !== null) expect(xp).toBeLessThan(nextLevelAt);
      previous = level;
    }
  });

  it('puts the hero-scene player at a mid-staff level and caps at the maximum', () => {
    expect(levelForXp(8_805)).toMatchObject({ level: 17, rank: 'staff' });
    expect(levelForXp(10_000_000)).toMatchObject({
      level: MAX_LEVEL,
      nextLevelAt: null,
      fraction: 1,
    });
  });
});
