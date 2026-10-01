import { type Arena, type Place, isOnBorder, placeCell } from './arena';
import {
  type Cell,
  type Heading,
  HEADING_COUNT,
  headingToward,
  sameCell,
  STEPS,
  toHeading,
  turnBetween,
} from './geometry';
import { CARRIERS, type Flight, SPECIAL_CARRIERS } from './traffic';

/**
 * The sky and everything in it, advanced one tick at a time by the rules of the 1986 game.
 * The order of every step inside `tick` follows the original's update loop, because the order
 * decides which mistake is reported first and whether a plane that lands this tick can still
 * collide.
 */

export const LETTERS = 26;
export const CEILING = 9;
export const ENTRY_ALTITUDE = 7;
export const LOW_FUEL = 15;
/** Planes closer than this in every axis (cells and thousands of feet) have lost separation. */
export const SEPARATION = 1;
/** A gate stays closed to new arrivals while any plane is this close to it, in every axis. */
export const ENTRY_CLEARANCE = 4;

export type PlaneKind = 'prop' | 'jet';
export type PlaneStatus = 'marked' | 'unmarked' | 'ignored';
export type Hold = 'left' | 'right';

export interface TrackPoint extends Cell {
  tick: number;
  altitude: number;
}

export interface Plane {
  /** 0–25; drawn as an upper-case letter for props and lower-case for jets. */
  letter: number;
  kind: PlaneKind;
  x: number;
  y: number;
  altitude: number;
  targetAltitude: number;
  heading: Heading;
  targetHeading: Heading;
  hold: Hold | null;
  fuel: number;
  origin: Place;
  destination: Place;
  status: PlaneStatus;
  /** Keep the heading until this beacon is reached (the original's "at beacon"). */
  waitForBeacon: number | null;
  onGround: boolean;
  /** Skyloom: cells still to fly through, each next to the one before. */
  route: Cell[];
  flight: Flight;
  /** Every position the plane has held, one per move, for trails, replays and the tapestry. */
  track: TrackPoint[];
}

export type LossReason =
  | { kind: 'separation'; other: number }
  | { kind: 'fuel' }
  | { kind: 'ground' }
  | { kind: 'wrong-runway' }
  | { kind: 'wrong-landing-heading' }
  | { kind: 'landed-not-exited' }
  | { kind: 'wrong-exit-altitude' }
  | { kind: 'wrong-gate' }
  | { kind: 'exited-not-landed' }
  | { kind: 'left-arena' }
  | { kind: 'ceiling' };

export interface Loss {
  tick: number;
  letter: number;
  reason: LossReason;
}

export type SkyEvent =
  | { kind: 'arrived'; letter: number; at: Place; tick: number }
  | { kind: 'took-off'; letter: number; tick: number }
  | { kind: 'spawned'; letter: number; tick: number }
  | { kind: 'reached-beacon'; letter: number; beacon: number; tick: number }
  | { kind: 'near-miss'; a: number; b: number; at: Cell; tick: number }
  | { kind: 'lost'; loss: Loss };

/** The two random streams of the original: one for what a new plane is, one for when it comes. */
export interface Randomness {
  /** A non-negative integer, like the C library's `random()`. */
  random(): number;
  /** A non-negative integer, like `rand()`, used only for the arrival roll. */
  rand(): number;
  /** Skyloom's own flavour (carriers, flight numbers); never consulted by the rules. */
  flavour(): number;
}

/**
 * Skyloom's shift rules on top of the original's. The defaults are the 1986 game exactly;
 * shifts change them to teach one idea at a time.
 */
export interface SkyRules {
  /** Arrivals through a gate get this share of a full tank (low-fuel shifts). */
  arrivalFuel: number;
  /** Runways that take no traffic: nothing is sent to them and nothing departs from them. */
  closedRunways: ReadonlySet<number>;
  /** When set, planes arrive only as scripted (the tutorial), never by chance. */
  arrivals: readonly ScriptedArrival[] | null;
}

export interface ScriptedArrival {
  tick: number;
  kind: PlaneKind;
  origin: Place;
  destination: Place;
}

export const CLASSIC_RULES: SkyRules = {
  arrivalFuel: 1,
  closedRunways: new Set(),
  arrivals: null,
};

