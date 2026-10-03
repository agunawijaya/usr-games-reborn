import {
  DIRECTIONS,
  type GameState,
  indexOf,
  onBoard,
  other,
  pointOf,
  type Stone,
  wins,
} from './game';

/**
 * A threat-space solver: can the side to move force five within `n` of its own moves, and with
 * which first moves? The attacker may only play threats: a four (one move from five, so the reply
 * is forced) or, when threes are allowed, an open three (one move from an open four). The
 * defender answers a four at its point of five; a three at any point that leaves no open four, or
 * with a four of its own, which the attacker must then block.
 *
 * This is what the Referee adds on top of the 1994 player, what proves each puzzle has one
 * answer, and what judges a puzzle move.
 */

export interface SolveOptions {
  /** Attacker moves allowed, the winning five included. */
  moves: number;
  /** Whether open threes count as threats (else fours only). */
  threes: boolean;
  /** A ceiling on positions looked at; past it the answer is "not found". */
  nodes?: number;
}

const DEFAULT_NODES = 60_000;

/** Every window of five points on a board of `size`, built once per size. */
const windowCache = new Map<number, Int16Array[]>();

function windowsOf(size: number): Int16Array[] {
  let windows = windowCache.get(size);
  if (windows) return windows;
  windows = [];
  for (const d of DIRECTIONS)
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const ex = x + d.x * 4;
        const ey = y + d.y * 4;
        if (ex < 0 || ey < 0 || ex >= size || ey >= size) continue;
        const w = new Int16Array(5);
        for (let k = 0; k < 5; k++) w[k] = (y + d.y * k) * size + (x + d.x * k);
        windows.push(w);
      }
  windowCache.set(size, windows);
  return windows;
}

/** Would `stone` at `p` make a winning line under the game's rules? (`p` must be empty.) */
export function makesFive(game: GameState, p: number, stone: Stone): boolean {
  const { x, y } = pointOf(game, p);
  for (const d of DIRECTIONS) {
    let run = 1;
    for (let k = 1; onBoard(game, x + d.x * k, y + d.y * k); k++) {
      if (game.board[indexOf(game, x + d.x * k, y + d.y * k)] !== stone) break;
      run++;
    }
    for (let k = 1; onBoard(game, x - d.x * k, y - d.y * k); k++) {
      if (game.board[indexOf(game, x - d.x * k, y - d.y * k)] !== stone) break;
      run++;
    }
    if (wins(game.rules, run)) return true;
  }
  return false;
}

/** Points where `stone` would make five now. */
export function fivePoints(game: GameState, stone: Stone): number[] {
  const found = new Set<number>();
  for (const w of windowsOf(game.size)) {
    let mine = 0;
    let gap = -1;
    let blocked = false;
    for (let k = 0; k < 5; k++) {
      const s = game.board[w[k]!];
      if (s === stone) mine++;
      else if (s === null) gap = w[k]!;
      else {
        blocked = true;
        break;
      }
    }
    if (!blocked && mine === 4 && !found.has(gap) && makesFive(game, gap, stone)) found.add(gap);
  }
  return [...found];
}

/** Empty points in windows holding `stones` of `stone` and nothing of the other side. */
function pointsInWindows(game: GameState, stone: Stone, stones: number): Set<number> {
  const found = new Set<number>();
  for (const w of windowsOf(game.size)) {
    let mine = 0;
    let blocked = false;
    for (let k = 0; k < 5; k++) {
      const s = game.board[w[k]!];
      if (s === stone) mine++;
      else if (s !== null) {
        blocked = true;
        break;
      }
    }
    if (blocked || mine !== stones) continue;
    for (let k = 0; k < 5; k++) if (game.board[w[k]!] === null) found.add(w[k]!);
  }
  return found;
}

/** Moves that make a four for `stone`: after them it has a point of five. */
export function fourMoves(game: GameState, stone: Stone): number[] {
  const moves: number[] = [];
  for (const p of pointsInWindows(game, stone, 3)) {
    game.board[p] = stone;
    if (fivePoints(game, stone).length > 0) moves.push(p);
    game.board[p] = null;
  }
  return moves;
}

/** Does `stone` have a move that makes an open four (two points of five at once)? */
export function hasOpenFourMove(game: GameState, stone: Stone): boolean {
  for (const p of pointsInWindows(game, stone, 3)) {
    game.board[p] = stone;
    const open = fivePoints(game, stone).length >= 2;
    game.board[p] = null;
    if (open) return true;
  }
  return false;
}

/** Moves that make an open three for `stone` (and no four): after them it threatens an open four. */
export function threeMoves(game: GameState, stone: Stone): number[] {
  const moves: number[] = [];
  for (const p of pointsInWindows(game, stone, 2)) {
    game.board[p] = stone;
    if (fivePoints(game, stone).length === 0 && hasOpenFourMove(game, stone)) moves.push(p);
    game.board[p] = null;
  }
  return moves;
}

/** Where the defender can answer an open three: every point after which no open four is left. */
function defencesToThree(game: GameState, attacker: Stone): number[] {
  const defender = other(attacker);
  const candidates = new Set<number>();
  for (const p of pointsInWindows(game, attacker, 3)) candidates.add(p);
  for (const p of pointsInWindows(game, attacker, 2)) candidates.add(p);
  const answers: number[] = [];
  for (const p of candidates) {
    game.board[p] = defender;
    if (!hasOpenFourMove(game, attacker)) answers.push(p);
    game.board[p] = null;
  }
  return answers;
}

