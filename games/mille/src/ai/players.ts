import { type Rng, type RngState, createRng, restoreRng } from '@usr-games/kit';
import {
  type Action,
  type HandEvent,
  type HandState,
  HAND_SLOTS,
  canCoup,
  legalActions,
} from '../engine/hand';
import {
  type ClassicMemory,
  classicDeal,
  classicDecide,
  classicObserve,
  newClassicMemory,
} from './classic';
import { slyDecide, slyWantsCoup } from './sly';

/**
 * The three drivers a seat can have. Each keeps its memory and its own random stream in plain
 * data, so a saved game resumes every driver exactly where it was.
 */

export type Level = 'rookie' | 'classic' | 'sly';

export interface Driver {
  level: Level;
  rng: RngState;
  /** Classic's counters; Sly keeps the same ones, since it builds on Classic's judgement. */
  memory: ClassicMemory;
}

export function newDriver(level: Level, seed: string): Driver {
  return { level, rng: createRng(seed).state(), memory: newClassicMemory() };
}

/** Runs `use` with the driver's random stream and saves where the stream got to. */
function withRng<T>(driver: Driver, use: (rng: Rng) => T): T {
  const rng = restoreRng(driver.rng);
  const result = use(rng);
  driver.rng = rng.state();
  return result;
}

export function driverDeal(state: HandState, seat: number, driver: Driver): void {
  classicDeal(state, seat, driver.memory);
}

export function driverObserve(
  state: HandState,
  seat: number,
  events: readonly HandEvent[],
  driver: Driver,
): void {
  classicObserve(state, seat, events, driver.memory);
}

/** The driver's move for its own turn. */
export function driverDecide(state: HandState, seat: number, driver: Driver): Action {
  return withRng(driver, (rng) => {
    switch (driver.level) {
      case 'rookie':
        return rookieDecide(state, seat, rng);
      case 'classic':
        return classicDecide(state, seat, driver.memory, (sides) => rng.int(1, sides));
      case 'sly':
        return slyDecide(state, seat, driver.memory, rng);
    }
  });
}

/** Out of turn, in the team game: the slot of a coup fourré the driver calls, or null. */
export function driverCoup(state: HandState, seat: number, driver: Driver): number | null {
  for (let slot = 0; slot < HAND_SLOTS; slot++) {
    if (!canCoup(state, seat, slot)) continue;
    return withRng(driver, (rng) => {
      if (driver.level === 'rookie') return rng.chance(0.5) ? slot : null;
      if (driver.level === 'sly') return slyWantsCoup(state, seat, slot) ? slot : null;
      return slot;
    });
  }
  return null;
}

/** Rookie: any legal play at random, and only when nothing can be played, a random discard. */
function rookieDecide(state: HandState, seat: number, rng: Rng): Action {
  const actions = legalActions(state, seat).filter((a) => a.type !== 'coup' || state.turn === seat);
  if (state.awaitingExtension) return { type: 'extend', seat, extend: rng.chance(0.5) };
  const opening = actions.filter(
    (a) => a.type === 'draw' || a.type === 'coup' || a.type === 'play',
  );
  if (actions.some((a) => a.type === 'draw')) return rng.pick(opening);
  const plays = actions.filter((a) => a.type === 'play' || a.type === 'coup');
  if (plays.length > 0) return rng.pick(plays);
  return rng.pick(actions);
}
