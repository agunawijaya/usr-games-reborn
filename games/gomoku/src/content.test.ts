import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../manifest.json';
import { OPPONENTS } from './engine/opponents';
import { PACKAGES } from './modes/packages';

/**
 * Fivefold's words are its own and fit for every age. When the BSD originals are on this machine
 * (they never enter the repo), every message the 1994 program and its manual could print is
 * pulled from them at test time and looked for in our code, copy and docs — its three result
 * lines above all.
 */

const ORIGINALS = process.env.USR_GAMES_ORIGINALS ?? 'E:\\Projects\\BSDGames\\BSDGames-master';
// Spelled in pieces, so this file does not carry the name it keeps out of the player's sight.
const ORIGINAL_NAME = ['go', 'moku'].join('');
const ORIGINAL = join(ORIGINALS, ORIGINAL_NAME);
const GAME_ROOT = join(__dirname, '..');

/** Trademarked games of the same family, never named in our files. */
const FORBIDDEN_WORDS = new RegExp(
  [['pen', 'te'].join(''), ['connect', '[- ]?(?:four|4)'].join('')].join('|'),
  'i',
);

/** Fragments of the original's strings long enough to be its own wording. */
function originalMessages(): string[] {
  const fragments = new Set<string>();
  const keep = (text: string, shortest: number) => {
    for (const piece of text.split(/%[-\d.]*[a-z]|\\[a-z]/i)) {
      const words = piece.replace(/\s+/g, ' ').trim().toLowerCase();
      const letters = words.replace(/[^a-z]/g, '').length;
      if (words.length >= shortest && letters >= words.length * 0.6) fragments.add(words);
    }
  };
  for (const name of readdirSync(ORIGINAL).filter((n) => n.endsWith('.c'))) {
    const source = readFileSync(join(ORIGINAL, name), 'latin1');
    // The result lines are short: they are held to a lower bar.
    for (const [, literal] of source.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) keep(literal!, 10);
  }
  const manual = readFileSync(join(ORIGINAL, `${ORIGINAL_NAME}.6`), 'latin1')
    .split('\n')
    .filter((line) => !line.startsWith('.\\"'))
    .map((line) => line.replace(/^\.[A-Za-z]+\s*/, '').replace(/\\f[BIRP]/g, ''))
    .join(' ');
  for (const sentence of manual.split(/[.!?:;]\s+/)) keep(sentence, 24);
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

/** The words a player reads: opponents' lines, packages, the manifest. */
function playerCopy(): string[] {
  return [
    ...OPPONENTS.flatMap((o) => [
      o.name,
      o.temperament,
      o.hello,
      o.afterWin,
      o.afterLoss,
      o.afterDraw,
    ]),
    ...PACKAGES.flatMap((p) => [p.title, p.description]),
    manifest.title,
    manifest.tagline,
    manifest.teaser,
    ...manifest.howToPlay,
  ];
}

describe('the words of Fivefold', () => {
  it.skipIf(!existsSync(ORIGINAL))(
    'never reuse a message of the original program or its manual',
    () => {
      const messages = originalMessages();
      expect(messages.length).toBeGreaterThan(10);
      const text = ourFiles()
        .filter(
          (f) =>
            !f.path.endsWith('.test.ts') && f.path !== 'src/engine/campbell/reference-games.json',
        )
        .map((f) => f.text)
        .join('\n')
        .replace(/\s+/g, ' ')
        .toLowerCase();
      expect(messages.filter((message) => text.includes(message))).toEqual([]);
    },
  );

  it('never name the trademarked relatives', () => {
    expect(
      ourFiles()
        .filter((f) => FORBIDDEN_WORDS.test(f.text))
        .map((f) => f.path),
    ).toEqual([]);
  });

  it('call the original by its description, not its program name, wherever a player reads', () => {
    const name = new RegExp(ORIGINAL_NAME, 'i');
    expect(playerCopy().filter((line) => name.test(line))).toEqual([]);
  });

  it('stay kind: nobody gloats, nobody is told off', () => {
    const UNKIND =
      /\b(ha ha|rats|loser|stupid|easy win|too easy|pathetic|crush\w*|destroy\w*|kill\w*|dead|death|blood\w*|hurt\w*|fail\w*)\b/i;
    expect(playerCopy().filter((line) => UNKIND.test(line))).toEqual([]);
  });

  it('keep the manifest and the packages in step', () => {
    expect(manifest.packages.map((p) => p.id)).toEqual(PACKAGES.map((p) => p.id));
    for (const [i, entry] of manifest.packages.entries())
      expect(entry).toMatchObject({
        title: PACKAGES[i]!.title,
        description: PACKAGES[i]!.description,
        tier: PACKAGES[i]!.tier,
      });
  });

  it('give every package the prompt asks for', () => {
    expect(PACKAGES.map((p) => p.id).sort()).toEqual(
      [
        'first-five',
        'beat-each-opponent',
        'beat-campbell',
        'referee-slayer',
        'exactly-five-win',
        'puzzle-50',
        'no-overlay-win',
        'white-win',
        'four-four',
        'fast-five',
        'league-fan',
        'daily-regular',
      ].sort(),
    );
  });
});
