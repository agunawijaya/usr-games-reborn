// Orchard Crawl — the season. The port's eight looks become eight orchards crawled in order, each
// bringing in one new thing: the full orchard and its frog, fences, the bird, the wasps, a rival
// worm, the gardener, and at Midnight all of them at once. An orchard's harvest is a number of
// apples; once the worm has eaten that many a burrow opens, and crawling into it clears the
// orchard and opens the next. Clearing Midnight ends the season. Pure data and rules; the desk
// (desk.mjs) draws them and the page (index.html) plays them.

import { placeBurrow } from './burrow.mjs';

/**
 * @typedef {'frog' | 'bird' | 'wasps' | 'rival' | 'gardener'} Creature
 * @typedef {{ id: string, theme: string, name: string, brings: string, lead: string,
 *   apples: 'single' | 'pool', fence: string, creatures: readonly Creature[], harvest: number,
 *   points: number, feat: string }} Orchard
 */

/** @type {readonly Orchard[]} */
export const ORCHARDS = [
  {
    id: 'neon-grid',
    theme: 'neon-grid',
    name: 'Neon Grid',
    brings: 'One apple at a time',
    lead: 'The orchard as the terminal drew it in 1980: one numbered apple on the grid, and the next only once you have eaten it. A good place to learn the chain.',
    apples: 'single',
    fence: 'none',
    creatures: [],
    harvest: 10,
    points: 80,
    feat: 'chain',
  },
  {
    id: 'savanna',
    theme: 'savanna',
    name: 'Savanna',
    brings: 'A full orchard, and a frog',
    lead: 'Ten apples at once, ripening in the sun and going over if nobody eats them. Now and then a frog hops through: catch it for fifty points.',
    apples: 'pool',
    fence: 'none',
    creatures: ['frog'],
    harvest: 12,
    points: 120,
    feat: 'frog',
  },
  {
    id: 'river',
    theme: 'river',
    name: 'River',
    brings: 'Fences',
    lead: 'Two long fences run like banks across the water, with a gap in the middle of each. Fences are as hard as the edge of the orchard.',
    apples: 'pool',
    fence: 'corridors',
    creatures: ['frog'],
    harvest: 12,
    points: 140,
    feat: 'short',
  },
  {
    id: 'jungle',
    theme: 'jungle',
    name: 'Jungle',
    brings: 'The thief bird',
    lead: 'A small brown bird lives in the canopy. Every so often it swoops for the biggest ripe apple in sight; get there first and it leaves with nothing.',
    apples: 'pool',
    fence: 'cross',
    creatures: ['frog', 'bird'],
    harvest: 13,
    points: 140,
    feat: 'no-theft',
  },
  {
    id: 'desert',
    theme: 'desert',
    name: 'Desert',
    brings: 'Wasps',
    lead: 'Apples spoil fast in the heat, and an apple left spoiling hatches a wasp that chases your head. Eat the over-ripe ones while you still can.',
    apples: 'pool',
    fence: 'h',
    creatures: ['frog', 'bird', 'wasps'],
    harvest: 13,
    points: 130,
    feat: 'rot',
  },
  {
    id: 'aztec',
    theme: 'aztec',
    name: 'Aztec',
    brings: 'A rival worm',
    lead: 'Another worm crawls these terraces and eats the same apples. Its body is a wall to you, yours is a wall to it, and two heads meeting end both crawls.',
    apples: 'pool',
    fence: 'box',
    creatures: ['frog', 'wasps', 'rival'],
    harvest: 13,
    points: 150,
    feat: 'rival',
  },
  {
    id: 'origami',
    theme: 'origami',
    name: 'Origami',
    brings: 'The gardener',
    lead: 'Now and then the gardener walks in from the far edge and follows the nearest worm for a while, step by step. Keep moving and keep away until the gardener goes.',
    apples: 'pool',
    fence: 'hh',
    creatures: ['frog', 'bird', 'gardener'],
    harvest: 14,
    points: 140,
    feat: 'gardener',
  },
  {
    id: 'midnight',
    theme: 'midnight',
    name: 'Midnight',
    brings: 'Everyone at once',
    lead: 'The last orchard of the season, under the moon: the frog, the bird, the wasps, a rival and the gardener all come out tonight.',
    apples: 'pool',
    fence: 'cross',
    creatures: ['frog', 'bird', 'wasps', 'rival', 'gardener'],
    harvest: 14,
    points: 150,
    feat: 'night',
  },
];

