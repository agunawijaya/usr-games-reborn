// Talon's Shadow — what the fruit you carry does. Every fruit makes the snake longer, slower and
// slower to turn, and the bird hungrier: it waits less before it locks on and warns for less
// time before it dives. As the 1980 manual put it, the richer you get, the hungrier the hunter.
// Pure numbers; the page applies them.

/**
 * The snake's speed in the collection, in pixels a millisecond: a sixth faster than the port's
 * 0.14, so an empty snake outruns the ground hunters (ADR 0005).
 */
export const BASE_SPEED = 0.165;

export const CARRY = Object.freeze({
  speedPerFruit: 0.025,
  slowest: 0.75,
  turnPerFruit: 0.03,
  stiffest: 0.6,
  growPerFruit: 2,
  longest: 30,
  patiencePerFruit: 0.045,
  hungriest: 0.45,
  lockPerFruit: 0.03,
  shortestLock: 0.65,
  divePerFruit: 0.01,
  quickestDive: 0.92,
});

const scaled = (perFruit, floor, carried) => Math.max(floor, 1 - perFruit * carried);

/**
 * The effects of carrying `carried` fruit, as factors on the port's numbers (and segments to add).
 * @param {number} carried
 */
export function carryEffects(carried) {
  return {
    speed: scaled(CARRY.speedPerFruit, CARRY.slowest, carried),
    turn: scaled(CARRY.turnPerFruit, CARRY.stiffest, carried),
    grow: Math.min(CARRY.longest, CARRY.growPerFruit * carried),
    patience: scaled(CARRY.patiencePerFruit, CARRY.hungriest, carried),
    lock: scaled(CARRY.lockPerFruit, CARRY.shortestLock, carried),
    dive: scaled(CARRY.divePerFruit, CARRY.quickestDive, carried),
  };
}

/** Dives after the field is bare that still keep the fair-dive promise: time to reach an edge. */
export const FAIR_RAVENOUS_DIVES = 3;

/**
 * Once the field is bare the bird is ravenous: it hardly waits and warns briefly. Its first few
 * dives are as fair as ever, so a snake heading for an edge gets there; after that every dive
 * comes quicker than the one before, so staying out in the open ends the flight soon.
 * @param {number} divesSinceBare
 */
export function ravenous(divesSinceBare) {
  const quicker = Math.max(0, divesSinceBare - FAIR_RAVENOUS_DIVES + 1);
  return { patienceMs: 500, lock: 0.6, dive: 0.8 ** quicker };
}

/**
 * The promise the dive keeps until the field is bare, and for its first ravenous dives: a snake
 * keeping straight on, however much it carries, is out of the strike before the talons come down.
 * @param {{ diveMs: number, strikeRadius: number }} tuning
 */
export function diveIsFair(tuning) {
  const slowestHead = BASE_SPEED * CARRY.slowest;
  const quickestDive = tuning.diveMs * CARRY.quickestDive;
  return slowestHead * quickestDive >= tuning.strikeRadius + 3;
}
