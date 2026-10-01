import { HARBOUR_LIGHTS } from '../src/arenas/harbour-lights';
import { TWIN_RIVERS } from '../src/arenas/twin-rivers';
import { createRng } from '@usr-games/kit';
import { planRoute } from '../src/engine/route';
import { CARRIERS } from '../src/engine/traffic';
import type { World } from '../src/engine/world';
import type { Point } from '../src/render/features';
import type { WovenFlight } from '../src/render/tapestry';
import { stage, stagedWorld } from './stage';

/**
 * The skies behind the hero frames. Each one is a moment a real shift can reach; the conflict,
 * the ripples and the loss below are computed by the game from these positions.
 */

/** Shift 9, "Rush hour": twelve flights in the air, two waiting, B and k about to meet. */
export function rushHour(): World {
  const world = stagedWorld(HARBOUR_LIGHTS, 214);
  const add = stage.bind(null, world);
  add({
    name: 'k',
    at: { x: 22, y: 12 },
    heading: 7,
    altitude: 6,
    from: 'E4',
    to: 'E2',
    fuel: 31,
    carrier: 0,
    number: 62,
  });
  add({
    name: 'B',
    at: { x: 19, y: 10 },
    heading: 0,
    altitude: 6,
    target: 7,
    from: 'A0',
    to: 'E1',
    fuel: 40,
    carrier: 1,
    number: 418,
  });
  add({
    name: 'D',
    at: { x: 11, y: 9 },
    heading: 3,
    altitude: 3,
    target: 1,
    from: 'E1',
    to: 'A0',
    fuel: 26,
    carrier: 3,
    number: 207,
    via: ['B2', 'A0'],
  });
  add({
    name: 'm',
    at: { x: 27, y: 10 },
    heading: 5,
    altitude: 3,
    target: 2,
    from: 'E3',
    to: 'A1',
    fuel: 22,
    carrier: 2,
    number: 33,
    via: ['A1'],
  });
  add({
    name: 'c',
    at: { x: 5, y: 6 },
    heading: 2,
    altitude: 7,
    target: 9,
    from: 'E0',
    to: 'E3',
    fuel: 46,
    carrier: 7,
    number: 590,
    via: ['B0', 'B1', 'E3'],
  });
  add({
    name: 'F',
    at: { x: 9, y: 17 },
    heading: 1,
    altitude: 4,
    target: 2,
    from: 'E6',
    to: 'A0',
    fuel: 30,
    role: 'medical',
    number: 4,
    via: ['B2', 'A0'],
  });
  add({
    name: 'h',
    at: { x: 16, y: 3 },
    heading: 5,
    altitude: 8,
    from: 'E2',
    to: 'E6',
    fuel: 38,
    carrier: 4,
    number: 711,
  });
  add({
    name: 'Q',
    at: { x: 3, y: 12 },
    heading: 2,
    altitude: 7,
    from: 'E7',
    to: 'E3',
    fuel: 44,
    role: 'mail',
    number: 312,
  });
  add({
    name: 't',
    at: { x: 18, y: 14 },
    heading: 6,
    altitude: 4,
    target: 9,
    from: 'A1',
    to: 'E0',
    fuel: 43,
    carrier: 6,
    number: 88,
  });
  add({
    name: 'w',
    at: { x: 25, y: 17 },
    heading: 7,
    altitude: 7,
    from: 'E5',
    to: 'E1',
    fuel: 12,
    carrier: 5,
    number: 145,
  });
  add({
    name: 'R',
    at: { x: 20, y: 2 },
    heading: 4,
    altitude: 6,
    target: 4,
    from: 'E2',
    to: 'A0',
    fuel: 35,
    carrier: 8,
    number: 26,
    via: ['B1', 'B2', 'A0'],
  });
  add({
    name: 'y',
    at: { x: 3, y: 8 },
    heading: 1,
    altitude: 8,
    target: 9,
    from: 'E7',
    to: 'E1',
    fuel: 40,
    carrier: 9,
    number: 402,
  });
  add({
    name: 'N',
    at: { x: 23, y: 14 },
    heading: 6,
    altitude: 0,
    from: 'A1',
    to: 'E7',
    fuel: 51,
    carrier: 1,
    number: 77,
    onGround: true,
  });
  add({
    name: 'v',
    at: { x: 14, y: 16 },
    heading: 4,
    altitude: 0,
    from: 'A0',
    to: 'E3',
    fuel: 51,
    carrier: 0,
    number: 9,
    onGround: true,
  });
  world.safe = 14;
  world.lastLetter = 24;
  return world;
}

/**
 * Twin Rivers at the third landing in a row: one plane has just touched down on A0, and three
 * more are lined up to keep the string going on alternate runways.
 */
