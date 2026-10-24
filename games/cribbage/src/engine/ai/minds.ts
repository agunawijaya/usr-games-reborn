import type { Rng } from '@usr-games/kit';
import type { CardId } from '@usr-games/kit/cards';
import type { DiscardView, PlayView } from '../match';
import { canPlay, pegPoints } from '../peg';
import { classicDiscard, classicPlay } from './classic';
import { handAverage, unseenAfter } from './expect';
import { lookaheadPlay } from './lookahead';
import { sharpDiscard } from './sharp';

/**
 * The three opponents. Each sees only what a player at the table could see (`DiscardView`,
 * `PlayView`) and draws any randomness from its own seeded stream, so a game replays exactly.
 *
 * - Beginner keeps a pretty hand about half the time and otherwise throws almost at random; in
 *   the play it takes points when it notices them.
 * - Classic is the Berkeley program's own player, ported card for card (`classic.ts`).
 * - Sharp lays away by the exact average of hand plus or minus crib over every starter and by
 *   how well the hand will peg, and plays each card by looking ahead to the end of the play
 *   against realistic opponent hands (`sharp.ts`, `expect.ts`, `lookahead.ts`).
 */

export type Level = 'beginner' | 'classic' | 'sharp';
export const LEVELS: readonly Level[] = ['beginner', 'classic', 'sharp'];

export interface Mind {
  level: Level;
  layAway(view: DiscardView, rng: Rng): [CardId, CardId];
  play(view: PlayView, rng: Rng): CardId;
}

const beginner: Mind = {
  level: 'beginner',
  layAway(view, rng) {
    const pairs: { thrown: [CardId, CardId]; value: number }[] = [];
    const unseen = unseenAfter(view.hand);
    for (let i = 0; i < view.hand.length - 1; i++) {
      for (let j = i + 1; j < view.hand.length; j++) {
        const kept = view.hand.filter((_, index) => index !== i && index !== j);
        pairs.push({ thrown: [view.hand[i]!, view.hand[j]!], value: handAverage(kept, unseen) });
      }
    }
    if (rng.chance(0.5)) return rng.pick(pairs).thrown;
    // It looks only at its own hand and never thinks about whose crib it is.
    return pairs.reduce((best, pair) => (pair.value > best.value ? pair : best)).thrown;
  },
  play(view, rng) {
    const playable = view.hand.filter((card) => canPlay(card, view.count));
    const scored = playable
      .map((card) => ({ card, points: pegPoints(view.pile, card) }))
      .filter((option) => option.points > 0);
    if (scored.length > 0 && rng.chance(0.6)) {
      return scored.reduce((best, option) => (option.points > best.points ? option : best)).card;
    }
    return rng.pick(playable);
  },
};

const classic: Mind = {
  level: 'classic',
  layAway: (view) => classicDiscard(view.hand, view.ownCrib),
  play: (view) => classicPlay(view.hand, view.pile),
};

const sharp: Mind = {
  level: 'sharp',
  layAway: (view, rng) => sharpDiscard(view, rng),
  play: (view, rng) => lookaheadPlay(view, rng),
};

export const MINDS: Readonly<Record<Level, Mind>> = { beginner, classic, sharp };

export function mindFor(level: Level): Mind {
  return MINDS[level];
}

/** The best card to lay by the coach's reckoning: Sharp's choice, explained by its points. */
export function coachPlay(view: PlayView, rng: Rng): CardId {
  return lookaheadPlay(view, rng, 48);
}
