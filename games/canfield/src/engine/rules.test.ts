import { type CardId, parseCard, type Rank } from '@usr-games/kit/cards';
import { describe, expect, it } from 'vitest';
import { composeDeal } from './compose';
import {
  applyMove,
  canBuild,
  canDeal,
  canHome,
  homeCount,
  type Layout,
  legalMoves,
  type Move,
  openDeal,
  STALL_TURNS,
  type Step,
} from './rules';

/** Faithfulness tests: one block per rule the 1983 program enforces (prompt §2, NOTES.md). */

const c = (text: string): CardId => parseCard(text)!;
const cs = (text: string): CardId[] => (text ? text.split(' ').map(c) : []);

function layout(parts: Partial<Layout> & { baseRank: Rank }): Layout {
  return {
    rules: 'standard',
    stock: [],
    tableau: [[], [], [], []],
    foundations: [],
    hand: [],
    talon: [],
    run: 1,
    idleTurns: 0,
    stage: 'full',
    outcome: null,
    ...parts,
  };
}

function play(state: Layout, move: Move): Step {
  const step = applyMove(state, move);
  if (!step) throw new Error(`illegal: ${JSON.stringify(move)}`);
  return step;
}

describe('the deal', () => {
  it('lays cards out in the original order: reserve, base, tableau, hand by threes', () => {
    const deal = composeDeal({
      stock: ['2c', '3c', '4c', '5c', '6c', '8c', '9c', '10c', 'jc', 'qc', 'kc', 'ac', '2d'],
      base: '7h',
      tableau: ['9s', '3d', 'qs', '5h'],
      hand: ['2s', '4d', '8s', '10h'],
    });
    const { layout: state } = openDeal(deal, 'standard');
    expect(state.baseRank).toBe(7);
    expect(state.foundations).toEqual([[c('7h')]]);
    expect(state.stock).toHaveLength(13);
    expect(state.stock.at(-1)).toBe(c('2d'));
    expect(state.tableau).toEqual([[c('9s')], [c('3d')], [c('qs')], [c('5h')]]);
    // Three cards dealt; the third is the one showing.
    expect(state.talon).toEqual(cs('2s 4d 8s'));
    expect(state.hand).toHaveLength(31);
    expect(state.hand.at(-1)).toBe(c('10h'));
  });

  it('sends base-rank cards home from the tableau, then the reserve, then the talon', () => {
    const deal = composeDeal({
      stock: ['2c', '3c', '4c', '5c', '6c', '8c', '9c', '10c', 'jc', 'qc', 'kc', '7d', '7c'],
      base: '7h',
      tableau: ['9s', '7s', 'qs', '5h'],
      hand: ['2s', '4d', '8s'],
    });
    const { layout: state, events } = openDeal(deal, 'standard');
    expect(state.foundations).toEqual([[c('7h')], [c('7s')], [c('7c')], [c('7d')]]);
    expect(state.tableau[1]).toEqual([]);
    expect(state.stock.at(-1)).toBe(c('kc'));
    expect(events.filter((e) => e.kind === 'home').every((e) => e.kind === 'home' && e.auto)).toBe(
      true,
    );
  });

  it('sweeps base cards off the talon one after another as they show', () => {
    const deal = composeDeal({
      base: '7h',
      tableau: ['9s', '3d', 'qs', '5h'],
      hand: ['2s', '7c', '7s', '4d', '5d', '9d'],
    });
    const { layout: state } = openDeal(deal, 'standard');
    // 7♠ shows on top, goes home, then 7♣ shows and goes home, then 2♠ is left showing.
    expect(state.foundations.map((f) => f[0])).toEqual(cs('7h 7s 7c'));
    expect(state.talon).toEqual(cs('2s'));
  });
});

describe('foundations', () => {
  it('build up in suit, wrapping from king to ace', () => {
    const state = layout({
      baseRank: 12,
      foundations: [cs('qh kh')],
      tableau: [cs('ah'), cs('ad'), [], []],
    });
    expect(canHome(state, 0)).toBe(true);
    expect(canHome(state, 1)).toBe(false);
    const next = play(state, { kind: 'home', from: 0 }).layout;
    expect(next.foundations[0]).toEqual(cs('qh kh ah'));
  });

  it('take cards only on foundations already founded', () => {
    const state = layout({ baseRank: 5, foundations: [cs('5h')], tableau: [cs('6s'), [], [], []] });
    expect(canHome(state, 0)).toBe(false);
  });

  it('take the reserve top and the talon top', () => {
    const state = layout({
      baseRank: 5,
      foundations: [cs('5h'), cs('5s')],
      stock: cs('9c 6h'),
      talon: cs('2d 6s'),
    });
    expect(canHome(state, 'stock')).toBe(true);
    expect(canHome(state, 'talon')).toBe(true);
  });
});

