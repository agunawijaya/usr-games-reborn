// Game engine — pure logic. No React, no rendering, no side effects.
// Contract: `bsdgames/robots/docs/spec.md`.

import { RNG } from './rng';
import {
  DIRECTIONS,
  GRID_HEIGHT,
  GRID_WIDTH,
  MAX_ROBOTS,
  ROBOT_SCORE,
  ROBOTS_PER_LEVEL,
  type Direction,
  type GameState,
  type Position,
  type Robot,
} from './state';

export type MoveOutcome =
  | 'moved'
  | 'invalid' // out of bounds; state unchanged
  | 'died'
  | 'level-clear';

export type MoveResult = Readonly<{
  state: GameState;
  outcome: MoveOutcome;
  destroyed: number; // robots destroyed on this turn
}>;

// -----------------------------------------------------------------------------
// Helpers

const posKey = (p: { x: number; y: number }): string => `${p.x},${p.y}`;

const inBounds = (p: Position): boolean =>
  p.x >= 0 && p.x < GRID_WIDTH && p.y >= 0 && p.y < GRID_HEIGHT;

const samePos = (a: { x: number; y: number }, b: { x: number; y: number }): boolean =>
  a.x === b.x && a.y === b.y;

const sign = (n: number): -1 | 0 | 1 => (n > 0 ? 1 : n < 0 ? -1 : 0);

function pickEmpty(occupied: Set<string>, rng: RNG): Position {
  // Try random sampling first (fast when field is sparse).
  for (let i = 0; i < 500; i++) {
    const x = rng.int(0, GRID_WIDTH - 1);
    const y = rng.int(0, GRID_HEIGHT - 1);
    if (!occupied.has(`${x},${y}`)) return { x, y };
  }
  // Fall back to full scan (fast when field is dense).
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      if (!occupied.has(`${x},${y}`)) return { x, y };
    }
  }
  throw new Error('Board is full — cannot place entity');
}

// -----------------------------------------------------------------------------
// Public API

export function initGame(level: number, rng: RNG): GameState {
  if (level < 1) throw new RangeError(`Level must be >= 1, got ${level}`);

  const numRobots = Math.min(level * ROBOTS_PER_LEVEL, MAX_ROBOTS);
  const occupied = new Set<string>();
  const robots: Robot[] = [];

  for (let i = 0; i < numRobots; i++) {
    const p = pickEmpty(occupied, rng);
    robots.push({ id: i, x: p.x, y: p.y });
    occupied.add(posKey(p));
  }

  const player = pickEmpty(occupied, rng);

  return {
    level,
    score: 0,
    player,
    robots,
    piles: [],
    waitBonus: 0,
    status: 'playing',
  };
}

export function nextLevel(state: GameState, rng: RNG): GameState {
  const fresh = initGame(state.level + 1, rng);
  return {
    ...fresh,
    score: state.score, // carry cumulative score forward
  };
}

export function movePlayer(state: GameState, direction: Direction): MoveResult {
  if (state.status !== 'playing') {
    return { state, outcome: 'invalid', destroyed: 0 };
  }

  const target: Position = {
    x: state.player.x + direction.dx,
    y: state.player.y + direction.dy,
  };

  if (!inBounds(target)) {
    return { state, outcome: 'invalid', destroyed: 0 };
  }

  // Per spec §Turn Order step 3: if Field[target] != 0 after player move,
  // player dies. This covers stepping onto a robot or a pile.
  const onRobot = state.robots.some((r) => samePos(r, target));
  const onPile = state.piles.some((p) => samePos(p, target));
  if (onRobot || onPile) {
    return {
      state: { ...state, player: target, status: 'dead' },
      outcome: 'died',
      destroyed: 0,
    };
  }

  const moved: GameState = { ...state, player: target };
  return advanceRobots(moved, false);
}

export function teleport(state: GameState, rng: RNG): MoveResult {
  if (state.status !== 'playing') {
    return { state, outcome: 'invalid', destroyed: 0 };
  }

  const occupied = new Set<string>();
  state.robots.forEach((r) => occupied.add(posKey(r)));
  state.piles.forEach((p) => occupied.add(posKey(p)));

  const newPos = pickEmpty(occupied, rng);
  const moved: GameState = { ...state, player: newPos };
  return advanceRobots(moved, false);
}

// One tick of a safe-wait: advance robots one turn, but ONLY if a robot
// wouldn't land on the player on that turn. If it would, returns state
// unchanged with outcome='moved' (safe stop). Used by the UI to animate
// wait turn-by-turn — see docs/decisions/002-safe-wait-deviation.md.
export function safeWaitStep(state: GameState): MoveResult {
  if (state.status !== 'playing') {
    return { state, outcome: 'invalid', destroyed: 0 };
  }
  if (wouldRobotHitPlayerNextTurn(state)) {
    return { state, outcome: 'moved', destroyed: 0 };
  }
  return advanceRobots(state, true);
}

