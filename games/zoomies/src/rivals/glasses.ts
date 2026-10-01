import { chebyshev } from '../engine/layout';
import { aliveCount, applyAction, legality, STEPS, tangleAt, whiskers } from '../engine/rules';
import type { Action, RoomState } from '../engine/types';
import type { Mind, RivalProfile } from './types';

/**
 * The Professor with her glasses on: the 1999 plan as it was meant to work. She ignores
 * vacuums that are already tangled, does not mistake the room's corners for vacuums, judges
 * danger exactly (mops, turbos and sleepy vacuums included) and looks one turn ahead for the
 * step that tangles the most and leaves her the most room.
 */
export const GLASSES: RivalProfile = {
  id: 'glasses',
  name: 'Professor, glasses on',
  style: 'The same plan with the bugs fixed: she sees exactly what can reach her.',
  origin: 'Our patched version of the 1999 automatic player.',
};

const STAY: Action = { type: 'step', dx: 0, dy: 0 };

function nearestVacuum(state: RoomState): number {
  let best = Infinity;
  for (const v of state.vacuums) if (v.alive) best = Math.min(best, chebyshev(v, state.cat));
  return best;
}

/** Vacuums whose straight run at the cat goes through a tangle: they are as good as caught. */
function shieldedBy(state: RoomState): number {
  let count = 0;
  for (const v of state.vacuums) {
    if (!v.alive) continue;
    let x = v.x;
    let y = v.y;
    for (let i = 0; i < 6 && (x !== state.cat.x || y !== state.cat.y); i++) {
      x += Math.sign(state.cat.x - x);
      y += Math.sign(state.cat.y - y);
      if (tangleAt(state.tangles, x, y)) {
        count++;
        break;
      }
    }
  }
  return count;
}

function openings(state: RoomState): number {
  return whiskers(state).filter((w) => w.verdict === 'ok').length;
}

function score(before: RoomState, after: RoomState): number {
  if (after.status === 'cleared') return 10000;
  const tangledNow = after.tangled - before.tangled;
  const room = openings(after);
  return (
    tangledNow * 100 + (room === 0 ? -400 : room * 6) + shieldedBy(after) * 4 - aliveCount(after)
  );
}

export function createGlasses(): Mind {
  return {
    decide(state) {
      if (nearestVacuum(state) > 2 && legality(state, STAY) === 'ok') return STAY;
      let best: { action: Action; value: number } | null = null;
      for (const [dx, dy] of STEPS) {
        const action: Action = { type: 'step', dx, dy };
        if (legality(state, action) !== 'ok') continue;
        const value = score(state, applyAction(state, action).state);
        if (!best || value > best.value) best = { action, value };
      }
      return best ? best.action : { type: 'zoom' };
    },
  };
}
