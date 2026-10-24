import { describe, expect, it } from 'vitest';
import { type CardId, parseCard } from '@usr-games/kit/cards';
import { MINDS } from './ai/minds';
import { playGame } from './autoplay';
import {
  layAway,
  type MatchEvent,
  type MatchState,
  needsClaim,
  playCard,
  RIVAL,
  settleClaim,
  showNext,
  skunkOf,
  startMatch,
  type Step,
  YOU,
} from './match';

const c = (text: string): CardId => {
  const card = parseCard(text);
  if (card === null) throw new Error(`not a card: ${text}`);
  return card;
};
const cs = (text: string) => text.split(' ').map(c);

/**
 * A hand set up by the test: both players' six cards, the starter to be cut, the dealer and
 * the scores so far. The stock holds nothing but the starter, so the cut is certain.
 */
function table(options: {
  you: string;
  rival: string;
  starter: string;
  dealer: 0 | 1;
  scores?: [number, number];
  counting?: 'automatic' | 'yourself' | 'classic-1980';
  length?: 61 | 121;
}): MatchState {
  const { state } = startMatch(
    {
      length: options.length ?? 121,
      counting: options.counting ?? 'automatic',
      firstDealer: options.dealer,
    },
    'test-table',
  );
  return {
    ...state,
    dealt: [cs(options.you), cs(options.rival)],
    stock: new Array<CardId>(40).fill(c(options.starter)),
    scores: options.scores ?? [0, 0],
    backPegs: options.scores ? [...options.scores] : [0, 0],
  };
}

function run(state: MatchState, actions: ((s: MatchState) => Step)[]) {
  const events: MatchEvent[] = [];
  for (const action of actions) {
    const step = action(state);
    state = step.state;
    events.push(...step.events);
  }
  return { state, events };
}

const lay = (seat: 0 | 1, text: string) => (s: MatchState) => layAway(s, seat, cs(text));
const play = (seat: 0 | 1, text: string) => (s: MatchState) => playCard(s, seat, c(text));
const scored = (events: MatchEvent[]) =>
  events.flatMap((e) => (e.type === 'scored' ? [`${e.seat}:${e.reason}:${e.points}`] : []));

