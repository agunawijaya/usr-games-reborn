import { LAYOUT, groupSpaces } from '../boards/layout';
import { BOARDS, SEAT_COLOURS, type BoardId } from '../boards/themes';
import { buildAdvice, landingHeat } from '../engine/coach';
import { PERSONALITIES } from '../engine/rivals';
import {
  DEED_SPACES,
  deedOf,
  groupOf,
  saleValue,
  whyNotBuild,
  whyNotMortgage,
  whyNotSell,
  whyNotUnmortgage,
} from '../engine/state';
import {
  progressText,
  met,
  describeGoal,
  restricted,
  type Goal,
  type Restriction,
} from '../scenarios/goals';
import type { ActionView, HudView, PropertyView, SeatView } from '../ui/hud';
import { coins } from '../ui/parts';
import type { Director } from './director';
import type { PlaySession } from './session';
import { who } from './words';

/**
 * What the panels show, worked out from the session as the player has seen it so far, the
 * director's banner and log, and the screen's own state (which lot is picked, which panel is
 * open). Nothing here changes the game.
 */

export type Panel = 'none' | 'build' | 'mortgage' | 'trade';

export interface ScreenState {
  /** The lot whose card is shown, picked by click or arrows; null follows the play. */
  selected: number | null;
  panel: Panel;
  coach: boolean;
}

const TRANSIT_NOUN: Record<BoardId, string> = {
  harbour: 'Ferry',
  colony: 'Shuttle pad',
  popup: 'Railway halt',
};
const SERVICE_BAND = '#4b5563';

/** Net worth as the player has seen it: coins, deeds at their price (half when mortgaged), buildings at cost. */
export function shownWorth(session: PlaySession, seat: number): number {
  const { display } = session;
  if (display.out[seat]) return 0;
  let worth = display.coins[seat]!;
  for (const space of DEED_SPACES) {
    if (display.owners[space] !== seat) continue;
    const deed = deedOf(session.state, space);
    worth +=
      (display.mortgaged[space] ? deed.mortgage : deed.price) +
      display.levels[space]! * deed.buildCost;
  }
  return worth;
}

/**
 * The person whose hands are on the controls: the one whose move it is, when that is a person,
 * otherwise the first person at the table.
 */
export function personSeat(session: PlaySession): number {
  const acting = session.over ? -1 : session.actor;
  return acting >= 0 && session.state.seats[acting]!.kind === 'human' ? acting : session.owner;
}

function seatViews(session: PlaySession): SeatView[] {
  const { state, display } = session;
  const theme = BOARDS[state.board];
  const acting = session.over ? -1 : session.actor;
  const hands = personSeat(session);
  return state.seats.map((seat, index) => {
    const personality = seat.personality ? PERSONALITIES[seat.personality] : null;
    const groups = theme.groups
      .map((g, group) => {
        const spaces = groupSpaces(group);
        return {
          colour: g.colour,
          owned: spaces.filter((s) => display.owners[s] === index).length,
          of: spaces.length,
        };
      })
      .filter((g) => g.owned > 0);
    let status: string | undefined;
    if (display.out[index]) status = 'Out';
    else if (index === acting) status = seat.kind === 'human' ? 'Your move' : 'Thinking…';
    else if (display.inLockup[index]) status = 'Locked up';
    return {
      name: who(state, index),
      title: personality?.title,
      colour: SEAT_COLOURS[index]!,
      token: seat.token,
      coins: display.coins[index]!,
      worth: shownWorth(session, index),
      portrait: seat.personality,
      you: index === hands,
      active: index === acting,
      status,
      groups,
    };
  });
}

/** The lot the card should show: the picked one, else the one the moving token stands on. */
export function focusLot(session: PlaySession, screen: ScreenState): number | null {
  if (screen.selected !== null) return screen.selected;
  // While a move is still being shown, the engine is ahead of the picture: follow the token.
  const phase = session.state.phase;
  if (!session.busy && phase.kind === 'buy') return phase.space;
  if (!session.busy && phase.kind === 'auction') return phase.auction.space;
  const space = session.display.positions[session.state.current]!;
  return LAYOUT[space]!.kind === 'street' ||
    LAYOUT[space]!.kind === 'transit' ||
    LAYOUT[space]!.kind === 'utility'
    ? space
    : null;
}

