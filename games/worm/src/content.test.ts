import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../manifest.json';
import { endingText, START_HINT, TEMPO_HINT } from './modes/copy';
import { LESSONS } from './modes/tutorial';
import { PACKAGES } from './modes/packages';
import { GARDENS } from './gardens/gardens';
import { PUZZLES } from './gardens/puzzles';

/**
 * Noodle Nine's words are its own and fit for every age. When the BSD originals are on this
 * machine (they never enter the repo), every message `worm` and its manual could print is pulled
 * from them at test time and looked for in our code, copy and docs.
 */

const ORIGINALS = process.env.USR_GAMES_ORIGINALS ?? 'E:\\Projects\\BSDGames\\BSDGames-master';
const ORIGINAL_WORM = join(ORIGINALS, 'worm');
const GAME_ROOT = join(__dirname, '..');

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
  const source = readFileSync(join(ORIGINAL_WORM, 'worm.c'), 'latin1');
  for (const [, literal] of source.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) keep(literal!);
  // The manual, sentence by sentence, without its formatting requests.
  const manual = readFileSync(join(ORIGINAL_WORM, 'worm.6'), 'latin1')
    .split('\n')
    .filter((line) => !line.startsWith('.\\"'))
    .map((line) => line.replace(/^\.[A-Za-z]+\s*/, '').replace(/\\f[BIRP]/g, ''))
    .join(' ');
  for (const sentence of manual.split(/[.!?:;]\s+/)) keep(sentence);
  return [...fragments];
}

/** Everything a player or a reader of this game's folder sees. */
function ourText(): string {
  const parts: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === 'test-results' || name === 'media') continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|md|json|css)$/.test(name) && !name.endsWith('.test.ts'))
        parts.push(readFileSync(path, 'utf8'));
    }
  };
  for (const dir of ['src', 'docs', 'dev']) walk(join(GAME_ROOT, dir));
  parts.push(readFileSync(join(GAME_ROOT, 'manifest.json'), 'utf8'));
  return parts.join('\n').replace(/\s+/g, ' ').toLowerCase();
}

/** The words a player reads: endings, hints, lessons, packages, gardens, puzzles, the manifest. */
function playerCopy(): string[] {
  const endings = (['wall', 'rock', 'self', 'flow', 'out-of-numbers'] as const).flatMap((loss) => {
    const text = endingText('lost', loss);
    return [text.title, text.story];
  });
  const wins = (['grown', 'filled'] as const).flatMap((status) => {
    const text = endingText(status, null);
    return [text.title, text.story];
  });
  return [
    ...endings,
    ...wins,
    START_HINT,
    TEMPO_HINT,
    ...Object.values(LESSONS).flatMap((lesson) => [lesson.title, lesson.body]),
    ...PACKAGES.flatMap((p) => [p.title, p.description]),
    ...GARDENS.flatMap((g) => [g.title, g.idea]),
    ...PUZZLES.map((p) => p.title),
    manifest.title,
    manifest.tagline,
    manifest.teaser,
    ...manifest.howToPlay,
  ];
}

describe('the words of Noodle Nine', () => {
  it.skipIf(!existsSync(ORIGINAL_WORM))(
    'never reuse a message of the original program or its manual',
    () => {
      const messages = originalMessages();
      expect(messages.length).toBeGreaterThan(10);
      const text = ourText();
      expect(messages.filter((message) => text.includes(message))).toEqual([]);
    },
  );

  it('never hurt anyone in the copy: a bonk is only ever a bonk', () => {
    const FORBIDDEN =
      /\b(kill\w*|dead|death|dies?|died|blood\w*|hurt\w*|starv\w*|crash\w*|squash\w*)\b/i;
    expect(playerCopy().filter((line) => FORBIDDEN.test(line))).toEqual([]);
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
