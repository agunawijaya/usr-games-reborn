import {
  type CardId,
  type DeckCounts,
  type Distance,
  type Hazard,
  type Kind,
  type Safety,
  DISTANCES,
  MILES,
  SAFETIES,
  deckKinds,
  isDistance,
  isHazard,
  isSafety,
  opposite,
  ordinal,
  safetyFor,
} from './cards';

/**
 * One hand of Detour: the deal, the turns and every rule of play, as the original program plays
 * them (`move.c`, `playcard`), on plain data that saves as JSON. The state is changed in place by
 * `apply`, which returns what happened for the table to animate.
 *
 * Two departures from the original, both recorded in CHANGES-FROM-ORIGINAL.md: a coup fourré
 * counts only when the safety answers the hazard that just landed, and the window for one
 * closes as soon as anyone draws, discards or plays anything but a safety (the original left it
 * open for good once the deck ran out).
 */

export type Side = 0 | 1;
export type SafetyState = 'none' | 'played' | 'coup';

/** One side's piles: a player's in the duel, a partnership's in the team game. */
export interface Tableau {
  /** The battle pile's top card; null before the first card lands (the original's C_INIT). */
  battle: Kind | null;
  /** The speed pile's top card. */
  speed: 'slowZone' | 'openRoad' | null;
  canGo: boolean;
  miles: number;
  distanceCounts: Record<Distance, number>;
  safeties: Record<Safety, SafetyState>;
  coups: number;
  battlePile: CardId[];
  speedPile: CardId[];
  milePile: CardId[];
  safetyPile: CardId[];
}

export interface HandRules {
  /** The trip: 700 in the duel, 1000 for partnerships. */
  trip: number;
  /** Whether the side that reaches the trip may extend it to 1000 (duel only). */
  extension: boolean;
  teams: boolean;
  deck: DeckCounts;
  /** The original refuses to discard a safety; Detour asks for confirmation instead. */
  safetyDiscard: 'allow' | 'refuse';
}

export interface Seat {
  side: Side;
  /** Seven slots as the original keeps them: 0 is the card just picked, 1–6 the hand. */
  hand: (CardId | null)[];
}

export interface HandState {
  rules: HandRules;
  /** What each card id is. */
  cards: Kind[];
  /** The draw pile; the next card is the last one. */
  deck: CardId[];
  discards: CardId[];
  seats: Seat[];
  sides: [Tableau, Tableau];
  /** Whose turn it is. */
  turn: number;
  starter: number;
  /** The trip as it stands: the rules' trip, or 1000 after an extension. */
  end: number;
  extendedBy: Side | null;
  /** The seat in `turn` has just reached the trip and must say whether to extend. */
  awaitingExtension: boolean;
  /** A hazard has just landed on `side`; a matching safety now scores a coup fourré. */
  coupWindow: { side: Side; hazard: Hazard } | null;
  over: boolean;
  /** Cards of each kind every seat has seen: its own, and everything played or thrown away. */
  seen: number[][];
  actions: number;
}

export type Action =
  | { type: 'draw'; seat: number }
  | { type: 'play'; seat: number; slot: number }
  | { type: 'discard'; seat: number; slot: number }
  | { type: 'coup'; seat: number; slot: number }
  | { type: 'extend'; seat: number; extend: boolean };

export type Pile = 'miles' | 'battle' | 'speed' | 'safety';

export type HandEvent =
  | { type: 'draw'; seat: number; cards: CardId[] }
  | {
      type: 'play';
      seat: number;
      card: CardId;
      kind: Kind;
      /** Whose pile the card landed on. */
      side: Side;
      pile: Pile;
      coup: boolean;
      /** A safety that also cleared the hazard or slow zone it answers. */
      cleared: Kind | null;
    }
  | { type: 'discard'; seat: number; card: CardId; kind: Kind }
  | { type: 'trip'; seat: number; side: Side; miles: number }
  | { type: 'extension'; seat: number; side: Side; extend: boolean }
  | { type: 'over'; reason: 'trip' | 'stalled' };

