import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GameManifest } from '../packages/kit/src/manifest/manifest';
import { firstLoadFiles } from './build-all';
import { END_MARKER, formatTable, gamesTable, replaceTable, START_MARKER } from './docs';
import { createHostedMiddleware, resolveInside } from './lib/hosted-dev-plugin';

describe('firstLoadFiles', () => {
  it('follows static imports from the entry, not dynamic ones', () => {
    const files = firstLoadFiles({
      'index.html': { file: 'assets/index.js', isEntry: true, imports: ['_shared.js'] },
      '_shared.js': { file: 'assets/shared.js', imports: ['index.html'] },
      'games/atc/src/index.ts': { file: 'assets/atc.js', imports: ['_shared.js'] },
      'style.css': { file: 'assets/style.css' },
    });
    expect(files.sort()).toEqual(['assets/index.js', 'assets/shared.js']);
  });
});

describe('README games table', () => {
  const game = (id: string, status: GameManifest['status']) =>
    ({
      id,
      title: `Title ${id}`,
      directory: '/usr/games/arcade',
      inspiredBy: { uiTitle: `the ${id} program`, year: 1980 },
      status,
      kind: 'native',
    }) as GameManifest;

  it('lists visible games with readable statuses', () => {
    const table = gamesTable([
      game('a', 'coming-soon'),
      game('b', 'unlisted'),
      game('c', 'shipped'),
    ]);
    expect(table.split('\n')).toEqual([
      '| Game | Directory | Inspired by | Status | Kind |',
      '|---|---|---|---|---|',
      '| Title a | `/usr/games/arcade` | the a program (1980) | coming soon | native |',
      '| Title c | `/usr/games/arcade` | the c program (1980) | shipped | native |',
    ]);
  });

  it('replaces only the text between the markers, and is stable when run twice', async () => {
    const table = await formatTable(gamesTable([game('a', 'adopting')]));
    const readme = `# Hi\n\n${START_MARKER}\nold\n${END_MARKER}\n\nMore.\n`;
    const once = replaceTable(readme, table)!;
    expect(once).toContain('| Title a');
    expect(once.endsWith(`${END_MARKER}\n\nMore.\n`)).toBe(true);
    expect(replaceTable(once, table)).toBe(once);
    expect(replaceTable('# no markers', table)).toBeNull();
  });
});

describe('hosted dev middleware', () => {
  function tempRepo(): string {
    const root = mkdtempSync(join(tmpdir(), 'usr-games-dev-'));
    const write = (path: string, content: string) => {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), content);
    };
    write(
      'apps/hall/src/catalog/catalog.json',
      JSON.stringify({
        version: 1,
        games: [],
        fixtures: [{ id: 'fixture', manifest: 'fx/manifest.json' }],
      }),
    );
    write(
      'fx/manifest.json',
      JSON.stringify({
        id: 'fixture',
        title: 'Fixture',
        tagline: 't',
        teaser: 't',
        category: 'arcade',
        directory: '/usr/games/arcade',
        players: { min: 1, max: 1 },
        sessionMinutes: [1, 2],
        status: 'unlisted',
        accent: '#123456',
        emblem: 'M0 0h1',
        inspiredBy: { program: 'f', originalTitle: 'f', uiTitle: 'f', year: 1970 },
        daily: false,
        kind: 'hosted',
        build: { kind: 'hosted-static', source: 'fx', output: 'play/fixture/' },
        manPage: { synopsis: 's', description: 'd', seeAlso: [] },
      }),
    );
    write('fx/index.html', '<!doctype html><title>fx</title>');
    write('secret.txt', 'outside');
    return root;
  }

  function request(
    root: string,
    url: string,
    base = '/',
  ): Promise<{ status: number; location?: string; body: string; next: boolean }> {
    const middleware = createHostedMiddleware({
      repoRoot: root,
      base,
      bridge: null,
      viteBuilds: new Map(),
    });
    return new Promise((resolveResult) => {
      const headers: Record<string, string> = {};
      let body = '';
      const res = {
        statusCode: 200,
        setHeader: (name: string, value: string) => void (headers[name.toLowerCase()] = value),
        write: (chunk: unknown) => void (body += String(chunk)),
        end: (chunk?: unknown) => {
          if (chunk) body += String(chunk);
          resolveResult({ status: res.statusCode, location: headers.location, body, next: false });
        },
        on: () => res,
        once: () => res,
        emit: () => true,
      } as unknown as ServerResponse & { statusCode: number };
      middleware({ url } as IncomingMessage, res, () =>
        resolveResult({ status: 0, body: '', next: true }),
      );
    });
  }

  it('keeps file resolution inside the game folder', () => {
    const root = tempRepo();
    expect(resolveInside(join(root, 'fx'), '/')).toBe(join(root, 'fx', 'index.html'));
    expect(resolveInside(join(root, 'fx'), '/../secret.txt')).toBeNull();
    expect(resolveInside(join(root, 'fx'), '/..%2Fsecret.txt')).toBeNull();
    expect(resolveInside(join(root, 'fx'), '/missing.js')).toBeNull();
  });

  it('redirects to the trailing slash, respects the base and passes other paths on', async () => {
    const root = tempRepo();
    expect(await request(root, '/play/fixture?x=1')).toMatchObject({
      status: 302,
      location: '/play/fixture/?x=1',
    });
    expect(await request(root, '/site/play/fixture', '/site/')).toMatchObject({
      status: 302,
      location: '/site/play/fixture/',
    });
    expect(await request(root, '/src/main.ts')).toMatchObject({ next: true });
    expect(await request(root, '/play/unknown/')).toMatchObject({ status: 404 });
    expect(await request(root, '/play/fixture/missing.js')).toMatchObject({ status: 404 });
  });
});
