import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { denyHash, parseDenyList } from '../../scripts/deny-hash';
import { decodeWordList, encodeWordList, inflateWordList } from './codec';
import { DICTIONARY_META } from './meta';
import type { Tier } from './tiers';
import { WORDS_DEFLATED } from './words.data';

async function allWords(): Promise<{ word: string; tier: Tier }[]> {
  const words: { word: string; tier: Tier }[] = [];
  decodeWordList(await inflateWordList(WORDS_DEFLATED), (word, tier) => words.push({ word, tier }));
  return words;
}

describe('the bundled dictionary', () => {
  it('holds the words and tiers its build report counted', async () => {
    const words = await allWords();
    expect(words).toHaveLength(DICTIONARY_META.words);
    const byTier = [0, 0, 0, 0];
    for (const { tier } of words) byTier[tier]!++;
    expect(byTier).toEqual([...DICTIONARY_META.byTier]);
  });

  it('is sorted, free of duplicates and of a playable shape', async () => {
    const words = (await allWords()).map(({ word }) => word);
    for (let i = 1; i < words.length; i++) expect(words[i - 1]! < words[i]!).toBe(true);
    expect(words.every((word) => /^[a-z]{3,}$/.test(word) && !/q(?!u)/.test(word))).toBe(true);
    expect(words).toEqual(
      expect.arrayContaining(['chain', 'letter', 'cube', 'quota', 'colour', 'color']),
    );
  });

  it('keeps out every word on the deny-list', async () => {
    const entries = parseDenyList(
      readFileSync(new URL('../../scripts/deny-list.txt', import.meta.url), 'utf8'),
    );
    const exact = new Set(entries.filter((e) => e.kind === 'exact').map((e) => e.hash));
    const prefixes = new Set(entries.filter((e) => e.kind === 'prefix').map((e) => e.hash));
    const offending = (await allWords()).filter(({ word }) => {
      if (exact.has(denyHash(word))) return true;
      for (let end = 2; end <= word.length; end++)
        if (prefixes.has(denyHash(word.slice(0, end)))) return true;
      return false;
    });
    expect(offending).toEqual([]);
  });

  it('round-trips through its front-coded form', () => {
    const sample = [
      { word: 'cat', tier: 0 as Tier },
      { word: 'catalogue', tier: 2 as Tier },
      { word: 'cats', tier: 0 as Tier },
      { word: 'dog', tier: 1 as Tier },
    ];
    const decoded: { word: string; tier: Tier }[] = [];
    decodeWordList(encodeWordList(sample), (word, tier) => decoded.push({ word, tier }));
    expect(decoded).toEqual(sample);
  });
});