export const HAND_SLOTS = 7;
export const PICK_SLOT = 0;

export const DUEL_RULES: HandRules = {
  trip: 700,
  extension: true,
  teams: false,
  deck: {} as DeckCounts,
  safetyDiscard: 'allow',
};

function emptyTableau(): Tableau {
  return {
    battle: null,
    speed: null,
    canGo: false,
    miles: 0,
    distanceCounts: { m25: 0, m50: 0, m75: 0, m100: 0, m200: 0 },
    safeties: { longRangeTank: 'none', runFlats: 'none', roadSense: 'none', greenWave: 'none' },
    coups: 0,
    battlePile: [],
    speedPile: [],
    milePile: [],
    safetyPile: [],
  };
}

/**
 * Deals a hand from a shuffled deck (`order` lists card ids, the top card last). Each seat in
 * turn takes six cards off the top, as `init()` deals them; the pick slot starts empty.
 */
export function dealHand(rules: HandRules, order: readonly CardId[], starter: number): HandState {
  const seatCount = rules.teams ? 4 : 2;
  const deck = [...order];
  const cards = deckKinds(rules.deck);
  const seen = Array.from({ length: seatCount }, () => new Array<number>(19).fill(0));
  const seats: Seat[] = Array.from({ length: seatCount }, (_, i) => {
    const hand: (CardId | null)[] = [null];
    for (let slot = 1; slot < HAND_SLOTS; slot++) {
      const card = deck.pop()!;
      hand.push(card);
      seen[i]![ordinal(cards[card]!)]!++;
    }
    return { side: (i % 2) as Side, hand };
  });
  return {
    rules,
    cards,
    deck,
    discards: [],
    seats,
    sides: [emptyTableau(), emptyTableau()],
    turn: starter,
    starter,
    end: rules.trip,
    extendedBy: null,
    awaitingExtension: false,
    coupWindow: null,
    over: false,
    seen,
    actions: 0,
  };
}

export const other = (side: Side): Side => (side === 0 ? 1 : 0);

export function kindAt(state: HandState, seat: number, slot: number): Kind | null {
  const card = state.seats[seat]!.hand[slot];
  return card === null || card === undefined ? null : state.cards[card]!;
}

/** The original's `is_repair`: a remedy, or an empty battle pile. */
export function isRepairOrEmpty(kind: Kind | null): boolean {
  return kind === null || kind === 'fillUp' || kind === 'spareTyre' || kind === 'mechanic';
}

/** True when the seat still owes its draw this turn (the original's "must pick first"). */
export function mustDraw(state: HandState, seat: number): boolean {
  return state.deck.length > 0 && state.seats[seat]!.hand[PICK_SLOT] === null;
}

/**
 * Whether a safety may be played before drawing: it answers the hazard on the battle pile, or
 * it is the green wave and a slow zone is in force. (In the original a coup fourré is exactly
 * this play made while the hazard is fresh.)
 */
export function answersCurrentTrouble(tableau: Tableau, safety: Safety): boolean {
  return (
    tableau.battle === opposite(safety) || (safety === 'greenWave' && tableau.speed === 'slowZone')
  );
}

/** Why a card cannot be played right now, or 'ok'. The helper turns these into words. */
export type PlayVerdict =
  | 'ok'
  | 'empty-slot'
  | 'not-your-turn'
  | 'decide-extension'
  | 'draw-first'
  | 'need-green'
  | 'slow-zone'
  | 'over-trip'
  | 'two-long-hauls'
  | 'rival-stopped'
  | 'rival-immune'
  | 'rival-slowed'
  | 'nothing-to-fix'
  | 'fix-first'
  | 'not-slowed'
  | 'already-rolling';

