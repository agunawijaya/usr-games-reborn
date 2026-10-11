/**
 * Designs Chain Letter's own letter cubes for every grid size, from the dictionary itself:
 *
 * 1. Letter and bigram frequencies over every playable word, weighted by rarity tier so that
 *    common words count most (`Qu` counts as one unit, as it sits on one face).
 * 2. Faces per letter in proportion to frequency^0.8, at least one each: flattening the curve
 *    keeps the rare letters on the cubes without crowding out the vowels.
 * 3. Simulated annealing over the faces' places (and, within one face of the target, their
 *    counts), scoring each candidate set by solving the same 160 rolls every time: the mean of
 *    log(1 + words) rewards boards that are reliably rich rather than occasionally huge, a share
 *    of log(1 + six-letter words) rewards room for long chains, and two letters that often sit
 *    side by side in words are kept off the same cube.
 * 4. A fresh validation run of 2 000 rolls per size, written into the generated file.
 *
 *   tsx scripts/design-cubes.ts [--sizes 4,5,6] [--iterations n] [--compare-1988 <bog.c>]
 *
 * `--compare-1988` reads the 1988 program's cube table from its source, outside the
 * repository, only to measure it on the same validation rolls; nothing of it is written.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRng, type Rng } from '@usr-games/kit';
import { decodeWordList, inflateWordList } from '../src/dictionary/codec';
import { WORDS_DEFLATED } from '../src/dictionary/words.data';
import { type GridSize } from '../src/engine/grid';
import { solveBoard } from '../src/engine/solver';
import { Trie } from '../src/engine/trie';

/** Scripts report to the terminal; the lint rule keeps console logging out of game code. */
const print = (line: string) => process.stdout.write(`${line}\n`);

const HERE = fileURLToPath(new URL('.', import.meta.url));
const OUTPUT = join(HERE, '../src/engine/cube-sets.ts');

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const VOWELS = new Set([...'aeiou']);
/** Common words weigh most: a cube set should serve the words people know. */
const TIER_WEIGHT = [4, 2, 1, 0.5];
const FLATTEN = 0.8;
const TRAINING_ROLLS = 160;
const VALIDATION_ROLLS = 2000;
const LONG_WORD = 6;

interface Frequencies {
  letters: Map<string, number>;
  affinity: Map<string, number>;
}

/** Splits a word into face units: `qu` is one unit, written `q`. */
function units(word: string): string[] {
  return [...word.replace(/qu/g, 'q')];
}

function pairKey(a: string, b: string): string {
  return a < b ? a + b : b + a;
}

function measure(text: string): Frequencies {
  const letters = new Map<string, number>();
  const affinity = new Map<string, number>();
  decodeWordList(text, (word, tier) => {
    const weight = TIER_WEIGHT[tier]!;
    const list = units(word);
    list.forEach((unit, i) => {
      letters.set(unit, (letters.get(unit) ?? 0) + weight);
      const next = list[i + 1];
      if (next && next !== unit) {
        const key = pairKey(unit, next);
        affinity.set(key, (affinity.get(key) ?? 0) + weight);
      }
    });
  });
  return { letters, affinity };
}

/** Faces per letter, proportional to a flattened frequency, every letter at least once. */
function faceTargets(letters: Map<string, number>, faces: number): Map<string, number> {
  const flattened = [...ALPHABET].map(
    (letter) => [letter, (letters.get(letter) ?? 0) ** FLATTEN] as const,
  );
  const total = flattened.reduce((sum, [, value]) => sum + value, 0);
  const exact = flattened.map(([letter, value]) => [letter, (faces * value) / total] as const);
  const targets = new Map(exact.map(([letter, value]) => [letter, Math.max(1, Math.round(value))]));
  // Qu stays on a single face: it is a treat, not a staple.
  targets.set('q', 1);
  let sum = [...targets.values()].reduce((a, b) => a + b, 0);
  const byResidual = [...exact].sort((a, b) => (b[1] % 1) - (a[1] % 1));
  for (let i = 0; sum !== faces; i++) {
    const [letter] = byResidual[i % byResidual.length]!;
    if (letter === 'q') continue;
    const current = targets.get(letter)!;
    if (sum < faces) {
      targets.set(letter, current + 1);
      sum++;
    } else if (current > 1) {
      targets.set(letter, current - 1);
      sum--;
    }
  }
  return targets;
}