interface Search {
  game: GameState;
  attacker: Stone;
  options: SolveOptions;
  nodes: number;
  limit: number;
  /** Positions already shown not to win within a number of moves. */
  failed: Map<string, number>;
}

function key(game: GameState): string {
  let k = '';
  for (const s of game.board) k += s === null ? '.' : s === 'black' ? 'x' : 'o';
  return k;
}

function place(game: GameState, p: number, stone: Stone): void {
  game.board[p] = stone;
}

function lift(game: GameState, p: number): void {
  game.board[p] = null;
}

/** Can the attacker, to move, force five within `n` moves? */
function attackerWins(search: Search, n: number): boolean {
  const { game, attacker } = search;
  if (++search.nodes > search.limit) return false;
  if (fivePoints(game, attacker).length > 0) return true;
  if (n <= 1) return false;
  const threats = fivePoints(game, other(attacker));
  if (threats.length > 1) return false;
  const k = key(game);
  const known = search.failed.get(k);
  if (known !== undefined && known >= n) return false;
  let won = false;
  if (threats.length === 1) {
    // The defender threatens five: the attacker must block there, and keep up the pressure.
    won = tryThreat(search, threats[0]!, n);
  } else {
    for (const p of fourMoves(game, attacker)) if ((won = tryThreat(search, p, n))) break;
    if (!won && search.options.threes && n >= 3)
      for (const p of threeMoves(game, attacker)) if ((won = tryThreat(search, p, n))) break;
  }
  if (!won) search.failed.set(k, Math.max(n, known ?? 0));
  return won;
}

/**
 * The attacker plays `p`: does it still force five within `n` moves? It must leave a four (the
 * reply is forced) or, when threes count, an open four in the making (the defender may answer
 * anywhere that stops it, or with a four of its own).
 */
function tryThreat(search: Search, p: number, n: number): boolean {
  const { game, attacker } = search;
  place(game, p, attacker);
  let won: boolean;
  if (makesFiveAt(game, p, attacker)) won = true;
  else if (fivePoints(game, attacker).length > 0) won = defenderLosesAfterFour(search, n - 1);
  else if (search.options.threes && n >= 3 && hasOpenFourMove(game, attacker))
    won = defenderLosesAfterThree(search, n - 1);
  else won = false;
  lift(game, p);
  return won;
}

/** After the attacker's four: the defender must block its point of five (or has already lost). */
function defenderLosesAfterFour(search: Search, n: number): boolean {
  const { game, attacker } = search;
  const defender = other(attacker);
  if (fivePoints(game, defender).length > 0) return false;
  const points = fivePoints(game, attacker);
  if (points.length >= 2) return true;
  const block = points[0]!;
  place(game, block, defender);
  // A block that makes the defender's own five ends it the other way.
  const won = !makesFiveAt(game, block, defender) && attackerWins(search, n);
  lift(game, block);
  return won;
}

/** Would the stone already standing at `p` make five there? */
function makesFiveAt(game: GameState, p: number, stone: Stone): boolean {
  lift(game, p);
  const five = makesFive(game, p, stone);
  place(game, p, stone);
  return five;
}

/**
 * After the attacker's open three: every defence must still lose, whether it blocks the three or
 * answers with a four of its own.
 */
function defenderLosesAfterThree(search: Search, n: number): boolean {
  const { game, attacker } = search;
  const defender = other(attacker);
  if (fivePoints(game, defender).length > 0) return false;
  const replies = new Set(defencesToThree(game, attacker));
  for (const p of fourMoves(game, defender)) replies.add(p);
  for (const p of replies) {
    place(game, p, defender);
    const won = !makesFiveAt(game, p, defender) && attackerWins(search, n);
    lift(game, p);
    if (!won) return false;
  }
  return true;
}

function newSearch(game: GameState, options: SolveOptions): Search {
  return {
    game,
    attacker: game.toMove,
    options,
    nodes: 0,
    limit: options.nodes ?? DEFAULT_NODES,
    failed: new Map(),
  };
}

/** Can the side to move force five within `options.moves` of its moves? */
export function canForceWin(game: GameState, options: SolveOptions): boolean {
  return attackerWins(newSearch(game, options), options.moves);
}

/** The attacker's threats from here: its points of five, or the block it must make, or its fours and threes. */
function firstCandidates(game: GameState, options: SolveOptions): number[] {
  const attacker = game.toMove;
  const now = fivePoints(game, attacker);
  if (now.length > 0) return now;
  const forced = fivePoints(game, other(attacker));
  if (forced.length > 0) return forced.length === 1 ? forced : [];
  const candidates = new Set(fourMoves(game, attacker));
  if (options.threes) for (const p of threeMoves(game, attacker)) candidates.add(p);
  return [...candidates];
}

/**
 * Every first move that forces five within `options.moves`. `complete` is false when the search
 * ran out of positions, so the list may be short. Used to prove a puzzle has one answer.
 */
export function winningFirstMoves(
  game: GameState,
  options: SolveOptions,
): { moves: number[]; complete: boolean } {
  const search = newSearch(game, options);
  const winners = firstCandidates(game, options).filter((p) => tryThreat(search, p, options.moves));
  return { moves: winners.sort((a, b) => a - b), complete: search.nodes <= search.limit };
}

/** The fewest moves the side to move needs to force five, up to `options.moves`, or null. */
export function quickestWin(game: GameState, options: SolveOptions): number | null {
  for (let n = 1; n <= options.moves; n++)
    if (canForceWin(game, { ...options, moves: n })) return n;
  return null;
}
