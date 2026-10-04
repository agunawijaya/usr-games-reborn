// Talon's Shadow — the field book: a page for each region's bird and each region's fruit. A bird
// goes in the book once you have dodged one of its dives, a fruit once you have gathered one.
// Every word is ours. Pure.

import { REGIONS } from './regions.mjs';

/** @type {Readonly<Record<string, { bird: string, fruit: string }>>} */
export const NOTES = {
  savanna: {
    bird: 'Hunts from a high perch over open grass. Its shadow is large and slow: plenty of warning, if you look up.',
    fruit: 'Fat and orange, it ripens in the dry season and rolls where the grass is shortest.',
  },
  river: {
    bird: 'A fisher by trade. It hangs over the water before it drops, which gives a careful snake one long breath.',
    fruit: 'Washed down from the banks, pink and bright against the stones.',
  },
  jungle: {
    bird: 'The heaviest wings in the book. It takes its time, and it does not miss by much.',
    fruit: 'Grown high in the canopy; the ones on the ground are the ones the monkeys dropped.',
  },
  desert: {
    bird: 'Pale against the sand, and impatient in the heat. Expect it sooner than you think.',
    fruit: 'Sweet under its spines. Worth the scratch.',
  },
  'neon-grid': {
    bird: 'The bird the port first drew, in light. It circles, locks on, and dives exactly as it always did.',
    fruit: 'Not a fruit at all, strictly: a glowing orb. It counts all the same.',
  },
  aztec: {
    bird: 'Proud and quick, with talons that cover more ground than you would like.',
    fruit: 'Heavy with seeds, and the colour of the old painted walls.',
  },
  origami: {
    bird: 'Folded from one sheet. It weighs nothing, so it turns on a whim and dives without warning.',
    fruit: 'A paper apple, creased just so. Mind the corners.',
  },
  midnight: {
    bird: 'It hunts by ear. The moon gives you its shadow; very little else will.',
    fruit: 'Dark, with a faint purple light. Gathered by those who know where to look.',
  },
};

/** Every page: two per region. */
export const PAGES = REGIONS.flatMap((region) => [
  { key: `${region.id}/bird`, region, kind: 'bird', name: region.bird, note: NOTES[region.id].bird },
  { key: `${region.id}/fruit`, region, kind: 'fruit', name: region.fruit, note: NOTES[region.id].fruit },
]);

/** The pages a flight adds to the book. */
export function pagesFound(regionId, summary, found) {
  const fresh = [];
  if (summary.dodges > 0 && !found.includes(`${regionId}/bird`)) fresh.push(`${regionId}/bird`);
  if (summary.fruit > 0 && !found.includes(`${regionId}/fruit`)) fresh.push(`${regionId}/fruit`);
  return fresh;
}