export function playVerdict(state: HandState, seat: number, slot: number): PlayVerdict {
  const kind = kindAt(state, seat, slot);
  if (kind === null) return 'empty-slot';
  if (state.over || state.turn !== seat) return 'not-your-turn';
  if (state.awaitingExtension) return 'decide-extension';
  const own = state.sides[state.seats[seat]!.side];
  if (mustDraw(state, seat) && !(isSafety(kind) && answersCurrentTrouble(own, kind))) {
    return 'draw-first';
  }
  return ruleVerdict(state, state.seats[seat]!.side, kind);
}

/** The rules of `playcard`, apart from whose turn it is and the draw. */
export function ruleVerdict(state: HandState, side: Side, kind: Kind): PlayVerdict {
  const own = state.sides[side];
  const rival = state.sides[other(side)];
  if (isDistance(kind)) {
    if (kind === 'm200' && own.distanceCounts.m200 >= 2) return 'two-long-hauls';
    if (kind !== 'm25' && kind !== 'm50' && own.speed === 'slowZone') return 'slow-zone';
    if (own.miles + MILES[kind] > state.end) return 'over-trip';
    return own.canGo ? 'ok' : 'need-green';
  }
  switch (kind) {
    case 'noFuel':
    case 'flatTyre':
    case 'fenderBender':
    case 'redLight':
      if (!rival.canGo) return 'rival-stopped';
      return rival.safeties[safetyFor(kind)] !== 'none' ? 'rival-immune' : 'ok';
    case 'slowZone':
      if (rival.speed === 'slowZone') return 'rival-slowed';
      return rival.safeties.greenWave !== 'none' ? 'rival-immune' : 'ok';
    case 'fillUp':
    case 'spareTyre':
    case 'mechanic':
      return own.battle === opposite(kind) ? 'ok' : 'nothing-to-fix';
    case 'greenLight':
      if (isRepairOrEmpty(own.battle) || own.battle === 'redLight') return 'ok';
      return own.battle === 'greenLight' ? 'already-rolling' : 'fix-first';
    case 'openRoad':
      return own.speed === 'slowZone' ? 'ok' : 'not-slowed';
    default:
      return 'ok';
  }
}

/**
 * The computer's own view of what it could play (`canplay` in `comp.c`). It is stricter than
 * the rules in two places: a slow zone is never thrown at a rival within 50 miles of the trip,
 * and a green light is never laid while already free to roll. The hand also ends on this view
 * once the deck is empty (`check_go`).
 */
export function couldUse(state: HandState, side: Side, kind: Kind | null): boolean {
  if (kind === null) return false;
  const own = state.sides[side];
  const rival = state.sides[other(side)];
  if (isDistance(kind)) {
    if (kind === 'm200' && own.distanceCounts.m200 === 2) return false;
    if (kind !== 'm25' && kind !== 'm50' && own.speed === 'slowZone') return false;
    if (kind !== 'm25' && own.miles + MILES[kind] > state.end) return false;
    return own.canGo;
  }
  switch (kind) {
    case 'noFuel':
    case 'flatTyre':
    case 'fenderBender':
    case 'redLight':
      return rival.canGo && rival.safeties[safetyFor(kind)] === 'none';
    case 'slowZone':
      return (
        rival.speed !== 'slowZone' &&
        rival.safeties.greenWave === 'none' &&
        rival.miles + 50 < state.end
      );
    case 'fillUp':
    case 'spareTyre':
    case 'mechanic':
      return own.battle === opposite(kind);
    case 'greenLight':
      return !own.canGo && (isRepairOrEmpty(own.battle) || own.battle === 'redLight');
    case 'openRoad':
      return own.speed === 'slowZone';
    default:
      return false;
  }
}

