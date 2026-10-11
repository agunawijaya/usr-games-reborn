import { beforeAll, describe, expect, it } from 'vitest';
import { loadDictionary } from '../dictionary/load';
import { dealBoard } from '../engine/deal';
import { spell } from '../engine/grid';
import { planHunt, STRENGTHS } from '../engine/hunter';
import type { FoundWord } from '../engine/round';
import type { Trie } from '../engine/trie';
import { rollOf } from '../render/attract';
import { ATTRACT_BOARDS } from '../render/attract-boards';
import { CLOCK_SECONDS, modeLabel, type RoundPlan } from './modes';
import {
  addToBook,
  emptyBook,
  emptyRecords,
  packagesForFind,
  readingLevel,
  recordRound,
  type RoundOutcome,
  sanitizeRecords,
  sizeUnlocked,
} from './records';
import { dailyShareText } from './share';

let trie: Trie;
beforeAll(async () => {
  trie = await loadDictionary();
});

const plan = (overrides: Partial<RoundPlan> = {}): RoundPlan => ({
  mode: 'classic',
  size: 4,
  rule: 'classic',
  minLetters: 3,
  seconds: 180,
  seed: 's',
  ...overrides,
});

function found(word: string, comboLevel = 0, tier: 0 | 1 | 2 | 3 = 0): FoundWord {
  return { word, path: [0, 1, 2], points: 1, comboLevel, at: 1, tier };
}

function outcome(
  foundWords: number,
  total: number,
  overrides: Partial<RoundOutcome> = {},
): RoundOutcome {
  return {
    plan: plan(),
    found: Array.from({ length: foundWords }, (_, i) =>
      found(`word${String.fromCharCode(97 + (i % 26))}${i}`),
    ),
    total,
    score: foundWords,
    bestChain: 1,
    bandTotals: [total, 0, 0],
    elapsed: 180,
    ...overrides,
  };
}

describe('the hunter', () => {
  /** Mean share of the board each strength finds on 4×4 boards in three minutes. */
  it('climbs evenly through its five strengths (locked from scripts/hunter-sim.ts)', () => {
    const targets: Record<number, [number, number]> = {
      1: [0.11, 0.22],
      2: [0.25, 0.38],
      3: [0.39, 0.53],
      4: [0.52, 0.67],
      5: [0.65, 0.8],
    };
    const deals = Array.from({ length: 60 }, (_, i) =>
      dealBoard(trie, { size: 4, rule: 'classic', seed: `lock-${i}`, minLetters: 3 }),
    );
    for (const strength of STRENGTHS) {
      const share =
        deals.reduce(
          (sum, deal, i) =>
            sum +
            planHunt(deal.words, strength, CLOCK_SECONDS[4], `lock-${i}`).length /
              deal.words.length,
          0,
        ) / deals.length;
      const [low, high] = targets[strength]!;
      expect(share, `strength ${strength}`).toBeGreaterThan(low);
      expect(share, `strength ${strength}`).toBeLessThan(high);
    }
  });

  it('plans the same hunt from the same seed, in time order, within the round', () => {
    const deal = dealBoard(trie, { size: 4, rule: 'classic', seed: 'hunt', minLetters: 3 });
    const a = planHunt(deal.words, 3, 180, 'x');
    expect(planHunt(deal.words, 3, 180, 'x')).toEqual(a);
    for (let i = 1; i < a.length; i++) expect(a[i]!.at).toBeGreaterThan(a[i - 1]!.at);
    expect(a.every((find) => find.at <= 180)).toBe(true);
  });
});

