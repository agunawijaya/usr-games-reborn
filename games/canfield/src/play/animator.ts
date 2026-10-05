import { type CardId, KING, rankOf, suitOf } from '@usr-games/kit/cards';
import type { Layout, RuleEvent } from '../engine/rules';
import type { BloomState } from '../render/bloom';
import type { Pose } from '../render/card-draw';
import type { Flight, TableView } from '../render/table-view';
import type { TableSound } from './sound';

/**
 * Turns what the rules did into what the table shows: each event becomes cards in flight,
 * one after another, and each card landing home opens a petal of its foundation's lotus. The
 * rules have already moved on; the animator only decides when each card arrives.
 */

interface Cue {
  at: number;
  play: () => void;
}

/** Seconds each kind of flight takes, and how far apart events start. */
const TIMING = {
  home: { flight: 0.34, step: 0.11, arc: 0.2 },
  build: { flight: 0.26, step: 0.1, arc: 0.08 },
  deal: { flight: 0.3, step: 0.2, arc: 0.14 },
  turnOver: { flight: 0.38, step: 0.42, arc: 0.1 },
  drop: { flight: 0.14, step: 0.06, arc: 0 },
} as const;

export function bloomsOf(layout: Layout, openedAt = -100): BloomState[] {
  return [0, 1, 2, 3].map((i) => {
    const pile = layout.foundations[i];
    if (!pile) return { suit: null, count: 0, openedAt: [], wrappedAt: null, fullAt: null };
    const wrapped = pile.some(
      (card, k) => k > 0 && rankOf(card) === 1 && rankOf(pile[k - 1]!) === KING,
    );
    return {
      suit: suitOf(pile[0]!),
      count: pile.length,
      openedAt: pile.map(() => openedAt),
      wrappedAt: wrapped ? openedAt : null,
      fullAt: null,
    };
  });
}

export class Animator {
  private flights: Flight[] = [];
  private cues: Cue[] = [];
  /** The top card of each foundation as its petals stand: the last card that landed there. */
  private tops: (CardId | undefined)[] = [];
  blooms: BloomState[] = [];

  constructor(
    private readonly view: TableView,
    layout: Layout,
    private readonly sound: TableSound,
  ) {
    this.reset(layout);
  }

  /** Where a card lies in a layout, as the table draws it. */
  poseOf(layout: Layout, card: CardId): Pose {
    const t = this.view.table;
    const at = (rect: { x: number; y: number }, faceUp: boolean): Pose => ({
      x: rect.x,
      y: rect.y,
      faceUp,
    });
    if (layout.stock.includes(card)) return at(t.reserve, true);
    if (layout.talon.includes(card)) return at(t.talon, true);
    if (layout.hand.includes(card)) return at(t.hand, false);
    const f = layout.foundations.findIndex((pile) => pile.includes(card));
    if (f >= 0) return at(t.foundations[f]!, true);
    for (let i = 0; i < 4; i++) {
      const pile = layout.tableau[i]!;
      const depth = pile.indexOf(card);
      if (depth >= 0) return at(this.view.tableauCard(i, depth, pile.length), true);
    }
    return at(t.reserve, true);
  }

  private fly(
    card: CardId,
    from: Pose,
    to: Pose,
    start: number,
    kind: keyof typeof TIMING,
    motion: boolean,
  ): number {
    const timing = TIMING[kind];
    const duration = motion ? timing.flight : 0.001;
    this.flights.push({
      card,
      from,
      to,
      start,
      duration,
      arc: motion ? timing.arc * this.view.table.card.h : 0,
      flips: from.faceUp !== to.faceUp,
      layer: 'over',
    });
    return start + duration;
  }

  private cue(at: number, play: () => void): void {
    this.cues.push({ at, play });
  }