describe('the tableau', () => {
  it('builds down in alternating colours, a king going on an ace', () => {
    const state = layout({
      baseRank: 5,
      foundations: [cs('5h')],
      tableau: [cs('ah'), cs('kc'), cs('kd'), cs('qs')],
    });
    expect(canBuild(state, 1, 0, 1)).toBe(true);
    expect(canBuild(state, 2, 0, 1)).toBe(false);
    expect(canBuild(state, 3, 0, 1)).toBe(false);
  });

  it('moves only whole piles in Standard, any run in Relaxed', () => {
    const standard = layout({
      baseRank: 5,
      foundations: [cs('5h')],
      tableau: [cs('10d 9c 8h'), cs('10s'), cs('9s'), []],
    });
    expect(canBuild(standard, 0, 1, 3)).toBe(false); // 10♦ on 10♠
    expect(canBuild(standard, 0, 2, 1)).toBe(false); // 8♥ alone, part of a pile
    expect(canBuild(standard, 0, 2, 3)).toBe(false);
    const relaxed = { ...standard, rules: 'relaxed' as const };
    expect(canBuild(relaxed, 0, 2, 1)).toBe(true);
    expect(canBuild(relaxed, 0, 1, 2)).toBe(false); // 9♣ on 10♠, same colour
    const moved = play(relaxed, { kind: 'build', from: 0, to: 2, count: 1 }).layout;
    expect(moved.tableau[0]).toEqual(cs('10d 9c'));
    expect(moved.tableau[2]).toEqual(cs('9s 8h'));
  });

  it('moves a whole pile onto a fitting card', () => {
    const state = layout({
      baseRank: 5,
      foundations: [cs('5h')],
      tableau: [cs('9c 8h'), cs('10d'), cs('3s'), cs('4s')],
    });
    const moved = play(state, { kind: 'build', from: 0, to: 1, count: 2 }).layout;
    expect(moved.tableau[1]).toEqual(cs('10d 9c 8h'));
    expect(moved.tableau[0]).toEqual([]);
  });

  it('never moves a pile into a space', () => {
    const state = layout({
      baseRank: 5,
      foundations: [cs('5h')],
      tableau: [cs('9c 8h'), [], cs('3s'), cs('4s')],
      stock: cs('2c'),
    });
    expect(canBuild(state, 0, 1, 2)).toBe(false);
    expect(canBuild({ ...state, rules: 'relaxed' }, 0, 1, 1)).toBe(false);
  });

  it('fills spaces from the reserve, and from the talon only once the reserve is empty', () => {
    const withReserve = layout({
      baseRank: 5,
      foundations: [cs('5h')],
      tableau: [[], cs('3s'), cs('4s'), cs('2s')],
      stock: cs('jc qd'),
      talon: cs('9h'),
    });
    expect(canBuild(withReserve, 'stock', 0)).toBe(true);
    expect(canBuild(withReserve, 'talon', 0)).toBe(false);
    const reserveGone = { ...withReserve, stock: [] };
    expect(canBuild(reserveGone, 'talon', 0)).toBe(true);
  });

  it('lets the player keep a space open: nothing fills it on its own', () => {
    const state = layout({
      baseRank: 5,
      foundations: [cs('5h')],
      tableau: [cs('6h'), cs('3s'), cs('4s'), cs('2s')],
      stock: cs('jc qd'),
      talon: cs('9h'),
      hand: cs('2d 3d 4d'),
    });
    const after = play(state, { kind: 'home', from: 0 }).layout;
    expect(after.tableau[0]).toEqual([]);
    expect(after.stock).toEqual(cs('jc qd'));
  });
});

