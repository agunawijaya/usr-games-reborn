// Public surface of the headless sail engine. No DOM, no clock, no
// Math.random: everything is a pure function of (state, orders).

export * from './constants.js';
export { SPECS, SCENARIOS } from './data.js';
export { createRng, dieroll, random } from './rng.js';
export {
  createGame, cloneState, capship, glyph, loadLabel, colours, sterncolour, shipLabel, isActive, sideOf,
  snagged, fouled2, grappled2, meleeing, freeSections,
} from './state.js';
export {
  distance, angle, range, gunsbear, portside, relativeBearing,
} from './geometry.js';
export {
  maxturns, maxmove, validateMove, movePrompt, tracePath, pointOfSail, closeon,
} from './movement.js';
export {
  closestenemy, computeHit, fireOptions, rakeInfo, highSeasPenalty, lowerPortsClosed,
} from './combat.js';
export { boardableTargets, isToughmelee } from './boarding.js';
export { resolveTurn, checkEnd, autopilot } from './turn.js';
export { parseCommand, mergeOrders, findShip, FEATURED, STAGED, PLAYABLE } from './commands.js';
