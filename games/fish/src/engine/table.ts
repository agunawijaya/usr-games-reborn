import type { CardId } from '@usr-games/kit/cards';
import type { Chance, Dice } from './chance';
import { type GameEvent, seeEvent } from './events';
import { type Ask, applyAsk, type FishState, isLegalAsk, startGame } from './game';
import { BerkeleyMind, type Mind, type Peek, type SeatView } from './minds';
import type { RuleSetId } from './rules';

/**
 * A game in progress: the state, a mind for every seat the computer plays, and the dice. The
 * table is the information boundary. Minds hear about the game only through `seeEvent` (their
 * own seat's view) and decide from `viewFor`; the full state never reaches them. The one
 * exception is the Classic 1993 computer's rare peek, handed over only when `peeks` is set.
 */

export interface TableSetup {
  rules: RuleSetId;
  /** One entry per seat, clockwise from seat 0; `null` for a seat a person plays. */
  minds: readonly (Mind | null)[];
  deck: readonly CardId[];
  dice: Dice;
  /** The stream each mind draws from, asked for once per seat; the dice's rule stream unless given. */
  mindChance?: (seat: number) => Chance;
  /** Classic 1993: the original's computer may peek, one time in 1024. */
  peeks?: boolean;
}

export function viewFor(state: FishState, seat: number): SeatView {
  return {
    seat,
    hand: state.seats[seat]!.hand,
    handCounts: state.seats.map((s) => s.hand.length),
    pond: state.pond.length,
    books: state.seats.map((s) => s.books.map((book) => book.rank)),
  };
}

export class Table {
  readonly minds: readonly (Mind | null)[];
  readonly log: GameEvent[] = [];
  private current: FishState;
  private readonly dice: Dice;
  private readonly mindChance: readonly Chance[];
  private readonly peeks: boolean;

  constructor(setup: TableSetup) {
    this.minds = setup.minds;
    this.dice = setup.dice;
    this.mindChance = setup.minds.map((_, seat) => setup.mindChance?.(seat) ?? setup.dice.rules);
    this.peeks = setup.peeks ?? false;
    const opening = startGame(setup.rules, setup.minds.length, setup.deck, setup.dice);
    this.current = opening.state;
    this.record(opening.events);
  }

  get state(): FishState {
    return this.current;
  }

  get over(): boolean {
    return this.current.over;
  }

  get turn(): number {
    return this.current.turn;
  }

  /** True when the seat to ask is played by a person. */
  get awaitingPerson(): boolean {
    return !this.current.over && this.minds[this.current.turn] === null;
  }

  isLegal(ask: Ask): boolean {
    return isLegalAsk(this.current, this.current.turn, ask);
  }

  /** The seat whose turn it is asks; returns what happened, in order. */
  play(ask: Ask): GameEvent[] {
    const step = applyAsk(this.current, this.current.turn, ask, this.dice);
    this.current = step.state;
    this.record(step.events);
    return step.events;
  }

  /** What the computer at the current seat would ask. */
  think(): Ask {
    const seat = this.current.turn;
    const mind = this.minds[seat];
    if (!mind) throw new Error(`seat ${seat} is played by a person`);
    return mind.choose(viewFor(this.current, seat), this.mindChance[seat]!, this.peekFor(mind));
  }

  /** The computer at the current seat asks. */
  step(): GameEvent[] {
    return this.play(this.think());
  }

  /** Plays computer turns until a person must ask or the game is over. */
  runComputers(): GameEvent[] {
    const events: GameEvent[] = [];
    while (!this.current.over && this.minds[this.current.turn]) events.push(...this.step());
    return events;
  }

  /** Classic 1993: typing `p` switches the original's computer to pro mode for good. */
  switchToPro(seat: number): boolean {
    const mind = this.minds[seat];
    if (!(mind instanceof BerkeleyMind) || mind.isPro) return false;
    mind.turnPro();
    return true;
  }

  private peekFor(mind: Mind): Peek | undefined {
    if (!this.peeks) return undefined;
    const state = this.current;
    return { handOf: (seat) => (seat === mind.seat ? [] : state.seats[seat]!.hand) };
  }

  private record(events: readonly GameEvent[]): void {
    for (const event of events) {
      this.log.push(event);
      this.minds.forEach((mind, seat) => mind?.observe(seeEvent(event, seat)));
    }
  }
}
