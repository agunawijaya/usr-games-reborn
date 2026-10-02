import { definePackages } from '@usr-games/kit';
import type { DartFlight, Expedition, TurnEvent } from '../engine/expedition';

/**
 * Hush the Wumpus's twelve packages (the collection's achievements). Descriptions invite, never
 * demand. The same list is in manifest.json; a test keeps the two in step.
 */
export const PACKAGES = definePackages('wump', [
  {
    id: 'first-hush',
    title: 'First hush',
    description: 'Send your first wumpus to sleep.',
    tier: 'core',
  },
  {
    id: 'bat-taxi',
    title: 'Bat taxi',
    description: 'Ride with the bats three times in one expedition and live to tell it.',
    tier: 'core',
  },
  { id: 'shimmer', title: 'Shimmer', description: 'Step through a magic tunnel.', tier: 'core' },
  {
    id: 'daily-regular',
    title: 'Daily regular',
    description: 'Explore seven Daily Caves.',
    tier: 'core',
  },
  {
    id: 'one-dart-wonder',
    title: 'One-dart wonder',
    description: 'Hush the wumpus with your very first dart.',
    tier: 'extra',
  },
  {
    id: 'scrap-paper',
    title: 'Scrap paper',
    description: 'Hush a wumpus with the Scout assist turned off.',
    tier: 'extra',
  },
  {
    id: 'ledge-grabber',
    title: 'Ledge grabber',
    description: 'Catch the ledge over a pit.',
    tier: 'extra',
  },
  {
    id: 'classic-chaos',
    title: 'Classic chaos',
    description: 'Hush a wumpus under Classic rules, crooked temper and all.',
    tier: 'extra',
  },
  {
    id: 'yobs-wish',
    title: 'Yob’s wish',
    description: 'Hush the wumpus in the cave named for Gregory Yob.',
    tier: 'extra',
  },
  {
    id: 'five-room-thread',
    title: 'Five-room thread',
    description: 'Hush the wumpus with a dart that flies all five rooms.',
    tier: 'rare',
  },
  {
    id: 'lights-out',
    title: 'Lights out',
    description: 'Hush the wumpus in the cave with no map.',
    tier: 'rare',
  },
  {
    id: 'deep-diver',
    title: 'Deep diver',
    description: 'Hush the wumpus at the bottom of the deep cave.',
    tier: 'rare',
  },
]);

/** Packages earned while the expedition is still going: shown the moment they happen. */
export function packagesDuring(expedition: Expedition, events: readonly TurnEvent[]): string[] {
  const ids: string[] = [];
  for (const event of events) {
    if (event.kind === 'ledge' && !expedition.ending) ids.push('ledge-grabber');
    if (event.kind === 'shimmered') ids.push('shimmer');
  }
  if (expedition.batRides >= 3 && !expedition.ending) ids.push('bat-taxi');
  return ids;
}

export interface Finish {
  expedition: Expedition;
  caveId: string | null;
  scout: boolean;
  dartsThrown: number;
  lastFlight: DartFlight | null;
  dailiesPlayed: number;
}

/** Packages earned by how an expedition ended. */
export function packagesAtTheEnd(finish: Finish): string[] {
  const { expedition } = finish;
  const ids: string[] = [];
  if (finish.dailiesPlayed >= 7) ids.push('daily-regular');
  if (expedition.ending?.kind !== 'hushed') return ids;
  ids.push('first-hush');
  if (finish.dartsThrown === 1) ids.push('one-dart-wonder');
  if (!finish.scout) ids.push('scrap-paper');
  if (expedition.rules === 'classic') ids.push('classic-chaos');
  if (
    finish.lastFlight &&
    finish.lastFlight.hops.length === 5 &&
    finish.lastFlight.stop === 'path-end'
  ) {
    ids.push('five-room-thread');
  }
  if (finish.caveId === 'yobs-wish') ids.push('yobs-wish');
  if (finish.caveId === 'darkness') ids.push('lights-out');
  if (finish.caveId === 'deep') ids.push('deep-diver');
  return ids;
}
