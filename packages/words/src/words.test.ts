import { describe, expect, it } from 'vitest';
import { decodeWordList, encodeWordList, SIZES } from './codec.js';
import {
  agreedWords,
  COMMON_MAX_SIZE,
  isCommonWord,
  scowlSizeOf,
  uncommonReason,
  WORD_SOURCE,
} from './index.js';

describe('the stored format', () => {
  it('decodes exactly what it encodes, sizes included', () => {
    const entries: [string, number][] = [
      ['harbour', 35],
      ['harbourmaster', 60],
      ['harbours', 35],
      ['hard', 10],
      ['hardtack', 50],
    ];
    const decoded: [string, number][] = [];
    decodeWordList(encodeWordList(entries), (word, size) => decoded.push([word, size]));
    expect(decoded).toEqual(entries);
  });

  it('refuses a size SCOWL does not have below 70', () => {
    expect(() => encodeWordList([['word', 30]])).toThrow();
    expect(SIZES).toEqual([10, 20, 35, 40, 50, 55, 60]);
  });
});

describe('the agreed list', () => {
  const words = agreedWords();

  it('holds as many words as its source says, per size and in all', () => {
    expect(words.size).toBe(WORD_SOURCE.agreed);
    const bySize: Record<number, number> = {};
    for (const size of words.values()) bySize[size] = (bySize[size] ?? 0) + 1;
    expect(bySize).toEqual(WORD_SOURCE.bySize);
    expect(WORD_SOURCE.agreed).toBe(75786);
  });

  it('counts the common words up to size 50', () => {
    const common = [...words.values()].filter((size) => size <= COMMON_MAX_SIZE).length;
    expect(WORD_SOURCE.common).toBe(common);
    expect(WORD_SOURCE.common).toBe(61792);
  });

  it('keeps only plain lower-case words of three letters or more, sorted', () => {
    const list = [...words.keys()];
    expect(list.filter((word) => !/^[a-z]{3,}$/.test(word))).toEqual([]);
    expect(list).toEqual([...list].sort());
  });

  it('knows a word at its smallest size', () => {
    expect(scowlSizeOf('house')).toBe(10);
    expect(scowlSizeOf('catamaran')).toBe(40);
    expect(scowlSizeOf('sandcastle')).toBeUndefined();
    expect(scowlSizeOf('hardtack')).toBe(50);
    expect(scowlSizeOf('alembic')).toBe(60);
  });
});

describe('common words', () => {
  it('accepts words both lists know at the common sizes', () => {
    expect(isCommonWord('anchor')).toBe(true);
    expect(isCommonWord('sarcophagus')).toBe(true);
    expect(uncommonReason('treasure')).toBeNull();
  });

  it('turns away rare, one-list and misshapen words, and says why', () => {
    expect(isCommonWord('pipette')).toBe(false);
    expect(uncommonReason('pipette')).toMatch(/size 55/);
    expect(uncommonReason('kraken')).toBe('not in both SCOWL and ENABLE');
    expect(uncommonReason('Anchor')).toBe('not a plain lower-case word');
    expect(isCommonWord('')).toBe(false);
  });
});
