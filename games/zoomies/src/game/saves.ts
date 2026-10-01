import type { GameContext, SaveSlot } from '@usr-games/kit';
import type { RoomTheme } from '../data/blueprints';

/** Everything Zoomies keeps on this device, in small versioned slots. */

export type Pace = 'calm' | 'brisk' | 'zippy';

export const PACE_FACTOR: Record<Pace, number> = { calm: 1.4, brisk: 1, zippy: 0.55 };

export interface Prefs {
  carefulPaws: boolean;
  whiskers: boolean;
  pace: Pace;
  coat: string;
  seenIntro: Partial<Record<RoomTheme, boolean>>;
}

export interface RoomRecord {
  stars: [boolean, boolean, boolean];
  bestTurns: number | null;
  tidy: boolean;
}

export interface HouseProgress {
  rooms: Partial<Record<RoomTheme, RoomRecord>>;
  lastRoom: RoomTheme | null;
}

export interface DailyRecord {
  outcome: 'cleared' | 'caught';
  turns: number;
  par: number;
  zooms: number;
  undos: number;
  /** Rivals finished behind, out of five (par included). */
  ahead: number;
}

export interface DailyProgress {
  days: Record<string, DailyRecord>;
}

export interface NightRecord {
  score: number;
  waves: number;
  dateKey: string;
  startWave: number;
}

export interface NightProgress {
  top: NightRecord[];
}

export interface LabProgress {
  best: { pattern: string; score: number } | null;
  runs: number;
}

export interface Saves {
  prefs: SaveSlot<Prefs>;
  house: SaveSlot<HouseProgress>;
  daily: SaveSlot<DailyProgress>;
  night: SaveSlot<NightProgress>;
  lab: SaveSlot<LabProgress>;
}

export function openSaves(context: Pick<GameContext, 'save'>): Saves {
  return {
    prefs: context.save<Prefs>({
      key: 'prefs',
      version: 1,
      defaults: () => ({
        carefulPaws: true,
        whiskers: true,
        pace: 'brisk',
        coat: 'ginger',
        seenIntro: {},
      }),
    }),
    house: context.save<HouseProgress>({
      key: 'house',
      version: 1,
      defaults: () => ({ rooms: {}, lastRoom: null }),
    }),
    daily: context.save<DailyProgress>({
      key: 'daily',
      version: 1,
      defaults: () => ({ days: {} }),
    }),
    night: context.save<NightProgress>({ key: 'night', version: 1, defaults: () => ({ top: [] }) }),
    lab: context.save<LabProgress>({
      key: 'lab',
      version: 1,
      defaults: () => ({ best: null, runs: 0 }),
    }),
  };
}

export function starsEarned(house: HouseProgress): number {
  let total = 0;
  for (const record of Object.values(house.rooms))
    total += record ? record.stars.filter(Boolean).length : 0;
  return total;
}

/** Keeps the better of two records for a room: more stars each, fewer turns. */
export function mergeRoomRecord(before: RoomRecord | undefined, after: RoomRecord): RoomRecord {
  if (!before) return after;
  const best = [before.bestTurns, after.bestTurns].filter((t): t is number => t !== null);
  return {
    stars: [
      before.stars[0] || after.stars[0],
      before.stars[1] || after.stars[1],
      before.stars[2] || after.stars[2],
    ],
    bestTurns: best.length ? Math.min(...best) : null,
    tidy: before.tidy || after.tidy,
  };
}

/** Records the night if it makes the top ten; returns its place (1-based) or null. */
export function addNight(
  progress: NightProgress,
  record: NightRecord,
): { progress: NightProgress; place: number | null } {
  const top = [...progress.top, record].sort((a, b) => b.score - a.score).slice(0, 10);
  const place = top.indexOf(record);
  return { progress: { top }, place: place >= 0 ? place + 1 : null };
}

/** Old daily records are trimmed so the slot stays small. */
export function addDaily(
  progress: DailyProgress,
  dateKey: string,
  record: DailyRecord,
): DailyProgress {
  const days = { ...progress.days };
  const existing = days[dateKey];
  // The first finish of the day is the one that counts; a later try only replaces a loss.
  if (!existing || (existing.outcome === 'caught' && record.outcome === 'cleared'))
    days[dateKey] = record;
  const keys = Object.keys(days).sort().slice(-60);
  return { days: Object.fromEntries(keys.map((k) => [k, days[k]!])) };
}
