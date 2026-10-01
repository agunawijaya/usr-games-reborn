import type { RoomState, Action } from '../engine/types';
import { createGlasses, GLASSES } from '../rivals/glasses';
import { createMochi, MOCHI } from '../rivals/mochi';
import { createPip, PIP } from '../rivals/pip';
import { createProfessor, PROFESSOR } from '../rivals/professor';
import { type NightRun, playNight, playRoom, type RunOutcome } from '../rivals/run';
import type { Mind, RivalId, RivalProfile } from '../rivals/types';

/**
 * The cats next door play the very same room. Their results are worked out when the room
 * starts (they take a few milliseconds) and shown beside yours at the end, as the original's
 * score file listed the automatic player's games beside everyone else's.
 */

export const PAR_PROFILE: RivalProfile = {
  id: 'par',
  name: 'Par',
  style: 'The fewest turns this room can be cleared in, without a single zoom.',
  origin: 'Worked out by a search through every possible game.',
};

export const RIVALS: readonly { profile: RivalProfile; make: () => Mind }[] = [
  { profile: MOCHI, make: createMochi },
  { profile: PIP, make: createPip },
  { profile: PROFESSOR, make: createProfessor },
  { profile: GLASSES, make: createGlasses },
];

export interface LadderRun {
  readonly id: RivalId;
  readonly name: string;
  readonly outcome: RunOutcome;
  readonly turns: number;
  readonly zooms: number;
  readonly actions: readonly Action[];
}

export function roomLadder(
  initial: RoomState,
  par: { turns: number; actions: readonly Action[] },
): LadderRun[] {
  const runs: LadderRun[] = RIVALS.map(({ profile, make }) => {
    const run = playRoom(initial, make(), 300);
    return {
      id: profile.id,
      name: profile.name,
      outcome: run.outcome,
      turns: run.turns,
      zooms: run.zooms,
      actions: run.actions,
    };
  });
  runs.push({
    id: 'par',
    name: 'Par',
    outcome: 'cleared',
    turns: par.turns,
    zooms: 0,
    actions: par.actions,
  });
  return runs;
}

/**
 * Clears first, and among them the fewest zooms (a lucky dash is not a plan), then the fewest
 * turns; everyone who was caught after that, the longest-lasting first.
 */
export function rankRun(
  a: { outcome: RunOutcome; turns: number; zooms: number },
  b: typeof a,
): number {
  const cleared = (r: typeof a) => (r.outcome === 'cleared' ? 0 : 1);
  if (cleared(a) !== cleared(b)) return cleared(a) - cleared(b);
  if (a.outcome === 'cleared') return a.zooms - b.zooms || a.turns - b.turns;
  return b.turns - a.turns;
}

/** How many rivals (par included) finished behind the player. */
export function rivalsBehind(
  you: { outcome: RunOutcome; turns: number; zooms: number },
  runs: readonly LadderRun[],
): number {
  return runs.filter((run) => rankRun(you, run) < 0).length;
}

export function describeRun(run: { outcome: RunOutcome; turns: number; zooms: number }): string {
  if (run.outcome === 'cleared')
    return `${run.turns} turns${run.zooms ? ` · ${run.zooms} zoom${run.zooms === 1 ? '' : 's'}` : ''}`;
  if (run.outcome === 'caught') return `caught on turn ${run.turns}`;
  return `still going after ${run.turns}`;
}

export interface NightLadderRun extends NightRun {
  readonly id: RivalId;
  readonly name: string;
}

export function nightLadder(seed: string, startWave: number): NightLadderRun[] {
  return RIVALS.map(({ profile, make }) => ({
    id: profile.id,
    name: profile.name,
    ...playNight(seed, make(), { startWave, maxWaves: 40 }),
  }));
}
