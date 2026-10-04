import { range } from './geometry';
import { DC, DR, DTAB, turnLeft, turnRight } from './geometry';
import { addFoul, type Ctx, dieroll, emit, fouled2, snagged, snagged2 } from './state';
import { WIND_EFFECTS } from './tables';
import type { Battle, HelmProblem, Pose, Ship } from './types';

/**
 * Sailing: the allowance on each heading, the helm grammar, and every ship moving at once.
 * Ported from sail/game.c:44-90 (maxturns, maxmove), sail/pl_5.c:54-153 (acceptmove) and
 * sail/dr_3.c:52-264 (moveall, step, push).
 */

/** Turns allowed this helm order; `drifting` = she must make headway before a second turn. */
export function maxTurns(sp: Ship): { turns: number; drifting: boolean } {
  let turns = sp.specs.ta;
  const drifting = sp.drift > 1 && turns !== 0;
  if (drifting) {
    turns--;
    if (sp.FS === 1) turns = 0;
  }
  return { turns, drifting };
}

/** Wind relative to a heading: 0 dead astern ... 4 dead ahead (in irons). */
export const windAngle = (winddir: number, dir: number): number => (((dir - winddir) % 8) + 8) % 8;

/**
 * Squares a ship may sail on heading `dir` in the present wind. `sails`: 'as-set' uses her
 * sails as they are, 'full' and 'battle' assume them.
 */
export function maxMove(
  st: Pick<Battle, 'winddir' | 'windspeed'>,
  sp: Ship,
  dir: number,
  sails: 'as-set' | 'full' | 'battle' = 'as-set',
): number {
  const s = sp.specs;
  // The table stops at a full gale; the hurricane turn reads the full-gale row.
  const [a, b, c, d] = WIND_EFFECTS[Math.min(st.windspeed, 6)]![s.cls - 1] ?? [0, 0, 0, 0];
  const full = sails === 'full' || (sails === 'as-set' && sp.FS !== 0);
  let move = full ? s.fs : s.bs;
  const rel = windAngle(st.winddir, dir);
  if (rel === 0) move -= 1 + b!;
  else if (rel === 2 || rel === 6) move -= 1 + c!;
  else if (rel === 3 || rel === 5) move = (full ? 2 : 1) - d!;
  else if (rel === 4) move = 0;
  else move -= a!;
  for (const rig of [s.rig1, s.rig2, s.rig3, s.rig4]) if (rig === 0) move--;
  return Math.max(0, move);
}

export type PointOfSail = 'running' | 'quarter' | 'beam' | 'close-hauled' | 'in irons';
const POINTS: readonly PointOfSail[] = [
  'running',
  'quarter',
  'beam',
  'close-hauled',
  'in irons',
  'close-hauled',
  'beam',
  'quarter',
];
export const pointOfSail = (winddir: number, dir: number): PointOfSail =>
  POINTS[windAngle(winddir, dir)]!;

export interface HelmCheck {
  /** What the helm will actually do; 'd' drifts. */
  helm: string;
  problems: HelmProblem[];
  /** Nothing can be steered: fouled, grappled, becalmed or without hands. */
  unable: boolean;
  /** Full sails just ordered cannot be set this turn. */
  dropFullSails: boolean;
}

/**
 * Check a helm string as the original's prompt did, keeping every order up to the one that
 * fails (the manual's own example: turning into the wind stops the move there).
 */
export function checkHelm(st: Battle, sp: Ship, input: string): HelmCheck {
  if (!sp.specs.crew3 || snagged(sp) || !st.windspeed) {
    return { helm: 'd', problems: [], unable: true, dropFullSails: false };
  }
  const problems: HelmProblem[] = [];
  const { turns, drifting } = maxTurns(sp);
  let ta = turns;
  let ma = maxMove(st, sp, sp.dir);
  let vma = ma;
  let dir = sp.dir;
  let moved = false;
  let last = '';
  let buf = '';
  for (const c of input.toLowerCase()) {
    let cut = false;
    if (c === 'l' || c === 'r') {
      dir = c === 'l' ? turnLeft(dir) : turnRight(dir);
      if (last === 't') {
        problems.push('too-fast-turn');
        cut = true;
      }
      last = 't';
      ma--;
      ta--;
      vma = Math.min(ma, maxMove(st, sp, dir));
    } else if (c === '0' || c === 'd') {
      break;
    } else if (c >= '1' && c <= '7') {
      if (last === '0') {
        problems.push('too-fast-move');
        cut = true;
      }
      last = '0';
      moved = true;
      ma -= Number(c);
      vma -= Number(c);
    } else if (/\s/.test(c)) {
      continue;
    } else {
      problems.push('bad-key');
      break;
    }
    if ((ta < 0 && moved) || (vma < 0 && moved)) cut = true;
    if (cut) break;
    buf += c;
  }
  const turnFirst = buf[0] === 'l' || buf[0] === 'r';
  const overrun = (ta < 0 && moved) || (vma < 0 && moved);
  const driftTurn = drifting && turnFirst && moved;
  let dropFullSails = false;
  if (overrun) {
    problems.push('overrun');
    if (ta < 0 && sp.FS === 1) dropFullSails = true;
  } else if (driftTurn) {
    problems.push('drifting');
    buf = buf.slice(0, 1);
  }
  if (drifting && !moved && sp.FS === 1) dropFullSails = true;
  if (dropFullSails) problems.push('no-hands-full-sails');
  return { helm: buf || 'd', problems, unable: false, dropFullSails };
}

