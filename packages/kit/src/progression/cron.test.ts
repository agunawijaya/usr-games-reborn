import { describe, expect, it } from 'vitest';
import { advanceCronJobs, type CronJob, generateCronJobs, JOBS_PER_WEEK } from './cron';
import { TEST_CATALOG, TEST_GAMES, WIN } from './test-fixtures';

describe('generateCronJobs', () => {
  it('is deterministic for a week and changes between weeks', () => {
    const a = generateCronJobs('2026-W40', TEST_CATALOG);
    expect(generateCronJobs('2026-W40', TEST_CATALOG)).toEqual(a);
    const weeks = ['2026-W41', '2026-W42', '2026-W43'].map((w) =>
      JSON.stringify(generateCronJobs(w, TEST_CATALOG).map((j) => j.label)),
    );
    expect(new Set([JSON.stringify(a.map((j) => j.label)), ...weeks]).size).toBeGreaterThan(1);
  });

  it('picks three jobs across different games, directories and kinds', () => {
    for (let week = 1; week <= 52; week++) {
      const jobs = generateCronJobs(`2026-W${String(week).padStart(2, '0')}`, TEST_CATALOG);
      expect(jobs).toHaveLength(JOBS_PER_WEEK);
      const categories = jobs.map((j) => j.category).filter(Boolean);
      const games = jobs.map((j) => j.gameId).filter(Boolean);
      expect(new Set(categories).size).toBe(categories.length);
      expect(new Set(games).size).toBe(games.length);
      for (const job of jobs) {
        expect(job.target).toBeGreaterThan(0);
        expect(job.label).not.toMatch(/undefined|NaN/);
        expect(job.command).toMatch(/^\d+ \d+ \* \* \d /);
      }
    }
  });

  it('only points at shipped games', () => {
    const shipped = [TEST_GAMES.atc!, TEST_GAMES.wump!];
    for (let week = 10; week < 30; week++) {
      for (const job of generateCronJobs(`2026-W${week}`, shipped)) {
        if (job.gameId) expect(['atc', 'wump']).toContain(job.gameId);
        if (job.category) expect(['arcade', 'strategy']).toContain(job.category);
      }
    }
  });

  it('returns an empty crontab when nothing has shipped yet', () => {
    expect(generateCronJobs('2026-W40', [])).toEqual([]);
  });
});

describe('advanceCronJobs', () => {
  it('counts matching sessions, wins, goals, variety and dailies', () => {
    const jobs: CronJob[] = [
      {
        id: '1',
        kind: 'category-sessions',
        label: '',
        command: '',
        target: 2,
        progress: 0,
        done: false,
        category: 'arcade',
      },
      {
        id: '2',
        kind: 'game-goal',
        label: '',
        command: '',
        target: 20,
        progress: 0,
        done: false,
        gameId: 'atc',
        stat: 'planesLanded',
      },
      {
        id: '3',
        kind: 'variety',
        label: '',
        command: '',
        target: 2,
        progress: 0,
        done: false,
        seen: [],
      },
      { id: '4', kind: 'dailies', label: '', command: '', target: 1, progress: 0, done: false },
      {
        id: '5',
        kind: 'category-wins',
        label: '',
        command: '',
        target: 1,
        progress: 0,
        done: false,
        category: 'cards',
      },
    ];
    let state = advanceCronJobs(jobs, {
      game: TEST_GAMES.atc!,
      result: { ...WIN, stats: { planesLanded: 12 } },
      countsAsDaily: true,
    });
    expect(state.jobs.map((j) => j.progress)).toEqual([1, 12, 1, 1, 0]);
    expect(state.completed.map((j) => j.id)).toEqual(['4']);

    state = advanceCronJobs(state.jobs, {
      game: TEST_GAMES.atc!,
      result: { ...WIN, stats: { planesLanded: 12 } },
      countsAsDaily: false,
    });
    expect(state.jobs.map((j) => j.progress)).toEqual([2, 20, 1, 1, 0]);
    expect(state.completed.map((j) => j.id)).toEqual(['1', '2']);

    state = advanceCronJobs(state.jobs, {
      game: TEST_GAMES.fish!,
      result: WIN,
      countsAsDaily: false,
    });
    expect(state.jobs.every((j) => j.done)).toBe(true);
  });

  it('does not let a toy count toward variety', () => {
    const jobs = [
      {
        id: '1',
        kind: 'variety' as const,
        label: '',
        command: '',
        target: 2,
        progress: 0,
        done: false,
        seen: [],
      },
    ];
    const next = advanceCronJobs(jobs, {
      game: TEST_GAMES.rain!,
      result: { outcome: 'complete', presentation: 'hall' },
      countsAsDaily: false,
    });
    expect(next.jobs[0]!.progress).toBe(0);
  });
});
