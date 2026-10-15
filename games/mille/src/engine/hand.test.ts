import { describe, expect, it } from 'vitest';
import { DUEL_DECK, TEAM_DECK, type Kind, deckSize } from './cards';
import {
  type HandState,
  apply,
  canCoup,
  compactHand,
  kindAt,
  legalActions,
  playVerdict,
} from './hand';
import { rulesFor } from './match';
import { stackedHand } from './stacked';

/**
 * The rules of play as the original enforces them (mille.6, move.c `playcard`), one by one.
 * Seat 0 opens unless a test says otherwise; `slotOf` finds a card in a hand by kind.
 */

const duel = rulesFor({ teams: false, length: 'single', seed: 't', drivers: [null, null] });
const teams = rulesFor({
  teams: true,
  length: 'single',
  seed: 't',
  drivers: [null, null, null, null],
});

const filler: Kind[] = ['m50', 'm75', 'm100', 'm50', 'm75', 'm100'];

function slotOf(state: HandState, seat: number, kind: Kind): number {
  const slot = state.seats[seat]!.hand.findIndex((c) => c !== null && state.cards[c] === kind);
  if (slot < 0) throw new Error(`seat ${seat} holds no ${kind}`);
  return slot;
}

function draw(state: HandState, seat = state.turn) {
  return apply(state, { type: 'draw', seat });
}

function play(state: HandState, seat: number, kind: Kind) {
  return apply(state, { type: 'play', seat, slot: slotOf(state, seat, kind) });
}

function discard(state: HandState, seat: number, kind: Kind) {
  return apply(state, { type: 'discard', seat, slot: slotOf(state, seat, kind) });
}

/** Seat `seat` draws and plays `kind`, or draws and discards its first filler card. */
function turn(state: HandState, seat: number, kind?: Kind) {
  draw(state, seat);
  if (kind) return play(state, seat, kind);
  return discard(state, seat, kindAt(state, seat, 0) ?? 'm50');
}

describe('the deck', () => {
  it('holds the 101 cards the manual lists', () => {
    expect(deckSize(DUEL_DECK)).toBe(101);
    expect(DUEL_DECK).toMatchObject({ m25: 10, m50: 10, m75: 10, m100: 12, m200: 4 });
    expect(DUEL_DECK).toMatchObject({
      noFuel: 2,
      flatTyre: 2,
      fenderBender: 2,
      redLight: 4,
      slowZone: 3,
    });
    expect(DUEL_DECK).toMatchObject({
      fillUp: 6,
      spareTyre: 6,
      mechanic: 6,
      greenLight: 14,
      openRoad: 6,
    });
    expect(DUEL_DECK).toMatchObject({ longRangeTank: 1, runFlats: 1, roadSense: 1, greenWave: 1 });
  });

  it('adds one of every hazard for partnerships', () => {
    expect(deckSize(TEAM_DECK)).toBe(106);
  });
});

describe('the deal and the draw', () => {
  it('gives six cards each and leaves the pick slot empty', () => {
    const state = stackedHand(duel, [filler, filler]);
    expect(state.seats.map((s) => s.hand.filter((c) => c !== null).length)).toEqual([6, 6]);
    expect(state.seats[0]!.hand[0]).toBeNull();
    expect(state.deck).toHaveLength(89);
  });

  it('insists on the pick before any card but a cure is played', () => {
    const state = stackedHand(duel, [['greenLight', ...filler.slice(1)], filler]);
    expect(playVerdict(state, 0, slotOf(state, 0, 'greenLight'))).toBe('draw-first');
    draw(state);
    expect(playVerdict(state, 0, slotOf(state, 0, 'greenLight'))).toBe('ok');
  });

  it('drops the picked card into the gap a play leaves', () => {
    const hand = [7, 1, 2, null, 4, 5, 6];
    compactHand(hand);
    expect(hand).toEqual([null, 1, 2, 7, 4, 5, 6]);
  });
});

