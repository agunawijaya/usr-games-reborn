import type { Rng } from '@usr-games/kit';
import { isPlainWord } from './letters';

/**
 * How a word is chosen. Play always uses the fair picker. The original's picker is reproduced
 * here only so its bias can be measured and shown in tests and notes (Classic's test harness);
 * no round in the game is ever drawn with it.
 */

/** Every word in the list is equally likely. */
export function pickFair(words: readonly string[], rng: Rng): string {
  if (words.length === 0) throw new Error('cannot pick from an empty word list');
  return words[rng.int(0, words.length - 1)]!;
}

/** The original's word rule: only lower-case letters, and at least this many of them. */
export function passesOriginalRule(word: string, minimumLength: number): boolean {
  return word.length >= minimumLength && isPlainWord(word);
}

/**
 * The original's picker, step for step: jump to a random byte of the word file, throw away the
 * rest of the line it lands in, and take the next whole line. It trims the line's last
 * character unconditionally (meant to be the newline), then retries until the line passes the
 * word rule. A landing in the last line finds no next line and retries too.
 */
export function pickLikeTheOriginal(file: string, rng: Rng, minimumLength: number): string {
  for (let attempt = 0; attempt < 100_000; attempt++) {
    const landing = Math.floor(rng.next() * file.length);
    const restOfLine = file.indexOf('\n', landing);
    if (restOfLine < 0 || restOfLine + 1 >= file.length) continue;
    const start = restOfLine + 1;
    const end = file.indexOf('\n', start);
    const line = end < 0 ? file.slice(start) : file.slice(start, end + 1);
    const word = line.slice(0, -1);
    if (passesOriginalRule(word, minimumLength)) return word;
  }
  throw new Error('no word in the file passes the rule');
}

/**
 * The exact chance of each word under the original picker: a line is taken when the landing
 * falls anywhere in the line before it (newline included), so its chance is proportional to
 * that line's length plus one, renormalised over the lines that pass the rule.
 */
export function originalPickerOdds(file: string, minimumLength: number): Map<string, number> {
  const lines = file.split('\n');
  const hasFinalNewline = file.endsWith('\n');
  if (hasFinalNewline) lines.pop();
  const weights = new Map<string, number>();
  let total = 0;
  for (let i = 1; i < lines.length; i++) {
    const isLast = i === lines.length - 1;
    // Without a newline the trim eats the word's own last letter.
    const word = isLast && !hasFinalNewline ? lines[i]!.slice(0, -1) : lines[i]!;
    if (!passesOriginalRule(word, minimumLength)) continue;
    const weight = lines[i - 1]!.length + 1;
    weights.set(word, (weights.get(word) ?? 0) + weight);
    total += weight;
  }
  for (const [word, weight] of weights) weights.set(word, weight / total);
  return weights;
}