/** Deals vowels first and then consonants, most frequent first, round the cubes. */
function initialCubes(targets: Map<string, number>, cubes: number): string[][] {
  const faces = (vowels: boolean) =>
    [...targets.entries()]
      .filter(([letter]) => VOWELS.has(letter) === vowels)
      .sort((a, b) => b[1] - a[1])
      .flatMap(([letter, count]) => Array.from({ length: count }, () => letter));
  const dealt: string[][] = Array.from({ length: cubes }, () => []);
  [...faces(true), ...faces(false)].forEach((letter, i) => dealt[i % cubes]!.push(letter));
  return dealt;
}

/**
 * Rules every cube keeps: one to four vowels, so no cube is all vowels or all consonants, and
 * no letter more than twice, so a tumbling cube never shows a wall of the same letter.
 */
function isWellFormed(cube: readonly string[]): boolean {
  const vowels = cube.filter((letter) => VOWELS.has(letter)).length;
  if (vowels < 1 || vowels > 4) return false;
  const seen = new Map<string, number>();
  for (const letter of cube) seen.set(letter, (seen.get(letter) ?? 0) + 1);
  return [...seen.values()].every((count) => count <= 2);
}

interface FixedRoll {
  cubeAt: number[];
  faceUp: number[];
}

function fixedRolls(size: GridSize, count: number, label: string): FixedRoll[] {
  return Array.from({ length: count }, (_, i) => {
    const rng = createRng(`${label}:${size}:${i}`);
    const cubeAt = rng.shuffle(Array.from({ length: size * size }, (_, cube) => cube));
    return { cubeAt, faceUp: cubeAt.map(() => rng.int(0, 5)) };
  });
}

interface BoardStats {
  words: number;
  long: number;
  longest: number;
}

function rollStats(trie: Trie, size: GridSize, cubes: string[][], roll: FixedRoll): BoardStats {
  const faces = roll.cubeAt.map((cube, cell) => {
    const letter = cubes[cube]![roll.faceUp[cell]!]!;
    return letter === 'q' ? 'qu' : letter;
  });
  const words = solveBoard({ size, faces }, trie, { rule: 'classic', minLetters: 3 });
  return {
    words: words.length,
    long: words.filter(({ word }) => word.length >= LONG_WORD).length,
    longest: words[0]?.word.length ?? 0,
  };
}

function sameCubePenalty(
  cubes: string[][],
  affinity: Map<string, number>,
  strongest: number,
): number {
  let penalty = 0;
  for (const cube of cubes) {
    for (let i = 0; i < cube.length; i++) {
      for (let j = i + 1; j < cube.length; j++) {
        const a = cube[i]!;
        const b = cube[j]!;
        // A letter twice on one cube wastes a face; strong pairs on one cube can never meet.
        if (a === b) penalty += 0.02;
        else penalty += (0.6 * (affinity.get(pairKey(a, b)) ?? 0)) / strongest / cubes.length;
      }
    }
  }
  return penalty;
}

function score(
  trie: Trie,
  size: GridSize,
  cubes: string[][],
  rolls: FixedRoll[],
  affinity: Map<string, number>,
  strongest: number,
): number {
  let total = 0;
  for (const roll of rolls) {
    const stats = rollStats(trie, size, cubes, roll);
    total += Math.log1p(stats.words) + 0.35 * Math.log1p(stats.long);
  }
  return total / rolls.length - sameCubePenalty(cubes, affinity, strongest);
}

