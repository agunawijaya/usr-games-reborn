import type { Tier } from '../dictionary/tiers';
import type { GridSize } from '../engine/grid';
import type { HunterFind, Strength } from '../engine/hunter';
import type { FoundWord } from '../engine/round';
import { coverage } from '../engine/score';
import { countsTowardsLevel, type RoundPlan } from './modes';
import type { PackageId } from './packages';

/**
 * What Chain Letter remembers between rounds, and the pure rules that update it. The
 * board-reading level is the 1988 program's running average: every word found over every word
 * there was, pooled across counted rounds.
 */

export interface SetupRecord {
  boards: number;
  bestCoverage: number;
  bestScore: number;
}

export interface DailyRecord {
  found: number;
  total: number;
  score: number;
  longest: string;
  /** Found words by length band: 3–4, 5–6, 7 and more, out of the board's words in each band. */
  bands: readonly [number, number, number];
  bandTotals: readonly [number, number, number];
}

export interface Records {
  /** Pooled totals over rounds that count towards the level. */
  level: { found: number; total: number; boards: number };
  /** The level after the first three counted boards, the base for the climber package. */
  firstLevel: number | null;
  /** Keyed by size, rule and shortest word: `4-classic-3`. */
  setups: Record<string, SetupRecord>;
  rounds: number;
  wordsFound: number;
  longestWord: string;
  bestChain: number;
  dailies: Record<string, DailyRecord>;
  duels: Record<string, { played: number; won: number }>;
  tutorialDone: boolean;
}

export const LEVEL_BOARDS_NEEDED = 3;
/** The level that opens each larger grid. */
export const UNLOCK_LEVEL: Record<GridSize, number> = { 4: 0, 5: 0.25, 6: 0.35 };

export function emptyRecords(): Records {
  return {
    level: { found: 0, total: 0, boards: 0 },
    firstLevel: null,
    setups: {},
    rounds: 0,
    wordsFound: 0,
    longestWord: '',
    bestChain: 1,
    dailies: {},
    duels: {},
    tutorialDone: false,
  };
}

/** Fills anything an older or damaged save lacks, so the game never trips over its own data. */
export function sanitizeRecords(value: Partial<Records> | null | undefined): Records {
  const base = emptyRecords();
  if (!value || typeof value !== 'object') return base;
  return {
    ...base,
    ...value,
    level: { ...base.level, ...(value.level ?? {}) },
    setups: { ...(value.setups ?? {}) },
    dailies: { ...(value.dailies ?? {}) },
    duels: { ...(value.duels ?? {}) },
  };
}

export function setupKey(plan: Pick<RoundPlan, 'size' | 'rule' | 'minLetters'>): string {
  return `${plan.size}-${plan.rule}-${plan.minLetters}`;
}

/** The board-reading level, 0–1, once enough boards have been read; null before. */
export function readingLevel(records: Records): number | null {
  const { found, total, boards } = records.level;
  return boards >= LEVEL_BOARDS_NEEDED && total > 0 ? found / total : null;
}

export function sizeUnlocked(records: Records, size: GridSize): boolean {
  if (size === 4) return true;
  const level = readingLevel(records);
  return level !== null && level >= UNLOCK_LEVEL[size];
}

export interface RoundOutcome {
  plan: RoundPlan;
  found: readonly FoundWord[];
  /** Words on the board under the round's rule. */
  total: number;
  score: number;
  bestChain: number;
  /** Counts per length band of the board's words, for the daily share. */
  bandTotals: readonly [number, number, number];
  /** Seconds the round ran. */
  elapsed: number;
  hunter?: { finds: readonly HunterFind[]; score: number; strength: Strength };
}

export function lengthBand(word: string): 0 | 1 | 2 {
  if (word.length <= 4) return 0;
  if (word.length <= 6) return 1;
  return 2;
}

export function duelWon(outcome: RoundOutcome): boolean {
  return outcome.hunter !== undefined && outcome.score > outcome.hunter.score;
}