export interface World {
  arena: Arena;
  rules: SkyRules;
  clock: number;
  /** Planes in the air, kept in letter order as the original's lists were (list.c). */
  air: Plane[];
  /** Planes waiting on a runway for a climb clearance, also in letter order. */
  ground: Plane[];
  safe: number;
  /** The last letter handed out; the next plane takes the first free letter after it. */
  lastLetter: number;
  loss: Loss | null;
  random: Randomness;
  /** Skyloom: pairs flying close right now, so each close pass is counted once. */
  closePairs: Set<string>;
  nearMisses: number;
}

export function createWorld(
  arena: Arena,
  random: Randomness,
  rules: SkyRules = CLASSIC_RULES,
): World {
  return {
    arena,
    rules,
    clock: 0,
    air: [],
    ground: [],
    safe: 0,
    lastLetter: -1,
    loss: null,
    random,
    closePairs: new Set(),
    nearMisses: 0,
  };
}

export function planeName(plane: Pick<Plane, 'letter' | 'kind'>): string {
  const base = plane.kind === 'prop' ? 65 : 97;
  return String.fromCharCode(base + plane.letter);
}

export function allPlanes(world: World): Plane[] {
  return [...world.air, ...world.ground];
}

export function findPlane(world: World, letter: number): Plane | undefined {
  return (
    world.air.find((p) => p.letter === letter) ?? world.ground.find((p) => p.letter === letter)
  );
}

/**
 * Adds a plane to a list in letter order. The original's `append` inserts by plane number
 * rather than at the end, and that order decides who moves first and who is named in a collision.
 */
export function insertByLetter(list: Plane[], plane: Plane): void {
  const at = list.findIndex((other) => other.letter > plane.letter);
  if (at < 0) list.push(plane);
  else list.splice(at, 0, plane);
}

type Position = Pick<Plane, 'x' | 'y' | 'altitude'>;

export function tooClose(a: Position, b: Position, distance: number): boolean {
  return (
    Math.abs(a.altitude - b.altitude) <= distance &&
    Math.abs(a.x - b.x) <= distance &&
    Math.abs(a.y - b.y) <= distance
  );
}

/** Props move on even ticks only; jets move every tick. */
export function movesOnTick(plane: Pick<Plane, 'kind'>, tick: number): boolean {
  return plane.kind === 'jet' || (tick & 1) === 0;
}

/**
 * Advances the sky by one tick and returns what happened. The first broken rule ends the shift,
 * exactly as the original stopped at its first loss; nothing after it in the same tick is
 * evaluated.
 */
export function tick(world: World): SkyEvent[] {
  if (world.loss) return [];
  const events: SkyEvent[] = [];
  world.clock += 1;
  const now = world.clock;

  launchClearedPlanes(world, events);

  const arrived = new Set<Plane>();
  for (const plane of world.air) {
    if (!movesOnTick(plane, now)) continue;
    const outcome = movePlane(world, plane, events) ?? checkAfterMove(world, plane);
    if (outcome === 'arrived') arrived.add(plane);
    else if (outcome) return lose(world, events, outcome);
  }

  for (const plane of arrived) {
    world.safe += 1;
    events.push({ kind: 'arrived', letter: plane.letter, at: plane.destination, tick: now });
  }
  world.air = world.air.filter((p) => !arrived.has(p));

  const collision = firstLossOfSeparation(world);
  if (collision) return lose(world, events, collision);
  noteNearMisses(world, events);

  for (const spawned of newArrivals(world)) {
    events.push({ kind: 'spawned', letter: spawned.letter, tick: now });
  }
  return events;
}

function lose(world: World, events: SkyEvent[], loss: Loss): SkyEvent[] {
  world.loss = loss;
  events.push({ kind: 'lost', loss });
  return events;
}

/** A plane on a runway leaves the ground as soon as it has been told to climb. */
function launchClearedPlanes(world: World, events: SkyEvent[]): void {
  const cleared = world.ground.filter((p) => p.targetAltitude > 0);
  if (cleared.length === 0) return;
  world.ground = world.ground.filter((p) => p.targetAltitude <= 0);
  for (const plane of cleared) {
    plane.onGround = false;
    insertByLetter(world.air, plane);
    events.push({ kind: 'took-off', letter: plane.letter, tick: world.clock });
  }
}

