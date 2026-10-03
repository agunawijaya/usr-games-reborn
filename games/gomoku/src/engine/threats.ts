import {
  DIRECTIONS,
  type GameState,
  indexOf,
  onBoard,
  type Point,
  pointOf,
  type Stone,
  winsAt,
} from './game';

/**
 * Reading the board: every four (one move from five) and every open three (one move from a four
 * that cannot be stopped at both ends) on the board, for both sides. This is what "Read the board"
 * draws, and what the puzzles and the stronger players reason with.
 */

export type ThreatKind = 'four' | 'three';

export interface Threat {
  stone: Stone;
  kind: ThreatKind;
  /** Index into DIRECTIONS. */
  dir: number;
  /** The stones of the threat, in line order. */
  stones: number[];
  /**
   * For a four, the point(s) that make five. For a three, the points that make it an open four.
   */
  spots: number[];
}

/** The points of a window of five starting at `start` in direction `d`, or null off the board. */
function window(game: GameState, start: Point, d: Point): number[] | null {
  const points: number[] = [];
  for (let k = 0; k < 5; k++) {
    const x = start.x + d.x * k;
    const y = start.y + d.y * k;
    if (!onBoard(game, x, y)) return null;
    points.push(indexOf(game, x, y));
  }
  return points;
}

/** Points along direction `d` within `reach` steps of `p` either way, on the board. */
function lineAround(game: GameState, p: number, d: Point, reach: number): number[] {
  const { x, y } = pointOf(game, p);
  const points: number[] = [];
  for (let k = -reach; k <= reach; k++) {
    if (onBoard(game, x + d.x * k, y + d.y * k))
      points.push(indexOf(game, x + d.x * k, y + d.y * k));
  }
  return points;
}

/** Points on the line through `stones` (within five of them) where `stone` would make five. */
function fivePoints(game: GameState, stones: number[], d: Point, stone: Stone): number[] {
  const seen = new Set<number>();
  for (const s of stones) for (const q of lineAround(game, s, d, 4)) seen.add(q);
  return [...seen]
    .filter((q) => game.board[q] === null && winsAt(game, q, stone))
    .sort((a, b) => a - b);
}

export function findThreats(game: GameState): Threat[] {
  const threats: Threat[] = [];
  const seen = new Set<string>();
  const add = (t: Threat) => {
    const key = `${t.stone}:${t.kind}:${t.dir}:${t.stones.join(',')}`;
    if (seen.has(key)) return;
    seen.add(key);
    threats.push(t);
  };
  for (const stone of ['black', 'white'] as const) {
    DIRECTIONS.forEach((d, dir) => {
      for (let y = 0; y < game.size; y++)
        for (let x = 0; x < game.size; x++) {
          const points = window(game, { x, y }, d);
          if (!points) continue;
          const mine = points.filter((p) => game.board[p] === stone);
          if (points.some((p) => game.board[p] !== null && game.board[p] !== stone)) continue;
          if (mine.length === 4) {
            const spots = fivePoints(game, mine, d, stone);
            if (spots.length > 0) add({ stone, kind: 'four', dir, stones: mine, spots });
          } else if (mine.length === 3) {
            // A three is open if one more stone here makes a four that wins at two points.
            const spots = points.filter((p) => {
              if (game.board[p] !== null) return false;
              game.board[p] = stone;
              const open = fivePoints(game, [...mine, p], d, stone).length >= 2;
              game.board[p] = null;
              return open;
            });
            if (spots.length > 0) add({ stone, kind: 'three', dir, stones: mine, spots });
          }
        }
    });
  }
  // A three inside a four is not news.
  const news = threats.filter(
    (t) =>
      t.kind === 'four' ||
      !threats.some(
        (f) =>
          f.kind === 'four' &&
          f.stone === t.stone &&
          f.dir === t.dir &&
          t.stones.every((s) => f.stones.includes(s)),
      ),
  );
  return mergeOverlapping(news);
}

/**
 * Threats of one side, one kind and one direction that share stones are one shape on the board
 * (four stones in a broken row hold two threes, for instance): drawn and counted once.
 */
function mergeOverlapping(threats: Threat[]): Threat[] {
  const merged: Threat[] = [];
  for (const t of threats) {
    const same = merged.find(
      (m) =>
        m.stone === t.stone &&
        m.kind === t.kind &&
        m.dir === t.dir &&
        t.stones.filter((s) => m.stones.includes(s)).length >= 2,
    );
    if (!same) {
      merged.push({ ...t, stones: [...t.stones], spots: [...t.spots] });
      continue;
    }
    same.stones = [...new Set([...same.stones, ...t.stones])].sort((a, b) => a - b);
    same.spots = [...new Set([...same.spots, ...t.spots])].sort((a, b) => a - b);
  }
  return merged;
}

/** Two or more fours made by one move: the four-four of the packages. */
export function foursMadeBy(game: GameState, p: number, stone: Stone): number {
  return findThreats(game).filter(
    (t) => t.stone === stone && t.kind === 'four' && t.stones.includes(p),
  ).length;
}
