import { createRng } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import { OpponentMind } from './ai';
import { indexOf, newGame, play } from './game';
import { match } from './match';
import { OPPONENTS, opponentById, type OpponentId } from './opponents';

/** A game from [x, y] moves, black first, with a mind for `id` told every move. */
function setUp(id: OpponentId, moves: [number, number][], seed = 'test') {
  const game = newGame(15, 'freestyle');
  const mind = new OpponentMind(opponentById(id), 15, createRng(seed));
  for (const [x, y] of moves) {
    const p = indexOf(game, x, y);
    mind.played(p, game.toMove);
    play(game, p);
  }
  return { game, mind };
}

describe('the opponents', () => {
  it('all take a five when they have one', () => {
    for (const o of OPPONENTS) {
      // White (the opponent, to move) has four in a row on row 3.
      const { game, mind } = setUp(o.id, [
        [7, 7],
        [3, 3],
        [8, 8],
        [4, 3],
        [9, 6],
        [5, 3],
        [0, 14],
        [6, 3],
        [14, 14],
      ]);
      expect([indexOf(game, 2, 3), indexOf(game, 7, 3)]).toContain(mind.choose(game).point);
    }
  });

  it('block a four (Pebble almost always)', () => {
    let blocked = 0;
    for (let i = 0; i < 20; i++) {
      const { game, mind } = setUp(
        'pebble',
        [
          [3, 3],
          [7, 7],
          [4, 3],
          [8, 8],
          [5, 3],
          [0, 14],
          [6, 3],
        ],
        `four:${i}`,
      );
      if ([indexOf(game, 2, 3), indexOf(game, 7, 3)].includes(mind.choose(game).point)) blocked++;
    }
    expect(blocked).toBeGreaterThanOrEqual(12);
    expect(blocked).toBeLessThan(20);
    for (const o of OPPONENTS.filter((o) => o.id !== 'pebble')) {
      const { game, mind } = setUp(o.id, [
        [3, 3],
        [7, 7],
        [4, 3],
        [8, 8],
        [5, 3],
        [0, 14],
        [6, 3],
      ]);
      expect([indexOf(game, 2, 3), indexOf(game, 7, 3)]).toContain(mind.choose(game).point);
    }
  });

  it('play whole games to the end without an illegal move', () => {
    for (const [a, b] of [
      ['pebble', 'reed'],
      ['heron', 'koi'],
    ] as const) {
      const game = match(a, b, `${a}-${b}`);
      expect(game.winner !== null || game.draw).toBe(true);
    }
  }, 120_000);
});
