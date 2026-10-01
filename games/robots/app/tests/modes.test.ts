import { beforeEach, describe, expect, it } from 'vitest';
import { callForWave, callLost, callMet, EMPTY_WAVE, makeCall, stampLevel } from '../src/modes/calls';
import { line } from '../src/modes/commentary';
import { dailyNumber, weekday } from '../src/modes/daily';
import { HYPE_TIERS, hypeAfter, MAX_HYPE, tierOf } from '../src/modes/hype';
import {
  blitzPlan,
  classicRobots,
  customPlan,
  exhibitionPlan,
  isFinalWave,
  robotsForWave,
  showdownPlan,
} from '../src/modes/plans';
import { addBest, addShowdown, addTourResult, loadRecords, tourStars, tourUnlocked } from '../src/modes/records';
import { scoreTarget, TOUR, tourPlan } from '../src/modes/tour';
import { ADVANCE_BONUS, RunTracker, type TurnReport } from '../src/modes/tracker';
import { firstWave, followingWave } from '../src/modes/waves';

const quietTurn: TurnReport = { crashed: 0, classicGain: 0, teleported: false, waited: false, nearest: 5, cleared: false, caught: false };
const crashTurn = (crashed: number, extra: Partial<TurnReport> = {}): TurnReport => ({ ...quietTurn, crashed, classicGain: crashed * 10, ...extra });
const noRobot = { crashed: 0, chain: 0, waited: false, teleported: false, closeCall: false };

/** A tracker on its first wave with no jumbotron call, so the points are the crashes' alone. */
function withoutCall(tracker: RunTracker, robots = 10): RunTracker {
  tracker.startWave(tracker.plan.startWave, robots);
  tracker.call = null;
  return tracker;
}

describe('hype', () => {
  it('names the tier by its lower bound', () => {
    expect(tierOf(24).name).toBe('Warm');
    expect(tierOf(25).name).toBe('Loud');
    expect(tierOf(79).multiplier).toBe(3);
    expect(tierOf(MAX_HYPE).name).toBe('Showtime');
  });

  it('rises with every crash, and more along a chain or while waiting', () => {
    expect(hypeAfter(0, { ...noRobot, crashed: 1, chain: 1 })).toBe(5);
    expect(hypeAfter(0, { ...noRobot, crashed: 2, chain: 3 })).toBe(18);
    expect(hypeAfter(0, { ...noRobot, crashed: 1, chain: 1, waited: true })).toBe(7);
  });

  it('falls on quiet turns and teleports, never below zero or above the top', () => {
    expect(hypeAfter(10, noRobot)).toBe(8);
    expect(hypeAfter(10, { ...noRobot, teleported: true })).toBe(0);
    expect(hypeAfter(98, { ...noRobot, crashed: 4, chain: 8 })).toBe(MAX_HYPE);
  });

  it('a wired crowd multiplies the rise, not the fall', () => {
    expect(hypeAfter(0, { ...noRobot, crashed: 2, chain: 1 }, 1.5)).toBe(15);
    expect(hypeAfter(10, noRobot, 1.5)).toBe(8);
  });
});

describe('match plans', () => {
  it('keeps the original escalation: ten more robots a wave, never more than forty', () => {
    expect([1, 2, 3, 4, 5, 9].map(classicRobots)).toEqual([10, 20, 30, 40, 40, 40]);
    const exhibition = exhibitionPlan();
    expect(robotsForWave(exhibition, 3)).toBe(30);
    expect(isFinalWave(exhibition, 99)).toBe(false);
  });

  it('runs a tour match through its own waves and ends on the last one', () => {
    const tripleBill = tourPlan(TOUR.findIndex((m) => m.id === 'triple-bill'));
    expect([1, 2, 3].map((w) => robotsForWave(tripleBill, w))).toEqual([15, 25, 35]);
    expect(isFinalWave(tripleBill, 2)).toBe(false);
    expect(isFinalWave(tripleBill, 3)).toBe(true);
    expect(tripleBill.calls).toBe(false);
  });

  it('numbers the showdowns from the collection epoch and bends one rule a day', () => {
    expect(dailyNumber('2026-09-01')).toBe(1);
    expect(weekday('2026-09-01')).toBe(1);
    expect(weekday('2026-09-07')).toBe(0);
    const tuesday = showdownPlan('2026-09-01');
    expect(tuesday.title).toBe('Showdown #1');
    expect(tuesday.teleports).toBe(2);
    const friday = showdownPlan('2026-10-02');
    expect(friday.title).toBe('Showdown #32');
    expect(friday.startWave).toBe(4);
    expect(robotsForWave(friday, 4)).toBe(40);
    expect(showdownPlan('2026-10-04').allowWait).toBe(false);
    expect(showdownPlan('2026-10-02').seed).toBe(showdownPlan('2026-10-02').seed);
    expect(showdownPlan('2026-10-02').seed).not.toBe(showdownPlan('2026-10-03').seed);
  });

  it('spells out a custom match and the blitz tempo', () => {
    const plan = customPlan({ startWave: 3, teleports: 1, tempo: 2, allowWait: false });
    expect(plan.rule).toBe('from wave 3 · 1 teleport · robots move every 2 s · no waiting. Just for practice: no records.');
    expect(blitzPlan(1.5).tempo).toBe(1.5);
  });
});

