import { chebyshev } from './layout';
import { applyAction, isFree, STEPS } from './rules';
import type { Action, RoomState, Vacuum } from './types';

/**
 * Finds the fewest turns that clear a room without zooming. Vacuums are fully deterministic,
 * so a room is a puzzle: an iterative-deepening search (IDA*) with a lower bound on how soon
 * every vacuum could possibly be tangled, and a table of states already reached sooner.
 *
 * Budgets are counted in search nodes, never in time, so every machine finds the same par.
 */

export interface Solution {
  readonly turns: number;
  readonly actions: readonly Action[];
  /** True when the search finished its depth: no shorter route exists. */
  readonly proven: boolean;
  readonly nodes: number;
}

export interface SolveOptions {
  /** Give up after this many nodes. */
  readonly maxNodes?: number;
  /** Never look deeper than this many turns. */
  readonly maxTurns?: number;
}

const UNSOLVABLE = 1_000_000;

function speed(v: Vacuum): number {
  return v.kind === 'turbo' ? 2 : 1;
}

/** No vacuum can be tangled sooner than its distance to something it could bonk into. */
export function lowerBound(state: RoomState): number {
  const alive = state.vacuums.filter((v) => v.alive);
  const dock = state.dock;
  const dockPending = dock !== null && !dock.jammed && dock.remaining > 0;
  if (alive.length === 0) return dockPending ? 1 : 0;
  let bound = 1;
  for (const v of alive) {
    let soonest = UNSOLVABLE;
    for (const u of alive) {
      if (u !== v) soonest = Math.min(soonest, Math.ceil(chebyshev(v, u) / (speed(v) + speed(u))));
    }
    const hungrySweeper = v.kind === 'sweeper' && !v.full;
    if (hungrySweeper) soonest = Math.min(soonest, 1);
    else
      for (const t of state.tangles)
        soonest = Math.min(soonest, Math.ceil(chebyshev(v, t) / speed(v)));
    // A lone vacuum with nothing to bonk into can only wait for the dock's next one.
    if (soonest === UNSOLVABLE && !dockPending) return UNSOLVABLE;
    if (soonest !== UNSOLVABLE) bound = Math.max(bound, soonest);
  }
  if (dockPending) {
    const untilNext = dock.every - (state.turn % dock.every);
    const allSent = untilNext + (dock.remaining - 1) * dock.every + 1;
    let jam = UNSOLVABLE;
    for (const v of alive) jam = Math.min(jam, Math.ceil(chebyshev(v, dock) / speed(v)));
    bound = Math.max(bound, Math.min(allSent, jam));
  }
  return bound;
}

/** Everything the rules can tell apart, in a canonical order. */
export function stateKey(state: RoomState): string {
  const vacuums = state.vacuums
    .filter((v) => v.alive)
    .map((v) => `${v.kind[0]}${v.resting ? 'r' : ''}${v.full ? 'f' : ''}${v.x},${v.y}`)
    .sort()
    .join(';');
  const tangles = state.tangles
    .map((t) => `${t.x},${t.y}`)
    .sort()
    .join(';');
  const dock = state.dock
    ? `|d${state.dock.remaining}${state.dock.jammed ? 'j' : ''}@${state.turn % state.dock.every}`
    : '';
  return `${state.cat.x},${state.cat.y}|${vacuums}|${tangles}${dock}`;
}

interface Child {
  action: Action;
  state: RoomState;
  bound: number;
}

function children(state: RoomState): Child[] {
  const list: Child[] = [];
  for (const [dx, dy] of STEPS) {
    if ((dx !== 0 || dy !== 0) && !isFree(state, state.cat.x + dx, state.cat.y + dy)) continue;
    const action: Action = { type: 'step', dx, dy };
    const next = applyAction(state, action).state;
    if (next.status === 'caught') continue;
    list.push({ action, state: next, bound: next.status === 'cleared' ? 0 : lowerBound(next) });
  }
  // Promising steps first: the deepest pass then finds a route sooner.
  list.sort((a, b) => a.bound - b.bound || b.state.tangled - a.state.tangled);
  return list;
}

export function solve(initial: RoomState, options: SolveOptions = {}): Solution | null {
  const maxNodes = options.maxNodes ?? 2_000_000;
  const maxTurns = options.maxTurns ?? 80;
  let nodes = 0;
  let exhausted = false;
  const path: Action[] = [];
  const seen = new Map<string, number>();

  // Returns the found depth, or the smallest bound that was exceeded.
  function search(state: RoomState, g: number, limit: number): { found: boolean; next: number } {
    if (state.status === 'cleared') return { found: true, next: g };
    const f = g + lowerBound(state);
    if (f > limit) return { found: false, next: f };
    if (++nodes > maxNodes) {
      exhausted = true;
      return { found: false, next: UNSOLVABLE };
    }
    const key = stateKey(state);
    const earlier = seen.get(key);
    if (earlier !== undefined && earlier <= g) return { found: false, next: UNSOLVABLE };
    seen.set(key, g);
    let next = UNSOLVABLE;
    for (const child of children(state)) {
      path.push(child.action);
      const result = search(child.state, g + 1, limit);
      if (result.found) return result;
      path.pop();
      if (exhausted) return { found: false, next: UNSOLVABLE };
      next = Math.min(next, result.next);
    }
    return { found: false, next };
  }

  let limit = lowerBound(initial);
  while (limit <= maxTurns) {
    seen.clear();
    const result = search(initial, 0, limit);
    if (result.found) return { turns: path.length, actions: [...path], proven: true, nodes };
    if (exhausted || result.next >= UNSOLVABLE) return null;
    limit = result.next;
  }
  return null;
}

/**
 * When a proof is too expensive, a greedy beam search still finds a good route. Used only to
 * judge candidate rooms while searching for new ones; shipped pars are proven.
 */
export function quickRoute(initial: RoomState, width = 64, maxTurns = 120): Solution | null {
  let beam: { state: RoomState; actions: Action[] }[] = [{ state: initial, actions: [] }];
  let nodes = 0;
  for (let turn = 0; turn < maxTurns && beam.length > 0; turn++) {
    const next = new Map<string, { state: RoomState; actions: Action[]; bound: number }>();
    for (const entry of beam) {
      for (const child of children(entry.state)) {
        nodes++;
        const actions = [...entry.actions, child.action];
        if (child.state.status === 'cleared') {
          return { turns: actions.length, actions, proven: false, nodes };
        }
        if (child.bound >= UNSOLVABLE) continue;
        const key = stateKey(child.state);
        if (!next.has(key)) next.set(key, { state: child.state, actions, bound: child.bound });
      }
    }
    beam = [...next.values()]
      .sort((a, b) => a.bound - b.bound || b.state.tangled - a.state.tangled)
      .slice(0, width);
  }
  return null;
}
