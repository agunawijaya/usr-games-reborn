import type { GameResult } from '../contract/contract';
import type { GameInfo } from './rules';

/** Small stand-in catalog for engine tests; the simulations use the full planned collection. */
export const TEST_GAMES: Record<string, GameInfo> = {
  atc: {
    id: 'atc',
    title: 'Air traffic control',
    category: 'arcade',
    sessionMinutes: [5, 15],
    daily: true,
    cronGoals: [
      { id: 'landings', stat: 'planesLanded', label: 'Land {n} planes', min: 15, max: 30 },
    ],
  },
  wump: {
    id: 'wump',
    title: 'Cave hunt',
    category: 'strategy',
    sessionMinutes: [3, 8],
    daily: true,
  },
  fish: { id: 'fish', title: 'Go fish', category: 'cards', sessionMinutes: [5, 10], daily: false },
  hangman: {
    id: 'hangman',
    title: 'Word guess',
    category: 'words',
    sessionMinutes: [2, 5],
    daily: true,
  },
  rain: {
    id: 'rain',
    title: 'Rain screensaver',
    category: 'toys',
    sessionMinutes: [1, 30],
    daily: false,
  },
  adventure: {
    id: 'adventure',
    title: 'Colossal cave',
    category: 'stories',
    sessionMinutes: [20, 60],
    daily: false,
  },
};

export const TEST_CATALOG = Object.values(TEST_GAMES);

export const WIN: GameResult = {
  outcome: 'win',
  score: 100,
  presentation: 'hall',
  durationSeconds: 300,
};
export const LOSS: GameResult = {
  outcome: 'loss',
  score: 10,
  presentation: 'hall',
  durationSeconds: 300,
};
export const QUIT: GameResult = { outcome: 'quit', presentation: 'hall', durationSeconds: 20 };
