import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  addToIndex,
  checkProvenance,
  findCopiedLines,
  isDistinctive,
  normaliseLine,
  type OriginalIndex,
} from './check-provenance';

function tempTree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'usr-games-provenance-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

const QUOTE = 'The early bird may get the worm, but the second mouse gets the cheese, they say.';

describe('distinctive lines', () => {
  it('ignores short lines, licence boilerplate and punctuation rows', () => {
    expect(isDistinctive(normaliseLine(QUOTE))).toBe(true);
    expect(isDistinctive(normaliseLine('Short line.'))).toBe(false);
    expect(
      isDistinctive(
        normaliseLine(" * THIS SOFTWARE IS PROVIDED BY THE REGENTS AND CONTRIBUTORS ``AS IS'' AND"),
      ),
    ).toBe(false);
    expect(isDistinctive('-'.repeat(60))).toBe(false);
  });
});

describe('findCopiedLines', () => {
  it('finds an original line embedded anywhere in a repo line, ignoring case and spacing', () => {
    const index: OriginalIndex = new Map();
    addToIndex(index, `%\n${QUOTE}\n%`, 'fortune/datfiles/fortunes');
    const repo = `const tips = ["${QUOTE.toUpperCase().replace(/ /g, '  ')}"];\nconst ours = "Written by us, about computing history and play.";`;
    const findings = findCopiedLines('apps/hall/src/content/fortunes.ts', repo, index);
    expect(findings).toEqual([
      {
        path: 'apps/hall/src/content/fortunes.ts',
        line: 1,
        message: 'verbatim text from the originals (fortune/datfiles/fortunes)',
      },
    ]);
  });
});

describe('checkProvenance', () => {
  it('scans the repo against the originals and exempts LICENSES/ and CREDITS.md', () => {
    const originals = tempTree({ 'fortune/datfiles/fortunes': `${QUOTE}\n%\n` });
    const repo = tempTree({
      'LICENSES/BSD.txt': QUOTE,
      'CREDITS.md': QUOTE,
      'apps/hall/src/fortunes.ts': `export const lines = ['${QUOTE}'];`,
    });
    const outcome = checkProvenance(repo, originals);
    expect(outcome.errors.map((e) => e.path)).toEqual(['apps/hall/src/fortunes.ts']);
  });

  it('leaves out files the guards config allows, and only those', () => {
    const originals = tempTree({ 'battlestar/dayfile.c': `${QUOTE}\n` });
    const repo = tempTree({
      'LICENSES/BSD.txt': 'x',
      'CREDITS.md': 'x',
      'scripts/guards.config.json': JSON.stringify({
        provenance: { allow: [{ path: 'games/adopted/app/**', reason: 'kept by design' }] },
      }),
      'games/adopted/app/src/world.js': `export const room = '${QUOTE}';`,
      'games/native/src/world.ts': `export const room = '${QUOTE}';`,
    });
    const outcome = checkProvenance(repo, originals);
    expect(outcome.errors.map((e) => e.path)).toEqual(['games/native/src/world.ts']);
  });

  it('skips the scan without originals, but still requires the attribution files', () => {
    const missing = join(tmpdir(), 'definitely-not-the-originals');
    expect(
      checkProvenance(tempTree({ 'LICENSES/MIT.txt': 'x', 'CREDITS.md': 'x' }), missing).skipped,
    ).toBeTruthy();
    const bare = checkProvenance(tempTree({ 'README.md': 'x' }), missing);
    expect(bare.errors.map((e) => e.path)).toEqual(['LICENSES/', 'CREDITS.md']);
  });
});
