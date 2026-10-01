import { tangleAt } from '../engine/rules';
import type { Action, RoomState, Step } from '../engine/types';
import type { Mind, RivalProfile } from './types';

/**
 * The Professor plays exactly like the automatic player added to robots in 1999 (auto.c),
 * quirks included. Everything below works in the original's screen coordinates (the field
 * starts at row 1, column 1 inside a border), because two of its quirks only exist there:
 *
 * - It looks for its closest robot among all forty robot slots, scrapped ones included. A
 *   scrapped robot keeps its column but its row becomes −1, and the distance sum takes
 *   absolute values, so the wreck haunts the top row of the field. Slots never used this
 *   level sit in column 0. Near the top edge the Professor runs from robots that are gone.
 * - It reads the screen to find safe squares, and the border's corners are drawn with the
 *   same "+" as a robot, so the four corner squares of the field always look deadly to it.
 *
 * Its plan to put a heap between itself and the robot also works out the line between them
 * with integer division and the wrong constant, so its clever sidestep is mostly a guess.
 */
export const PROFESSOR: RivalProfile = {
  id: 'professor',
  name: 'Professor',
  style: 'Sits tight, then sidesteps to put a tangle between herself and the nearest vacuum.',
  origin: 'The automatic player added to robots in 1999, played exactly, quirks and all.',
};

/** Robot slots in the original (MAXROBOTS). */
const ROBOT_SLOTS = 40;

interface Coord {
  x: number;
  y: number;
}

type MoveChar = '.' | 'h' | 'j' | 'k' | 'l' | 'y' | 'u' | 'b' | 'n' | 't';

const MOVE_ORDER: readonly MoveChar[] = ['.', 'h', 'j', 'k', 'l', 'y', 'u', 'b', 'n'];

function xinc(move: MoveChar): number {
  if (move === 'b' || move === 'h' || move === 'y') return -1;
  if (move === 'l' || move === 'n' || move === 'u') return 1;
  return 0;
}

function yinc(move: MoveChar): number {
  if (move === 'k' || move === 'u' || move === 'y') return -1;
  if (move === 'b' || move === 'j' || move === 'n') return 1;
  return 0;
}

/** C's int sign() given a float: the argument is truncated toward zero first. */
function signInt(n: number): number {
  const truncated = Math.trunc(n);
  return truncated < 0 ? -1 : truncated > 0 ? 1 : 0;
}

/** auto.c's distance(): the absolute values make a row of −1 behave like row 1. */
function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.max(Math.abs(Math.abs(x1) - Math.abs(x2)), Math.abs(Math.abs(y1) - Math.abs(y2)));
}

/** What the original's curses screen would show at a screen position. */
function screenChar(state: RoomState, sx: number, sy: number): string {
  const { width, height } = state.layout;
  const top = sy === 0;
  const bottom = sy === height + 1;
  const left = sx === 0;
  const right = sx === width + 1;
  if ((top || bottom) && (left || right)) return '+';
  if (top || bottom) return '-';
  if (left || right) return '|';
  if (sx < 0 || sy < 0 || sx > width + 1 || sy > height + 1) return ' ';
  const x = sx - 1;
  const y = sy - 1;
  if (state.cat.x === x && state.cat.y === y) return '@';
  if (state.vacuums.some((v) => v.alive && v.x === x && v.y === y)) return '+';
  if (tangleAt(state.tangles, x, y)) return '*';
  if (state.layout.blocked[y * width + x]) return '#';
  return ' ';
}

function findMoves(state: RoomState, me: Coord): MoveChar[] {
  const answers: MoveChar[] = [];
  for (const move of MOVE_ORDER) {
    const tx = me.x + xinc(move);
    const ty = me.y + yinc(move);
    const here = screenChar(state, tx, ty);
    if (here !== ' ' && here !== '@') continue;
    let bad = false;
    for (let x = tx - 1; x <= tx + 1 && !bad; x++) {
      for (let y = ty - 1; y <= ty + 1 && !bad; y++) {
        if (screenChar(state, x, y) === '+') bad = true;
      }
    }
    if (!bad) answers.push(move);
  }
  return answers.length > 0 ? answers : ['t'];
}

