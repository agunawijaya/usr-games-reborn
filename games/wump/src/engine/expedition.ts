import {
  type Cave,
  caveProblem,
  type CaveProblem,
  digCave,
  dodecahedron,
  hasTunnel,
  isMagic,
  tunnelsFrom,
} from './cave';
import { glibcRandom } from './glibc';
import { anyRoom, type Random, roll } from './random';
import {
  type CaveRecipe,
  DART_WAVERS,
  LEDGE_CHANCE,
  MAX_DART_ROOMS,
  type RuleSet,
  STRING_BREAKS,
  TEMPER_START,
  WAKE_ONE_IN,
} from './rules';

/**
 * One expedition into one cave: where everything is, where the explorer stands, and what each
 * turn does. A turn is one move or one dart, exactly as in the original; every function returns
 * the events of the turn in order, so the screen can play them back and the log can tell them.
 */

export type Ending =
  | { kind: 'hushed'; room: number }
  /** Walked into the wumpus, or it walked into you. */
  | { kind: 'bowled-over'; room: number; cause: 'walked-in' | 'it-came' }
  | { kind: 'pit'; room: number }
  | { kind: 'own-dart'; room: number }
  | { kind: 'empty-quiver'; room: number };

export type StopReason = 'path-end' | 'string-broke' | 'wavered' | 'deflected' | 'too-far';

export interface DartHop {
  from: number;
  /** The room the player asked for. */
  asked: number;
  /** Where the dart actually went. */
  to: number;
  kind: 'flew' | 'magic' | 'deflected';
}

export interface DartFlight {
  path: readonly number[];
  hops: DartHop[];
  stop: StopReason;
  landed: number;
}

export type TurnEvent =
  | { kind: 'walked'; from: number; to: number }
  | { kind: 'bumped'; from: number; toward: number }
  | { kind: 'shimmered'; from: number; to: number }
  | { kind: 'carried'; from: number; to: number }
  | { kind: 'ledge'; room: number }
  | { kind: 'dart'; flight: DartFlight }
  | { kind: 'stirred'; from: number; to: number; why: 'bump' | 'miss' }
  | { kind: 'wumpus-carried'; from: number; to: number }
  | { kind: 'ended'; ending: Ending };

export interface Senses {
  /** Bats in a room one tunnel away. */
  bats: boolean;
  /** A pit in a room one tunnel away. */
  pit: boolean;
  /** 0: no smell; 1: the wumpus is one tunnel away; 2: two tunnels away. */
  wumpus: 0 | 1 | 2;
}

export interface Expedition {
  cave: Cave;
  rules: RuleSet;
  recipe: CaveRecipe;
  /** The bats and pits the expedition announced at the start (Classic may hold fewer pits). */
  announced: { bats: number; pits: number };
  pits: boolean[];
  bats: boolean[];
  wumpus: number;
  start: number;
  player: number;
  darts: number;
  /** The original's `lastchance`: how close the wumpus is to stirring after a miss. */
  temper: number;
  /** Rooms the explorer has stood in, in the order they were first reached. */
  visited: number[];
  moves: number;
  batRides: number;
  ledges: number;
  turns: number;
  ending: Ending | null;
  random: Random;
}

export type PopulationProblem = CaveProblem | 'too-crowded' | 'too-dangerous' | 'no-room-to-stand';

/**
 * How many bats and pits a recipe asks for, after the hard level's extras. The original draws the
 * extras before it seeds its generator, so under Classic rules they always come from the C
 * library's default seed (on GNU libc: 7 bats and 10 pits in a twenty-room cave); Standard rules
 * draw them from the expedition's own stream.
 */
export function population(
  recipe: CaveRecipe,
  rules: RuleSet,
  random: Random,
): { bats: number; pits: number } {
  let { bats, pits } = recipe;
  if (recipe.hard) {
    const half = Math.floor(recipe.rooms / 2);
    const draw = rules === 'classic' ? glibcRandom(1) : random;
    bats += roll(draw, half) + 1;
    pits += roll(draw, half) + 1;
    // Classic refuses a cave that comes out too full, as the original did; Standard fills it to
    // the brim and no further, leaving room to stand.
    if (rules === 'standard') {
      bats = Math.min(bats, half);
      pits = Math.min(pits, half, recipe.rooms - 2 - bats);
    }
  }
  return { bats, pits };
}

export function populationProblem(
  recipe: CaveRecipe,
  counts: { bats: number; pits: number },
  rules: RuleSet = 'standard',
): PopulationProblem | null {
  const sizeProblem = caveProblem(recipe.rooms, recipe.tunnelsPerRoom);
  if (sizeProblem) return sizeProblem;
  const half = Math.floor(recipe.rooms / 2);
  if (counts.bats > half) return 'too-crowded';
  if (counts.pits > half) return 'too-dangerous';
  // Standard keeps bats and pits in rooms of their own and the explorer off all of them.
  if (rules === 'standard' && counts.bats + counts.pits > recipe.rooms - 2)
    return 'no-room-to-stand';
  return null;
}

