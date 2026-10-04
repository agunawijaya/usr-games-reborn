import { closestShip } from './gunnery';
import {
  compassTo,
  DC,
  distance,
  DR,
  DTAB,
  gunsBear,
  range,
  turnLeft,
  turnRight,
} from './geometry';
import { maxMove, maxTurns } from './movement';
import { capship, type Ctx, emit, snagged } from './state';
import type { Battle, Pose, Role, Ship } from './types';

/**
 * The computer captains' helm: a depth-first search over helm strings, scored by what the
 * captain wants. The `attack` score is the original's (sail/dr_2.c:147-280: close the range,
 * a bonus when the guns bear, never turn your stern to the enemy); the other roles are
 * Figurehead's, scored the same way so they sail by the same rules of wind and turning.
 */

interface SearchPose extends Pose {
  drift: number;
}

/** Where a helm string would leave the ship, drift included (sail/dr_2.c:189-227). */
function sailOut(st: Battle, sp: Ship, helm: string): SearchPose {
  const pose: SearchPose = { row: sp.row, col: sp.col, dir: sp.dir, drift: sp.drift };
  let moved = false;
  for (const ch of helm) {
    if (ch === 'r') pose.dir = turnRight(pose.dir);
    else if (ch === 'l') pose.dir = turnLeft(pose.dir);
    else if (ch >= '1' && ch <= '7') {
      moved = true;
      const n = Number(ch);
      const dist = pose.dir % 2 === 0 ? DTAB[n]! : n;
      pose.row -= DR[pose.dir]! * dist;
      pose.col -= DC[pose.dir]! * dist;
    }
  }
  if (moved) pose.drift = 0;
  else if (st.windspeed !== 0 && ++pose.drift > 2) {
    if ((sp.specs.cls >= 3 && !snagged(sp)) || (st.turn & 1) === 0) {
      pose.row -= DR[st.winddir]!;
      pose.col -= DC[st.winddir]!;
    }
  }
  return pose;
}

const offChart = (st: Battle, p: Pose): boolean =>
  p.row < 0 || p.row >= st.rows || p.col < 0 || p.col >= st.cols;

/** Squares from the chart's nearest edge; negative once off it. */
const marginOf = (st: Battle, p: Pose): number =>
  Math.min(p.row, st.rows - 1 - p.row, p.col, st.cols - 1 - p.col);

type Scorer = (pose: SearchPose) => number;

/** The original's "typical distance function", against the nearest enemy. */
function attackScore(st: Battle, to: Ship): Scorer {
  return (pose) => {
    const r = range(pose, to);
    let total = -50 * r;
    if (r < 4 && gunsBear(pose, to)) total += 60;
    const astern = compassTo(pose, to) - pose.dir;
    if (astern === 4 || astern === -4) total = -30000;
    if (offChart(st, pose)) total -= 20000;
    else if (marginOf(st, pose) < 2) total -= 200;
    return total;
  };
}

/** Run for the goal, keeping clear of the nearest enemy. */
function fleeScore(st: Battle, sp: Ship, enemy: Ship | null): Scorer {
  const goal = sp.goal ?? { row: sp.row, col: sp.col };
  return (pose) => {
    let total = -30 * distance(goal.row - pose.row, goal.col - pose.col);
    if (enemy) {
      const r = range(pose, enemy);
      total += 45 * Math.min(r, 12);
      if (r <= 1) total -= 400;
    }
    if (offChart(st, pose)) total += 10000;
    return total;
  };
}

/** A merchantman makes for her goal and sheers off from anything hostile alongside. */
function merchantScore(st: Battle, sp: Ship, enemy: Ship | null): Scorer {
  const goal = sp.goal ?? { row: sp.row, col: sp.col };
  return (pose) => {
    let total = -50 * distance(goal.row - pose.row, goal.col - pose.col);
    if (enemy && range(pose, enemy) <= 2) total -= 120;
    if (offChart(st, pose)) total += 10000;
    return total;
  };
}

/** Keep station two squares astern of the flagship, and fight what comes within reach. */
function followScore(st: Battle, flagship: Ship, enemy: Ship | null): Scorer {
  const station = {
    row: flagship.row + DR[flagship.dir]! * 3,
    col: flagship.col + DC[flagship.dir]! * 3,
  };
  return (pose) => {
    let total = -40 * distance(station.row - pose.row, station.col - pose.col);
    if (range(pose, flagship) === 0) total -= 600;
    if (enemy) {
      const r = range(pose, enemy);
      if (r < 4 && gunsBear(pose, enemy)) total += 60;
    }
    if (offChart(st, pose)) total -= 20000;
    return total;
  };
}

/** Stay out of the enemy's reach, near the flagship: the squadron holds off. */
function holdOffScore(st: Battle, flagship: Ship | null, enemy: Ship | null): Scorer {
  return (pose) => {
    let total = 0;
    if (enemy) total -= 50 * Math.abs(Math.min(range(pose, enemy), 12) - 8);
    if (flagship) total -= 10 * range(pose, flagship);
    if (offChart(st, pose)) total -= 20000;
    else if (marginOf(st, pose) < 2) total -= 200;
    return total;
  };
}