/** Fuel, climb, turn and one step forward. Returns a loss if the tank ran dry. */
export function movePlane(world: World, plane: Plane, events: SkyEvent[]): Loss | null {
  plane.fuel -= 1;
  if (plane.fuel < 0) return { tick: world.clock, letter: plane.letter, reason: { kind: 'fuel' } };

  glideToRunway(world, plane);
  climbToGate(world, plane);
  plane.altitude += Math.sign(plane.targetAltitude - plane.altitude);
  followRoute(plane);
  if (plane.waitForBeacon === null) turn(plane);

  const move = STEPS[plane.heading]!;
  plane.x += move.x;
  plane.y += move.y;
  plane.track.push({ x: plane.x, y: plane.y, altitude: plane.altitude, tick: world.clock });
  advanceRoute(plane);

  const beacon =
    plane.waitForBeacon === null ? undefined : world.arena.beacons[plane.waitForBeacon];
  if (beacon && sameCell(beacon, plane)) {
    events.push({
      kind: 'reached-beacon',
      letter: plane.letter,
      beacon: plane.waitForBeacon!,
      tick: world.clock,
    });
    plane.waitForBeacon = null;
    // A delayed plane that had been unmarked asks for attention again when it gets there.
    if (plane.status === 'unmarked') plane.status = 'marked';
  }
  return null;
}

/** At most a quarter turn per move; a hold keeps turning the same way. */
function turn(plane: Plane): void {
  let diff: number;
  if (plane.hold === 'right') diff = HEADING_COUNT - plane.heading;
  else if (plane.hold === 'left') diff = plane.heading === 0 ? -HEADING_COUNT : -plane.heading;
  else diff = turnBetween(plane.heading, plane.targetHeading);
  const clamped = Math.max(-2, Math.min(2, diff));
  plane.heading = toHeading(plane.heading + clamped);
}

/**
 * Skyloom: a route that ends on the plane's own runway also flies the final descent, one thousand
 * feet per cell, so the plane meets the runway at 0 ft. It only ever lowers the target altitude,
 * and only once the plane is on that glide path; a plane drawn in too high stays high.
 */
function glideToRunway(world: World, plane: Plane): void {
  if (plane.destination.kind !== 'runway' || plane.route.length === 0) return;
  const runway = world.arena.runways[plane.destination.index]!;
  if (!sameCell(plane.route[plane.route.length - 1]!, runway)) return;
  const remaining = plane.route.length;
  if (plane.altitude <= remaining) {
    plane.targetAltitude = Math.min(plane.targetAltitude, remaining - 1);
  }
}

/**
 * Skyloom: a route that ends at the plane's own gate climbs to 9 000 ft in time to leave. It only
 * ever raises the target, at the last moment it can, so the height on the way stays the player's.
 */
function climbToGate(world: World, plane: Plane): void {
  if (plane.destination.kind !== 'gate' || plane.route.length === 0) return;
  const gate = world.arena.gates[plane.destination.index]!;
  if (!sameCell(plane.route[plane.route.length - 1]!, gate)) return;
  if (CEILING - plane.altitude >= plane.route.length - 1) plane.targetAltitude = CEILING;
}

/** Skyloom's routes steer by setting the heading towards the next cell before each move. */
function followRoute(plane: Plane): void {
  const next = plane.route[0];
  if (!next) return;
  plane.hold = null;
  plane.targetHeading = headingToward(next.x - plane.x, next.y - plane.y);
}

function advanceRoute(plane: Plane): void {
  if (plane.route[0] && sameCell(plane.route[0], plane)) plane.route.shift();
}

/**
 * Checks a plane after its move, in the original's order: its own destination first, then the
 * ceiling, the ground and the border. Returns 'arrived' when it left the sky correctly.
 */
