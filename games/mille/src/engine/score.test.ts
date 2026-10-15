import { describe, expect, it } from 'vitest';
import { type HandState, apply } from './hand';
import { rulesFor } from './match';
import { POINTS, scoreHand, scoreSide } from './score';
import { stackedHand } from './stacked';

/**
 * Every scoring item of the original's score window (end.c, mille.h): the values, and who earns
 * them. Positions are set up directly on the piles; the hand is closed by hand where needed.
 */

const duel = rulesFor({ teams: false, length: 'single', seed: 't', drivers: [null, null] });
const filler = ['m50', 'm75', 'm100', 'm50', 'm75', 'm100'] as const;

function fresh(): HandState {
  return stackedHand(duel, [[...filler], [...filler]]);
}

function finish(state: HandState, side: 0 | 1, miles = state.end): void {
  state.sides[side].miles = miles;
  state.over = true;
}

describe('the score window', () => {
  it('uses the original values', () => {
    expect(POINTS).toEqual({
      safety: 100,
      allSafeties: 300,
      coup: 300,
      trip: 400,
      safeTrip: 300,
      delayedAction: 300,
      extension: 200,
      shutOut: 500,
    });
  });

  it('counts milestones for both sides, finished or not', () => {
    const state = fresh();
    state.sides[0].miles = 425;
    state.sides[1].miles = 375;
    state.over = true;
    const [a, b] = scoreHand(state);
    expect(a.milestones).toBe(425);
    expect(b.milestones).toBe(375);
    expect(a.trip + b.trip).toBe(0);
  });

  it('pays 100 a safety, 300 more for all four, and 300 a coup fourré on top', () => {
    const state = fresh();
    state.sides[0].safeties = {
      longRangeTank: 'coup',
      runFlats: 'played',
      roadSense: 'played',
      greenWave: 'coup',
    };
    state.sides[0].coups = 2;
    const score = scoreSide(state, 0);
    expect(score.safeties).toBe(400);
    expect(score.allSafeties).toBe(300);
    expect(score.coups).toBe(600);
  });

  it('gives the trip, safe-trip and shut-out bonuses only to the side that finished', () => {
    const state = fresh();
    state.sides[1].miles = 0;
    finish(state, 0);
    const [a, b] = scoreHand(state);
    expect(a).toMatchObject({
      trip: 400,
      safeTrip: 300,
      shutOut: 500,
      delayedAction: 0,
      extension: 0,
    });
    expect(b).toMatchObject({ trip: 0, safeTrip: 0, shutOut: 0 });
  });

  it('withholds the safe trip once a 200 is played, and the shut-out once the rival has moved', () => {
    const state = fresh();
    state.sides[0].distanceCounts.m200 = 1;
    state.sides[1].miles = 25;
    finish(state, 0);
    expect(scoreSide(state, 0)).toMatchObject({ trip: 400, safeTrip: 0, shutOut: 0 });
  });

  it('pays delayed action when the trip is finished after the deck ran out', () => {
    const state = fresh();
    state.deck = [];
    state.sides[1].miles = 100;
    finish(state, 0);
    expect(scoreSide(state, 0).delayedAction).toBe(300);
  });

  it('pays the extension bonus to whoever completes the extended trip', () => {
    const state = fresh();
    state.end = 1000;
    state.extendedBy = 0;
    state.sides[0].miles = 700;
    state.sides[1].miles = 1000;
    state.over = true;
    expect(scoreSide(state, 1)).toMatchObject({ trip: 400, extension: 200 });
    expect(scoreSide(state, 0)).toMatchObject({ trip: 0, extension: 0, milestones: 700 });
  });

  it('adds every item into the total', () => {
    const state = fresh();
    state.sides[0].safeties.roadSense = 'coup';
    state.sides[0].coups = 1;
    state.sides[1].miles = 0;
    finish(state, 0);
    // 700 miles + 100 safety + 300 coup + 400 trip + 300 safe trip + 500 shut-out
    expect(scoreSide(state, 0).total).toBe(2300);
  });

  it('scores a hand played through to the trip', () => {
    const state = stackedHand(duel, [
      ['greenLight', 'm200', 'm200', 'm100', 'm100', 'm100'],
      [...filler],
    ]);
    const take = (seat: number, kind: string) => {
      apply(state, { type: 'draw', seat });
      const slot = state.seats[seat]!.hand.findIndex((c) => c !== null && state.cards[c] === kind);
      apply(state, slot >= 0 ? { type: 'play', seat, slot } : { type: 'discard', seat, slot: 0 });
    };
    for (const kind of ['greenLight', 'm200', 'm200', 'm100', 'm100']) {
      take(0, kind);
      take(1, 'none');
    }
    take(0, 'm100');
    apply(state, { type: 'extend', seat: 0, extend: false });
    expect(state.over).toBe(true);
    expect(scoreSide(state, 0)).toMatchObject({
      milestones: 700,
      trip: 400,
      safeTrip: 0,
      shutOut: 500,
      total: 1600,
    });
  });
});
