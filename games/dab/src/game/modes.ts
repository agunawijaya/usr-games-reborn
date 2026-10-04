import { createRng } from '@usr-games/kit';
import type { OpponentId } from '../ai/opponents';
import { type Board, newBoard, type Player, play } from '../engine/board';
import { safeEdges } from '../engine/chains';

export type Mode = 'ladder' | 'daily' | 'puzzle' | 'tutorial' | 'local' | 'custom';

export interface LadderMatch {
  /** 1 to 10. */
  readonly number: number;
  readonly columns: number;
  readonly rows: number;
  readonly opponent: OpponentId;
  /** Who draws the first line. */
  readonly first: Player;
}

/**
 * Ten matches up the ladder: the boards grow from 3 × 3 to 7 × 7 while the opponents climb from
 * the random scribbler to the solver. The first move alternates, starting with yours; Gus's
 * first match lets him move first, as the original's computer always did.
 */
export const LADDER: readonly LadderMatch[] = [
  { number: 1, columns: 3, rows: 3, opponent: 'scribbler', first: 0 },
  { number: 2, columns: 3, rows: 3, opponent: 'greedy-gus', first: 1 },
  { number: 3, columns: 4, rows: 4, opponent: 'greedy-gus', first: 0 },
  { number: 4, columns: 4, rows: 4, opponent: 'chain-counter', first: 1 },
  { number: 5, columns: 5, rows: 5, opponent: 'chain-counter', first: 0 },
  { number: 6, columns: 5, rows: 5, opponent: 'pupil', first: 1 },
  { number: 7, columns: 5, rows: 5, opponent: 'pupil', first: 0 },
  { number: 8, columns: 6, rows: 6, opponent: 'pupil', first: 1 },
  { number: 9, columns: 6, rows: 6, opponent: 'master', first: 0 },
  { number: 10, columns: 7, rows: 7, opponent: 'master', first: 1 },
];

/** The Daily Board: a 5 × 5 board against Berlekamp's Pupil, opened the same way for everyone. */
export const DAILY = { columns: 5, rows: 5, opponent: 'pupil' as OpponentId, openingLines: 12 };

/**
 * Today's opening: a dozen safe lines drawn from the day's seed, so the board starts already
 * taking shape. Nobody owns those lines; you move next.
 */
export function dailyOpening(seed: string): Board {
  const rng = createRng(`${seed}:opening`);
  let board = newBoard({ columns: DAILY.columns, rows: DAILY.rows });
  for (let i = 0; i < DAILY.openingLines; i++) {
    board = play(board, rng.pick(safeEdges(board))).board;
  }
  return { ...board, toMove: 0, history: [] };
}

/** The sizes the Custom board allows, as the original allowed any size the screen could show. */
export const CUSTOM_LIMITS = { smallest: 2, largest: 10 };
