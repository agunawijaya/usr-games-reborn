import { simulateShift, type SimResult } from '../engine/sim';
import {
  beforeShiftTick,
  type ShiftDefinition,
  shiftArena,
  shiftRules,
  type Stars,
  starsFor,
} from './shifts';

/** A campaign shift played by the house controller, with the stars it would earn. */
export function simulateCampaignShift(
  shift: ShiftDefinition,
  seed: string,
): SimResult & { stars: Stars } {
  const result = simulateShift(
    shiftArena(shift),
    seed,
    shift.ticks,
    {},
    { rules: shiftRules(shift), beforeTick: (world) => beforeShiftTick(world, shift) },
  );
  const stars = starsFor(shift, {
    completed: result.loss === null && result.ticks >= shift.ticks,
    safe: result.safe,
    nearMisses: result.nearMisses,
    fuelLeft: result.fuelLeft,
  });
  return { ...result, stars };
}
