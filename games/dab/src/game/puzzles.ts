import { type Board, boxCount, edgeCount, type Player } from '../engine/board';
import { PUZZLE_DATA } from './puzzle-data';

/**
 * Endgame puzzles: positions where the right move gives boxes away. Each was found by
 * `scripts/puzzles.ts` and checked by the exact solver: every best first move hands boxes over
 * (declining the last two of a chain, or opening a piece on purpose), and the best move that
 * gives nothing away (with nothing safe left: the one the original computer would choose) is
 * worth at least two boxes less. The player plays the position out
 * against Master and solves it by finishing with at least `target` of the boxes left.
 */

export type PuzzleKind = 'decline' | 'sacrifice' | 'choice';

export interface PuzzleSpec {
  readonly columns: number;
  readonly rows: number;
  /** The drawn lines, as hexadecimal digits (four edges each, lowest edge first). */
  readonly lines: string;
  /** Who took each box so far: `y` you, `r` your rival, `.` nobody yet. */
  readonly owners: string;
  /** How many of the boxes still open you need, playing your best. */
  readonly target: number;
  readonly kind: PuzzleKind;
}

export interface Puzzle extends PuzzleSpec {
  /** 1 to 40. */
  readonly number: number;
  /** Boxes not yet taken. */
  readonly open: number;
}

export const PUZZLES: readonly Puzzle[] = PUZZLE_DATA.map((spec, i) => ({
  ...spec,
  number: i + 1,
  open: [...spec.owners].filter((c) => c === '.').length,
}));

export function encodeLines(drawn: Uint8Array): string {
  let out = '';
  for (let start = 0; start < drawn.length; start += 4) {
    let digit = 0;
    for (let bit = 0; bit < 4 && start + bit < drawn.length; bit++)
      digit |= drawn[start + bit]! << bit;
    out += digit.toString(16);
  }
  return out;
}

export function encodeOwners(owner: Int8Array, you: Player): string {
  return [...owner].map((o) => (o === -1 ? '.' : o === you ? 'y' : 'r')).join('');
}

/** The puzzle's position, with you as player 0 and to move. */
export function puzzleBoard(spec: PuzzleSpec): Board {
  const shape = { columns: spec.columns, rows: spec.rows };
  const drawn = new Uint8Array(edgeCount(shape));
  for (let edge = 0; edge < drawn.length; edge++) {
    const digit = parseInt(spec.lines[edge >> 2] ?? '0', 16);
    drawn[edge] = (digit >> (edge & 3)) & 1;
  }
  const owner = new Int8Array(boxCount(shape)).fill(-1);
  const scores: [number, number] = [0, 0];
  [...spec.owners].forEach((c, box) => {
    if (c === '.') return;
    const player: Player = c === 'y' ? 0 : 1;
    owner[box] = player;
    scores[player]++;
  });
  return { ...shape, drawn, owner, scores, toMove: 0, history: [] };
}

export const PUZZLE_HINTS: Readonly<Record<PuzzleKind, string>> = {
  decline:
    'There are boxes to take. Taking all of them is not the best you can do: look at what you would have to open next.',
  sacrifice:
    'There is still a safe line or two. Drawing one is not the best you can do: give a little now, so your rival opens the big pieces later.',
  choice:
    'Every line you could draw gives something away. The smallest gift is not always the best one.',
};
