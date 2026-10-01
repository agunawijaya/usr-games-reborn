import type { Arena } from './arena';
import { applyIntents, type BotOptions, planSky } from './bot';
import { skyRandomness } from './randomness';
import { addPlane, createWorld, type LossReason, type SkyRules, tick, type World } from './world';

/**
 * Plays one shift with the house controller, for balance checks and the Hall's demo.
 */

export interface SimResult {
  safe: number;
  ticks: number;
  loss: LossReason['kind'] | null;
  nearMisses: number;
  /** Landings on consecutive ticks: the longest run. */
  longestString: number;
  /** Fuel left on arrival as a share of a full tank, averaged over safe planes. */
  fuelLeft: number;
}

export interface SimSetup {
  rules?: SkyRules;
  /** Called before every tick, for shift events such as a change of wind. */
  beforeTick?: (world: World) => void;
}

export function simulateShift(
  arena: Arena,
  seed: string,
  ticks: number,
  options: BotOptions = {},
  setup: SimSetup = {},
): SimResult {
  const world = createWorld(arena, skyRandomness(seed), setup.rules);
  addPlane(world);
  const full = arena.width + arena.height;
  let fuelSum = 0;
  let longest = 0;
  let run = 0;
  let lastLanding = -10;
  for (let t = 0; t < ticks && !world.loss; t++) {
    setup.beforeTick?.(world);
    applyIntents(world, planSky(world, options));
    const fuelBefore = new Map(world.air.map((p) => [p.letter, p.fuel]));
    const events = tick(world);
    for (const event of events) {
      if (event.kind !== 'arrived') continue;
      fuelSum += (fuelBefore.get(event.letter) ?? 0) / full;
      if (event.at.kind !== 'runway') continue;
      run = event.tick === lastLanding + 1 ? run + 1 : event.tick === lastLanding ? run : 1;
      lastLanding = event.tick;
      longest = Math.max(longest, run);
    }
  }
  return {
    safe: world.safe,
    ticks: world.clock,
    loss: world.loss?.reason.kind ?? null,
    nearMisses: world.nearMisses,
    longestString: longest,
    fuelLeft: world.safe ? fuelSum / world.safe : 0,
  };
}
