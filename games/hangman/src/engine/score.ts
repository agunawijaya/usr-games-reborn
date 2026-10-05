import { type Round, WAVES_ALLOWED } from './round';

/**
 * The tide average: the original's golf scoring, kept as the soul of the score. Each word
 * scores the waves it took; lower is better. A word the tide takes scores nine, two more than
 * the seven waves allowed, so losing always costs more than scraping through on the last wave.
 */
export const LOST_WORD_SCORE = WAVES_ALLOWED + 2;

export function wordScore(round: Round): number {
  return round.status === 'lost' ? LOST_WORD_SCORE : round.waves;
}

/** A running total of finished words: enough to give an average without keeping every word. */
export interface Tally {
  readonly words: number;
  readonly total: number;
}

export const EMPTY_TALLY: Tally = { words: 0, total: 0 };

export function addWord(tally: Tally, score: number): Tally {
  return { words: tally.words + 1, total: tally.total + score };
}

/** The average over finished words, or null before the first one. */
export function average(tally: Tally): number | null {
  return tally.words === 0 ? null : tally.total / tally.words;
}

/**
 * The average as it would stand if the word in play ended now, counting the waves it has taken
 * so far: what the original printed as its "current" figure beside the overall one.
 */
export function averageWithWordInPlay(tally: Tally, wavesSoFar: number): number {
  return (tally.total + wavesSoFar) / (tally.words + 1);
}

/** Averages are shown to two places; the original printed three. */
export function formatAverage(value: number | null, places = 2): string {
  return value === null ? '–' : value.toFixed(places);
}
