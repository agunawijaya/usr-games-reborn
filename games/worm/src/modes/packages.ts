import { definePackages } from '@usr-games/kit';
import type { Bite, Game } from '../engine/game';
import type { Tempo } from '../engine/tempo';

/**
 * Noodle Nine's twelve packages (the collection's achievements). Descriptions invite, never
 * demand. The same list is in manifest.json; a test keeps the two in step.
 */
export const PACKAGES = definePackages('worm', [
  { id: 'first-bite', title: 'First bite', description: 'Eat your first number.', tier: 'core' },
  {
    id: 'chain-3',
    title: 'Chain of three',
    description: 'Bite three times without ever finishing your digestion.',
    tier: 'core',
  },
  {
    id: 'fill-the-box',
    title: 'Fill the box',
    description: 'Fill every cell of a fill puzzle with noodle.',
    tier: 'core',
  },
  {
    id: 'daily-regular',
    title: 'Daily regular',
    description: 'Play seven Daily Gardens.',
    tier: 'core',
  },
  {
    id: 'dash-dancer',
    title: 'Dash dancer',
    description: 'Eat a number at the end of a dash.',
    tier: 'extra',
  },
  {
    id: 'count-up',
    title: 'Count-up',
    description: 'Eat one to nine in order.',
    tier: 'extra',
  },
  {
    id: 'night-noodle',
    title: 'Night noodle',
    description: 'Grow the garden that has no light.',
    tier: 'extra',
  },
  {
    id: 'zoomer',
    title: 'Zoomer',
    description: 'Grow a garden with a bite at zoom tempo.',
    tier: 'extra',
  },
  {
    id: 'slowpoke',
    title: 'Slowpoke',
    description: 'Earn all three stars in a garden without ever leaving creep.',
    tier: 'extra',
  },
  {
    id: 'chain-7',
    title: 'Chain of seven',
    description: 'Bite seven times in one chain.',
    tier: 'rare',
  },
  {
    id: 'box-master',
    title: 'Box master',
    description: 'Fill all fifteen fill puzzles.',
    tier: 'rare',
  },
  {
    id: 'ninety-nine',
    title: 'Ninety-nine',
    description: 'Grow a noodle ninety-nine cells long.',
    tier: 'rare',
  },
]);

/** Packages earned by a single bite, shown the moment it happens. */
export function packagesForBite(bite: Bite, game: Game): string[] {
  const ids = ['first-bite'];
  if (bite.chain >= 3) ids.push('chain-3');
  if (bite.chain >= 7) ids.push('chain-7');
  if (bite.dashing) ids.push('dash-dancer');
  if (bite.countUp === 9) ids.push('count-up');
  if (game.body.length + game.growing >= 99) ids.push('ninety-nine');
  return ids;
}

export interface Finish {
  game: Game;
  gardenId: string | null;
  /** All three stars in a garden. */
  threeStars: boolean;
  /** The fastest tempo of any bite this run, and of the bite that grew the garden. */
  fastestTempo: Tempo | null;
  growingTempo: Tempo | null;
  puzzlesFilled: number;
  puzzleCount: number;
  dailiesPlayed: number;
}

/** Packages earned by how a run ended. */
export function packagesAtTheEnd(finish: Finish): string[] {
  const ids: string[] = [];
  const { game } = finish;
  if (finish.dailiesPlayed >= 7) ids.push('daily-regular');
  if (finish.puzzlesFilled >= 1) ids.push('fill-the-box');
  if (finish.puzzlesFilled >= finish.puzzleCount) ids.push('box-master');
  if (game.status === 'grown') {
    if (finish.gardenId === 'night-bed') ids.push('night-noodle');
    if (finish.growingTempo === 'zoom') ids.push('zoomer');
    if (finish.threeStars && finish.fastestTempo === 'creep') ids.push('slowpoke');
  }
  return ids;
}
