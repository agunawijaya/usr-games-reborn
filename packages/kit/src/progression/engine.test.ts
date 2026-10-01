import { describe, expect, it } from 'vitest';
import { COSMETICS, unlockedCosmetics } from './cosmetics';
import {
  acknowledgeRank,
  applyResult,
  type EngineContext,
  installGamePackage,
  pendingRankUp,
  recordLogin,
  recordManPageRead,
  recordStyleSeen,
  syncWeek,
} from './engine';
import { HALL_PACKAGES } from './hall-packages';
import { RANKS } from './ranks';
import { XP_RULES } from './rules';
import {
  emptyProgression,
  isProgressionState,
  PROGRESSION_MIGRATIONS,
  type ProgressionState,
} from './state';
import { LOSS, QUIT, TEST_CATALOG, TEST_GAMES, WIN } from './test-fixtures';

const MONDAY: EngineContext = { today: '2026-09-28', shippedGames: TEST_CATALOG };
const on = (today: string): EngineContext => ({ ...MONDAY, today });

function play(state: ProgressionState, gameId: string, result = LOSS, context = MONDAY) {
  return applyResult(state, TEST_GAMES[gameId]!, result, context);
}

describe('applyResult', () => {
  it('awards a session, the first win of the day and the first-process package', () => {
    const update = play(emptyProgression(), 'wump', WIN);
    expect(update.lines.map((l) => l.source)).toEqual(['session', 'first-win', 'package']);
    expect(update.packagesInstalled).toEqual(['hall/first-process']);
    expect(update.state.xp).toBe(update.xpGained);
    expect(update.state.games.wump).toMatchObject({
      sessions: 1,
      completed: 1,
      wins: 1,
      bestScore: 100,
    });
    expect(update.state.streak.current).toBe(1);
  });

  it('gives the first-win bonus once per game per day', () => {
    const first = play(emptyProgression(), 'wump', WIN);
    const second = play(first.state, 'wump', WIN);
    expect(second.lines.map((l) => l.source)).toEqual(['session']);
    const tomorrow = play(second.state, 'wump', WIN, on('2026-09-29'));
    expect(tomorrow.lines.map((l) => l.source)).toContain('first-win');
  });

  it('makes variety the fastest path by fading repeat sessions', () => {
    let state = play(emptyProgression(), 'fish').state;
    const repeats: number[] = [];
    for (let i = 0; i < 6; i++) {
      const update = play(state, 'fish');
      repeats.push(update.lines.find((l) => l.source === 'session')?.xp ?? 0);
      state = update.state;
    }
    expect(repeats[0]).toBe(repeats[1]);
    expect(repeats[2]).toBeLessThan(repeats[1]!);
    expect(repeats[5]).toBeLessThan(repeats[3]!);
    const fresh = play(state, 'hangman').lines.find((l) => l.source === 'session')!.xp;
    expect(fresh).toBeGreaterThan(repeats[5]!);
  });

  it('pays toys once a day, however long they run', () => {
    let state = emptyProgression();
    const earned: number[] = [];
    for (let i = 0; i < 3; i++) {
      const update = play(state, 'rain', {
        outcome: 'complete',
        presentation: 'hall',
        durationSeconds: 3600,
      });
      earned.push(update.lines.filter((l) => l.source === 'session').reduce((s, l) => s + l.xp, 0));
      state = update.state;
    }
    expect(earned).toEqual([XP_RULES.toySession, 0, 0]);
  });

  it('pays nothing for a quit, but still records the session', () => {
    const update = play(emptyProgression(), 'wump', QUIT);
    expect(update.xpGained).toBe(0);
    expect(update.state.games.wump).toMatchObject({ sessions: 1, completed: 0 });
    expect(update.state.streak.current).toBe(0);
  });

  it('counts the daily challenge once per game per day', () => {
    const first = play(emptyProgression(), 'wump', { ...LOSS, daily: true });
    expect(first.lines.map((l) => l.source)).toContain('daily');
    expect(first.packagesInstalled).toContain('hall/daily-driver');
    const again = play(first.state, 'wump', { ...LOSS, daily: true });
    expect(again.lines.map((l) => l.source)).not.toContain('daily');
    const notDaily = play(emptyProgression(), 'fish', { ...LOSS, daily: true });
    expect(notDaily.lines.map((l) => l.source)).not.toContain('daily');
  });

  it('slows play XP beyond the soft ceiling', () => {
    let state = emptyProgression();
    for (let i = 0; i < 60; i++) {
      for (const id of ['atc', 'wump', 'fish', 'hangman', 'adventure']) {
        state = play(state, id, WIN).state;
      }
    }
    expect(state.days['2026-09-28']!.playXp).toBeLessThan(XP_RULES.dailySoftCap * 1.5);
  });

  it('accumulates game counters and advances cron jobs', () => {
    let state = syncWeek(emptyProgression(), MONDAY);
    expect(state.cron.jobs).toHaveLength(3);
    const update = play(state, 'atc', { ...WIN, stats: { planesLanded: 7 } });
    state = update.state;
    expect(state.games.atc!.counters.planesLanded).toBe(7);
    expect(state.cron.week).toBe('2026-W40');
  });

  it('rolls the crontab into history when the week changes, without taking anything away', () => {
    let state = syncWeek(emptyProgression(), MONDAY);
    state = play(state, 'fish').state;
    const xp = state.xp;
    state = syncWeek(state, on('2026-10-05'));
    expect(state.cron.week).toBe('2026-W41');
    expect(state.cron.history).toHaveLength(1);
    expect(state.xp).toBe(xp);
  });

  it('fills an empty crontab later in the week once games ship', () => {
    let state = syncWeek(emptyProgression(), { today: '2026-09-28', shippedGames: [] });
    expect(state.cron.jobs).toEqual([]);
    state = syncWeek(state, { today: '2026-09-30', shippedGames: TEST_CATALOG });
    expect(state.cron.jobs).toHaveLength(3);
  });
});