/** The slots a seat may play from now, and whether it may draw, discard or call a coup. */
export function legalActions(state: HandState, seat: number): Action[] {
  if (state.over) return [];
  const actions: Action[] = [];
  const hand = state.seats[seat]!.hand;
  for (let slot = 0; slot < HAND_SLOTS; slot++) {
    if (canCoup(state, seat, slot)) actions.push({ type: 'coup', seat, slot });
  }
  if (state.turn !== seat) return actions;
  if (state.awaitingExtension) {
    return [
      { type: 'extend', seat, extend: true },
      { type: 'extend', seat, extend: false },
    ];
  }
  if (mustDraw(state, seat)) actions.push({ type: 'draw', seat });
  for (let slot = 0; slot < HAND_SLOTS; slot++) {
    if (hand[slot] === null) continue;
    if (actions.some((a) => a.type === 'coup' && a.slot === slot)) continue;
    if (playVerdict(state, seat, slot) === 'ok') actions.push({ type: 'play', seat, slot });
  }
  if (!mustDraw(state, seat)) {
    for (let slot = 0; slot < HAND_SLOTS; slot++) {
      const kind = kindAt(state, seat, slot);
      if (kind === null) continue;
      if (isSafety(kind) && state.rules.safetyDiscard === 'refuse') continue;
      actions.push({ type: 'discard', seat, slot });
    }
  }
  return actions;
}

/** A coup fourré: the safety that parries the hazard that has just landed on this seat's side. */
export function canCoup(state: HandState, seat: number, slot: number): boolean {
  const window = state.coupWindow;
  if (!window || state.over || state.awaitingExtension) return false;
  const side = state.seats[seat]!.side;
  if (side !== window.side) return false;
  const kind = kindAt(state, seat, slot);
  if (kind !== safetyFor(window.hazard)) return false;
  const tableau = state.sides[side];
  return window.hazard === 'slowZone'
    ? tableau.speed === 'slowZone'
    : tableau.battle === window.hazard;
}

export function seatsOf(state: HandState, side: Side): number[] {
  return state.seats.flatMap((seat, i) => (seat.side === side ? [i] : []));
}

/** Applies one action and returns what happened. Throws on an illegal action. */
export function apply(state: HandState, action: Action): HandEvent[] {
  if (state.over) throw new Error('the hand is over');
  const events: HandEvent[] = [];
  switch (action.type) {
    case 'draw':
      draw(state, action.seat, events);
      break;
    case 'play':
      // Laying the matching safety while the hazard is fresh is a coup fourré, however it is asked for.
      play(state, action.seat, action.slot, canCoup(state, action.seat, action.slot), events);
      break;
    case 'coup':
      if (!canCoup(state, action.seat, action.slot)) throw new Error('no coup fourré there');
      play(state, action.seat, action.slot, true, events);
      break;
    case 'discard':
      discard(state, action.seat, action.slot, events);
      break;
    case 'extend':
      decideExtension(state, action.seat, action.extend, events);
      break;
  }
  state.actions++;
  if (!state.over && state.deck.length === 0 && !anyoneCanPlay(state)) {
    endHand(state, 'stalled', events);
  }
  if (!state.over) skipEmptyHands(state);
  return events;
}

function requireTurn(state: HandState, seat: number): void {
  if (state.turn !== seat) throw new Error(`not seat ${seat}'s turn`);
  if (state.awaitingExtension) throw new Error('the extension must be decided first');
}

function draw(state: HandState, seat: number, events: HandEvent[]): void {
  requireTurn(state, seat);
  if (!mustDraw(state, seat)) throw new Error('nothing to draw');
  const hand = state.seats[seat]!.hand;
  const drawn: CardId[] = [];
  // The pick slot first; if a coup fourré left a gap, the next slot too (as `domove` does).
  for (const slot of [0, 1]) {
    if (hand[slot] !== null || state.deck.length === 0) continue;
    const card = state.deck.pop()!;
    hand[slot] = card;
    drawn.push(card);
    state.seen[seat]![ordinal(state.cards[card]!)]!++;
  }
  state.coupWindow = null;
  events.push({ type: 'draw', seat, cards: drawn });
}

