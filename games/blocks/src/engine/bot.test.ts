import { createRng } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import { choosePlacement, type Step } from './bot';
import { createGame, fall, type Game, plunge, shift, turn } from './game';

function play(game: Game, steps: readonly Step[]): void {
  for (const step of steps) {
    if (step === 'left') shift(game, -1);
    else if (step === 'right') shift(game, 1);
    else if (step === 'turnLeft') turn(game, 'left');
    else if (step === 'turnRight') turn(game, 'right');
    else plunge(game);
  }
}

describe('the house diver', () => {
  it('keeps a Standard tank going for 300 sinkers, clearing rows as it goes', () => {
    const game = createGame({
      rules: 'standard',
      width: 11,
      height: 18,
      level: 1,
      random: createRng('diver'),
    });
    for (let i = 0; i < 300 && !game.over; i++) {
      const placement = choosePlacement(game)!;
      play(game, placement.steps);
    }
    expect(game.over).toBe(false);
    expect(game.rowsCleared).toBeGreaterThan(100);
  });

  it('copes with Classic turns, counter-clockwise only', () => {
    const game = createGame({
      rules: 'classic',
      width: 10,
      height: 20,
      level: 1,
      random: createRng('classic diver'),
    });
    for (let i = 0; i < 200 && !game.over; i++) {
      const placement = choosePlacement(game)!;
      expect(placement.steps).not.toContain('turnRight');
      play(game, placement.steps);
      // Classic lands a dropped shape at the next tick.
      fall(game);
    }
    expect(game.over).toBe(false);
    expect(game.rowsCleared).toBeGreaterThan(60);
  });
});
