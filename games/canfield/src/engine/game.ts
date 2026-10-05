import type { CardId } from '@usr-games/kit/cards';
import {
  type Account,
  billTime,
  charge,
  openAccount,
  pointsBreakdown,
  type PointsBreakdown,
  type Scoring,
  type Statement,
  statementOf,
} from './ledger';
import {
  advanceStage,
  applyMove,
  homeCount,
  type Layout,
  type Move,
  openDeal,
  type RuleEvent,
  type RuleSet,
  type Stage,
} from './rules';

/**
 * One deal in play: the layout, what the player has seen and paid to be shown, the account,
 * and the undo trail. Pure functions; the caller passes the game clock (milliseconds since the
 * deal began, paused when the game is) with every command, as the original billed time per
 * command.
 */

export type DealKind = 'random' | 'winnable' | 'daily' | 'challenge' | 'tutorial';

export interface DealSource {
  kind: DealKind;
  seed: string;
  /** The kit's public daily number, for the Daily Deal. */
  daily?: number;
  challenge?: string;
}

/** How a deal ended: won, stalled (the original's fourth idle turn-over), quit, or walked away from in Bank before playing it out. */
export type Ending = 'won' | 'stalled' | 'quit' | 'walked-away';

export interface Counters {
  moves: number;
  undos: number;
  hints: number;
  turnOvers: number;
}

export interface Game {
  source: DealSource;
  rules: RuleSet;
  scoring: Scoring;
  deal: readonly CardId[];
  layout: Layout;
  /** Layouts before each of the player's moves, newest last. */
  history: readonly Layout[];
  /** Hand cards that have shown on top of the talon at least once. */
  seen: readonly CardId[];
  /** Hand cards Insight has listed, and so charged for (at most 34). */
  listed: readonly CardId[];
  insight: boolean;
  insightUsed: boolean;
  account: Account;
  counters: Counters;
  /** The run during which the reserve was emptied, if it has been. */
  reserveClearedInRun: number | null;
  ending: Ending | null;
  endedAtMs: number | null;
}

export interface GameStep {
  game: Game;
  events: RuleEvent[];
}

/** Undo keeps this many moves; plenty for a deal, small enough for a save. */
export const HISTORY_LIMIT = 300;

export function startGame(
  source: DealSource,
  deal: readonly CardId[],
  rules: RuleSet,
  scoring: Scoring,
): GameStep {
  // Bank deals open with only the deal paid for; inspection and the game are the player's call.
  const stage: Stage = scoring === 'bank' ? 'dealt' : 'full';
  const { layout, events } = openDeal(deal, rules, stage);
  const game: Game = {
    source,
    rules,
    scoring,
    deal,
    layout,
    history: [],
    seen: [],
    listed: [],
    insight: false,
    insightUsed: false,
    account: charge(openAccount(scoring), 'deal', 0),
    counters: { moves: 0, undos: 0, hints: 0, turnOvers: 0 },
    reserveClearedInRun: null,
    ending: null,
    endedAtMs: null,
  };
  return { game: noteEvents(game, events, 0), events };
}

function handCards(game: Game): Set<CardId> {
  return new Set(game.deal.slice(18));
}

/** Records what the events showed, bills turn-overs, and has Insight list what it now knows. */
function noteEvents(game: Game, events: readonly RuleEvent[], nowMs: number): Game {
  const hand = handCards(game);
  const seen = new Set(game.seen);
  let account = game.account;
  let turnOvers = game.counters.turnOvers;
  for (const event of events) {
    if (event.kind === 'exposed' && hand.has(event.card)) seen.add(event.card);
    if (event.kind === 'turned-over') {
      turnOvers += 1;
      if (game.rules === 'standard') account = charge(account, 'run', nowMs);
    }
  }
  const layout = game.layout;
  const reserveClearedInRun =
    game.reserveClearedInRun ?? (layout.stock.length === 0 ? layout.run : null);
  const ending: Ending | null =
    game.ending ??
    (layout.outcome === 'won' ? 'won' : layout.outcome === 'stalled' ? 'stalled' : null);
  const next: Game = {
    ...game,
    seen: [...seen],
    account,
    counters: { ...game.counters, turnOvers },
    reserveClearedInRun,
    ending,
    endedAtMs: ending && game.endedAtMs === null ? nowMs : game.endedAtMs,
  };
  return next.insight ? listKnownCards(next, nowMs) : next;
}

