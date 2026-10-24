import type { Rng } from '@usr-games/kit';
import { type CardId, rankOf } from '@usr-games/kit/cards';
import type { DiscardView } from '../match';
import { type DiscardOption, quickDiscard, rankDiscards, unseenAfter } from './expect';
import { playedOut } from './lookahead';

/**
 * Sharp's lay-away. First the exact averages: every kept four against all 46 possible
 * starters, plus or minus the crib's exact average (`expect.ts`). Then, for the few best
 * choices, how well each kept hand pegs: it imagines the opponent's hand many times (six
 * unseen cards and the four a sensible player would keep from them) and plays the play out
 * for each, with the non-dealer leading. The choice with the best total wins.
 */

const CANDIDATES = 5;
const OPPONENTS = 24;

export interface WeighedDiscard extends DiscardOption {
  pegging: number;
  total: number;
}

export function weighDiscards(view: DiscardView, rng: Rng): WeighedDiscard[] {
  const options = rankDiscards(view.hand, view.ownCrib).slice(0, CANDIDATES);
  const unseen = unseenAfter(view.hand);
  const opponents: number[][] = [];
  for (let i = 0; i < OPPONENTS; i++) {
    const six = rng.shuffle(unseen).slice(0, 6);
    const thrown = quickDiscard(six, !view.ownCrib);
    opponents.push(six.filter((card) => !thrown.includes(card)).map((card) => rankOf(card)));
  }
  const iLead = !view.ownCrib;
  return options
    .map((option) => {
      const mine = option.kept.map((card) => rankOf(card) as number);
      const pegging =
        opponents.reduce((sum, theirs) => sum + playedOut(mine, theirs, iLead), 0) / OPPONENTS;
      return { ...option, pegging, total: option.value + pegging };
    })
    .sort((a, b) => b.total - a.total);
}

export function sharpDiscard(view: DiscardView, rng: Rng): [CardId, CardId] {
  return weighDiscards(view, rng)[0]!.thrown;
}
