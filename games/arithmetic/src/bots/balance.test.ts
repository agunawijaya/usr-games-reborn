import { describe, expect, it } from 'vitest';
import { measureCampaign, measureDaily } from '../../scripts/balance';

/**
 * The campaign's balance, locked with tolerances (NOTES.md has the full table at 200 runs):
 * the ace three-stars everything, the steady player makes par about half the time, and the
 * novice nearly always earns at least one star without ever racing the clock.
 */
const RUNS = 60;

describe('campaign balance (Rush)', () => {
  const rows = measureCampaign(RUNS, 'rush');
  const bySkill = (skill: string) => rows.filter((row) => row.skill === skill);

  it('lets the ace earn three stars in every chapter', () => {
    for (const row of bySkill('ace')) expect(row.stars[3]).toBeGreaterThanOrEqual(0.93);
  });

  it('gives the steady player the speed star about half the time', () => {
    for (const row of bySkill('steady')) {
      expect(row.speedStar).toBeGreaterThanOrEqual(0.2);
      expect(row.speedStar).toBeLessThanOrEqual(0.7);
      expect(row.stars[0]).toBeLessThanOrEqual(0.05);
    }
  });

  it('nearly always gives the novice a star, never the speed star', () => {
    for (const row of bySkill('novice')) {
      expect(row.stars[0]).toBeLessThanOrEqual(0.2);
      expect(row.speedStar).toBeLessThanOrEqual(0.05);
    }
  });

  it('keeps chapters between one and ten minutes for steady and novice players', () => {
    for (const row of bySkill('steady')) {
      expect(row.medianMinutes).toBeGreaterThanOrEqual(0.7);
      expect(row.medianMinutes).toBeLessThanOrEqual(6);
    }
    for (const row of bySkill('novice')) expect(row.medianMinutes).toBeLessThanOrEqual(11);
  });
});

describe('Daily balance', () => {
  it('takes a steady player two to five minutes', () => {
    const steady = measureDaily(RUNS).find((row) => row.skill === 'steady')!;
    expect(steady.medianMinutes).toBeGreaterThanOrEqual(2);
    expect(steady.medianMinutes).toBeLessThanOrEqual(5);
  });
});
