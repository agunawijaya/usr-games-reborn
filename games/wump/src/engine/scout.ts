import { type Expedition, move, shoot, type TurnEvent } from './expedition';
import {
  knownRooms,
  type Notes,
  notesFor,
  observe,
  odds,
  type Odds,
  wumpusCandidates,
} from './knowledge';
import { DART_WAVERS, MAX_DART_ROOMS, STRING_BREAKS } from './rules';

/**
 * The Scout: a careful explorer who plays only from the notes. It walks to rooms the notes prove
 * safe, throws once the wumpus is cornered, and when every way on is a leap in the dark it takes
 * the shortest one. It plays the Hall's attract mode, powers the Scout assist's hints, and its results
 * set the balance of every cave (see docs/NOTES.md).
 */

export type Decision =
  { kind: 'move'; to: number } | { kind: 'shoot'; path: number[]; chance: number };

export interface ScoutStyle {
  /** Shoot at once when a dart is at least this likely to land on the wumpus. */
  sureShot: number;
  /** When only leaps in the dark are left, a shot this likely beats walking into the unknown. */
  hopefulShot: number;
}

export const SCOUT: ScoutStyle = { sureShot: 0.99, hopefulShot: 0.3 };

/** How badly walking into a room could end: a pit, the wumpus, or bats dropping you somewhere bad. */
function danger(o: Odds | undefined): number {
  if (!o) return 0.5;
  return o.pit * (10 / 12) + o.wumpus + o.bats * 0.3;
}

function exits(notes: Notes, room: number): number[] {
  return (notes.tunnels.get(room) ?? []).filter((to) => to >= 1 && to <= notes.size && to !== room);
}

/** Shortest known way between rooms, walking only through rooms that pass the test. */
function wayTo(
  notes: Notes,
  from: number,
  goal: (room: number) => boolean,
  through: (room: number) => boolean,
): number[] | null {
  const back = new Map<number, number>([[from, from]]);
  const queue = [from];
  while (queue.length > 0) {
    const room = queue.shift()!;
    if (room !== from && goal(room)) {
      const path = [room];
      for (let at = back.get(room)!; at !== from; at = back.get(at)!) path.unshift(at);
      return path;
    }
    if (room !== from && !through(room)) continue;
    for (const next of exits(notes, room)) {
      if (back.has(next)) continue;
      back.set(next, room);
      queue.push(next);
    }
  }
  return null;
}

/** How likely a dart is to fly a path of this many rooms to its end. */
export function reachChance(rooms: number): number {
  let chance = 1;
  if (rooms > STRING_BREAKS.afterRoom) chance *= 1 - STRING_BREAKS.outOfTen / 10;
  if (rooms > DART_WAVERS.afterRoom) chance *= 1 - DART_WAVERS.outOfTen / 10;
  return chance;
}

/** The best dart the notes allow: a known run of tunnels ending on a likely wumpus room. */
export function bestShot(notes: Notes, here: number): { path: number[]; chance: number } | null {
  const candidates = wumpusCandidates(notes);
  const share = 1 / candidates.size;
  let best: { path: number[]; chance: number } | null = null;
  for (const target of candidates) {
    if (target === here) continue;
    const path = wayTo(
      notes,
      here,
      (room) => room === target,
      (room) => notes.tunnels.has(room),
    );
    if (!path || path.length > MAX_DART_ROOMS) continue;
    const chance = share * reachChance(path.length);
    if (!best || chance > best.chance) best = { path, chance };
  }
  return best;
}

export function decide(
  notes: Notes,
  here: number,
  darts: number,
  style: ScoutStyle = SCOUT,
): Decision {
  const known = odds(notes);
  const shot = bestShot(notes, here);
  if (shot && shot.chance >= style.sureShot) return { kind: 'shoot', ...shot };

  const safe = (room: number) => danger(known.get(room)) === 0;
  // A room never stood in that the notes prove safe, reached through safe rooms only.
  const explore = wayTo(notes, here, (room) => !notes.tunnels.has(room) && safe(room), safe);
  if (explore) return { kind: 'move', to: explore[0]! };

  // Every way on is a leap in the dark: weigh the least dangerous unknown room against the best dart.
  let leap: { path: number[]; risk: number } | null = null;
  for (const room of knownRooms(notes)) {
    if (notes.tunnels.has(room)) continue;
    const path = wayTo(notes, here, (r) => r === room, safe);
    if (!path) continue;
    const risk = danger(known.get(room)) + path.length * 0.001;
    if (!leap || risk < leap.risk) leap = { path, risk };
  }
  // With the last dart, a miss ends the expedition: keep it for a good chance.
  const hopeful = darts <= 1 ? Math.max(style.hopefulShot, 0.5) : style.hopefulShot;
  if (shot && shot.chance >= hopeful) return { kind: 'shoot', ...shot };
  if (leap && leap.risk <= 0.35) return { kind: 'move', to: leap.path[0]! };
  if (shot && (!leap || shot.chance >= 1 - leap.risk || leap.risk > 0.6)) {
    return { kind: 'shoot', ...shot };
  }
  if (leap) return { kind: 'move', to: leap.path[0]! };
  return { kind: 'move', to: exits(notes, here)[0] ?? here };
}

export interface ScoutRun {
  ending: NonNullable<Expedition['ending']> | null;
  turns: number;
  /** The first move was a leap in the dark: no room around the start was proven safe. */
  forcedFirstMove: boolean;
  events: TurnEvent[][];
}

/** Lets the Scout play an expedition to its end (or until `maxTurns`). */
export function runScout(
  expedition: Expedition,
  maxTurns = 400,
  style: ScoutStyle = SCOUT,
): ScoutRun {
  const notes = notesFor(expedition, expedition.announced);
  const log: TurnEvent[][] = [];
  let forcedFirstMove = false;
  for (let turn = 0; turn < maxTurns && !expedition.ending; turn++) {
    const decision = decide(notes, expedition.player, expedition.darts, style);
    if (turn === 0 && decision.kind === 'move') {
      forcedFirstMove = danger(odds(notes).get(decision.to)) > 0;
    }
    const events =
      decision.kind === 'move' ? move(expedition, decision.to) : shoot(expedition, decision.path);
    observe(notes, expedition, events);
    log.push(events);
  }
  return { ending: expedition.ending, turns: expedition.turns, forcedFirstMove, events: log };
}
