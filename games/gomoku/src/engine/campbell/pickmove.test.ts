import { describe, expect, it } from 'vitest';
import { BLACK, CampbellBoard, type Colour, MOVE_OK, TIE, WHITE, WIN } from './board';
import { glibcRandom } from './glibc-random';
import { spotName, spotOf } from './notation';
import { CampbellPlayer } from './pickmove';
import games from './reference-games.json';

/**
 * The port against the original. The 1994 program was built from its own sources (outside the
 * repo, on Linux, with its curses display left out) and set to play itself from a range of
 * openings, `srandom(seed)` first so its coin tosses are known; every game it played is in
 * `reference-games.json`. Here the port plays the same openings with the same seeds and must
 * choose every move the original chose, and end the same way.
 *
 * All 30 games take about twenty minutes (the 1994 search is slow in crowded positions; the C
 * program itself needs over two minutes for seed 9), so the everyday run plays four of them: the
 * 360-move tie and three quick wins. `GOMOKU_REFERENCE=all` plays every one.
 */

const EVERYDAY = new Set([1, 2, 12, 14]);
const everything = process.env.GOMOKU_REFERENCE === 'all';

interface ReferenceGame {
  seed: number;
  opening: string[];
  moves: string[];
  result: number;
}

describe('the C library random()', () => {
  it('gives the numbers glibc gives after srandom(1)', () => {
    const random = glibcRandom(1);
    expect([random.next(), random.next(), random.next()]).toEqual([
      1804289383, 846930886, 1681692777,
    ]);
  });
});

describe('the 1994 player, against the original program', () => {
  for (const game of games as ReferenceGame[]) {
    const name = `seed ${game.seed}, opening ${game.opening.join(' ') || '(none)'}`;
    const run = everything || EVERYDAY.has(game.seed) ? it : it.skip;
    run(
      `plays every move the original played: ${name}`,
      () => {
        const bd = new CampbellBoard(19);
        const player = new CampbellPlayer(bd, glibcRandom(game.seed));
        let colour: Colour = BLACK;
        let result = MOVE_OK;
        const played: string[] = [];
        for (const move of game.opening) {
          played.push(move);
          result = bd.makeMove(colour, spotOf(bd, move));
          colour = colour === BLACK ? WHITE : BLACK;
        }
        while (result === MOVE_OK && played.length < game.moves.length) {
          const move = spotName(bd, player.pick(colour));
          played.push(move);
          if (move !== game.moves[played.length - 1]) break;
          result = bd.makeMove(colour, spotOf(bd, move));
          colour = colour === BLACK ? WHITE : BLACK;
        }
        expect(played).toEqual(game.moves);
        expect(result).toBe(game.result);
      },
      600_000,
    );
  }

  it('ends the reference games in wins, and one in the 1994 tie', () => {
    const results = (games as ReferenceGame[]).map((g) => g.result);
    expect(results).toContain(WIN);
    expect(results).toContain(TIE);
  });
});
