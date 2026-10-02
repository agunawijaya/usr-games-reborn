import { createRng, type Rng } from '@usr-games/kit';
import { cellAt, indexOf, isSolid, parseBoard, type Board } from '../src/engine/board';
import { createGame, move, type PlannedDigit } from '../src/engine/game';
import { type Cell, DIRS, type Dir, dirBetween, step } from '../src/engine/geometry';
import { solveFill } from '../src/engine/solver';
import { mapOf } from '../src/gardens/gardens';

/**
 * Designs the fill puzzles and prints them as data for `src/gardens/puzzles.ts`.
 *
 * A puzzle is built backwards from a proof. Pick a route that visits every open cell once (the
 * noodle's final body, tail to head). Lay the starting noodle along the route's first cells,
 * with a short tail trailing into cells the route only reaches later: the noodle frees those
 * while it is still hungry, then covers them again. Then place the digits on the route so the
 * noodle never runs out of growth before the box is full. The route proves the puzzle can be
 * done; the solver then has to find a way on its own, and the fewest moves it finds within its
 * budget become the par.
 *
 *   pnpm --filter @usr-games/game-worm exec tsx scripts/design-puzzles.ts
 */

interface Recipe {
  number: number;
  id: string;
  title: string;
  width: number;
  height: number;
  rocks?: readonly [number, number][];
  /** Starting length. */
  length: number;
  /** How many of the starting cells are freed before the first bite. */
  hungry: number;
  /** A fixed route, or a seed for a random one. */
  route: 'spiral' | string;
  /** Digits are drawn from this range (the last one makes the sum come out). */
  digits: [number, number];
}

const RECIPES: Recipe[] = [
  {
    number: 1,
    id: 'first-fill',
    title: 'First Fill',
    width: 5,
    height: 5,
    length: 4,
    hungry: 2,
    route: 'a',
    digits: [2, 5],
  },
  {
    number: 2,
    id: 'corner-shop',
    title: 'Corner Shop',
    width: 6,
    height: 5,
    length: 4,
    hungry: 2,
    route: 'b',
    digits: [2, 6],
  },
  {
    number: 3,
    id: 'little-loop',
    title: 'Little Loop',
    width: 6,
    height: 6,
    rocks: [
      [2, 2],
      [3, 2],
      [2, 3],
      [3, 3],
    ],
    length: 5,
    hungry: 3,
    route: 'c',
    digits: [2, 6],
  },
  {
    number: 4,
    id: 'the-hallway',
    title: 'The Hallway',
    width: 8,
    height: 5,
    length: 5,
    hungry: 2,
    route: 'd',
    digits: [3, 7],
  },
  {
    number: 5,
    id: 'stepping-stones',
    title: 'Stepping Stones',
    width: 7,
    height: 6,
    rocks: [
      [2, 1],
      [4, 4],
    ],
    length: 5,
    hungry: 3,
    route: 'e',
    digits: [2, 7],
  },
  {
    number: 6,
    id: 'two-rooms',
    title: 'Two Rooms',
    width: 8,
    height: 6,
    rocks: [
      [4, 0],
      [4, 1],
      [4, 3],
      [4, 4],
      [4, 5],
    ],
    length: 5,
    hungry: 2,
    route: 'f',
    digits: [3, 8],
  },
  {
    number: 7,
    id: 'snail-shell',
    title: 'The Snail Shell',
    width: 9,
    height: 7,
    length: 6,
    hungry: 5,
    route: 'spiral',
    digits: [3, 9],
  },
  {
    number: 8,
    id: 'garden-ring',
    title: 'Garden Ring',
    width: 8,
    height: 8,
    rocks: [
      [3, 3],
      [4, 3],
      [3, 4],
      [4, 4],
    ],
    length: 6,
    hungry: 3,
    route: 'h',
    digits: [3, 9],
  },
  {
    number: 9,
    id: 'zigzag',
    title: 'Zigzag',
    width: 9,
    height: 8,
    rocks: [
      [2, 0],
      [2, 1],
      [2, 2],
      [6, 5],
      [6, 6],
      [6, 7],
    ],
    length: 6,
    hungry: 3,
    route: 'i',
    digits: [3, 9],
  },
  {
    number: 10,
    id: 'the-comb',
    title: 'The Comb',
    width: 10,
    height: 7,
    rocks: [
      [2, 0],
      [2, 1],
      [2, 2],
      [5, 0],
      [5, 1],
      [5, 2],
      [8, 0],
      [8, 1],
      [8, 2],
    ],
    length: 6,
    hungry: 3,
    route: 'j',
    digits: [4, 9],
  },
  {
    number: 11,
    id: 'courtyard',
    title: 'Courtyard',
    width: 10,
    height: 8,
    rocks: [
      [4, 3],
      [5, 3],
      [4, 4],
      [5, 4],
      [0, 0],
      [9, 0],
    ],
    length: 6,
    hungry: 4,
    route: 'k',
    digits: [4, 9],
  },
  {
    number: 12,
    id: 'long-table',
    title: 'Long Table',
    width: 11,
    height: 8,
    rocks: [
      [2, 3],
      [3, 3],
      [4, 3],
      [5, 3],
      [6, 3],
      [7, 3],
      [8, 3],
    ],
    length: 7,
    hungry: 4,
    route: 'l',
    digits: [4, 9],
  },
  {
    number: 13,
    id: 'crossroads',
    title: 'Crossroads',
    width: 11,
    height: 9,
    rocks: [
      [2, 2],
      [3, 2],
      [2, 3],
      [3, 3],
      [7, 2],
      [8, 2],
      [7, 3],
      [8, 3],
      [2, 5],
      [3, 5],
      [2, 6],
      [3, 6],
      [7, 5],
      [8, 5],
      [7, 6],
      [8, 6],
    ],
    length: 7,
    hungry: 4,
    route: 'm',
    digits: [5, 9],
  },
  {
    number: 14,
    id: 'terraces',
    title: 'Terraces',
    width: 12,
    height: 8,
    rocks: [
      [3, 0],
      [3, 1],
      [3, 2],
      [3, 3],
      [6, 7],
      [6, 6],
      [6, 5],
      [6, 4],
      [9, 0],
      [9, 1],
      [9, 2],
      [9, 3],
    ],
    length: 7,
    hungry: 5,
    route: 'n',
    digits: [5, 9],
  },
  {
    number: 15,
    id: 'the-big-box',
    title: 'The Big Box',
    width: 12,
    height: 9,
    length: 8,
    hungry: 5,
    route: 'o',
    digits: [5, 9],
  },
];

