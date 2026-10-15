import { type CardId, type Rank, rankOf } from '@usr-games/kit/cards';
import type { SeatEvent } from './events';

/**
 * What one seat can know from watching the table: its own hand exactly, and for everyone else
 * only what the asks, answers and books have shown. It is fed nothing but that seat's view of
 * the events, so it cannot learn a hidden card even by accident. Miso thinks with it, and the
 * notebook shows the player the same picture.
 *
 * For each other seat and rank it keeps:
 * - `known`: cards of that rank the seat is certain to hold (an ask proves at least one; a
 *   handover adds the cards everybody saw change hands);
 * - `noneThen`: when the seat was last shown to hold none (it said "Go Fish!" or handed them
 *   all over), how many unseen cards it has drawn since; `null` when that was never shown.
 */

const RANK_COUNT = 13;

export class Knowledge {
  readonly seat: number;
  private players = 0;
  private known: number[][] = [];
  private noneThen: (number | null)[][] = [];
  private handCounts: number[] = [];
  private mine: number[] = new Array<number>(RANK_COUNT).fill(0);
  private revealed: boolean[] = new Array<boolean>(RANK_COUNT).fill(false);
  private booked: boolean[] = new Array<boolean>(RANK_COUNT).fill(false);
  private pondCount = 0;

  constructor(seat: number) {
    this.seat = seat;
  }

  observe(event: SeatEvent): void {
    switch (event.kind) {
      case 'deal':
        this.players = event.handCounts.length;
        this.handCounts = event.handCounts.slice();
        this.known = event.handCounts.map(() => new Array<number>(RANK_COUNT).fill(0));
        this.noneThen = event.handCounts.map(() => new Array<number | null>(RANK_COUNT).fill(null));
        this.pondCount = 52 - event.handCounts.reduce((sum, n) => sum + n, 0);
        for (const card of event.hand) this.mine[rankOf(card) - 1]!++;
        break;
      case 'ask':
        if (event.asker === this.seat) this.revealed[event.rank - 1] = true;
        else this.holdsAtLeast(event.asker, event.rank, 1);
        break;
      case 'give':
        this.handOver(event.from, event.to, event.rank, event.cards.length);
        break;
      case 'go-fish':
        if (event.target !== this.seat) this.holdsNone(event.target, event.rank);
        break;
      case 'draw':
        this.drawn(event.seat, event.card);
        break;
      case 'book':
        this.bookMade(event.seat, event.rank);
        break;
      default:
        break;
    }
  }

  /** How many of `rank` this seat holds itself. */
  ownCount(rank: Rank): number {
    return this.mine[rank - 1]!;
  }

  /** True once this seat has asked for `rank`, so the table already knows it holds some. */
  hasRevealed(rank: Rank): boolean {
    return this.revealed[rank - 1]!;
  }

  isBooked(rank: Rank): boolean {
    return this.booked[rank - 1]!;
  }

  /** Cards of `rank` that `seat` is certain to hold. */
  knownCount(seat: number, rank: Rank): number {
    return this.known[seat]?.[rank - 1] ?? 0;
  }

  /** `null` unless `seat` was shown to hold none of `rank`; then the unseen draws since. */
  drawsSinceNone(seat: number, rank: Rank): number | null {
    return this.noneThen[seat]?.[rank - 1] ?? null;
  }

  handCount(seat: number): number {
    return this.handCounts[seat] ?? 0;
  }

  get pond(): number {
    return this.pondCount;
  }

  get playerCount(): number {
    return this.players;
  }

  /**
   * The chance that `seat` holds at least one `rank`, from public knowledge alone. Copies of the
   * rank nobody has shown are spread evenly over every unseen card: the pond and each other
   * hand's cards not already accounted for, leaving out hands shown to hold none of it (except
   * for the cards they have drawn since).
   */
  chanceHolds(seat: number, rank: Rank): number {
    if (seat === this.seat || this.isBooked(rank)) return 0;
    if (this.knownCount(seat, rank) > 0) return 1;
    const unseenCopies = this.unseenCopies(rank);
    if (unseenCopies <= 0) return 0;
    const eligible = (other: number) => {
      const slots = this.unseenSlots(other);
      const since = this.drawsSinceNone(other, rank);
      return since === null ? slots : Math.min(slots, since);
    };
    let total = this.pondCount;
    for (let other = 0; other < this.players; other++) {
      if (other !== this.seat) total += eligible(other);
    }
    const mine = eligible(seat);
    if (mine === 0) return 0;
    if (total - mine < unseenCopies) return 1;
    // Hypergeometric: the chance that none of the unseen copies landed in this seat's slots.
    let none = 1;
    for (let k = 0; k < unseenCopies; k++) none *= (total - mine - k) / (total - k);
    return 1 - none;
  }

  /** Copies of `rank` whose place nobody has seen. */
  unseenCopies(rank: Rank): number {
    if (this.isBooked(rank)) return 0;
    let shown = this.ownCount(rank);
    for (let other = 0; other < this.players; other++) {
      if (other !== this.seat) shown += this.knownCount(other, rank);
    }
    return Math.max(0, 4 - shown);
  }

  /** Cards in `seat`'s hand that no ask or handover has accounted for. */
  unseenSlots(seat: number): number {
    let accounted = 0;
    for (let rank = 0; rank < RANK_COUNT; rank++) accounted += this.known[seat]?.[rank] ?? 0;
    return Math.max(0, this.handCount(seat) - accounted);
  }

  private holdsAtLeast(seat: number, rank: Rank, count: number): void {
    const row = this.known[seat]!;
    row[rank - 1] = Math.max(row[rank - 1]!, count);
    this.noneThen[seat]![rank - 1] = null;
  }

  private holdsNone(seat: number, rank: Rank): void {
    this.known[seat]![rank - 1] = 0;
    this.noneThen[seat]![rank - 1] = 0;
  }

  private handOver(from: number, to: number, rank: Rank, count: number): void {
    this.handCounts[from]! -= count;
    this.handCounts[to]! += count;
    if (from === this.seat) this.mine[rank - 1] = 0;
    else this.holdsNone(from, rank);
    if (to === this.seat) this.mine[rank - 1]! += count;
    // The asker held at least one before the handover; everyone saw the rest arrive.
    else this.holdsAtLeast(to, rank, Math.max(1, this.knownCount(to, rank)) + count);
  }

  private drawn(seat: number, card: CardId | null): void {
    this.handCounts[seat]!++;
    this.pondCount--;
    if (seat === this.seat) {
      if (card !== null) this.mine[rankOf(card) - 1]!++;
      return;
    }
    if (card !== null) {
      const rank = rankOf(card);
      this.holdsAtLeast(seat, rank, this.knownCount(seat, rank) + 1);
      return;
    }
    const row = this.noneThen[seat]!;
    for (let rank = 0; rank < RANK_COUNT; rank++) {
      if (row[rank] !== null) row[rank] = row[rank]! + 1;
    }
  }

  private bookMade(seat: number, rank: Rank): void {
    this.booked[rank - 1] = true;
    this.handCounts[seat]! -= 4;
    if (seat === this.seat) this.mine[rank - 1] = 0;
    for (let other = 0; other < this.players; other++) {
      if (other === this.seat) continue;
      this.known[other]![rank - 1] = 0;
      this.noneThen[other]![rank - 1] = 0;
    }
  }
}
