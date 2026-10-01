import { describe, expect, it } from 'vitest';
import type { GameManifest } from '../packages/kit/src/manifest/manifest';
import { checkCatalog, progressHasRow } from './check-catalog';
import { type CatalogRead, PLANNED_IDS, type ResolvedEntry } from './lib/catalog';

function manifest(id: string, overrides: Partial<GameManifest> = {}): GameManifest {
  return {
    id,
    title: id,
    tagline: 't',
    teaser: 't',
    category: 'arcade',
    directory: '/usr/games/arcade',
    players: { min: 1, max: 1 },
    sessionMinutes: [1, 2],
    status: 'coming-soon',
    accent: '#123456',
    emblem: 'M0 0h1',
    inspiredBy: { program: id, originalTitle: id, uiTitle: id, year: 1980 },
    daily: false,
    kind: 'native',
    build: { kind: 'native' },
    manPage: { synopsis: 's', description: 'd', seeAlso: [] },
    ...overrides,
  };
}

function entry(
  id: string,
  overrides: Partial<GameManifest> = {},
  source: ResolvedEntry['source'] = 'placeholder',
): ResolvedEntry {
  return {
    id,
    source,
    manifestPath: `${id}.json`,
    exists: true,
    manifest: manifest(id, overrides),
    errors: [],
  };
}

function planned(overrides: Record<string, Partial<GameManifest>> = {}): CatalogRead {
  return {
    games: PLANNED_IDS.map((id) => entry(id, overrides[id])),
    fixtures: [],
    problems: [],
    placeholderFiles: [...PLANNED_IDS],
  };
}

const progress = PLANNED_IDS.map((id) => `| ${id} | x |`).join('\n');
const everything = { exists: () => true, progress };

describe('checkCatalog', () => {
  it('passes a complete catalog', () => {
    expect(checkCatalog(planned(), everything).errors).toEqual([]);
  });

  it('reports missing planned ids, duplicates and unknown SEE ALSO targets', () => {
    const read = planned({
      atc: { manPage: { synopsis: 's', description: 'd', seeAlso: ['nope'] } },
    });
    read.games = read.games.filter((e) => e.id !== 'wump');
    read.games.push(entry('atc'));
    const messages = checkCatalog(read, everything).errors.map((e) => e.message);
    expect(messages).toContain('"atc" is listed more than once');
    expect(messages).toContain('planned game "wump" is missing');
    expect(messages).toContain('SEE ALSO names unknown game "nope"');
  });

  it('checks statuses against the files that exist', () => {
    const read = planned({
      atc: { status: 'shipped' },
      pom: {
        status: 'adopting',
        kind: 'hosted',
        build: { kind: 'hosted-static', source: 'games/pom/app', output: 'play/pom/' },
      },
      robots: {
        status: 'shipped',
        kind: 'hosted',
        build: { kind: 'hosted-vite', source: 'games/robots/app', output: 'play/robots/' },
      },
    });
    const outcome = checkCatalog(read, { exists: () => false, progress });
    expect(outcome.errors.map((e) => e.message)).toEqual([
      'shipped hosted game needs its files in games/robots/app',
      'shipped native game needs games/atc/src/index.ts',
    ]);
    expect(outcome.notes?.map((n) => n.message)).toEqual([
      'adopting; games/pom/app not copied in yet',
    ]);
  });

  it('requires unlisted fixtures and a PROGRESS row per id', () => {
    const read = planned();
    read.fixtures = [entry('fixture', { status: 'shipped' }, 'fixture')];
    const outcome = checkCatalog(read, {
      exists: () => true,
      progress: progress.replace('| atc |', '| xyz |'),
    });
    expect(outcome.errors.map((e) => e.message)).toEqual([
      'fixtures must be "unlisted"',
      'no row for "atc"',
    ]);
    expect(checkCatalog(planned(), { exists: () => true, progress: null }).errors).toHaveLength(1);
  });
});

describe('progressHasRow', () => {
  it('matches the id in the first column, with or without backticks', () => {
    expect(progressHasRow('| id | x |\n| `atc` | shipped |', 'atc')).toBe(true);
    expect(progressHasRow('| atcx | shipped |', 'atc')).toBe(false);
  });
});