describe('records', () => {
  it('pools the reading level over timed rounds and opens the larger grids', () => {
    let records = emptyRecords();
    for (let i = 0; i < 2; i++)
      records = recordRound(records, outcome(30, 100), '2026-10-11').records;
    expect(readingLevel(records)).toBeNull();
    records = recordRound(records, outcome(30, 100), '2026-10-11').records;
    expect(readingLevel(records)).toBeCloseTo(0.3);
    expect(sizeUnlocked(records, 5)).toBe(true);
    expect(sizeUnlocked(records, 6)).toBe(false);
    const zen = recordRound(
      records,
      outcome(90, 100, { plan: plan({ mode: 'zen', seconds: null }) }),
      '2026-10-11',
    ).records;
    expect(readingLevel(zen)).toBeCloseTo(0.3);
  });

  it('earns coverage, rule, grid and duel packages from a round', () => {
    const big = recordRound(
      emptyRecords(),
      outcome(80, 100, { plan: plan({ rule: 'echo', size: 6, seconds: 300 }) }),
      'd',
    );
    expect(big.earned).toEqual(
      expect.arrayContaining(['coverage-50', 'coverage-75', 'echo-master', 'mega-grid']),
    );
    const duel = recordRound(
      emptyRecords(),
      outcome(10, 100, {
        plan: plan({ mode: 'duel', strength: 5 }),
        score: 40,
        hunter: { finds: [], score: 39, strength: 5 },
      }),
      'd',
    );
    expect(duel.earned).toContain('beat-the-hunter');
    expect(duel.records.duels['5']).toEqual({ played: 1, won: 1 });
  });

  it('keeps the first try of each Daily Grid and counts seven for the regular', () => {
    let records = emptyRecords();
    for (let day = 1; day <= 7; day++) {
      const result = recordRound(
        records,
        outcome(5, 50, { plan: plan({ mode: 'daily' }) }),
        `2026-10-0${day}`,
      );
      records = result.records;
      if (day === 7) expect(result.earned).toContain('daily-regular');
    }
    const again = recordRound(
      records,
      outcome(40, 50, { plan: plan({ mode: 'daily' }) }),
      '2026-10-01',
    ).records;
    expect(again.dailies['2026-10-01']!.found).toBe(5);
  });

  it('awards mid-round packages for the first word, Qu, long words and the ×3 chain', () => {
    expect(packagesForFind(found('quota'), ['qu', 'o', 't'])).toEqual(['first-chain', 'qu-word']);
    expect(packagesForFind(found('lettered', 3), ['a', 'b', 'c'])).toEqual([
      'first-chain',
      'eight-letters',
      'combo-x3',
    ]);
  });

  it('repairs a damaged save instead of failing', () => {
    expect(sanitizeRecords({ rounds: 4 } as never).level).toEqual({
      found: 0,
      total: 0,
      boards: 0,
    });
    expect(sanitizeRecords(null)).toEqual(emptyRecords());
  });

  it('files only new words in the book', () => {
    const first = addToBook(emptyBook(), [{ word: 'cat', tier: 0 }]);
    const second = addToBook(first.book, [
      { word: 'cat', tier: 0 },
      { word: 'quoit', tier: 3 },
    ]);
    expect(second.added).toEqual([{ word: 'quoit', tier: 3 }]);
    expect(Object.keys(second.book.words)).toEqual(['cat', 'quoit']);
  });
});

describe('words on screen', () => {
  it('writes the Daily share line in the prompt’s form, link-free', () => {
    const text = dailyShareText(42, {
      found: 38,
      total: 93,
      score: 70,
      longest: 'trapeze',
      bands: [20, 15, 3],
      bandTotals: [30, 40, 23],
    });
    expect(text).toBe('Chain Letter #42 · 38 words · 41% of the board · longest: TRAPEZE · 🟩🟨🟨');
    expect(
      dailyShareText(
        1,
        { found: 1, total: 4, score: 1, longest: 'cat', bands: [1, 0, 0], bandTotals: [2, 2, 0] },
        true,
      ),
    ).toBe('Chain Letter #1 · 1 word · 25% of the board · longest: CAT · 🟦⬛⬜');
  });

  it('names rounds plainly', () => {
    expect(modeLabel(plan())).toBe('Classic · 4×4');
    expect(modeLabel(plan({ mode: 'duel', strength: 4, size: 5, rule: 'mirror' }))).toBe(
      'Duel · Scholar · Big grid 5×5 · Mirror',
    );
    expect(modeLabel(plan({ mode: 'daily', dailyNumber: 41 }))).toBe('Daily Grid #41');
  });

  it('keeps every showcase word spelled by its path on its board', () => {
    for (const board of ATTRACT_BOARDS) {
      const roll = rollOf(board);
      for (const { word, path } of board.words) {
        expect(spell(roll.board, path)).toBe(word);
        expect(trie.has(word)).toBe(true);
      }
    }
  });
});
