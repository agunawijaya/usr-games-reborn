/*
 * The Classic driver: the computer player of the BSD `mille` (comp.c, misc.c `check_ext`,
 * move.c `account`), ported to TypeScript for Detour. Derived from code that is
 * Copyright (c) 1982, 1993 The Regents of the University of California. All rights reserved.
 * Used under the BSD 3-clause licence; the full notice is in LICENSES/BSD-3-Clause-UCB.txt.
 *
 * The port keeps the original's arithmetic (integer division, the order of the checks, ties
 * going to the later hand slot) and its known slips, each marked where it happens, so Classic
 * plays the way the 1982 program did. Our own words, our own names.
 */
import {
  type Kind,
  DISTANCES,
  KINDS,
  MILES,
  SAFETIES,
  deckSize,
  isDistance,
  isSafety,
  opposite,
  ordinal,
  safetyFor,
  safetyIndex,
} from '../engine/cards';
import {
  type Action,
  type HandEvent,
  type HandState,
  type Side,
  HAND_SLOTS,
  isRepairOrEmpty,
  kindAt,
  other,
} from '../engine/hand';

/** What the computer keeps between moves: `Numgos` (per hand) and `Numneed` (never reset in the original). */
export interface ClassicMemory {
  numGos: number;
  numNeed: number[];
}

/** The original's starting `Numneed`: how many of each card a hand is expected to need. */
const START_NEED: Readonly<Partial<Record<Kind, number>>> = {
  noFuel: 2,
  flatTyre: 2,
  fenderBender: 2,
  redLight: 4,
  slowZone: 3,
  fillUp: 2,
  spareTyre: 2,
  mechanic: 2,
  greenLight: 10,
  openRoad: 3,
  longRangeTank: 1,
  runFlats: 1,
  roadSense: 1,
  greenWave: 1,
};

export function newClassicMemory(): ClassicMemory {
  return { numGos: 0, numNeed: KINDS.map((kind) => START_NEED[kind] ?? 0) };
}

/** Where a safety stands for the computer: unknown, in its hand, or played (S_UNKNOWN …). */
export const SafetyKnown = { Unknown: 0, InHand: 1, Played: 2 } as const;
export type SafetyKnown = (typeof SafetyKnown)[keyof typeof SafetyKnown];

const C = Object.fromEntries(KINDS.map((kind, i) => [kind, i])) as Record<Kind, number>;
const VALUE = DISTANCES.map((d) => MILES[d]);
const V_VALUABLE = 40;
/**
 * The original asks `Topcard < Deck` here, meaning "the deck is empty"; the pointer never goes
 * below the bottom of the deck, so the test is always false.
 */
const DECK_BELOW_BOTTOM = false;

export interface Player {
  battle: Kind | null;
  speed: Kind | null;
  canGo: boolean;
  mileage: number;
  numMiles200: number;
  safety: SafetyKnown[];
}

export interface View {
  pp: Player;
  op: Player;
  hand: (Kind | null)[];
  end: number;
  seen: number[];
  numCards: number[];
  deckLeft: number;
  deckSize: number;
  memory: ClassicMemory;
  roll: (sides: number) => number;
}

function playerView(state: HandState, side: Side, ownHand: (Kind | null)[] | null): Player {
  const tableau = state.sides[side];
  return {
    battle: tableau.battle,
    speed: tableau.speed,
    canGo: tableau.canGo,
    mileage: tableau.miles,
    numMiles200: tableau.distanceCounts.m200,
    safety: SAFETIES.map((s) => {
      if (tableau.safeties[s] !== 'none') return SafetyKnown.Played;
      return ownHand?.includes(s) ? SafetyKnown.InHand : SafetyKnown.Unknown;
    }),
  };
}

/** What the computer sees from a seat (exported for the comparison against the original). */
export function viewFor(
  state: HandState,
  seat: number,
  memory: ClassicMemory,
  roll: (n: number) => number,
): View {
  const side = state.seats[seat]!.side;
  const hand = state.seats[seat]!.hand.map((card) => (card === null ? null : state.cards[card]!));
  return {
    pp: playerView(state, side, hand),
    op: playerView(state, other(side), null),
    hand,
    end: state.end,
    seen: state.seen[seat]!,
    numCards: KINDS.map((kind) => state.rules.deck[kind]),
    deckLeft: state.deck.length,
    deckSize: deckSize(state.rules.deck),
    memory,
    roll,
  };
}

