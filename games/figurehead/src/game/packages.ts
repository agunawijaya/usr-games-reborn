import { definePackages } from '@usr-games/kit';

/**
 * Figurehead's packages, the same list as the manifest's: six for a first life, four for a
 * seasoned one, two for a whole story told.
 */
export const PACKAGES = definePackages('figurehead', [
  {
    id: 'maiden-cruise',
    title: 'Maiden cruise',
    description: 'Sail her first chapter to its end.',
    tier: 'core',
  },
  { id: 'first-prize', title: 'Her first prize', description: 'Bring a prize home.', tier: 'core' },
  {
    id: 'raking-fire',
    title: 'Raking fire',
    description: 'Fire a broadside down an enemy’s length.',
    tier: 'core',
  },
  {
    id: 'taken-whole',
    title: 'Taken whole',
    description: 'Take a prize with her hull at half or better.',
    tier: 'core',
  },
  {
    id: 'fair-weather',
    title: 'Fair weather',
    description: 'Win a Today’s Weather.',
    tier: 'core',
  },
  {
    id: 'signal-flying',
    title: 'Signal flying',
    description: 'Hoist a signal to your squadron.',
    tier: 'core',
  },
  { id: 'old-hands', title: 'Old hands', description: 'See her crew become crack.', tier: 'extra' },
  {
    id: 'captain-made',
    title: 'A captain made',
    description: 'Give one of your officers a prize to command.',
    tier: 'extra',
  },
  {
    id: 'brought-home',
    title: 'Brought her home',
    description: 'Take back your own ship.',
    tier: 'extra',
  },
  {
    id: 'bare-poles',
    title: 'Bare poles',
    description: 'Bring down every mast of an enemy ship.',
    tier: 'extra',
  },
  {
    id: 'full-life',
    title: 'A full life',
    description: 'See a ship to her last anchorage.',
    tier: 'rare',
  },
  {
    id: 'best-crew-afloat',
    title: 'The best crew afloat',
    description: 'See her crew become elite.',
    tier: 'rare',
  },
]);