describe('the play to 31', () => {
  it('pegs a fifteen, a pair, thirty-one and the last card', () => {
    // The rival deals, so you lead.
    const start = table({
      you: '5c 5d 9h 2s kc qd',
      rival: '5h 10s 3c 4d js qs',
      starter: '7c',
      dealer: RIVAL,
    });
    const { state, events } = run(start, [
      lay(YOU, 'kc qd'),
      lay(RIVAL, 'js qs'),
      play(YOU, '5c'), // 5
      play(RIVAL, '10s'), // 15: two for the rival
      play(YOU, '5d'), // 20
      play(RIVAL, '5h'), // 25: a pair for the rival
      play(YOU, '2s'), // 27
      play(RIVAL, '4d'), // 31: two for the rival, and the count starts again with you
      play(YOU, '9h'), // 9
      play(RIVAL, '3c'), // 12, the rival's last card; you have none left: one for last
    ]);
    expect(scored(events)).toEqual(['1:play:2', '1:play:2', '1:play:2', '1:last-card:1']);
    expect(state.phase).toBe('show');
    expect(state.scores).toEqual([0, 7]);
  });

  it('gives one for the go and lets the other player keep laying cards', () => {
    const start = table({
      you: 'kc qd jh 9s 2c 3c',
      rival: 'kh ks 8c 7d ac ad',
      starter: '4h',
      dealer: YOU,
    });
    const { state, events } = run(start, [
      lay(YOU, '2c 3c'),
      lay(RIVAL, 'ac ad'),
      play(RIVAL, 'kh'), // 10
      play(YOU, 'kc'), // 20, a pair for you
      play(RIVAL, 'ks'), // 30, a pair royal for the rival
    ]);
    // You hold only tens and a nine: go. The rival cannot lay an 8 or a 7 on 30 either.
    expect(events.some((e) => e.type === 'go' && e.seat === YOU)).toBe(true);
    expect(scored(events)).toEqual(['0:play:2', '1:play:6', '1:go:1']);
    // The rival laid the last card, so you lead the new count.
    expect(state.play!.turn).toBe(YOU);
    expect(state.play!.count).toBe(0);
  });

  it('scores a run laid out of order and only the longest run', () => {
    const start = table({
      you: '5c 4d kc kd 2s 9c',
      rival: '2h 3c 6d qs 7h 8h',
      starter: 'ah',
      dealer: RIVAL,
    });
    const { events } = run(start, [
      lay(YOU, 'kc kd'),
      lay(RIVAL, '7h 8h'),
      play(YOU, '5c'), // 5
      play(RIVAL, '2h'), // 7
      play(YOU, '4d'), // 11
      play(RIVAL, '3c'), // 14: 5-2-4-3 is a run of four
      play(YOU, '2s'), // 16: the 2 repeats, so only 4-3-2 runs: three
    ]);
    const runs = events.flatMap((e) =>
      e.type === 'played'
        ? e.combos.filter((x) => x.kind === 'run').map((x) => `${e.seat}:${x.points}`)
        : [],
    );
    expect(runs).toEqual(['1:4', '0:3']);
  });

  it('pays two for his heels to the dealer when a jack is cut', () => {
    const start = table({
      you: 'ac 2c 3c 4c 5c 6c',
      rival: 'ad 2d 3d 4d 5d 6d',
      starter: 'jh',
      dealer: YOU,
    });
    const { events } = run(start, [lay(YOU, 'ac 2c'), lay(RIVAL, 'ad 2d')]);
    expect(scored(events)).toEqual(['0:his-heels:2']);
  });
});

describe('the show', () => {
  it('counts the non-dealer first, so they can go out before the dealer counts', () => {
    const start = table({
      you: '5c 5d 5h js 2c 3c',
      rival: 'kh qh 8c 7d ac ad',
      starter: '5s',
      dealer: RIVAL,
      scores: [100, 110],
    });
    let { state } = run(start, [lay(YOU, '2c 3c'), lay(RIVAL, 'ac ad')]);
    // Play out quickly: each player lays whatever is legal.
    while (state.phase === 'play') {
      const seat = state.play!.turn;
      const card = state.play!.inHand[seat].find(
        (x) => state.play!.count + Math.min(10, (x % 13) + 1) <= 31,
      )!;
      state = playCard(state, seat, card).state;
    }
    expect(state.phase).toBe('show');
    expect(state.scores[RIVAL]).toBeLessThan(121);
    const step = showNext(state);
    expect(step.state.phase).toBe('game-over');
    expect(step.state.winner).toBe(YOU);
    expect(step.events.some((e) => e.type === 'shown' && e.count.total === 29)).toBe(true);
  });

  it('settles claims by the counting mode', () => {
    expect(settleClaim('yourself', 9, 12)).toMatchObject({
      awarded: 12,
      penalty: 0,
      verdict: 'under',
    });
    expect(settleClaim('classic-1980', 14, 12)).toMatchObject({
      awarded: 12,
      penalty: 2,
      verdict: 'over',
    });
    expect(settleClaim('classic-1980', 8, 12)).toMatchObject({
      awarded: 8,
      penalty: 0,
      verdict: 'under',
    });
    // Nineteen is nothing: right for a hand of nothing, an under-count for anything else.
    expect(settleClaim('classic-1980', 19, 0)).toMatchObject({
      read: 0,
      awarded: 0,
      verdict: 'right',
    });
    expect(settleClaim('classic-1980', 19, 4)).toMatchObject({
      read: 0,
      awarded: 0,
      verdict: 'under',
    });
    expect(settleClaim('yourself', 19, 0)).toMatchObject({ read: 19, verdict: 'over', awarded: 0 });
  });

  it('asks you for a claim only when the mode says so, and pegs the over-count penalty', () => {
    const start = table({
      you: '5c 5d 6h 4s kc qc',
      rival: '2h 2s 8c 9d ac ad',
      starter: 'ks',
      dealer: RIVAL,
      counting: 'classic-1980',
    });
    let { state } = run(start, [lay(YOU, 'kc qc'), lay(RIVAL, 'ac ad')]);
    while (state.phase === 'play') {
      const seat = state.play!.turn;
      const card = state.play!.inHand[seat].find(
        (x) => state.play!.count + Math.min(10, (x % 13) + 1) <= 31,
      )!;
      state = playCard(state, seat, card).state;
    }
    expect(needsClaim(state)).toBe(true);
    expect(() => showNext(state)).toThrow();
    const before = [...state.scores];
    const step = showNext(state, 29);
    const shown = step.events.find((e) => e.type === 'shown');
    expect(shown && shown.type === 'shown' && shown.claim?.verdict).toBe('over');
    const actual = shown && shown.type === 'shown' ? shown.count.total : 0;
    expect(step.state.scores[YOU]).toBe(before[YOU]! + actual);
    expect(step.state.scores[RIVAL]).toBe(before[RIVAL]! + 2);
    // The rival's own hand is never claimed.
    expect(needsClaim(step.state)).toBe(false);
  });
});