/** A cave laid out by hand: the tutorial's, or a test's. */
export interface Preset {
  cave: Cave;
  pits: readonly number[];
  bats: readonly number[];
  wumpus: number;
  start: number;
}

export interface StartOptions {
  preset?: Preset;
  /** Classic carries the wumpus's temper over from the last expedition, as the original did. */
  temper?: number;
}

/**
 * Digs the cave and fills it. Throws on a recipe the original would refuse; screens check
 * `populationProblem` first and explain in their own words.
 */
export function startExpedition(
  recipe: CaveRecipe,
  rules: RuleSet,
  random: Random,
  options: StartOptions = {},
): Expedition {
  if (options.preset) return fromPreset(recipe, rules, random, options.preset);
  const counts = population(recipe, rules, random);
  const problem = populationProblem(recipe, counts, rules);
  if (problem) throw new Error(`The cave cannot be built: ${problem}`);
  const cave = recipe.dodecahedron
    ? dodecahedron()
    : digCave(
        {
          size: recipe.rooms,
          tunnelsPerRoom: recipe.tunnelsPerRoom,
          allowLoops: rules === 'classic',
          magicTunnels: rules === 'standard' ? recipe.magicTunnels : 0,
        },
        random,
      );
  const expedition: Expedition = {
    cave,
    rules,
    recipe,
    announced: counts,
    pits: new Array<boolean>(cave.size + 1).fill(false),
    bats: new Array<boolean>(cave.size + 1).fill(false),
    wumpus: 0,
    start: 0,
    player: 0,
    darts: recipe.darts,
    temper: options.temper ?? TEMPER_START,
    visited: [],
    moves: 0,
    batRides: 0,
    ledges: 0,
    turns: 0,
    ending: null,
    random,
  };
  fill(expedition, counts);
  return expedition;
}

function fromPreset(
  recipe: CaveRecipe,
  rules: RuleSet,
  random: Random,
  preset: Preset,
): Expedition {
  const size = preset.cave.size;
  const pits = new Array<boolean>(size + 1).fill(false);
  const bats = new Array<boolean>(size + 1).fill(false);
  for (const room of preset.pits) pits[room] = true;
  for (const room of preset.bats) bats[room] = true;
  return {
    cave: preset.cave,
    rules,
    recipe,
    announced: { bats: preset.bats.length, pits: preset.pits.length },
    pits,
    bats,
    wumpus: preset.wumpus,
    start: preset.start,
    player: preset.start,
    darts: recipe.darts,
    temper: TEMPER_START,
    visited: [preset.start],
    moves: 0,
    batRides: 0,
    ledges: 0,
    turns: 0,
    ending: null,
    random,
  };
}

/**
 * Places bats, pits, the wumpus and the explorer. Classic keeps the original's order and its
 * crooked pit test (`&&` where `||` was meant), so pits may share a room with each other or with
 * bats. Standard places exactly the number it announces, each in a room of its own, and chooses
 * the explorer's room first so that it can keep the rooms around it calm: no hazard through the
 * first tunnels and the wumpus out of reach of the first step.
 */
function fill(expedition: Expedition, counts: { bats: number; pits: number }): void {
  if (expedition.rules === 'classic') fillClassic(expedition, counts);
  else fillStandard(expedition, counts);
  expedition.player = expedition.start;
  expedition.visited = [expedition.start];
}

function fillClassic(expedition: Expedition, counts: { bats: number; pits: number }): void {
  const { cave, random, bats, pits } = expedition;
  const size = cave.size;
  for (let i = 0; i < counts.bats; i++) {
    let room: number;
    do room = anyRoom(random, size);
    while (bats[room]);
    bats[room] = true;
  }
  for (let i = 0; i < counts.pits; i++) {
    let room: number;
    do room = anyRoom(random, size);
    while (pits[room] && bats[room]);
    pits[room] = true;
  }
  expedition.wumpus = anyRoom(random, size);
  expedition.start = chooseStart(expedition);
}

