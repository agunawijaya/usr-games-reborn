import type { Rng } from '@usr-games/kit';
import { type CardId, rankOf } from '@usr-games/kit/cards';
import { valueOf } from '../cards';
import { PLAY_LIMIT } from '../peg';
import type { PlayView } from '../match';
import { scoreHand } from '../score';
import { quickDiscard } from './expect';

/**
 * Sharp's play to 31: look ahead to the end of the play. It deals the opponent a plausible
 * hand from the cards it cannot see (respecting every "go" they have said, which proves they
 * held nothing small enough), plays the rest of the play out perfectly for both sides, and
 * repeats for many such hands; the card with the best average wins. Suits never matter in the
 * play, so the search works on ranks alone.
 *
 * Most of the game the aim is the point difference. Near the end it becomes winning: a line
 * that pegs out is worth more than any number of points, and when the play ends the sampled
 * deal is counted through the show in its strict order (non-dealer, dealer, crib), so Sharp
 * knows whether holding back a point lets the opponent count out first.
 */

const PLAY_SAMPLES = 64;
/** Far beyond any point difference a hand can make. */
const WIN = 1000;
/** Within this many holes of the end, someone may finish this hand: play to win. */
const ENDGAME_REACH = 32;

interface Sample {
  hands: [number[], number[]];
  pile: number[];
  target: number;
  endgame: boolean;
  /** The show for this deal: what each side counts, and who counts first. */
  myShow: number;
  theirShow: number;
  crib: number;
  ownCrib: boolean;
}

function valueOfRank(rank: number): number {
  return rank > 10 ? 10 : rank;
}

/** Points for laying `rank` on the pile (fifteen, 31, pairs, runs), without allocating. */
export function playPoints(pile: readonly number[], length: number, rank: number, count: number) {
  const points = count === 15 || count === PLAY_LIMIT ? 2 : 0;
  let same = 1;
  while (same <= length && pile[length - same] === rank) same++;
  if (same > 1) return points + same * (same - 1);
  let low = rank;
  let high = rank;
  let seen = 1 << rank;
  let run = 0;
  for (let back = 1; back <= length; back++) {
    const previous = pile[length - back]!;
    if (seen & (1 << previous)) break;
    seen |= 1 << previous;
    if (previous < low) low = previous;
    if (previous > high) high = previous;
    if (back >= 2 && high - low === back) run = back + 1;
  }
  return points + run;
}

function canMove(hand: readonly number[], count: number): boolean {
  for (const rank of hand) if (rank > 0 && count + valueOfRank(rank) <= PLAY_LIMIT) return true;
  return false;
}

function isEmpty(hand: readonly number[]): boolean {
  for (const rank of hand) if (rank > 0) return false;
  return true;
}

/** After the play: count the show in order and see who, if anyone, finishes first. */
function afterThePlay(sample: Sample, mine: number, theirs: number): number {
  if (!sample.endgame) return mine - theirs;
  const order = sample.ownCrib
    ? [
        [1, sample.theirShow],
        [0, sample.myShow],
        [0, sample.crib],
      ]
    : [
        [0, sample.myShow],
        [1, sample.theirShow],
        [1, sample.crib],
      ];
  for (const [side, points] of order) {
    if (side === 0) mine += points!;
    else theirs += points!;
    if (mine >= sample.target) return WIN + mine - theirs;
    if (theirs >= sample.target) return -WIN + mine - theirs;
  }
  return mine - theirs;
}

/** Adds points to one side; returns the final value when that ends the game, else null. */
function finished(sample: Sample, mine: number, theirs: number): number | null {
  if (!sample.endgame) return null;
  if (mine >= sample.target) return WIN + mine - theirs;
  if (theirs >= sample.target) return -WIN + mine - theirs;
  return null;
}

/**
 * The value of the rest of the play for Sharp (side 0), with `turn` to move, `count` on the
 * table, `length` cards in the current pile, `last` the side that laid the last card (−1 for
 * none yet) and the running scores.
 */
