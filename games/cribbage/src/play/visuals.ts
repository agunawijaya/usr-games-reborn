import type { CardId } from '@usr-games/kit/cards';
import type { Point } from '../render/layout';
import type { SceneCard } from '../render/scene';

/**
 * Card motion by targets: every frame the table says where each card belongs (in a hand, on
 * the pile, in the crib, on the counting stage), and each card glides there from wherever it
 * is, turning over when it should change face. A new card starts from where it came from (the
 * stock, usually) and may wait there a moment, so a deal leaves the deck one card at a time.
 * Under reduced motion cards are simply put in place.
 */

export interface CardTarget {
  card: CardId;
  faceUp: boolean;
  x: number;
  y: number;
  height: number;
  angle?: number;
  lift?: number;
  z: number;
  ring?: SceneCard['ring'];
  gold?: number;
  dim?: boolean;
  /** Where the card appears from if it is not on the table yet. */
  from?: Point;
  /** Clock time before which a newly appearing card stays at `from`. */
  holdUntil?: number;
}

interface Visual {
  x: number;
  y: number;
  height: number;
  angle: number;
  lift: number;
  faceUp: boolean;
  /** 0 when still; counts up to 1 through a turn, the face changing at the half. */
  turning: number;
  turningTo: boolean;
}

const GLIDE_RATE = 13;
const TURN_SECONDS = 0.3;

export class CardVisuals {
  private visuals = new Map<CardId, Visual>();

  clear(): void {
    this.visuals.clear();
  }

  /** Where a card is drawn now, if it is on the table. */
  positionOf(card: CardId): Point | null {
    const visual = this.visuals.get(card);
    return visual ? { x: visual.x, y: visual.y } : null;
  }

  update(targets: readonly CardTarget[], dt: number, now: number, instant: boolean): SceneCard[] {
    const keep = new Set<CardId>();
    const glide = instant ? 1 : 1 - Math.exp(-dt * GLIDE_RATE);
    const drawn: { z: number; card: SceneCard }[] = [];
    for (const target of targets) {
      keep.add(target.card);
      let visual = this.visuals.get(target.card);
      if (!visual) {
        const start = target.from ?? target;
        visual = {
          x: start.x,
          y: start.y,
          height: target.height,
          angle: 0,
          lift: 0,
          faceUp: target.from ? false : target.faceUp,
          turning: 0,
          turningTo: target.faceUp,
        };
        this.visuals.set(target.card, visual);
      }
      const waiting = target.holdUntil !== undefined && now < target.holdUntil && !instant;
      if (!waiting) {
        visual.x += (target.x - visual.x) * glide;
        visual.y += (target.y - visual.y) * glide;
        visual.height += (target.height - visual.height) * glide;
        visual.angle += ((target.angle ?? 0) - visual.angle) * glide;
        visual.lift += ((target.lift ?? 0) - visual.lift) * glide;
      }
      this.turn(visual, target.faceUp, dt, instant || waiting);
      const flip = visual.turning > 0 ? Math.abs(Math.cos(Math.PI * visual.turning)) : 1;
      drawn.push({
        z: target.z,
        card: {
          key: `card:${target.card}`,
          card: visual.faceUp ? target.card : 'back',
          x: visual.x,
          y: visual.y,
          height: Math.round(target.height),
          angle: visual.angle,
          lift: visual.lift + (visual.turning > 0 ? 0.3 * Math.sin(Math.PI * visual.turning) : 0),
          flip,
          ring: target.ring,
          gold: target.gold,
          dim: target.dim,
        },
      });
    }
    for (const card of [...this.visuals.keys()]) if (!keep.has(card)) this.visuals.delete(card);
    return drawn.sort((a, b) => a.z - b.z).map((entry) => entry.card);
  }

  private turn(visual: Visual, faceUp: boolean, dt: number, instant: boolean): void {
    if (instant) {
      visual.faceUp = faceUp;
      visual.turning = 0;
      return;
    }
    if (visual.turning === 0 && visual.faceUp !== faceUp) {
      visual.turning = 0.0001;
      visual.turningTo = faceUp;
    }
    if (visual.turning > 0) {
      const before = visual.turning;
      visual.turning = Math.min(1, visual.turning + dt / TURN_SECONDS);
      if (before < 0.5 && visual.turning >= 0.5) visual.faceUp = visual.turningTo;
      if (visual.turning >= 1) {
        visual.turning = 0;
        visual.faceUp = visual.turningTo;
      }
    }
  }
}