describe('rolling', () => {
  it('needs a green light before any miles', () => {
    const state = stackedHand(duel, [['m100', 'greenLight', ...filler.slice(2)], filler]);
    draw(state);
    expect(playVerdict(state, 0, slotOf(state, 0, 'm100'))).toBe('need-green');
    play(state, 0, 'greenLight');
    turn(state, 1);
    draw(state);
    expect(playVerdict(state, 0, slotOf(state, 0, 'm100'))).toBe('ok');
  });

  it('lets the green wave roll without a green light', () => {
    const state = stackedHand(duel, [['greenWave', 'm100', ...filler.slice(2)], filler]);
    draw(state);
    play(state, 0, 'greenWave');
    expect(state.turn).toBe(0);
    draw(state);
    expect(playVerdict(state, 0, slotOf(state, 0, 'm100'))).toBe('ok');
  });

  it('keeps a slow zone to 25s and 50s until the open road', () => {
    const state = stackedHand(duel, [
      ['greenLight', 'm75', 'm50', 'openRoad', 'm25', 'm25'],
      ['slowZone', ...filler.slice(1)],
    ]);
    turn(state, 0, 'greenLight');
    turn(state, 1, 'slowZone');
    draw(state);
    expect(playVerdict(state, 0, slotOf(state, 0, 'm75'))).toBe('slow-zone');
    expect(playVerdict(state, 0, slotOf(state, 0, 'm50'))).toBe('ok');
    play(state, 0, 'openRoad');
    turn(state, 1);
    draw(state);
    expect(playVerdict(state, 0, slotOf(state, 0, 'm75'))).toBe('ok');
  });

  it('allows no more than two 200s and nothing past the trip', () => {
    const state = stackedHand(duel, [
      ['greenLight', 'm200', 'm200', 'm200', 'm100', 'm100'],
      filler,
    ]);
    turn(state, 0, 'greenLight');
    turn(state, 1);
    turn(state, 0, 'm200');
    turn(state, 1);
    turn(state, 0, 'm200');
    turn(state, 1);
    draw(state);
    expect(playVerdict(state, 0, slotOf(state, 0, 'm200'))).toBe('two-long-hauls');
    play(state, 0, 'm100');
    turn(state, 1);
    turn(state, 0, 'm100');
    turn(state, 1);
    expect(state.sides[0].miles).toBe(600);
    draw(state);
    state.sides[0].miles = 650;
    expect(playVerdict(state, 0, slotOf(state, 0, 'm50'))).toBe('ok');
    state.sides[0].miles = 675;
    expect(playVerdict(state, 0, slotOf(state, 0, 'm50'))).toBe('over-trip');
  });
});

describe('hazards and remedies', () => {
  it('lands a hazard only on a rolling rival', () => {
    const state = stackedHand(duel, [
      ['flatTyre', ...filler.slice(1)],
      ['greenLight', ...filler.slice(1)],
    ]);
    draw(state);
    expect(playVerdict(state, 0, slotOf(state, 0, 'flatTyre'))).toBe('rival-stopped');
    discard(state, 0, 'm50');
    turn(state, 1, 'greenLight');
    draw(state);
    expect(playVerdict(state, 0, slotOf(state, 0, 'flatTyre'))).toBe('ok');
  });

  it('wants the matching remedy, then a green light', () => {
    const state = stackedHand(duel, [
      ['greenLight', 'spareTyre', 'greenLight', 'm100', 'mechanic', 'm25'],
      ['flatTyre', ...filler.slice(1)],
    ]);
    turn(state, 0, 'greenLight');
    turn(state, 1, 'flatTyre');
    expect(state.sides[0]).toMatchObject({ battle: 'flatTyre', canGo: false });
    draw(state);
    expect(playVerdict(state, 0, slotOf(state, 0, 'mechanic'))).toBe('nothing-to-fix');
    expect(playVerdict(state, 0, slotOf(state, 0, 'greenLight'))).toBe('fix-first');
    play(state, 0, 'spareTyre');
    turn(state, 1);
    turn(state, 0, 'greenLight');
    expect(state.sides[0]).toMatchObject({ battle: 'greenLight', canGo: true });
  });

  it('protects a side with a safety for the rest of the hand', () => {
    const state = stackedHand(duel, [
      ['greenLight', 'runFlats', ...filler.slice(2)],
      ['flatTyre', ...filler.slice(1)],
    ]);
    turn(state, 0, 'greenLight');
    turn(state, 1);
    draw(state);
    play(state, 0, 'runFlats');
    expect(state.turn).toBe(0);
    // Another turn: another draw, then a card.
    draw(state);
    discard(state, 0, 'm50');
    draw(state, 1);
    expect(playVerdict(state, 1, slotOf(state, 1, 'flatTyre'))).toBe('rival-immune');
  });

  it('lets a slow zone fall on a stopped rival, but never twice', () => {
    const state = stackedHand(duel, [['slowZone', 'slowZone', ...filler.slice(2)], filler]);
    draw(state);
    expect(playVerdict(state, 0, slotOf(state, 0, 'slowZone'))).toBe('ok');
    play(state, 0, 'slowZone');
    turn(state, 1);
    draw(state);
    expect(playVerdict(state, 0, slotOf(state, 0, 'slowZone'))).toBe('rival-slowed');
  });
});

