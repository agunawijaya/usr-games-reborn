import type { Rank } from '@usr-games/kit/cards';
import type { Chance } from '../chance';
import type { SeatEvent } from '../events';
import type { Ask } from '../game';
import { RARE_NUMBER, RARE_ODDS } from '../rules';
import {
  anyOpponent,
  askableSeats,
  type Mind,
  type MindName,
  type Peek,
  rankCounts,
  type SeatView,
} from './mind';

/**
 * The Berkeley computer's two minds, ported from `compmove` and `promove` in fish.c (Muffy
 * Barkocy, 1990, 1993; BSD licence, see CREDITS.md). With one opponent every choice and every
 * random number matches the C program; the faithfulness test replays thousands of its games.
 *
 * - **Rotation** (Otto, the original's normal mode): ask for the next rank after the last one
 *   asked, round and round, skipping ranks not in hand. The count starts at the ace, so the
 *   very first ask is a two whenever a two is held, and the ace comes last.
 * - **Pro** (Hazel, typing `p`): first ask back a rank somebody asked for, if one is held now;
 *   else one time in three ask for the biggest group; else (in Classic only) one time in 1024
 *   look at the opponent's hand; else the first rank held that has not been asked for since the
 *   list was last wiped.
 *
 * With more opponents the minds stay the same and choose whom to ask: the most recent asker of
 * a remembered rank, otherwise anyone with cards.
 */
export class BerkeleyMind implements Mind {
  readonly name: MindName;
  readonly seat: number;
  private pro: boolean;
  private readonly allowedToPeek: boolean;
  /** The original's `lmove`: the rank index asked last, starting at the ace. */
  private lastAsked = 0;
  /** The original's `asked[]`: ranks asked for since the list was last wiped (pro mode). */
  private readonly asked = new Array<boolean>(13).fill(false);
  /** The original's `userasked[]`, kept per seat: when each seat last asked for each rank. */
  private readonly remembered = new Map<number, number[]>();
  private clock = 0;

  constructor(seat: number, options: { pro: boolean; peeks?: boolean; name?: MindName }) {
    this.seat = seat;
    this.pro = options.pro;
    this.allowedToPeek = options.peeks ?? false;
    this.name = options.name ?? (options.pro ? 'hazel' : 'otto');
  }

  get isPro(): boolean {
    return this.pro;
  }

  /** Typing `p` in the original: memory switched on for the rest of the game. */
  turnPro(): void {
    this.pro = true;
  }

  observe(event: SeatEvent): void {
    // The original noted every rank the player asked for, in either mode.
    if (event.kind === 'ask' && event.asker !== this.seat) {
      this.rememberedBy(event.asker)[event.rank - 1] = ++this.clock;
    }
  }

  choose(view: SeatView, chance: Chance, peek?: Peek): Ask {
    const counts = rankCounts(view.hand);
    if (view.hand.length === 0) throw new Error(`seat ${this.seat} has no cards to ask with`);
    const pick = this.pro
      ? this.proChoice(view, counts, chance, this.allowedToPeek ? peek : undefined)
      : { index: this.nextInRotation(counts), target: null };
    this.lastAsked = pick.index;
    this.asked[pick.index] = true;
    return { target: pick.target ?? anyOpponent(view, chance), rank: (pick.index + 1) as Rank };
  }

  private nextInRotation(counts: readonly number[]): number {
    let index = this.lastAsked;
    do index = (index + 1) % 13;
    while (counts[index] === 0);
    return index;
  }

  private proChoice(
    view: SeatView,
    counts: readonly number[],
    chance: Chance,
    peek: Peek | undefined,
  ): { index: number; target: number | null } {
    const askBack = this.askBack(view, counts);
    if (askBack) return askBack;

    if (chance.below(3) === 1) return { index: biggestGroup(counts), target: null };

    if (peek && chance.below(RARE_ODDS) === RARE_NUMBER) {
      const spied = spiedRank(view, counts, peek);
      if (spied) return spied;
    }

    for (;;) {
      const fresh = counts.findIndex((count, index) => count > 0 && !this.asked[index]);
      if (fresh >= 0) return { index: fresh, target: null };
      this.asked.fill(false);
    }
  }

  /** The lowest rank held that somebody asked for, put to whoever asked for it most recently. */
  private askBack(
    view: SeatView,
    counts: readonly number[],
  ): { index: number; target: number } | null {
    const askable = new Set(askableSeats(view));
    for (let index = 0; index < 13; index++) {
      if (counts[index] === 0) continue;
      let target = -1;
      let when = 0;
      for (const [seat, times] of this.remembered) {
        if (askable.has(seat) && times[index]! > when) {
          when = times[index]!;
          target = seat;
        }
      }
      if (target >= 0) {
        this.rememberedBy(target)[index] = 0;
        return { index, target };
      }
    }
    return null;
  }

  private rememberedBy(seat: number): number[] {
    let times = this.remembered.get(seat);
    if (!times) {
      times = new Array<number>(13).fill(0);
      this.remembered.set(seat, times);
    }
    return times;
  }
}

/** The lowest rank among those held in the greatest number. */
function biggestGroup(counts: readonly number[]): number {
  let best = -1;
  counts.forEach((count, index) => {
    if (count > 0 && (best < 0 || count > counts[best]!)) best = index;
  });
  return best;
}

/** The original's rare cheat: the lowest rank both it and an opponent hold. */
function spiedRank(
  view: SeatView,
  counts: readonly number[],
  peek: Peek,
): { index: number; target: number } | null {
  for (let index = 0; index < 13; index++) {
    if (counts[index] === 0) continue;
    for (const seat of askableSeats(view)) {
      if (peek.handOf(seat).some((card) => card % 13 === index)) return { index, target: seat };
    }
  }
  return null;
}
