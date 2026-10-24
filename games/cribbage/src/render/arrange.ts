import type { CardId } from '@usr-games/kit/cards';
import type { GameLength } from '../engine/match';
import { holeFor, type PegDraw, type Side } from './board';
import { CARD, fanPositions, LAYOUT, type Point, showPositions } from './layout';
import type { SceneCard } from './scene';

/**
 * Resting places for everything on the table, as scene pieces. The director starts its
 * animations from these and settles back onto them; the hero scenes use them directly.
 */

export function yourHand(
  cards: readonly CardId[],
  options: {
    selected?: readonly CardId[];
    playable?: readonly CardId[];
    focus?: CardId | null;
  } = {},
): SceneCard[] {
  const fan = fanPositions(cards.length, LAYOUT.centreX, LAYOUT.handY, CARD.hand);
  return cards.map((card, i) => {
    const raised = options.selected?.includes(card) ?? false;
    const focused = options.focus === card;
    const position = fan[i]!;
    return {
      key: `card:${card}`,
      card,
      x: position.x,
      y: position.y - (raised ? 46 : 0) - (focused && !raised ? 14 : 0),
      height: CARD.hand,
      angle: position.angle,
      lift: raised ? 0.7 : focused ? 0.35 : 0,
      dim: options.playable ? !options.playable.includes(card) : false,
    };
  });
}

export function rivalHand(count: number, faces?: readonly CardId[]): SceneCard[] {
  const fan = fanPositions(count, LAYOUT.centreX, LAYOUT.rivalY, CARD.rival, 0.62);
  return fan.map((position, i) => ({
    key: faces ? `card:${faces[i]}` : `rival:${i}`,
    card: faces ? faces[i]! : 'back',
    x: position.x,
    y: position.y,
    height: CARD.rival,
    angle: -position.angle,
  }));
}

/** The cards of the current count, overlapping left to right; earlier counts squared away. */
export function pileCards(
  pile: readonly CardId[],
  playedBefore: readonly CardId[] = [],
): SceneCard[] {
  const turned = playedBefore.map((card, i) => ({
    key: `card:${card}`,
    card: 'back' as const,
    x: LAYOUT.pileStartX - 150 + i * 1.5,
    y: LAYOUT.pileY - i * 1.2,
    height: CARD.pile,
    angle: -0.04,
  }));
  const live = pile.map((card, i) => ({
    key: `card:${card}`,
    card,
    x: LAYOUT.pileStartX + i * LAYOUT.pileStep,
    y: LAYOUT.pileY + (i % 2 === 0 ? 0 : -6),
    height: CARD.pile,
    angle: ((i * 37) % 7) * 0.006 - 0.018,
  }));
  return [...turned, ...live];
}

export function starterCard(card: CardId | null): SceneCard[] {
  if (card === null) return [];
  return [
    {
      key: `card:${card}`,
      card,
      x: LAYOUT.starter.x,
      y: LAYOUT.starter.y,
      height: CARD.stock,
      angle: 0.04,
    },
  ];
}

export function cribCards(count: number, dealer: Side, faces?: readonly CardId[]): SceneCard[] {
  const at = dealer === 0 ? LAYOUT.crib.you : LAYOUT.crib.rival;
  return Array.from({ length: count }, (_, i) => ({
    key: faces ? `card:${faces[i]}` : `crib:${i}`,
    card: faces ? faces[i]! : ('back' as const),
    x: at.x + (i - (count - 1) / 2) * 5,
    y: at.y - i * 2,
    height: CARD.stock,
    angle: -0.08 + i * 0.05,
  }));
}

/** The hand being counted, laid out large; the starter is the last card, a little apart. */
export function showCards(hand: readonly CardId[], starter: CardId, gold = 0): SceneCard[] {
  const cards = [...hand, starter];
  const positions = showPositions(cards.length, LAYOUT.centreX);
  return cards.map((card, i) => ({
    key: `card:${card}`,
    card,
    x: positions[i]!.x,
    y: positions[i]!.y,
    height: CARD.show,
    angle: i === cards.length - 1 ? 0.03 : 0,
    lift: 0.2,
    gold,
  }));
}

export function showPositionMap(hand: readonly CardId[], starter: CardId): Map<CardId, Point> {
  const cards = [...hand, starter];
  const positions = showPositions(cards.length, LAYOUT.centreX);
  return new Map(cards.map((card, i) => [card, positions[i]!]));
}

/** Both players' pegs at rest: the front peg at the score, the back peg at the last score. */
export function restingPegs(
  scores: readonly [number, number],
  backPegs: readonly [number, number],
  length: GameLength,
): PegDraw[] {
  return ([0, 1] as const).flatMap((side) => [
    { side, at: holeFor(side, backPegs[side], length, 0), lift: 0 },
    { side, at: holeFor(side, scores[side], length, scores[side] === 0 ? 1 : 0), lift: 0 },
  ]);
}

/** A peg part-way through a jump from one hole to another: `t` from 0 to 1. */
export function leapingPeg(
  side: Side,
  from: number,
  to: number,
  length: GameLength,
  t: number,
): PegDraw {
  const a = holeFor(side, from, length, 0);
  const b = holeFor(side, to, length, 0);
  const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  // The same curve the dotted trail draws: out to the side of the board, then in.
  const bow = Math.min(60, Math.hypot(b.x - a.x, b.y - a.y) * 0.25) * (side === 0 ? -1 : 1);
  const mid = { x: (a.x + b.x) / 2 + bow, y: (a.y + b.y) / 2 };
  const u = 1 - eased;
  return {
    side,
    at: {
      x: u * u * a.x + 2 * u * eased * mid.x + eased * eased * b.x,
      y: u * u * a.y + 2 * u * eased * mid.y + eased * eased * b.y,
    },
    lift: Math.sin(Math.PI * t),
    trail: t < 1 ? { from: a, to: b } : undefined,
  };
}