describe('jumbotron calls', () => {
  it('stays silent in the tour, where the match has its own challenge', () => {
    expect(callForWave(tourPlan(0), 1, 10, 123)).toBeNull();
  });

  it('shows the same call to everyone on the same seed', () => {
    const plan = showdownPlan('2026-10-02');
    expect(callForWave(plan, 4, 40, 99)).toEqual(callForWave(plan, 4, 40, 99));
  });

  it('leaves about one wave in four quiet, and never asks for what the rules forbid', () => {
    const noWaiting = { ...exhibitionPlan(), allowWait: false, teleports: 0 };
    let quiet = 0;
    for (let seed = 0; seed < 400; seed++) {
      const call = callForWave(noWaiting, 1, 20, seed);
      if (!call) quiet++;
      else expect(['no-teleport', 'wait-crashes', 'no-wait']).not.toContain(call.kind);
    }
    expect(quiet / 400).toBeGreaterThan(0.15);
    expect(quiet / 400).toBeLessThan(0.35);
  });

  it('judges a call as met, open or lost', () => {
    const quick = makeCall('quick', 20, 10);
    expect(quick.reward).toBe(150);
    expect(callMet(quick, { ...EMPTY_WAVE, turns: 12 }, true)).toBe(true);
    expect(callMet(quick, { ...EMPTY_WAVE, turns: 12 }, false)).toBe(false);
    expect(callLost(quick, { ...EMPTY_WAVE, turns: 21 })).toBe(true);
    const chain = makeCall('chain', 4, 20);
    expect(callMet(chain, { ...EMPTY_WAVE, bestChain: 4 }, false)).toBe(true);
    expect(callLost(chain, { ...EMPTY_WAVE, turns: 500 })).toBe(false);
  });

  it('stamps bronze, silver and gold', () => {
    expect([0, 1, 4, 5, 14, 15].map(stampLevel)).toEqual([0, 1, 1, 2, 2, 3]);
  });
});

describe('the run tracker', () => {
  it('pays crashes at the volume the crowd had before the turn', () => {
    const tracker = withoutCall(new RunTracker({ ...exhibitionPlan(), startHype: HYPE_TIERS[2].min }, 1));
    tracker.turn(crashTurn(2));
    expect(tracker.points).toBe(60);
    expect(tracker.classicScore).toBe(20);
  });

  it('passes the wait bonus through as the original paid it', () => {
    const tracker = withoutCall(new RunTracker(exhibitionPlan(), 1));
    tracker.turn(crashTurn(3, { classicGain: 3 * 10 + 50, waited: true, cleared: true }));
    expect(tracker.points).toBe(80);
  });

  it('counts a chain across consecutive turns and breaks it on a quiet one', () => {
    const tracker = new RunTracker(exhibitionPlan(), 1);
    tracker.startWave(1, 10);
    tracker.turn(crashTurn(2));
    tracker.turn(crashTurn(1));
    expect(tracker.chain).toBe(3);
    tracker.turn(quietTurn);
    expect(tracker.chain).toBe(0);
    expect(tracker.summary().record.bestChain).toBe(3);
  });

  it('pays a met call once and stamps it', () => {
    const tracker = new RunTracker(exhibitionPlan(), 1);
    tracker.startWave(1, 10);
    tracker.call = makeCall('chain', 2, 10);
    const events = tracker.turn(crashTurn(2));
    expect(events).toContainEqual({ type: 'call-met', call: tracker.call });
    expect(tracker.points).toBe(20 + 150);
    tracker.turn(crashTurn(2));
    expect(tracker.summary().stamps).toEqual(['chain']);
  });

  it('pays the advance bonus for the first wave cleared after skipping ahead', () => {
    const tracker = new RunTracker(showdownPlan('2026-10-02'), 1);
    tracker.startWave(4, 40);
    expect(tracker.turn(crashTurn(1, { cleared: true }))).toContainEqual({ type: 'advance-bonus', points: ADVANCE_BONUS });
    tracker.startWave(5, 40);
    expect(tracker.turn(crashTurn(1, { cleared: true }))).not.toContainEqual({ type: 'advance-bonus', points: ADVANCE_BONUS });
  });

  it('gives tour stars for the win, the score target and the challenge', () => {
    const tracker = new RunTracker(tourPlan(0), 1);
    tracker.startWave(1, 10);
    for (let i = 0; i < 9; i++) tracker.turn(crashTurn(1));
    tracker.turn(crashTurn(1, { cleared: true }));
    tracker.winMatch();
    const { stars, points } = tracker.summary();
    expect(points).toBeGreaterThanOrEqual(scoreTarget(TOUR[0]));
    expect(stars).toEqual([true, true, true]);
  });

  it('gives no stars for a lost tour match', () => {
    const tracker = new RunTracker(tourPlan(0), 1);
    tracker.startWave(1, 10);
    tracker.turn({ ...quietTurn, caught: true });
    expect(tracker.summary().stars).toEqual([false, false, false]);
  });
});

