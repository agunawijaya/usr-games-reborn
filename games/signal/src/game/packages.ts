import { definePackages } from '@usr-games/kit';

/** The fourteen packages, in the order the manifest lists them. */
export const PACKAGES = definePackages('signal', [
  {
    id: 'first-dit',
    title: 'First dit',
    description: 'Tap the telegraph key for one short mark.',
    tier: 'core',
  },
  {
    id: 'first-daw',
    title: 'First daw',
    description: 'Hold the key for a long mark: the old program called it a daw.',
    tier: 'core',
  },
  {
    id: 'morse-20wpm',
    title: 'Twenty a minute',
    description: 'Key a whole message at twenty words a minute or faster, every letter right.',
    tier: 'rare',
  },
  {
    id: 'frequency-sleuth',
    title: 'Frequency sleuth',
    description: 'Crack a turned message with the scope and no other help.',
    tier: 'core',
  },
  {
    id: 'beat-the-machine',
    title: 'Beat the machine',
    description: 'Crack a message that fools the automatic codebreaker.',
    tier: 'extra',
  },
  {
    id: 'card-reader',
    title: 'Card reader',
    description: 'Read a card of ten characters or more without the code chart.',
    tier: 'extra',
  },
  {
    id: 'tape-weaver',
    title: 'Tape weaver',
    description: 'Punch a tape of eight rows or more without a slip.',
    tier: 'extra',
  },
  {
    id: 'banner-day',
    title: 'Banner day',
    description: 'Read a banner before half of it has printed.',
    tier: 'core',
  },
  {
    id: 'squint',
    title: 'Squint',
    description: 'Read a grainy banner printed thirty-three columns wide or narrower.',
    tier: 'extra',
  },
  {
    id: 'flag-reader',
    title: 'Flag reader',
    description: 'Read a message of twenty letters or more from the roof.',
    tier: 'extra',
  },
  {
    id: 'flag-sender',
    title: 'Flag sender',
    description: 'Send a word by flag with no late or wrong letters.',
    tier: 'core',
  },
  {
    id: 'chain-reaction',
    title: 'Chain reaction',
    description: 'Solve a message that runs through more than one machine.',
    tier: 'core',
  },
  {
    id: 'signal-room',
    title: 'The Signal Room',
    description: 'Read every message in all seven chapters.',
    tier: 'rare',
  },
  {
    id: 'daily-regular',
    title: 'Daily regular',
    description: 'Play seven Daily Signals.',
    tier: 'core',
  },
]);

export type PackageId =
  | 'first-dit'
  | 'first-daw'
  | 'morse-20wpm'
  | 'frequency-sleuth'
  | 'beat-the-machine'
  | 'card-reader'
  | 'tape-weaver'
  | 'banner-day'
  | 'squint'
  | 'flag-reader'
  | 'flag-sender'
  | 'chain-reaction'
  | 'signal-room'
  | 'daily-regular';
