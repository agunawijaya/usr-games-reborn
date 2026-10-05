import { BY_FREQUENCY, toGuess } from './letters';

/**
 * One word against the tide: the rules of the original, kept exactly. Seven wrong letters are
 * allowed; the seventh brings the tide in. A letter already tried, or anything that is not a
 * letter, is turned away with a word and costs nothing.
 */
export const WAVES_ALLOWED = 7;

export type RoundStatus = 'playing' | 'won' | 'lost';

export interface Round {
  readonly word: string;
  /** Every letter tried, in the order tried, including Lighthouse reveals. */
  readonly tried: readonly string[];
  /** Wrong letters plus Lighthouse uses: the waves that have reached the castle. */
  readonly waves: number;
  /** How many waves the castle can take before it falls (7, or fewer late in a Tide run). */
  readonly wavesAllowed: number;
  readonly lighthouseUses: number;
  readonly status: RoundStatus;
}

export type GuessOutcome =
  | { kind: 'hit'; letter: string; positions: number[]; round: Round }
  | { kind: 'miss'; letter: string; round: Round }
  | { kind: 'repeat'; letter: string }
  | { kind: 'not-a-letter'; input: string }
  | { kind: 'over' };

export function newRound(word: string, wavesAllowed = WAVES_ALLOWED): Round {
  return { word, tried: [], waves: 0, wavesAllowed, lighthouseUses: 0, status: 'playing' };
}

export function positionsOf(word: string, letter: string): number[] {
  const positions: number[] = [];
  for (let i = 0; i < word.length; i++) if (word[i] === letter) positions.push(i);
  return positions;
}

function isSolved(word: string, tried: readonly string[]): boolean {
  return [...word].every((letter) => tried.includes(letter));
}

function statusAfter(word: string, tried: readonly string[], waves: number, allowed: number) {
  if (isSolved(word, tried)) return 'won';
  return waves >= allowed ? 'lost' : 'playing';
}

/** Plays one key. Repeats and non-letters leave the round untouched, as in the original. */
export function guess(round: Round, input: string): GuessOutcome {
  if (round.status !== 'playing') return { kind: 'over' };
  const letter = toGuess(input);
  if (letter === null) return { kind: 'not-a-letter', input };
  if (round.tried.includes(letter)) return { kind: 'repeat', letter };

  const tried = [...round.tried, letter];
  const positions = positionsOf(round.word, letter);
  const waves = positions.length > 0 ? round.waves : round.waves + 1;
  const next: Round = {
    ...round,
    tried,
    waves,
    status: statusAfter(round.word, tried, waves, round.wavesAllowed),
  };
  return positions.length > 0
    ? { kind: 'hit', letter, positions, round: next }
    : { kind: 'miss', letter, round: next };
}

/** The word as the player sees it: each letter, or null where it is still hidden. */
export function revealed(round: Round): (string | null)[] {
  return [...round.word].map((letter) => (round.tried.includes(letter) ? letter : null));
}

export function wrongLetters(round: Round): string[] {
  return round.tried.filter((letter) => !round.word.includes(letter));
}

/**
 * The Lighthouse's choice: the hidden letter that fills the most slots, ties going to the
 * letter more common in English. It costs a wave, so it is out of reach when one more wave
 * would bring the castle down.
 */
export function lighthouseLetter(round: Round): string | null {
  if (round.status !== 'playing' || round.waves + 1 >= round.wavesAllowed) return null;
  let best: string | null = null;
  let bestCount = 0;
  for (const letter of BY_FREQUENCY) {
    if (round.tried.includes(letter)) continue;
    const count = positionsOf(round.word, letter).length;
    if (count > bestCount) {
      best = letter;
      bestCount = count;
    }
  }
  return best;
}

export interface LighthouseOutcome {
  letter: string;
  positions: number[];
  round: Round;
}

export function useLighthouse(round: Round): LighthouseOutcome | null {
  const letter = lighthouseLetter(round);
  if (letter === null) return null;
  const tried = [...round.tried, letter];
  const waves = round.waves + 1;
  return {
    letter,
    positions: positionsOf(round.word, letter),
    round: {
      ...round,
      tried,
      waves,
      lighthouseUses: round.lighthouseUses + 1,
      status: statusAfter(round.word, tried, waves, round.wavesAllowed),
    },
  };
}
