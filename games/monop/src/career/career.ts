import { BOARD_IDS, BOARDS, type BoardId } from '../boards/themes';
import type { Ledger } from '../engine/ledger';
import type { Preset } from '../engine/types';
import type { DailyRecord } from '../scenarios/daily';

/**
 * The career: what a player has done across every game, the title it earns, and what each title
 * unlocks. Titles come from wins and from the best net worth reached in a full game played
 * without the coach. Nothing is ever taken away, and every game, board and scenario is open from
 * the first visit; titles add tokens and touches on the boards, nothing more.
 */

export type TitleId = 'tenant' | 'landlord' | 'developer' | 'magnate' | 'tycoon';

/** Touches on the boards a title unlocks, each one a switch the player can turn off. */
export type Extra = 'pennants' | 'statue' | 'goldBase' | 'gilded';

export interface Title {
  readonly id: TitleId;
  readonly name: string;
  readonly wins: number;
  /** Best net worth at the end of a Quick or Classic game played without the coach. */
  readonly worth: number;
  /** How many of each board's six tokens are open to the player. */
  readonly tokens: number;
  readonly extra?: Extra;
  readonly line: string;
}

/**
 * Winners of three-player Quick games end worth about 7,400 (median) and 8,800 (the top tenth)
 * against Medium rivals (NOTES.md, "Stage 4"), which sets the worth steps.
 */
export const TITLES: readonly Title[] = [
  {
    id: 'tenant',
    name: 'Tenant',
    wins: 0,
    worth: 0,
    tokens: 3,
    line: 'Everyone starts somewhere: three tokens on every board.',
  },
  {
    id: 'landlord',
    name: 'Landlord',
    wins: 1,
    worth: 0,
    tokens: 4,
    extra: 'pennants',
    line: 'A fourth token, and gold pennants over every flag you fly.',
  },
  {
    id: 'developer',
    name: 'Developer',
    wins: 3,
    worth: 5000,
    tokens: 5,
    extra: 'statue',
    line: 'A fifth token, and a statue of yours in the middle of town.',
  },
  {
    id: 'magnate',
    name: 'Magnate',
    wins: 8,
    worth: 7500,
    tokens: 6,
    extra: 'goldBase',
    line: 'Every token, and yours stands on gold.',
  },
  {
    id: 'tycoon',
    name: 'Tycoon',
    wins: 15,
    worth: 9000,
    tokens: 6,
    extra: 'gilded',
    line: 'A gilded statue and golden flagpoles: the town knows your name.',
  },
];

export interface ScenarioRecord {
  readonly won: boolean;
  /** Fewest turns a win took. */
  readonly bestTurns: number | null;
  readonly tries: number;
}

export interface Career {
  games: number;
  /** Quick and Classic wins, each scenario's first win and each Daily Deal won. */
  wins: number;
  winsByBoard: Record<BoardId, number>;
  bestWorth: number;
  berkeleyWins: number;
  scenarios: Record<string, ScenarioRecord>;
  dailies: Record<string, DailyRecord>;
  /** The token chosen on each board. */
  tokens: Record<BoardId, string>;
  /** Extras the player has turned off. */
  hidden: Extra[];
  /** Packages earned, so the career page can show them. */
  packages: string[];
}

export function emptyCareer(): Career {
  return {
    games: 0,
    wins: 0,
    winsByBoard: { harbour: 0, colony: 0, popup: 0 },
    bestWorth: 0,
    berkeleyWins: 0,
    scenarios: {},
    dailies: {},
    tokens: {
      harbour: BOARDS.harbour.tokens[0]!.id,
      colony: BOARDS.colony.tokens[0]!.id,
      popup: BOARDS.popup.tokens[0]!.id,
    },
    hidden: [],
    packages: [],
  };
}

export function titleOf(career: Career): Title {
  return [...TITLES].reverse().find((t) => career.wins >= t.wins && career.bestWorth >= t.worth)!;
}

export function nextTitle(career: Career): Title | null {
  const index = TITLES.indexOf(titleOf(career));
  return TITLES[index + 1] ?? null;
}

/** The tokens open on a board, in the board's order. */
export function openTokens(career: Career, board: BoardId): readonly string[] {
  return BOARDS[board].tokens.slice(0, titleOf(career).tokens).map((t) => t.id);
}

/** The token the player plays with on a board: their choice, if it is open to them. */
export function tokenFor(career: Career, board: BoardId): string {
  const open = openTokens(career, board);
  return open.includes(career.tokens[board]) ? career.tokens[board] : open[0]!;
}

/** Extras earned so far, whether shown or not. */
export function earnedExtras(career: Career): Extra[] {
  const reached = TITLES.indexOf(titleOf(career));
  return TITLES.slice(0, reached + 1).flatMap((t) => (t.extra ? [t.extra] : []));
}

export function shownExtras(career: Career): Extra[] {
  return earnedExtras(career).filter((extra) => !career.hidden.includes(extra));
}

export type GameKind = 'quick' | 'classic' | 'scenario' | 'daily';

/** One finished game, as the career counts it. */
export interface GameSummary {
  readonly kind: GameKind;
  readonly board: BoardId;
  readonly preset: Preset;
  readonly won: boolean;
  /** The player's net worth at the end. */
  readonly worth: number;
  readonly coached: boolean;
  readonly ledger: Ledger;
  readonly scenario?: string;
  readonly turns: number;
}

/** The career after a game. Pure: the caller saves what it returns. */
export function recordGame(before: Career, game: GameSummary): Career {
  const career: Career = structuredClone(before);
  career.games += 1;
  const firstScenarioWin =
    game.kind === 'scenario' && game.won && !before.scenarios[game.scenario!]?.won;
  const counts =
    game.won &&
    (game.kind === 'quick' || game.kind === 'classic' || game.kind === 'daily' || firstScenarioWin);
  if (counts) {
    career.wins += 1;
    career.winsByBoard[game.board] += 1;
    if (game.preset === 'berkeley') career.berkeleyWins += 1;
  }
  if ((game.kind === 'quick' || game.kind === 'classic') && !game.coached)
    career.bestWorth = Math.max(career.bestWorth, Math.round(game.worth));
  if (game.kind === 'scenario' && game.scenario) {
    const was = before.scenarios[game.scenario];
    const best = was?.bestTurns ?? null;
    career.scenarios[game.scenario] = {
      won: (was?.won ?? false) || game.won,
      bestTurns: game.won ? Math.min(best ?? Infinity, game.turns) : best,
      tries: (was?.tries ?? 0) + 1,
    };
  }
  return career;
}

export function scenariosWon(career: Career): number {
  return Object.values(career.scenarios).filter((s) => s.won).length;
}

export function boardsWon(career: Career): number {
  return BOARD_IDS.filter((board) => career.winsByBoard[board] > 0).length;
}