/** @param {string} id */
export function orchardById(id) {
  return ORCHARDS.find((o) => o.id === id) ?? ORCHARDS[0];
}

/** Names of the port's fence layouts, as the desk shows them. */
export const FENCE_NAMES = {
  none: 'open ground',
  h: 'a fence like an H',
  hh: 'two H fences',
  cross: 'a cross of fence',
  box: 'a fenced square with four gates',
  corridors: 'two long fences with gaps',
};

/** What each creature does, in one line. */
export const CREATURE_LINES = {
  frog: 'a frog hops through now and then: catch it for 50',
  bird: 'a bird swoops for the biggest ripe apple',
  wasps: 'a spoiled apple hatches a wasp that chases you',
  rival: 'a rival worm eats the same apples',
  gardener: 'the gardener follows the nearest worm for a while',
};

/**
 * When the creatures come, in milliseconds of the crawl ([soonest, latest] for each first visit and
 * each one after). A crawl in the season lasts a minute or so, where the port's timings were set
 * for crawls that went on until the worm crashed: a frog first came after half a minute, the
 * gardener after most of one. The season brings them in sooner and lets apples spoil sooner.
 */
export const SEASON_TIMING = {
  ripeMs: 14_000,
  hatchMs: 5_000,
  waspLives: 16_000,
  frogFirst: [6_000, 12_000],
  frogEvery: [18_000, 28_000],
  birdFirst: [5_000, 9_000],
  birdEvery: [12_000, 18_000],
  rivalFirst: [3_000, 6_000],
  rivalEvery: [10_000, 16_000],
  gardenerFirst: [9_000, 14_000],
  gardenerEvery: [30_000, 40_000],
  gardenerStays: 18_000,
};

/** The desert's heat: apples go over sooner there. */
const ORCHARD_TIMING = { desert: { ripeMs: 10_000 } };

/**
 * The rules a crawl hands to the page (OrchardGame.begin), in the port's own settings: the mode,
 * the speed, the fence and the creatures, plus the harvest that opens the burrow and the
 * season's timings.
 * @param {Orchard} orchard
 */
export function crawlRules(orchard) {
  const has = (creature) => orchard.creatures.includes(creature);
  return {
    timing: { ...SEASON_TIMING, ...ORCHARD_TIMING[orchard.id] },
    mode: orchard.apples === 'single' ? 'pure' : 'wild',
    speed: 'progressive',
    fence: orchard.fence,
    enemyBird: has('bird'),
    enemyWasps: has('wasps'),
    enemyRival: has('rival'),
    enemyGardener: has('gardener'),
    harvest: orchard.harvest,
    placeBurrow,
  };
}

/**
 * The free orchard: the port's own choices, played as it always played (no harvest, no burrow).
 * @param {{ mode: 'pure' | 'wild', speed: string, fence: string, creatures: readonly string[] }} choice
 */
export function freeRules(choice) {
  const wild = choice.mode === 'wild';
  const has = (creature) => wild && choice.creatures.includes(creature);
  return {
    mode: choice.mode,
    speed: choice.speed,
    fence: choice.fence,
    enemyBird: has('bird'),
    enemyWasps: has('wasps'),
    enemyRival: has('rival'),
    enemyGardener: has('gardener'),
  };
}

/** Orchards open to the player: the first, and every one after a cleared orchard. */
export function openOrchards(cleared) {
  const open = [];
  for (const [index, orchard] of ORCHARDS.entries()) {
    if (index === 0 || cleared.includes(ORCHARDS[index - 1].id)) open.push(orchard.id);
    else break;
  }
  return open;
}

export function seasonComplete(cleared) {
  return ORCHARDS.every((o) => cleared.includes(o.id));
}
