import { createRng, restoreRng, type Rng, type RngState } from '@usr-games/kit';
import { type CardId, JACK, rankOf, shuffledDeck } from '@usr-games/kit/cards';
import { byRank, valueOf } from './cards';
import { canPlay, PLAY_LIMIT, type PegCombo, pegScore } from './peg';
import { countHand, type HandCount, MAX_HAND } from './score';

/**
 * One game of cribbage between you (seat 0) and the computer (seat 1), as pure functions over
 * a plain, JSON-safe state. Every action returns the next state and the events it caused, in
 * order, so the table can animate them one by one and the tests can read them. Randomness (the
 * shuffle, the cuts) comes from the kit's seeded generator held in the state, so a seed replays
 * the same game.
 *
 * The order of scoring follows the rules strictly, because the game ends the moment a peg
 * reaches the last hole: his heels, then the play, then the non-dealer's hand, the dealer's
 * hand and the crib.
 */

export type Seat = 0 | 1;
export const YOU: Seat = 0;
export const RIVAL: Seat = 1;
export const other = (seat: Seat): Seat => (seat === 0 ? 1 : 0);

export type GameLength = 61 | 121;

/**
 * How your own hands are counted. Automatic counts for you; Count yourself asks for your total
 * and then shows the right one, with no penalty; Classic 1980 is the original program's rule:
 * claim too much and you get the true count while the computer pegs 2, claim too little and the
 * rest is lost. In Classic 1980 a claim of 19 is read as nothing.
 */
export type CountingMode = 'automatic' | 'yourself' | 'classic-1980';

export interface MatchOptions {
  length: GameLength;
  counting: CountingMode;
  /** Who deals the first hand; left out, the two cut for it and the lower card deals. */
  firstDealer?: Seat;
}

export type Phase = 'discard' | 'play' | 'show' | 'hand-over' | 'game-over';

export interface PlayedCard {
  seat: Seat;
  card: CardId;
  /** The count after this card. */
  count: number;
  /** True when this card began a new count from zero. */
  opened: boolean;
}

export interface PlayState {
  inHand: [CardId[], CardId[]];
  /** The cards since the count last went back to zero. */
  pile: CardId[];
  count: number;
  turn: Seat;
  saidGo: [boolean, boolean];
  lastPlayer: Seat | null;
  played: PlayedCard[];
  /** The counts at which each player said go: what the other may infer about their hand. */
  goCounts: [number[], number[]];
}

export interface ShowStep {
  seat: Seat;
  isCrib: boolean;
}

export interface CutForDeal {
  you: CardId;
  rival: CardId;
}

export interface MatchState {
  options: MatchOptions;
  scores: [number, number];
  /** Where each player's trailing peg stands; it leapfrogs the front peg on every score. */
  backPegs: [number, number];
  dealer: Seat;
  phase: Phase;
  /** Hands dealt so far in this game. */
  hand: number;
  dealt: [CardId[], CardId[]];
  /** The four cards each player keeps for the show (empty until they lay away). */
  kept: [CardId[], CardId[]];
  discards: [CardId[], CardId[]];
  crib: CardId[];
  stock: CardId[];
  starter: CardId | null;
  play: PlayState | null;
  /** Which of the three counts of the show comes next. */
  showIndex: number;
  winner: Seat | null;
  /** The cuts for the first deal, ties included, when the players cut for it. */
  cutsForDeal: CutForDeal[];
  rng: RngState;
}

export type ScoreReason =
  'his-heels' | 'play' | 'go' | 'last-card' | 'hand' | 'crib' | 'over-count';

export type Skunk = 'none' | 'skunk' | 'double-skunk';

export interface ClaimOutcome {
  /** What the player typed. */
  claimed: number;
  /** What it was read as: 19 means nothing in Classic 1980. */
  read: number;
  actual: number;
  awarded: number;
  /** Points the computer pegged for an over-count. */
  penalty: number;
  verdict: 'right' | 'over' | 'under';
}

export type MatchEvent =
  | { type: 'cut-for-deal'; cuts: CutForDeal[]; dealer: Seat }
  | { type: 'dealt'; dealer: Seat; hand: number }
  | { type: 'laid-away'; seat: Seat; cards: CardId[] }
  | { type: 'starter'; card: CardId; cutBy: Seat }
  | {
      type: 'scored';
      seat: Seat;
      points: number;
      reason: ScoreReason;
      /** The front peg before and after; the trailing peg jumps from `back` to `to`. */
      from: number;
      to: number;
      back: number;
    }
  | { type: 'played'; seat: Seat; card: CardId; count: number; combos: PegCombo[] }
  | { type: 'go'; seat: Seat; count: number }
  | { type: 'count-reset'; from: number }
  | { type: 'play-over' }
  | { type: 'shown'; step: ShowStep; count: HandCount; claim: ClaimOutcome | null }
  | { type: 'hand-over' }
  | { type: 'game-over'; winner: Seat; skunk: Skunk; scores: [number, number] };

