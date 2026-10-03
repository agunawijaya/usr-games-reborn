import { describe, expect, it } from 'vitest';
import { type GameState, indexOf, newGame, type Rules, type Stone } from './game';
import {
  canForceWin,
  fivePoints,
  fourMoves,
  quickestWin,
  threeMoves,
  winningFirstMoves,
} from './solver';

/** A position from stones given as [x, y] lists, with `toMove` to play. */
function position(
  black: [number, number][],
  white: [number, number][],
  toMove: Stone,
  rules: Rules = 'freestyle',
): GameState {
  const game = newGame(15, rules);
  for (const [x, y] of black) game.board[indexOf(game, x, y)] = 'black';
  for (const [x, y] of white) game.board[indexOf(game, x, y)] = 'white';
  game.toMove = toMove;
  return game;
}

const at = (x: number, y: number) => y * 15 + x;

describe('the threat-space solver', () => {
  it('sees five, fours and open threes', () => {
    const game = position(
      [
        [5, 5],
        [6, 5],
        [7, 5],
        [8, 5],
      ],
      [[4, 5]],
      'black',
    );
    expect(fivePoints(game, 'black')).toEqual([at(9, 5)]);
    const three = position(
      [
        [5, 5],
        [6, 5],
      ],
      [],
      'black',
    );
    expect(threeMoves(three, 'black')).toContain(at(7, 5));
    expect(fourMoves(three, 'black')).toEqual([]);
  });

  it('wins in two from an open three, by either end only', () => {
    const game = position(
      [
        [5, 5],
        [6, 5],
        [7, 5],
      ],
      [
        [0, 0],
        [14, 14],
        [0, 14],
      ],
      'black',
    );
    expect(winningFirstMoves(game, { moves: 2, threes: false }).moves).toEqual([
      at(4, 5),
      at(8, 5),
    ]);
    expect(quickestWin(game, { moves: 5, threes: false })).toBe(2);
  });

  it('must answer the other side’s four before anything else', () => {
    const game = position(
      [
        [5, 5],
        [6, 5],
        [7, 5],
        [4, 9],
      ],
      [
        [5, 9],
        [6, 9],
        [7, 9],
        [8, 9],
        [0, 0],
      ],
      'black',
    );
    // White waits on one point of five; blocking it threatens nothing, so black has no forced win.
    expect(fivePoints(game, 'white')).toEqual([at(9, 9)]);
    expect(winningFirstMoves(game, { moves: 4, threes: true }).moves).toEqual([]);
  });

  it('wins with a double three, which needs threes', () => {
    // At (7, 5) black makes two open threes at once; white can stop only one.
    const game = position(
      [
        [5, 5],
        [6, 5],
        [7, 7],
        [7, 8],
      ],
      [
        [0, 0],
        [14, 0],
        [0, 14],
        [14, 14],
      ],
      'black',
    );
    expect(canForceWin(game, { moves: 3, threes: false })).toBe(false);
    expect(winningFirstMoves(game, { moves: 3, threes: true }).moves).toContain(at(7, 5));
  });

  it('follows a chain of fours', () => {
    // A four along row 5, then the forced block, then an open four down column 9.
    const game = position(
      [
        [6, 5],
        [7, 5],
        [8, 5],
        [9, 7],
        [9, 8],
      ],
      [
        [5, 5],
        [0, 0],
        [14, 0],
        [0, 14],
        [14, 14],
      ],
      'black',
    );
    expect(winningFirstMoves(game, { moves: 3, threes: false }).moves).toContain(at(9, 5));
    expect(quickestWin(game, { moves: 5, threes: false })).toBe(3);
  });

  it('counts six in a row for nothing under Exactly five', () => {
    const game = position(
      [
        [4, 5],
        [5, 5],
        [6, 5],
        [7, 5],
        [9, 5],
      ],
      [
        [0, 0],
        [14, 14],
        [0, 14],
        [14, 0],
        [3, 5],
      ],
      'black',
      'exact',
    );
    expect(fivePoints(game, 'black')).toEqual([]);
  });
});