  /**
   * Schedules the flights for one step of play, from `before` to `after`. Cards the player
   * dropped start from where they let go. Returns when the last card lands.
   */
  play(
    before: Layout,
    after: Layout,
    events: readonly RuleEvent[],
    now: number,
    motion: boolean,
    dropped?: { cards: readonly CardId[]; corner: { x: number; y: number }; step: number },
  ): number {
    let cursor = now;
    let last = now;
    // Where each card is as the step unfolds: it starts where `before` had it.
    const where = new Map<CardId, Pose>();
    const from = (card: CardId) => where.get(card) ?? this.poseOf(before, card);
    if (dropped)
      dropped.cards.forEach((card, i) =>
        where.set(card, {
          x: dropped.corner.x,
          y: dropped.corner.y + i * dropped.step,
          faceUp: true,
        }),
      );
    const kindAfterDrop = (card: CardId, normal: keyof typeof TIMING) =>
      dropped?.cards.includes(card) ? 'drop' : normal;

    for (const event of events) {
      switch (event.kind) {
        case 'home': {
          const card = event.card;
          const to = this.poseOf(after, card);
          const kind = kindAfterDrop(card, 'home');
          const lands = this.fly(card, from(card), to, cursor, kind, motion);
          where.set(card, to);
          this.openPetal(event.foundation, card, lands);
          last = Math.max(last, lands);
          cursor += motion ? TIMING[kind].step : 0;
          break;
        }
        case 'built': {
          event.cards.forEach((card, i) => {
            const to = this.poseOf(after, card);
            const kind = kindAfterDrop(card, 'build');
            const lands = this.fly(
              card,
              from(card),
              to,
              cursor + (motion ? i * 0.03 : 0),
              kind,
              motion,
            );
            where.set(card, to);
            last = Math.max(last, lands);
          });
          this.cue(cursor + (motion ? 0.2 : 0), () => this.sound.place());
          cursor += motion ? TIMING.build.step : 0;
          break;
        }
        case 'dealt': {
          // The three turn over together as one small stack: only the last dealt shows.
          const target = this.view.table.talon;
          for (const card of event.cards) {
            const to = { x: target.x, y: target.y, faceUp: true };
            last = Math.max(last, this.fly(card, from(card), to, cursor, 'deal', motion));
            where.set(card, to);
          }
          this.cue(cursor, () => this.sound.deal(event.cards.length));
          cursor += motion ? TIMING.deal.step : 0;
          break;
        }
        case 'turned-over': {
          const hand = this.view.table.hand;
          // The old talon, top card last so it covers the rest as it turns face down.
          for (const card of before.talon) {
            const to = { x: hand.x, y: hand.y, faceUp: false };
            last = Math.max(last, this.fly(card, from(card), to, cursor, 'turnOver', motion));
            where.set(card, to);
          }
          this.cue(cursor, () => this.sound.turnOver());
          cursor += motion ? TIMING.turnOver.step : 0;
          break;
        }
        default:
          break;
      }
    }
    return last;
  }

  /** Cards dropped where they cannot go glide back to where they were picked up. */
  bounceBack(
    cards: readonly CardId[],
    corner: { x: number; y: number },
    step: number,
    layout: Layout,
    now: number,
    motion: boolean,
  ): void {
    cards.forEach((card, i) => {
      const from = { x: corner.x, y: corner.y + i * step, faceUp: true };
      this.fly(card, from, this.poseOf(layout, card), now, 'build', motion);
    });
  }

  /** A card landing home opens the next petal of its lotus, and turns it at the king-to-ace wrap. */
  private openPetal(foundation: number, card: CardId, at: number): void {
    const bloom = this.blooms[foundation]!;
    const previous = bloom.count > 0 ? this.tops[foundation] : undefined;
    const wrapped = previous !== undefined && rankOf(previous) === KING && rankOf(card) === 1;
    const count = bloom.count + 1;
    this.blooms[foundation] = {
      suit: bloom.suit ?? suitOf(card),
      count,
      openedAt: [...bloom.openedAt, at],
      wrappedAt: wrapped ? at : bloom.wrappedAt,
      fullAt: bloom.fullAt,
    };
    this.tops[foundation] = card;
    const petal = count - 1;
    this.cue(at, () => (wrapped ? this.sound.wrap() : this.sound.home(petal)));
  }

  /** Starts from a layout with no flights: a fresh deal, an undo, a resumed game. */
  reset(layout: Layout, openedAt = -100): void {
    this.flights = [];
    this.cues = [];
    this.blooms = bloomsOf(layout, openedAt);
    this.tops = [0, 1, 2, 3].map((i) => layout.foundations[i]?.at(-1));
  }

  /** Lands every card in the air at once: the player has moved on. */
  settle(now: number): void {
    this.flights = [];
    this.cues = [];
    this.blooms = this.blooms.map((b) => ({
      ...b,
      openedAt: b.openedAt.map((t) => Math.min(t, now)),
      wrappedAt: b.wrappedAt === null ? null : Math.min(b.wrappedAt, now),
    }));
  }

  /** Plays the sounds whose moment has come. */
  tick(now: number): void {
    if (this.cues.length === 0) return;
    const due = this.cues.filter((c) => c.at <= now);
    this.cues = this.cues.filter((c) => c.at > now);
    for (const cue of due) cue.play();
  }

  /** For each card in the air, the one flight to draw now; landed flights are let go. */
  current(now: number): Flight[] {
    this.flights = this.flights.filter((f) => f.start + f.duration > now);
    const seen = new Set<CardId>();
    const shown: Flight[] = [];
    for (const flight of [...this.flights].sort((a, b) => a.start - b.start)) {
      if (seen.has(flight.card)) continue;
      seen.add(flight.card);
      shown.push(flight);
    }
    // Keep the order the flights were made in, so a dealt stack draws its top card last.
    return this.flights.filter((f) => shown.includes(f));
  }

  hidden(now: number): Set<CardId> {
    return new Set(this.flights.filter((f) => f.start + f.duration > now).map((f) => f.card));
  }

  busy(now: number): boolean {
    return this.flights.some((f) => f.start + f.duration > now) || this.cues.length > 0;
  }

  /** The finish: all four lotuses open fully together. */
  bloomAll(at: number): void {
    this.blooms = this.blooms.map((b) => ({ ...b, fullAt: at }));
  }
}
