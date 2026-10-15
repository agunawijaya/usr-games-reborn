import type { Rng } from '@usr-games/kit';
import { type CardId, type Kind, KINDS, ordinal } from '../engine/cards';
import {
  type Action,
  type HandState,
  type Side,
  type Tableau,
  HAND_SLOTS,
  apply,
  canCoup,
  legalActions,
  mustDraw,
  other,
  seatsOf,
} from '../engine/hand';
import { scoreSide } from '../engine/score';
import { type ClassicMemory, calcMove, classicDecide, newClassicMemory, viewFor } from './classic';

/**
 * Sly plays Classic's game with a second look before every real choice. It deals the cards it
 * cannot see out 48 different ways, consistent with everything it has seen and shaped the way a
 * real rival's hand leans, plays every distinct move to the end of the hand in each world with
 * Classic's judgement for everyone, and overrides Classic only when another move comes out
 * clearly ahead (by 2.5 standard errors of the paired difference). An extension is decided the
 * same way, both ways, 120 times. Card counting, patience with a safety and the timing of an
 * extension all come from that one habit. Tuned in NOTES.md ("Building Sly").
 */

export interface SlyTuning {
  /** Worlds dealt out for an extension, each played out both ways (0: decide as Classic). */
  extensionSamples: number;
  /** Worlds dealt out per choice (0: play as Classic). */
  search: number;
  /** How many standard errors a move must beat Classic's choice by before Sly overrides it. */
  overrideZ: number;
}

export const SLY_TUNING: SlyTuning = {
  extensionSamples: 120,
  search: 48,
  overrideZ: 2.5,
};

export function slyDecide(
  state: HandState,
  seat: number,
  memory: ClassicMemory,
  rng: Rng,
  tuning: SlyTuning = SLY_TUNING,
): Action {
  const roll = (sides: number) => rng.int(1, sides);
  if (state.awaitingExtension) {
    if (tuning.extensionSamples === 0) return classicDecide(state, seat, memory, roll);
    return { type: 'extend', seat, extend: wantsExtension(state, seat, memory, rng, tuning) };
  }
  const legal = legalActions(state, seat);
  const coup = legal.find((a) => a.type === 'coup' && a.seat === seat);
  // A coup fourré is never worth passing up: 300 points, the hazard gone and the turn kept.
  if (coup) return coup;
  if (mustDraw(state, seat)) return { type: 'draw', seat };
  const decision = calcMove(viewFor(state, seat, memory, roll));
  if (decision.type === 'draw') return { type: 'draw', seat };
  const classicChoice: Action = { type: decision.type, seat, slot: decision.slot };
  if (tuning.search === 0) return classicChoice;
  return searchOverride(state, seat, memory, rng, legal, classicChoice, tuning);
}

/**
 * Plays every distinct move out in the same dealt-out worlds and keeps Classic's choice unless
 * another move leads by `overrideZ` standard errors of the paired difference.
 */
function searchOverride(
  state: HandState,
  seat: number,
  memory: ClassicMemory,
  rng: Rng,
  legal: readonly Action[],
  classicChoice: Action,
  tuning: SlyTuning,
): Action {
  const candidates = distinctMoves(state, legal);
  const classicKey = moveKey(state, classicChoice);
  const anchor = candidates.findIndex((a) => moveKey(state, a) === classicKey);
  if (candidates.length < 2 || anchor < 0) return classicChoice;
  const side = state.seats[seat]!.side;
  const results = candidates.map(() => [] as number[]);
  for (let sample = 0; sample < tuning.search; sample++) {
    const world = determinize(state, seat, rng);
    const seed = rng.nextUint32();
    candidates.forEach((action, i) => {
      const trial = cloneHand(world);
      apply(trial, action);
      results[i]!.push(playToEnd(trial, seat, memory, seed, side));
    });
  }
  let best = anchor;
  let bestScore = 0;
  results.forEach((values, i) => {
    if (i === anchor) return;
    const diffs = values.map((v, k) => v - results[anchor]![k]!);
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const variance = diffs.reduce((a, d) => a + (d - mean) ** 2, 0) / Math.max(1, diffs.length - 1);
    const se = Math.sqrt(variance / diffs.length) || 1;
    const z = mean / se;
    if (z > tuning.overrideZ && mean > bestScore) {
      best = i;
      bestScore = mean;
    }
  });
  return candidates[best]!;
}