export interface Step {
  state: MatchState;
  events: MatchEvent[];
}

/** A working copy and an event list that every rule below writes into. */
interface Draft {
  state: MatchState;
  events: MatchEvent[];
}

function cloneState(state: MatchState): MatchState {
  return structuredClone(state);
}

function withRng<T>(draft: Draft, use: (rng: Rng) => T): T {
  const rng = restoreRng(draft.state.rng);
  const result = use(rng);
  draft.state.rng = rng.state();
  return result;
}

export function skunkOf(loserScore: number, length: GameLength): Skunk {
  // The original's arithmetic: more than 60 holes short is a double skunk (in a game of 61 only
  // a loser still on zero), more than 30 a skunk.
  const short = length - loserScore;
  if (short > 60) return 'double-skunk';
  if (short > 30) return 'skunk';
  return 'none';
}

/** Moves a player's pegs. Returns true when that ends the game. */
function score(draft: Draft, seat: Seat, points: number, reason: ScoreReason): boolean {
  const state = draft.state;
  if (points <= 0 || state.phase === 'game-over') return state.phase === 'game-over';
  const from = state.scores[seat];
  const to = Math.min(state.options.length, from + points);
  draft.events.push({ type: 'scored', seat, points, reason, from, to, back: state.backPegs[seat] });
  state.backPegs[seat] = from;
  state.scores[seat] = to;
  if (to >= state.options.length) {
    state.phase = 'game-over';
    state.winner = seat;
    draft.events.push({
      type: 'game-over',
      winner: seat,
      skunk: skunkOf(state.scores[other(seat)], state.options.length),
      scores: [...state.scores],
    });
    return true;
  }
  return false;
}

function dealHand(draft: Draft): void {
  const state = draft.state;
  const deck = withRng(draft, (rng) => shuffledDeck(rng));
  const nonDealer = other(state.dealer);
  const hands: [CardId[], CardId[]] = [[], []];
  // One card at a time, the non-dealer first.
  for (let i = 0; i < 12; i++) hands[i % 2 === 0 ? nonDealer : state.dealer].push(deck[i]!);
  state.hand += 1;
  state.dealt = [hands[0].sort(byRank), hands[1].sort(byRank)];
  state.kept = [[], []];
  state.discards = [[], []];
  state.crib = [];
  state.stock = deck.slice(12);
  state.starter = null;
  state.play = null;
  state.showIndex = 0;
  state.phase = 'discard';
  draft.events.push({ type: 'dealt', dealer: state.dealer, hand: state.hand });
}

function cutForDeal(draft: Draft): Seat {
  const cuts: CutForDeal[] = [];
  for (;;) {
    const deck = withRng(draft, (rng) => shuffledDeck(rng));
    const [youIndex, rivalIndex] = withRng(draft, (rng) => {
      const first = rng.int(0, 51);
      let second = rng.int(0, 50);
      if (second >= first) second++;
      return [first, second];
    });
    const cut = { you: deck[youIndex]!, rival: deck[rivalIndex]! };
    cuts.push(cut);
    if (rankOf(cut.you) !== rankOf(cut.rival)) {
      const dealer: Seat = rankOf(cut.you) < rankOf(cut.rival) ? YOU : RIVAL;
      draft.state.cutsForDeal = cuts;
      draft.events.push({ type: 'cut-for-deal', cuts, dealer });
      return dealer;
    }
  }
}

export function startMatch(options: MatchOptions, seed: string): Step {
  const state: MatchState = {
    options: { ...options },
    scores: [0, 0],
    backPegs: [0, 0],
    dealer: options.firstDealer ?? YOU,
    phase: 'discard',
    hand: 0,
    dealt: [[], []],
    kept: [[], []],
    discards: [[], []],
    crib: [],
    stock: [],
    starter: null,
    play: null,
    showIndex: 0,
    winner: null,
    cutsForDeal: [],
    rng: createRng(seed).state(),
  };
  const draft: Draft = { state, events: [] };
  if (options.firstDealer === undefined) state.dealer = cutForDeal(draft);
  dealHand(draft);
  return draft;
}

/** True once this player has laid away their two cards this hand. */
export function hasLaidAway(state: MatchState, seat: Seat): boolean {
  return state.discards[seat].length === 2;
}

