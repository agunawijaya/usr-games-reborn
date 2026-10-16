import { describe, expect, it } from 'vitest';
import { LOCKUP_INDEX, SPACE_COUNT } from '../boards/layout';
import { ECONOMY_PARAMS } from './economy';
import { apply, newGame } from './game';
import { landingOdds, type LockupStay } from './markov';
import { makeRules } from './rules';
import { seats } from './testing';
import type { Action, GameState } from './types';

/**
 * Plays the real engine for many turns with nobody buying anything and counts where tokens
 * land. The Markov model must agree with it: the brute-force check the prompt asks for.
 */
function bruteForce(stay: LockupStay, games: number, turnsPerGame: number) {
  const landed = new Array<number>(SPACE_COUNT).fill(0);
  let turns = 0;
  let jailed = 0;
  for (let game = 0; game < games; game++) {
    const state: GameState = newGame({
      board: 'harbour',
      seats: seats(2),
      seed: `markov-${stay}-${game}`,
      rules: { ...makeRules('standard', 'classic', undefined, 1e9), auctions: false },
      economy: { ...ECONOMY_PARAMS, startCoins: 1e12 },
    });
    while (turns < (game + 1) * turnsPerGame) {
      const seat = state.seats[state.current]!;
      let action: Action;
      if (state.phase.kind === 'turn' && seat.inLockup && stay === 'short') {
        action = seat.freeCards.length > 0 ? { type: 'useCard' } : { type: 'payFine' };
      } else if (state.phase.kind === 'buy') {
        action = { type: 'decline' };
      } else if (state.phase.kind === 'after') {
        action = state.phase.rollAgain ? { type: 'roll' } : { type: 'endTurn' };
      } else {
        action = { type: 'roll' };
      }
      for (const event of apply(state, action)) {
        if (event.type === 'moved' && event.steps !== 0) landed[event.to]! += 1;
        if (event.type === 'lockup') jailed += 1;
        if (event.type === 'turn') turns += 1;
      }
    }
  }
  return { perTurn: landed.map((n) => n / turns), lockupPerTurn: jailed / turns };
}

describe('landing odds', () => {
  it('lands on something at least once a turn, more with doubles', () => {
    const odds = landingOdds();
    const total = odds.perTurn.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(1);
    expect(odds.rollsPerTurn).toBeGreaterThan(1.1);
    expect(odds.rollsPerTurn).toBeLessThan(1.25);
  });

  it('makes the side after the lock-up hot and the first street after the start cold', () => {
    const { perTurn } = landingOdds('long');
    const streets = [
      1, 3, 6, 8, 9, 11, 13, 14, 16, 18, 19, 21, 23, 24, 26, 27, 29, 31, 32, 34, 37, 39,
    ];
    const mean = streets.reduce((sum, s) => sum + perTurn[s]!, 0) / streets.length;
    expect(perTurn[18]!).toBeGreaterThan(mean);
    expect(perTurn[1]!).toBeLessThan(mean);
  });

  for (const stay of ['short', 'long'] as const) {
    it(`agrees with the engine itself (${stay} stays in the lock-up)`, () => {
      const odds = landingOdds(stay);
      const brute = bruteForce(stay, 24, 4000);
      for (let space = 0; space < SPACE_COUNT; space++) {
        if (space === LOCKUP_INDEX) continue;
        expect(
          Math.abs(brute.perTurn[space]! - odds.perTurn[space]!),
          `space ${space}`,
        ).toBeLessThan(0.0035);
      }
      expect(Math.abs(brute.lockupPerTurn - odds.lockupPerTurn)).toBeLessThan(0.006);
    }, 60000);
  }
});
