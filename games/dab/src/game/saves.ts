import type { GameContext, SaveSlot } from '@usr-games/kit';
import type { OpponentId } from '../ai/opponents';
import type { MarkId } from '../render/marks';

/** Everything Double Cross keeps on this device, in small versioned slots. */

export interface Prefs {
  /** The mark you leave in your boxes. */
  mark: MarkId;
  /** Start games with the chain lens on, where it is allowed. */
  lens: boolean;
  tutorialDone: boolean;
  /** Custom board, as last set up. */
  custom: { columns: number; rows: number; opponent: OpponentId; youFirst: boolean };
  /** Two players, as last set up. */
  local: { columns: number; rows: number; names: [string, string]; marks: [MarkId, MarkId] };
}

export interface DailyRecord {
  you: number;
  rival: number;
  crosses: number;
}

export interface Records {
  /** Ladder matches won, by number. */
  ladderWon: number[];
  /** Puzzles solved, by number. */
  puzzlesSolved: number[];
  /** The first finished Daily Board of each day: that one counts. */
  dailies: Record<string, DailyRecord>;
  dailyBoards: number;
  games: number;
  wins: number;
  boxes: number;
  crosses: number;
  /** Opponents beaten at least once. */
  beaten: OpponentId[];
}

export interface Saves {
  prefs: SaveSlot<Prefs>;
  records: SaveSlot<Records>;
}

const DAYS_KEPT = 60;

export function openSaves(context: Pick<GameContext, 'save'>): Saves {
  return {
    prefs: context.save<Prefs>({
      key: 'prefs',
      version: 1,
      defaults: () => ({
        mark: 'star',
        lens: false,
        tutorialDone: false,
        custom: { columns: 5, rows: 5, opponent: 'pupil', youFirst: true },
        local: { columns: 4, rows: 4, names: ['Player 1', 'Player 2'], marks: ['star', 'moon'] },
      }),
    }),
    records: context.save<Records>({
      key: 'records',
      version: 1,
      defaults: () => ({
        ladderWon: [],
        puzzlesSolved: [],
        dailies: {},
        dailyBoards: 0,
        games: 0,
        wins: 0,
        boxes: 0,
        crosses: 0,
        beaten: [],
      }),
    }),
  };
}

/** The next ladder match to play: the first not yet won. */
export function nextLadderMatch(records: Records): number {
  for (let n = 1; n <= 10; n++) if (!records.ladderWon.includes(n)) return n;
  return 10;
}

/** Ladder matches open up one at a time: every match up to the first one not yet won. */
export function ladderOpen(records: Records, number: number): boolean {
  return number <= nextLadderMatch(records);
}

/** Keeps a day's first finished Daily Board; returns whether this one was it. */
export function recordDaily(
  records: Records,
  dateKey: string,
  record: DailyRecord,
): { records: Records; first: boolean } {
  if (records.dailies[dateKey]) return { records, first: false };
  const keys = [...Object.keys(records.dailies), dateKey].sort().slice(-DAYS_KEPT);
  const dailies = Object.fromEntries(
    keys.map((k) => [k, k === dateKey ? record : records.dailies[k]!]),
  );
  return { records: { ...records, dailies, dailyBoards: records.dailyBoards + 1 }, first: true };
}