/** The non-dealer cuts the stock and the dealer turns the starter; a jack is two for his heels. */
function turnStarter(draft: Draft): void {
  const state = draft.state;
  const depth = withRng(draft, (rng) => rng.int(4, state.stock.length - 5));
  const starter = state.stock[depth]!;
  state.starter = starter;
  draft.events.push({ type: 'starter', card: starter, cutBy: other(state.dealer) });
  if (rankOf(starter) === JACK && score(draft, state.dealer, 2, 'his-heels')) return;
  const nonDealer = other(state.dealer);
  state.phase = 'play';
  state.play = {
    inHand: [[...state.kept[0]], [...state.kept[1]]],
    pile: [],
    count: 0,
    turn: nonDealer,
    saidGo: [false, false],
    lastPlayer: null,
    played: [],
    goCounts: [[], []],
  };
  settlePlay(draft);
}

export function layAway(state: MatchState, seat: Seat, cards: readonly CardId[]): Step {
  if (state.phase !== 'discard') throw new Error('not laying away now');
  if (hasLaidAway(state, seat)) throw new Error('already laid away');
  if (cards.length !== 2 || cards[0] === cards[1]) throw new Error('lay away two cards');
  if (!cards.every((card) => state.dealt[seat].includes(card))) throw new Error('not in hand');
  const draft: Draft = { state: cloneState(state), events: [] };
  const next = draft.state;
  next.discards[seat] = [...cards];
  next.kept[seat] = next.dealt[seat].filter((card) => !cards.includes(card));
  next.crib = [...next.crib, ...cards].sort(byRank);
  draft.events.push({ type: 'laid-away', seat, cards: [...cards] });
  if (hasLaidAway(next, 0) && hasLaidAway(next, 1)) turnStarter(draft);
  return draft;
}

export function playableCards(state: MatchState, seat: Seat): CardId[] {
  const play = state.play;
  if (state.phase !== 'play' || !play) return [];
  return play.inHand[seat].filter((card) => canPlay(card, play.count));
}

function canMove(play: PlayState, seat: Seat): boolean {
  return play.inHand[seat].some((card) => canPlay(card, play.count));
}

function resetCount(play: PlayState, draft: Draft): void {
  draft.events.push({ type: 'count-reset', from: play.count });
  play.count = 0;
  play.pile = [];
  play.saidGo = [false, false];
  // Whoever did not lay the last card leads the new count.
  play.turn = other(play.lastPlayer ?? play.turn);
}

/**
 * Runs everything that happens without a choice: saying go, the point for the go, the count
 * starting again, and the point for the last card. Stops when someone must choose a card, the
 * play is over, or the game is.
 */
function settlePlay(draft: Draft): void {
  const state = draft.state;
  const play = state.play!;
  for (;;) {
    if (state.phase === 'game-over') return;
    const bothOut = play.inHand[0].length === 0 && play.inHand[1].length === 0;
    if (bothOut) {
      // The last card of all counts as a go, unless it made 31, which already scored.
      if (play.count < PLAY_LIMIT && play.lastPlayer !== null) {
        if (score(draft, play.lastPlayer, 1, 'last-card')) return;
      }
      draft.events.push({ type: 'play-over' });
      state.phase = 'show';
      state.showIndex = 0;
      return;
    }
    if (play.count === PLAY_LIMIT) {
      resetCount(play, draft);
      continue;
    }
    const seat = play.turn;
    if (canMove(play, seat)) return;
    if (play.inHand[seat].length > 0 && !play.saidGo[seat]) {
      play.saidGo[seat] = true;
      play.goCounts[seat].push(play.count);
      draft.events.push({ type: 'go', seat, count: play.count });
    }
    const otherSeat = other(seat);
    if (canMove(play, otherSeat)) {
      play.turn = otherSeat;
      return;
    }
    // Neither can lay a card: one for the go to whoever laid the last one, and start again.
    if (play.lastPlayer !== null && score(draft, play.lastPlayer, 1, 'go')) return;
    resetCount(play, draft);
  }
}

export function playCard(state: MatchState, seat: Seat, card: CardId): Step {
  const play = state.play;
  if (state.phase !== 'play' || !play) throw new Error('not the play now');
  if (play.turn !== seat) throw new Error('not your turn');
  if (!play.inHand[seat].includes(card)) throw new Error('not in hand');
  if (!canPlay(card, play.count)) throw new Error('over 31');
  const draft: Draft = { state: cloneState(state), events: [] };
  const next = draft.state.play!;
  const result = pegScore(next.pile, card);
  next.inHand[seat] = next.inHand[seat].filter((held) => held !== card);
  next.played.push({ seat, card, count: result.count, opened: next.pile.length === 0 });
  next.pile.push(card);
  next.count = result.count;
  next.lastPlayer = seat;
  draft.events.push({ type: 'played', seat, card, count: result.count, combos: result.combos });
  if (score(draft, seat, result.points, 'play')) return draft;
  next.turn = other(seat);
  settlePlay(draft);
  return draft;
}

