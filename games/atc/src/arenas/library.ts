import type { Arena } from '../engine/arena';
import { CLASSIC_ARENAS } from './classic';
import { HARBOUR_LIGHTS } from './harbour-lights';
import {
  BEACON_ROW,
  FIRST_LIGHT,
  LANTERN_COAST,
  LONG_REACH,
  MIDNIGHT_TOWER,
  TWO_GATES,
  TWO_TOWNS,
  WINDSOCK,
} from './ours';
import { TWIN_RIVERS } from './twin-rivers';

/** Skyloom's own arenas, in the order the shifts introduce them. */
export const OUR_ARENAS: readonly Arena[] = [
  FIRST_LIGHT,
  TWO_GATES,
  BEACON_ROW,
  TWO_TOWNS,
  TWIN_RIVERS,
  LANTERN_COAST,
  WINDSOCK,
  HARBOUR_LIGHTS,
  LONG_REACH,
  MIDNIGHT_TOWER,
];

/** Every arena Endless offers: the fifteen classics first, then ours. */
export const ENDLESS_ARENAS: readonly Arena[] = [...CLASSIC_ARENAS, ...OUR_ARENAS];

export function arenaById(id: string): Arena | undefined {
  return ENDLESS_ARENAS.find((arena) => arena.id === id);
}

/** Arenas whose classic tick is three seconds or less. */
export function isFast(arena: Arena): boolean {
  return arena.tickSeconds <= 3;
}