/** Every robot slot as the C array held it: live robots, scrapped ones at row −1, unused. */
function robotSlots(state: RoomState): Coord[] {
  const slots: Coord[] = state.vacuums.map((v) =>
    v.alive ? { x: v.x + 1, y: v.y + 1 } : { x: v.x + 1, y: -1 },
  );
  while (slots.length < ROBOT_SLOTS) slots.push({ x: 0, y: -1 });
  return slots;
}

function closest(points: readonly Coord[], me: Coord): { point: Coord | null; dist: number } {
  let best: Coord | null = null;
  let bestDist = 1000000;
  for (const point of points) {
    const d = distance(me.x, me.y, point.x, point.y);
    if (d < bestDist) {
      best = point;
      bestDist = d;
    }
  }
  return { point: best, dist: bestDist };
}

function moveTowards(state: RoomState, me: Coord, dx: number, dy: number): MoveChar {
  const ok = findMoves(state, me);
  let best = ok[0]!;
  if (best === 't') return best;
  let judge = Math.abs(xinc(best) - dx) + Math.abs(yinc(best) - dy);
  for (const move of ok.slice(1)) {
    const current = Math.abs(xinc(move) - dx) + Math.abs(yinc(move) - dy);
    if (current < judge) {
      judge = current;
      best = move;
    }
  }
  return best;
}

function moveAway(state: RoomState, me: Coord, robot: Coord): MoveChar {
  return moveTowards(state, me, signInt(me.x - robot.x), signInt(me.y - robot.y));
}

function moveBetween(state: RoomState, me: Coord, robot: Coord, heap: Coord): MoveChar {
  let dx: number;
  let dy: number;
  if (me.x === robot.x) {
    dx = -signInt(me.x - heap.x);
    dy = signInt(me.y - robot.y);
  } else if (me.y === robot.y) {
    dx = signInt(me.x - robot.x);
    dy = -signInt(me.y - heap.y);
  } else {
    // Integer division, as the C wrote it, stored into a float.
    const slope = Math.trunc((me.y - robot.y) / (me.x - robot.x));
    const cons = slope * robot.y;
    if (Math.abs(me.x - robot.x) > Math.abs(me.y - robot.y)) {
      dx = signInt(me.x - robot.x);
      dy = signInt(slope * heap.x + cons - heap.y);
    } else {
      dx = signInt(slope * heap.x + cons - heap.y);
      dy = signInt(me.y - robot.y);
    }
  }
  return moveTowards(state, me, dx, dy);
}

function between(me: Coord, robot: Coord, heap: Coord): boolean {
  if (heap.x > robot.x && me.x < robot.x) return false;
  if (heap.x < robot.x && me.x > robot.x) return false;
  if (heap.y < robot.y && me.y > robot.y) return false;
  if (heap.y > robot.y && me.y < robot.y) return false;
  return true;
}

/** automove(), line for line. */
export function autobotMove(state: RoomState): MoveChar {
  const me = { x: state.cat.x + 1, y: state.cat.y + 1 };
  const robot = closest(robotSlots(state), me);
  if (robot.dist > 1 || !robot.point) return '.';
  if (state.tangles.length === 0) return moveAway(state, me, robot.point);
  const heaps = state.tangles.map((t) => ({ x: t.x + 1, y: t.y + 1 }));
  const heap = closest(heaps, me);
  const robotHeap = distance(robot.point.x, robot.point.y, heap.point!.x, heap.point!.y);
  if (robotHeap <= heap.dist && !between(me, robot.point, heap.point!)) {
    return moveAway(state, me, robot.point);
  }
  return moveBetween(state, me, robot.point, heap.point!);
}

export function moveCharToAction(move: MoveChar): Action {
  if (move === 't') return { type: 'zoom' };
  return { type: 'step', dx: xinc(move) as Step, dy: yinc(move) as Step };
}

/** The moves the Professor believes are safe right now, as she reads the screen. */
export function professorSafeMoves(state: RoomState): MoveChar[] {
  return findMoves(state, { x: state.cat.x + 1, y: state.cat.y + 1 });
}

export function createProfessor(): Mind {
  return { decide: (state) => moveCharToAction(autobotMove(state)) };
}
