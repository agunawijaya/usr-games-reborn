import { rankOf } from '@usr-games/kit/cards';
import { describe, expect, it } from 'vitest';
import { isFullDeck } from '@usr-games/kit/cards';
import { startGame, playMove, type Game } from '../engine/game';
import { CHALLENGES, conditionsMet, decodeMove, encodeMove, goalText } from './challenges';
import { TUTORIAL_DEAL } from './tutorial';
import { openDeal } from '../engine/rules';
import { solve } from '../engine/solver';

/** Every challenge ships with a proof; replaying it through the real rules must meet the goal. */

describe('challenges', () => {
  it('are twenty-four, in four sets of six, each a full deck', () => {
    expect(CHALLENGES).toHaveLength(24);
    expect(new Set(CHALLENGES.map((c) => c.set)).size).toBe(4);
    for (const c of CHALLENGES) expect(isFullDeck(c.deal)).toBe(true);
  });

  for (const challenge of CHALLENGES) {
    it(`${challenge.number}. ${challenge.title}: the proof meets the goal`, () => {
      let game: Game = startGame(
        { kind: 'challenge', seed: challenge.id, challenge: challenge.id },
        challenge.deal,
        challenge.rules,
        'points',
      ).game;
      let met = false;
      for (const code of challenge.proof) {
        const move = decodeMove(code);
        expect(move, code).not.toBeNull();
        const step = playMove(game, move!, 0);
        expect(step, `${challenge.id} ${code}`).not.toBeNull();
        game = step!.game;
        // A goal without a win is met the moment it happens.
        if (conditionsMet(challenge.conditions, game, 0)) met = true;
      }
      expect(met || conditionsMet(challenge.conditions, game, 0)).toBe(true);
    });
  }

  it('name their base when the title promises one', () => {
    const base = (id: string) => rankOf(CHALLENGES.find((c) => c.id === id)!.deal[13]!);
    expect(base('c03')).toBe(7);
    expect(base('c10')).toBe(13);
    expect(base('c12')).toBe(1);
    expect(base('c15')).toBe(12);
    expect(base('c24')).toBe(7);
  });

  it('describe their goals plainly', () => {
    expect(goalText([{ kind: 'win' }])).toBe('Win.');
    expect(
      goalText([{ kind: 'win' }, { kind: 'max-passes', passes: 2 }, { kind: 'no-insight' }]),
    ).toBe('Win in at most two passes, without Insight.');
    expect(goalText([{ kind: 'win' }, { kind: 'max-passes', passes: 1 }])).toBe(
      'Win in a single pass.',
    );
    expect(goalText([{ kind: 'cards-home', count: 39 }])).toBe('Get 39 cards home.');
    expect(goalText([{ kind: 'reserve-first-pass' }])).toBe(
      'Empty the reserve before the talon turns over.',
    );
    expect(goalText([{ kind: 'win' }, { kind: 'time', seconds: 180 }])).toBe(
      'Win in under three minutes.',
    );
  });

  it('encode moves compactly and read them back', () => {
    for (const code of ['d', 'sf', 'tf', '3f', 's2', 't4', '12', '34:3'])
      expect(encodeMove(decodeMove(code)!)).toBe(code);
  });
});

describe('the tutorial deal', () => {
  it('opens as the lessons say: base 3♥, 4♥ in pile 1, K♠ on the reserve, 2♣ showing', () => {
    const { layout } = openDeal(TUTORIAL_DEAL, 'standard');
    expect(isFullDeck(TUTORIAL_DEAL)).toBe(true);
    expect(layout.baseRank).toBe(3);
    expect(layout.foundations).toHaveLength(1);
    expect(layout.tableau.map((p) => p[0])).toEqual([29, 8, 20, 49]);
    expect(layout.stock.at(-1)).toBe(51);
    expect(layout.talon.at(-1)).toBe(1);
  });

  it('is easy to win', () => {
    const verdict = solve(openDeal(TUTORIAL_DEAL, 'standard').layout, { nodeBudget: 2000 });
    expect(verdict.result).toBe('winnable');
  });
});