/** Folds a finished round into the records and lists the packages it earned. */
export function recordRound(
  records: Records,
  outcome: RoundOutcome,
  dateKey: string,
): { records: Records; earned: PackageId[] } {
  const { plan, found, total, score } = outcome;
  const share = coverage(found.length, total);
  const timed = plan.seconds !== null && plan.mode !== 'tutorial';
  const earned: PackageId[] = [];
  const next: Records = {
    ...records,
    level: { ...records.level },
    setups: { ...records.setups },
    dailies: { ...records.dailies },
    duels: { ...records.duels },
  };

  next.rounds += 1;
  next.wordsFound += found.length;
  next.bestChain = Math.max(next.bestChain, outcome.bestChain);
  for (const entry of found)
    if (entry.word.length > next.longestWord.length) next.longestWord = entry.word;

  if (plan.mode !== 'tutorial') {
    const key = setupKey(plan);
    const setup = next.setups[key] ?? { boards: 0, bestCoverage: 0, bestScore: 0 };
    next.setups[key] = {
      boards: setup.boards + 1,
      bestCoverage: Math.max(setup.bestCoverage, share),
      bestScore: Math.max(setup.bestScore, score),
    };
  }

  if (countsTowardsLevel(plan)) {
    next.level = {
      found: next.level.found + found.length,
      total: next.level.total + total,
      boards: next.level.boards + 1,
    };
    if (next.firstLevel === null && next.level.boards >= LEVEL_BOARDS_NEEDED) {
      next.firstLevel = readingLevel(next);
    }
  }

  if (plan.mode === 'daily' && !next.dailies[dateKey]) {
    const bands: [number, number, number] = [0, 0, 0];
    for (const entry of found) bands[lengthBand(entry.word)]++;
    next.dailies[dateKey] = {
      found: found.length,
      total,
      score,
      longest: found.reduce(
        (best, entry) => (entry.word.length > best.length ? entry.word : best),
        '',
      ),
      bands,
      bandTotals: outcome.bandTotals,
    };
  }

  if (plan.mode === 'duel' && outcome.hunter) {
    const key = String(outcome.hunter.strength);
    const duel = next.duels[key] ?? { played: 0, won: 0 };
    next.duels[key] = { played: duel.played + 1, won: duel.won + (duelWon(outcome) ? 1 : 0) };
    if (outcome.hunter.strength === 5 && duelWon(outcome)) earned.push('beat-the-hunter');
  }
  if (plan.mode === 'tutorial') next.tutorialDone = true;

  if (timed && share >= 0.5) earned.push('coverage-50');
  if (timed && share >= 0.75) earned.push('coverage-75');
  if (plan.rule === 'echo' && share >= 1 / 3) earned.push('echo-master');
  if (plan.rule === 'mirror' && share >= 1 / 3) earned.push('mirror-master');
  if (timed && plan.size === 6) earned.push('mega-grid');
  if (Object.keys(next.dailies).length >= 7) earned.push('daily-regular');
  const levelAfter = readingLevel(next);
  if (next.firstLevel !== null && levelAfter !== null && levelAfter - next.firstLevel >= 0.1) {
    earned.push('average-climber');
  }
  return { records: next, earned };
}

/** Packages a single find can earn on the spot, mid-round. */
export function packagesForFind(entry: FoundWord, faces: readonly string[]): PackageId[] {
  const earned: PackageId[] = ['first-chain'];
  if (entry.word.length >= 8) earned.push('eight-letters');
  if (entry.comboLevel >= 3) earned.push('combo-x3');
  if (entry.path.some((cube) => faces[cube] === 'qu')) earned.push('qu-word');
  return earned;
}

/** The word book: every word ever found, with its rarity tier. */
export interface WordBook {
  words: Record<string, Tier>;
}

export function emptyBook(): WordBook {
  return { words: {} };
}

/** Adds a round's words; returns the new book and the words that were new to it. */
export function addToBook(
  book: WordBook,
  found: readonly { word: string; tier: Tier }[],
): { book: WordBook; added: { word: string; tier: Tier }[] } {
  const added = found.filter(({ word }) => book.words[word] === undefined);
  if (added.length === 0) return { book, added };
  const words = { ...book.words };
  for (const { word, tier } of added) words[word] = tier;
  return { book: { words }, added };
}

export function bookCounts(book: WordBook): {
  byTier: number[];
  byInitial: Record<string, number[]>;
} {
  const byTier = [0, 0, 0, 0];
  const byInitial: Record<string, number[]> = {};
  for (const [word, tier] of Object.entries(book.words)) {
    byTier[tier]!++;
    (byInitial[word[0]!] ??= [0, 0, 0, 0])[tier]!++;
  }
  return { byTier, byInitial };
}
