import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../manifest.json';
import { REFUSALS, TUTORIAL_LINES, endingText } from './modes/copy';
import { PACKAGES } from './modes/packages';

/**
 * Hush the Wumpus's words are its own and fit for every age. When the BSD originals are on this
 * machine (they never enter the repo), every message the original program and its manual could
 * print is pulled from them at test time and looked for in our code, copy and docs.
 */

const ORIGINALS = process.env.USR_GAMES_ORIGINALS ?? 'E:\\Projects\\BSDGames\\BSDGames-master';
const ORIGINAL_WUMP = join(ORIGINALS, 'wump');
const GAME_ROOT = join(__dirname, '..');

/** Fragments of the original's strings long enough to be its own wording. */
function originalMessages(): string[] {
  const fragments = new Set<string>();
  const keep = (text: string) => {
    for (const piece of text.split(/%[-\d.]*[a-z]|\\[a-z]/i)) {
      const words = piece.replace(/\s+/g, ' ').trim().toLowerCase();
      const letters = words.replace(/[^a-z]/g, '').length;
      if (words.length >= 18 && letters >= words.length * 0.6) fragments.add(words);
    }
  };
  const source = readFileSync(join(ORIGINAL_WUMP, 'wump.c'), 'latin1');
  for (const [, literal] of source.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) keep(literal!);
  // The instructions the program printed, sentence by sentence.
  const info = readFileSync(join(ORIGINAL_WUMP, 'wump.info'), 'latin1');
  for (const sentence of info.split(/[.!?:;\n]{1,2}\s*/)) keep(sentence);
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

/** The words a player reads during play: the copy module, the packages and the manifest. */
function playerCopy(): string[] {
  const endings = (['hushed', 'bowled-over', 'pit', 'own-dart', 'empty-quiver'] as const).flatMap(
    (kind) => {
      const text = endingText(
        kind === 'bowled-over' ? { kind, room: 1, cause: 'walked-in' } : { kind, room: 1 },
      );
      return [text.title, text.story];
    },
  );
  return [
    ...endings,
    ...Object.values(REFUSALS),
    ...Object.values(TUTORIAL_LINES).flatMap((line) => [line.title, line.body]),
    ...PACKAGES.flatMap((p) => [p.title, p.description]),
    manifest.title,
    manifest.tagline,
    manifest.teaser,
    ...manifest.howToPlay,
  ];
}

describe('the words of Hush the Wumpus', () => {
  it.skipIf(!existsSync(ORIGINAL_WUMP))(
    'never reuse a message of the original program or its instructions',
    () => {
      const messages = originalMessages();
      expect(messages.length).toBeGreaterThan(30);
      const text = ourText();
      expect(messages.filter((message) => text.includes(message))).toEqual([]);
    },
  );

  it('never hurt anyone in the copy', () => {
    const FORBIDDEN =
      /\b(kill\w*|dead|death|dies?|died|eat(s|en)?|eat you|shoot\w*|shot|blood\w*|hurt\w*)\b/i;
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
