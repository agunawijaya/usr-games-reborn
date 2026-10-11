import { definePackages } from '@usr-games/kit';

/**
 * Number Sprint's twelve packages, the same list as the manifest's `packages` (a test keeps them
 * in step). Descriptions invite; none of them asks the player to come back.
 */
export const PACKAGES = definePackages('arithmetic', [
  {
    id: 'perfect-block',
    title: 'Clean twenty',
    description: 'Answer all twenty sums of a block right the first time.',
    tier: 'extra',
  },
  {
    id: 'forgiven',
    title: 'All is forgiven',
    description: 'Practise a number the tutor kept bringing back until it lets it go.',
    tier: 'core',
  },
  {
    id: 'lightning',
    title: 'Lightning',
    description: 'Finish a block in Rush at 1.5 seconds a problem or faster.',
    tier: 'rare',
  },
  {
    id: 'first-split',
    title: 'First split',
    description: 'Break a number all the way down into its primes.',
    tier: 'core',
  },
  {
    id: 'big-split',
    title: 'Six figures',
    description: 'Split a six-digit number.',
    tier: 'core',
  },
  {
    id: 'most-wanted',
    title: 'Most wanted',
    description: 'Split a number from the Most wanted rung.',
    tier: 'rare',
  },
  {
    id: 'clean-sweep',
    title: 'Clean sweep',
    description: 'Clear a sieve without choosing a single number that is not prime.',
    tier: 'core',
  },
  {
    id: 'twin-primes',
    title: 'Twins',
    description: 'Collect ten pairs of twin primes in the album.',
    tier: 'extra',
  },
  {
    id: 'wordsmith',
    title: 'Wordsmith',
    description: 'Spell or read a nine-digit number right.',
    tier: 'extra',
  },
  {
    id: 'fraction-fluent',
    title: 'Fraction fluent',
    description: 'Get five fractions right the first time in Spell It.',
    tier: 'extra',
  },
  {
    id: 'calm-and-collected',
    title: 'Calm and collected',
    description: 'Earn three stars on a chapter played in Calm.',
    tier: 'extra',
  },
  {
    id: 'daily-regular',
    title: 'Regular',
    description: 'Play seven Dailies.',
    tier: 'core',
  },
]);

export type PackageId =
  | 'perfect-block'
  | 'forgiven'
  | 'lightning'
  | 'first-split'
  | 'big-split'
  | 'most-wanted'
  | 'clean-sweep'
  | 'twin-primes'
  | 'wordsmith'
  | 'fraction-fluent'
  | 'calm-and-collected'
  | 'daily-regular';