describe('the coup fourré', () => {
  function attacked(hazard: Kind, safety: Kind) {
    const state = stackedHand(duel, [
      ['greenLight', safety, ...filler.slice(2)],
      [hazard, ...filler.slice(1)],
    ]);
    turn(state, 0, 'greenLight');
    turn(state, 1, hazard);
    return state;
  }

  it('parries the hazard before the draw, scores, and keeps the turn', () => {
    const state = attacked('fenderBender', 'roadSense');
    const slot = slotOf(state, 0, 'roadSense');
    expect(canCoup(state, 0, slot)).toBe(true);
    const events = apply(state, { type: 'coup', seat: 0, slot });
    expect(events[0]).toMatchObject({ type: 'play', coup: true, cleared: 'fenderBender' });
    expect(state.sides[0]).toMatchObject({ battle: 'greenLight', canGo: true, coups: 1 });
    expect(state.sides[0].safeties.roadSense).toBe('coup');
    expect(state.turn).toBe(0);
    // The parry left a gap: the next draw fills it and the pick slot.
    expect(draw(state)[0]).toMatchObject({
      type: 'draw',
      cards: [expect.any(Number), expect.any(Number)],
    });
    expect(state.seats[0]!.hand.every((c) => c !== null)).toBe(true);
  });

  it('closes once the hit side draws', () => {
    const state = attacked('flatTyre', 'runFlats');
    draw(state);
    const slot = slotOf(state, 0, 'runFlats');
    expect(canCoup(state, 0, slot)).toBe(false);
    const events = apply(state, { type: 'play', seat: 0, slot });
    expect(events[0]).toMatchObject({ coup: false, cleared: 'flatTyre' });
    expect(state.sides[0].coups).toBe(0);
  });

  it('counts a plain play of the matching safety in time as a coup fourré', () => {
    const state = attacked('noFuel', 'longRangeTank');
    const events = play(state, 0, 'longRangeTank');
    expect(events[0]).toMatchObject({ coup: true });
  });

  it('answers a slow zone with the green wave', () => {
    const state = attacked('slowZone', 'greenWave');
    const events = play(state, 0, 'greenWave');
    expect(events[0]).toMatchObject({ coup: true, cleared: 'slowZone' });
    expect(state.sides[0].speed).toBeNull();
  });

  it('gives no coup for the green wave against a fresh flat under an old slow zone', () => {
    // The original scores this as a coup fourré (new_battle is set and a limit is showing).
    const state = stackedHand(duel, [
      ['greenLight', 'greenWave', ...filler.slice(2)],
      ['slowZone', 'flatTyre', ...filler.slice(2)],
    ]);
    turn(state, 0, 'greenLight');
    turn(state, 1, 'slowZone');
    turn(state, 0);
    turn(state, 1, 'flatTyre');
    const events = play(state, 0, 'greenWave');
    expect(events[0]).toMatchObject({ coup: false, cleared: 'slowZone' });
    expect(state.sides[0].battle).toBe('flatTyre');
  });
});

