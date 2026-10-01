import { describe, expect, it } from 'vitest';
import { applyResult, emptyProgression, syncWeek } from '@usr-games/kit/progression';
import type { GameManifest } from '@usr-games/kit/manifest';
import type { CatalogEntry } from '../catalog/catalog';
import { toGameInfo } from '../store/hall-store';
import { dailyPick, pidFor, processRows, shelves, sortRows, systemLine } from './home-model';

function entry(
  id: string,
  category: GameManifest['category'],
  status: GameManifest['status'],
  daily = false,
): CatalogEntry {
  const manifest = {
    id,
    title: id.toUpperCase(),
    category,
    status,
    daily,
    sessionMinutes: [3, 8],
    manPage: { synopsis: '', description: '', seeAlso: [] },
  } as unknown as GameManifest;
  return { manifest, source: 'placeholder', playPath: `play/${id}/` };
}

const ENTRIES = [
  entry('atc', 'arcade', 'shipped', true),
  entry('wump', 'strategy', 'shipped', true),
  entry('fish', 'cards', 'shipped'),
  entry('rain', 'toys', 'shipped'),
  entry('pom', 'toys', 'adopting'),
  entry('hack', 'stories', 'coming-soon'),
];
const TODAY = '2026-10-01';
const shipped = ENTRIES.filter((e) => e.manifest.status === 'shipped').map((e) =>
  toGameInfo(e.manifest),
);

describe('process rows', () => {
  it('maps statuses to ps states and gives stable pids', () => {
    const rows = processRows(ENTRIES, emptyProgression(), TODAY);
    expect(rows.map((r) => r.state)).toEqual(['R', 'R', 'R', 'R', 'D', 'S']);
    expect(pidFor('atc')).toBe(pidFor('atc'));
    expect(pidFor('atc')).toBeGreaterThanOrEqual(1000);
  });

  it('recommends runnable games first, open dailies and fresh games ahead of today’s repeats', () => {
    let state = syncWeek(emptyProgression(), { today: TODAY, shippedGames: shipped });
    state = applyResult(
      state,
      shipped[0]!,
      { outcome: 'win', presentation: 'hall', daily: true },
      { today: TODAY, shippedGames: shipped },
    ).state;
    const order = sortRows(processRows(ENTRIES, state, TODAY), 'recommended', TODAY).map(
      (r) => r.entry.manifest.id,
    );
    expect(order.indexOf('atc')).toBeGreaterThan(order.indexOf('wump'));
    expect(order.slice(-2)).toEqual(['pom', 'hack']);
  });

  it('sorts A–Z and by most recent play', () => {
    let state = emptyProgression();
    state = applyResult(
      state,
      shipped[2]!,
      { outcome: 'loss', presentation: 'hall' },
      { today: '2026-09-29', shippedGames: shipped },
    ).state;
    state = applyResult(
      state,
      shipped[1]!,
      { outcome: 'loss', presentation: 'hall' },
      { today: TODAY, shippedGames: shipped },
    ).state;
    const rows = processRows(ENTRIES, state, TODAY);
    expect(
      sortRows(rows, 'recent', TODAY)
        .slice(0, 2)
        .map((r) => r.entry.manifest.id),
    ).toEqual(['wump', 'fish']);
    expect(sortRows(rows, 'az', TODAY)[0]!.entry.manifest.id).toBe('atc');
  });
});

describe('shelves', () => {
  it('groups by directory in the recommended view and flattens otherwise', () => {
    const rows = processRows(ENTRIES, emptyProgression(), TODAY);
    expect(shelves(rows, null, 'recommended', TODAY).map((s) => s.label)).toEqual([
      '/usr/games/arcade',
      '/usr/games/strategy',
      '/usr/games/cards',
      '/usr/games/stories',
      '/usr/games/toys',
    ]);
    expect(shelves(rows, 'toys', 'recommended', TODAY)).toHaveLength(1);
    expect(shelves(rows, null, 'az', TODAY)[0]!.rows).toHaveLength(ENTRIES.length);
  });
});

describe('daily pick and system line', () => {
  it('picks the same runnable non-toy game for everyone today', () => {
    const rows = processRows(ENTRIES, emptyProgression(), TODAY);
    const pick = dailyPick(rows, TODAY);
    expect(pick?.state).toBe('R');
    expect(pick?.entry.manifest.category).not.toBe('toys');
    expect(dailyPick(rows, TODAY)).toBe(pick);
    expect(dailyPick(processRows([ENTRIES[5]!], emptyProgression(), TODAY), TODAY)).toBeNull();
  });

  it('counts processes and turns sessions into a load average', () => {
    let state = emptyProgression();
    for (let i = 0; i < 5; i++) {
      state = applyResult(
        state,
        shipped[i % 3]!,
        { outcome: 'loss', presentation: 'hall' },
        { today: TODAY, shippedGames: shipped },
      ).state;
    }
    const line = systemLine(processRows(ENTRIES, state, TODAY), state, TODAY);
    expect(line).toMatchObject({ total: 6, running: 4, arriving: 1, sleeping: 1, uptimeDays: 1 });
    expect(line.loadAverage[0]).toBe(0.5);
    expect(line.loadAverage[1]).toBe(0.1);
  });
});
