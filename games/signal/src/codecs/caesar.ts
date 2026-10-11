/**
 * The shift cipher and the automatic codebreaker of the BSD `caesar` program (Stan King and
 * John Eldridge, after an idea of Bob Morris; BSD-3-Clause, the Regents of the University of
 * California). The breaker scores all 26 rotations against English letter frequencies on a
 * log scale, so rare letters count heavily against a guess, and keeps the best.
 */

/** The frequency table compiled into `caesar.c`, in percent, A to Z. */
export const CODE_FREQUENCIES: readonly number[] = [
  7.97, 1.35, 3.61, 4.78, 12.37, 2.01, 1.46, 4.49, 6.39, 0.04, 0.42, 3.81, 2.69, 5.92, 6.96, 2.91,
  0.08, 6.63, 8.77, 9.68, 2.62, 0.81, 1.88, 0.23, 2.07, 0.06,
];

/**
 * The table printed in the program's manual, which is not the one the code uses: the manual
 * gives E thirteen percent where the code has 12.37, puts S eighth where the code puts it
 * third, and calls Z the rarest letter where the code says J.
 */
export const MANUAL_FREQUENCIES: readonly number[] = [
  8.1, 1.4, 2.7, 3.8, 13, 2.9, 2, 5.2, 6.3, 0.13, 0.4, 3.4, 2.5, 7.1, 7.9, 1.9, 0.11, 6.8, 6.1,
  10.5, 2.4, 0.9, 1.5, 0.15, 1.9, 0.07,
];

/** The original reads one buffer of this many bytes to make its guess. */
export const ANALYSIS_WINDOW = 2048;

/**
 * "Weight low probs REAL low": each frequency becomes its logarithm, so a letter that English
 * almost never uses costs a guess far more than a common one earns. The constant term the
 * original adds, log(26/100), shifts every rotation equally and never changes the winner.
 */
export const LOG_WEIGHTS: readonly number[] = CODE_FREQUENCIES.map(
  (percent) => Math.log(percent) + Math.log(26 / 100),
);

const A = 65;
const LOWER_A = 97;

function rotateChar(char: string, shift: number): string {
  const code = char.charCodeAt(0);
  if (code >= A && code < A + 26) return String.fromCharCode(A + ((code - A + shift) % 26));
  if (code >= LOWER_A && code < LOWER_A + 26)
    return String.fromCharCode(LOWER_A + ((code - LOWER_A + shift) % 26));
  return char;
}

/** Turns every letter forward by `shift` places (any whole number), keeping case and the rest. */
export function rotate(text: string, shift: number): string {
  const step = ((shift % 26) + 26) % 26;
  let out = '';
  for (const char of text) out += rotateChar(char, step);
  return out;
}

export const rot13 = (text: string): string => rotate(text, 13);

/** How many of each letter, A to Z, ignoring case; only the first `window` characters count. */
export function letterCounts(text: string, window = ANALYSIS_WINDOW): number[] {
  const counts = new Array<number>(26).fill(0);
  for (const char of text.slice(0, window)) {
    const code = char.toUpperCase().charCodeAt(0);
    if (code >= A && code < A + 26) counts[code - A]!++;
  }
  return counts;
}

/**
 * The score of every rotation: the observed counts "dotted" with the log weights after turning
 * the text forward by that rotation. Higher is more English.
 */
export function rotationScores(text: string): number[] {
  const counts = letterCounts(text);
  const scores: number[] = [];
  for (let shift = 0; shift < 26; shift++) {
    let dot = 0;
    for (let i = 0; i < 26; i++) dot += counts[i]! * LOG_WEIGHTS[(i + shift) % 26]!;
    scores.push(dot);
  }
  return scores;
}

/**
 * The rotation the original would print: the first strictly best score, so ties go to the
 * smaller rotation and a text without letters comes back unturned.
 */
export function bestRotation(text: string): number {
  const scores = rotationScores(text);
  let winner = 0;
  for (let shift = 1; shift < 26; shift++) if (scores[shift]! > scores[winner]!) winner = shift;
  return winner;
}

/** What `caesar` with no argument prints: the text turned by its best guess. */
export function crack(text: string): { rotation: number; plain: string } {
  const rotation = bestRotation(text);
  return { rotation, plain: rotate(text, rotation) };
}

/**
 * The scope's reading of each rotation, 0–1: where its score sits between the worst and the
 * best of the 26. The breaker's own measure, made readable.
 */
export function rotationFit(text: string): number[] {
  const scores = rotationScores(text);
  const low = Math.min(...scores);
  const high = Math.max(...scores);
  return scores.map((score) => (high === low ? 0 : (score - low) / (high - low)));
}

/** The message's letter shares in percent, A to Z, after turning it by `shift`. */
export function shareAfter(text: string, shift: number): number[] {
  const counts = letterCounts(text);
  const total = counts.reduce((sum, n) => sum + n, 0) || 1;
  const shares = new Array<number>(26).fill(0);
  counts.forEach((n, i) => (shares[(i + shift) % 26] = (100 * n) / total));
  return shares;
}

/* ------------------------------------------------------------------ keyword shifts */

/**
 * A keyword shift (late chapters): letter by letter, the shift comes from the keyword in turn
 * (A = 0, B = 1 …), counting letters only. One rotation can no longer crack it, but every
 * keyword-length column is still a plain shift the scope can read.
 */
export function keywordShift(text: string, keyword: string, direction: 1 | -1 = 1): string {
  const shifts = [...keyword.toUpperCase()]
    .filter((c) => /[A-Z]/.test(c))
    .map((c) => c.charCodeAt(0) - A);
  if (shifts.length === 0) return text;
  let out = '';
  let index = 0;
  for (const char of text) {
    if (/[A-Za-z]/.test(char)) {
      out += rotateChar(char, (direction * shifts[index % shifts.length]! + 26) % 26);
      index++;
    } else out += char;
  }
  return out;
}

/** The letters a keyword column holds: every `length`-th letter starting at `column`. */
export function keywordColumn(text: string, length: number, column: number): string {
  return [...text.replace(/[^A-Za-z]/g, '')].filter((_, i) => i % length === column).join('');
}
