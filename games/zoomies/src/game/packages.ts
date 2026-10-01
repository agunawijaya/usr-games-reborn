import { definePackages } from '@usr-games/kit';

/** Zoomies' achievements ("packages" in the Hall), the same list as the manifest's. */
export const PACKAGES = definePackages('zoomies', [
  {
    id: 'first-bonk',
    title: 'First bonk',
    description: 'Make two vacuums bump into each other.',
    tier: 'core',
  },
  {
    id: 'hallway-tidy',
    title: 'Hallway tidy',
    description: 'Clear the first room of the house.',
    tier: 'core',
  },
  {
    id: 'earned-loaf',
    title: 'Earned loaf',
    description: 'Earn a safe zoom by loafing while a vacuum tangles.',
    tier: 'core',
  },
  {
    id: 'sock-trap',
    title: 'Sock trap',
    description: 'Watch a vacuum choke on a sock.',
    tier: 'core',
  },
  {
    id: 'morning-tidy',
    title: 'Morning tidy',
    description: 'Clear a Today’s Mess room.',
    tier: 'core',
  },
  {
    id: 'night-shift',
    title: 'Night shift',
    description: 'Clear a wave of the Long Night.',
    tier: 'core',
  },
  {
    id: 'right-on-par',
    title: 'Right on par',
    description: 'Clear a room in par turns or fewer.',
    tier: 'extra',
  },
  {
    id: 'top-of-the-class',
    title: 'Top of the class',
    description: 'Clear a room in fewer turns than the Professor.',
    tier: 'extra',
  },
  {
    id: 'jammed-dock',
    title: 'Jammed dock',
    description: 'Get a tangle onto a charging dock.',
    tier: 'extra',
  },
  {
    id: 'domino-day',
    title: 'Domino day',
    description: 'Tangle four vacuums in a single turn.',
    tier: 'extra',
  },
  {
    id: 'spotless',
    title: 'Spotless',
    description: 'Earn all thirty-six stars of the house.',
    tier: 'rare',
  },
  {
    id: 'pattern-prodigy',
    title: 'Pattern prodigy',
    description: 'Write a pattern in the Pattern Lab that scores more than twice Pip’s.',
    tier: 'rare',
  },
]);

export type PackageId = (typeof PACKAGES)[number]['id'];