/**
 * Depth-first search over helm strings within the allowance (sail/dr_2.c:229-269): digits
 * never follow digits, turns never follow turns, and each turn costs a square.
 */
function searchHelm(
  st: Battle,
  sp: Ship,
  score: Scorer,
  ta: number,
  ma: number,
  mayHeaveTo: boolean,
): string {
  // The original's captains always move if any move scores above its floor; Figurehead's
  // other roles may also choose to heave to.
  const best = { score: -30000, helm: '' };
  const consider = (helm: string) => {
    const s = score(sailOut(st, sp, helm));
    if (s > best.score) {
      best.score = s;
      best.helm = helm;
    }
  };
  if (mayHeaveTo) consider('');
  const tryFrom = (temp: string, ma: number, ta: number, vma: number, dir: number) => {
    const last = temp[temp.length - 1] ?? '';
    if (!(last >= '1' && last <= '9')) {
      for (let n = 1; vma - n >= 0; n++) {
        const helm = temp + n;
        consider(helm);
        tryFrom(helm, ma - n, ta, vma - n, dir);
      }
    }
    const canTurn = (ma > 0 && ta > 0 && last !== 'l' && last !== 'r') || temp.length === 0;
    if (!canTurn) return;
    for (const [ch, nd] of [
      ['r', turnRight(dir)],
      ['l', turnLeft(dir)],
    ] as const) {
      const helm = temp + ch;
      consider(helm);
      tryFrom(helm, ma - 1, ta - 1, Math.min(ma - 1, maxMove(st, sp, nd)), nd);
    }
  };
  tryFrom('', ma, ta, ma, sp.dir);
  return best.helm;
}

function flagshipOf(st: Battle, sp: Ship): Ship | null {
  const flag = st.player >= 0 ? st.ships[st.player] : undefined;
  if (flag && flag.dir !== 0 && !flag.struck && capship(st, flag).nation === capship(st, sp).nation)
    return flag;
  return null;
}

/** Choose every computer captain's helm order for this turn (sail/dr_3.c:61-83). */
export function planComputerHelms(st: Battle): void {
  for (const sp of st.ships) {
    if (sp.role === 'human' || sp.dir === 0) continue;
    sp.movebuf = '';
    if (sp.struck || !st.windspeed || snagged(sp) || !sp.specs.crew3 || sp.role === 'anchored')
      continue;
    const { turns } = maxTurns(sp);
    const ma = maxMove(st, sp, sp.dir);
    const enemy = closestShip(st, sp, null, false);
    const scorer = scorerFor(st, sp, sp.role, enemy);
    if (scorer) sp.movebuf = searchHelm(st, sp, scorer, turns, ma, sp.role !== 'attack');
  }
}

function scorerFor(st: Battle, sp: Ship, role: Role, enemy: Ship | null): Scorer | null {
  switch (role) {
    case 'flee':
      return fleeScore(st, sp, enemy);
    case 'merchant':
      return merchantScore(st, sp, enemy);
    case 'follow': {
      const flag = flagshipOf(st, sp);
      return flag ? followScore(st, flag, enemy) : enemy ? attackScore(st, enemy) : null;
    }
    case 'holdoff':
      return holdOffScore(st, flagshipOf(st, sp), enemy);
    case 'attack':
      return enemy ? attackScore(st, enemy) : null;
    default:
      return null;
  }
}

/**
 * Sails: the original's captains crowd on sail only when the enemy is far (sail/dr_3.c:326-353);
 * ships on the run carry all they can.
 */
export function computerSails(ctx: Ctx): void {
  const { st } = ctx;
  for (const sp of st.ships) {
    if (sp.role === 'human') continue;
    let rig = sp.specs.rig1;
    if (st.windspeed === 6 || (st.windspeed === 5 && sp.specs.cls > 4)) rig = 0;
    let full = 0;
    if (rig && sp.specs.crew3 && !sp.struck) {
      if (sp.role === 'flee' || sp.role === 'merchant') full = 1;
      else {
        const close = closestShip(st, sp, null, false);
        full = close && range(sp, close) > 9 ? 1 : 0;
      }
    }
    if ((sp.FS !== 0) !== Boolean(full)) {
      sp.FS = full ? 1 : 0;
      if (sp.dir) emit(ctx, { t: 'sails', ship: sp.index, full: Boolean(full), forced: false });
    }
  }
}

/** The squadron takes the flagship's signal: ships of her side that fight, not merchantmen. */
export function applySignal(st: Battle): void {
  const flag = st.player >= 0 ? st.ships[st.player] : undefined;
  if (!flag) return;
  const role: Role =
    st.signal === 'engage' ? 'attack' : st.signal === 'follow' ? 'follow' : 'holdoff';
  for (const sp of st.ships) {
    if (sp === flag || sp.captured >= 0 || sp.nation !== flag.nation) continue;
    if (sp.role === 'attack' || sp.role === 'follow' || sp.role === 'holdoff') sp.role = role;
  }
}
