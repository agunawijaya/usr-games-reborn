import { describe, expect, it } from 'vitest';
import { fivePoints, winningFirstMoves } from '../engine/solver';
import { dailyShareText } from './daily';
import { packagesForGame, packagesForPuzzles } from './packages';
import {
  attackerOf,
  bandOf,
  DAILY_POOL,
  dailyPuzzle,
  type Puzzle,
  PUZZLES,
  puzzleGame,
} from './puzzles';

/**
 * The puzzles are what the generator promised: the side to move forces five in the stated number
 * of moves, in exactly one way, and no faster; all fours when marked so. The everyday run checks
 * the sixty numbered puzzles and a sample of the daily pool; GOMOKU_PUZZLES=all checks every one.
 */

function check(puzzle: Puzzle): void {
  const game = puzzleGame(puzzle);
  expect(game.winner).toBeNull();
  expect(game.toMove).toBe(attackerOf(puzzle));
  expect(fivePoints(game, game.toMove)).toEqual([]);
  expect(fivePoints(game, game.toMove === 'black' ? 'white' : 'black')).toEqual([]);
  const options = { threes: true, nodes: 60_000 };
  const now = winningFirstMoves(game, { ...options, moves: puzzle.moves });
  expect(now.complete).toBe(true);
  expect(now.moves).toEqual([puzzle.answer]);
  if (puzzle.moves > 2)
    expect(winningFirstMoves(game, { ...options, moves: puzzle.moves - 1 }).moves).toEqual([]);
  const byFours = winningFirstMoves(game, { moves: puzzle.moves, threes: false, nodes: 60_000 });
  expect(byFours.moves.length > 0).toBe(!puzzle.threes);
  expect(puzzle.band).toBe(bandOf(puzzle.moves));
}

describe('the puzzles', () => {
  it('are sixty, twenty in each band', () => {
    expect(PUZZLES).toHaveLength(60);
    for (const band of ['gentle', 'keen', 'deep'] as const)
      expect(PUZZLES.filter((p) => p.band === band)).toHaveLength(20);
    expect(DAILY_POOL.length).toBeGreaterThanOrEqual(200);
  });

  it('each have one answer, the quickest, as marked', () => {
    for (const puzzle of PUZZLES) check(puzzle);
  }, 600_000);

  it('in the daily pool too', () => {
    const all = process.env.GOMOKU_PUZZLES === 'all';
    for (const puzzle of all ? DAILY_POOL : DAILY_POOL.filter((_, i) => i % 12 === 0))
      check(puzzle);
  }, 1_800_000);

  it('give each day a puzzle of its own, round the whole pool before any comes back', () => {
    const seen = new Set<string>();
    for (let day = 1; day <= DAILY_POOL.length; day++) seen.add(dailyPuzzle(day).id);
    expect(seen.size).toBe(DAILY_POOL.length);
    expect(dailyPuzzle(5).id).toBe(dailyPuzzle(5).id);
    expect(dailyPuzzle(5 + DAILY_POOL.length).id).toBe(dailyPuzzle(5).id);
  });
});

describe('the Daily Puzzle’s share line', () => {
  it('reads as the prompt shows it', () => {
    expect(dailyShareText({ number: 42, solved: true, tries: 1, moves: 3 })).toBe(
      'Fivefold #42 · solved in 3 · 🔵🔵🔵',
    );
    expect(dailyShareText({ number: 42, solved: true, tries: 3, moves: 2 })).toBe(
      'Fivefold #42 · solved in 2 · ⚪⚪🔵🔵',
    );
  });
});

describe('the packages', () => {
  const base = {
    opponent: 'heron' as const,
    won: true,
    second: false,
    rules: 'freestyle' as const,
    yourMoves: 20,
    readTheBoard: true,
    fourFour: false,
    beaten: ['heron' as const],
  };

  it('come from what happened in the game', () => {
    expect(packagesForGame(base)).toEqual(['first-five']);
    expect(packagesForGame({ ...base, second: true, rules: 'exact', yourMoves: 12 })).toEqual([
      'first-five',
      'white-win',
      'exactly-five-win',
      'fast-five',
    ]);
    expect(packagesForGame({ ...base, opponent: 'campbell' })).toEqual([
      'first-five',
      'beat-campbell',
    ]);
    expect(packagesForGame({ ...base, opponent: 'campbell', readTheBoard: false })).toContain(
      'no-overlay-win',
    );
    expect(packagesForGame({ ...base, opponent: 'referee' })).toContain('referee-slayer');
    expect(
      packagesForGame({ ...base, beaten: ['pebble', 'reed', 'heron', 'koi', 'campbell'] }),
    ).toContain('beat-each-opponent');
    expect(packagesForGame({ ...base, won: false, fourFour: true })).toEqual(['four-four']);
    expect(packagesForGame({ ...base, opponent: null })).toEqual([]);
  });

  it('count puzzles and daily solves', () => {
    expect(packagesForPuzzles(49, 6)).toEqual([]);
    expect(packagesForPuzzles(50, 7)).toEqual(['puzzle-50', 'daily-regular']);
  });
});
