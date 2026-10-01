import type { PackageDefinition } from '../achievements/packages';

/**
 * The manifest is everything the Hall knows about a game without loading its code: how it
 * appears in the process list and on its man page, how it is built, and where it came from.
 * It is plain JSON so the build script, the docs script and the Hall all read the same file.
 */

export const CATEGORIES = [
  'arcade',
  'strategy',
  'board',
  'cards',
  'words',
  'numbers',
  'stories',
  'toys',
] as const;

export type Category = (typeof CATEGORIES)[number];
export type Directory = `/usr/games/${Category}`;
export type GameStatus = 'coming-soon' | 'adopting' | 'shipped' | 'unlisted';
export type GameKind = 'native' | 'hosted';

export const GAME_STATUSES: readonly GameStatus[] = [
  'coming-soon',
  'adopting',
  'shipped',
  'unlisted',
];

/**
 * - `native`: TypeScript against the kit contract, compiled together with the Hall.
 * - `hosted-static`: a finished folder copied as is to `dist/play/<id>/`.
 * - `hosted-vite`: the game's own Vite build, run with `base` set to `/play/<id>/`.
 */
export type BuildSpec =
  | { kind: 'native' }
  | { kind: 'hosted-static'; source: string; output: string; entry?: string }
  | { kind: 'hosted-vite'; source: string; output: string; entry?: string };

export interface InspiredBy {
  /** The BSD program name(s), e.g. `atc` or `caesar, rot13, morse`. */
  program: string;
  /** The original's title, trademarks included; shown only in credits, never in UI. */
  originalTitle: string;
  /** How the Hall may name the original on screen. */
  uiTitle: string;
  /** Earliest year we can source (man page copyright or the author's own history). */
  year: number;
}

export interface ManPage {
  /** How to play in one line. */
  synopsis: string;
  description: string;
  /** Related game ids. */
  seeAlso: string[];
}

/**
 * One remappable control: an action the game listens for, its label in Settings, and its
 * default keys (KeyboardEvent.code, `Mouse0`–`Mouse2` or `Pad0`–`Pad16`). Players' changes
 * are stored in the Hall settings and handed back through the kit's input mapping.
 */
export interface ControlBinding {
  action: string;
  label: string;
  keys: string[];
}

/** A game-specific weekly goal the cron job generator may pick, e.g. "Land {n} planes". */
export interface CronGoal {
  id: string;
  /** The key in `GameResult.stats` that counts toward the goal. */
  stat: string;
  /** Copy with `{n}` where the target goes. */
  label: string;
  min: number;
  max: number;
}

export interface GameManifest {
  id: string;
  title: string;
  tagline: string;
  teaser: string;
  category: Category;
  directory: Directory;
  players: { min: number; max: number };
  /** Typical session length, [shortest, longest], in minutes. */
  sessionMinutes: [number, number];
  status: GameStatus;
  /** One brand colour; the Hall derives a legible variant per theme. */
  accent: string;
  /** SVG path data on a 48×48 grid, drawn as a 3px round stroke in the accent colour. */
  emblem: string;
  inspiredBy: InspiredBy;
  daily: boolean;
  kind: GameKind;
  build: BuildSpec;
  manPage: ManPage;
  cronGoals?: CronGoal[];
  /** How to play in up to three short bullets, for the game detail pages. */
  howToPlay?: string[];
  /** The game's remappable controls, listed in Settings. */
  controls?: ControlBinding[];
  /**
   * The game's achievements. Listed here so the man page can show them without loading the
   * game; a native module's `achievements` export must match.
   */
  packages?: PackageDefinition[];
}

export const TAGLINE_MAX = 64;
export const TEASER_MAX = 320;

export function directoryFor(category: Category): Directory {
  return `/usr/games/${category}`;
}

export function hostedOutput(id: string): string {
  return `play/${id}/`;
}

export function averageSessionMinutes(manifest: Pick<GameManifest, 'sessionMinutes'>): number {
  const [shortest, longest] = manifest.sessionMinutes;
  return (shortest + longest) / 2;
}
