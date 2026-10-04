import { DC, DR } from './geometry';
import { checkHelm, maxTurns, tracePath } from './movement';
import { snagged } from './state';
import type { Battle, Pose, Ship } from './types';

/**
 * Every place a ship can be at the end of this turn, each with the shortest helm string that
 * takes her there. The player steers by picking one on the chart; the same list, worked out
 * for an enemy, draws her reach as a fan of possible positions.
 */

export interface Reachable extends Pose {
  helm: string;
  /** Squares sailed, for sorting and for the playback's pace. */
  squares: number;
  /** The pose would leave the chart: the player is asked before breaking off. */
  offChart: boolean;
}

const key = (p: Pose) => `${p.row},${p.col},${p.dir}`;

/** Helm strings in the original's grammar: turns and runs alternate, within the allowance. */
function* helmStrings(st: Battle, sp: Ship): Generator<string> {
  const { turns } = maxTurns(sp);
  // No heading allows more than the ship's full-sail speed; turns cost a square each.
  const budget = Math.min(7, Math.max(sp.specs.fs, sp.specs.bs));
  function* grow(
    helm: string,
    turnsLeft: number,
    squaresLeft: number,
    last: 'turn' | 'run' | 'none',
  ): Generator<string> {
    yield helm;
    if (last !== 'run') {
      for (let n = 1; n <= squaresLeft; n++)
        yield* grow(helm + n, turnsLeft, squaresLeft - n, 'run');
    }
    if (last !== 'turn' && turnsLeft > 0) {
      // A ship may always turn once where she lies; checkHelm decides the rest.
      const after = Math.max(0, squaresLeft - 1);
      yield* grow(`${helm}l`, turnsLeft - 1, after, 'turn');
      yield* grow(`${helm}r`, turnsLeft - 1, after, 'turn');
    }
  }
  yield* grow('', Math.max(turns, 1), budget, 'none');
}

/**
 * A ship that makes no headway for a third turn drifts a square downwind (sail/dr_3.c:226-264):
 * small ships only on even turns, and never while grappled or fouled.
 */
export function driftsThisTurn(st: Battle, sp: Ship, helm: string): boolean {
  if (/[1-7]/.test(helm) || !st.windspeed) return false;
  if (sp.drift + 1 <= 2) return false;
  return (sp.specs.cls >= 3 && !snagged(sp)) || ((st.turn + 1) & 1) === 0;
}

const offTheChart = (st: Battle, p: Pose) =>
  p.row < 0 || p.row >= st.rows || p.col < 0 || p.col >= st.cols;

export function reachablePoses(st: Battle, sp: Ship): Reachable[] {
  if (sp.dir === 0) return [];
  const found = new Map<string, Reachable>();
  const start: Pose = { row: sp.row, col: sp.col, dir: sp.dir };
  const still = driftsThisTurn(st, sp, '')
    ? { ...start, row: start.row - DR[st.winddir]!, col: start.col - DC[st.winddir]! }
    : start;
  found.set(key(still), { ...still, helm: '', squares: 0, offChart: offTheChart(st, still) });
  for (const candidate of helmStrings(st, sp)) {
    if (!candidate) continue;
    const check = checkHelm(st, sp, candidate);
    if (check.unable || check.problems.length || check.helm !== candidate) continue;
    const path = tracePath(start, candidate);
    let end = path[path.length - 1]!;
    if (driftsThisTurn(st, sp, candidate)) {
      end = { ...end, row: end.row - DR[st.winddir]!, col: end.col - DC[st.winddir]! };
      path.push(end);
    }
    const squares = [...candidate].reduce(
      (sum, ch) => sum + (ch >= '1' && ch <= '7' ? Number(ch) : 0),
      0,
    );
    const known = found.get(key(end));
    if (
      known &&
      (known.helm.length < candidate.length ||
        (known.helm.length === candidate.length && known.helm <= candidate))
    )
      continue;
    found.set(key(end), {
      ...end,
      helm: candidate,
      squares,
      offChart: path.some((p) => offTheChart(st, p)),
    });
  }
  return [...found.values()];
}