describe('seeded waves', () => {
  it('has a seed and a score target for every tour match', () => {
    for (const match of TOUR) expect(scoreTarget(match)).toBeGreaterThan(0);
  });

  it('never starts a seeded wave with a robot at arm’s length', () => {
    for (const [index] of TOUR.entries()) {
      const state = firstWave(tourPlan(index));
      const nearest = Math.min(...state.robots.map((r) => Math.max(Math.abs(r.x - state.player.x), Math.abs(r.y - state.player.y))));
      expect(nearest).toBeGreaterThanOrEqual(3);
      expect(state.robots).toHaveLength(TOUR[index].waves[0]);
    }
  });

  it('lays out the next wave the same way however the last one was played', () => {
    const plan = tourPlan(TOUR.findIndex((m) => m.id === 'double-header'));
    const start = firstWave(plan);
    const one = followingWave(plan, { ...start, score: 10 });
    const other = followingWave(plan, { ...start, score: 900, player: { x: 0, y: 0 } });
    expect(one.robots).toEqual(other.robots);
    expect(one.robots).toHaveLength(20);
    expect(other.score).toBe(900);
  });
});

describe('records', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the best five runs of each mode and tells you your place', () => {
    let records = loadRecords();
    for (const points of [50, 400, 120]) records = addBest(records, 'blitz', { points, waves: 1, chain: 0, date: '2026-10-02' }).records;
    const { records: after, place } = addBest(records, 'blitz', { points: 200, waves: 2, chain: 1, date: '2026-10-02' });
    expect(place).toBe(2);
    expect(loadRecords().best.blitz?.map((r) => r.points)).toEqual([400, 200, 120, 50]);
    expect(after.best.exhibition).toBeUndefined();
  });

  it('counts only the first showdown of the day', () => {
    const run = { points: 300, waves: 2, chain: 3, rule: 'Forty Friday' };
    const first = addShowdown(loadRecords(), '2026-10-02', run);
    expect(first.official).toBe(true);
    const second = addShowdown(first.records, '2026-10-02', { ...run, points: 9000 });
    expect(second.official).toBe(false);
    expect(loadRecords().showdowns['2026-10-02'].points).toBe(300);
  });

  it('keeps every star a match has ever earned and opens the next match on a win', () => {
    const ids = TOUR.map((m) => m.id);
    let records = addTourResult(loadRecords(), 'opening-night', [true, false, true], 140);
    records = addTourResult(records, 'opening-night', [true, true, false], 170);
    expect(records.tour['opening-night']).toEqual({ stars: [true, true, true], best: 170 });
    expect(tourStars(records)).toBe(3);
    expect(tourUnlocked(records, 1, ids)).toBe(true);
    expect(tourUnlocked(records, 2, ids)).toBe(false);
  });

  it('brings the old top ten into the Exhibition', () => {
    localStorage.setItem('bsdgames.robots.fancy-web.highscores.v1', JSON.stringify([
      { score: 120, level: 2, date: '2026-01-01' },
      { score: 900, level: 5, date: '2026-01-02' },
    ]));
    expect(loadRecords().best.exhibition?.map((r) => r.points)).toEqual([900, 120]);
  });
});

describe('commentary', () => {
  it('fills in the numbers and rotates its lines', () => {
    const first = line('wave', { n: 30, w: 3 });
    const second = line('wave', { n: 30, w: 3 });
    expect(first).not.toBe(second);
    expect(`${first} ${second}`).not.toMatch(/[{}]/);
  });
});
