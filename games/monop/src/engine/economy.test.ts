import { describe, expect, it } from 'vitest';
import { groupSpaces } from '../boards/layout';
import { ECONOMY } from './economy';
import { landingOdds } from './markov';
import type { PersonalityId } from './rivals';
import { simulate } from './simulate';

/**
 * The economy as tuned by simulation (NOTES.md, "Economy"). These tests hold the table and the
 * balance it was tuned for, so a change to prices, rents or the rivals shows up here first.
 */

describe('the price table', () => {
  it('rises round the loop and keeps every district’s rents in step', () => {
    const streets = Array.from({ length: 8 }, (_, g) => groupSpaces(g));
    let last = 0;
    for (const lots of streets) {
      for (const space of lots) {
        const deed = ECONOMY.deeds[space]!;
        expect(deed.price).toBeGreaterThan(last);
        last = deed.price;
        for (let level = 1; level <= 5; level++)
          expect(deed.rents[level]!).toBeGreaterThan(deed.rents[level - 1]!);
        expect(deed.mortgage).toBe(deed.price / 2);
      }
    }
  });

  it('pays back faster the dearer the district, because dear districts come together later', () => {
    const landing = landingOdds('short').perTurn;
    const paybacks = Array.from({ length: 8 }, (_, g) => {
      const lots = groupSpaces(g);
      const income = lots.reduce(
        (sum, s) => sum + ECONOMY.deeds[s]!.rents[3]! * landing[s]! * 2,
        0,
      );
      const cost = lots.reduce(
        (sum, s) => sum + ECONOMY.deeds[s]!.price + 3 * ECONOMY.deeds[s]!.buildCost,
        0,
      );
      return cost / income;
    });
    for (let g = 1; g < 8; g++) expect(paybacks[g]!).toBeLessThanOrEqual(paybacks[g - 1]! + 0.5);
    for (const rounds of paybacks) {
      expect(rounds).toBeGreaterThan(8);
      expect(rounds).toBeLessThan(30);
    }
  });
});

describe('the balance, by simulation', () => {
  const PERSONALITIES: PersonalityId[] = ['builder', 'saver', 'collector', 'dealmaker', 'steady'];
  const games = Array.from({ length: 360 }, (_, game) =>
    simulate({
      seed: `balance-${game}`,
      seats: [0, 1, 2].map((i) => ({
        personality: PERSONALITIES[(game + i * 2) % 5]!,
        difficulty: 'medium' as const,
      })),
    }),
  );

  it('ends every game, in about half an hour on the clock', () => {
    expect(games.every((g) => !g.stalled)).toBe(true);
    const minutes = games.reduce((sum, g) => sum + g.minutes, 0) / games.length;
    expect(minutes).toBeGreaterThan(18);
    expect(minutes).toBeLessThan(32);
  });

  it('gives no seat more than a small edge', () => {
    const wins = [0, 0, 0];
    for (const g of games) if (g.winner !== null) wins[g.winner]! += 1;
    for (const w of wins) expect(Math.abs(w / games.length - 1 / 3)).toBeLessThan(0.08);
  });

  it('lets no district dominate', () => {
    const rates = Array.from({ length: 8 }, (_, group) => {
      const done = games.filter((g) => g.groupOwners[group] !== null);
      return done.filter((g) => g.winner === g.groupOwners[group]).length / done.length;
    });
    expect(Math.max(...rates) - Math.min(...rates)).toBeLessThan(0.2);
  });

  it('lets every personality win its share', () => {
    const tally = new Map<PersonalityId, { games: number; wins: number }>();
    games.forEach((g, game) => {
      [0, 1, 2].forEach((i) => {
        const p = PERSONALITIES[(game + i * 2) % 5]!;
        const entry = tally.get(p) ?? { games: 0, wins: 0 };
        entry.games += 1;
        if (g.winner === i) entry.wins += 1;
        tally.set(p, entry);
      });
    });
    for (const [, { games: played, wins }] of tally) {
      expect(wins / played).toBeGreaterThan(0.2);
      expect(wins / played).toBeLessThan(0.47);
    }
  });

  it('raises buildings and the odd landmark in most games', () => {
    const landmarks = games.reduce((sum, g) => sum + g.landmarks, 0) / games.length;
    expect(landmarks).toBeGreaterThan(1);
  });
});