/** `canplay`, on the computer's view. */
function canPlay(v: View, pp: Player, op: Player, card: Kind | null): boolean {
  if (card === null) return false;
  if (isDistance(card)) {
    if (card === 'm200' && pp.numMiles200 === 2) return false;
    if (card !== 'm25' && card !== 'm50' && pp.speed === 'slowZone') return false;
    if (card !== 'm25' && pp.mileage + MILES[card] > v.end) return false;
    return pp.canGo;
  }
  switch (card) {
    case 'noFuel':
    case 'flatTyre':
    case 'fenderBender':
    case 'redLight':
      return op.canGo && op.safety[safetyIndex(safetyFor(card))] !== SafetyKnown.Played;
    case 'slowZone':
      return (
        op.speed !== 'slowZone' &&
        op.safety[safetyIndex('greenWave')] !== SafetyKnown.Played &&
        op.mileage + 50 < v.end
      );
    case 'fillUp':
    case 'spareTyre':
    case 'mechanic':
      return pp.battle === opposite(card);
    case 'greenLight':
      return !pp.canGo && (isRepairOrEmpty(pp.battle) || pp.battle === 'redLight');
    case 'openRoad':
      return pp.speed === 'slowZone';
    default:
      return false;
  }
}

/**
 * `onecard`: could this player finish with the next card? The original indexes the seen-card
 * table with the right-of-way's *safety* number (3) where it meant the card, so it actually asks
 * whether any 100-mile card has been seen. Kept as written.
 */
function oneCard(v: View, p: Player): boolean {
  const seenHundredsSlip = v.seen[C.m100]!;
  const bat = p.battle;
  const spd = p.speed;
  const couldRoll =
    p.canGo ||
    ((isRepairOrEmpty(bat) || bat === 'redLight' || spd === 'slowZone') &&
      seenHundredsSlip !== 0) ||
    (bat !== null && !isDistance(bat) && v.seen[C[safetyFor(bat)]]! !== 0);
  if (!couldRoll) return false;
  const gap = v.end - p.mileage;
  if (![25, 50, 75, 100, 200].includes(gap)) return false;
  if (gap === 200 && p.numMiles200 === 2) return false;
  const card = C[`m${gap}` as Kind];
  if (gap >= 75 && spd === 'slowZone') return seenHundredsSlip === 0;
  return v.seen[card] !== v.numCards[card];
}

/** The computer's half of `check_ext`: does it extend the trip it is about to finish? */
export function wantsExtension(v: View, handMiles: number): boolean {
  if (v.end !== 700) return false;
  const pp = v.pp;
  const op = v.op;
  const safe = pp.safety.filter((s) => s !== SafetyKnown.Unknown).length;
  if (safe < 2) return false;
  if (op.mileage === 0 || oneCard(v, op) || (op.canGo && op.mileage >= 500)) return false;
  const open = SAFETIES.filter(
    (_, i) => op.safety[i] !== SafetyKnown.Played && pp.safety[i] === SafetyKnown.Unknown,
  ).length;
  if (open + safe === SAFETIES.length) return true;
  return handMiles + v.deckLeft * 3 > 1000;
}

/**
 * Miles in hand as `check_ext` adds them. It reads every slot up to C_200, the empty ones too,
 * which index one place before the mileage table; we count those as nothing.
 */
export function handMilesOf(hand: readonly (Kind | null)[]): number {
  return hand.reduce((sum, kind) => sum + (kind !== null && isDistance(kind) ? MILES[kind] : 0), 0);
}

export type Decision =
  { type: 'draw' } | { type: 'play'; slot: number } | { type: 'discard'; slot: number };

