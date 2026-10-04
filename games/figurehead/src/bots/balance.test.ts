import { describe, expect, it } from 'vitest';
import { buildEncounter, type EncounterContext } from '../voyage/encounters';
import type { EncounterKind, Quality } from '../voyage/types';
import { playEncounter, playLife, type SimStyle } from './sim';

/**
 * The balance targets, locked with room to spare (see docs/NOTES.md for the full report from
 * `scripts/sim.ts`). A plain gunner should win most actions; drifting should win none; a
 * convoy left alone mostly fails; a life ends with an epilogue and seldom loses a ship.
 */

const SEEDS = 16;

function winRate(kind: EncounterKind, style: SimStyle, pressure: number, qual: Quality): number {
  let wins = 0;
  for (let i = 0; i < SEEDS; i++) {
    const ctx: EncounterContext = {
      flagship: { name: 'Kittiwake', qual, refits: [], away: 0 },
      squadron: [],
      pressure,
    };
    if (playEncounter(buildEncounter(kind, `lock:${kind}:${i}`, ctx), style).battle.end?.win)
      wins++;
  }
  return wins / SEEDS;
}

describe('balance', () => {
  it('the maiden cruise is won by any captain who fights', () => {
    expect(winRate('maiden', 'gunner', 0, 2)).toBeGreaterThanOrEqual(0.85);
    expect(winRate('maiden', 'idle', 0, 2)).toBe(0);
  });

  it('an early duel and a chase are won more often than not', () => {
    expect(winRate('duel', 'gunner', 0, 2)).toBeGreaterThanOrEqual(0.5);
    expect(winRate('chase', 'gunner', 0, 2)).toBeGreaterThanOrEqual(0.5);
  });

  it('a convoy needs its escort', () => {
    expect(winRate('convoy', 'idle', 1, 3)).toBeLessThanOrEqual(0.45);
    expect(winRate('convoy', 'gunner', 1, 3)).toBeGreaterThanOrEqual(0.55);
  });

  it('late actions stay winnable with a seasoned crew', () => {
    expect(winRate('line', 'gunner', 3, 4)).toBeGreaterThanOrEqual(0.45);
    expect(winRate('fleet', 'gunner', 3, 5)).toBeGreaterThanOrEqual(0.35);
  });

  it('a cutting-out can be won, and the passage home almost always', () => {
    expect(winRate('recapture', 'gunner', 2, 3)).toBeGreaterThanOrEqual(0.4);
    expect(winRate('passage', 'gunner', 3, 4)).toBeGreaterThanOrEqual(0.8);
  });

  it('a whole life reaches its epilogue and seldom loses her', () => {
    let lost = 0;
    for (let i = 0; i < 6; i++) {
      const life = playLife(`lock-life-${i}`, 'gunner', (n) => i % n);
      expect(life.ending).not.toBeNull();
      expect(life.records.length).toBeGreaterThanOrEqual(12);
      lost += life.hull - 1;
    }
    expect(lost).toBeLessThanOrEqual(4);
  });
});
