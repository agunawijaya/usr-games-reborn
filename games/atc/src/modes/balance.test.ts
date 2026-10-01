import { describe, expect, it } from 'vitest';
import { FIRST_LIGHT } from '../arenas/ours';
import { addDays, type DateKey } from '@usr-games/kit';
import { isFast } from '../arenas/library';
import { simulateShift } from '../engine/sim';
import { dailySky } from './daily';
import { SHIFTS, starCount } from './shifts';
import { simulateCampaignShift } from './sim-shift';

/** Whole shifts are flown here; a few take several seconds on a busy machine. */
const SLOW = 120_000;

/**
 * The balance targets of the campaign and the Daily Sky, measured with the house controller.
 * Full 200-seed numbers are in docs/NOTES.md (scripts/tune-shifts.ts); these tests replay a
 * smaller sample with a tolerance, so they stay quick.
 */

describe('the tutorial arena', () => {
  it(
    'is survived by the house controller on 200 of 200 seeds for 300 ticks',
    () => {
      const lost = Array.from({ length: 200 }, (_, i) =>
        simulateShift(FIRST_LIGHT, `tutorial:${i}`, 300),
      ).filter((r) => r.loss !== null);
      expect(lost).toEqual([]);
    },
    SLOW,
  );
});

describe('the campaign', () => {
  const SEEDS = 30;
  for (const shift of SHIFTS) {
    it(
      `shift ${shift.number}, ${shift.title}: one star on nearly every seed, three on a fair share`,
      () => {
        const runs = Array.from({ length: SEEDS }, (_, i) =>
          simulateCampaignShift(shift, `shift:${shift.id}:${i}`),
        );
        const one = runs.filter((r) => r.stars.target).length / SEEDS;
        const three = runs.filter((r) => starCount(r.stars) === 3).length / SEEDS;
        // Targets at 200 seeds: at least 90 % and 20–40 %; a 30-seed sample is allowed some spread.
        expect(one).toBeGreaterThanOrEqual(0.8);
        expect(three).toBeGreaterThanOrEqual(0.1);
        expect(three).toBeLessThanOrEqual(0.5);
      },
      SLOW,
    );
  }
});

describe('the Daily Sky', () => {
  it('never flies a fast arena on two days in a row', () => {
    let day: DateKey = '2026-09-01';
    let previousFast = false;
    for (let i = 0; i < 730; i++) {
      const fast = isFast(dailySky(day).arena);
      expect(fast && previousFast).toBe(false);
      previousFast = fast;
      day = addDays(day, 1);
    }
  });

  it('gives everyone the same sky on the same day', () => {
    expect(dailySky('2026-10-14')).toEqual(dailySky('2026-10-14'));
    expect(dailySky('2026-10-14').seed).not.toBe(dailySky('2026-10-15').seed);
  });
});
