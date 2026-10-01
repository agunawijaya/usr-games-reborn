// Sailing-master advice for the human: the same depth-first search the
// computer captains use (sail/dr_2.c:147-156), run on the player's ship.
// Offered in the UI as a suggestion only; the player's helm order is final.

import { maxturns, maxmove, closeon, validateMove } from './movement.js';
import { closestenemy } from './combat.js';
import { snagged } from './state.js';

export function suggestHelm(st, idx) {
  const sp = st.ships[idx];
  if (!sp || sp.dir === 0 || sp.struck || !st.windspeed || snagged(sp) || !sp.specs.crew3) return null;
  const target = closestenemy(st, sp, 0, 0);
  if (!target) return null;
  const { turns } = maxturns(sp);
  const cmd = closeon(st, sp, target, turns, maxmove(st, sp, sp.dir, 0));
  if (!cmd) return { helm: 'd', target: target.index };
  // The driver ignores the drift rule; make sure the advice is legal.
  const v = validateMove(st, sp, cmd);
  return { helm: v.movebuf, target: target.index };
}
