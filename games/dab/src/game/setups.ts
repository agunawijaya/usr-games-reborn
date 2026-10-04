import type { OpponentId } from '../ai/opponents';
import type { Board } from '../engine/board';
import type { MarkId } from '../render/marks';
import type { MatchSpec, Seat } from './match';
import { DAILY, dailyOpening, LADDER, type LadderMatch } from './modes';
import { type Puzzle, PUZZLES, puzzleBoard } from './puzzles';
import { type Rival, RIVALS } from './rivals';
import type { Prefs } from './saves';
import { TUTORIAL, type TutorialStep } from './tutorial';

/** Everything a play screen needs to start a game, whatever the mode. */
export interface PlaySetup {
  readonly spec: MatchSpec;
  /** The computer seat's character, when there is one. */
  readonly rival: Rival | null;
  readonly ladder?: LadderMatch;
  readonly puzzle?: Puzzle;
  readonly tutorial?: { readonly index: number; readonly step: TutorialStep };
  readonly daily?: { readonly number: number; readonly dateKey: string };
}

function you(prefs: Prefs, rivalMark: MarkId | null): Seat {
  // Two players never share a mark: if the rival wears yours, you get the star (or the moon).
  const mark = prefs.mark === rivalMark ? (rivalMark === 'star' ? 'moon' : 'star') : prefs.mark;
  return { kind: 'you', name: 'You', short: 'You', mark };
}

function computer(id: OpponentId): Seat {
  const rival = RIVALS[id];
  return { kind: 'computer', name: rival.name, short: rival.short, mark: rival.mark, opponent: id };
}

export function ladderSetup(number: number, prefs: Prefs, nonce: string): PlaySetup {
  const match = LADDER[number - 1] ?? LADDER[0]!;
  const rival = RIVALS[match.opponent];
  return {
    spec: {
      mode: 'ladder',
      seats: [you(prefs, rival.mark), computer(match.opponent)],
      columns: match.columns,
      rows: match.rows,
      first: match.first,
      lensAllowed: true,
      seed: `ladder:${number}:${nonce}`,
      ladder: number,
    },
    rival,
    ladder: match,
  };
}

export function dailySetup(prefs: Prefs, seed: string, number: number, dateKey: string): PlaySetup {
  const rival = RIVALS[DAILY.opponent];
  const start: Board = dailyOpening(seed);
  return {
    spec: {
      mode: 'daily',
      seats: [you(prefs, rival.mark), computer(DAILY.opponent)],
      start,
      columns: DAILY.columns,
      rows: DAILY.rows,
      first: 0,
      lensAllowed: false,
      seed,
    },
    rival,
    daily: { number, dateKey },
  };
}

export function puzzleSetup(number: number, prefs: Prefs, nonce: string): PlaySetup {
  const puzzle = PUZZLES[number - 1] ?? PUZZLES[0]!;
  const rival = RIVALS.master;
  return {
    spec: {
      mode: 'puzzle',
      seats: [you(prefs, rival.mark), computer('master')],
      start: puzzleBoard(puzzle),
      columns: puzzle.columns,
      rows: puzzle.rows,
      first: 0,
      lensAllowed: true,
      seed: `puzzle:${number}:${nonce}`,
      puzzle: number,
    },
    rival,
    puzzle,
  };
}

export function customSetup(prefs: Prefs, nonce: string): PlaySetup {
  const { columns, rows, opponent, youFirst } = prefs.custom;
  const rival = RIVALS[opponent];
  return {
    spec: {
      mode: 'custom',
      seats: [you(prefs, rival.mark), computer(opponent)],
      columns,
      rows,
      first: youFirst ? 0 : 1,
      lensAllowed: true,
      seed: `custom:${columns}x${rows}:${opponent}:${nonce}`,
    },
    rival,
  };
}

export function localSetup(prefs: Prefs, nonce: string): PlaySetup {
  const { columns, rows, names, marks } = prefs.local;
  const seat = (i: 0 | 1): Seat => ({
    kind: i === 0 ? 'you' : 'friend',
    name: names[i],
    short: names[i],
    mark: marks[i],
  });
  return {
    spec: {
      mode: 'local',
      seats: [seat(0), seat(1)],
      columns,
      rows,
      first: 0,
      lensAllowed: true,
      seed: `local:${nonce}`,
    },
    rival: null,
  };
}

export function tutorialSetup(index: number, prefs: Prefs): PlaySetup {
  const step = TUTORIAL[index] ?? TUTORIAL[0]!;
  const start = step.board();
  const coach: Seat = {
    kind: 'computer',
    name: 'Coach',
    short: 'Coach',
    mark: prefs.mark === 'moon' ? 'star' : 'moon',
    opponent: step.coach,
  };
  return {
    spec: {
      mode: 'tutorial',
      seats: [you(prefs, coach.mark), coach],
      start,
      columns: start.columns,
      rows: start.rows,
      first: 0,
      lensAllowed: false,
      seed: `tutorial:${index}`,
    },
    rival: null,
    tutorial: { index, step },
  };
}