function anneal(
  trie: Trie,
  size: GridSize,
  frequencies: Frequencies,
  iterations: number,
  rng: Rng,
): string[][] {
  const cubeCount = size * size;
  const targets = faceTargets(frequencies.letters, cubeCount * 6);
  const strongest = Math.max(...frequencies.affinity.values());
  const rolls = fixedRolls(size, TRAINING_ROLLS, 'design');
  let cubes = initialCubes(targets, cubeCount);
  if (!cubes.every(isWellFormed))
    throw new Error(`The first deal for ${size}×${size} breaks the cube rules.`);
  let current = score(trie, size, cubes, rolls, frequencies.affinity, strongest);
  let best = { cubes: cubes.map((cube) => [...cube]), value: current };
  const counts = new Map(targets);
  const startHeat = 0.02;
  const endHeat = 0.0005;
  for (let step = 0; step < iterations; step++) {
    const heat = startHeat * (endHeat / startHeat) ** (step / iterations);
    const candidate = cubes.map((cube) => [...cube]);
    const a = rng.int(0, cubeCount - 1);
    const faceA = rng.int(0, 5);
    let relabel: { from: string; to: string } | null = null;
    if (rng.chance(0.2)) {
      const from = candidate[a]![faceA]!;
      const to = rng.pick([...ALPHABET].filter((letter) => letter !== 'q' && letter !== from));
      if (from === 'q') continue;
      if (counts.get(from)! - 1 < Math.max(1, targets.get(from)! - 1)) continue;
      if (counts.get(to)! + 1 > targets.get(to)! + 1) continue;
      candidate[a]![faceA] = to;
      relabel = { from, to };
    } else {
      const b = rng.int(0, cubeCount - 1);
      if (a === b) continue;
      const faceB = rng.int(0, 5);
      [candidate[a]![faceA], candidate[b]![faceB]] = [candidate[b]![faceB]!, candidate[a]![faceA]!];
    }
    if (!candidate.every(isWellFormed)) continue;
    const value = score(trie, size, candidate, rolls, frequencies.affinity, strongest);
    if (value >= current || rng.next() < Math.exp((value - current) / heat)) {
      cubes = candidate;
      current = value;
      if (relabel) {
        counts.set(relabel.from, counts.get(relabel.from)! - 1);
        counts.set(relabel.to, counts.get(relabel.to)! + 1);
      }
      if (value > best.value) best = { cubes: candidate.map((cube) => [...cube]), value };
    }
    if (step % 250 === 0)
      print(
        `  ${size}×${size} step ${step}: ${current.toFixed(4)} (best ${best.value.toFixed(4)})`,
      );
  }
  return best.cubes.map((cube) => [...cube].sort());
}

export interface Validation {
  mean: number;
  median: number;
  p5: number;
  p10: number;
  min: number;
  meanLong: number;
  meanLongest: number;
  vowelShare: number;
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
}

function validate(trie: Trie, size: GridSize, cubes: string[][]): Validation {
  const stats = fixedRolls(size, VALIDATION_ROLLS, 'validate').map((roll) =>
    rollStats(trie, size, cubes, roll),
  );
  const words = stats.map((s) => s.words).sort((a, b) => a - b);
  const faces = cubes.flat();
  return {
    mean: words.reduce((a, b) => a + b, 0) / words.length,
    median: percentile(words, 0.5),
    p5: percentile(words, 0.05),
    p10: percentile(words, 0.1),
    min: words[0]!,
    meanLong: stats.reduce((a, s) => a + s.long, 0) / stats.length,
    meanLongest: stats.reduce((a, s) => a + s.longest, 0) / stats.length,
    vowelShare: faces.filter((letter) => VOWELS.has(letter)).length / faces.length,
  };
}

/** The 1988 table, read from its C source for comparison only. */
function read1988Cubes(path: string): string[][] {
  const source = readFileSync(path, 'utf8');
  const table = /cubes\[16\]\s*=\s*\{([^}]*)\}/.exec(source)?.[1] ?? '';
  return [...table.matchAll(/"([a-z]{6})"/g)].map((match) => [...match[1]!]);
}

