import { createRng } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import { isFull, newBoard, type Player, play } from '../engine/board';
import { chooseMove, OPPONENT_IDS, type OpponentId } from './opponents';

/**
 * The ladder's order, locked. The full table (1 000 games a pair on 5 × 5, in NOTES.md) comes
 * from `scripts/balance.ts`; this replays the first forty of the same seeded games, so it runs in
 * seconds, and asks the same of every rung: beat the one below at least 70 % of the time.
 */
function winRate(stronger: OpponentId, weaker: OpponentId, games: number): number {
  let points = 0;
  for (let index = 0; index < games; index++) {
    const strongSide = (index % 2) as Player;
    const rng = createRng(`balance:${stronger}:${weaker}:${index}`);
    let board = newBoard({ columns: 5, rows: 5 });
    let clock = 1_072_483_200 + index * 7919;
    while (!isFull(board)) {
      const id = board.toMove === strongSide ? stronger : weaker;
      board = play(board, chooseMove(id, board, { rng, clock: clock++ })).board;
    }
    const mine = board.scores[strongSide];
    const theirs = board.scores[strongSide === 0 ? 1 : 0];
    points += mine > theirs ? 1 : mine === theirs ? 0.5 : 0;
  }
  return points / games;
}

describe('the ladder', () => {
  for (let i = 1; i < OPPONENT_IDS.length; i++) {
    const stronger = OPPONENT_IDS[i]!;
    const weaker = OPPONENT_IDS[i - 1]!;
    it(`${stronger} beats ${weaker} at least 70 % of the time`, () => {
      expect(winRate(stronger, weaker, 40)).toBeGreaterThanOrEqual(0.7);
    });
  }
});
