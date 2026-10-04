import { describe, expect, it } from 'vitest';
import { horizontalEdge, verticalEdge } from '../engine/board';
import { isDoubleCross, Match, type Seat } from './match';
import { TUTORIAL } from './tutorial';

const you: Seat = { kind: 'you', name: 'You', short: 'You', mark: 'star' };
const friend: Seat = { kind: 'friend', name: 'Friend', short: 'Friend', mark: 'moon' };

function doubleCrossBoard(): Match {
  const start = TUTORIAL[4]!.board();
  return new Match({
    mode: 'local',
    seats: [you, friend],
    start,
    columns: start.columns,
    rows: start.rows,
    first: 0,
    lensAllowed: true,
    seed: 'test',
  });
}

describe('a match', () => {
  it('knows a double cross when it sees one', () => {
    const match = doubleCrossBoard();
    const s = match.board;
    match.draw(verticalEdge(s, 0, 1));
    match.draw(verticalEdge(s, 0, 2));
    const cross = match.draw(verticalEdge(s, 0, 4));
    expect(isDoubleCross(cross)).toBe(true);
    expect(cross.handedBack).toHaveLength(2);
    expect(match.stats.crosses).toEqual([1, 0]);
  });

  it('does not call a box left lying about a double cross', () => {
    const match = doubleCrossBoard();
    const s = match.board;
    // A box is there to take, but you draw in the bottom chain instead.
    const turn = match.draw(verticalEdge(s, 1, 2));
    expect(isDoubleCross(turn)).toBe(false);
    expect(turn.handedBack).toEqual([]);
  });

  it('counts the long chains each side had to open', () => {
    const match = doubleCrossBoard();
    const s = match.board;
    for (const edge of [
      verticalEdge(s, 0, 1),
      verticalEdge(s, 0, 2),
      verticalEdge(s, 0, 3),
      verticalEdge(s, 0, 4),
    ]) {
      match.draw(edge);
    }
    const opened = match.draw(verticalEdge(s, 1, 0));
    expect(opened.openedLong).toBe(true);
    expect(match.stats.openedLong).toEqual([1, 0]);
    expect(match.board.scores).toEqual([4, 0]);
    expect(horizontalEdge(s, 0, 0)).toBe(0);
  });
});
