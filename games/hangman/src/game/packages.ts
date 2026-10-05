import { definePackages } from '@usr-games/kit';

/**
 * Before the Tide's twelve packages: six core, four extra and two rare, the mix the
 * progression model expects. Descriptions invite; none of them demands.
 */
export const PACKAGES = definePackages('hangman', [
  {
    id: 'first-castle',
    title: 'Castle standing',
    description: 'Find your first word before the tide does.',
    tier: 'core',
  },
  {
    id: 'clean-sweep',
    title: 'Not a drop',
    description: 'Find a word without a single wave reaching the castle.',
    tier: 'core',
  },
  {
    id: 'last-wave',
    title: 'One wave short',
    description: 'Find a word with six waves in, when the next would have taken the castle.',
    tier: 'core',
  },
  {
    id: 'long-word',
    title: 'Long shoreline',
    description: 'Find a word of twelve letters.',
    tier: 'core',
  },
  {
    id: 'duelist',
    title: 'Sand duelist',
    description: 'Finish a Duel with a friend.',
    tier: 'core',
  },
  {
    id: 'daily-regular',
    title: 'Morning walker',
    description: 'Play seven Daily Words.',
    tier: 'core',
  },
  {
    id: 'deck-explorer',
    title: 'Beachcomber',
    description: 'Find a word from every deck.',
    tier: 'extra',
  },
  {
    id: 'historian',
    title: 'Punched in',
    description: 'Find ten words from the Computing history deck.',
    tier: 'extra',
  },
  {
    id: 'no-lighthouse',
    title: 'By starlight',
    description: 'Play twenty words in a row without the Lighthouse.',
    tier: 'extra',
  },
  {
    id: 'classic-at-heart',
    title: 'Berkeley sands',
    description: 'Find five Classic words in a row.',
    tier: 'extra',
  },
  {
    id: 'par-golfer',
    title: 'Under par',
    description: 'Keep a tide average under 2 over a beach of ten words or more.',
    tier: 'rare',
  },
  {
    id: 'tide-runner',
    title: 'Ten before the tide',
    description: 'Find all ten words of a Tide run.',
    tier: 'rare',
  },
]);

export type PackageId =
  | 'first-castle'
  | 'clean-sweep'
  | 'last-wave'
  | 'long-word'
  | 'duelist'
  | 'daily-regular'
  | 'deck-explorer'
  | 'historian'
  | 'no-lighthouse'
  | 'classic-at-heart'
  | 'par-golfer'
  | 'tide-runner';
