/**
 * Five in a row, as Fivefold plays it: a square board of 15 or 19 lines, black first, a stone a
 * turn on any empty point. Freestyle rules win with five or more in a line, as the 1994 program
 * did; Exactly five wins only with five, so a line of six or more counts for nothing. A full board
 * with no five is a draw.
 *
 * Points are numbered row by row from the top left: `y * size + x`.
 */

export type Stone = 'black' | 'white';
export type Rules = 'freestyle' | 'exact';

export interface Point {
  x: number;
  y: number;
}

export interface GameState {
  readonly size: number;
  readonly rules: Rules;
  /** null for an empty point. */
  readonly board: (Stone | null)[];
  /** Points played, in order. */
  readonly moves: number[];
  toMove: Stone;
  winner: Stone | null;
  /** The five (or more, in freestyle) that won, in line order. */
  winningLine: number[] | null;
  draw: boolean;
}

/** The four directions a line can run: across, down, and the two diagonals. */
export const DIRECTIONS: readonly Point[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
];

export function other(stone: Stone): Stone {
  return stone === 'black' ? 'white' : 'black';
}

export function newGame(size: number, rules: Rules): GameState {
  return {
    size,
    rules,
    board: Array.from({ length: size * size }, () => null),
    moves: [],
    toMove: 'black',
    winner: null,
    winningLine: null,
    draw: false,
  };
}

export function pointOf(game: Pick<GameState, 'size'>, p: number): Point {
  return { x: p % game.size, y: Math.floor(p / game.size) };
}

export function indexOf(game: Pick<GameState, 'size'>, x: number, y: number): number {
  return y * game.size + x;
}

export function onBoard(game: Pick<GameState, 'size'>, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < game.size && y < game.size;
}

export function isOver(game: GameState): boolean {
  return game.winner !== null || game.draw;
}

/** The run of `stone` through point `p` in direction `d`, both ways, in line order. */
export function runThrough(game: GameState, p: number, d: Point, stone: Stone): number[] {
  const { x, y } = pointOf(game, p);
  const back: number[] = [];
  for (let k = 1; onBoard(game, x - d.x * k, y - d.y * k); k++) {
    const q = indexOf(game, x - d.x * k, y - d.y * k);
    if (game.board[q] !== stone) break;
    back.push(q);
  }
  const ahead: number[] = [];
  for (let k = 1; onBoard(game, x + d.x * k, y + d.y * k); k++) {
    const q = indexOf(game, x + d.x * k, y + d.y * k);
    if (game.board[q] !== stone) break;
    ahead.push(q);
  }
  return [...back.reverse(), p, ...ahead];
}

/** True when a run of this length wins under the rules. */
export function wins(rules: Rules, length: number): boolean {
  return rules === 'exact' ? length === 5 : length >= 5;
}

export type MoveResult = 'ok' | 'illegal' | 'win' | 'draw';

/** Plays `p` for the side to move. */
export function play(game: GameState, p: number): MoveResult {
  if (isOver(game) || p < 0 || p >= game.board.length || game.board[p] !== null) return 'illegal';
  const stone = game.toMove;
  game.board[p] = stone;
  game.moves.push(p);
  for (const d of DIRECTIONS) {
    const run = runThrough(game, p, d, stone);
    if (wins(game.rules, run.length)) {
      game.winner = stone;
      game.winningLine = run;
      return 'win';
    }
  }
  if (game.moves.length === game.board.length) {
    game.draw = true;
    return 'draw';
  }
  game.toMove = other(stone);
  return 'ok';
}

/** Takes the last move back (for the tutorial and replays). */
export function undo(game: GameState): number | null {
  const p = game.moves.pop();
  if (p === undefined) return null;
  // Whoever played it is to move again.
  game.toMove = game.board[p]!;
  game.board[p] = null;
  game.winner = null;
  game.winningLine = null;
  game.draw = false;
  return p;
}

export function cloneGame(game: GameState): GameState {
  return {
    ...game,
    board: [...game.board],
    moves: [...game.moves],
    winningLine: game.winningLine ? [...game.winningLine] : null,
  };
}

/** Would playing `p` for `stone` win at once? */
export function winsAt(game: GameState, p: number, stone: Stone): boolean {
  if (game.board[p] !== null) return false;
  game.board[p] = stone;
  const result = DIRECTIONS.some((d) => wins(game.rules, runThrough(game, p, d, stone).length));
  game.board[p] = null;
  return result;
}