// Safe-wait (batched) — advances robots repeatedly in one call. Kept for
// tests or ports that don't need turn-by-turn UI animation. Fancy-web uses
// `safeWaitStep` above so each turn plays out visibly.
export function safeWait(state: GameState): MoveResult {
  if (state.status !== 'playing') {
    return { state, outcome: 'invalid', destroyed: 0 };
  }

  let current: GameState = state;
  let totalDestroyed = 0;
  const MAX_ITER = 500;

  for (let i = 0; i < MAX_ITER; i++) {
    if (wouldRobotHitPlayerNextTurn(current)) break;

    const result = advanceRobots(current, true);
    totalDestroyed += result.destroyed;
    current = result.state;

    if (result.outcome === 'level-clear') {
      return { state: current, outcome: 'level-clear', destroyed: totalDestroyed };
    }
    // Guarded: peek should have prevented, but honor result if it says died.
    if (result.outcome === 'died') {
      return { state: current, outcome: 'died', destroyed: totalDestroyed };
    }
  }

  return { state: current, outcome: 'moved', destroyed: totalDestroyed };
}

function wouldRobotHitPlayerNextTurn(state: GameState): boolean {
  for (const r of state.robots) {
    const nx = r.x + sign(state.player.x - r.x);
    const ny = r.y + sign(state.player.y - r.y);
    if (nx === state.player.x && ny === state.player.y) return true;
  }
  return false;
}

// Canonical risky wait — spec §Special commands `w`: robots move continuously
// until either Num_robots == 0 or player dies. Wait_bonus increments per
// robot death. This is the SPEC BEHAVIOR; fancy-web binds `w` to `safeWait`
// above instead (see port ADR-002). Retained here for tests and for classic
// ports that want to reuse this engine.
export function waitUntilResolved(state: GameState): MoveResult {
  if (state.status !== 'playing') {
    return { state, outcome: 'invalid', destroyed: 0 };
  }

  let current: GameState = state;
  let totalDestroyed = 0;
  const MAX_ITER = 500;

  for (let i = 0; i < MAX_ITER; i++) {
    const result = advanceRobots(current, true);
    totalDestroyed += result.destroyed;
    current = result.state;
    if (result.outcome === 'died' || result.outcome === 'level-clear') {
      return { state: current, outcome: result.outcome, destroyed: totalDestroyed };
    }
    if (current.robots.length === 0) {
      return { state: current, outcome: 'level-clear', destroyed: totalDestroyed };
    }
  }

  return { state: current, outcome: 'moved', destroyed: totalDestroyed };
}

// -----------------------------------------------------------------------------
// Internals

function advanceRobots(state: GameState, waiting: boolean): MoveResult {
  // Each robot moves 1 step toward the player using sign(dx), sign(dy),
  // preserving its stable ID.
  const advanced: Robot[] = state.robots.map((r) => ({
    id: r.id,
    x: Math.max(0, Math.min(GRID_WIDTH - 1, r.x + sign(state.player.x - r.x))),
    y: Math.max(0, Math.min(GRID_HEIGHT - 1, r.y + sign(state.player.y - r.y))),
  }));

  // Any robot landing on the player kills the player (spec §Turn Order step 4b).
  const playerKey = posKey(state.player);
  const anyOnPlayer = advanced.some((r) => posKey(r) === playerKey);
  if (anyOnPlayer) {
    return {
      state: {
        ...state,
        robots: advanced,
        status: 'dead',
      },
      outcome: 'died',
      destroyed: 0,
    };
  }

  // Count robots per cell — collisions form scrap.
  const cellCounts = new Map<string, number>();
  for (const r of advanced) {
    const k = posKey(r);
    cellCounts.set(k, (cellCounts.get(k) ?? 0) + 1);
  }
  const existingPiles = new Set(state.piles.map(posKey));

  const survivors: Robot[] = [];
  const newPileKeys = new Set(existingPiles);
  let destroyed = 0;

  for (const r of advanced) {
    const k = posKey(r);
    const collisionInCell = (cellCounts.get(k) ?? 0) > 1;
    const hitExistingPile = existingPiles.has(k);
    if (collisionInCell || hitExistingPile) {
      destroyed++;
      newPileKeys.add(k);
    } else {
      survivors.push(r);
    }
  }

  const newPiles: Position[] = Array.from(newPileKeys, (k) => {
    const [xs, ys] = k.split(',');
    return { x: Number(xs), y: Number(ys) };
  });

  const scoreDelta = destroyed * ROBOT_SCORE;
  const waitBonusDelta = waiting ? destroyed : 0;

  let newState: GameState = {
    ...state,
    robots: survivors,
    piles: newPiles,
    score: state.score + scoreDelta,
    waitBonus: state.waitBonus + waitBonusDelta,
  };

  // Level clears only when robots existed and were all destroyed this turn.
  // Guarding against `state.robots.length > 0` avoids reporting level-clear
  // on degenerate states that had no robots to begin with (e.g. test
  // scaffolds that isolate movement mechanics).
  if (survivors.length === 0 && state.robots.length > 0) {
    newState = {
      ...newState,
      score: newState.score + newState.waitBonus,
      waitBonus: 0,
      status: 'level-clear',
    };
    return { state: newState, outcome: 'level-clear', destroyed };
  }

  return { state: newState, outcome: 'moved', destroyed };
}

export { DIRECTIONS };
