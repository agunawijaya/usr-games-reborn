import { type CardId, parseCard, type Rank } from '@usr-games/kit/cards';
import { describe, expect, it } from 'vitest';
import {
  anyCardCanMove,
  bestMove,
  canSweepHome,
  describeMove,
  plainHint,
  sweepMove,
} from './assist';
import { parseCommand } from './commands';
import { applyMove, type Layout } from './rules';

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

describe('the best place for a clicked card', () => {
  it('sends a card home before anywhere else', () => {
    const state = layout({
      baseRank: 5,
      foundations: [cs('5h')],
      tableau: [cs('7s'), [], [], []],
      talon: cs('6h'),
    });
    expect(bestMove(state, 'talon', 1)).toEqual({ kind: 'home', from: 'talon' });
  });

  it('builds on a card before filling a space', () => {
    const state = layout({
      baseRank: 5,
      foundations: [cs('5h')],
      tableau: [[], cs('7s'), [], []],
      stock: cs('6d'),
    });
    expect(bestMove(state, 'stock', 1)).toEqual({ kind: 'build', from: 'stock', to: 1, count: 1 });
  });

  it('fills a space from the reserve when nothing else fits', () => {
    const state = layout({
      baseRank: 5,
      foundations: [cs('5h')],
      tableau: [cs('2s'), [], [], []],
      stock: cs('9h'),
    });
    expect(bestMove(state, 'stock', 1)).toEqual({ kind: 'build', from: 'stock', to: 1, count: 1 });
  });

  it('gives null when a card can go nowhere', () => {
    const state = layout({
      baseRank: 5,
      foundations: [cs('5h')],
      tableau: [cs('2s'), cs('3s'), cs('4s'), cs('9s')],
      talon: cs('9h'),
      stock: cs('jc'),
    });
    expect(bestMove(state, 'talon', 1)).toBeNull();
  });
});

describe('the sweep home', () => {
  it('begins once nothing is hidden, and always finishes', () => {
    let state = layout({
      baseRank: 5,
      foundations: [cs('5h 6h'), cs('5s 6s'), cs('5d'), cs('5c')],
      tableau: [cs('7d 6c'), cs('8s 7h'), cs('7s 6d'), cs('7c')],
    });
    expect(canSweepHome(state)).toBe(true);
    for (let i = 0; i < 20 && canSweepHome(state); i++)
      state = applyMove(state, sweepMove(state)!)!.layout;
    expect(state.tableau.every((p) => p.length === 0)).toBe(true);
  });
});

describe('dead ends', () => {
  it('knows when no card can move however the hand is dealt', () => {
    const stuck = layout({
      baseRank: 5,
      foundations: [cs('5h')],
      tableau: [cs('ks'), cs('kc'), cs('qs'), cs('qc')],
      talon: cs('2s 3s 4s'),
    });
    expect(anyCardCanMove(stuck)).toBe(false);
    const moving = { ...stuck, talon: cs('2s 3s 6h') };
    expect(anyCardCanMove(moving)).toBe(true);
  });

  it('looks into the hand for a card that would fit', () => {
    const state = layout({
      baseRank: 5,
      foundations: [cs('5h')],
      tableau: [cs('ks'), cs('kc'), cs('qs'), cs('qc')],
      talon: cs('2s'),
      hand: cs('6h 4s 3s'),
    });
    expect(anyCardCanMove(state)).toBe(true);
  });
});

describe('words', () => {
  it('describes moves plainly', () => {
    const state = layout({
      baseRank: 5,
      foundations: [cs('5h')],
      tableau: [cs('7s'), [], [], []],
      talon: cs('6h'),
      hand: cs('2c'),
    });
    expect(describeMove(state, { kind: 'home', from: 'talon' })).toBe(
      'the six of hearts from the talon home',
    );
    expect(describeMove(state, { kind: 'build', from: 'talon', to: 0, count: 1 })).toBe(
      'the six of hearts from the talon onto the seven of spades',
    );
    expect(describeMove(state, { kind: 'deal' })).toBe('deal three from the hand');
  });

  it('gives a plain hint, home first', () => {
    const state = layout({
      baseRank: 5,
      foundations: [cs('5h')],
      tableau: [cs('7s'), [], [], []],
      talon: cs('6h'),
    });
    expect(plainHint(state)).toEqual({ kind: 'home', from: 'talon' });
  });
});

describe('typed commands', () => {
  const state = layout({
    rules: 'relaxed',
    baseRank: 5,
    foundations: [cs('5h')],
    tableau: [cs('10d 9c 8h'), cs('9s'), [], []],
    talon: cs('6h'),
  });

  it('reads the original command set', () => {
    expect(parseCommand('tf', state)).toEqual({
      kind: 'move',
      move: { kind: 'home', from: 'talon' },
    });
    expect(parseCommand(' S3 ', state)).toEqual({
      kind: 'move',
      move: { kind: 'build', from: 'stock', to: 2, count: 1 },
    });
    expect(parseCommand('ht', state)).toEqual({ kind: 'move', move: { kind: 'deal' } });
    expect(parseCommand('1f', state)).toEqual({ kind: 'move', move: { kind: 'home', from: 0 } });
    expect(parseCommand('c', state)).toEqual({ kind: 'insight' });
    expect(parseCommand('q', state)).toEqual({ kind: 'quit' });
    expect(parseCommand('zz', state).kind).toBe('unknown');
    expect(parseCommand('5f', state).kind).toBe('unknown');
  });

  it('moves the longest run that fits in Relaxed', () => {
    expect(parseCommand('12', state)).toEqual({
      kind: 'move',
      move: { kind: 'build', from: 0, to: 1, count: 1 },
    });
  });
});
