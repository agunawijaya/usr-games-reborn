import type { GameContext, SaveSlot } from '@usr-games/kit';
import type { Game } from '../engine/game';
import { BANK, emptyStatement, type Scoring, type Statement } from '../engine/ledger';
import type { RuleSet } from '../engine/rules';

/**
 * Everything Thirteen Down keeps on this device, each in its own versioned slot of the kit's
 * storage: preferences, records, the play-money account, the Daily Deal history, challenges,
 * and the deal in progress so it can be continued.
 */

export interface Prefs {
  scoring: Scoring;
  rules: RuleSet;
  winnableOnly: boolean;
  fourColour: boolean;
  sound: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  scoring: 'points',
  rules: 'standard',
  winnableOnly: false,
  fourColour: false,
  sound: true,
};

export interface RulesRecord {
  deals: number;
  wins: number;
  /** Points games only. */
  bestScore: number;
  /** Fastest win, 0 for none yet. */
  bestMs: number;
  /** Wins one after another, now and at best. */
  run: number;
  bestRun: number;
  cardsHome: number;
}

export interface Records {
  standard: RulesRecord;
  relaxed: RulesRecord;
  tutorialDone: boolean;
  /** Daily Deals played to the end, and won. */
  dailies: number;
  dailyWins: number;
}

export function emptyRulesRecord(): RulesRecord {
  return { deals: 0, wins: 0, bestScore: 0, bestMs: 0, run: 0, bestRun: 0, cardsHome: 0 };
}

const DEFAULT_RECORDS = (): Records => ({
  standard: emptyRulesRecord(),
  relaxed: emptyRulesRecord(),
  tutorialDone: false,
  dailies: 0,
  dailyWins: 0,
});

/** The play-money account, like the original's line in its shared score file. */
export interface BankBook {
  balance: number;
  lifetime: Statement;
  deals: number;
}

export const DEFAULT_BANK = (): BankBook => ({
  balance: BANK.openingBalance,
  lifetime: emptyStatement(),
  deals: 0,
});

export interface DailyRecord {
  number: number;
  won: boolean;
  cardsHome: number;
  ms: number;
  insight: number;
  score: number;
}

export interface ChallengeRecord {
  done: boolean;
  /** The most cards home in any try. */
  best: number;
}

export interface Current {
  game: Game;
  elapsedMs: number;
}

export interface Saves {
  prefs: SaveSlot<Prefs>;
  records: SaveSlot<Records>;
  bank: SaveSlot<BankBook>;
  daily: SaveSlot<Record<string, DailyRecord>>;
  challenges: SaveSlot<Record<string, ChallengeRecord>>;
  current: SaveSlot<Current | null>;
}

export function openSaves(context: GameContext): Saves {
  return {
    prefs: context.save({ key: 'prefs', version: 1, defaults: () => ({ ...DEFAULT_PREFS }) }),
    records: context.save({ key: 'records', version: 1, defaults: DEFAULT_RECORDS }),
    bank: context.save({ key: 'bank', version: 1, defaults: DEFAULT_BANK }),
    daily: context.save({ key: 'daily', version: 1, defaults: () => ({}) }),
    challenges: context.save({ key: 'challenges', version: 1, defaults: () => ({}) }),
    current: context.save<Current | null>({ key: 'current', version: 1, defaults: () => null }),
  };
}

function pickNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Saved preferences, any missing or broken field filled from the defaults. */
export function prefsFrom(value: Partial<Prefs> | null | undefined): Prefs {
  const v = value ?? {};
  return {
    scoring: v.scoring === 'bank' ? 'bank' : 'points',
    rules: v.rules === 'relaxed' ? 'relaxed' : 'standard',
    winnableOnly: v.winnableOnly === true,
    fourColour: v.fourColour === true,
    sound: v.sound !== false,
  };
}

function rulesRecordFrom(value: Partial<RulesRecord> | undefined): RulesRecord {
  const base = emptyRulesRecord();
  if (!value) return base;
  for (const key of Object.keys(base) as (keyof RulesRecord)[])
    base[key] = pickNumber(value[key], base[key]);
  return base;
}

export function recordsFrom(value: Partial<Records> | null | undefined): Records {
  const v = value ?? {};
  return {
    standard: rulesRecordFrom(v.standard),
    relaxed: rulesRecordFrom(v.relaxed),
    tutorialDone: v.tutorialDone === true,
    dailies: pickNumber(v.dailies, 0),
    dailyWins: pickNumber(v.dailyWins, 0),
  };
}

export function bankFrom(value: Partial<BankBook> | null | undefined): BankBook {
  const base = DEFAULT_BANK();
  if (!value) return base;
  const lifetime = emptyStatement();
  for (const key of Object.keys(lifetime) as (keyof Statement)[])
    lifetime[key] = pickNumber(value.lifetime?.[key], 0);
  return {
    balance: pickNumber(value.balance, base.balance),
    lifetime,
    deals: pickNumber(value.deals, 0),
  };
}

/** A saved deal is resumed only if it still looks like one. */
export function currentFrom(value: Current | null | undefined): Current | null {
  if (!value || typeof value !== 'object') return null;
  const game = value.game as Game | undefined;
  if (
    !game ||
    !Array.isArray(game.deal) ||
    game.deal.length !== 52 ||
    !game.layout ||
    game.ending !== null
  )
    return null;
  return { game, elapsedMs: pickNumber(value.elapsedMs, 0) };
}