describe('the hand and the talon', () => {
  it('deals by threes, the last one or two alone', () => {
    const state = layout({ baseRank: 5, foundations: [cs('5h')], hand: cs('2s 3s 4s 6s') });
    const once = play(state, { kind: 'deal' }).layout;
    expect(once.talon).toEqual(cs('6s 4s 3s'));
    const twice = play(once, { kind: 'deal' }).layout;
    expect(twice.talon).toEqual(cs('6s 4s 3s 2s'));
    expect(twice.hand).toEqual([]);
  });

  it('turns the talon over in the same order and deals three again', () => {
    const state = layout({
      baseRank: 5,
      foundations: [cs('5h')],
      talon: cs('2s 3s 4s 6s 8s'),
    });
    const { layout: next, events } = play(state, { kind: 'deal' });
    expect(events[0]).toEqual({ kind: 'turned-over', run: 2 });
    expect(next.run).toBe(2);
    expect(next.talon).toEqual(cs('2s 3s 4s'));
    expect(next.hand).toEqual(cs('8s 6s'));
  });

  it('deals three free cards when the talon runs dry', () => {
    const state = layout({
      baseRank: 5,
      foundations: [cs('5h')],
      tableau: [cs('10s'), [], [], []],
      talon: cs('9h'),
      hand: cs('2s 3s 4s 6s'),
    });
    const { layout: next, events } = play(state, { kind: 'build', from: 'talon', to: 0, count: 1 });
    expect(next.talon).toEqual(cs('6s 4s 3s'));
    expect(events.some((e) => e.kind === 'dealt' && e.auto)).toBe(true);
  });

  it(`ends a Standard deal on the ${STALL_TURNS}th turn-over in a row without a card moving`, () => {
    let state = layout({
      baseRank: 5,
      foundations: [cs('5h')],
      tableau: [cs('ks'), cs('kc'), cs('qs'), cs('qc')],
      talon: cs('2s 3s 4s'),
    });
    for (let turn = 1; turn < STALL_TURNS; turn++) {
      state = play(state, { kind: 'deal' }).layout;
      expect(state.outcome).toBeNull();
      expect(state.idleTurns).toBe(turn);
    }
    const last = play(state, { kind: 'deal' });
    expect(last.layout.outcome).toBe('stalled');
    expect(last.events).toEqual([{ kind: 'stalled' }]);
  });

  it('forgets idle turn-overs whenever a card moves', () => {
    const state = layout({
      baseRank: 5,
      foundations: [cs('5h')],
      tableau: [cs('6h'), cs('kc'), cs('qs'), cs('qc')],
      talon: cs('2s 3s 4s'),
      idleTurns: 3,
    });
    expect(play(state, { kind: 'home', from: 0 }).layout.idleTurns).toBe(0);
  });

  it('never ends a Relaxed deal for going round', () => {
    let state = layout({
      rules: 'relaxed',
      baseRank: 5,
      foundations: [cs('5h')],
      tableau: [cs('ks'), cs('kc'), cs('qs'), cs('qc')],
      talon: cs('2s 3s 4s'),
    });
    for (let turn = 0; turn < 12; turn++) state = play(state, { kind: 'deal' }).layout;
    expect(state.outcome).toBeNull();
    expect(state.run).toBe(13);
  });
});

describe('stages', () => {
  const deal = composeDeal({ base: '7h', tableau: ['9s', '8d', 'qs', '5h'] });

  it('allows no move before the inspection is bought', () => {
    const { layout: state } = openDeal(deal, 'standard', 'dealt');
    expect(legalMoves(state)).toEqual([]);
  });

  it('allows moves but no deal from the hand during the inspection', () => {
    const { layout: state } = openDeal(deal, 'standard', 'inspection');
    expect(canDeal(state)).toBe(false);
    expect(canBuild(state, 1, 0, 1)).toBe(true);
  });
});

describe('winning', () => {
  it('ends the deal when the fifty-second card goes home', () => {
    const suits = ['h', 's', 'd', 'c'];
    const order = ['5', '6', '7', '8', '9', '10', 'j', 'q', 'k', 'a', '2', '3', '4'];
    const foundations = suits.map((s, i) =>
      cs(
        order
          .slice(0, i === 3 ? 12 : 13)
          .map((r) => r + s)
          .join(' '),
      ),
    );
    const state = layout({ baseRank: 5, foundations, tableau: [cs('4c'), [], [], []] });
    const step = play(state, { kind: 'home', from: 0 });
    expect(homeCount(step.layout)).toBe(52);
    expect(step.layout.outcome).toBe('won');
    expect(step.events.at(-1)).toEqual({ kind: 'won' });
  });
});
