import type { Rng } from '@usr-games/kit';
import { CIRCLES } from '../codecs/semaphore';
import { WORDS } from './phrases';

/**
 * The learning ladders. Morse comes two characters at a time, Koch-style: every lesson is sent
 * at full character speed with the new pair mixed into everything learned before. Semaphore
 * comes a circle at a time, as the 1911 handbook taught it.
 */
export const MORSE_LADDER: readonly string[] = [
  'ET',
  'AN',
  'IM',
  'SO',
  'HR',
  'DW',
  'UK',
  'GC',
  'LP',
  'BY',
  'FV',
  'JQ',
  'XZ',
  '12',
  '34',
  '56',
  '78',
  '90',
  '.,',
  '?/',
];

export const SEMAPHORE_LADDER: readonly string[] = [
  ...CIRCLES.map((circle) => circle.join('')),
  '1234567890',
];

/** Every character known once lesson `lesson` (0-based) is reached. */
export function knownAt(ladder: readonly string[], lesson: number): string {
  return ladder.slice(0, Math.max(0, Math.min(ladder.length, lesson + 1))).join('');
}

/** Words spelled only with `letters`, longest first. */
export function wordsFrom(letters: string): string[] {
  const set = new Set(letters);
  return WORDS.filter((word) => [...word].every((char) => set.has(char))).sort(
    (a, b) => b.length - a.length,
  );
}

/**
 * A practice message for a lesson: real words where the known letters allow, the new letters
 * favoured, topped up with five-letter groups as Koch's method uses.
 */
export function lessonText(
  ladder: readonly string[],
  lesson: number,
  rng: Rng,
  groups = 5,
): string {
  const known = knownAt(ladder, lesson);
  const fresh = ladder[Math.min(lesson, ladder.length - 1)]!;
  const words = wordsFrom(known.replace(/[^A-Z]/g, ''));
  const withFresh = words.filter((word) => [...fresh].some((char) => word.includes(char)));
  const pool = withFresh.length >= 3 ? withFresh : words;
  const out: string[] = [];
  for (let i = 0; i < groups; i++) {
    if (pool.length > 0 && rng.chance(0.65)) {
      out.push(rng.pick(pool));
      continue;
    }
    // A five-character group, at least two of them from the new pair.
    let group = '';
    for (let k = 0; k < 5; k++) group += k < 2 ? rng.pick([...fresh]) : rng.pick([...known]);
    out.push(rng.shuffle([...group]).join(''));
  }
  return out.join(' ');
}