describe('the end of a hand', () => {
  it('stops at 700 to ask about the extension, then plays to 1000', () => {
    const state = stackedHand(duel, [['greenLight', 'm200', ...filler.slice(2)], filler]);
    turn(state, 0, 'greenLight');
    turn(state, 1);
    state.sides[0].miles = 500;
    turn(state, 0, 'm200');
    expect(state.awaitingExtension).toBe(true);
    expect(legalActions(state, 0).map((a) => a.type)).toEqual(['extend', 'extend']);
    apply(state, { type: 'extend', seat: 0, extend: true });
    expect(state).toMatchObject({ end: 1000, extendedBy: 0, over: false, turn: 1 });
  });

  it('ends at 700 when the extension is declined', () => {
    const state = stackedHand(duel, [['greenLight', 'm200', ...filler.slice(2)], filler]);
    turn(state, 0, 'greenLight');
    turn(state, 1);
    state.sides[0].miles = 500;
    turn(state, 0, 'm200');
    apply(state, { type: 'extend', seat: 0, extend: false });
    expect(state.over).toBe(true);
  });

  it('ends once the deck is gone and nobody can use a card', () => {
    const state = stackedHand(duel, [filler, filler]);
    state.deck = [state.deck.pop()!];
    draw(state);
    expect(state.deck).toHaveLength(0);
    expect(state.over).toBe(true);
  });

  it('plays on after the deck is gone while someone can still use a card', () => {
    const state = stackedHand(duel, [['greenLight', ...filler.slice(1)], filler]);
    state.deck = [state.deck.pop()!];
    draw(state);
    expect(state.over).toBe(false);
    play(state, 0, 'greenLight');
    // Seat 1 can still throw away cards but has no use for any; seat 0 can roll its 25s.
    expect(state.over).toBe(false);
  });
});

describe('partnerships', () => {
  const four = (hands: Kind[][], starter = 0) => stackedHand(teams, hands, [], starter);

  it('share one set of piles and play to 1000 without an extension', () => {
    const state = four([
      ['greenLight', ...filler.slice(1)],
      filler,
      ['m100', ...filler.slice(1)],
      filler,
    ]);
    expect(state.end).toBe(1000);
    turn(state, 0, 'greenLight');
    turn(state, 1);
    turn(state, 2, 'm100');
    expect(state.sides[0].miles).toBe(100);
    expect(state.rules.extension).toBe(false);
  });

  it('let the next seat parry for its side', () => {
    const state = four([
      ['greenLight', ...filler.slice(1)],
      ['redLight', ...filler.slice(1)],
      ['m50', 'm75', 'greenWave', 'm50', 'm75', 'm100'],
      filler,
    ]);
    turn(state, 0, 'greenLight');
    turn(state, 1, 'redLight');
    expect(state.turn).toBe(2);
    const slot = slotOf(state, 2, 'greenWave');
    expect(canCoup(state, 2, slot)).toBe(true);
    apply(state, { type: 'coup', seat: 2, slot });
    expect(state.sides[0]).toMatchObject({ coups: 1, canGo: true });
    expect(state.turn).toBe(2);
  });

  it('let a partner parry out of turn, and the turn jumps past the seat in between', () => {
    const state = four([
      filler,
      ['greenLight', 'greenWave', ...filler.slice(2)],
      ['redLight', ...filler.slice(1)],
      filler,
    ]);
    turn(state, 0);
    turn(state, 1, 'greenLight');
    turn(state, 2, 'redLight');
    expect(state.turn).toBe(3);
    const slot = slotOf(state, 1, 'greenWave');
    expect(canCoup(state, 1, slot)).toBe(true);
    expect(canCoup(state, 3, 1)).toBe(false);
    apply(state, { type: 'coup', seat: 1, slot });
    expect(state.turn).toBe(1);
    expect(state.sides[1]).toMatchObject({ coups: 1, canGo: true, battle: null });
  });
});
