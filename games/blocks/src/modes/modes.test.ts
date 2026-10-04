import { dailySeed } from '@usr-games/kit';
import { describe, expect, it } from 'vitest';
import { playSteps, type Step } from '../engine/bot';
import { createGame, fall, type Game, type GameEvent, plunge } from '../engine/game';
import { createRng } from '@usr-games/kit';
import { withRun } from '../app/saves';
import {
  bubbleString,
  DAILY_SINKERS,
  dailyBubbles,
  dailyFirstSinkers,
  dailyGame,
  dailyName,
  dailyOver,
  dailyPar,
  dailyPlan,
  dailyShareText,
} from './daily';
import { type Finish, packagesAtTheEnd, packagesForBurst, PACKAGES } from './packages';
import { Tutorial } from './tutorial';

describe('the Daily Dive', () => {
  const seed = dailySeed('blocks', '2026-10-02');

  it('gives everyone the same sinkers on a day, and other ones the next day', () => {
    expect(dailyPlan(seed)).toEqual(dailyPlan(dailySeed('blocks', '2026-10-02')));
    expect(dailyPlan(seed)).not.toEqual(dailyPlan(dailySeed('blocks', '2026-10-03')));
    expect(dailyName(seed)).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });

  it('plays its sinkers in the order the page shows them', () => {
    const game = dailyGame(seed);
    const first = dailyFirstSinkers(seed, 3);
    expect(game.form).toBe(first[0]);
    expect(game.next).toBe(first[1]);
    plunge(game);
    expect(game.form).toBe(first[1]);
    expect(game.next).toBe(first[2]);
  });

  it('ends after a hundred sinkers have landed', () => {
    const game = dailyGame(seed);
    // A plain tank fills long before a hundred plunges straight down the middle.
    for (let i = 0; i < 300 && !dailyOver(game); i++) plunge(game);
    expect(game.over || game.landings === DAILY_SINKERS).toBe(true);
  });

  it('sets par by the house diver, the same every time', () => {
    expect(dailyPar(seed)).toBeGreaterThan(0);
    expect(dailyPar(seed)).toBe(dailyPar(seed));
  });

  it('earns bubbles at half of par, three quarters and par', () => {
    expect([0, 499, 500, 749, 750, 999, 1000, 2000].map((s) => dailyBubbles(s, 1000))).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3,
    ]);
  });

  it('shares one line with the number, score, deepest combo and bubbles, and no link', () => {
    const text = dailyShareText(42, { score: 18240, bestCombo: 7, rows: 40, bubbles: 3 });
    expect(text).toBe('Sinkers #42 · 18,240 · deepest combo ×7 · 🫧🫧🫧');
    expect(dailyShareText(3, { score: 120, bestCombo: 1, rows: 1, bubbles: 1 })).toBe(
      `Sinkers #3 · 120 · no combo yet · ${bubbleString(1)}`,
    );
    expect(text).not.toMatch(/https?:|www\./);
  });
});

describe('the tutorial', () => {
  function keys(tutorial: Tutorial, steps: Step[]): GameEvent[] {
    const events = playSteps(tutorial.game, steps);
    tutorial.after(events);
    return events;
  }

  it('moves on through its three lessons when each is done as it asks', () => {
    const tutorial = new Tutorial();
    expect(tutorial.lesson).toBe('slide');
    // The tee is over the gap already: two turns, and sink it in.
    playSteps(tutorial.game, ['turnLeft', 'turnLeft']);
    const settle = (game: Game) => {
      const events: GameEvent[] = [];
      for (let i = 0; i < 40 && !events.some((e) => e.kind === 'landed'); i++)
        events.push(...fall(game));
      return events;
    };
    tutorial.after(settle(tutorial.game));
    expect(tutorial.lesson).toBe('plunge');
    keys(tutorial, ['plunge']);
    expect(tutorial.lesson).toBe('four');
    keys(tutorial, ['turnLeft', ...Array<Step>(6).fill('right'), 'plunge']);
    expect(tutorial.lesson).toBe('done');
  });

  it('sets a lesson up again after a miss, with a hint', () => {
    const tutorial = new Tutorial();
    keys(tutorial, ['plunge']);
    expect(tutorial.lesson).toBe('slide');
    expect(tutorial.hint).toMatch(/Turn it twice/);
  });
});

describe('the packages', () => {
  const game = (): Game =>
    createGame({ rules: 'standard', width: 11, height: 18, level: 1, random: createRng('p') });

  it('are twelve, each with an id of its own', () => {
    expect(PACKAGES).toHaveLength(12);
    expect(new Set(PACKAGES.map((p) => p.id)).size).toBe(12);
  });

  it('come with bursts: the first, four at once, a deep combo, three sinkers in a row', () => {
    const g = game();
    expect(packagesForBurst({ rows: [17], points: 10, combo: 1 }, g)).toEqual(['first-burst']);
    g.burstChain = 3;
    expect(packagesForBurst({ rows: [14, 15, 16, 17], points: 500, combo: 5 }, g)).toEqual([
      'first-burst',
      'four-row-burst',
      'depth-combo-5',
      'bubble-chain',
    ]);
  });

  it('come at the end: steady hands, the night, left turns only, Classic at level 5, the champion', () => {
    const g = game();
    g.rowsCleared = 12;
    const finish = (patch: Partial<Finish>): Finish => ({
      game: g,
      dive: null,
      classicLevel: null,
      marathonLevelsWithRecords: 0,
      dailiesPlayed: 0,
      ...patch,
    });
    expect(
      packagesAtTheEnd(finish({ dive: { id: 'night-dive', won: true, stars: 3, seaweedLeft: 0 } })),
    ).toEqual(['steady-hands', 'night-diver', 'counter-clockwise']);
    g.sinks = 4;
    g.turnsRight = 1;
    expect(
      packagesAtTheEnd(
        finish({ dive: { id: 'kelp-forest', won: false, stars: 0, seaweedLeft: 0 } }),
      ),
    ).toEqual(['seaweed-gardener']);
    expect(packagesAtTheEnd(finish({ classicLevel: 5, marathonLevelsWithRecords: 9 }))).toEqual([
      'champion',
      'obfuscated',
    ]);
    expect(packagesAtTheEnd(finish({ classicLevel: 4, dailiesPlayed: 7 }))).toEqual([
      'daily-regular',
    ]);
  });
});

describe('records by starting level', () => {
  it('keep the best run of each level and count every run', () => {
    let records = {};
    let best: boolean;
    ({ records, best } = withRun(records, 3, { score: 900, rows: 9, bestCombo: 2, date: 'a' }));
    expect(best).toBe(true);
    ({ records, best } = withRun(records, 3, { score: 400, rows: 4, bestCombo: 5, date: 'b' }));
    expect(best).toBe(false);
    expect(records).toEqual({ 3: { bestScore: 900, rows: 9, bestCombo: 2, runs: 2, date: 'a' } });
  });
});
