import type { Action } from '../engine/types';
import { eatenClassic, mustTeleportClassic } from './classic-sense';
import type { Mind, RivalProfile } from './types';

/**
 * Mochi plays the original's hidden "stand still" experiment: wait for as long as it is safe,
 * and teleport the moment a robot is next to you. The original stopped when one robot was
 * left and handed it to the human; Mochi keeps napping to the end.
 */
export const MOCHI: RivalProfile = {
  id: 'mochi',
  name: 'Mochi',
  style: 'Naps until a vacuum is right beside her, then zooms.',
  origin: 'The original’s hidden stand-still experiment.',
};

const LOAF: Action = { type: 'wait', mode: 'loaf' };
const ZOOM: Action = { type: 'zoom' };

export function createMochi(): Mind {
  return {
    decide(state) {
      if (eatenClassic(state, state.cat.x, state.cat.y) || mustTeleportClassic(state)) return ZOOM;
      return LOAF;
    },
  };
}
