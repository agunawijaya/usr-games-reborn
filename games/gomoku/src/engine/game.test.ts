import { describe, expect, it } from 'vitest';
import { glibcRandom } from './campbell/glibc-random';
import { CampbellMind } from './campbell/mind';
import { indexOf, newGame, play, undo } from './game';
import { findThreats } from './threats';

/** Plays points given as [x, y] pairs, black first. */
function position(size: number, rules: 'freestyle' | 'exact', points: [number, number][]) {
  const game = newGame(size, rules);
  for (const [x, y] of points) play(game, indexOf(game, x, y));
  return game;
}

describe('the rules', () => {
  it('win with five in a row, black first', () => {
    const game = position(15, 'freestyle', [
      [3, 7],
      [3, 8],
      [4, 7],
      [4, 8],
      [5, 7],
      [5, 8],
      [6, 7],
      [6, 8],
    ]);
    expect(play(game, indexOf(game, 7, 7))).toBe('win');
    expect(game.winner).toBe('black');
    expect(game.winningLine).toHaveLength(5);
  });

  it('count six in a row as a win in freestyle, as the 1994 program did', () => {
    const game = position(15, 'freestyle', [
      [2, 7],
      [2, 9],
      [3, 7],
      [3, 9],
      [5, 7],
      [5, 9],
      [6, 7],
      [6, 9],
      [7, 7],
      [8, 9],
    ]);
    expect(play(game, indexOf(game, 4, 7))).toBe('win');
    expect(game.winningLine).toHaveLength(6);
  });

  it('count six in a row for nothing under Exactly five', () => {
    const game = position(15, 'exact', [
      [2, 7],
      [2, 9],
      [3, 7],
      [3, 9],
      [5, 7],
      [5, 9],
      [6, 7],
      [6, 9],
      [7, 7],
      [8, 9],
    ]);
    expect(play(game, indexOf(game, 4, 7))).toBe('ok');
    expect(game.winner).toBeNull();
  });

  it('refuse a taken point, and give a move back to its player', () => {
    const game = position(15, 'freestyle', [[7, 7]]);
    expect(play(game, indexOf(game, 7, 7))).toBe('illegal');
    expect(game.toMove).toBe('white');
    undo(game);
    expect(game.toMove).toBe('black');
    expect(game.board.every((s) => s === null)).toBe(true);
  });
});

describe('reading the board', () => {
  it('finds an open three, and a four with its point of five', () => {
    const game = position(15, 'freestyle', [
      [5, 5],
      [0, 0],
      [6, 5],
      [0, 2],
      [7, 5],
      [0, 4],
    ]);
    const three = findThreats(game).find((t) => t.stone === 'black');
    expect(three?.kind).toBe('three');
    play(game, indexOf(game, 8, 5));
    play(game, indexOf(game, 4, 5));
    const four = findThreats(game).find((t) => t.stone === 'black');
    expect(four).toMatchObject({ kind: 'four', spots: [indexOf(game, 9, 5)] });
  });

  it('does not call a three blocked at one end open', () => {
    const game = position(15, 'freestyle', [
      [5, 5],
      [4, 5],
      [6, 5],
      [0, 2],
      [7, 5],
      [0, 4],
    ]);
    expect(findThreats(game).filter((t) => t.stone === 'black' && t.kind === 'three')).toEqual([]);
  });
});

describe('the 1994 player in a Fivefold game', () => {
  it('opens in the centre, and blocks an open four it cannot beat', () => {
    const mind = new CampbellMind(15, glibcRandom(3));
    const game = newGame(15, 'freestyle');
    const first = mind.choose(true).point;
    expect(first).toBe(indexOf(game, 7, 7));
    // White (the player) builds three; the mind, black, must answer at an end of it.
    const moves: [number, number, boolean][] = [
      [7, 7, true],
      [3, 3, false],
      [11, 11, true],
      [4, 3, false],
      [11, 2, true],
      [5, 3, false],
    ];
    for (const [x, y, black] of moves) {
      play(game, indexOf(game, x, y));
      mind.played(indexOf(game, x, y), black);
    }
    const reply = mind.choose(true).point;
    expect([indexOf(game, 2, 3), indexOf(game, 6, 3)]).toContain(reply);
  });
});
