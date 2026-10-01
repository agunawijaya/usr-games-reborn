// A careful bot for calibrating the Grand Tour: it plays through the real rules
// and the run tracker. It is not the player's opponent, only a yardstick.

import { movePlayer, safeWaitStep, teleport } from '../src/game/engine';
import { RNG } from '../src/game/rng';
import { DIRECTIONS, type GameState } from '../src/game/state';
import { isFinalWave, type MatchPlan, robotsForWave } from '../src/modes/plans';
import { RunTracker } from '../src/modes/tracker';
import { firstWave, followingWave, waveRng } from '../src/modes/waves';

export function nearest(state: GameState): number {
  let best = Infinity;
  for (const r of state.robots) best = Math.max(0, Math.min(best, Math.max(Math.abs(r.x - state.player.x), Math.abs(r.y - state.player.y))));
  return best;
}

type Choice = { kind: 'move' | 'wait' | 'teleport'; next: GameState };

const MOVES = Object.values(DIRECTIONS);

/** Squares the cat could step to next turn without being caught at once. */
function mobility(state: GameState): number {
  let count = 0;
  for (const dir of MOVES) {
    const result = movePlayer(state, dir);
    if (result.outcome !== 'invalid' && result.outcome !== 'died') count++;
  }
  return count;
}

/**
 * Two-turn lookahead: crash as many as possible now, keep room to move afterwards, wait
 * while nothing is near, teleport only when every square is lost.
 */
function choose(state: GameState, botRng: RNG, teleportRng: RNG, teleportsLeft: number): Choice {
  if (nearest(state) > 2) {
    const waited = safeWaitStep(state);
    if (waited.state !== state) return { kind: 'wait', next: waited.state };
  }
  let best: { value: number; next: GameState } | null = null;
  for (const dir of MOVES) {
    const result = movePlayer(state, dir);
    if (result.outcome === 'invalid' || result.outcome === 'died') continue;
    if (result.outcome === 'level-clear') return { kind: 'move', next: result.state };
    const room = mobility(result.state);
    if (room === 0) continue;
    let followUp = 0;
    for (const dir2 of MOVES) {
      const second = movePlayer(result.state, dir2);
      if (second.outcome !== 'invalid' && second.outcome !== 'died') followUp = Math.max(followUp, second.destroyed);
    }
    const value = result.destroyed * 100 + followUp * 30 + room * 8 + Math.min(nearest(result.state), 4) * 4 + botRng.next();
    if (!best || value > best.value) best = { value, next: result.state };
  }
  if (best) return { kind: 'move', next: best.next };
  if (teleportsLeft > 0) return { kind: 'teleport', next: teleport(state, teleportRng).state };
  return { kind: 'move', next: movePlayer(state, DIRECTIONS.stay).state };
}


export type MatchRun = Readonly<{ won: boolean; points: number }>;

/** Plays one match with the bot through the real rules and the run tracker. */
export function playMatch(plan: MatchPlan, botSeed: number): MatchRun {
  const tracker = new RunTracker(plan, plan.seed ?? 0);
  let state = firstWave(plan);
  tracker.startWave(state.level, state.robots.length);
  const botRng = new RNG(botSeed);
  let tpRng = waveRng(plan, state.level, 'teleport');
  let teleportsLeft = plan.teleports ?? Infinity;
  for (let turn = 0; turn < 2000; turn++) {
    const choice = choose(state, botRng, tpRng, teleportsLeft);
    if (choice.kind === 'teleport') teleportsLeft--;
    const before = state;
    state = choice.next;
    tracker.turn({
      crashed: before.robots.length - state.robots.length,
      classicGain: state.score - before.score,
      teleported: choice.kind === 'teleport',
      waited: choice.kind === 'wait',
      nearest: nearest(state),
      cleared: state.status === 'level-clear',
      caught: state.status === 'dead',
    });
    if (state.status === 'dead') break;
    if (state.status === 'level-clear') {
      if (isFinalWave(plan, state.level)) {
        tracker.winMatch();
        break;
      }
      state = followingWave(plan, state);
      tracker.startWave(state.level, robotsForWave(plan, state.level));
      tpRng = waveRng(plan, state.level, 'teleport');
    }
  }
  const summary = tracker.summary();
  return { won: summary.won, points: summary.points };
}