describe('Hall packages', () => {
  it('ships ten collection-wide packages', () => {
    expect(HALL_PACKAGES.length).toBeGreaterThanOrEqual(9);
    expect(HALL_PACKAGES.length).toBeLessThanOrEqual(12);
  });

  it('installs hello-world, read-the-manual and window-shopping from Hall activity', () => {
    let state = recordLogin(emptyProgression(), MONDAY).state;
    expect(state.packages['hall/hello-world']).toBeDefined();
    for (const id of ['atc', 'wump', 'fish', 'hangman', 'atc', 'rain'])
      state = recordManPageRead(state, id, MONDAY).state;
    expect(state.hall.manPagesRead).toHaveLength(5);
    expect(state.packages['hall/read-the-manual']).toBeDefined();
    for (const style of ['console', 'holo'] as const)
      state = recordStyleSeen(state, style, MONDAY).state;
    expect(state.packages['hall/window-shopping']).toBeUndefined();
    state = recordStyleSeen(state, 'machine-room', MONDAY).state;
    expect(state.packages['hall/window-shopping']).toBeDefined();
    const cosmetics = unlockedCosmetics(state).map((c) => c.id);
    expect(cosmetics).toContain('banner-postcard');
  });

  it('installs seven-days-up after a week of play', () => {
    let state = emptyProgression();
    for (let day = 0; day < 7; day++)
      state = play(state, 'hangman', LOSS, on(`2026-10-0${day + 1}`)).state;
    expect(state.streak.current).toBe(7);
    expect(state.packages['hall/seven-days-up']).toBeDefined();
  });
});

describe('game packages and ranks', () => {
  it('installs a game package once', () => {
    const definition = {
      id: 'first-landing',
      title: 'First landing',
      description: 'Land a plane.',
      tier: 'core' as const,
    };
    const first = installGamePackage(emptyProgression(), 'atc', definition, MONDAY);
    expect(first.packagesInstalled).toEqual(['atc/first-landing']);
    expect(first.xpGained).toBe(30);
    const again = installGamePackage(first.state, 'atc', definition, MONDAY);
    expect(again.xpGained).toBe(0);
  });

  it('reports a pending rank-up until it is celebrated', () => {
    const state = { ...emptyProgression(), xp: RANKS[2]!.threshold };
    expect(pendingRankUp(state)).toEqual({ from: 'guest', to: 'staff' });
    const celebrated = acknowledgeRank(state);
    expect(pendingRankUp(celebrated)).toBeNull();
    expect(unlockedCosmetics(celebrated).length).toBeGreaterThan(
      unlockedCosmetics(emptyProgression()).length,
    );
  });

  it('keeps every cosmetic reachable, and the closet behind root', () => {
    const closet = COSMETICS.find((c) => c.id === 'room-server-closet')!;
    expect(closet.source).toEqual({ rank: 'root' });
  });
});

describe('state', () => {
  it('stays JSON-serialisable and recognisable after heavy use', () => {
    let state = recordLogin(emptyProgression(), MONDAY).state;
    for (const id of Object.keys(TEST_GAMES)) state = play(state, id, WIN).state;
    const revived: unknown = JSON.parse(JSON.stringify(state));
    expect(isProgressionState(revived)).toBe(true);
    expect(revived).toEqual(state);
  });
});

describe('migrations', () => {
  it('moves a version 1 save forward, keeping everything it earned', () => {
    const { stylesSeen: _stylesSeen, ...hall } = emptyProgression().hall;
    const v1 = { ...emptyProgression(), version: 1, xp: 420, hall };
    const v2 = PROGRESSION_MIGRATIONS[2](v1);
    expect(isProgressionState(v2)).toBe(true);
    expect(v2).toMatchObject({ version: 2, xp: 420, hall: { stylesSeen: ['machine-room'] } });
  });
});
