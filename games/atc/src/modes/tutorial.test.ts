import { describe, expect, it } from 'vitest';
import { applyIntents, planSky } from '../engine/bot';
import { forecast } from '../engine/predict';
import { skyRandomness } from '../engine/randomness';
import { createWorld, findPlane, tick, type World } from '../engine/world';
import { TUTORIAL_ARENA, TUTORIAL_ARRIVALS, TUTORIAL_RULES } from './tutorial';

function tutorialWorld(): World {
  return createWorld(TUTORIAL_ARENA, skyRandomness('tutorial'), TUTORIAL_RULES);
}

describe('the tutorial script', () => {
  it('times c and d to meet over the beacon when nobody steps in', () => {
    const world = tutorialWorld();
    let warned = false;
    while (!world.loss && world.clock < 40) {
      // a and B are flown home by the house controller so that only c and d are left alone.
      const intents = planSky(world).filter((intent) => intent.letter < 2);
      applyIntents(world, intents);
      tick(world);
      const sky = forecast(world);
      if (sky.conflicts.some((c) => c.a + c.b === 5)) warned = true;
    }
    expect(warned).toBe(true);
    expect(world.loss?.reason).toEqual({ kind: 'separation', other: expect.any(Number) });
    const beacon = TUTORIAL_ARENA.beacons[0]!;
    const c = findPlane(world, 2)!;
    expect(Math.abs(c.x - beacon.x)).toBeLessThanOrEqual(1);
  });

  it('can be flown with every plane home', () => {
    const world = tutorialWorld();
    while (!world.loss && world.clock < 120) {
      applyIntents(world, planSky(world, { horizon: 6 }));
      tick(world);
      if (world.safe === TUTORIAL_ARRIVALS.length) break;
    }
    expect(world.loss).toBeNull();
    expect(world.safe).toBe(TUTORIAL_ARRIVALS.length);
  });
});