function boardFor(recipe: Recipe): Board {
  const board = parseBoard(mapOf(recipe.width, recipe.height, { '#': recipe.rocks ?? [] }));
  // Like a chessboard, every step changes colour, so a route through every cell needs the two
  // colours within one of each other. Rocks placed carelessly break that.
  let balance = 0;
  board.terrain.forEach((t, i) => {
    if (!isSolid(t))
      balance += ((i % board.width) + Math.floor(i / board.width)) % 2 === 1 ? 1 : -1;
  });
  if (Math.abs(balance) > 1)
    throw new Error(
      `Puzzle ${recipe.number} can never be filled: its colours are ${balance} apart`,
    );
  return board;
}

/** A path through every open cell, from the outer corner inwards. */
function spiralRoute(board: Board): number[] {
  const route: number[] = [];
  let [left, top, right, bottom] = [0, 0, board.width - 1, board.height - 1];
  while (left <= right && top <= bottom) {
    for (let x = left; x <= right; x++) route.push(top * board.width + x);
    for (let y = top + 1; y <= bottom; y++) route.push(y * board.width + right);
    if (top < bottom) for (let x = right - 1; x >= left; x--) route.push(bottom * board.width + x);
    if (left < right) for (let y = bottom - 1; y > top; y--) route.push(y * board.width + left);
    [left, top, right, bottom] = [left + 1, top + 1, right - 1, bottom - 1];
  }
  return route;
}

function openNeighbours(board: Board, index: number): number[] {
  const cell = cellAt(board, index);
  const out: number[] = [];
  for (const dir of DIRS) {
    const n = step(cell, dir);
    if (n.x < 0 || n.y < 0 || n.x >= board.width || n.y >= board.height) continue;
    const i = indexOf(board, n);
    if (!isSolid(board.terrain[i]!)) out.push(i);
  }
  return out;
}

/** A random path through every open cell, by depth-first search, most constrained cell first. */
function randomRoute(board: Board, random: Rng): number[] | null {
  const open = board.terrain.flatMap((t, i) => (isSolid(t) ? [] : [i]));
  for (let attempt = 0; attempt < 200; attempt++) {
    const start = random.pick(open);
    const route = [start];
    const used = new Set([start]);
    let nodes = 0;
    const extend = (): boolean => {
      if (route.length === open.length) return true;
      if (++nodes > 200_000) return false;
      const here = route.at(-1)!;
      const options = openNeighbours(board, here)
        .filter((n) => !used.has(n))
        .map((n) => ({
          n,
          score: openNeighbours(board, n).filter((m) => !used.has(m)).length + random.float(0, 0.9),
        }))
        .sort((a, b) => a.score - b.score);
      for (const { n } of options) {
        used.add(n);
        route.push(n);
        if (extend()) return true;
        route.pop();
        used.delete(n);
      }
      return false;
    };
    if (extend()) return route;
  }
  return null;
}

/**
 * The starting noodle: the route's first `length - hungry` cells, head at the far end, and a
 * tail of `hungry` cells trailing from the route's start into cells the route visits only later.
 */
function startingBody(
  board: Board,
  route: number[],
  length: number,
  hungry: number,
): number[] | null {
  const position = new Map(route.map((cell, i) => [cell, i]));
  const kept = route.slice(0, length - hungry).reverse();
  const tail: number[] = [];
  const grow = (from: number): boolean => {
    if (tail.length === hungry) return true;
    for (const n of openNeighbours(board, from)) {
      if (tail.includes(n) || kept.includes(n) || position.get(n)! < length) continue;
      tail.push(n);
      if (grow(n)) return true;
      tail.pop();
    }
    return false;
  };
  return grow(route[0]!) ? [...kept, ...tail] : null;
}

