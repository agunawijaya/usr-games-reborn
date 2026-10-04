import { definePackages } from '@usr-games/kit';

/**
 * Double Cross's twelve packages: six core, four extra, two rare, as the progression model
 * expects. Most of them are about the game's one big idea: giving boxes away on purpose.
 */
export const PACKAGES = definePackages('dab', [
  { id: 'first-box', title: 'First box', description: 'Close your first box.', tier: 'core' },
  {
    id: 'first-double-cross',
    title: 'Double cross',
    description: 'Hand back the last two boxes of a chain on purpose, and keep control.',
    tier: 'core',
  },
  {
    id: 'beat-greedy-gus',
    title: 'Greed is not enough',
    description: 'Beat Greedy Gus, the computer from the 2003 original.',
    tier: 'core',
  },
  {
    id: 'shut-out',
    title: 'Shut-out',
    description: 'Win a game in which your rival closes no box at all.',
    tier: 'core',
  },
  {
    id: 'loop-de-loop',
    title: 'Loop-de-loop',
    description: 'Win a game whose last piece is a loop.',
    tier: 'core',
  },
  {
    id: 'daily-regular',
    title: 'Daily regular',
    description: 'Finish seven Daily Boards.',
    tier: 'core',
  },
  {
    id: 'beat-the-pupil',
    title: 'Top of the class',
    description: 'Beat Berlekamp’s Pupil.',
    tier: 'extra',
  },
  {
    id: 'control-freak',
    title: 'Control freak',
    description: 'Win a game in which your rival had to open every long chain and loop.',
    tier: 'extra',
  },
  {
    id: 'big-board',
    title: 'Big board',
    description: 'Win on a board of 7 × 7 or larger.',
    tier: 'extra',
  },
  {
    id: 'sharing-is-winning',
    title: 'Sharing is winning',
    description: 'Give away four or more boxes with a single line, and still win the game.',
    tier: 'extra',
  },
  {
    id: 'beat-master-4x4',
    title: 'Master class',
    description: 'Beat Master on a board of 4 × 4 or larger.',
    tier: 'rare',
  },
  {
    id: 'puzzle-30',
    title: 'Thirty endgames',
    description: 'Solve thirty endgame puzzles.',
    tier: 'rare',
  },
]);
