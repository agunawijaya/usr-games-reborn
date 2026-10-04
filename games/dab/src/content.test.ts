import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { validateManifest } from '@usr-games/kit/manifest';
import { describe, expect, it } from 'vitest';
import { PACKAGES } from './game/packages';

/**
 * Double Cross's words are its own. When the BSD originals are on this machine (they never enter
 * the repo), every message the 2003 program could print is pulled from its source at test time
 * and looked for in our code, copy and docs. The manifest must validate and list the same
 * packages the game installs.
 */

const ORIGINALS = process.env.USR_GAMES_ORIGINALS ?? 'E:\\Projects\\BSDGames\\BSDGames-master';
const ORIGINAL_DAB = join(ORIGINALS, 'dab');
const GAME_ROOT = join(__dirname, '..');

/** Fragments of the original's string literals long enough to be its own wording. */
function originalMessages(): string[] {
  const fragments = new Set<string>();
  for (const name of readdirSync(ORIGINAL_DAB)) {
    if (!/\.(cc|h)$/.test(name)) continue;
    const source = readFileSync(join(ORIGINAL_DAB, name), 'latin1');
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
      else if (/\.(ts|md|json|css|html)$/.test(name) && !name.endsWith('.test.ts')) {
        parts.push(readFileSync(path, 'utf8'));
      }
    }
  };
  for (const dir of ['src', 'docs', 'dev', 'scripts']) walk(join(GAME_ROOT, dir));
  parts.push(readFileSync(join(GAME_ROOT, 'manifest.json'), 'utf8'));
  return parts.join('\n').replace(/\s+/g, ' ').toLowerCase();
}

describe("Double Cross's words", () => {
  it.skipIf(!existsSync(ORIGINAL_DAB))('never reuse a message of the 2003 program', () => {
    const messages = originalMessages();
    expect(messages.length).toBeGreaterThanOrEqual(8);
    const text = ourText();
    expect(messages.filter((message) => text.includes(message))).toEqual([]);
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