export function propertyView(
  session: PlaySession,
  space: number,
  screen: ScreenState,
): PropertyView | undefined {
  const { state, display } = session;
  const slot = LAYOUT[space]!;
  if (slot.kind !== 'street' && slot.kind !== 'transit' && slot.kind !== 'utility')
    return undefined;
  const theme = BOARDS[state.board];
  const deed = deedOf(state, space);
  const ownerSeat = display.owners[space] ?? null;
  const owner =
    ownerSeat === null
      ? undefined
      : {
          name: ownerSeat === personSeat(session) ? 'you' : who(state, ownerSeat),
          colour: SEAT_COLOURS[ownerSeat]!,
          token: state.seats[ownerSeat]!.token,
        };
  const group = groupOf(space);
  let rows: PropertyView['rows'];
  let groupName: string;
  let groupColour: string;
  if (slot.kind === 'transit') {
    const held =
      ownerSeat === null
        ? 0
        : [5, 15, 25, 35].filter((s) => display.owners[s] === ownerSeat).length;
    groupName = TRANSIT_NOUN[state.board];
    groupColour = SERVICE_BAND;
    rows = deed.rents.map((rent, i) => ({
      label: `${i + 1} owned`,
      html: coins(rent),
      now: i + 1 === held,
    }));
  } else if (slot.kind === 'utility') {
    const held =
      ownerSeat === null ? 0 : [12, 28].filter((s) => display.owners[s] === ownerSeat).length;
    groupName = 'Utility';
    groupColour = SERVICE_BAND;
    rows = deed.rents.map((times, i) => ({
      label: `${i + 1} owned`,
      html: `${times} × the dice`,
      now: i + 1 === held,
    }));
  } else {
    groupName = theme.groups[group!]!.name;
    groupColour = theme.groups[group!]!.colour;
  }
  const person = personSeat(session);
  let advice: string | undefined;
  if (screen.coach) {
    const heat = landingHeat(state)[space]!;
    const odds = `Landed on ${heat > 0.92 ? 'more often than almost anywhere' : heat > 0.8 ? 'often' : heat > 0.7 ? 'now and then' : 'rarely'}.`;
    const build =
      ownerSeat === person && group !== null ? buildAdvice(state, person, space)?.text : undefined;
    advice = build ? `${build} ${odds}` : odds;
  }
  return {
    name: theme.spaces[space]!,
    groupName,
    groupColour,
    price: deed.price,
    rents: deed.rents,
    level: display.levels[space]!,
    buildCost: deed.buildCost,
    mortgage: deed.mortgage,
    ...(owner ? { owner } : {}),
    ...(rows ? { rows } : {}),
    mortgaged: display.mortgaged[space]!,
    ...(advice ? { advice } : {}),
  };
}

/** What the play screen adds to the panels: its name for the game, a scenario's goals and rules. */
export interface Framing {
  readonly label: string;
  readonly goals?: readonly Goal[];
  readonly restrictions?: readonly Restriction[];
}

