import { createRng } from '@usr-games/kit';
import { type GameState, newGame, play, type Stone } from '../engine/game';
import type { SolveOptions } from '../engine/solver';
import PUZZLE_DATA from './puzzles.json' with { type: 'json' };

/**
 * Puzzles: positions from games the 1994 player played against itself, where the side to move can
 * force five in a few moves — and in only one way. The moment came from the combination search
 * (a spot it rated one move from unstoppable); the solver proved the win and that no other first
 * move wins as fast (`scripts/make-puzzles.ts`, checked again by `puzzles.test.ts`).
 *
 * Three bands by length: Gentle (win in 2 or 3), Keen (4 or 5), Deep (6 or 7). Sixty numbered
 * puzzles, and a separate pool for the Daily Puzzle.
 */

export type Band = 'gentle' | 'keen' | 'deep';

export interface Puzzle {
  id: string;
  /** 1 to 60 for the numbered puzzles; 0 in the daily pool. */
  number: number;
  band: Band;
  /** Your moves to five, the winning one included. */
  moves: number;
  /** Whether open threes are part of the answer (else it is all fours). */
  threes: boolean;
  /** The moves that led here, first player first. */
  position: number[];
  /** The one first move that wins. */
  answer: number;
}

interface PuzzleFile {
  size: number;
  numbered: Omit<Puzzle, 'id' | 'number'>[];
  daily: Omit<Puzzle, 'id' | 'number'>[];
}

const DATA = PUZZLE_DATA as PuzzleFile;

export const PUZZLE_SIZE = DATA.size;

export const PUZZLES: readonly Puzzle[] = DATA.numbered.map((p, i) => ({
  ...p,
  id: `p${String(i + 1).padStart(2, '0')}`,
  number: i + 1,
}));

export const DAILY_POOL: readonly Puzzle[] = DATA.daily.map((p, i) => ({
  ...p,
  id: `d${String(i + 1).padStart(3, '0')}`,
  number: 0,
}));

export const BANDS: readonly { id: Band; name: string; lede: string }[] = [
  { id: 'gentle', name: 'Gentle', lede: 'Win in two or three.' },
  { id: 'keen', name: 'Keen', lede: 'Win in four or five.' },
  { id: 'deep', name: 'Deep', lede: 'Win in six or seven.' },
];

export function bandOf(moves: number): Band {
  return moves <= 3 ? 'gentle' : moves <= 5 ? 'keen' : 'deep';
}

/** The puzzle's position as a game, the attacker to move. */
export function puzzleGame(puzzle: Puzzle): GameState {
  const game = newGame(PUZZLE_SIZE, 'freestyle');
  for (const p of puzzle.position) play(game, p);
  return game;
}

export function attackerOf(puzzle: Puzzle): Stone {
  return puzzle.position.length % 2 === 0 ? 'black' : 'white';
}

export function solveOptions(puzzle: Puzzle, moves = puzzle.moves): SolveOptions {
  return { moves, threes: puzzle.threes, nodes: 400_000 };
}

/** The Daily Puzzle for a day: the pool in an order of its own, one a day. */
export function dailyPuzzle(dayNumber: number): Puzzle {
  const order = createRng('fivefold-daily').shuffle(DAILY_POOL.map((_, i) => i));
  return DAILY_POOL[order[(((dayNumber - 1) % order.length) + order.length) % order.length]!]!;
}
