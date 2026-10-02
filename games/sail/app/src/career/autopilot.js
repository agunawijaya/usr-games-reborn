// A captain who gives the first lieutenant's counsel every turn (counsel.js), to the end of the
// battle. It proves the Sea Service's actions and each day's engagement can be won; it is never
// shown. Pure and deterministic: the same scenario, ship and seed always play the same battle.

import { createGame, resolveTurn } from '../engine/index.js';
import { counsel } from './counsel.js';
import { createLog, noteTurn } from './logbook.js';

/** @returns {{ st: object, log: object }} */
export function autoplay({ scenarioId, playerShip, seed }) {
  let st = createGame({ scenarioId, playerShip, seed, captain: 'Counsel' });
  const log = createLog(st, playerShip);
  while (!st.over) {
    const advice = counsel(st, playerShip);
    const orders = advice ? advice.orders : {};
    const res = resolveTurn(st, { [playerShip]: orders });
    noteTurn(log, res.events, res.state, playerShip, orders);
    st = res.state;
  }
  return { st, log };
}
