// Orchard Crawl — the almanac: a page for each thing the orchards hold, filled in the first time
// you really meet it. Its picture is drawn by the game itself (OrchardGame.portrait). Every word
// is ours. Pure.

/**
 * @typedef {{ id: string, name: string, portrait: string, how: string, note: string,
 *   found: (s: import('./stars.mjs').CrawlSummary) => boolean }} Page
 */

/** @type {readonly Page[]} */
export const PAGES = [
  {
    id: 'apple',
    name: 'Numbered apple',
    portrait: 'apple',
    how: 'Eat an apple.',
    note: 'The number is how much it feeds you: a 7 grows you by seven over the next seven moves, and every bite scores all the growing you still have to do.',
    found: (s) => s.harvested > 0,
  },
  {
    id: 'rotten',
    name: 'Over-ripe apple',
    portrait: 'rotten',
    how: 'Eat an apple that has gone over.',
    note: 'An apple nobody eats for twenty seconds goes dark and soft. It feeds and scores just the same, and eating it is the surest way to keep wasps out of the orchard.',
    found: (s) => s.rottenEaten > 0,
  },
  {
    id: 'frog',
    name: 'Pond frog',
    portrait: 'frog',
    how: 'Catch a frog.',
    note: 'Sits a while, crouches, leaps a cell or two. It never stays long, and it is worth fifty points to a worm quick enough to be where it lands.',
    found: (s) => s.frogs > 0,
  },
  {
    id: 'bird',
    name: 'Thief bird',
    portrait: 'bird',
    how: 'Watch the bird carry off an apple.',
    note: 'It always goes for the biggest ripe apple it can see, and it gives up after eight seconds or as soon as that apple is gone. It never touches a worm.',
    found: (s) => s.stolen > 0,
  },
  {
    id: 'wasp',
    name: 'Wasp',
    portrait: 'wasp',
    how: 'See a wasp hatch from a spoiled apple.',
    note: 'Hatches from an apple left over-ripe for five seconds and makes straight for your head, a little slower than a worm at its slowest. Only one at a time, and none lives past thirty seconds.',
    found: (s) => s.waspsHatched > 0,
  },
  {
    id: 'rival',
    name: 'Rival worm',
    portrait: 'rival',
    how: 'See a rival worm crash.',
    note: 'Plays by your rules: grows by the number it eats, cannot turn back, and crashes into walls, fences, itself and you. Head to head, nobody wins.',
    found: (s) => s.rivalCrashes > 0,
  },
  {
    id: 'gardener',
    name: 'The gardener',
    portrait: 'gardener',
    how: 'Stay out of reach until a gardener goes.',
    note: 'Walks in from the edge farthest from you, follows the nearest worm two and a half cells a second for twenty-five seconds, then goes home for tea. Fences stop the gardener too.',
    found: (s) => s.gardenerSeenOff > 0,
  },
  {
    id: 'burrow',
    name: 'Your burrow',
    portrait: 'burrow',
    how: 'Crawl home.',
    note: 'Opens when the orchard’s harvest is in, somewhere you can reach. Once your head is in, nothing in the orchard can touch you.',
    found: (s) => s.home,
  },
];

/** The pages a crawl adds to the almanac. */
export function pagesFound(summary, found = []) {
  return PAGES.filter((page) => page.found(summary) && !found.includes(page.id)).map((page) => page.id);
}
