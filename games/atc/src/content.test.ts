import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENDLESS_ARENAS } from './arenas/library';
import { CARRIERS, SPECIAL_CARRIERS } from './engine/traffic';

/**
 * Skyloom's words are its own. When the BSD originals are on this machine (they never enter the
 * repo), every message the 1986 program could print is pulled from its C source at test time and
 * looked for in our code, copy and docs. The second check keeps real airports and airlines out of
 * the names a player reads.
 */

const ORIGINALS = process.env.USR_GAMES_ORIGINALS ?? 'E:\\Projects\\BSDGames\\BSDGames-master';
const ORIGINAL_ATC = join(ORIGINALS, 'atc');
const GAME_ROOT = join(__dirname, '..');

/** Fragments of the original's string literals long enough to be its own wording. */
function originalMessages(): string[] {
  const fragments = new Set<string>();
  for (const name of readdirSync(ORIGINAL_ATC)) {
    if (!/\.(c|h|y|l)$/.test(name)) continue;
    const source = readFileSync(join(ORIGINAL_ATC, name), 'latin1');
    for (const [, literal] of source.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) {
      // Format directives and escapes split a message into the words between them.
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

describe("Skyloom's words", () => {
  it.skipIf(!existsSync(ORIGINAL_ATC))('never reuse a message of the 1986 program', () => {
    const messages = originalMessages();
    expect(messages.length).toBeGreaterThan(20);
    const text = ourText();
    expect(messages.filter((message) => text.includes(message))).toEqual([]);
  });

  it('name no real airport or airline', () => {
    const REAL = [
      'heathrow',
      'gatwick',
      'o’hare',
      "o'hare",
      'jfk',
      'laguardia',
      'schiphol',
      'changi',
      'narita',
      'haneda',
      'orly',
      'charles de gaulle',
      'logan',
      'dulles',
      'lufthansa',
      'british airways',
      'air france',
      'klm',
      'qantas',
      'emirates',
      'ryanair',
      'easyjet',
      'united airlines',
      'american airlines',
      'delta air',
      'southwest',
      'garuda',
      'cathay',
      'singapore airlines',
    ];
    const names = [
      ...ENDLESS_ARENAS.map((arena) => arena.name),
      ...CARRIERS.map((carrier) => carrier.name),
      ...Object.values(SPECIAL_CARRIERS).map((carrier) => carrier.name),
    ].map((name) => name.toLowerCase());
    for (const name of names)
      expect(
        REAL.filter((real) => name.includes(real)),
        name,
      ).toEqual([]);
  });
});
