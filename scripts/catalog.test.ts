/**
 * Tests against the real catalog: every manifest validates, all planned games are present,
 * and the progression simulations model the same collection the Hall shows.
 */
import { describe, expect, it } from 'vitest';
import { PLANNED_COLLECTION } from '../packages/kit/src/progression/sim/collection';
import { PLANNED_IDS, readCatalog } from './lib/catalog';

const catalog = readCatalog();

describe('the Hall catalog', () => {
  it('reads cleanly', () => {
    expect(catalog.problems).toEqual([]);
  });

  it('resolves every game and fixture to a valid manifest', () => {
    const invalid = [...catalog.games, ...catalog.fixtures].filter(
      (entry) => entry.errors.length > 0 || !entry.manifest,
    );
    expect(invalid.map((entry) => `${entry.id}: ${entry.errors.join('; ')}`)).toEqual([]);
  });

  it('lists every planned game, in the planned order', () => {
    expect(catalog.games.map((entry) => entry.id)).toEqual([...PLANNED_IDS]);
  });

  it('keeps fixtures unlisted', () => {
    for (const fixture of catalog.fixtures) expect(fixture.manifest?.status).toBe('unlisted');
  });
});

describe('progression simulation model', () => {
  it('matches the catalog ids, directories, session lengths and daily flags exactly', () => {
    const fromCatalog = catalog.games.map(({ manifest }) => ({
      id: manifest!.id,
      category: manifest!.category,
      sessionMinutes: [...manifest!.sessionMinutes],
      daily: manifest!.daily,
    }));
    const fromModel = PLANNED_COLLECTION.map((game) => ({
      id: game.id,
      category: game.category,
      sessionMinutes: [...game.sessionMinutes],
      daily: game.daily,
    }));
    expect(fromModel).toEqual(fromCatalog);
  });
});