/**
 * Digits along the route: values that add up to what the noodle still has to grow, each placed
 * where the head will be when it should bite, never so far apart that its stomach runs empty.
 */
function digitsAlong(
  route: number[],
  firstBite: number,
  headAt: number,
  growth: number,
  range: [number, number],
  random: Rng,
): { value: number; at: number }[] {
  const plan: { value: number; at: number }[] = [];
  let left = growth;
  let biteMove = firstBite;
  let stomach = 0;
  while (left > 0) {
    const value =
      left <= range[1] ? left : Math.min(left - range[0], random.int(range[0], range[1]));
    plan.push({ value, at: route[headAt + biteMove]! });
    left -= value;
    stomach += value;
    if (left === 0) break;
    // The next bite comes before the stomach is empty: at most `stomach` moves on, and usually
    // late, so the chain is a choice the player has to make in time.
    const gap = Math.max(1, stomach - random.int(0, Math.min(2, stomach - 1)));
    biteMove += gap;
    stomach -= gap;
  }
  return plan;
}

function letters(dirs: Dir[]): string {
  return dirs.map((d) => ({ up: 'U', down: 'D', left: 'L', right: 'R' })[d]).join('');
}

function design(recipe: Recipe) {
  const board = boardFor(recipe);
  const random = createRng(`fill:${recipe.id}:${recipe.route}`);
  for (let attempt = 0; attempt < 400; attempt++) {
    const route = recipe.route === 'spiral' ? spiralRoute(board) : randomRoute(board, random);
    if (!route) continue;
    const body = startingBody(board, route, recipe.length, recipe.hungry);
    if (!body) continue;
    const headAt = recipe.length - recipe.hungry - 1;
    const plan = digitsAlong(
      route,
      recipe.hungry,
      headAt,
      board.openCount - recipe.length,
      recipe.digits,
      random,
    );
    const cells = body.map((i) => cellAt(board, i));
    const heading = dirBetween(cells[1]!, cells[0]!) ?? 'right';
    const witness: Dir[] = [];
    for (let i = headAt; i < route.length - 1; i++)
      witness.push(dirBetween(cellAt(board, route[i]!), cellAt(board, route[i + 1]!))!);
    if (
      witness[0] === undefined ||
      witness[0] === ({ up: 'down', down: 'up', left: 'right', right: 'left' } as const)[heading]
    )
      continue;
    const planned: PlannedDigit[] = plan.map((d) => ({ value: d.value, at: cellAt(board, d.at) }));
    // The route must really fill the box under the game's own rules.
    const game = createGame({
      board,
      body: cells,
      heading,
      plan: planned,
      random: createRng('proof'),
    });
    for (const dir of witness) move(game, dir);
    if (game.status !== 'filled') continue;
    const solved = solveFill(
      { board, body: cells, heading, plan: planned },
      { budget: 3_000_000, maxMoves: witness.length },
    );
    if (!solved.moves) {
      console.error(
        `#${recipe.number}: the solver could not confirm attempt ${attempt} (${solved.nodes} positions)`,
      );
      continue;
    }
    let best = solved.moves;
    // Look for a shorter way, a little at a time.
    for (let cap = best.length - 1; cap >= best.length - 6; cap--) {
      const shorter = solveFill(
        { board, body: cells, heading, plan: planned },
        { budget: 600_000, maxMoves: cap },
      );
      if (!shorter.moves) break;
      best = shorter.moves;
    }
    return { board, cells, heading, planned, witness, best, nodes: solved.nodes };
  }
  throw new Error(`No design found for puzzle ${recipe.number}`);
}

const out: string[] = [];
for (const recipe of RECIPES) {
  const started = performance.now();
  const d = design(recipe);
  const ms = Math.round(performance.now() - started);
  console.error(
    `#${recipe.number} ${recipe.title}: ${d.board.openCount} cells, ${d.planned.length} digits, route ${d.witness.length} moves, best ${d.best.length}, ${d.nodes} positions, ${ms} ms`,
  );
  const cell = (c: Cell) => `{ x: ${c.x}, y: ${c.y} }`;
  out.push(`  {
    number: ${recipe.number},
    id: '${recipe.id}',
    title: '${recipe.title}',
    map: ${JSON.stringify(mapOf(recipe.width, recipe.height, { '#': recipe.rocks ?? [] }))},
    start: [${d.cells.map(cell).join(', ')}],
    heading: '${d.heading}',
    plan: [${d.planned.map((p) => `{ value: ${p.value}, at: ${cell(p.at!)} }`).join(', ')}],
    par: ${d.best.length},
    route: '${letters(d.best)}',
  },`);
}
process.stdout.write(`${out.join('\n')}\n`);
