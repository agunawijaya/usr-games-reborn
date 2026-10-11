import type { Tier } from '../dictionary/tiers';
import { type Board, type GridSize, isValidPath, type Rule, spell } from './grid';
import { comboAfterWord, type Combo, coverage, NO_COMBO, wordScore } from './score';
import { type BoardWord, pathsSpelling } from './solver';

/**
 * One round on one board: what has been found, the chain combo, and how every new word is
 * judged. Pure: every function returns a new state.
 */

export interface RoundSetup {
  size: GridSize;
  rule: Rule;
  minLetters: number;
  /** Seconds on the clock, or null for an untimed round. */
  seconds: number | null;
}

export interface FoundWord {
  word: string;
  path: number[];
  points: number;
  comboLevel: number;
  /** Seconds into the round. */
  at: number;
  tier: Tier;
}

export interface RoundState {
  setup: RoundSetup;
  board: Board;
  /** Every word on the board under the round's rule: the dictionary's answer. */
  answers: ReadonlyMap<string, BoardWord>;
  found: FoundWord[];
  combo: Combo;
  score: number;
}

export type Verdict =
  | { kind: 'found'; entry: FoundWord }
  | { kind: 'again'; word: string; path: number[] }
  | { kind: 'too-short'; word: string }
  | { kind: 'not-on-board'; word: string }
  | { kind: 'not-a-word'; word: string; path: number[] };

export function newRound(
  setup: RoundSetup,
  board: Board,
  answers: readonly BoardWord[],
): RoundState {
  return {
    setup,
    board,
    answers: new Map(answers.map((answer) => [answer.word, answer])),
    found: [],
    combo: NO_COMBO,
    score: 0,
  };
}

/** A traced word: the path is what the player drew. */
export function submitPath(
  state: RoundState,
  path: readonly number[],
  at: number,
): { state: RoundState; verdict: Verdict } {
  const { size, rule } = state.setup;
  const word = spell(state.board, path);
  if (!isValidPath(size, rule, path)) return { state, verdict: { kind: 'not-on-board', word } };
  return judge(state, word, [...path], at);
}

/** A typed word: the game finds a path for it, preferring the one the player has in view. */
export function submitTyped(
  state: RoundState,
  typed: string,
  at: number,
  preferredPath?: readonly number[],
): { state: RoundState; verdict: Verdict } {
  const word = typed.toLowerCase();
  const usable =
    preferredPath && spell(state.board, preferredPath) === word ? [...preferredPath] : null;
  const path = usable ?? pathsSpelling(state.board, state.setup.rule, word, 1)[0];
  if (!path) return { state, verdict: { kind: 'not-on-board', word } };
  return judge(state, word, path, at);
}

function judge(
  state: RoundState,
  word: string,
  path: number[],
  at: number,
): { state: RoundState; verdict: Verdict } {
  if (word.length < state.setup.minLetters) return { state, verdict: { kind: 'too-short', word } };
  const earlier = state.found.find((entry) => entry.word === word);
  if (earlier) return { state, verdict: { kind: 'again', word, path: earlier.path } };
  const answer = state.answers.get(word);
  if (!answer) return { state, verdict: { kind: 'not-a-word', word, path } };
  const combo = comboAfterWord(state.combo, at);
  const entry: FoundWord = {
    word,
    path,
    points: wordScore(word, combo.level),
    comboLevel: combo.level,
    at,
    tier: answer.tier,
  };
  return {
    state: { ...state, found: [...state.found, entry], combo, score: state.score + entry.points },
    verdict: { kind: 'found', entry },
  };
}

export function roundCoverage(state: RoundState): number {
  return coverage(state.found.length, state.answers.size);
}

/** The words still hidden on the board, longest first: the reveal's list. */
export function missedWords(state: RoundState): BoardWord[] {
  const found = new Set(state.found.map((entry) => entry.word));
  return [...state.answers.values()].filter((answer) => !found.has(answer.word));
}

export function longestFound(state: RoundState): FoundWord | null {
  return state.found.reduce<FoundWord | null>(
    (best, entry) => (!best || entry.word.length > best.word.length ? entry : best),
    null,
  );
}
