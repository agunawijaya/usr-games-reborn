/** The 26 letters a guess may be, in alphabetical order (the order of the shell keyboard). */
export const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

/**
 * How often each letter appears in everyday English text, in percent. A long-established
 * statistic of the language, used to break ties (the Lighthouse) and to rate how rare a word's
 * letters are (difficulty tiers).
 */
export const LETTER_FREQUENCY: Readonly<Record<string, number>> = {
  e: 12.7,
  t: 9.06,
  a: 8.17,
  o: 7.51,
  i: 6.97,
  n: 6.75,
  s: 6.33,
  h: 6.09,
  r: 5.99,
  d: 4.25,
  l: 4.03,
  c: 2.78,
  u: 2.76,
  m: 2.41,
  w: 2.36,
  f: 2.23,
  g: 2.02,
  y: 1.97,
  p: 1.93,
  b: 1.29,
  v: 0.98,
  k: 0.77,
  j: 0.15,
  x: 0.15,
  q: 0.1,
  z: 0.07,
};

/** Letters from most to least common in English. */
export const BY_FREQUENCY: readonly string[] = [...ALPHABET].sort(
  (a, b) => LETTER_FREQUENCY[b]! - LETTER_FREQUENCY[a]!,
);

export function isLetter(value: string): boolean {
  return value.length === 1 && value >= 'a' && value <= 'z';
}

/**
 * Turns what the player typed into a guess: a single letter of either case becomes lower case;
 * anything else is not a guess. The original accepted upper case the same way.
 */
export function toGuess(input: string): string | null {
  const lower = input.toLowerCase();
  return isLetter(lower) ? lower : null;
}

/** True when the word is made only of the letters a to z, the shape every deck word has. */
export function isPlainWord(word: string): boolean {
  return /^[a-z]+$/.test(word);
}

export function distinctLetters(word: string): string[] {
  return [...new Set(word)];
}