export function checkAfterMove(world: World, plane: Plane): Loss | 'arrived' | null {
  const { arena } = world;
  const at = (reason: LossReason): Loss => ({ tick: world.clock, letter: plane.letter, reason });
  const destination = placeCell(arena, plane.destination);

  if (plane.destination.kind === 'runway') {
    if (sameCell(destination, plane) && plane.altitude === 0) {
      const runway = arena.runways[plane.destination.index]!;
      if (plane.heading !== runway.heading) return at({ kind: 'wrong-landing-heading' });
      return 'arrived';
    }
  } else if (sameCell(destination, plane)) {
    if (plane.altitude !== CEILING) return at({ kind: 'wrong-exit-altitude' });
    return 'arrived';
  }

  if (plane.altitude > CEILING) return at({ kind: 'ceiling' });
  if (plane.altitude <= 0) {
    const onRunway = arena.runways.some((r) => sameCell(r, plane));
    if (onRunway) {
      return at({
        kind: plane.destination.kind === 'runway' ? 'wrong-runway' : 'landed-not-exited',
      });
    }
    return at({ kind: 'ground' });
  }
  if (isOnBorder(arena, plane)) {
    const onGate = arena.gates.some((g) => sameCell(g, plane));
    if (onGate) {
      return at({ kind: plane.destination.kind === 'gate' ? 'wrong-gate' : 'exited-not-landed' });
    }
    return at({ kind: 'left-arena' });
  }
  return null;
}

/**
 * Skyloom: a near-miss is a pass just outside the rule, within two cells and a thousand feet or
 * one cell and two thousand feet. Planes stacked on a glide path two cells and two thousand feet
 * apart are not near-misses. Never ends a shift; it costs a star and ties a knot in the tapestry.
 */
export function isNearMiss(a: Position, b: Position): boolean {
  const across = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const height = Math.abs(a.altitude - b.altitude);
  return (across <= 2 && height <= 1) || (across <= 1 && height <= 2);
}

function noteNearMisses(world: World, events: SkyEvent[]): void {
  const close = new Set<string>();
  const { air } = world;
  for (let i = 0; i < air.length; i++) {
    for (let j = i + 1; j < air.length; j++) {
      const a = air[i]!;
      const b = air[j]!;
      if (a.altitude === 0 || b.altitude === 0 || !isNearMiss(a, b)) continue;
      const key = `${a.letter}:${b.letter}`;
      close.add(key);
      if (world.closePairs.has(key)) continue;
      world.nearMisses += 1;
      events.push({
        kind: 'near-miss',
        a: a.letter,
        b: b.letter,
        at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        tick: world.clock,
      });
    }
  }
  world.closePairs = close;
}

/** Pairs are checked in list order and the first plane of the pair is the one reported. */
function firstLossOfSeparation(world: World): Loss | null {
  const { air } = world;
  for (let i = 0; i < air.length; i++) {
    for (let j = i + 1; j < air.length; j++) {
      const a = air[i]!;
      const b = air[j]!;
      if (tooClose(a, b, SEPARATION)) {
        return {
          tick: world.clock,
          letter: a.letter,
          reason: { kind: 'separation', other: b.letter },
        };
      }
    }
  }
  return null;
}

/** The tick's new planes: by chance as in the original, or as the tutorial scripts them. */
function newArrivals(world: World): Plane[] {
  const scripted = world.rules.arrivals;
  if (scripted) {
    return scripted
      .filter((a) => a.tick === world.clock)
      .map((a) => placePlane(world, a.kind, a.origin, a.destination))
      .filter((p): p is Plane => p !== null);
  }
  if (world.random.rand() % world.arena.spawnOneIn !== 0) return [];
  const spawned = addPlane(world);
  return spawned ? [spawned] : [];
}

/**
 * Skyloom: when a runway closes, flights bound for it are sent to the first open runway
 * instead, as a tower would reassign them after a change of wind.
 */
export function closeRunway(world: World, runway: number): void {
  const closed = new Set(world.rules.closedRunways);
  closed.add(runway);
  world.rules = { ...world.rules, closedRunways: closed };
  const open = world.arena.runways.findIndex((_, i) => !closed.has(i));
  if (open < 0) return;
  for (const plane of [...world.air, ...world.ground]) {
    if (plane.destination.kind === 'runway' && plane.destination.index === runway) {
      plane.destination = { kind: 'runway', index: open };
      plane.route = [];
    }
  }
}

export function reopenRunway(world: World, runway: number): void {
  const closed = new Set(world.rules.closedRunways);
  closed.delete(runway);
  world.rules = { ...world.rules, closedRunways: closed };
}