/** The action bar for the person, with every button the phase allows switched on. */
function actions(session: PlaySession, framing: Framing): ActionView[] {
  const { state } = session;
  const mine = session.awaitingPerson && session.actor === personSeat(session);
  const phase = state.phase;
  const seat = state.seats[state.current]!;
  const can = (on: boolean) => mine && on;
  const between = phase.kind === 'turn' || phase.kind === 'after';
  const list: ActionView[] = [];
  if (phase.kind === 'buy' && mine) {
    const price = deedOf(state, phase.space).price;
    const allowed =
      session.actor !== session.owner ||
      restricted(framing.restrictions ?? [], state, session.actor, { type: 'buy' }) === null;
    // The main choice is always one that can be made: short of coins, Enter passes the lot on.
    const buyable = allowed && (seat.coins >= price || state.rules.bankLends);
    list.push(
      {
        id: 'buy',
        label: `Buy for ${price.toLocaleString('en-GB')}`,
        key: 'B',
        enabled: buyable,
        primary: buyable,
      },
      {
        id: 'pass',
        label: state.rules.auctions ? 'Auction it' : 'Pass',
        key: 'P',
        enabled: true,
        primary: !buyable,
      },
      { id: 'mortgage', label: 'Mortgage', key: 'M', enabled: true },
    );
    return list;
  }
  if (phase.kind === 'taxChoice' && mine) {
    // Berkeley 1980's income tax: the player picks before the bank works out the tenth.
    return [
      {
        id: 'tax-flat',
        label: `Pay ${state.economy.taxes[0].toLocaleString('en-GB')}`,
        key: 'F',
        enabled: true,
        primary: true,
      },
      { id: 'tax-tenth', label: 'Pay a tenth of your worth', key: 'W', enabled: true },
    ];
  }
  if (phase.kind === 'turn' && mine && seat.inLockup) {
    list.push(
      { id: 'roll', label: 'Roll for doubles', key: 'Space', enabled: true, primary: true },
      {
        id: 'fine',
        label: `Pay ${state.economy.fine}`,
        key: 'F',
        enabled: seat.coins >= state.economy.fine || state.rules.bankLends,
      },
    );
    if (seat.freeCards.length > 0)
      list.push({ id: 'card', label: 'Use pardon', key: 'U', enabled: true });
  } else if (phase.kind === 'after' && !phase.rollAgain) {
    list.push({ id: 'end', label: 'End turn', key: 'E', enabled: can(true), primary: true });
  } else {
    const label = phase.kind === 'after' && phase.rollAgain ? 'Roll again' : 'Roll';
    list.push({ id: 'roll', label, key: 'Space', enabled: can(between), primary: true });
  }
  list.push(
    { id: 'build', label: 'Build', key: 'H', enabled: can(between) },
    { id: 'mortgage', label: 'Mortgage', key: 'M', enabled: can(between) },
    { id: 'trade', label: 'Trade', key: 'T', enabled: can(between) },
  );
  return list;
}

export function hudView(
  session: PlaySession,
  director: Director,
  screen: ScreenState,
  framing: Framing,
): HudView {
  const { state } = session;
  const lot = focusLot(session, screen);
  const property = lot === null ? undefined : propertyView(session, lot, screen);
  const scenario = state.rules.mode === 'scenario';
  const goals = framing.goals?.map((goal) => ({
    text: describeGoal(goal, state.board),
    progress: progressText(goal, state, session.ledger),
    done: met(goal, state, session.ledger),
  }));
  return {
    board: BOARDS[state.board],
    mode: framing.label,
    round: Math.min(state.rules.rounds, session.display.round + 1),
    rounds: state.rules.mode === 'classic' ? null : state.rules.rounds,
    ...(scenario ? { roundWord: 'Turn' } : {}),
    seats: seatViews(session),
    ...(director.banner ? { banner: director.banner } : {}),
    ...(property ? { property } : {}),
    actions: actions(session, framing),
    log: director.log,
    ...(goals ? { goals } : {}),
  };
}

/** Lots the person could build on now, with the coach's payback line. */
export function buildOptions(
  session: PlaySession,
): { space: number; cost: number; level: number; advice: string }[] {
  const person = personSeat(session);
  return DEED_SPACES.filter((space) => whyNotBuild(session.state, person, space) === null).map(
    (space) => ({
      space,
      cost: deedOf(session.state, space).buildCost,
      level: session.state.deeds[space]!.level + 1,
      advice: buildAdvice(session.state, person, space)?.text ?? '',
    }),
  );
}

export type MoneyMove = { kind: 'mortgage' | 'unmortgage' | 'sell'; space: number; amount: number };

/** Ways the person can raise money (or pay a mortgage off) now. */
export function moneyOptions(session: PlaySession, includePayOff = true): MoneyMove[] {
  const person = personSeat(session);
  const { state } = session;
  const moves: MoneyMove[] = [];
  for (const space of DEED_SPACES) {
    if (state.deeds[space]!.owner !== person) continue;
    const deed = deedOf(state, space);
    if (whyNotSell(state, person, space) === null)
      moves.push({ kind: 'sell', space, amount: saleValue(state, space) });
    if (whyNotMortgage(state, person, space) === null)
      moves.push({ kind: 'mortgage', space, amount: deed.mortgage });
    if (includePayOff && whyNotUnmortgage(state, person, space) === null)
      moves.push({ kind: 'unmortgage', space, amount: Math.floor(deed.mortgage * 1.1) });
  }
  return moves;
}
