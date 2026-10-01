import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { validateManifest } from '@usr-games/kit/manifest';
import { describe, expect, it } from 'vitest';
import { WORLDS } from './data/worlds';
import { PACKAGES } from './game/packages';

/**
 * Lightkeeper's words are its own. When the BSD originals are on this machine (they never enter
 * the repo), every message the 1976 program could print is pulled from its C source at test time
 * and looked for in our code, copy and docs. The manifest must validate and list the same
 * packages the game installs.
 */

const ORIGINALS = process.env.USR_GAMES_ORIGINALS ?? 'E:\\Projects\\BSDGames\\BSDGames-master';
const ORIGINAL_TREK = join(ORIGINALS, 'trek');
const GAME_ROOT = join(__dirname, '..');

/** Fragments of the original's string literals long enough to be its own wording. */
function originalMessages(): string[] {
  const fragments = new Set<string>();
  for (const name of readdirSync(ORIGINAL_TREK)) {
    if (!/\.(c|h)$/.test(name)) continue;
    const source = readFileSync(join(ORIGINAL_TREK, name), 'latin1');
    for (const [, literal] of source.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) {
      for (const piece of literal!.split(/%[-\d.]*[a-z]|\\[a-z]/i)) {
        const words = piece.replace(/\s+/g, ' ').trim().toLowerCase();
        const letters = words.replace(/[^a-z]/g, '').length;
        if (words.length >= 14 && letters >= words.length * 0.6) fragments.add(words);
      }
    }
  }
  return [...fragments];
}

/** Everything a player or a reader of this game's folder sees. */
function ourText(): string {
  const parts: string[] = [];
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
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

describe("Lightkeeper's words", () => {
  it.skipIf(!existsSync(ORIGINAL_TREK))('never reuse a message of the 1976 program', () => {
    const messages = originalMessages();
    expect(messages.length).toBeGreaterThan(50);
    const text = ourText();
    expect(messages.filter((message) => text.includes(message))).toEqual([]);
  });

  it('names thirty-two worlds of our own, each once', () => {
    expect(WORLDS).toHaveLength(32);
    expect(new Set(WORLDS.map((w) => w.name)).size).toBe(32);
  });
});

describe('the manifest', () => {
  const manifest = JSON.parse(readFileSync(join(GAME_ROOT, 'manifest.json'), 'utf8'));

  it('validates', () => {
    const result = validateManifest(manifest);
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it('lists exactly the packages the game installs', () => {
    expect(manifest.packages.map((p: { id: string }) => p.id)).toEqual(PACKAGES.map((p) => p.id));
    expect(manifest.packages.map((p: { tier: string }) => p.tier)).toEqual(
      PACKAGES.map((p) => p.tier),
    );
  });
});
