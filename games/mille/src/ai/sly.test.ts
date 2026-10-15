import { describe, expect, it } from 'vitest';
import { legalActions } from '../engine/hand';
import { newMatch, nextDriverAction, step } from '../engine/match';
import { scoreHand } from '../engine/score';

/**
 * Sly searches, so it is slow next to the others; one hand is enough to show it plays only
 * legal moves and replays exactly. Its strength is measured over 2000 games in NOTES.md.
 */

function playHand(seed: string): number[] {
  const match = newMatch({ teams: false, length: 'single', seed, drivers: ['sly', 'classic'] });
  while (!match.hand.over) {
    const action = nextDriverAction(match)!;
    if (action.seat === 0 && action.type !== 'coup') {
      const legal = legalActions(match.hand, 0);
      expect(legal).toContainEqual(action);
    }
    step(match, action);
  }
  const [a, b] = scoreHand(match.hand);
  return [a.total, b.total];
}

describe('Sly', () => {
  it('plays only legal moves and replays exactly from a seed', { timeout: 240_000 }, () => {
    expect(playHand('sly:1')).toEqual(playHand('sly:1'));
  });
});