function moveKey(state: HandState, action: Action): string {
  if (action.type === 'play' || action.type === 'discard' || action.type === 'coup') {
    return `${action.type}:${state.cards[state.seats[action.seat]!.hand[action.slot]!]}`;
  }
  return action.type;
}

function distinctMoves(state: HandState, legal: readonly Action[]): Action[] {
  const keys = new Set<string>();
  return legal.filter((action) => {
    if (action.type === 'coup' && action.seat !== state.turn) return false;
    const key = moveKey(state, action);
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

/** Plays the rest of the hand out both ways, many times, from what Sly can see. */
function wantsExtension(
  state: HandState,
  seat: number,
  memory: ClassicMemory,
  rng: Rng,
  tuning: SlyTuning,
): boolean {
  const side = state.seats[seat]!.side;
  let lead = 0;
  for (let sample = 0; sample < tuning.extensionSamples; sample++) {
    const world = determinize(state, seat, rng);
    const seed = rng.nextUint32();
    const go = cloneHand(world);
    apply(go, { type: 'extend', seat, extend: true });
    const stop = cloneHand(world);
    apply(stop, { type: 'extend', seat, extend: false });
    lead += playToEnd(go, seat, memory, seed, side) - playToEnd(stop, seat, memory, seed, side);
  }
  return lead > 0;
}

/**
 * How much likelier each kind is to sit in a Classic rival's hand than a random deal of the
 * unseen cards would make it, measured over 3000 hands of Classic against Classic (NOTES.md).
 * A rival throws hazards the moment it can, so while we roll it holds almost none; it keeps its
 * safeties and remedies and lets small miles go.
 */
const RIVAL_HAND_BIAS: Readonly<Record<'rolling' | 'stopped', readonly number[]>> = {
  rolling: [
    0.59, 0.8, 0.86, 1.46, 1.6, 0.11, 0.14, 0.12, 0.1, 0.3, 1.39, 1.4, 1.43, 0.76, 1.38, 1.55, 1.44,
    1.51, 1.02,
  ],
  stopped: [
    0.58, 0.75, 0.74, 1.19, 1.42, 1.43, 1.43, 1.37, 1.11, 0.47, 1.19, 1.25, 1.29, 0.68, 1.19, 1.71,
    1.65, 1.66, 1.13,
  ],
};

/**
 * A world consistent with what this seat knows: every card it cannot see (the other hands and
 * the deck) is dealt again from the kinds still unaccounted for, the rivals' hands leaning the
 * way a Classic rival's hand really leans.
 */
export function determinize(state: HandState, seat: number, rng: Rng, shaped = true): HandState {
  const world = cloneHand(state);
  const visible = new Set<CardId>();
  for (const card of state.seats[seat]!.hand) if (card !== null) visible.add(card);
  for (const tableau of state.sides) {
    for (const pile of [
      tableau.battlePile,
      tableau.speedPile,
      tableau.milePile,
      tableau.safetyPile,
    ]) {
      for (const card of pile) visible.add(card);
    }
  }
  for (const card of state.discards) visible.add(card);
  const hidden: CardId[] = [];
  for (let card = 0; card < state.cards.length; card++) if (!visible.has(card)) hidden.push(card);
  let pool = rng.shuffle(hidden.map((card) => state.cards[card]!));
  world.cards = [...state.cards];
  if (shaped) {
    const side = state.seats[seat]!.side;
    const bias = RIVAL_HAND_BIAS[state.sides[side].canGo ? 'rolling' : 'stopped'];
    for (const rival of seatsOf(state, other(side))) {
      for (const card of state.seats[rival]!.hand) {
        if (card === null) continue;
        const pick = weightedIndex(pool, bias, rng);
        world.cards[card] = pool[pick]!;
        pool = [...pool.slice(0, pick), ...pool.slice(pick + 1)];
      }
    }
  }
  const rest = hidden.filter((card) => !shaped || !isRivalCard(state, seat, card));
  rest.forEach((card, i) => {
    world.cards[card] = pool[i]!;
  });
  const publicCounts = new Array<number>(KINDS.length).fill(0);
  for (const card of visible) {
    if (!state.seats[seat]!.hand.includes(card)) publicCounts[ordinal(world.cards[card]!)]!++;
  }
  world.seen = world.seats.map((seatState, i) => {
    if (i === seat) return [...state.seen[seat]!];
    const counts = [...publicCounts];
    for (const card of seatState.hand) if (card !== null) counts[ordinal(world.cards[card]!)]!++;
    return counts;
  });
  return world;
}

function isRivalCard(state: HandState, seat: number, card: CardId): boolean {
  const side = state.seats[seat]!.side;
  return seatsOf(state, other(side)).some((rival) => state.seats[rival]!.hand.includes(card));
}

function weightedIndex(pool: readonly Kind[], bias: readonly number[], rng: Rng): number {
  let total = 0;
  for (const kind of pool) total += bias[ordinal(kind)]!;
  let target = rng.next() * total;
  for (let i = 0; i < pool.length; i++) {
    target -= bias[ordinal(pool[i]!)]!;
    if (target <= 0) return i;
  }
  return pool.length - 1;
}

/** Plays a world to the end of the hand with Classic everywhere; returns this side's lead. */
function playToEnd(
  world: HandState,
  seat: number,
  memory: ClassicMemory,
  seed: number,
  side: Side,
): number {
  const memories = world.seats.map((_, i) =>
    i === seat ? { numGos: memory.numGos, numNeed: [...memory.numNeed] } : newClassicMemory(),
  );
  let x = seed >>> 0 || 1;
  // A tiny xorshift: rollouts need speed and repeatability, not the kit stream's guarantees.
  const roll = (sides: number) => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % sides) + 1;
  };
  for (let guard = 0; !world.over && guard < 400; guard++) {
    const window = world.coupWindow;
    let acted = false;
    if (window) {
      for (const seatOnSide of seatsOf(world, window.side)) {
        if (seatOnSide === world.turn) continue;
        const slot = coupSlot(world, seatOnSide);
        if (slot !== null) {
          apply(world, { type: 'coup', seat: seatOnSide, slot });
          acted = true;
          break;
        }
      }
    }
    if (acted) continue;
    apply(world, classicDecide(world, world.turn, memories[world.turn]!, roll));
  }
  return scoreSide(world, side).total - scoreSide(world, other(side)).total;
}

function coupSlot(state: HandState, seat: number): number | null {
  for (let slot = 0; slot < HAND_SLOTS; slot++) if (canCoup(state, seat, slot)) return slot;
  return null;
}

function cloneTableau(t: Tableau): Tableau {
  return {
    ...t,
    distanceCounts: { ...t.distanceCounts },
    safeties: { ...t.safeties },
    battlePile: [...t.battlePile],
    speedPile: [...t.speedPile],
    milePile: [...t.milePile],
    safetyPile: [...t.safetyPile],
  };
}

export function cloneHand(state: HandState): HandState {
  return {
    ...state,
    deck: [...state.deck],
    discards: [...state.discards],
    seats: state.seats.map((s) => ({ side: s.side, hand: [...s.hand] })),
    sides: [cloneTableau(state.sides[0]), cloneTableau(state.sides[1])],
    coupWindow: state.coupWindow ? { ...state.coupWindow } : null,
    seen: state.seen.map((counts) => [...counts]),
  };
}

/** Out of turn, Sly always parries. */
export function slyWantsCoup(_state: HandState, _seat: number, _slot: number): boolean {
  return true;
}
