import type { GameContext } from '@usr-games/kit';
import { emptyBook, penalise } from '../src/engine/penalties';
import { primesBetween } from '../src/engine/sieve';
import { emptyRecords } from '../src/game/records';

/**
 * A player some way in, for screenshots and trying pages by hand (`?sample=1`): three chapters
 * starred, a best Daily, three numbers in training and an album with a few gaps and big primes.
 */
export function writeSampleSaves(context: GameContext) {
  let book = emptyBook();
  book = penalise(book, 'x', 0, 7);
  book = penalise(book, 'x', 1, 8);
  book = penalise(book, '-', 1, 6);
  context.save({ key: 'tutor', version: 1, defaults: () => ({ book }) }).save({ book });

  const small = primesBetween(0, 100).filter((p) => ![53, 59, 71, 83, 89].includes(p));
  const primes = [
    ...small,
    101,
    103,
    107,
    109,
    113,
    131,
    151,
    181,
    191,
    313,
    1009,
    1013,
    1019,
    1021,
  ];
  context.save({ key: 'album', version: 1, defaults: () => ({ primes }) }).save({ primes });

  const records = {
    ...emptyRecords(),
    chapters: {
      'warm-up': { rush: 3, calm: 0, score: 4100 },
      'take-away': { rush: 2, calm: 0, score: 3900 },
      'both-ways': { rush: 3, calm: 1, score: 4300 },
    },
    daily: {
      days: {
        '2026-10-10': {
          score: 5840,
          line: 'Number Sprint #40 · 5,840 · Sums 19/20 · Split 5/5 · Sieve 0:41 · Spell ✓',
        },
      },
      played: 1,
      best: {
        score: 5840,
        line: 'Number Sprint #40 · 5,840 · Sums 19/20 · Split 5/5 · Sieve 0:41 · Spell ✓',
      },
    },
    counters: {
      sumsSolved: 140,
      numbersSplit: 18,
      boardsCleared: 3,
      wordsDone: 12,
      fractionsClean: 2,
      forgiven: 4,
    },
  };
  context.save({ key: 'records', version: 1, defaults: () => records }).save(records);
}
