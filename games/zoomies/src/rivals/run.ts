import { classicWaveSpec, createRoom } from '../engine/room';
import { applyAction, legality } from '../engine/rules';
import type { Action, RoomState } from '../engine/types';
import { scoreNight } from '../engine/scoring';
import type { Mind } from './types';

export type RunOutcome = 'cleared' | 'caught' | 'stuck';

export interface RoomRun {
  readonly outcome: RunOutcome;
  readonly turns: number;
  readonly zooms: number;
  readonly tangled: number;
  readonly actions: readonly Action[];
  readonly final: RoomState;
}

/**
 * Plays one room with a rival until it is cleared, the cat is caught, or the turn budget runs
 * out (a nap-forever strategy can circle a lone vacuum for good).
 */
export function playRoom(initial: RoomState, mind: Mind, maxTurns = 600): RoomRun {
  let state = initial;
  const actions: Action[] = [];
  mind.newRoom?.();
  while (state.status === 'playing' && state.turn < maxTurns) {
    let action = mind.decide(state);
    // A strategy that misjudges a blocked square would stall; the original beeped and asked again.
    if (legality(state, action) === 'blocked') action = { type: 'zoom' };
    actions.push(action);
    state = applyAction(state, action).state;
  }
  const outcome: RunOutcome =
    state.status === 'cleared' ? 'cleared' : state.status === 'caught' ? 'caught' : 'stuck';
  return {
    outcome,
    turns: state.turn,
    zooms: state.zooms,
    tangled: state.tangled,
    actions,
    final: state,
  };
}

export interface NightRun {
  readonly score: number;
  readonly wavesCleared: number;
  /** The wave the run ended on. */
  readonly lastWave: number;
  readonly tangled: number;
  readonly zooms: number;
  readonly turns: number;
}

export interface NightOptions {
  readonly startWave?: number;
  readonly maxWaves?: number;
  readonly maxTurnsPerWave?: number;
}

/** Plays a whole Long Night: wave after wave of the original field until the cat is caught. */
export function playNight(seed: string, mind: Mind, options: NightOptions = {}): NightRun {
  const startWave = options.startWave ?? 1;
  const maxWaves = options.maxWaves ?? 60;
  const rooms: RoomState[] = [];
  let tangled = 0;
  let zooms = 0;
  let turns = 0;
  let wave = startWave;
  for (; wave < startWave + maxWaves; wave++) {
    const run = playRoom(
      createRoom(classicWaveSpec(seed, wave)),
      mind,
      options.maxTurnsPerWave ?? 2000,
    );
    rooms.push(run.final);
    tangled += run.tangled;
    zooms += run.zooms;
    turns += run.turns;
    if (run.outcome !== 'cleared') break;
  }
  const wavesCleared = rooms.filter((r) => r.status === 'cleared').length;
  return {
    score: scoreNight(rooms, startWave),
    wavesCleared,
    lastWave: Math.min(wave, startWave + maxWaves - 1),
    tangled,
    zooms,
    turns,
  };
}
