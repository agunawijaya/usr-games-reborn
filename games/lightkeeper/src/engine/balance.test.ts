import { describe, expect, it } from 'vitest';
import { botOrder } from './bot';
import { applyOrder } from './orders';
import { earnsPromotion } from './score';
import { newWatch } from './setup';
import type { RankId, WatchState } from './types';

/**
 * The career's balance, locked with the steady captain on fixed seeds (see NOTES.md for the
 * full runs). The captain is no expert, so these are floors and ceilings for a fair curve, not
 * the numbers a good keeper reaches.
 */

function playOut(rank: RankId, seed: string): WatchState {
  let state = newWatch({ seed, rank, length: 1, ruleSet: 'commission' }).state;
  for (let orders = 0; orders < 400 && !state.outcome; orders++) {
    const result = applyOrder(state, botOrder(state));
    state = result.accepted ? result.state : applyOrder(state, { type: 'rest', days: 0.3 }).state;
  }
  return state;
}

function rates(rank: RankId, runs: number) {
  let wins = 0;
  let promotions = 0;
  let orders = 0;
  for (let i = 0; i < runs; i++) {
    const state = playOut(rank, `balance:${rank}:${i}`);
    if (state.outcome?.kind === 'won') wins++;
    if (earnsPromotion(state)) promotions++;
    orders += state.actions;
  }
  return { wins: wins / runs, promotions: promotions / runs, orders: orders / runs };
}

describe('the career curve', () => {
  it('lets a steady captain keep most Cadet watches, in a short session', () => {
    const cadet = rates(1, 20);
    expect(cadet.wins).toBeGreaterThanOrEqual(0.75);
    expect(cadet.promotions).toBeGreaterThan(0.1);
    expect(cadet.orders).toBeLessThan(60);
  });

  it('keeps Keeper winnable and High Warden a summit', () => {
    const keeper = rates(3, 16);
    const top = rates(6, 10);
    expect(keeper.wins).toBeGreaterThanOrEqual(0.65);
    expect(top.wins).toBeLessThanOrEqual(0.4);
  });
});
