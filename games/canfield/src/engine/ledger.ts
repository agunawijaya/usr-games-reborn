/**
 * Score keeping in the two ways the player can choose. Both price information the way the
 * original did; neither ever refunds a charge.
 *
 * - Points (the default): cards home earn points, extra passes, Insight, undo and hints cost
 *   points, and a win adds a bonus and a time bonus. Time never costs anything.
 * - Bank: the original's account in fictional play money, its cost table reproduced exactly
 *   (canfield.c, "Basic ... costs", lines 175–182), plus prices for the undo and hints we added.
 */

export type Scoring = 'points' | 'bank';

export const POINTS = {
  perCardHome: 5,
  winBonus: 100,
  extraRun: 5,
  insightPerCard: 1,
  undo: 2,
  hint: 5,
  /** A win earns a point for every five seconds under fifteen minutes. */
  timeBonusWindowSeconds: 15 * 60,
  secondsPerTimePoint: 5,
} as const;

export const BANK = {
  deal: 13,
  inspection: 13,
  game: 26,
  extraRun: 5,
  informationPerCard: 1,
  perCardHome: 5,
  secondsPerDollar: 60,
  /** The most one stretch between two commands can be billed (canfield.c `maxtimecharge`). */
  maxTimeCharge: 3,
  undo: 2,
  hint: 5,
  /** Play money in a new or reset account. */
  openingBalance: 500,
} as const;

export type ChargeKind =
  'deal' | 'inspection' | 'game' | 'run' | 'insight' | 'time' | 'undo' | 'hint';

export interface Charge {
  kind: ChargeKind;
  amount: number;
  /** Game time when it was charged, in milliseconds since the deal began. */
  atMs: number;
}

export interface Account {
  scoring: Scoring;
  charges: readonly Charge[];
  /** Bank: game time already billed, in whole minutes' worth of milliseconds. */
  billedMs: number;
}

export function openAccount(scoring: Scoring): Account {
  return { scoring, charges: [], billedMs: 0 };
}

const POINT_PRICES: Partial<Record<ChargeKind, number>> = {
  run: POINTS.extraRun,
  insight: POINTS.insightPerCard,
  undo: POINTS.undo,
  hint: POINTS.hint,
};

const BANK_PRICES: Partial<Record<ChargeKind, number>> = {
  deal: BANK.deal,
  inspection: BANK.inspection,
  game: BANK.game,
  run: BANK.extraRun,
  insight: BANK.informationPerCard,
  undo: BANK.undo,
  hint: BANK.hint,
};

/** The price of one unit of something in this scoring; 0 when it is free there. */
export function priceOf(kind: ChargeKind, scoring: Scoring): number {
  return (scoring === 'points' ? POINT_PRICES : BANK_PRICES)[kind] ?? 0;
}

/** Adds a charge of `units` × the price; free things leave the account untouched. */
export function charge(account: Account, kind: ChargeKind, atMs: number, units = 1): Account {
  const amount = priceOf(kind, account.scoring) * units;
  if (amount <= 0) return account;
  return { ...account, charges: [...account.charges, { kind, amount, atMs }] };
}

/**
 * Bills playing time the way canfield.c `updatebettinginfo` does after every command: whole
 * minutes since the last bill, at most $3 at a time, and a long think forgiven beyond that.
 * Seconds short of a minute carry over to the next bill. Points games never pay for time.
 */
export function billTime(account: Account, nowMs: number): Account {
  if (account.scoring !== 'bank') return account;
  const minuteMs = BANK.secondsPerDollar * 1000;
  const dollars = Math.floor((nowMs - account.billedMs) / minuteMs);
  if (dollars <= 0) return account;
  const amount = Math.min(dollars, BANK.maxTimeCharge);
  return {
    ...account,
    billedMs: account.billedMs + dollars * minuteMs,
    charges: [...account.charges, { kind: 'time', amount, atMs: nowMs }],
  };
}

export function totalCharged(account: Account, kind?: ChargeKind): number {
  return account.charges
    .filter((c) => kind === undefined || c.kind === kind)
    .reduce((sum, c) => sum + c.amount, 0);
}

export function timeBonus(elapsedMs: number): number {
  const left = POINTS.timeBonusWindowSeconds - elapsedMs / 1000;
  return left > 0 ? Math.floor(left / POINTS.secondsPerTimePoint) : 0;
}

export interface PointsBreakdown {
  cards: number;
  winBonus: number;
  timeBonus: number;
  charges: number;
  total: number;
}

export function pointsBreakdown(
  cardsHome: number,
  account: Account,
  won: boolean,
  elapsedMs: number,
): PointsBreakdown {
  const cards = cardsHome * POINTS.perCardHome;
  const winBonus = won ? POINTS.winBonus : 0;
  const bonus = won ? timeBonus(elapsedMs) : 0;
  const charges = totalCharged(account);
  return {
    cards,
    winBonus,
    timeBonus: bonus,
    charges,
    total: Math.max(0, cards + winBonus + bonus - charges),
  };
}

/** One deal's account in the original's columns (cfscores.c `betinfo`). */
export interface Statement {
  deals: number;
  inspections: number;
  games: number;
  runs: number;
  information: number;
  thinkTime: number;
  undo: number;
  hints: number;
  winnings: number;
}

export const STATEMENT_ROWS = [
  'deals',
  'inspections',
  'games',
  'runs',
  'information',
  'thinkTime',
  'undo',
  'hints',
] as const satisfies readonly (keyof Statement)[];

/** The rows that are costs: every row of the statement but the winnings. */
export type CostRow = (typeof STATEMENT_ROWS)[number];

export function emptyStatement(): Statement {
  return {
    deals: 0,
    inspections: 0,
    games: 0,
    runs: 0,
    information: 0,
    thinkTime: 0,
    undo: 0,
    hints: 0,
    winnings: 0,
  };
}

/**
 * The deal's statement: costs by row, and winnings of $5 a card home, paid only once the game
 * was bought (the original credits every card already home at that moment, then each one after).
 */
export function statementOf(account: Account, cardsHome: number, gameBought: boolean): Statement {
  return {
    deals: totalCharged(account, 'deal'),
    inspections: totalCharged(account, 'inspection'),
    games: totalCharged(account, 'game'),
    runs: totalCharged(account, 'run'),
    information: totalCharged(account, 'insight'),
    thinkTime: totalCharged(account, 'time'),
    undo: totalCharged(account, 'undo'),
    hints: totalCharged(account, 'hint'),
    winnings: gameBought ? cardsHome * BANK.perCardHome : 0,
  };
}

export function costsOf(statement: Statement): number {
  return STATEMENT_ROWS.reduce((sum, row) => sum + statement[row], 0);
}

/** Winnings less costs: the original's "net worth". */
export function netOf(statement: Statement): number {
  return statement.winnings - costsOf(statement);
}

export function addStatements(a: Statement, b: Statement): Statement {
  const sum = emptyStatement();
  for (const key of Object.keys(sum) as (keyof Statement)[]) sum[key] = a[key] + b[key];
  return sum;
}

/** The original's "Return" row: winnings over costs, less one, as a percentage. */
export function returnPercent(statement: Statement): number | null {
  const costs = costsOf(statement);
  return costs > 0 ? (statement.winnings / costs - 1) * 100 : null;
}
