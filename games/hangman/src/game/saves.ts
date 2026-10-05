import type { GameContext, SaveSlot } from '@usr-games/kit';
import type { Tier } from '../engine/difficulty';
import { emptyRecords, type Records } from './records';

/** Everything Before the Tide keeps on this device, in two small versioned slots. */
export type TierChoice = Tier | 'any';

export interface Prefs {
  deck: string;
  tier: TierChoice;
  tutorialDone: boolean;
  duelNames: [string, string];
  duelTurns: number;
}

export interface Saves {
  prefs: SaveSlot<Prefs>;
  records: SaveSlot<Records>;
}

export function defaultPrefs(): Prefs {
  return {
    deck: 'core',
    tier: 'any',
    tutorialDone: false,
    duelNames: ['Player 1', 'Player 2'],
    duelTurns: 2,
  };
}

export function openSaves(context: Pick<GameContext, 'save'>): Saves {
  return {
    prefs: context.save<Prefs>({ key: 'prefs', version: 1, defaults: defaultPrefs }),
    records: context.save<Records>({ key: 'records', version: 1, defaults: emptyRecords }),
  };
}
