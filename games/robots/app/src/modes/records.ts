// Records on this device: the best runs of each mode, stars on the Grand Tour,
// the daily showdowns, and the trophy wall's stamps. Best effort, like the
// high scores: if storage is unavailable the game still plays.

import type { CallKind } from './calls';
import type { ModeId } from './plans';

const STORAGE_KEY = 'usr-games.robots.records.v1';
/** Where the remaster kept its top ten before the modes existed. */
const LEGACY_HIGH_SCORES = 'bsdgames.robots.fancy-web.highscores.v1';
const BEST_PER_MODE = 5;
const DAYS_KEPT = 60;

export type BestRun = Readonly<{ points: number; waves: number; chain: number; date: string; detail?: string }>;
export type TourRecord = Readonly<{ stars: readonly [boolean, boolean, boolean]; best: number }>;
export type ShowdownRecord = Readonly<{ points: number; waves: number; chain: number; rule: string }>;

export type Records = Readonly<{
  best: Readonly<Partial<Record<ModeId, readonly BestRun[]>>>;
  tour: Readonly<Record<string, TourRecord>>;
  /** The first finished showdown of each day: that is the one that counts. */
  showdowns: Readonly<Record<string, ShowdownRecord>>;
  stamps: Readonly<Partial<Record<CallKind, number>>>;
}>;

const EMPTY: Records = { best: {}, tour: {}, showdowns: {}, stamps: {} };

function isRecords(value: unknown): value is Records {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return ['best', 'tour', 'showdowns', 'stamps'].every((k) => typeof r[k] === 'object' && r[k] !== null);
}

/** The remaster's old top ten becomes the Exhibition's best runs (its scores had no crowd). */
function fromLegacy(): Records {
  try {
    const raw = localStorage.getItem(LEGACY_HIGH_SCORES);
    const old = raw ? (JSON.parse(raw) as unknown) : null;
    if (!Array.isArray(old)) return EMPTY;
    const runs = old
      .filter((e): e is { score: number; level: number; date: string } => typeof e?.score === 'number' && typeof e?.level === 'number' && typeof e?.date === 'string')
      .map((e) => ({ points: e.score, waves: e.level, chain: 0, date: e.date }))
      .sort((a, b) => b.points - a.points)
      .slice(0, BEST_PER_MODE);
    return runs.length ? { ...EMPTY, best: { exhibition: runs } } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function loadRecords(): Records {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fromLegacy();
    const parsed = JSON.parse(raw) as unknown;
    return isRecords(parsed) ? parsed : EMPTY;
  } catch {
    return EMPTY;
  }
}

function save(records: Records): Records {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Storage full, disabled or private: the records last for this visit only.
  }
  return records;
}

/** Adds a run to its mode's best five; returns the records and the run's place (or null). */
export function addBest(records: Records, mode: ModeId, run: BestRun): { records: Records; place: number | null } {
  const list = [...(records.best[mode] ?? []), run].sort((a, b) => b.points - a.points).slice(0, BEST_PER_MODE);
  const place = list.indexOf(run);
  return { records: save({ ...records, best: { ...records.best, [mode]: list } }), place: place >= 0 ? place + 1 : null };
}

export function addTourResult(records: Records, matchId: string, stars: readonly [boolean, boolean, boolean], points: number): Records {
  const before = records.tour[matchId];
  const merged: TourRecord = {
    stars: [before?.stars[0] || stars[0], before?.stars[1] || stars[1], before?.stars[2] || stars[2]],
    best: Math.max(before?.best ?? 0, stars[0] ? points : 0),
  };
  return save({ ...records, tour: { ...records.tour, [matchId]: merged } });
}

/** Records the day's showdown if none is recorded yet; later runs that day are practice. */
export function addShowdown(records: Records, dateKey: string, run: ShowdownRecord): { records: Records; official: boolean } {
  if (records.showdowns[dateKey]) return { records, official: false };
  const keys = [...Object.keys(records.showdowns), dateKey].sort().slice(-DAYS_KEPT);
  const showdowns = Object.fromEntries(keys.map((k) => [k, k === dateKey ? run : records.showdowns[k]]));
  return { records: save({ ...records, showdowns }), official: true };
}

export function addStamps(records: Records, kinds: readonly CallKind[]): Records {
  if (kinds.length === 0) return records;
  const stamps = { ...records.stamps };
  for (const kind of kinds) stamps[kind] = (stamps[kind] ?? 0) + 1;
  return save({ ...records, stamps });
}

export function tourStars(records: Records): number {
  return Object.values(records.tour).reduce((sum, r) => sum + r.stars.filter(Boolean).length, 0);
}

/** A match opens once the one before it has been won. */
export function tourUnlocked(records: Records, index: number, ids: readonly string[]): boolean {
  return index === 0 || Boolean(records.tour[ids[index - 1]]?.stars[0]);
}
