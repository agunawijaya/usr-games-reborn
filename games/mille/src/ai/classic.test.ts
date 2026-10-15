import { describe, expect, it } from 'vitest';
import { DUEL_DECK, KINDS, type Kind, isSafety } from '../engine/cards';
import { canCoup, HAND_SLOTS } from '../engine/hand';
import { newMatch, nextDriverAction, nextHand, step } from '../engine/match';
import {
  type Player,
  type SafetyKnown,
  type View,
  calcMove,
  handMilesOf,
  wantsExtension,
} from './classic';
import fixtures from './classic.fixtures.json';

/**
 * Classic against the original. The fixtures are positions from seeded games, each with the
 * answer the original `comp.c` gave when compiled outside the repository (scripts/
 * compare-classic.ts, NOTES.md "Classic against comp.c"): its move and its need table after the
 * move, or whether it would extend.
 */

const kindOf = (code: number): Kind | null => (code < 0 ? null : KINDS[code]!);

function readPlayer(fields: number[]): { player: Player; hand: (Kind | null)[] } {
  const [battle, speed, canGo, mileage, , , , , m200, s0, s1, s2, s3, ...hand] = fields;
  return {
    player: {
      battle: kindOf(battle!),
      speed: kindOf(speed!),
      canGo: canGo === 1,
      mileage: mileage!,
      numMiles200: m200!,
      safety: [s0, s1, s2, s3] as SafetyKnown[],
    },
    hand: hand.slice(0, HAND_SLOTS).map(kindOf),
  };
}

function readPosition(input: string): { mode: number; view: View } {
  const n = input.split(' ').map(Number);
  const [mode, end, deckLeft, numGos] = n;
  const seen = n.slice(4, 23);
  const numNeed = n.slice(23, 42);
  const op = readPlayer(n.slice(42, 62));
  const pp = readPlayer(n.slice(62, 82));
  const rolls = n.slice(82, 92);
  let next = 0;
  return {
    mode: mode!,
    view: {
      pp: pp.player,
      op: op.player,
      hand: pp.hand,
      end: end!,
      seen,
      numCards: KINDS.map((kind) => DUEL_DECK[kind]),
      deckLeft: deckLeft!,
      deckSize: 101,
      memory: { numGos: numGos!, numNeed },
      roll: () => rolls[next++]!,
    },
  };
}

describe('Classic against comp.c', () => {
  it(`agrees on all ${fixtures.length} recorded positions`, () => {
    let agreed = 0;
    for (const { input, original } of fixtures) {
      const { mode, view } = readPosition(input);
      let answer: string;
      if (mode === 1) answer = wantsExtension(view, handMilesOf(view.hand)) ? '1' : '0';
      else {
        const decision = calcMove(view);
        const movetype = decision.type === 'discard' ? 0 : decision.type === 'draw' ? 1 : 2;
        const slot = decision.type === 'draw' ? 0 : decision.slot;
        answer = [movetype, slot, ...view.memory.numNeed].join(' ');
      }
      if (answer === original) agreed++;
    }
    expect(agreed).toBe(fixtures.length);
  });
});

describe('Classic in play', () => {
  it('never discards a safety, and parries every hazard it can', () => {
    let parries = 0;
    for (let g = 0; g < 40; g++) {
      const match = newMatch({
        teams: false,
        length: 'short',
        seed: `rules:${g}`,
        drivers: ['classic', 'rookie'],
      });
      while (!match.over) {
        if (match.hand.over) {
          nextHand(match);
          continue;
        }
        const hand = match.hand;
        const action = nextDriverAction(match)!;
        if (action.seat === 0) {
          if (action.type === 'discard') {
            expect(isSafety(hand.cards[hand.seats[0]!.hand[action.slot]!]!)).toBe(false);
          }
          const parry = hand.seats[0]!.hand.findIndex((_, slot) => canCoup(hand, 0, slot));
          if (parry >= 0 && hand.turn === 0) {
            expect(action).toMatchObject({ type: 'play', slot: parry });
            parries++;
          }
        }
        step(match, action);
      }
    }
    expect(parries).toBeGreaterThan(5);
  });
});

describe('the drivers', () => {
  it('rank Rookie below Classic', () => {
    let classicWins = 0;
    const games = 160;
    for (let g = 0; g < games; g++) {
      const drivers = g % 2 ? (['rookie', 'classic'] as const) : (['classic', 'rookie'] as const);
      const match = newMatch({
        teams: false,
        length: 'short',
        seed: `rank:${g}`,
        drivers: [...drivers],
      });
      while (!match.over) {
        if (match.hand.over) nextHand(match);
        else step(match, nextDriverAction(match)!);
      }
      if (match.winner === (g % 2 ? 1 : 0)) classicWins++;
    }
    // Recorded over 2000 full games in NOTES.md: Classic beats Rookie about 88% of the time.
    expect(classicWins / games).toBeGreaterThan(0.75);
  });
});
