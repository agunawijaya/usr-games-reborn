import { createRng } from '@usr-games/kit';
import type { GridSize, Rule } from './grid';
import { type Roll, rollCubes } from './roll';
import { type BoardWord, solveBoard } from './solver';
import type { Trie } from './trie';

/**
 * Dealing a board fit to play: the cubes are rolled until the board holds enough words that no
 * round feels empty. The floors sit near each size's tenth percentile (see NOTES), so most
 * first rolls already pass.
 */
export const MIN_WORDS: Record<GridSize, number> = { 4: 30, 5: 80, 6: 150 };
const MAX_ROLLS = 60;

/** A Daily Grid holds a word of this many letters at least. */
export const DAILY_LONG_WORD = 7;
const DAILY_CANDIDATES = 24;

export interface Deal {
  roll: Roll;
  words: BoardWord[];
}

export interface DealRequest {
  size: GridSize;
  rule: Rule;
  seed: string;
  minLetters: number;
}

export function dealBoard(trie: Trie, request: DealRequest): Deal {
  const rng = createRng(request.seed);
  let best: Deal | null = null;
  for (let attempt = 0; attempt < MAX_ROLLS; attempt++) {
    const roll = rollCubes(request.size, rng);
    const words = solveBoard(roll.board, trie, request);
    if (words.length >= MIN_WORDS[request.size]) return { roll, words };
    if (!best || words.length > best.words.length) best = { roll, words };
  }
  return best!;
}

/**
 * The Daily Grid: the same seed gives every player the same board, chosen as the richest of a
 * few rolls that hold a long word, so the day's board is always one worth sharing.
 */
export function dealDaily(trie: Trie, seed: string): Deal {
  const rng = createRng(seed);
  let best: Deal | null = null;
  for (let attempt = 0; attempt < DAILY_CANDIDATES; attempt++) {
    const roll = rollCubes(4, rng);
    const words = solveBoard(roll.board, trie, { rule: 'classic', minLetters: 3 });
    const long = (words[0]?.word.length ?? 0) >= DAILY_LONG_WORD;
    const better = !best || words.length > best.words.length;
    if (long && better) best = { roll, words };
  }
  return best ?? dealBoard(trie, { size: 4, rule: 'classic', seed, minLetters: 3 });
}