function describe(v: Validation): string {
  return `mean ${v.mean.toFixed(1)} words, median ${v.median}, 10th percentile ${v.p10}, 5th ${v.p5}, fewest ${v.min}; ${v.meanLong.toFixed(1)} of six letters or more; longest ${v.meanLongest.toFixed(1)} letters on average; vowels ${(100 * v.vowelShare).toFixed(1)} % of faces`;
}

function writeSets(sets: Map<GridSize, string[][]>, validations: Map<GridSize, Validation>) {
  const block = (size: GridSize) => {
    const cubes = sets.get(size)!.map((cube) => `'${cube.join('')}'`);
    const lines: string[] = [];
    for (let i = 0; i < cubes.length; i += 6)
      lines.push(`    ${cubes.slice(i, i + 6).join(', ')},`);
    return `  // ${describe(validations.get(size)!)}\n  ${size}: [\n${lines.join('\n')}\n  ],`;
  };
  writeFileSync(
    OUTPUT,
    `// Generated by scripts/design-cubes.ts. Do not edit by hand; rerun the script instead.
import type { GridSize } from './grid';

/**
 * Chain Letter's own letter cubes, one set per grid size, designed from the dictionary's letter
 * and bigram frequencies and tuned by simulation (method in docs/NOTES.md). Six faces per cube;
 * \`q\` is the \`Qu\` face. Figures below: ${VALIDATION_ROLLS} validation rolls, Classic rules.
 */
export const CUBE_SETS: Record<GridSize, readonly string[]> = {
${([4, 5, 6] as GridSize[]).map(block).join('\n')}
};
`,
  );
}

async function main(args: string[]) {
  const option = (name: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const sizes = (option('--sizes') ?? '4,5,6').split(',').map(Number) as GridSize[];
  const text = await inflateWordList(WORDS_DEFLATED);
  const trie = Trie.fromEncoded(text);
  const frequencies = measure(text);
  const ranked = [...frequencies.letters.entries()].sort((a, b) => b[1] - a[1]);
  print(
    `letters by weighted frequency: ${ranked.map(([l, v]) => `${l}:${v.toFixed(0)}`).join(' ')}`,
  );
  const pairs = [...frequencies.affinity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  print(`strongest pairs: ${pairs.map(([p, v]) => `${p}:${v.toFixed(0)}`).join(' ')}`);

  const sets = new Map<GridSize, string[][]>();
  const validations = new Map<GridSize, Validation>();
  for (const size of [4, 5, 6] as GridSize[]) {
    if (!sizes.includes(size)) {
      throw new Error('All three sizes are designed together so the generated file stays whole.');
    }
    const targets = faceTargets(frequencies.letters, size * size * 6);
    print(
      `${size}×${size} face targets: ${[...targets.entries()].map(([l, c]) => `${l}${c}`).join(' ')}`,
    );
    const iterations = Number(option('--iterations') ?? { 4: 4000, 5: 3000, 6: 2500 }[size]);
    const cubes = anneal(trie, size, frequencies, iterations, createRng(`cubes:${size}`));
    sets.set(size, cubes);
    validations.set(size, validate(trie, size, cubes));
    print(`${size}×${size}: ${describe(validations.get(size)!)}`);
    print(cubes.map((cube) => cube.join('')).join(' '));
  }
  const compare = option('--compare-1988');
  if (compare) {
    const old = read1988Cubes(compare);
    print(`1988 table on the same rolls: ${describe(validate(trie, 4, old))}`);
    const ours = new Set(sets.get(4)!.map((cube) => cube.join('')));
    const shared = old.filter((cube) => ours.has([...cube].sort().join('')));
    print(`cubes identical to a 1988 cube: ${shared.length}`);
  }
  writeSets(sets, validations);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) void main(process.argv.slice(2));
