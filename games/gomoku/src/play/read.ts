import type { GameState, Stone } from '../engine/game';
import { findThreats } from '../engine/threats';
import type { SideIndex, ThreatView } from '../render/view';
import type { Tally } from '../ui/cards';
import { pointName } from './stage';

/** "Read the board" for the screens: the threats as the renderer draws them, and what to say. */

export const sideOf = (stone: Stone): SideIndex => (stone === 'black' ? 0 : 1);
export const stoneOf = (side: SideIndex): Stone => (side === 0 ? 'black' : 'white');

export function threatViews(game: GameState): ThreatView[] {
  return findThreats(game).map((t) => ({
    side: sideOf(t.stone),
    kind: t.kind,
    stones: t.stones,
    spots: t.spots,
  }));
}

export function tally(threats: readonly ThreatView[], side: SideIndex): Tally {
  return {
    threes: threats.filter((t) => t.side === side && t.kind === 'three').length,
    fours: threats.filter((t) => t.side === side && t.kind === 'four').length,
  };
}

/**
 * What your seat says on your turn, from the threats on the board: the most urgent first. With
 * Read the board off, only whose move it is.
 */
export function turnAdvice(
  game: GameState,
  threats: readonly ThreatView[] | null,
  you: SideIndex,
  theirName: string,
): { text: string; point?: string; urgent?: boolean } {
  if (game.moves.length === 0)
    return { text: 'Your move. The first stone usually goes near the middle.' };
  if (!threats) return { text: 'Your move.' };
  const theirs = threats.filter((t) => t.side !== you);
  const mine = threats.filter((t) => t.side === you);
  const myFour = mine.find((t) => t.kind === 'four');
  if (myFour)
    return { text: 'You have a four. Make five at', point: pointName(game.size, myFour.spots[0]!) };
  const theirFour = theirs.find((t) => t.kind === 'four');
  if (theirFour)
    return {
      text: `${theirName} has a four. Block it at`,
      point: pointName(game.size, theirFour.spots[0]!),
      urgent: true,
    };
  if (theirs.some((t) => t.kind === 'three'))
    return {
      text: `${theirName} has an open three. Stop it before it becomes four.`,
      urgent: true,
    };
  if (mine.some((t) => t.kind === 'three'))
    return { text: 'Your open three is live: one more stone makes an open four.' };
  return { text: 'Your move.' };
}
