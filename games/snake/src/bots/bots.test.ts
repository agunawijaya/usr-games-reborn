import { describe, expect, it } from 'vitest';
import { RUN_LENGTH } from '../engine/chambers';
import { CAUTIOUS, GREEDY, playRun } from './bots';

/**
 * The balance targets from prompt 05, over the same 1000 seeds the report in NOTES.md uses
 * (`scripts/balance.ts`): the cautious bot banks in the first chamber at least 95 % of the time;
 * the greedy bot reaches the fifth chamber in 30–50 % of its runs.
 */
const SEEDS = Array.from({ length: 1000 }, (_, i) => `balance:${i}`);

describe('balance', () => {
  it('lets a cautious player bank the first chamber almost every time', () => {
    const outcomes = SEEDS.map((seed) => playRun(seed, CAUTIOUS, RUN_LENGTH));
    const banked = outcomes.filter((o) => o.banked !== null && o.deepest === 1).length;
    expect(banked / outcomes.length).toBeGreaterThanOrEqual(0.95);
  }, 120_000);

  it('takes a greedy player to the fifth chamber in 30 to 50 runs out of a hundred', () => {
    const outcomes = SEEDS.map((seed) => playRun(seed, GREEDY, RUN_LENGTH));
    const fifth = outcomes.filter((o) => o.deepest >= 5).length / outcomes.length;
    expect(fifth).toBeGreaterThanOrEqual(0.3);
    expect(fifth).toBeLessThanOrEqual(0.5);
  }, 120_000);
});
