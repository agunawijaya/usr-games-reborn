import { indexOf, inside, landing } from './board';
import { type Game, head } from './game';
import { type Cell, DIRS, type Dir, OPPOSITE } from './geometry';

/**
 * The house noodle: plays the attract garden, the demo and the balance runs. Each move it looks
 * for the shortest way to the digit, counting body cells as free once the tail will have left
 * them, and takes it only if the noodle could still reach its own tail afterwards. Otherwise it
 * stalls in the roomiest direction, following its tail. Budgets are in cells searched, never in
 * time, so runs repeat exactly.
 */

interface Snapshot {
  body: Cell[];
  growing: number;
  heading: Dir | null;
}

function snapshot(game: Game): Snapshot {
  return { body: game.body.map((c) => ({ ...c })), growing: game.growing, heading: game.heading };
}

/** At `t` moves from now, is this cell still under the body? */
function stillOccupied(
  snap: Snapshot,
  bodyIndex: Map<number, number>,
  cellIndex: number,
  t: number,
): boolean {
  const at = bodyIndex.get(cellIndex);
  if (at === undefined) return false;
  return t < snap.body.length - at + snap.growing;
}

function bodyIndexes(game: Game, snap: Snapshot): Map<number, number> {
  const map = new Map<number, number>();
  snap.body.forEach((c, i) => map.set(indexOf(game.board, c), i));
  return map;
}

/** Rock and one-way soil entered the wrong way end the game; a root is only chewed through. */
function passable(game: Game, cell: Cell, dir: Dir): boolean {
  const { board } = game;
  if (!inside(board, cell)) return false;
  const index = indexOf(board, cell);
  const terrain = board.terrain[index]!;
  if (terrain === 'rock') return false;
  if (terrain === 'flow' && board.flow.get(index) !== dir) return false;
  return true;
}

/** The shortest path of directions from the head to `target`, or null. */
function pathTo(game: Game, snap: Snapshot, target: Cell): Dir[] | null {
  const { board } = game;
  const bodyIndex = bodyIndexes(game, snap);
  const start = snap.body[0]!;
  const seen = new Map<number, { from: number; dir: Dir }>();
  const startIndex = indexOf(board, start);
  let frontier: { cell: Cell; heading: Dir | null }[] = [{ cell: start, heading: snap.heading }];
  seen.set(startIndex, { from: -1, dir: 'up' });
  const targetIndex = indexOf(board, target);
  for (let t = 1; frontier.length > 0 && t <= board.width * board.height; t++) {
    const next: typeof frontier = [];
    for (const { cell, heading } of frontier) {
      for (const dir of DIRS) {
        if (heading && dir === OPPOSITE[heading] && t === 1) continue;
        const to = landing(board, cell, dir);
        if (!passable(game, to, dir)) continue;
        const toIndex = indexOf(board, to);
        if (seen.has(toIndex) || stillOccupied(snap, bodyIndex, toIndex, t)) continue;
        seen.set(toIndex, { from: indexOf(board, cell), dir });
        if (toIndex === targetIndex) return unwind(seen, toIndex);
        next.push({ cell: to, heading: dir });
      }
    }
    frontier = next;
  }
  return null;
}

function unwind(seen: Map<number, { from: number; dir: Dir }>, end: number): Dir[] {
  const dirs: Dir[] = [];
  let at = end;
  for (let step = seen.get(at); step && step.from !== -1; step = seen.get(at)) {
    dirs.unshift(step.dir);
    at = step.from;
  }
  return dirs;
}

/** Plays `dirs` on a copy of the body, growing by `extra` once the last step is taken. */
function followed(game: Game, snap: Snapshot, dirs: Dir[], extra: number): Snapshot {
  const body = snap.body.map((c) => ({ ...c }));
  let growing = snap.growing;
  let heading = snap.heading;
  for (const dir of dirs) {
    if (growing === 0) body.pop();
    else growing--;
    body.unshift(landing(game.board, body[0]!, dir));
    heading = dir;
  }
  return { body, growing: growing + extra, heading };
}

/** How many cells the head could still reach, treating the whole body as solid. */
function room(game: Game, snap: Snapshot, limit: number): number {
  const { board } = game;
  const blocked = new Set(snap.body.slice(1).map((c) => indexOf(board, c)));
  const startCell = snap.body[0]!;
  const seen = new Set<number>([indexOf(board, startCell)]);
  const queue: Cell[] = [startCell];
  while (queue.length > 0 && seen.size < limit) {
    const cell = queue.shift()!;
    for (const dir of DIRS) {
      const to = landing(board, cell, dir);
      if (!passable(game, to, dir)) continue;
      const i = indexOf(board, to);
      if (seen.has(i) || blocked.has(i)) continue;
      seen.add(i);
      queue.push(to);
    }
  }
  return seen.size;
}

/** True when the head could still reach its own tail, the classic sign of a safe position. */
function canReachTail(game: Game, snap: Snapshot): boolean {
  if (snap.body.length < 3) return true;
  const tail = snap.body.at(-1)!;
  const shorter: Snapshot = { ...snap, body: snap.body.slice(0, -1), growing: 0 };
  return (
    pathTo(game, shorter, tail) !== null ||
    room(game, snap, snap.body.length + 2) > snap.body.length
  );
}

export function chooseMove(game: Game): Dir | null {
  if (game.status === 'lost' || game.status === 'filled') return null;
  const snap = snapshot(game);
  if (game.digit) {
    const path = pathTo(game, snap, game.digit.at);
    if (path && path.length > 0) {
      const after = followed(game, snap, path, game.digit.value);
      if (canReachTail(game, after)) return path[0]!;
    }
  }
  return safestMove(game, snap);
}

/** The step that leaves the most room, preferring one that keeps the tail in reach. */
function safestMove(game: Game, snap: Snapshot): Dir | null {
  const from = head(game);
  let best: { dir: Dir; score: number } | null = null;
  const bodyIndex = bodyIndexes(game, snap);
  for (const dir of DIRS) {
    if (snap.heading && dir === OPPOSITE[snap.heading]) continue;
    const to = landing(game.board, from, dir);
    if (!passable(game, to, dir) || stillOccupied(snap, bodyIndex, indexOf(game.board, to), 1))
      continue;
    const after = followed(game, snap, [dir], 0);
    const score =
      room(game, after, game.board.openCount) +
      (canReachTail(game, after) ? game.board.openCount : 0);
    if (!best || score > best.score) best = { dir, score };
  }
  return best?.dir ?? snap.heading;
}