describe('skunks', () => {
  it('follows the original arithmetic', () => {
    expect(skunkOf(91, 121)).toBe('none');
    expect(skunkOf(90, 121)).toBe('skunk');
    expect(skunkOf(61, 121)).toBe('skunk');
    expect(skunkOf(60, 121)).toBe('double-skunk');
    expect(skunkOf(31, 61)).toBe('none');
    expect(skunkOf(30, 61)).toBe('skunk');
    expect(skunkOf(0, 61)).toBe('double-skunk');
  });
});

describe('whole games', () => {
  it('plays to the end with every card accounted for', () => {
    for (let i = 0; i < 20; i++) {
      const game = playGame({ length: i % 2 ? 61 : 121, counting: 'automatic' }, `whole-${i}`, [
        MINDS.classic,
        MINDS.beginner,
      ]);
      const { state, events } = game;
      expect(state.phase).toBe('game-over');
      expect(Math.max(...state.scores)).toBe(state.options.length);
      expect(state.scores[state.winner!]).toBe(state.options.length);
      // Pegs only move forward, and the trailing peg always jumps to the old front.
      for (const e of events) if (e.type === 'scored') expect(e.to).toBeGreaterThan(e.from);
      const played = events.filter((e) => e.type === 'played').length;
      const laid = events.filter((e) => e.type === 'laid-away').length;
      expect(laid).toBe(state.hand * 2);
      expect(played).toBeLessThanOrEqual(state.hand * 8);
    }
  });

  it('replays the same game from the same seed', () => {
    const a = playGame({ length: 121, counting: 'automatic' }, 'replay', [
      MINDS.sharp,
      MINDS.classic,
    ]);
    const b = playGame({ length: 121, counting: 'automatic' }, 'replay', [
      MINDS.sharp,
      MINDS.classic,
    ]);
    expect(b.state.scores).toEqual(a.state.scores);
    expect(b.events.length).toBe(a.events.length);
  });

  it('claims correctly for a computer in your seat under every counting mode', () => {
    for (const counting of ['yourself', 'classic-1980'] as const) {
      const game = playGame({ length: 61, counting }, `claims-${counting}`, [
        MINDS.classic,
        MINDS.classic,
      ]);
      const claims = game.events.flatMap((e) => (e.type === 'shown' && e.claim ? [e.claim] : []));
      expect(claims.length).toBeGreaterThan(0);
      expect(claims.every((claim) => claim.verdict === 'right')).toBe(true);
    }
  });
});
