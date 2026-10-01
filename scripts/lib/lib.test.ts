import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isAllowed } from './config';
import { matchesGlob } from './glob';
import { copyStaticGame, isAdoptedWorkbench, normaliseBase } from './hosted';
import { expandRoots, isTestFile, lineAt, readText, walkFiles } from './walk';

function tempTree(files: Record<string, string | Buffer>): string {
  const root = mkdtempSync(join(tmpdir(), 'usr-games-scripts-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

describe('matchesGlob', () => {
  it('keeps * inside a segment and lets ** cross segments', () => {
    expect(matchesGlob('docs/media/hall/hero/a.png', 'docs/media/**')).toBe(true);
    expect(matchesGlob('games/atc/docs/media/x.png', 'games/*/docs/media/**')).toBe(true);
    expect(matchesGlob('games/atc/src/docs/media/x.png', 'games/*/docs/media/**')).toBe(false);
    expect(matchesGlob('games/trek/app/js/ui.js', 'games/trek/app/')).toBe(true);
    expect(matchesGlob('a/b.ts', '**/*.ts')).toBe(true);
    expect(matchesGlob('b.ts', '**/*.ts')).toBe(true);
  });

  it('narrows allow entries to matching lines', () => {
    const allow = [{ path: 'games/*/app/**', match: 'credits', reason: 'test' }];
    expect(isAllowed('games/pom/app/a.js', '// credits: https://x', allow)).toBe(true);
    expect(isAllowed('games/pom/app/a.js', 'fetch(url)', allow)).toBe(false);
  });
});

describe('walkFiles', () => {
  it('skips tooling folders, dist and prompts unless asked', () => {
    const root = tempTree({
      'apps/hall/src/a.ts': 'a',
      'apps/hall/node_modules/x/b.ts': 'b',
      'dist/index.html': 'c',
      'prompts/00.md': 'd',
      '.git/HEAD': 'e',
    });
    expect(walkFiles({ root }).map((f) => f.path)).toEqual(['apps/hall/src/a.ts']);
    expect(walkFiles({ root, includeDist: true }).map((f) => f.path)).toContain('dist/index.html');
    expect(walkFiles({ root, includePrompts: true }).map((f) => f.path)).toContain('prompts/00.md');
    expect(walkFiles({ root, within: ['missing'] })).toEqual([]);
  });

  it('expands one-level wildcards against real folders', () => {
    const root = tempTree({
      'games/atc/src/i.ts': '',
      'games/wump/src/i.ts': '',
      'games/README.md': '',
    });
    expect(expandRoots(['games/*/src'], root).sort()).toEqual(['games/atc/src', 'games/wump/src']);
  });

  it('reads text but not binaries', () => {
    const root = tempTree({ 'a.txt': 'hello\nworld', 'b.bin': Buffer.from([1, 0, 2]) });
    expect(readText(join(root, 'a.txt'))).toBe('hello\nworld');
    expect(readText(join(root, 'b.bin'))).toBeNull();
    expect(lineAt('a\nb\nc', 4)).toBe(3);
  });

  it('recognises test files', () => {
    expect(isTestFile('packages/kit/src/rng/rng.test.ts')).toBe(true);
    expect(isTestFile('apps/hall/e2e/home.spec.ts')).toBe(true);
    expect(isTestFile('packages/kit/src/rng/rng.ts')).toBe(false);
  });
});

describe('normaliseBase', () => {
  it('always yields a slash-wrapped path', () => {
    expect(normaliseBase(undefined)).toBe('/');
    expect(normaliseBase('')).toBe('/');
    expect(normaliseBase('/usr-games-reborn')).toBe('/usr-games-reborn/');
    expect(normaliseBase('usr-games-reborn/')).toBe('/usr-games-reborn/');
  });
});

describe('copyStaticGame', () => {
  it('ships the page and its code but leaves an adopted game’s workbench behind', () => {
    const source = tempTree({
      'index.html': '<!doctype html>',
      'src/main.js': '',
      'src/docs/help.js': '',
      'README.md': '',
      'UPSTREAM-AGENTS.md': '',
      'package.json': '{}',
      'docs/notes.md': '',
      'scripts/serve.mjs': '',
      'tests/engine.test.js': '',
      'node_modules/x/index.js': '',
    });
    const destination = mkdtempSync(join(tmpdir(), 'usr-games-copy-'));
    copyStaticGame(source, destination);
    const shipped = walkFiles({ root: destination, includeDist: true })
      .map((file) => file.path)
      .sort();
    expect(shipped).toEqual(['index.html', 'src/docs/help.js', 'src/main.js']);
  });

  it('recognises the workbench only at the top of the game folder', () => {
    expect(isAdoptedWorkbench('scripts')).toBe(true);
    expect(isAdoptedWorkbench('NOTES.md')).toBe(true);
    expect(isAdoptedWorkbench('src/scripts')).toBe(false);
    expect(isAdoptedWorkbench('src/readme.md')).toBe(false);
    expect(isAdoptedWorkbench('')).toBe(false);
  });
});