/** `calcmove`, step by step. */
export function calcMove(v: View): Decision {
  const { pp, op, hand, seen, numCards, memory } = v;
  const numNeed = memory.numNeed;
  const count = new Array<number>(KINDS.length).fill(0);
  const playit = new Array<boolean>(HAND_SLOTS).fill(false);
  let safe = 0;
  let cango = 0;
  let canstop = false;
  let foundend = false;

  // Try for a coup fourré first, and see what we hold.
  for (let i = 0; i < HAND_SLOTS; i++) {
    const card = hand[i] ?? null;
    if (card !== null && isSafety(card)) {
      if (pp.battle === opposite(card) || (pp.speed === 'slowZone' && card === 'greenWave')) {
        return { type: 'play', slot: i };
      }
      safe++;
      playit[i] = true;
    } else {
      switch (card) {
        case 'redLight':
        case 'fenderBender':
        case 'flatTyre':
        case 'noFuel':
          playit[i] = canPlay(v, pp, op, card);
          if (playit[i]) canstop = true;
          break;
        case 'slowZone':
          playit[i] = canPlay(v, pp, op, card);
          if (playit[i] && seen[C.m25] === numCards[C.m25] && seen[C.m50] === numCards[C.m50]) {
            canstop = true;
          }
          break;
        case 'm25':
        case 'm50':
        case 'm75':
        case 'm100':
        case 'm200':
          playit[i] = canPlay(v, pp, op, card);
          if (playit[i] && pp.mileage + MILES[card] === v.end) foundend = true;
          break;
        default:
          playit[i] = canPlay(v, pp, op, card);
      }
      if (playit[i]) cango++;
    }
    if (card !== null) count[C[card]]!++;
  }

  // No coup fourré: draw to fill the hand, then think again.
  if (hand[0] === null && v.deckLeft > 0) return { type: 'draw' };

  if (foundend) foundend = !wantsExtension(v, handMilesOf(hand));
  for (let i = 0; safe > 0 && i < HAND_SLOTS; i++) {
    const card = hand[i] ?? null;
    if (card === null || !isSafety(card)) continue;
    if (oneCard(v, op) || (foundend && cango > 0 && !canstop)) return { type: 'play', slot: i };
    const oppos = C[opposite(card)];
    if (
      seen[oppos] === numCards[oppos] &&
      !(card === 'greenWave' && seen[C.slowZone] !== numCards[C.slowZone])
    ) {
      return { type: 'play', slot: i };
    } else if (cango === 0 && (op.canGo || !pp.canGo || DECK_BELOW_BOTTOM)) {
      let left = v.deckLeft - v.roll(10);
      if ((pp.mileage === 0) !== (op.mileage === 0)) left -= 7;
      if (left < Math.trunc(v.deckSize / 4)) return { type: 'play', slot: i };
    }
    safe--;
    playit[i] = cango > 0;
  }
  noteNeed(pp, numNeed);

  let nummax!: number;
  let nummin!: number;
  let leastValuable!: number;
  redo: for (;;) {
    let foundlow =
      cango > 0 ||
      count[C.openRoad] !== 0 ||
      seen[C.slowZone] === numCards[C.slowZone] ||
      pp.safety[3] !== SafetyKnown.Unknown;
    foundend = false;
    let count200 = pp.numMiles200;
    let badcount = 0;
    let curmax = -1;
    let curmin = 101;
    nummin = -1;
    nummax = -1;
    leastValuable = -1;
    let leastValue = Infinity;
    const repairValue = (remedy: Kind, hazard: number): number => {
      let worth = numCards[hazard]! * 6;
      worth += seen[C[remedy]]! - seen[hazard]!;
      if (cango === 0) worth = Math.trunc(worth / (count[C[remedy]]! * count[C[remedy]]!));
      count[C[remedy]]!--;
      return worth;
    };
    const hazardValue = (base: number, s: number, remedy: number): number => {
      if (op.safety[s] === SafetyKnown.Played) return -1;
      let worth = base * (numNeed[remedy]! + seen[remedy]! + 2);
      if (!pp.mileage || foundend || oneCard(v, op)) worth += 5;
      if (op.mileage === 0 || oneCard(v, op)) worth += 5;
      if (op.speed === 'slowZone') worth -= 3;
      if (cango > 0 && pp.safety[s] !== SafetyKnown.Unknown) worth += 3;
      if (cango === 0) worth = Math.trunc(worth / ++badcount);
      return worth;
    };
    for (let i = 0; i < HAND_SLOTS; i++) {
      const card = hand[i] ?? null;
      let value = 0;
      if ((card !== null && isSafety(card)) || playit[i] === cango > 0) {
        switch (card) {
          case 'm25':
          case 'm50':
          case 'm75':
          case 'm100':
          case 'm200': {
            const n = C[card];
            let skipToMiles = false;
            if (card === 'm25' || card === 'm50') {
              const diff = v.end - pp.mileage;
              // Avoid getting too close to the end with small cards.
              if (
                v.deckLeft > 0 &&
                cango > 0 &&
                diff <= 100 &&
                Math.trunc(diff / VALUE[n]!) > count[n]! &&
                (card === 'm25' || diff % 50 === 0) &&
                !(card === 'm50' && diff - 50 === 25 && count[C.m25]! > 0)
              ) {
                value = 0;
                if (--cango <= 0) continue redo;
                break;
              }
              value = VALUE[n]! >> 3;
              if (pp.speed === 'slowZone') value++;
              else value--;
              if (!foundlow && (card === 'm50' || count[C.m50] === 0)) {
                value = pp.mileage ? 10 : 20;
                foundlow = true;
              }
              skipToMiles = true;
            }
            if (!skipToMiles) {
              if (card === 'm200' && ++count200 > 2) {
                value = 0;
                break;
              }
              value = VALUE[n]! >> 3;
              if (pp.speed === 'slowZone') value--;
              else value++;
            }
            if (pp.mileage + VALUE[n]! > v.end) value = v.end === 700 ? n : 0;
            else if (pp.mileage + VALUE[n]! === v.end) {
              value = foundend ? n : V_VALUABLE;
              foundend = true;
            }
            break;
          }
          case 'openRoad':
            if (pp.safety[3] !== SafetyKnown.Unknown) {
              value = pp.safety[3] === SafetyKnown.Played ? -1 : 1;
            } else if (pp.speed === 'slowZone' && v.end - pp.mileage <= 50) {
              value = 1;
            } else if (pp.speed === 'slowZone' || seen[C.slowZone] !== numCards[C.slowZone]) {
              value = repairValue(card, C.slowZone);
            } else {
              value = 0;
              count[C.openRoad]!--;
            }
            break;
          case 'mechanic':
          case 'spareTyre':
          case 'fillUp': {
            const s = safetyIndex(safetyFor(card));
            const oppos = C[opposite(card)];
            if (pp.safety[s] !== SafetyKnown.Unknown) {
              value = pp.safety[s] === SafetyKnown.Played ? -1 : 1;
            } else if (
              pp.battle !== opposite(card) &&
              (seen[oppos] === numCards[oppos] || seen[oppos]! + count[C[card]]! > numCards[oppos]!)
            ) {
              value = 0;
              count[C[card]]!--;
            } else {
              value = repairValue(card, oppos);
            }
            break;
          }
          case 'greenLight':
            if (pp.safety[3] !== SafetyKnown.Unknown) {
              value = pp.safety[3] === SafetyKnown.Played ? -1 : 2;
            } else if (pp.canGo && memory.numGos + count[C.greenLight]! === numNeed[C.greenLight]) {
              value = 0;
              count[C.greenLight]!--;
            } else {
              value = numNeed[C.greenLight]! * 3;
              value += seen[C.greenLight]! - memory.numGos;
              value = Math.trunc(value / (count[C.greenLight]! * count[C.greenLight]!));
              count[C.greenLight]!--;
            }
            break;
          case 'slowZone':
            if (op.mileage + 50 >= v.end) {
              value = v.end === 700 && cango === 0 ? 1 : 0;
              break;
            }
            if (canstop || (cango > 0 && !op.canGo)) value = 1;
            else {
              value = pp.safety[3] !== SafetyKnown.Unknown ? 2 : 3;
              value = hazardValue(value, 3, C.openRoad);
            }
            break;
          case 'fenderBender':
          case 'noFuel':
          case 'flatTyre': {
            const s = safetyIndex(safetyFor(card));
            value = pp.safety[s] !== SafetyKnown.Unknown ? 3 : 4;
            value = hazardValue(value, s, C[opposite(card)]);
            break;
          }
          case 'redLight':
            if (op.safety[3] === SafetyKnown.Played) value = -1;
            else {
              value = pp.safety[3] !== SafetyKnown.Unknown ? 3 : 4;
              value *= numCards[C.redLight]! + seen[C.greenLight]!;
              if (!pp.mileage || foundend || oneCard(v, op)) value += 5;
              if (cango === 0) value = Math.trunc(value / ++badcount);
              if (op.mileage === 0) value += 5;
              // The original also tests for a slow zone here, which this branch never sees.
              if (!op.canGo) value -= 5;
              if (cango > 0 && pp.safety[3] !== SafetyKnown.Unknown) value += 5;
            }
            break;
          case null:
            value = 0;
            break;
          default:
            // A safety.
            value = cango > 0 ? 0 : 101;
        }
      } else {
        value = cango > 0 ? 0 : 101;
      }
      if (card !== null) {
        if (value <= leastValue) {
          leastValuable = i;
          leastValue = value;
        }
        if (value >= curmax) {
          nummax = i;
          curmax = value;
        }
        if (value <= curmin) {
          nummin = i;
          curmin = value;
        }
      }
    }
    break;
  }
  noteNeed(pp, numNeed);
  if (cango > 0) return { type: 'play', slot: nummax };
  // Every card valued above 101 leaves the original with no slot at all (`hand[-1]`, a card
  // from outside the hand); Detour lets go of the least valuable card instead.
  if (nummin < 0) nummin = leastValuable;
  // NEVER discard a safety, as the original says in capitals.
  const weakest = hand[nummin] ?? null;
  if (weakest !== null && isSafety(weakest)) return { type: 'play', slot: nummin };
  return { type: 'discard', slot: nummin };
}

