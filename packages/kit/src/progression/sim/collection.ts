import type { PackageDefinition, PackageTier } from '../../achievements/packages';
import type { Category } from '../../manifest/manifest';
import type { GameInfo } from '../rules';

/**
 * A model of the planned collection for balance simulations: every catalog id with its
 * directory, typical session length and whether it offers a daily challenge. The Hall's
 * catalog is the source of truth; `scripts/catalog.test.ts` fails if this model drifts from it.
 */
type Row = [id: string, category: Category, shortest: number, longest: number, daily: boolean];

const ROWS: Row[] = [
  ['pom', 'toys', 1, 5, false],
  ['worms', 'toys', 1, 10, true],
  ['rain', 'toys', 1, 10, false],
  // A second interpretation of trek: a native reborn with a career, calls and a nightly watch.
  ['lightkeeper', 'strategy', 10, 25, true],
  ['sail', 'strategy', 15, 40, true],
  // A second interpretation of sail: a native reborn, one ship's life in twelve chapters.
  ['figurehead', 'strategy', 10, 25, true],
  ['trek', 'strategy', 15, 40, true],
  ['hunt', 'arcade', 5, 15, false],
  ['robots', 'arcade', 3, 10, true],
  // A second interpretation of robots: a native reborn with rooms, rivals and a daily mess.
  ['zoomies', 'arcade', 3, 12, true],
  ['battlestar', 'stories', 20, 60, false],
  ['atc', 'arcade', 5, 15, true],
  // A second interpretation of atc: the earlier typed-radar port, with a career and Daily Traffic.
  ['atc-classic', 'arcade', 5, 15, true],
  ['wump', 'strategy', 3, 8, true],
  // A second interpretation of wump: the earlier rune-gate port, with a career and a Daily Delve.
  ['wump-classic', 'strategy', 3, 10, true],
  ['worm', 'arcade', 2, 10, true],
  // A second interpretation of worm: the earlier fancy-web port, with a season and a Daily Orchard.
  ['worm-classic', 'arcade', 2, 12, true],
  ['snake', 'arcade', 3, 10, true],
  // A second interpretation of snake: the earlier fancy-web port, with an expedition and a Daily Flight.
  ['snake-classic', 'arcade', 2, 10, true],
  ['blocks', 'arcade', 3, 12, true],
  // A second interpretation of blocks: the earlier reshaped-well port, with a career and a Daily Shift.
  ['blocks-classic', 'arcade', 3, 15, true],
  ['gomoku', 'board', 5, 15, true],
  ['dab', 'board', 3, 10, true],
  ['backgammon', 'board', 10, 25, false],
  ['monop', 'board', 20, 60, false],
  ['cribbage', 'cards', 10, 20, true],
  ['canfield', 'cards', 5, 15, true],
  ['fish', 'cards', 5, 10, false],
  ['mille', 'cards', 15, 30, false],
  ['pig', 'cards', 2, 5, true],
  ['letters', 'words', 3, 6, true],
  ['hangman', 'words', 2, 5, true],
  ['hangman-classic', 'words', 2, 8, false],
  ['quiz', 'words', 3, 8, true],
  ['arithmetic', 'numbers', 2, 5, true],
  ['signal', 'numbers', 3, 10, true],
  ['adventure', 'stories', 20, 60, false],
  ['hack', 'stories', 15, 60, true],
  ['phantasia', 'stories', 15, 45, false],
];

export const PLANNED_COLLECTION: readonly GameInfo[] = ROWS.map(
  ([id, category, shortest, longest, daily]) => ({
    id,
    title: id,
    category,
    sessionMinutes: [shortest, longest] as const,
    daily,
  }),
);

/** The eight adopted games, the first shipped wave. */
export const FIRST_WAVE_IDS = [
  'pom',
  'worms',
  'rain',
  'sail',
  'trek',
  'hunt',
  'robots',
  'battlestar',
];

const TYPICAL_TIERS: PackageTier[] = [
  'core',
  'core',
  'core',
  'core',
  'core',
  'core',
  'extra',
  'extra',
  'extra',
  'extra',
  'rare',
  'rare',
];

/** Twelve packages per game in the tier mix the game briefs aim for; toys ship six small ones. */
export function modelPackages(game: GameInfo): PackageDefinition[] {
  const tiers = game.category === 'toys' ? TYPICAL_TIERS.slice(0, 6) : TYPICAL_TIERS;
  return tiers.map((tier, index) => ({
    id: `${game.id}-${index + 1}`,
    title: `${game.id} ${index + 1}`,
    description: 'Simulated package.',
    tier,
    ...(game.category === 'toys' ? { xp: 15 } : {}),
  }));
}