export function stringOfPearls(): World {
  const world = stagedWorld(TWIN_RIVERS, 342);
  const add = stage.bind(null, world);
  add({
    name: 'e',
    at: { x: 19, y: 11 },
    heading: 6,
    altitude: 1,
    target: 0,
    from: 'E1',
    to: 'A1',
    fuel: 19,
    carrier: 3,
    number: 506,
    wake: 5,
  });
  add({
    name: 'g',
    at: { x: 20, y: 8 },
    heading: 6,
    altitude: 2,
    target: 0,
    from: 'E0',
    to: 'A0',
    fuel: 24,
    carrier: 2,
    number: 71,
    wake: 5,
  });
  add({
    name: 'j',
    at: { x: 21, y: 11 },
    heading: 6,
    altitude: 3,
    target: 0,
    from: 'E1',
    to: 'A1',
    fuel: 21,
    carrier: 0,
    number: 230,
    wake: 5,
  });
  add({
    name: 'p',
    at: { x: 26, y: 5 },
    heading: 5,
    altitude: 5,
    target: 3,
    from: 'E0',
    to: 'A0',
    fuel: 33,
    carrier: 4,
    number: 18,
    via: ['B0', 'A0'],
  });
  add({
    name: 'L',
    at: { x: 27, y: 14 },
    heading: 7,
    altitude: 6,
    target: 4,
    from: 'E1',
    to: 'A1',
    fuel: 36,
    carrier: 8,
    number: 309,
    via: ['B1', 'A1'],
  });
  add({
    name: 'u',
    at: { x: 13, y: 10 },
    heading: 6,
    altitude: 5,
    target: 9,
    from: 'A0',
    to: 'E3',
    fuel: 44,
    carrier: 9,
    number: 92,
    via: ['B2', 'E3'],
  });
  add({
    name: 'H',
    at: { x: 4, y: 14 },
    heading: 2,
    altitude: 7,
    from: 'E3',
    to: 'E6',
    fuel: 41,
    role: 'mail',
    number: 118,
  });
  add({
    name: 's',
    at: { x: 15, y: 4 },
    heading: 6,
    altitude: 8,
    from: 'E6',
    to: 'E2',
    fuel: 34,
    carrier: 6,
    number: 640,
  });
  world.safe = 21;
  world.lastLetter = 20;
  return world;
}

/**
 * A finished Rush hour shift for the tapestry: twenty-four flights between gates and runways,
 * each flown along the route the planner gives it, through a beacon when one lies on the way.
 */
export function wovenShift(): { flights: WovenFlight[]; knots: Point[] } {
  const arena = HARBOUR_LIGHTS;
  const rng = createRng('skyloom:shift-9:woven');
  const places = [
    ...arena.gates.map((_, index) => ({ kind: 'gate' as const, index })),
    ...arena.runways.map((_, index) => ({ kind: 'runway' as const, index })),
  ];
  const flights: WovenFlight[] = [];
  let attempts = 0;
  while (flights.length < 24 && attempts < 400) {
    attempts += 1;
    const from = rng.pick(places);
    const to = rng.pick(places);
    if (from.kind === to.kind && from.index === to.index) continue;
    const start = from.kind === 'gate' ? arena.gates[from.index]! : arena.runways[from.index]!;
    const end = to.kind === 'gate' ? arena.gates[to.index]! : arena.runways[to.index]!;
    const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const beacon = [...arena.beacons].sort(
      (a, b) =>
        Math.hypot(a.x - middle.x, a.y - middle.y) - Math.hypot(b.x - middle.x, b.y - middle.y),
    )[0]!;
    const waypoints = rng.chance(0.65) ? [beacon, end] : [end];
    const planned = planRoute(arena, { cell: start, heading: start.heading }, waypoints, {
      arriveHeading: to.kind === 'runway' ? arena.runways[to.index]!.heading : undefined,
      endsAtGate: to.kind === 'gate',
    });
    if (!planned || planned.cells.length < 6) continue;
    const roll = rng.int(0, 11);
    flights.push({
      track: [{ x: start.x, y: start.y }, ...planned.cells],
      hue: CARRIERS[rng.int(0, CARRIERS.length - 1)]!.hue,
      role: roll === 0 ? 'medical' : roll === 1 ? 'mail' : 'scheduled',
      ending: to.kind === 'runway' ? 'landed' : 'exited',
    });
  }
  // Two near-misses: cells two flights shared, tied off as knots.
  const shared: Point[] = [];
  for (let a = 0; a < flights.length && shared.length < 2; a += 5) {
    for (let b = a + 1; b < flights.length && shared.length < 2; b++) {
      const meeting = flights[a]!.track.find((c) =>
        flights[b]!.track.some((d) => d.x === c.x && d.y === c.y && c.x > 3 && c.y > 3),
      );
      if (meeting) shared.push({ x: meeting.x + 0.5, y: meeting.y + 0.5 });
    }
  }
  return { flights, knots: shared };
}
