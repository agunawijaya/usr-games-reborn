import { createRng } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import { choosePlacement, playSteps } from '../engine/bot';
import { cellAt, CORAL, countKind } from '../engine/game';
import { diveGame, DIVES, diveStars, diveState, TANK_HEIGHT, TANK_WIDTH } from './dives';

/**
 * The twelve dives: tanks that can always be cleared, and stars set so the house diver earns one
 * on nearly every try and three on a good one (the prompt asks: at least 90 % and 15–35 %).
 */

describe('the dives', () => {
  it('are twelve, numbered in order, each with its own id', () => {
    expect(DIVES.map((d) => d.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(new Set(DIVES.map((d) => d.id)).size).toBe(12);
  });

  it('start with floors that can be cleared: nothing hanging over water, no row already full', () => {
    for (const dive of DIVES) {
      const game = diveGame(dive, createRng('floor'));
      for (let x = 0; x < TANK_WIDTH; x++) {
        let reached = false;
        for (let y = 0; y < TANK_HEIGHT; y++) {
          const filled = cellAt(game, x, y) !== null;
          if (filled) reached = true;
          else expect(reached, `${dive.id}: a gap under the floor in column ${x}`).toBe(false);
        }
      }
      for (let y = 0; y < TANK_HEIGHT; y++) {
        const row = Array.from({ length: TANK_WIDTH }, (_, x) => cellAt(game, x, y));
        expect(row.every(Boolean), `${dive.id}: row ${y} starts full`).toBe(false);
      }
      if (dive.goal.kind === 'coral') expect(countKind(game, CORAL)).toBeGreaterThan(0);
    }
  });

  for (const dive of DIVES) {
    it(`${dive.number}. ${dive.title}: one star nearly always, three on a good dive`, () => {
      const runs = 40;
      let one = 0;
      let three = 0;
      for (let s = 0; s < runs; s++) {
        const game = diveGame(dive, createRng(`balance:${dive.id}:${s}`));
        for (let i = 0; i < 500 && diveState(dive, game) === 'playing'; i++)
          playSteps(game, choosePlacement(game)!.steps);
        const stars = diveStars(dive, game);
        if (stars >= 1) one++;
        if (stars === 3) three++;
      }
      expect(one / runs).toBeGreaterThanOrEqual(0.9);
      expect(three / runs).toBeGreaterThanOrEqual(0.12);
      expect(three / runs).toBeLessThanOrEqual(0.38);
    }, 30_000);
  }
});