function fillStandard(expedition: Expedition, counts: { bats: number; pits: number }): void {
  const { cave, random, bats, pits, recipe } = expedition;
  const size = cave.size;
  const start = anyRoom(random, size);
  const calm = new Set<number>([
    start,
    ...tunnelsFrom(cave, start).filter((to) => !isMagic(cave, to)),
  ]);
  // In a cave too full for a calm start, only the explorer's own room is kept clear.
  const roomy = size - calm.size >= counts.bats + counts.pits + 1;
  const free = (room: number) =>
    !bats[room] && !pits[room] && (roomy ? !calm.has(room) : room !== start);
  const place = (list: boolean[]) => {
    let room: number;
    do room = anyRoom(random, size);
    while (!free(room));
    list[room] = true;
  };
  for (let i = 0; i < counts.bats; i++) place(bats);
  for (let i = 0; i < counts.pits; i++) place(pits);
  expedition.start = start;
  for (let tries = 0; ; tries++) {
    const room = anyRoom(random, size);
    expedition.wumpus = room;
    if (room === start) continue;
    const reach = sense(expedition, start).wumpus;
    // Never next door to the start; on the hard level, out of smelling range as well.
    if (tries < size * 40 && (reach === 1 || (recipe.hard && reach > 0))) continue;
    return;
  }
}

/**
 * Never in the wumpus's room; on the hard level never within smelling range, as the original
 * required. A cave so dense that every room smells would make the original search for ever; after
 * a long search the wumpus is moved instead.
 */
function chooseStart(expedition: Expedition): number {
  const { cave, random, recipe } = expedition;
  for (let tries = 0; ; tries++) {
    if (tries > cave.size * 50) {
      expedition.wumpus = anyRoom(random, cave.size);
      tries = 0;
    }
    const room = anyRoom(random, cave.size);
    if (room === expedition.wumpus) continue;
    if (recipe.hard && sense(expedition, room).wumpus > 0) continue;
    return room;
  }
}

/** What the explorer notices in a room: only rooms the tunnels lead to count, never the ones leading in. */
export function sense(expedition: Expedition, room = expedition.player): Senses {
  const { cave } = expedition;
  let bats = false;
  let pit = false;
  let wumpus: 0 | 1 | 2 = 0;
  for (const next of tunnelsFrom(cave, room)) {
    if (isMagic(cave, next)) continue;
    bats ||= expedition.bats[next]!;
    pit ||= expedition.pits[next]!;
    if (next === expedition.wumpus) wumpus = 1;
    else if (wumpus === 0 && tunnelsFrom(cave, next).includes(expedition.wumpus)) wumpus = 2;
  }
  return { bats, pit, wumpus };
}

function end(expedition: Expedition, events: TurnEvent[], ending: Ending): TurnEvent[] {
  expedition.ending = ending;
  events.push({ kind: 'ended', ending });
  return events;
}

/** Walks through a tunnel. Asking for a room with no tunnel to it is a bump against the wall. */
export function move(expedition: Expedition, to: number): TurnEvent[] {
  if (expedition.ending) return [];
  const events: TurnEvent[] = [];
  const { cave, random } = expedition;
  const from = expedition.player;
  expedition.turns += 1;
  expedition.moves += 1;

  if (!hasTunnel(cave, from, to)) {
    events.push({ kind: 'bumped', from, toward: to });
    if (roll(random, expedition.recipe.wakeOneIn ?? WAKE_ONE_IN) === 1) {
      stir(expedition, events, 'bump');
      if (expedition.wumpus === expedition.player) {
        return end(expedition, events, { kind: 'bowled-over', room: from, cause: 'it-came' });
      }
    }
    return events;
  }

  let room = to;
  if (isMagic(cave, to)) {
    room = anyRoom(random, cave.size);
    events.push({ kind: 'shimmered', from, to: room });
  } else {
    events.push({ kind: 'walked', from, to });
  }
  return arrive(expedition, events, room);
}

/** The original's arrival loop: the wumpus first, then a pit, then bats, which may carry you on. */
function arrive(expedition: Expedition, events: TurnEvent[], first: number): TurnEvent[] {
  const { cave, random } = expedition;
  let room = first;
  for (;;) {
    expedition.player = room;
    if (!expedition.visited.includes(room)) expedition.visited.push(room);
    if (room === expedition.wumpus) {
      return end(expedition, events, { kind: 'bowled-over', room, cause: 'walked-in' });
    }
    if (expedition.pits[room]) {
      if (roll(random, LEDGE_CHANCE.of) < LEDGE_CHANCE.saved) {
        expedition.ledges += 1;
        events.push({ kind: 'ledge', room });
        return events;
      }
      return end(expedition, events, { kind: 'pit', room });
    }
    if (!expedition.bats[room]) return events;
    const landing = anyRoom(random, cave.size);
    expedition.batRides += 1;
    events.push({ kind: 'carried', from: room, to: landing });
    room = landing;
  }
}

/**
 * Lets a dart fly along up to five rooms. A hop with no tunnel sends the dart down a random
 * tunnel instead and ends its flight; after its third and fourth rooms it may fall short. Only
 * the room where it comes down counts: a dart that passes through the wumpus's room misses.
 */