function bestLine(
  sample: Sample,
  turn: number,
  count: number,
  length: number,
  last: number,
  mine: number,
  theirs: number,
): number {
  const { hands, pile } = sample;
  if (isEmpty(hands[0]) && isEmpty(hands[1])) {
    if (count < PLAY_LIMIT && last >= 0) {
      if (last === 0) mine += 1;
      else theirs += 1;
      const over = finished(sample, mine, theirs);
      if (over !== null) return over;
    }
    return afterThePlay(sample, mine, theirs);
  }
  if (count === PLAY_LIMIT) return bestLine(sample, 1 - last, 0, 0, last, mine, theirs);
  const hand = hands[turn as 0 | 1];
  if (!canMove(hand, count)) {
    if (canMove(hands[1 - turn]!, count)) {
      return bestLine(sample, 1 - turn, count, length, last, mine, theirs);
    }
    // Neither can lay a card: one for the go, and the other side leads again from zero.
    if (last === 0) mine += 1;
    else theirs += 1;
    const over = finished(sample, mine, theirs);
    if (over !== null) return over;
    return bestLine(sample, 1 - last, 0, 0, last, mine, theirs);
  }
  let best = turn === 0 ? -Infinity : Infinity;
  let tried = 0;
  for (let i = 0; i < hand.length; i++) {
    const rank = hand[i]!;
    if (rank === 0 || count + valueOfRank(rank) > PLAY_LIMIT) continue;
    // Two cards of one rank play identically: try each rank once.
    if (tried & (1 << rank)) continue;
    tried |= 1 << rank;
    const next = count + valueOfRank(rank);
    const points = playPoints(pile, length, rank, next);
    const myAfter = turn === 0 ? mine + points : mine;
    const theirAfter = turn === 0 ? theirs : theirs + points;
    let value = finished(sample, myAfter, theirAfter);
    if (value === null) {
      hand[i] = 0;
      pile[length] = rank;
      value = bestLine(sample, 1 - turn, next, length + 1, turn, myAfter, theirAfter);
      hand[i] = rank;
    }
    best = turn === 0 ? Math.max(best, value) : Math.min(best, value);
  }
  return best;
}

/** The cards the opponent could be holding, given everything Sharp has seen. */
export function possibleTheirCards(view: PlayView): CardId[] {
  const seen = new Set<CardId>([
    ...view.kept,
    ...view.laidAway,
    view.starter,
    ...view.played.map((entry) => entry.card),
  ]);
  const unseen: CardId[] = [];
  for (let card = 0; card < 52; card++) if (!seen.has(card)) unseen.push(card);
  if (view.theirGoCounts.length === 0) return unseen;
  // Saying go at a count proves every card still held was too big to lay then.
  const tightest = Math.min(...view.theirGoCounts);
  const possible = unseen.filter((card) => tightest + valueOf(card) > PLAY_LIMIT);
  return possible.length >= view.theirCardsLeft ? possible : unseen;
}

function unseenCards(view: PlayView): CardId[] {
  const seen = new Set<CardId>([
    ...view.kept,
    ...view.laidAway,
    view.starter,
    ...view.played.map((entry) => entry.card),
  ]);
  const unseen: CardId[] = [];
  for (let card = 0; card < 52; card++) if (!seen.has(card)) unseen.push(card);
  return unseen;
}

/**
 * A hand the opponent might really be holding: deal them six cards that include everything
 * they have laid so far, let a quick, sensible discard choose the four they
 * would keep, and accept the deal only if it keeps the cards they played and fits every go.
 * Real hands are richer in fives, pairs and neighbours than random ones; after a few tries
 * that fail, a random hand from the possible cards stands in.
 */
export function sampleTheirHand(view: PlayView, rng: Rng, realistic = true): CardId[] {
  const pool = possibleTheirCards(view);
  if (realistic) {
    const theirPlayed = view.played.filter((e) => e.seat !== view.seat).map((e) => e.card);
    const unseen = unseenCards(view);
    const allowed = new Set(pool);
    for (let attempt = 0; attempt < 8; attempt++) {
      const six = [...theirPlayed, ...rng.shuffle(unseen).slice(0, 6 - theirPlayed.length)];
      const thrown = quickDiscard(six, !view.ownCrib);
      const kept = six.filter((card) => !thrown.includes(card));
      if (!theirPlayed.every((card) => kept.includes(card))) continue;
      const left = kept.filter((card) => !theirPlayed.includes(card));
      if (left.length === view.theirCardsLeft && left.every((card) => allowed.has(card)))
        return left;
    }
  }
  return rng.shuffle(pool).slice(0, view.theirCardsLeft);
}

