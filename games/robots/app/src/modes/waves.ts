// Laying out the waves of a planned match. A seeded match (the Grand Tour, the
// Daily Showdown) draws every wave and every teleport landing from its own
// stream, so the waves are the same for everyone however they played the one
// before; those matches also never start you with a robot at arm's length.

import { initGame, nextLevel } from '../game/engine';
import { RNG } from '../game/rng';
import type { GameState } from '../game/state';
import { hashSeed } from './daily';
import { type MatchPlan, robotsForWave } from './plans';

const FAIR_START = 3;
const FAIR_TRIES = 40;

function nearestRobot(state: GameState): number {
  let best = Infinity;
  for (const r of state.robots) best = Math.min(best, Math.max(Math.abs(r.x - state.player.x), Math.abs(r.y - state.player.y)));
  return best;
}

export function waveRng(plan: MatchPlan, level: number, purpose: 'layout' | 'teleport'): RNG {
  if (plan.seed === null) return new RNG((Date.now() ^ Math.imul(level, 2654435761)) >>> 0);
  return new RNG(hashSeed(`${plan.seed}:${level}:${purpose}`));
}

function fairLayout(plan: MatchPlan, level: number, make: (rng: RNG) => GameState): GameState {
  const rng = waveRng(plan, level, 'layout');
  let state = make(rng);
  if (plan.seed === null) return state;
  for (let i = 0; i < FAIR_TRIES && nearestRobot(state) < FAIR_START; i++) state = make(rng);
  return state;
}

export function firstWave(plan: MatchPlan): GameState {
  const level = plan.startWave;
  return fairLayout(plan, level, (rng) => initGame(level, rng, robotsForWave(plan, level)));
}

export function followingWave(plan: MatchPlan, state: GameState): GameState {
  const level = state.level + 1;
  return fairLayout(plan, level, (rng) => nextLevel(state, rng, robotsForWave(plan, level)));
}