function play(
  state: HandState,
  seat: number,
  slot: number,
  coup: boolean,
  events: HandEvent[],
): void {
  if (!coup) {
    requireTurn(state, seat);
    const verdict = playVerdict(state, seat, slot);
    if (verdict !== 'ok') throw new Error(`cannot play: ${verdict}`);
  }
  const hand = state.seats[seat]!.hand;
  const card = hand[slot]!;
  const kind = state.cards[card]!;
  const side = state.seats[seat]!.side;
  hand[slot] = null;
  compactHand(hand);
  noteSeenByOthers(state, seat, kind);

  if (isSafety(kind)) {
    const cleared = playSafety(state, side, card, kind, coup);
    events.push({ type: 'play', seat, card, kind, side, pile: 'safety', coup, cleared });
    // A safety always earns another turn; after a coup fourré the turn jumps to its player.
    state.turn = seat;
    if (coup) state.coupWindow = null;
    return;
  }

  state.coupWindow = null;
  if (isHazard(kind)) {
    const target = other(side);
    const tableau = state.sides[target];
    if (kind === 'slowZone') {
      tableau.speed = 'slowZone';
      tableau.speedPile.push(card);
      events.push({
        type: 'play',
        seat,
        card,
        kind,
        side: target,
        pile: 'speed',
        coup,
        cleared: null,
      });
    } else {
      tableau.battle = kind;
      tableau.canGo = false;
      tableau.battlePile.push(card);
      events.push({
        type: 'play',
        seat,
        card,
        kind,
        side: target,
        pile: 'battle',
        coup,
        cleared: null,
      });
    }
    state.coupWindow = { side: target, hazard: kind };
    passTurn(state);
    return;
  }

  const tableau = state.sides[side];
  if (isDistance(kind)) {
    tableau.distanceCounts[kind]++;
    tableau.miles += MILES[kind];
    tableau.milePile.push(card);
    events.push({ type: 'play', seat, card, kind, side, pile: 'miles', coup, cleared: null });
    if (tableau.miles === state.end) {
      events.push({ type: 'trip', seat, side, miles: tableau.miles });
      if (state.rules.extension && state.extendedBy === null && state.end < 1000) {
        state.awaitingExtension = true;
        return;
      }
      endHand(state, 'trip', events);
      return;
    }
    passTurn(state);
    return;
  }

  if (kind === 'openRoad') {
    tableau.speed = 'openRoad';
    tableau.speedPile.push(card);
    events.push({ type: 'play', seat, card, kind, side, pile: 'speed', coup, cleared: null });
  } else {
    tableau.battle = kind;
    if (kind === 'greenLight') tableau.canGo = true;
    else if (tableau.safeties.greenWave !== 'none') tableau.canGo = true;
    tableau.battlePile.push(card);
    events.push({ type: 'play', seat, card, kind, side, pile: 'battle', coup, cleared: null });
  }
  passTurn(state);
}

/** The safety branch of `playcard`, line for line, with the coup fourré narrowed as noted above. */
function playSafety(
  state: HandState,
  side: Side,
  card: CardId,
  safety: Safety,
  coup: boolean,
): Kind | null {
  const tableau = state.sides[side];
  let cleared: Kind | null = null;
  if (answersCurrentTrouble(tableau, safety)) {
    if (!(safety === 'greenWave' && !isRepairOrEmpty(tableau.battle))) {
      if (tableau.battle !== null && tableau.battle !== 'greenLight' && isHazard(tableau.battle)) {
        cleared = tableau.battle;
      }
      tableau.battle = 'greenLight';
      tableau.canGo = true;
    }
    if (safety === 'greenWave' && tableau.speed === 'slowZone') {
      tableau.speed = null;
      cleared ??= 'slowZone';
    }
  }
  if (coup) tableau.coups++;
  tableau.safeties[safety] = coup ? 'coup' : 'played';
  tableau.safetyPile.push(card);
  if (safety === 'greenWave') {
    if (tableau.speed === 'slowZone') {
      tableau.speed = null;
      cleared ??= 'slowZone';
    }
    if (tableau.battle === 'redLight' || tableau.battle === null) {
      if (tableau.battle === 'redLight') cleared ??= 'redLight';
      tableau.canGo = true;
      tableau.battle = null;
    }
    if (!tableau.canGo && isRepairOrEmpty(tableau.battle)) tableau.canGo = true;
  }
  return cleared;
}

