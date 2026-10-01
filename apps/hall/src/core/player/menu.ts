import type { PauseMenuItem } from '@usr-games/kit';
import { LABELS } from './wording';

/**
 * The pause and results menus in the order the collection's navigation standard fixes for every
 * game: Resume · the game's own items · How to play · Settings · Game menu · Back to the Hall,
 * and Play again (R) · Game menu · Back to the Hall (H).
 */

export type PauseEntryKind = 'resume' | 'game' | 'how-to-play' | 'settings' | 'game-menu' | 'hall';

export interface PauseEntry {
  id: string;
  kind: PauseEntryKind;
  label: string;
  shortcut?: string;
  /** Only for the game's own items. */
  run?: () => void;
}

export function pauseEntries(gameItems: readonly PauseMenuItem[]): PauseEntry[] {
  return [
    { id: 'resume', kind: 'resume', label: LABELS.resume, shortcut: 'Esc' },
    ...gameItems.map((item) => ({
      id: `game:${item.id}`,
      kind: 'game' as const,
      label: item.label,
      ...(item.shortcut ? { shortcut: item.shortcut } : {}),
      run: item.run,
    })),
    { id: 'how-to-play', kind: 'how-to-play', label: LABELS.howToPlay },
    { id: 'settings', kind: 'settings', label: LABELS.settings },
    { id: 'game-menu', kind: 'game-menu', label: LABELS.gameMenu },
    { id: 'hall', kind: 'hall', label: LABELS.back },
  ];
}

export type ResultsAction = 'play-again' | 'game-menu' | 'hall';

export const RESULTS_ACTIONS: readonly { action: ResultsAction; label: string; key?: string }[] = [
  { action: 'play-again', label: LABELS.playAgain, key: 'R' },
  { action: 'game-menu', label: LABELS.gameMenu },
  { action: 'hall', label: LABELS.back, key: 'H' },
];

/** Which results action a key press asks for, if any. */
export function resultsActionForKey(key: string): ResultsAction | null {
  const upper = key.toUpperCase();
  return RESULTS_ACTIONS.find((entry) => entry.key === upper)?.action ?? null;
}