/** The three counts of the show, in the order the rules fix: non-dealer, dealer, crib. */
export function showOrder(state: MatchState): ShowStep[] {
  const nonDealer = other(state.dealer);
  return [
    { seat: nonDealer, isCrib: false },
    { seat: state.dealer, isCrib: false },
    { seat: state.dealer, isCrib: true },
  ];
}

export function currentShowStep(state: MatchState): ShowStep | null {
  if (state.phase !== 'show') return null;
  return showOrder(state)[state.showIndex] ?? null;
}

export function cardsShown(state: MatchState, step: ShowStep): CardId[] {
  return step.isCrib ? state.crib : state.kept[step.seat];
}

/** True when the next count is yours and the counting mode asks you for a total. */
export function needsClaim(state: MatchState): boolean {
  const step = currentShowStep(state);
  return step !== null && step.seat === YOU && state.options.counting !== 'automatic';
}

/** How a claimed total is settled under the counting mode. */
export function settleClaim(mode: CountingMode, claimed: number, actual: number): ClaimOutcome {
  const read = mode === 'classic-1980' && claimed === 19 ? 0 : claimed;
  const verdict = read === actual ? 'right' : read > actual ? 'over' : 'under';
  if (mode !== 'classic-1980') {
    return { claimed, read, actual, awarded: actual, penalty: 0, verdict };
  }
  return {
    claimed,
    read,
    actual,
    awarded: verdict === 'under' ? read : actual,
    penalty: verdict === 'over' ? 2 : 0,
    verdict,
  };
}

/** Counts the next hand (or the crib). Pass your claim when `needsClaim` says so. */
export function showNext(state: MatchState, claimed?: number): Step {
  const step = currentShowStep(state);
  if (!step || state.starter === null) throw new Error('nothing to count now');
  const asking = needsClaim(state);
  if (asking && (claimed === undefined || !Number.isInteger(claimed))) {
    throw new Error('a claim is needed');
  }
  if (asking && (claimed! < 0 || claimed! > MAX_HAND)) throw new Error('claims run from 0 to 29');
  const draft: Draft = { state: cloneState(state), events: [] };
  const next = draft.state;
  const count = countHand(cardsShown(next, step), next.starter!, step.isCrib);
  const claim = asking ? settleClaim(next.options.counting, claimed!, count.total) : null;
  draft.events.push({ type: 'shown', step, count, claim });
  const reason: ScoreReason = step.isCrib ? 'crib' : 'hand';
  const ended = score(draft, step.seat, claim ? claim.awarded : count.total, reason);
  if (!ended && claim && claim.penalty > 0) score(draft, RIVAL, claim.penalty, 'over-count');
  if (next.phase === 'game-over') return draft;
  next.showIndex += 1;
  if (next.showIndex >= 3) {
    next.phase = 'hand-over';
    draft.events.push({ type: 'hand-over' });
  }
  return draft;
}

export function nextHand(state: MatchState): Step {
  if (state.phase !== 'hand-over') throw new Error('the hand is not over');
  const draft: Draft = { state: cloneState(state), events: [] };
  draft.state.dealer = other(draft.state.dealer);
  dealHand(draft);
  return draft;
}

/** Everything a computer player may know when laying away. */
export interface DiscardView {
  hand: CardId[];
  ownCrib: boolean;
  scores: [mine: number, theirs: number];
  length: GameLength;
}

/** Everything a computer player may know when laying a card: its own cards and the table. */
export interface PlayView {
  hand: CardId[];
  pile: CardId[];
  count: number;
  kept: CardId[];
  laidAway: CardId[];
  starter: CardId;
  played: PlayedCard[];
  /** Counts at which the opponent said go this hand. */
  theirGoCounts: number[];
  theirCardsLeft: number;
  ownCrib: boolean;
  scores: [mine: number, theirs: number];
  length: GameLength;
  seat: Seat;
}

export function discardView(state: MatchState, seat: Seat): DiscardView {
  return {
    hand: [...state.dealt[seat]],
    ownCrib: state.dealer === seat,
    scores: [state.scores[seat], state.scores[other(seat)]],
    length: state.options.length,
  };
}

export function playView(state: MatchState, seat: Seat): PlayView {
  const play = state.play!;
  return {
    hand: [...play.inHand[seat]],
    pile: [...play.pile],
    count: play.count,
    kept: [...state.kept[seat]],
    laidAway: [...state.discards[seat]],
    starter: state.starter!,
    played: play.played.map((entry) => ({ ...entry })),
    theirGoCounts: [...play.goCounts[other(seat)]],
    theirCardsLeft: play.inHand[other(seat)].length,
    ownCrib: state.dealer === seat,
    scores: [state.scores[seat], state.scores[other(seat)]],
    length: state.options.length,
    seat,
  };
}

/** The sum of the cards on the table since the count went back to zero. */
export function tableCount(pile: readonly CardId[]): number {
  return pile.reduce((sum, card) => sum + valueOf(card), 0);
}