function discard(state: HandState, seat: number, slot: number, events: HandEvent[]): void {
  requireTurn(state, seat);
  if (mustDraw(state, seat)) throw new Error('draw first');
  const hand = state.seats[seat]!.hand;
  const card = hand[slot];
  if (card === null || card === undefined) throw new Error('no card there');
  const kind = state.cards[card]!;
  if (isSafety(kind) && state.rules.safetyDiscard === 'refuse') throw new Error('a safety stays');
  hand[slot] = null;
  compactHand(hand);
  state.discards.push(card);
  noteSeenByOthers(state, seat, kind);
  state.coupWindow = null;
  events.push({ type: 'discard', seat, card, kind });
  passTurn(state);
}

function decideExtension(
  state: HandState,
  seat: number,
  extend: boolean,
  events: HandEvent[],
): void {
  if (!state.awaitingExtension || state.turn !== seat) throw new Error('no extension to decide');
  const side = state.seats[seat]!.side;
  state.awaitingExtension = false;
  events.push({ type: 'extension', seat, side, extend });
  if (!extend) {
    endHand(state, 'trip', events);
    return;
  }
  state.end = 1000;
  state.extendedBy = side;
  passTurn(state);
}

function endHand(state: HandState, reason: 'trip' | 'stalled', events: HandEvent[]): void {
  state.over = true;
  state.coupWindow = null;
  events.push({ type: 'over', reason });
}

function passTurn(state: HandState): void {
  state.turn = (state.turn + 1) % state.seats.length;
}

/** With the deck gone, a seat with no cards left simply sits out its turns. */
function skipEmptyHands(state: HandState): void {
  for (let i = 0; i < state.seats.length; i++) {
    if (state.seats[state.turn]!.hand.some((c) => c !== null)) return;
    if (state.deck.length > 0 || state.awaitingExtension) return;
    passTurn(state);
  }
}

/** `check_go`: once the deck is empty, the hand goes on only while someone has a use for a card. */
export function anyoneCanPlay(state: HandState): boolean {
  return state.seats.some((seat) =>
    seat.hand.some((card) => {
      if (card === null) return false;
      const kind = state.cards[card]!;
      return isSafety(kind) || couldUse(state, seat.side, kind);
    }),
  );
}

/**
 * Closes the gap a played card leaves, exactly as `domove` does: each empty slot from 1 to 6
 * takes the first card found from slot 0 on, so the picked card drops into the gap.
 */
export function compactHand(hand: (CardId | null)[]): void {
  for (let i = 1; i < HAND_SLOTS; i++) {
    if (hand[i] !== null) continue;
    const j = hand.findIndex((card) => card !== null);
    if (j < 0 || j >= i) continue;
    hand[i] = hand[j]!;
    hand[j] = null;
  }
}

function noteSeenByOthers(state: HandState, seat: number, kind: Kind): void {
  const n = ordinal(kind);
  state.seen.forEach((counts, i) => {
    if (i !== seat) counts[n]!++;
  });
}

export function cardsInHand(state: HandState, seat: number): number {
  return state.seats[seat]!.hand.filter((c) => c !== null).length;
}

export function safetiesPlayed(tableau: Tableau): number {
  return SAFETIES.filter((s) => tableau.safeties[s] !== 'none').length;
}

export function longHaulsPlayed(tableau: Tableau): number {
  return tableau.distanceCounts.m200;
}

export { DISTANCES };
