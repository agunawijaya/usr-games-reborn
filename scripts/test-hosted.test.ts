import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hostedSuites } from './test-hosted';

function hostedManifest(id: string) {
  return {
    id,
    title: id,
    tagline: 't',
    teaser: 't',
    category: 'arcade',
    directory: '/usr/games/arcade',
    players: { min: 1, max: 1 },
    sessionMinutes: [1, 2],
    status: 'shipped',
    accent: '#123456',
    emblem: 'M0 0h1',
    inspiredBy: { program: id, originalTitle: id, uiTitle: id, year: 1980 },
    daily: false,
    kind: 'hosted',
    build: { kind: 'hosted-static', source: `games/${id}/app`, output: `play/${id}/` },
    manPage: { synopsis: 's', description: 'd', seeAlso: [] },
  };
}

function write(root: string, path: string, value: unknown) {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), typeof value === 'string' ? value : JSON.stringify(value));
}

describe('hostedSuites', () => {
  it('finds each adopted game’s own test script, preferring a single run', () => {
    const root = mkdtempSync(join(tmpdir(), 'usr-games-hosted-'));
    const ids = ['watcher', 'plain', 'untested', 'elsewhere'];
    write(root, 'apps/hall/src/catalog/catalog.json', {
      version: 1,
      games: ids.map((id) => ({ id, source: 'game' })),
    });
    for (const id of ids) write(root, `games/${id}/manifest.json`, hostedManifest(id));
    write(root, 'games/watcher/app/package.json', {
      scripts: { test: 'vitest', 'test:once': 'vitest run' },
    });
    write(root, 'games/plain/app/package.json', { scripts: { test: 'node --test' } });
    write(root, 'games/untested/app/package.json', { scripts: { start: 'node serve.mjs' } });

    expect(hostedSuites(root)).toEqual([
      { id: 'watcher', folder: join(root, 'games/watcher/app'), script: 'test:once' },
      { id: 'plain', folder: join(root, 'games/plain/app'), script: 'test' },
    ]);
  });
});
