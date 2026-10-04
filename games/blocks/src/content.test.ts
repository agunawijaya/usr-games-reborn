import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../manifest.json';
import { DIVES } from './dives/dives';
import { CLASSIC_HINT, ENDINGS, START_HINT } from './modes/copy';
import { LESSONS } from './modes/tutorial';
import { PACKAGES } from './modes/packages';

/**
 * Sinkers' words are its own, fit for every age, and never borrow the name or the vocabulary of
 * the famous games this one is related to. When the BSD originals are on this machine (they never
 * enter the repo), every message the 1992 program and its manual could print is pulled from them
 * at test time and looked for in our code, copy and docs.
 */

const ORIGINALS = process.env.USR_GAMES_ORIGINALS ?? 'E:\\Projects\\BSDGames\\BSDGames-master';
// Spelled in pieces, so this file does not carry the words it looks for.
const ORIGINAL_NAME = ['tet', 'ris'].join('');
const ORIGINAL = join(ORIGINALS, ORIGINAL_NAME);
const GAME_ROOT = join(__dirname, '..');

/**
 * The trademark and the words for its pieces and a well-known turning trick. Allowed only in the
 * repo's CREDITS.md and in the provenance section of NOTES.md.
 */
const FORBIDDEN_WORDS = new RegExp(
  [['tet', 'r(?:is|imino|omino)'].join(''), ['t-?', 'spin'].join('')].join('|'),
  'i',
);

/** Fragments of the original's strings long enough to be its own wording. */
function originalMessages(): string[] {
  const fragments = new Set<string>();
  const keep = (text: string) => {
    for (const piece of text.split(/%[-\d.]*[a-z]|\\[a-z]/i)) {
      const words = piece.replace(/\s+/g, ' ').trim().toLowerCase();
      const letters = words.replace(/[^a-z]/g, '').length;
      if (words.length >= 14 && letters >= words.length * 0.6) fragments.add(words);
    }
  };
  for (const name of readdirSync(ORIGINAL).filter((n) => n.endsWith('.c'))) {
    const source = readFileSync(join(ORIGINAL, name), 'latin1');
    for (const [, literal] of source.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) keep(literal!);
  }
  // The manual, sentence by sentence, without its formatting requests.
  const manual = readFileSync(join(ORIGINAL, `${ORIGINAL_NAME}.6.in`), 'latin1')
    .split('\n')
    .filter((line) => !line.startsWith('.\\"'))
    .map((line) => line.replace(/^\.[A-Za-z]+\s*/, '').replace(/\\f[BIRP]/g, ''))
    .join(' ');
  for (const sentence of manual.split(/[.!?:;]\s+/)) keep(sentence);
  return [...fragments];
}

/** Every text file of this game's folder, by path, except media, dependencies and test output. */
function ourFiles(): { path: string; text: string }[] {
  const files: { path: string; text: string }[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (['node_modules', 'test-results', 'media', 'dist'].includes(name)) continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|md|json|css|html)$/.test(name))
        files.push({
          path: relative(GAME_ROOT, path).replace(/\\/g, '/'),
          text: readFileSync(path, 'utf8'),
        });
    }
  };
  walk(GAME_ROOT);
  return files;
}

/** The manifest without the two credit fields that may name the original program. */
function manifestWithoutCredit(): string {
  const copy = JSON.parse(JSON.stringify(manifest)) as Record<string, Record<string, unknown>>;
  delete copy.inspiredBy!.program;
  delete copy.inspiredBy!.originalTitle;
  return JSON.stringify(copy);
}

/** NOTES.md may quote the original's name in its provenance section ("Sources read") only. */
function withoutProvenance(text: string): string {
  return text.replace(/## Sources read[\s\S]*?(?=\n## )/, '');
}

/** The words a player reads: endings, hints, lessons, packages, dives, the manifest. */
function playerCopy(): string[] {
  return [
    ...Object.values(ENDINGS).flatMap((e) => [e.title, e.story]),
    START_HINT,
    CLASSIC_HINT,
    ...Object.values(LESSONS).flatMap((lesson) => [lesson.title, lesson.body]),
    ...PACKAGES.flatMap((p) => [p.title, p.description]),
    ...DIVES.flatMap((d) => [d.title, d.idea]),
    manifest.title,
    manifest.tagline,
    manifest.teaser,
    ...manifest.howToPlay,
  ];
}

describe('the words of Sinkers', () => {
  it.skipIf(!existsSync(ORIGINAL))(
    'never reuse a message of the original program or its manual',
    () => {
      const messages = originalMessages();
      expect(messages.length).toBeGreaterThan(10);
      const text = ourFiles()
        .filter((f) => !f.path.endsWith('.test.ts'))
        .map((f) => f.text)
        .join('\n')
        .replace(/\s+/g, ' ')
        .toLowerCase();
      expect(messages.filter((message) => text.includes(message))).toEqual([]);
    },
  );

  it('never name the famous relatives or their pieces: not in strings, identifiers or docs', () => {
    const offenders = ourFiles()
      .map((file) => {
        let text = file.text;
        if (file.path === 'manifest.json') text = manifestWithoutCredit();
        if (file.path === 'docs/NOTES.md') text = withoutProvenance(text);
        return FORBIDDEN_WORDS.test(text) ? file.path : null;
      })
      .filter(Boolean);
    expect(offenders).toEqual([]);
  });

  it('stay gentle: a full tank is only a full tank', () => {
    const UNKIND =
      /\b(kill\w*|dead|death|dies?|died|blood\w*|hurt\w*|drown\w*|crush\w*|fail\w*|lose[rs]?)\b/i;
    expect(playerCopy().filter((line) => UNKIND.test(line))).toEqual([]);
  });

  it('keep the manifest and the packages in step', () => {
    expect(manifest.packages.map((p) => p.id)).toEqual(PACKAGES.map((p) => p.id));
    for (const [i, entry] of manifest.packages.entries()) {
      expect(entry).toMatchObject({
        title: PACKAGES[i]!.title,
        description: PACKAGES[i]!.description,
        tier: PACKAGES[i]!.tier,
      });
    }
  });
});
