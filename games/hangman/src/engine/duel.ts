import { isPlainWord } from './letters';
import { type Round, newRound } from './round';
import { wordScore } from './score';

/**
 * Duel: two players on one device. One sets a secret word behind a privacy screen, the other
 * guesses it; then they swap. After the agreed number of turns each, the lower total of waves
 * wins, golf-style; a word the tide takes counts nine, as everywhere else.
 */
export type Seat = 0 | 1;

export interface DuelTurn {
  setter: Seat;
  guesser: Seat;
  word: string;
  score: number;
}

export interface Duel {
  readonly names: readonly [string, string];
  readonly turnsEach: number;
  readonly turns: readonly DuelTurn[];
}

export const SECRET_MIN_LENGTH = 3;
export const SECRET_MAX_LENGTH = 14;

export function startDuel(names: [string, string], turnsEach: number): Duel {
  return { names, turnsEach, turns: [] };
}

/** Whose turn it is to set the word: the players alternate, the first player setting first. */
export function nextSetter(duel: Duel): Seat {
  return (duel.turns.length % 2) as Seat;
}

export function isDuelOver(duel: Duel): boolean {
  return duel.turns.length >= duel.turnsEach * 2;
}

export type SecretProblem = 'too-short' | 'too-long' | 'not-letters' | 'not-for-the-beach';

/**
 * Checks a secret word typed by a player: letters only (spaces and case are forgiven), a
 * sensible length, and nothing the beach's all-ages word screen turns away.
 */
export function checkSecret(
  typed: string,
  isUnsuitable: (word: string) => boolean,
): { ok: true; word: string } | { ok: false; problem: SecretProblem } {
  const word = typed.trim().toLowerCase();
  if (!isPlainWord(word)) return { ok: false, problem: 'not-letters' };
  if (word.length < SECRET_MIN_LENGTH) return { ok: false, problem: 'too-short' };
  if (word.length > SECRET_MAX_LENGTH) return { ok: false, problem: 'too-long' };
  if (isUnsuitable(word)) return { ok: false, problem: 'not-for-the-beach' };
  return { ok: true, word };
}

export function duelRound(word: string): Round {
  return newRound(word);
}

export function recordTurn(duel: Duel, round: Round): Duel {
  if (round.status === 'playing') throw new Error('the word is still in play');
  const setter = nextSetter(duel);
  const turn: DuelTurn = {
    setter,
    guesser: setter === 0 ? 1 : 0,
    word: round.word,
    score: wordScore(round),
  };
  return { ...duel, turns: [...duel.turns, turn] };
}

export function duelTotals(duel: Duel): [number, number] {
  const totals: [number, number] = [0, 0];
  for (const turn of duel.turns) totals[turn.guesser] += turn.score;
  return totals;
}

/** The seat with the lower total, or null for a tie. */
export function duelLeader(duel: Duel): Seat | null {
  const [first, second] = duelTotals(duel);
  if (first === second) return null;
  return first < second ? 0 : 1;
}