/** Hand cards Insight would show right now: still in the hand or talon, and seen before. */
export function knownCards(game: Game): CardId[] {
  const seen = new Set(game.seen);
  return [...game.layout.talon, ...game.layout.hand].filter((card) => seen.has(card));
}

/** Insight lists every seen card still in play; each costs once, the first time it is listed. */
function listKnownCards(game: Game, nowMs: number): Game {
  const listed = new Set(game.listed);
  const fresh = knownCards(game).filter((card) => !listed.has(card));
  if (fresh.length === 0) return game;
  return {
    ...game,
    listed: [...game.listed, ...fresh],
    account: charge(game.account, 'insight', nowMs, fresh.length),
  };
}

function isOver(game: Game): boolean {
  return game.ending !== null;
}

/** Every command bills the time since the last one (Bank only). */
function bill(game: Game, nowMs: number): Game {
  return { ...game, account: billTime(game.account, nowMs) };
}

export function playMove(game: Game, move: Move, nowMs: number): GameStep | null {
  if (isOver(game)) return null;
  const step = applyMove(game.layout, move);
  if (!step) return null;
  const history = [...game.history, game.layout].slice(-HISTORY_LIMIT);
  const next: Game = {
    ...bill(game, nowMs),
    layout: step.layout,
    history,
    counters: { ...game.counters, moves: game.counters.moves + 1 },
  };
  return { game: noteEvents(next, step.events, nowMs), events: step.events };
}

export function canUndo(game: Game): boolean {
  return !isOver(game) && game.history.length > 0;
}

/**
 * Takes back the last move. Charges are never refunded, what was seen stays seen, and a stage
 * already paid for stays paid.
 */
export function undoMove(game: Game, nowMs: number): Game | null {
  if (!canUndo(game)) return null;
  const previous = game.history[game.history.length - 1]!;
  const billed = bill(game, nowMs);
  return {
    ...billed,
    layout: advanceStage(previous, game.layout.stage),
    history: game.history.slice(0, -1),
    account: charge(billed.account, 'undo', nowMs),
    counters: { ...game.counters, undos: game.counters.undos + 1 },
  };
}

/** Charges for a hint the player asked to see. */
export function payForHint(game: Game, nowMs: number): Game {
  if (isOver(game)) return game;
  const billed = bill(game, nowMs);
  return {
    ...billed,
    account: charge(billed.account, 'hint', nowMs),
    counters: { ...game.counters, hints: game.counters.hints + 1 },
  };
}

/** The original's `c`: card counting on or off. Turning it on lists, and bills, what is known. */
export function setInsight(game: Game, on: boolean, nowMs: number): Game {
  if (isOver(game) || game.insight === on) return game;
  const next = { ...bill(game, nowMs), insight: on, insightUsed: game.insightUsed || on };
  return on ? listKnownCards(next, nowMs) : next;
}

/** Bank: pays for the inspection ($13) or the rest of the game ($26). */
export function buyStage(game: Game, stage: 'inspection' | 'full', nowMs: number): Game {
  if (isOver(game) || game.scoring !== 'bank') return game;
  const order: Stage[] = ['dealt', 'inspection', 'full'];
  if (order.indexOf(stage) <= order.indexOf(game.layout.stage)) return game;
  let account = billTime(game.account, nowMs);
  // Buying the game straight from the deal pays for the inspection too, as the original asks
  // for the inspection on the first move of any kind.
  if (game.layout.stage === 'dealt') account = charge(account, 'inspection', nowMs);
  if (stage === 'full') account = charge(account, 'game', nowMs);
  return { ...game, account, layout: advanceStage(game.layout, stage) };
}

/** Ends the deal by the player's choice: quitting, or walking away from a Bank deal unbought. */
export function endGame(game: Game, nowMs: number): Game {
  if (isOver(game)) return game;
  const billed = bill(game, nowMs);
  const ending: Ending =
    game.scoring === 'bank' && game.layout.stage !== 'full' ? 'walked-away' : 'quit';
  return { ...billed, ending, endedAtMs: nowMs };
}

export function cardsHome(game: Game): number {
  return homeCount(game.layout);
}

export function isWon(game: Game): boolean {
  return game.ending === 'won';
}

export function pointsOf(game: Game, nowMs: number): PointsBreakdown {
  const elapsed = game.endedAtMs ?? nowMs;
  return pointsBreakdown(cardsHome(game), game.account, isWon(game), elapsed);
}

export function statementOfGame(game: Game): Statement {
  return statementOf(game.account, cardsHome(game), game.layout.stage === 'full');
}
