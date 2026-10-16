import { describe, expect, it } from 'vitest';
import { newLedger } from '../engine/ledger';
import {
  TITLES,
  earnedExtras,
  emptyCareer,
  nextTitle,
  openTokens,
  recordGame,
  shownExtras,
  titleOf,
  tokenFor,
  type GameSummary,
} from './career';
import { PACKAGES, packagesFor } from './packages';

const game = (patch: Partial<GameSummary> = {}): GameSummary => ({
  kind: 'quick',
  board: 'harbour',
  preset: 'standard',
  won: true,
  worth: 6000,
  coached: false,
  ledger: newLedger(0),
  turns: 40,
  ...patch,
});

describe('the career', () => {
  it('climbs from Tenant by wins and best worth, one title at a time', () => {
    let career = emptyCareer();
    expect(titleOf(career).name).toBe('Tenant');
    expect(nextTitle(career)?.name).toBe('Landlord');
    career = recordGame(career, game({ worth: 3000 }));
    expect(titleOf(career).name).toBe('Landlord');
    career = recordGame(career, game({ worth: 3000 }));
    career = recordGame(career, game({ worth: 3000 }));
    // Three wins, but not yet worth enough for Developer.
    expect(titleOf(career).name).toBe('Landlord');
    career = recordGame(career, game({ won: false, worth: 5200 }));
    expect(titleOf(career).name).toBe('Developer');
    expect(TITLES.map((t) => t.name)).toEqual([
      'Tenant',
      'Landlord',
      'Developer',
      'Magnate',
      'Tycoon',
    ]);
  });

  it('counts worth only from full games played without the coach', () => {
    let career = recordGame(emptyCareer(), game({ coached: true, worth: 9999 }));
    career = recordGame(career, game({ kind: 'scenario', scenario: 'rent-day', worth: 9999 }));
    expect(career.bestWorth).toBe(0);
    career = recordGame(career, game({ kind: 'classic', worth: 4321 }));
    expect(career.bestWorth).toBe(4321);
  });

  it('counts a scenario’s first win only, and keeps its fewest turns', () => {
    let career = recordGame(
      emptyCareer(),
      game({ kind: 'scenario', scenario: 'rent-day', turns: 9 }),
    );
    career = recordGame(career, game({ kind: 'scenario', scenario: 'rent-day', turns: 6 }));
    career = recordGame(
      career,
      game({ kind: 'scenario', scenario: 'rent-day', won: false, turns: 3 }),
    );
    expect(career.wins).toBe(1);
    expect(career.scenarios['rent-day']).toEqual({ won: true, bestTurns: 6, tries: 3 });
  });

  it('opens tokens and extras with each title, and keeps a choice that is open', () => {
    let career = emptyCareer();
    expect(openTokens(career, 'colony')).toEqual(['rover', 'drone', 'robot']);
    career.tokens.colony = 'comet';
    expect(tokenFor(career, 'colony')).toBe('rover');
    career = { ...career, wins: 20, bestWorth: 10000 };
    expect(tokenFor(career, 'colony')).toBe('comet');
    expect(earnedExtras(career)).toEqual(['pennants', 'statue', 'goldBase', 'gilded']);
    expect(shownExtras({ ...career, hidden: ['statue'] })).not.toContain('statue');
  });
});

describe('packages', () => {
  it('ships twelve, and every check names one of them', () => {
    expect(PACKAGES).toHaveLength(12);
    const ledger = {
      ...newLedger(0),
      deedsBought: 1,
      districts: [2],
      landmarks: 1,
      trades: 3,
      mostTransits: 4,
      wasInDebt: true,
      bargains: 1,
    };
    const career = {
      ...emptyCareer(),
      winsByBoard: { harbour: 1, colony: 2, popup: 1 },
      dailies: Object.fromEntries(
        Array.from({ length: 7 }, (_, i) => [
          `2026-10-0${i + 1}`,
          { number: i, scenario: 'x', won: true, turns: 5, towers: 0, deals: 0 },
        ]),
      ),
      scenarios: Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [`s${i}`, { won: true, bestTurns: 5, tries: 1 }]),
      ),
    };
    const ids = packagesFor(game({ ledger, preset: 'berkeley' }), career);
    expect(new Set(ids)).toEqual(new Set(PACKAGES.map((p) => p.id)));
  });

  it('asks a clean record of a full game only', () => {
    const ids = packagesFor(game({ kind: 'scenario', scenario: 'x' }), emptyCareer());
    expect(ids).not.toContain('never-jailed');
    expect(packagesFor(game(), emptyCareer())).toContain('never-jailed');
  });
});
