import { addDays, createRng, type DateKey, hashString } from '@usr-games/kit';
import { CATEGORIES, type Category } from '@usr-games/kit/manifest';
import { type CronJob, type ProgressionState, streakAsOf } from '@usr-games/kit/progression';
import type { CatalogEntry } from '../catalog/catalog';
import type { SortMode } from '../router';

/**
 * Everything the Home screen shows, computed from the catalog and the player's state with no
 * DOM involved: the process table, the daily pick, the crontab and the `top` header numbers.
 */

/** `ps` process states: running, arriving (still being copied in), sleeping. */
export type ProcessState = 'R' | 'D' | 'S';

export interface ProcessRow {
  entry: CatalogEntry;
  state: ProcessState;
  pid: number;
  bestScore: number | null;
  lastPlayed: DateKey | null;
  dailyOpen: boolean;
  wantedByCron: boolean;
}

export interface Shelf {
  key: string;
  label: string;
  category: Category | null;
  rows: ProcessRow[];
}

export function processState(entry: CatalogEntry): ProcessState {
  switch (entry.manifest.status) {
    case 'shipped':
      return 'R';
    case 'adopting':
      return 'D';
    default:
      return 'S';
  }
}

/** Stable, plausible-looking process ids, derived from the game id. */
export function pidFor(id: string): number {
  return 1000 + (hashString(`pid:${id}`) % 8000);
}

function jobWants(job: CronJob, entry: CatalogEntry): boolean {
  if (job.done) return false;
  if (job.gameId) return job.gameId === entry.manifest.id;
  if (job.category) return job.category === entry.manifest.category;
  return entry.manifest.category !== 'toys';
}

export function processRows(
  entries: readonly CatalogEntry[],
  state: ProgressionState,
  today: DateKey,
): ProcessRow[] {
  const dailiesToday = state.days[today]?.dailies ?? [];
  return entries.map((entry) => {
    const stats = state.games[entry.manifest.id];
    const running = processState(entry) === 'R';
    return {
      entry,
      state: processState(entry),
      pid: pidFor(entry.manifest.id),
      bestScore: stats?.bestScore ?? null,
      lastPlayed: stats?.lastPlayed ?? null,
      dailyOpen: running && entry.manifest.daily && !dailiesToday.includes(entry.manifest.id),
      wantedByCron: running && state.cron.jobs.some((job) => jobWants(job, entry)),
    };
  });
}

/**
 * Recommended order: games you can run first; within those, open dailies, cron targets and
 * games you have not touched lately; then games that are arriving, then the sleeping ones.
 */
export function recommendationScore(row: ProcessRow, today: DateKey): number {
  let score = { R: 100, D: 20, S: 0 }[row.state];
  if (row.state !== 'R') return score;
  if (row.dailyOpen) score += 15;
  if (row.wantedByCron) score += 12;
  if (row.lastPlayed === null) score += 8;
  else if (row.lastPlayed === today) score -= 10;
  return score;
}

export function sortRows(
  rows: readonly ProcessRow[],
  mode: SortMode,
  today: DateKey,
): ProcessRow[] {
  const order = new Map(rows.map((row, index) => [row, index]));
  const byCatalog = (a: ProcessRow, b: ProcessRow) => (order.get(a) ?? 0) - (order.get(b) ?? 0);
  const sorted = [...rows];
  switch (mode) {
    case 'az':
      return sorted.sort((a, b) =>
        a.entry.manifest.title.localeCompare(b.entry.manifest.title, 'en'),
      );
    case 'recent':
      return sorted.sort((a, b) => {
        if (a.lastPlayed === b.lastPlayed) return byCatalog(a, b);
        if (a.lastPlayed === null) return 1;
        if (b.lastPlayed === null) return -1;
        return a.lastPlayed < b.lastPlayed ? 1 : -1;
      });
    default:
      return sorted.sort(
        (a, b) => recommendationScore(b, today) - recommendationScore(a, today) || byCatalog(a, b),
      );
  }
}

/**
 * The process table as shelves. With every directory showing and the recommended order, games
 * sit on one shelf per directory, like racks in a machine room; any other view is one shelf.
 */
export function shelves(
  rows: readonly ProcessRow[],
  dir: Category | null,
  mode: SortMode,
  today: DateKey,
): Shelf[] {
  const visible = dir ? rows.filter((row) => row.entry.manifest.category === dir) : rows;
  if (dir || mode !== 'recommended') {
    const label = dir
      ? `/usr/games/${dir}`
      : mode === 'recent'
        ? 'ps --sort=recent'
        : 'ls /usr/games';
    return [{ key: dir ?? mode, label, category: dir, rows: sortRows(visible, mode, today) }];
  }
  return CATEGORIES.map((category) => ({
    key: category,
    label: `/usr/games/${category}`,
    category,
    rows: sortRows(
      visible.filter((row) => row.entry.manifest.category === category),
      mode,
      today,
    ),
  })).filter((shelf) => shelf.rows.length > 0);
}

/**
 * Today's crontab: one shipped game picked for everyone on the same day, leaning toward games
 * with a daily challenge and away from what the player ran in the last few days.
 */
export function dailyPick(rows: readonly ProcessRow[], today: DateKey): ProcessRow | null {
  const running = rows.filter((row) => row.state === 'R' && row.entry.manifest.category !== 'toys');
  if (running.length === 0) return null;
  const recently = addDays(today, -3);
  const rng = createRng(`daily-pick:${today}`);
  return rng.weighted(
    running.map((row) => ({
      value: row,
      weight:
        (row.entry.manifest.daily ? 3 : 1) *
        (row.lastPlayed && row.lastPlayed >= recently ? 0.5 : 1),
    })),
  );
}

export interface SystemLine {
  uptimeDays: number;
  loadAverage: [number, number, number];
  total: number;
  running: number;
  arriving: number;
  sleeping: number;
}

/** `top`'s first line, from real play: load average is sessions a day over 1, 5 and 15 days. */
export function systemLine(
  rows: readonly ProcessRow[],
  state: ProgressionState,
  today: DateKey,
): SystemLine {
  const sessionsOn = (day: DateKey) =>
    Object.values(state.days[day]?.sessions ?? {}).reduce((sum, count) => sum + count, 0);
  const average = (days: number) => {
    let total = 0;
    for (let i = 0; i < days; i++) total += sessionsOn(addDays(today, -i));
    return Math.round((total / days / 10) * 100) / 100;
  };
  return {
    uptimeDays: streakAsOf(state.streak, today),
    loadAverage: [average(1), average(5), average(15)],
    total: rows.length,
    running: rows.filter((row) => row.state === 'R').length,
    arriving: rows.filter((row) => row.state === 'D').length,
    sleeping: rows.filter((row) => row.state === 'S').length,
  };
}