export function shoot(expedition: Expedition, path: readonly number[]): TurnEvent[] {
  if (expedition.ending || path.length === 0) return [];
  const events: TurnEvent[] = [];
  expedition.turns += 1;
  expedition.darts -= 1;

  const flight = fly(expedition, path);
  events.push({ kind: 'dart', flight });
  const { landed } = flight;
  if (landed === expedition.wumpus)
    return end(expedition, events, { kind: 'hushed', room: landed });
  if (landed === expedition.player) {
    return end(expedition, events, { kind: 'own-dart', room: landed });
  }
  if (expedition.darts <= 0) {
    return end(expedition, events, { kind: 'empty-quiver', room: expedition.player });
  }
  if (stirsAfterMiss(expedition)) {
    stir(expedition, events, 'miss');
    // The original printed your end here and carried on; the wumpus arriving always ends it now.
    if (expedition.wumpus === expedition.player) {
      return end(expedition, events, {
        kind: 'bowled-over',
        room: expedition.player,
        cause: 'it-came',
      });
    }
    expedition.temper = roll(expedition.random, 3);
  }
  return events;
}

function fly(expedition: Expedition, path: readonly number[]): DartFlight {
  const { cave, random } = expedition;
  const hops: DartHop[] = [];
  let at = expedition.player;
  let stop: StopReason = 'path-end';
  for (let index = 0; index < path.length; index++) {
    const roomCount = index + 1;
    if (roomCount > MAX_DART_ROOMS) {
      stop = 'too-far';
      break;
    }
    const asked = path[index]!;
    if (hasTunnel(cave, at, asked)) {
      const magic = isMagic(cave, asked);
      const to = magic ? anyRoom(random, cave.size) : asked;
      hops.push({ from: at, asked, to, kind: magic ? 'magic' : 'flew' });
      at = to;
    } else {
      const tunnel = tunnelsFrom(cave, at)[roll(random, cave.tunnelsPerRoom)]!;
      const to = isMagic(cave, tunnel) ? anyRoom(random, cave.size) : tunnel;
      hops.push({ from: at, asked, to, kind: 'deflected' });
      at = to;
      stop = 'deflected';
      break;
    }
    const chance = roll(random, 10);
    if (roomCount === STRING_BREAKS.afterRoom && chance < STRING_BREAKS.outOfTen) {
      stop = 'string-broke';
      break;
    }
    if (roomCount === DART_WAVERS.afterRoom && chance < DART_WAVERS.outOfTen) {
      stop = 'wavered';
      break;
    }
  }
  return { path, hops, stop, landed: at };
}

/**
 * Does a miss wake the wumpus? Standard plays the rule as written in the comment above it in
 * the original: a growing chance, out of 12 on the easy level and 9 on the hard one. Classic plays
 * the line as C actually reads it, `(random() % level == EASY) ? 12 : (9 < (temper += 2))`: on the
 * easy level a pure count that fires once the temper passes 9, on the hard level a coin toss that
 * wakes it at once half the time and otherwise counts.
 */
export function stirsAfterMiss(expedition: Expedition): boolean {
  const { random } = expedition;
  if (expedition.rules === 'classic') {
    const level = expedition.recipe.hard ? 2 : 1;
    if (random() % level === 1) return true;
    expedition.temper += 2;
    return 9 < expedition.temper;
  }
  const outOf = expedition.recipe.temperOutOf ?? (expedition.recipe.hard ? 9 : 12);
  expedition.temper += 2;
  return roll(random, outOf) < expedition.temper;
}

/** The wumpus lumbers down one of its tunnels; with Yob's wish it steps round pits. */
function stir(expedition: Expedition, events: TurnEvent[], why: 'bump' | 'miss'): void {
  const from = expedition.wumpus;
  expedition.wumpus = wumpusStep(expedition, from);
  events.push({ kind: 'stirred', from, to: expedition.wumpus, why });
  if (expedition.recipe.yobsWish && expedition.bats[expedition.wumpus]) {
    const landed = expedition.wumpus;
    expedition.wumpus = wumpusStep(expedition, landed);
    events.push({ kind: 'wumpus-carried', from: landed, to: expedition.wumpus });
  }
}

function wumpusStep(expedition: Expedition, from: number): number {
  const { cave, random } = expedition;
  const tunnels = tunnelsFrom(cave, from);
  if (expedition.recipe.yobsWish) {
    const safe = tunnels.filter((to) => !isMagic(cave, to) && !expedition.pits[to]);
    return safe.length === 0 ? from : safe[roll(random, safe.length)]!;
  }
  const to = tunnels[roll(random, cave.tunnelsPerRoom)]!;
  return isMagic(cave, to) ? anyRoom(random, cave.size) : to;
}