/** Poses a helm string passes through from `start`, without wind drift. */
export function tracePath(start: Pose, helm: string): Pose[] {
  const poses: Pose[] = [{ ...start }];
  let { row, col, dir } = start;
  for (const ch of helm) {
    if (ch === 'r') dir = turnRight(dir);
    else if (ch === 'l') dir = turnLeft(dir);
    else if (ch >= '1' && ch <= '7') {
      const n = Number(ch);
      const dist = dir % 2 === 0 ? DTAB[n]! : n;
      row -= DR[dir]! * dist;
      col -= DC[dir]! * dist;
    } else continue;
    poses.push({ row, col, dir });
  }
  return poses;
}

// --- every ship at once -----------------------------------------------------------------

interface StepState {
  moved: boolean;
  drifted: boolean;
}

/** One step of a helm string (sail/dr_3.c:226-264). */
function step(st: Battle, sp: Ship, com: string, state: StepState): void {
  if (com === 'r') sp.dir = turnRight(sp.dir);
  else if (com === 'l') sp.dir = turnLeft(sp.dir);
  else if (com >= '0' && com <= '7') {
    const n = Number(com);
    const dist = sp.dir % 2 === 0 ? DTAB[n]! : n;
    sp.row -= DR[sp.dir]! * dist;
    sp.col -= DC[sp.dir]! * dist;
    state.moved = true;
  } else if (com === 'd') {
    if (state.moved) {
      sp.drift = 0;
      return;
    }
    // Two turns without headway and a ship starts to drift downwind; small ships on
    // alternate turns only, and grappled ships hold each other.
    if (
      st.windspeed !== 0 &&
      ++sp.drift > 2 &&
      ((sp.specs.cls >= 3 && !snagged(sp)) || (st.turn & 1) === 0)
    ) {
      sp.row -= DR[st.winddir]!;
      sp.col -= DC[st.winddir]!;
      state.drifted = true;
    }
  }
}

const isolated = (st: Battle, sp: Ship): boolean =>
  !st.ships.some((other) => other !== sp && range(sp, other) <= 10);

/** The bigger ship shoves the smaller aside; equal ships by their order in the list. */
function shoves(from: Ship, to: Ship): boolean {
  if (to.specs.guns !== from.specs.guns) return to.specs.guns > from.specs.guns;
  return from.index < to.index;
}

/** Sail every ship's helm order in lock-step, colliding and fouling as they go. */
export function moveAll(ctx: Ctx): void {
  const { st } = ctx;
  const ships = st.ships;
  for (const sp of ships) {
    // A ship at anchor holds her ground: no helm, and no drift either.
    if (sp.role === 'anchored') sp.movebuf = '';
    else if (snagged(sp)) sp.movebuf = 'd';
    else if (sp.movebuf[0] !== 'd') sp.movebuf += 'd';
  }
  const states: StepState[] = ships.map(() => ({ moved: false, drifted: false }));
  const paths = ships.map((sp) => [{ row: sp.row, col: sp.col, dir: sp.dir, step: -1 }]);
  const bufs = ships.map((sp) => sp.movebuf.split(''));
  const stillMoving = (k: number) => bufs.some((b) => b[k] !== undefined);
  for (let k = 0; stillMoving(k); k++) {
    ships.forEach((sp, n) => {
      const com = bufs[n]![k];
      if (com === undefined) bufs[n]!.length = k;
      else if (sp.dir) step(st, sp, com, states[n]!);
    });
    for (const sp of ships) {
      if (sp.dir === 0 || isolated(st, sp)) continue;
      for (const sq of ships) {
        if (sp === sq || sq.dir === 0 || !shoves(sp, sq)) continue;
        let snap = snagged2(sp, sq) > 0 && range(sp, sq) > 1;
        if (!range(sp, sq) && !fouled2(sp, sq)) {
          emit(ctx, { t: 'collision', a: sp.index, b: sq.index });
          if (dieroll(ctx) < 4) {
            addFoul(st, sp, sq);
            addFoul(st, sq, sp);
            emit(ctx, { t: 'foul', a: sp.index, b: sq.index });
          }
          snap = true;
        }
        if (snap) {
          bufs[sp.index]!.length = Math.min(bufs[sp.index]!.length, k + 1);
          bufs[sq.index]!.length = Math.min(bufs[sq.index]!.length, k + 1);
          sq.row = sp.row - 1;
          sq.col = sp.dir === 1 || sp.dir === 5 ? sp.col - 1 : sp.col;
          sq.dir = sp.dir;
        }
      }
    }
    ships.forEach((sp, n) => {
      const path = paths[n]!;
      const prev = path[path.length - 1]!;
      if (prev.row !== sp.row || prev.col !== sp.col || prev.dir !== sp.dir) {
        path.push({ row: sp.row, col: sp.col, dir: sp.dir, step: k });
      }
    });
  }
  const changed: Record<number, (Pose & { step: number })[]> = {};
  ships.forEach((sp, n) => {
    if (sp.dir !== 0) sp.movebuf = '';
    if (paths[n]!.length > 1) changed[n] = paths[n]!;
  });
  emit(ctx, {
    t: 'move',
    paths: changed,
    drifted: ships.filter((_, n) => states[n]!.drifted).map((sp) => sp.index),
  });
}
