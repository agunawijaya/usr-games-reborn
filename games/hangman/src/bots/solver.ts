import { BY_FREQUENCY } from '../engine/letters';
import { guess, newRound, type Round } from '../engine/round';

/**
 * Two model players for simulations and difficulty tiers (never an opponent in play).
 *
 * - The **well-read** player knows every word in the vocabulary it is given. It keeps the words
 *   that still fit what it has seen and always tries the letter found in most of them, ties
 *   going to the letter more common in English.
 * - The **letter-order** player knows no words at all: it simply tries letters from most to
 *   least common in English. It stands in for a beginner and bounds how hard a word can be.
 */
export function fitsPattern(candidate: string, round: Round): boolean {
  if (candidate.length !== round.word.length) return false;
  for (const letter of round.tried) {
    const inWord = round.word.includes(letter);
    for (let i = 0; i < candidate.length; i++) {
      const here = round.word[i] === letter;
      if (here !== (candidate[i] === letter)) return false;
    }
    if (!inWord && candidate.includes(letter)) return false;
  }
  return true;
}

function bestLetter(candidates: readonly string[], tried: readonly string[]): string {
  let best = '';
  let bestCount = -1;
  for (const letter of BY_FREQUENCY) {
    if (tried.includes(letter)) continue;
    let count = 0;
    for (const word of candidates) if (word.includes(letter)) count++;
    if (count > bestCount) {
      best = letter;
      bestCount = count;
    }
  }
  return best;
}

/** Plays a whole round as the well-read player; returns the finished round. */
export function playWellRead(word: string, vocabulary: readonly string[], wavesAllowed = 7): Round {
  let round = newRound(word, wavesAllowed);
  let candidates = vocabulary.filter((candidate) => candidate.length === word.length);
  while (round.status === 'playing') {
    const letter = bestLetter(candidates, round.tried);
    const outcome = guess(round, letter);
    if (outcome.kind !== 'hit' && outcome.kind !== 'miss') break;
    round = outcome.round;
    candidates = candidates.filter((candidate) => fitsPattern(candidate, round));
  }
  return round;
}

/** Plays a whole round trying letters in English frequency order. */
export function playLetterOrder(word: string, wavesAllowed = 7): Round {
  let round = newRound(word, wavesAllowed);
  for (const letter of BY_FREQUENCY) {
    if (round.status !== 'playing') break;
    const outcome = guess(round, letter);
    if (outcome.kind === 'hit' || outcome.kind === 'miss') round = outcome.round;
  }
  return round;
}

/** Wrong letters a model player needs to find the word, counted past seven (no tide). */
export function missesToSolve(
  play: (word: string, allowed: number) => Round,
  word: string,
): number {
  return play(word, 26).waves;
}
