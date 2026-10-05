/**
 * Calibrates the difficulty tiers (run with `pnpm exec tsx games/hangman/scripts/difficulty.ts`).
 *
 * For every deck word it measures how many wrong letters the two model players need, fits the
 * well-read player's misses to the word's two features (distinct letters and letter rarity) by
 * least squares, and prints the weights and the tier cut-offs that `engine/difficulty.ts` uses.
 * Numbers go to docs/NOTES.md.
 */
import { missesToSolve, playLetterOrder, playWellRead } from '../src/bots/solver';
import { ALL_DECKS, CORE_DECK } from '../src/decks/decks';
import { wordFeatures } from '../src/engine/difficulty';

const print = (line: string) =>
  process.stdout.write(`${line}
`);

const vocabulary = [...new Set(ALL_DECKS.flatMap((deck) => deck.words))];
const wellRead = (word: string, allowed: number) => playWellRead(word, vocabulary, allowed);

interface Row {
  word: string;
  distinct: number;
  rarity: number;
  misses: number;
  beginner: number;
}

const rows: Row[] = CORE_DECK.words.map((word) => ({
  word,
  ...wordFeatures(word),
  misses: missesToSolve(wellRead, word),
  beginner: missesToSolve((w, allowed) => playLetterOrder(w, allowed), word),
}));

/** Ordinary least squares for y = a + b·x1 + c·x2 via the normal equations. */
function fit(xs1: number[], xs2: number[], ys: number[]): [number, number, number] {
  const n = ys.length;
  const s = (f: (i: number) => number) => {
    let total = 0;
    for (let i = 0; i < n; i++) total += f(i);
    return total;
  };
  const m = [
    [n, s((i) => xs1[i]!), s((i) => xs2[i]!)],
    [s((i) => xs1[i]!), s((i) => xs1[i]! ** 2), s((i) => xs1[i]! * xs2[i]!)],
    [s((i) => xs2[i]!), s((i) => xs1[i]! * xs2[i]!), s((i) => xs2[i]! ** 2)],
  ];
  const v = [s((i) => ys[i]!), s((i) => xs1[i]! * ys[i]!), s((i) => xs2[i]! * ys[i]!)];
  const det = (a: number[][]) =>
    a[0]![0]! * (a[1]![1]! * a[2]![2]! - a[1]![2]! * a[2]![1]!) -
    a[0]![1]! * (a[1]![0]! * a[2]![2]! - a[1]![2]! * a[2]![0]!) +
    a[0]![2]! * (a[1]![0]! * a[2]![1]! - a[1]![1]! * a[2]![0]!);
  const d = det(m);
  const swap = (col: number) =>
    m.map((row, r) => row.map((value, c) => (c === col ? v[r]! : value)));
  return [det(swap(0)) / d, det(swap(1)) / d, det(swap(2)) / d];
}

const [a, b, c] = fit(
  rows.map((row) => row.distinct),
  rows.map((row) => row.rarity),
  rows.map((row) => row.misses),
);
const predicted = rows.map((row) => a + b * row.distinct + c * row.rarity);
const mean = (xs: number[]) => xs.reduce((x, y) => x + y, 0) / xs.length;
const my = mean(rows.map((row) => row.misses));
const mp = mean(predicted);
const cov = mean(rows.map((row, i) => (row.misses - my) * (predicted[i]! - mp)));
const sd = (xs: number[], m: number) => Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
const r =
  cov /
  (sd(
    rows.map((row) => row.misses),
    my,
  ) *
    sd(predicted, mp));

const sorted = [...predicted].sort((x, y) => x - y);
const third = sorted[Math.floor(sorted.length / 3)]!;
const twoThirds = sorted[Math.floor((sorted.length * 2) / 3)]!;

print(`words ${rows.length}, vocabulary ${vocabulary.length}`);
print(
  `fit: misses ≈ ${a.toFixed(3)} + ${b.toFixed(3)}·distinct + ${c.toFixed(3)}·rarity (r = ${r.toFixed(3)})`,
);
print(`tier cut-offs (core tertiles of the score): ${third.toFixed(3)} / ${twoThirds.toFixed(3)}`);
print(
  `well-read misses: mean ${my.toFixed(2)}, lost (≥7) ${((rows.filter((row) => row.misses >= 7).length / rows.length) * 100).toFixed(1)} %`,
);
const beginner = rows.map((row) => row.beginner);
print(
  `letter-order misses: mean ${mean(beginner).toFixed(2)}, lost (≥7) ${((beginner.filter((m) => m >= 7).length / rows.length) * 100).toFixed(1)} %`,
);
for (const deck of ALL_DECKS) {
  const misses = deck.words.map((word) => missesToSolve(wellRead, word));
  const order = deck.words.map((word) =>
    missesToSolve((w, allowed) => playLetterOrder(w, allowed), word),
  );
  print(
    `${deck.id.padEnd(10)} well-read ${mean(misses).toFixed(2)} (lost ${((misses.filter((m) => m >= 7).length / misses.length) * 100).toFixed(1)} %) · letter-order ${mean(order).toFixed(2)} (lost ${((order.filter((m) => m >= 7).length / order.length) * 100).toFixed(1)} %)`,
  );
}
