import { describe, expect, it } from 'vitest';
import { nextRank, RANKS, rankForXp, rankProgress } from './ranks';
import { applySoftCap, eventsXp, sameGameMultiplier, sessionXp, XP_RULES } from './rules';

describe('ranks', () => {
  it('climbs guest → user → staff → wheel → root in threshold order', () => {
    expect(RANKS.map((r) => r.id)).toEqual(['guest', 'user', 'staff', 'wheel', 'root']);
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i]!.threshold).toBeGreaterThan(RANKS[i - 1]!.threshold);
    }
    expect(rankForXp(0).id).toBe('guest');
    expect(rankForXp(RANKS[2]!.threshold).id).toBe('staff');
    expect(rankForXp(RANKS[2]!.threshold - 1).id).toBe('user');
    expect(nextRank(RANKS[4]!.threshold)).toBeNull();
  });

  it('reports exact progress to the next rank', () => {
    const staff = RANKS[2]!;
    const wheel = RANKS[3]!;
    const progress = rankProgress(staff.threshold + 100);
    expect(progress).toMatchObject({
      into: 100,
      span: wheel.threshold - staff.threshold,
      toNext: wheel.threshold - staff.threshold - 100,
    });
    expect(rankProgress(10_000_000)).toMatchObject({ next: null, fraction: 1, toNext: 0 });
  });
});

describe('session XP', () => {
  it('grows with typical session length inside its bounds', () => {
    const short = sessionXp({ category: 'words', sessionMinutes: [2, 5] });
    const long = sessionXp({ category: 'stories', sessionMinutes: [20, 60] });
    expect(short).toBeGreaterThanOrEqual(XP_RULES.sessionMin);
    expect(long).toBe(XP_RULES.sessionMax);
    expect(long).toBeGreaterThan(short);
  });

  it('keeps toys small whatever their length', () => {
    expect(sessionXp({ category: 'toys', sessionMinutes: [1, 60] })).toBe(XP_RULES.toySession);
  });

  it('fades after the first three sessions of the same game in a day', () => {
    expect([1, 2, 3, 4, 5, 6, 9].map(sameGameMultiplier)).toEqual([1, 1, 1, 0.5, 0.25, 0.1, 0.1]);
  });

  it('clamps game-reported events and caps them per session', () => {
    expect(eventsXp([{ id: 'a', xp: 500 }])).toBe(XP_RULES.eventMax);
    expect(
      eventsXp([
        { id: 'a', xp: 20 },
        { id: 'b', xp: 20 },
      ]),
    ).toBe(XP_RULES.eventsPerSession);
    expect(
      eventsXp([
        { id: 'a', xp: -40 },
        { id: 'b', xp: Number.NaN },
      ]),
    ).toBe(0);
    expect(eventsXp(undefined)).toBe(0);
  });

  it('slows, but never stops, XP after the soft daily ceiling', () => {
    expect(applySoftCap(0, 100)).toBe(100);
    expect(applySoftCap(XP_RULES.dailySoftCap - 20, 100)).toBe(20 + 80 * XP_RULES.overCapRate);
    expect(applySoftCap(XP_RULES.dailySoftCap * 3, 100)).toBe(100 * XP_RULES.overCapRate);
  });
});
