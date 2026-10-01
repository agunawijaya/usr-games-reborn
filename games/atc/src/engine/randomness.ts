import { createRng } from '@usr-games/kit';
import type { Randomness } from './world';

/**
 * Skyloom's own dice: three independent streams from the kit's seeded generator, so what a new
 * plane is, when it comes and its invented flight never disturb each other.
 */
export function skyRandomness(seed: string): Randomness {
  const planes = createRng(`${seed}:planes`);
  const arrivals = createRng(`${seed}:arrivals`);
  const flavour = createRng(`${seed}:flavour`);
  return {
    random: () => planes.nextUint32() >>> 1,
    rand: () => arrivals.nextUint32() >>> 1,
    flavour: () => flavour.nextUint32() >>> 1,
  };
}
