// Talon's Shadow — the rules of a flight in a region, handed to the page with TalonGame.begin:
// the fence, the harvest, the rivals and what carrying fruit does. The page asks these
// functions at the moments it already knew about (a step of the snake, a new fruit, a lock-on, a
// dive) and keeps everything else the port's.

import { BASE_SPEED, carryEffects, ravenous } from './carry.mjs';
import { LAYOUTS, isClear, pushOut, startFor } from './fences.mjs';
import { makeHunter, stepHunter } from './hens.mjs';
import { makeRival, stepRival } from './rivals.mjs';

/** How long a fruit lies on the field before it withers, if no snake takes it. */
export const FRUIT_LIFE_MS = 24_000;

/** @param {import('./regions.mjs').Region} region */
export function flightRules(region) {
  const fences = LAYOUTS[region.fence] ?? [];
  return {
    fences,
    start: startFor(region.fence),
    harvest: region.harvest,
    fruitLifeMs: FRUIT_LIFE_MS,
    // The edges open only once the field is bare (ADR 0004).
    exitsOnlyWhenBare: true,
    snakeSpeed: BASE_SPEED,
    // A head that runs into another snake's body ends that snake (ADR 0005).
    contactKills: true,
    // Space sheds the tail as a decoy (ADR 0005).
    canShed: true,
    rivals: region.rivals,
    carry: carryEffects,
    ravenous,
    pushOut: (point, radius) => pushOut(point, radius, fences),
    isClear: (x, y, margin) => isClear(x, y, margin, fences),
    makeRival: (index) => makeRival(index, region.rivalSpeed),
    stepRival: (rival, world, dt) => stepRival(rival, { ...world, fences }, dt),
    hunters: region.hunter.count,
    hunterKind: region.id,
    makeHunter: (index) => makeHunter(index, region.hunter.speed, 2500 + index * 4000),
    stepHunter: (hunter, world, dt) => stepHunter(hunter, { ...world, fences }, dt),
  };
}
