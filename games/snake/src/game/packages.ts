import { definePackages } from '@usr-games/kit';

/**
 * Full Pockets' twelve packages, six core, four extra and two rare, as the progression model
 * expects. The hidden one nods to the original, which never let root keep a score (and so the
 * snake always winked at root).
 */
export const PACKAGES = definePackages('snake', [
  {
    id: 'first-glint',
    title: 'First glint',
    description: 'Pick up your first glint.',
    tier: 'core',
  },
  { id: 'banked', title: 'Banked', description: 'Bank a haul at a door.', tier: 'core' },
  { id: 'peek-a-boo', title: 'Peek-a-boo', description: 'Peek twenty times.', tier: 'core' },
  {
    id: 'no-warp-run',
    title: 'Feet on the stones',
    description: 'Bank a run without warping once.',
    tier: 'core',
  },
  {
    id: 'daily-regular',
    title: 'Daily regular',
    description: 'Finish seven Daily Runs.',
    tier: 'core',
  },
  {
    id: 'root-denied',
    title: 'Root denied',
    description:
      'Introduce yourself to the snake as root, the one player the original never let keep a score.',
    tier: 'core',
    hidden: true,
  },
  {
    id: 'lucky-break',
    title: 'Lucky break',
    description: 'Scramble free when the dial lands on your digit.',
    tier: 'extra',
  },
  {
    id: 'winked-at',
    title: 'Winked at',
    description: 'Get caught carrying more than your best haul, and see the wink.',
    tier: 'extra',
  },
  {
    id: 'in-the-red',
    title: 'In the red',
    description: 'End a Classic game owing glints.',
    tier: 'extra',
  },
  {
    id: 'snake-charmer',
    title: 'Snake charmer',
    description: 'Leave a chamber where the snake never came within two squares of you.',
    tier: 'extra',
  },
  {
    id: 'greedy-guts',
    title: 'Greedy guts',
    description: 'Pick up fifteen glints in one chamber.',
    tier: 'rare',
  },
  {
    id: 'deep-pockets',
    title: 'Deep pockets',
    description: 'Bank a haul at the door of the tenth chamber.',
    tier: 'rare',
  },
]);
