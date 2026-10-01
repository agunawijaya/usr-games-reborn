import { dailyNumber, type DateKey, packageKey } from '@usr-games/kit';
import type { Category } from '@usr-games/kit/manifest';
import type { ProgressionState } from '@usr-games/kit/progression';
import type { CatalogEntry } from '../catalog/catalog';
import type { ProcessRow } from './home-model';

/**
 * Shared vocabulary for the styles that speak in plain words (Console Home, Holo Collection):
 * no PIDs, no paths, no cron expressions. The Machine Room keeps its own Unix wording.
 */

export const CATEGORY_NAMES: Readonly<Record<Category, string>> = {
  arcade: 'Arcade',
  strategy: 'Strategy',
  board: 'Board',
  cards: 'Cards',
  words: 'Words',
  numbers: 'Numbers',
  stories: 'Stories',
  toys: 'Toys',
};

export interface CallToAction {
  label: string;
  /** Whether it starts a game; coming-soon and arriving games are not launchable. */
  launchable: boolean;
  /** Where the button goes. */
  href: string | null;
}

/** The main button for a game: open daily, Continue, Play, or a plain status when it cannot run. */
export function callToAction(row: ProcessRow, today: DateKey): CallToAction {
  const id = row.entry.manifest.id;
  if (row.state === 'S') return { label: 'Coming soon', launchable: false, href: null };
  if (row.state === 'D') return { label: 'Arriving soon', launchable: false, href: null };
  if (row.dailyOpen)
    return { label: `Daily #${dailyNumber(today)}`, launchable: true, href: `#/run/${id}` };
  if (row.lastPlayed) return { label: 'Continue', launchable: true, href: `#/run/${id}` };
  return { label: 'Play', launchable: true, href: `#/run/${id}` };
}

export interface AchievementCount {
  earned: number;
  total: number;
  /** Every achievement earned: the game is mastered. */
  mastered: boolean;
}

export function achievementCount(entry: CatalogEntry, state: ProgressionState): AchievementCount {
  const packages = entry.manifest.packages ?? [];
  const earned = packages.filter((p) => state.packages[packageKey(entry.manifest.id, p.id)]).length;
  return {
    earned,
    total: packages.length,
    mastered: packages.length > 0 && earned === packages.length,
  };
}

/** A game page's link in the plain-word styles. */
export function gameHref(id: string): string {
  return `#/game/${id}`;
}

/** "How to play" bullets: the manifest's own when it has them, else its one-line synopsis. */
export function howToPlay(entry: CatalogEntry): string[] {
  const { howToPlay: bullets, manPage, id } = entry.manifest;
  if (bullets && bullets.length > 0) return bullets;
  // Synopses are written "id — what you do"; plain styles drop the command-name prefix.
  return [
    manPage.synopsis
      .replace(new RegExp(`^${id}\\s*—\\s*`), '')
      .replace(/^./, (c) => c.toUpperCase()),
  ];
}

/** The history of the original in about two sentences. */
export function shortHistory(entry: CatalogEntry): string {
  const { manPage, inspiredBy } = entry.manifest;
  return `${manPage.description} The BSD version it is reborn from is dated ${inspiredBy.year}.`;
}