/**
 * The first free letter after the last one handed out, wrapping round, or -1. Like the original,
 * it gives up when it comes back to where it started, even if that letter has just come free.
 */
export function nextLetter(world: World): number {
  const inUse = new Set(allPlanes(world).map((p) => p.letter));
  const start = world.lastLetter;
  let candidate = start;
  for (let tries = 0; tries < LETTERS; tries++) {
    candidate = (candidate + 1) % LETTERS;
    if (candidate === start) break;
    if (!inUse.has(candidate)) {
      world.lastLetter = candidate;
      return candidate;
    }
  }
  world.lastLetter = candidate;
  return -1;
}

/**
 * Tries to bring in one new plane. A gate is skipped while another plane is near it; a runway
 * is never checked, because the plane waits on the ground until it is cleared to climb.
 */
export function addPlane(world: World): Plane | null {
  const { arena, random } = world;
  const closed = world.rules.closedRunways;
  const kind: PlaneKind = random.random() % 2 === 0 ? 'prop' : 'jet';
  const starts = arena.gates.length + arena.runways.length;
  const destinationIndex = random.random() % starts;
  let destination = placeAt(arena, destinationIndex);
  if (destination.kind === 'runway' && closed.has(destination.index)) {
    const open = arena.runways.findIndex((_, i) => !closed.has(i));
    destination = open < 0 ? { kind: 'gate', index: 0 } : { kind: 'runway', index: open };
  }

  for (let attempt = 0; attempt < starts; attempt++) {
    let originIndex: number;
    do originIndex = random.random() % starts;
    while (originIndex === destinationIndex);
    const origin = placeAt(arena, originIndex);
    if (origin.kind === 'runway' && closed.has(origin.index)) continue;
    if (origin.kind === destination.kind && origin.index === destination.index) continue;
    const cell = placeCell(arena, origin);
    const entry = { x: cell.x, y: cell.y, altitude: ENTRY_ALTITUDE };
    if (origin.kind === 'gate' && world.air.some((p) => tooClose(p, entry, ENTRY_CLEARANCE))) {
      continue;
    }
    return placePlane(world, kind, origin, destination);
  }
  return null;
}

/** Puts a new plane at its origin: in the air at a gate, on the ground at a runway. */
function placePlane(
  world: World,
  kind: PlaneKind,
  origin: Place,
  destination: Place,
): Plane | null {
  const { arena } = world;
  const cell = placeCell(arena, origin);
  const heading =
    origin.kind === 'gate'
      ? arena.gates[origin.index]!.heading
      : arena.runways[origin.index]!.heading;
  const altitude = origin.kind === 'gate' ? ENTRY_ALTITUDE : 0;
  const letter = nextLetter(world);
  if (letter < 0) return null;
  const fullTank = arena.width + arena.height;
  const plane: Plane = {
    letter,
    kind,
    x: cell.x,
    y: cell.y,
    altitude,
    targetAltitude: altitude,
    heading,
    targetHeading: heading,
    hold: null,
    fuel: origin.kind === 'gate' ? Math.round(fullTank * world.rules.arrivalFuel) : fullTank,
    origin,
    destination,
    status: 'marked',
    waitForBeacon: null,
    onGround: origin.kind === 'runway',
    route: [],
    flight: inventFlight(world),
    track: [{ x: cell.x, y: cell.y, altitude, tick: world.clock }],
  };
  insertByLetter(plane.onGround ? world.ground : world.air, plane);
  return plane;
}

function placeAt(arena: Arena, index: number): Place {
  return index < arena.gates.length
    ? { kind: 'gate', index }
    : { kind: 'runway', index: index - arena.gates.length };
}

/** About one flight in twelve is a medical flight and one in fifteen carries the night post. */
export function inventFlight(world: World): Flight {
  const roll = world.random.flavour();
  const number = 10 + (world.random.flavour() % 890);
  if (roll % 12 === 0)
    return { carrier: SPECIAL_CARRIERS.medical, number: 1 + (number % 9), role: 'medical' };
  if (roll % 15 === 1) return { carrier: SPECIAL_CARRIERS.mail, number, role: 'mail' };
  return { carrier: CARRIERS[roll % CARRIERS.length]!, number, role: 'scheduled' };
}
