// Test helpers: build hand-placed positions on top of a real scenario.
import { createGame } from '../src/engine/index.js';

// place(st, idx, row, col, dir)
export function place(st, idx, row, col, dir) {
  Object.assign(st.ships[idx], { row, col, dir });
  return st.ships[idx];
}

// A two-ship duel (Chesapeake vs. Shannon, scenario 13) with the human in the
// Chesapeake (index 0) and full control of position and weather.
export function duel({ seed = 7, wind = [1, 3], me = [10, 10, 1], them = [10, 13, 1], player = 0 } = {}) {
  const st = createGame({ scenarioId: 13, playerShip: player, seed });
  [st.winddir, st.windspeed] = wind;
  st.windchange = 99; // keep the weather steady unless a test wants it
  place(st, 0, ...me);
  place(st, 1, ...them);
  return st;
}

// Remove the "initial broadside" flag so hit numbers are the plain table.
export function plainLoads(sp) {
  sp.readyL &= ~8;
  sp.readyR &= ~8;
}

export const eventsOf = (events, t) => events.filter((e) => e.t === t);
