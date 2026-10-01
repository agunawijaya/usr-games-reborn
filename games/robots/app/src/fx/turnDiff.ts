// What happened in one turn, read from two game states. The remaster never
// changes the engine (src/game/engine.ts); every effect is derived here.
//
// Robots that disappeared between `prev` and `next` crashed. Where they
// crashed is where the engine moved them: one sign() step toward the
// player, clamped to the grid (engine.ts advanceRobots). A crash on a square
// that already held scrap is a robot-into-scrap crash.

import { GRID_HEIGHT, GRID_WIDTH, type GameState, type Position } from '../game/state';

const sign = (n: number): number => (n > 0 ? 1 : n < 0 ? -1 : 0);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const key = (p: Position): string => `${p.x},${p.y}`;

export type Crash = { at: Position; count: number; onPile: boolean };
export type Dying = { id: number; from: Position; to: Position };

export type TurnDiff = {
  playerMoved: boolean;
  teleported: { from: Position; to: Position } | null;
  dying: Dying[];
  crashes: Crash[];
  died: boolean;
  levelCleared: boolean;
  newLevel: boolean;
};

export function stepToward(r: Position, target: Position): Position {
  return {
    x: clamp(r.x + sign(target.x - r.x), 0, GRID_WIDTH - 1),
    y: clamp(r.y + sign(target.y - r.y), 0, GRID_HEIGHT - 1),
  };
}

export function diffTurn(prev: GameState, next: GameState): TurnDiff {
  const newLevel = next.level !== prev.level;
  const dx = Math.abs(next.player.x - prev.player.x);
  const dy = Math.abs(next.player.y - prev.player.y);
  const jumped = !newLevel && Math.max(dx, dy) > 1;
  const out: TurnDiff = {
    playerMoved: !newLevel && dx + dy > 0,
    teleported: jumped ? { from: prev.player, to: next.player } : null,
    dying: [],
    crashes: [],
    died: prev.status === 'playing' && next.status === 'dead',
    levelCleared: prev.status === 'playing' && next.status === 'level-clear',
    newLevel,
  };
  if (newLevel) return out;
  const alive = new Set(next.robots.map((r) => r.id));
  const oldPiles = new Set(prev.piles.map(key));
  const groups = new Map<string, Crash>();
  for (const r of prev.robots) {
    if (alive.has(r.id)) continue;
    const to = stepToward(r, next.player);
    out.dying.push({ id: r.id, from: { x: r.x, y: r.y }, to });
    const k = key(to);
    const g = groups.get(k) ?? { at: to, count: 0, onPile: oldPiles.has(k) };
    g.count++;
    groups.set(k, g);
  }
  out.crashes = [...groups.values()];
  return out;
}

/** Squares a robot reaches next turn if you stay, plus robots and scrap
 *  themselves (in this port you may walk into both, and die). */
export function dangerCells(s: GameState): Uint8Array {
  const m = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
  for (const r of s.robots) {
    for (let y = r.y - 1; y <= r.y + 1; y++) {
      for (let x = r.x - 1; x <= r.x + 1; x++) {
        if (x >= 0 && y >= 0 && x < GRID_WIDTH && y < GRID_HEIGHT) m[y * GRID_WIDTH + x] = 1;
      }
    }
  }
  for (const p of s.piles) m[p.y * GRID_WIDTH + p.x] = 2;
  return m;
}

/** Where each robot steps next turn if you stay put. */
export function nextSteps(s: GameState): Array<{ id: number; from: Position; to: Position }> {
  return s.robots.map((r) => ({ id: r.id, from: { x: r.x, y: r.y }, to: stepToward(r, s.player) }));
}