/**
 * While stopped by a hazard, the original counts one more of its remedy as "needed" — twice per
 * move (once before and once after weighing the hand), and it never resets the table, so the
 * count keeps growing over a whole sitting. Detour keeps the doubling and resets per game.
 */
function noteNeed(pp: Player, numNeed: number[]): void {
  if (!pp.canGo && !isRepairOrEmpty(pp.battle) && pp.battle !== null) {
    numNeed[C[opposite(pp.battle)]]!++;
  }
}

/** `account` for the computer's own draws: hazards it holds, and safeties that cover its own road. */
export function accountDraw(
  state: HandState,
  seat: number,
  kind: Kind,
  memory: ClassicMemory,
): void {
  switch (kind) {
    case 'longRangeTank':
    case 'runFlats':
    case 'roadSense': {
      const oppos = C[opposite(kind)];
      memory.numGos += state.rules.deck[opposite(kind)] - state.seen[seat]![oppos]!;
      break;
    }
    case 'fenderBender':
    case 'flatTyre':
    case 'noFuel':
    case 'redLight':
      memory.numGos++;
      break;
    default:
  }
}

/**
 * At the deal the original counts the computer's six cards with `account`, which only updates
 * `Numgos` when the computer is the one about to play: the count depends on who starts the hand.
 */