export function isEndgame(view: PlayView): boolean {
  return Math.max(...view.scores) >= view.length - ENDGAME_REACH;
}

export interface RankedPlay {
  card: CardId;
  /** The average outcome over the sampled hands: a point difference, or a win far above it. */
  value: number;
}

/** Every playable card (one per rank), best first, with its average over sampled hands. */
export function rankPlays(
  view: PlayView,
  rng: Rng,
  samples = PLAY_SAMPLES,
  realistic = true,
): RankedPlay[] {
  const playable = view.hand.filter((card) => view.count + valueOf(card) <= PLAY_LIMIT);
  const candidates: CardId[] = [];
  for (const card of [...playable].sort((a, b) => rankOf(a) - rankOf(b))) {
    if (!candidates.some((kept) => rankOf(kept) === rankOf(card))) candidates.push(card);
  }
  if (candidates.length <= 1) return candidates.map((card) => ({ card, value: 0 }));

  const endgame = isEndgame(view);
  const unseen = unseenCards(view);
  const theirPlayed = view.played.filter((entry) => entry.seat !== view.seat).map((e) => e.card);
  const myShow = scoreHand(view.kept, view.starter);
  const totals = candidates.map(() => 0);
  const pileRanks = view.pile.map(rankOf);
  const pile = new Array<number>(16).fill(0);
  for (let s = 0; s < samples; s++) {
    const theirCards = sampleTheirHand(view, rng, realistic);
    let theirShow = 0;
    let crib = 0;
    if (endgame) {
      theirShow = scoreHand([...theirPlayed, ...theirCards], view.starter);
      const spare = rng.shuffle(unseen.filter((card) => !theirCards.includes(card)));
      crib = scoreHand([...view.laidAway, spare[0]!, spare[1]!], view.starter, true);
    }
    const theirs = theirCards.map((card) => rankOf(card) as number);
    candidates.forEach((card, index) => {
      const mine = view.hand.filter((held) => held !== card).map((held) => rankOf(held) as number);
      pileRanks.forEach((rank, i) => (pile[i] = rank));
      const rank = rankOf(card);
      const next = view.count + valueOfRank(rank);
      const points = playPoints(pile, pileRanks.length, rank, next);
      pile[pileRanks.length] = rank;
      const sample: Sample = {
        hands: [mine, [...theirs]],
        pile,
        target: view.length,
        endgame,
        myShow,
        theirShow,
        crib,
        ownCrib: view.ownCrib,
      };
      const myScore = view.scores[0] + points;
      const theirScore = view.scores[1];
      totals[index]! +=
        finished(sample, myScore, theirScore) ??
        bestLine(sample, 1, next, pileRanks.length + 1, 0, myScore, theirScore);
    });
  }
  return candidates
    .map((card, index) => ({ card, value: totals[index]! / samples, index }))
    .sort((a, b) => b.value - a.value || a.index - b.index)
    .map(({ card, value }) => ({ card, value }));
}

/** The card Sharp lays: the best average over sampled opponent hands, played out to the end. */
export function lookaheadPlay(
  view: PlayView,
  rng: Rng,
  samples = PLAY_SAMPLES,
  realistic = true,
): CardId {
  return rankPlays(view, rng, samples, realistic)[0]!.card;
}

/**
 * How the play goes for a kept hand against an opponent's four, both played perfectly with
 * every card known: Sharp's points minus theirs. Used to weigh how well a hand pegs.
 */
export function playedOut(mine: readonly number[], theirs: readonly number[], iLead: boolean) {
  const sample: Sample = {
    hands: [[...mine], [...theirs]],
    pile: new Array<number>(16).fill(0),
    target: Infinity,
    endgame: false,
    myShow: 0,
    theirShow: 0,
    crib: 0,
    ownCrib: !iLead,
  };
  return bestLine(sample, iLead ? 0 : 1, 0, 0, -1, 0, 0);
}
