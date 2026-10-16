import { BOARDS, SEAT_COLOURS, type BoardId } from '../boards/themes';
import type { WorldState } from '../render/world/world';

/**
 * A town some forty turns into a game, for the game menu's backdrop and the Hall's attract
 * mode: four players, most lots owned, two districts built tall and one landmark.
 */

const OWNERS: Readonly<Record<number, readonly number[]>> = {
  0: [6, 8, 9, 21, 23, 24, 15],
  1: [11, 13, 14, 25, 12],
  2: [16, 18, 19, 26, 5, 35],
  3: [1, 3, 31, 32, 34, 28],
};

const LEVELS: Readonly<Record<number, number>> = {
  6: 3,
  8: 3,
  9: 2,
  21: 2,
  23: 2,
  24: 1,
  11: 4,
  13: 4,
  14: 3,
  16: 4,
  18: 4,
  19: 5,
  26: 1,
  1: 2,
  3: 1,
  31: 4,
  32: 4,
  34: 5,
};

export function showcaseTown(board: BoardId, yours?: string): WorldState {
  const owners: (number | null)[] = Array.from({ length: 40 }, () => null);
  const levels = Array.from({ length: 40 }, () => 0);
  for (const [seat, spaces] of Object.entries(OWNERS))
    for (const s of spaces) owners[s] = Number(seat);
  for (const [space, level] of Object.entries(LEVELS)) levels[Number(space)] = level;
  // The player's own token in seat 0, the board's others round the table.
  const all = BOARDS[board].tokens.map((t) => t.id);
  const first = yours && all.includes(yours) ? yours : all[0]!;
  const tokens = [first, ...all.filter((id) => id !== first)].slice(0, 4);
  return {
    owners,
    levels,
    mortgaged: Array.from({ length: 40 }, () => false),
    seatColours: SEAT_COLOURS,
    seatTokens: tokens,
    tokens: [
      { seat: 0, token: tokens[0]!, colour: SEAT_COLOURS[0], at: 12 },
      { seat: 1, token: tokens[1]!, colour: SEAT_COLOURS[1], at: 20 },
      { seat: 2, token: tokens[2]!, colour: SEAT_COLOURS[2], at: 7 },
      { seat: 3, token: tokens[3]!, colour: SEAT_COLOURS[3], at: 29 },
    ],
  };
}
