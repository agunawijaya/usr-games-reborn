import type { Arena } from './arena';
import { giveOrder } from './commands';
import { intentsAsOrders, planSky } from './bot';
import { glibcRandom } from './glibc-random';
import { typeLine } from './trace';
import { addPlane, createWorld, tick } from './world';

/**
 * The house controller playing as a 1986 player would: only typed orders, only right-hand
 * circles, from a C-library seed. Returns every order with the tick it was typed before, so the
 * same shift can be replayed by the original program and by Skyloom and compared.
 */
export function botOrders(arena: Arena, seed: number, ticks: number): [number, string][] {
  const draw = glibcRandom(seed);
  let flavour = 0;
  const world = createWorld(arena, { random: draw, rand: draw, flavour: () => flavour++ });
  addPlane(world);
  const typed: [number, string][] = [];
  for (let t = 1; t <= ticks && !world.loss; t++) {
    for (const order of intentsAsOrders(world, planSky(world, { leftHolds: false }))) {
      const state = typeLine(world, order);
      if (state.kind !== 'order') continue;
      giveOrder(world, state.order);
      typed.push([t, order]);
    }
    tick(world);
  }
  return typed;
}