export function classicDeal(state: HandState, seat: number, memory: ClassicMemory): void {
  memory.numGos = 0;
  if (state.turn !== seat) return;
  for (const card of state.seats[seat]!.hand) {
    if (card !== null) accountDraw(state, seat, state.cards[card]!, memory);
  }
}

export function classicObserve(
  state: HandState,
  seat: number,
  events: readonly HandEvent[],
  memory: ClassicMemory,
): void {
  for (const event of events) {
    if (event.type === 'draw' && event.seat === seat) {
      for (const card of event.cards) accountDraw(state, seat, state.cards[card]!, memory);
    }
  }
}

export function classicDecide(
  state: HandState,
  seat: number,
  memory: ClassicMemory,
  roll: (sides: number) => number,
): Action {
  if (state.awaitingExtension) {
    const v = viewFor(state, seat, memory, roll);
    const side = state.seats[seat]!.side;
    // The original weighs the extension while the finishing card is still in its hand.
    const last = state.sides[side].milePile.at(-1);
    const lastKind = last === undefined ? null : state.cards[last]!;
    const justPlayed = lastKind !== null && isDistance(lastKind) ? MILES[lastKind] : 0;
    return { type: 'extend', seat, extend: wantsExtension(v, handMilesOf(v.hand) + justPlayed) };
  }
  const decision = calcMove(viewFor(state, seat, memory, roll));
  if (decision.type === 'draw') return { type: 'draw', seat };
  return { type: decision.type, seat, slot: decision.slot };
}

/** Out of turn the Classic driver always parries: a coup fourré comes before anything else. */
export function classicWantsCoup(): boolean {
  return true;
}

export { kindAt, ordinal };
