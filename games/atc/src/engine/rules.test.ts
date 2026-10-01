import { describe, expect, it } from 'vitest';
import type { Arena } from './arena';
import { giveOrder, readLine } from './commands';
import {
  addPlane,
  createWorld,
  type LossReason,
  nextLetter,
  type Plane,
  type Randomness,
  tick,
  type World,
} from './world';

/**
 * One test for each rule of the 1986 game that prompt 02 §2 lists, in the order it lists them.
 * The golden runs (golden.test.ts) check the same rules together against the original program.
 */

const SKY: Arena = {
  id: 'rules-sky',
  name: 'Rules sky',
  width: 30,
  height: 21,
  tickSeconds: 5,
  spawnOneIn: 10,
  gates: [
    { x: 0, y: 10, heading: 2 },
    { x: 29, y: 10, heading: 6 },
    { x: 15, y: 0, heading: 4 },
  ],
  beacons: [{ x: 15, y: 10 }],
  runways: [
    { x: 10, y: 15, heading: 4 },
    { x: 20, y: 15, heading: 2 },
  ],
  airways: [],
  scenery: { seed: 'rules' },
};

const QUIET: Randomness = { random: () => 1, rand: () => 1, flavour: () => 0 };

function world(): World {
  return createWorld(SKY, QUIET);
}

function plane(overrides: Partial<Plane>): Plane {
  return {
    letter: 0,
    kind: 'jet',
    x: 15,
    y: 5,
    altitude: 5,
    targetAltitude: 5,
    heading: 2,
    targetHeading: 2,
    hold: null,
    fuel: 51,
    origin: { kind: 'gate', index: 0 },
    destination: { kind: 'gate', index: 1 },
    status: 'marked',
    waitForBeacon: null,
    onGround: false,
    route: [],
    flight: { carrier: { name: 'Test', code: 'TS', hue: 0 }, number: 1, role: 'scheduled' },
    track: [],
    ...overrides,
  };
}

function lossOf(w: World): LossReason['kind'] | undefined {
  return w.loss?.reason.kind;
}

function order(w: World, keys: string): void {
  const state = readLine(w, `${keys}\n`);
  if (state.kind !== 'order') throw new Error(`${keys}: ${JSON.stringify(state)}`);
  giveOrder(w, state.order);
}

describe('the grid and its headings', () => {
  it('moves along eight headings, counted clockwise from north', () => {
    const w = world();
    w.air.push(plane({ heading: 3, targetHeading: 3, x: 5, y: 5 }));
    tick(w);
    expect([w.air[0]!.x, w.air[0]!.y]).toEqual([6, 6]);
  });

  it('flies between 0 and 9 000 ft and loses a plane that goes above', () => {
    const w = world();
    w.air.push(plane({ altitude: 9, targetAltitude: 10 }));
    tick(w);
    expect(lossOf(w)).toBe('ceiling');
  });
});

describe('speed and turning', () => {
  it('moves jets every tick and props only every other tick', () => {
    const w = world();
    w.air.push(
      plane({ letter: 0, kind: 'jet', x: 5, y: 3 }),
      plane({ letter: 1, kind: 'prop', x: 5, y: 7 }),
    );
    for (let i = 0; i < 4; i++) tick(w);
    expect(w.air.map((p) => p.x)).toEqual([9, 7]);
  });

  it('turns at most 90° a move, so a reversal takes two moves (from east, by the right)', () => {
    const w = world();
    w.air.push(plane({ heading: 2, targetHeading: 6 }));
    tick(w);
    expect(w.air[0]!.heading).toBe(4);
    tick(w);
    expect(w.air[0]!.heading).toBe(6);
  });
});

describe('arrivals', () => {
  it('brings planes in at a gate at 7 000 ft, and on the ground at a runway', () => {
    let n = 0;
    const w = createWorld(SKY, { random: () => n++, rand: () => 0, flavour: () => 0 });
    const first = addPlane(w)!;
    const second = addPlane(w)!;
    for (const p of [first, second]) {
      if (p.origin.kind === 'gate') expect([p.altitude, p.onGround]).toEqual([7, false]);
      else expect([p.altitude, p.onGround]).toEqual([0, true]);
    }
  });

  it('keeps a gate closed while a plane is within four cells and 4 000 ft of it', () => {
    // Destination 1, then the origin draw lands on gate 0 every time: it stays closed.
    const draws = [0, 1, 0, 0, 0, 0, 0, 0];
    const w = createWorld(SKY, {
      random: () => draws.shift() ?? 0,
      rand: () => 0,
      flavour: () => 0,
    });
    w.air.push(plane({ x: 3, y: 12, altitude: 6 }));
    expect(addPlane(w)).toBeNull();
  });

  it('never checks a runway before putting a plane there', () => {
    // Destination 0, origin index 3 = runway 0, while a plane sits right above it.
    const draws = [0, 0, 3];
    const w = createWorld(SKY, {
      random: () => draws.shift() ?? 0,
      rand: () => 0,
      flavour: () => 0,
    });
    w.air.push(plane({ x: 10, y: 14, altitude: 1 }));
    expect(addPlane(w)?.onGround).toBe(true);
  });

  it('fills the tank with width plus height moves of fuel', () => {
    let n = 0;
    const w = createWorld(SKY, { random: () => n++, rand: () => 0, flavour: () => 0 });
    expect(addPlane(w)!.fuel).toBe(SKY.width + SKY.height);
  });

  it('rolls for a new plane on every tick, odd or even', () => {
    let rolls = 0;
    const w = createWorld(SKY, { random: () => 1, rand: () => (rolls++, 1), flavour: () => 0 });
    for (let i = 0; i < 6; i++) tick(w);
    expect(rolls).toBe(6);
  });

  it('names planes by letter, so no more than 26 fly at once', () => {
    const w = world();
    for (let i = 0; i < 26; i++)
      w.air.push(plane({ letter: i, x: 1 + (i % 5) * 5, y: 1 + Math.floor(i / 5) * 3 }));
    expect(nextLetter(w)).toBe(-1);
  });
});

describe('destinations', () => {
  it('lets a plane leave only through its own gate at exactly 9 000 ft', () => {
    const w = world();
    w.air.push(
      plane({ x: 28, y: 10, heading: 2, targetHeading: 2, altitude: 9, targetAltitude: 9 }),
    );
    tick(w);
    expect([w.safe, w.loss]).toEqual([1, null]);
  });

  it('loses a plane that reaches its gate below 9 000 ft', () => {
    const w = world();
    w.air.push(plane({ x: 28, y: 10, altitude: 8, targetAltitude: 8 }));
    tick(w);
    expect(lossOf(w)).toBe('wrong-exit-altitude');
  });

  it('lands a plane over its runway at 0 ft along the runway heading', () => {
    const w = world();
    w.air.push(
      plane({
        x: 10,
        y: 14,
        heading: 4,
        targetHeading: 4,
        altitude: 1,
        targetAltitude: 0,
        destination: { kind: 'runway', index: 0 },
      }),
    );
    tick(w);
    expect([w.safe, w.loss]).toEqual([1, null]);
  });

  it('loses a plane that lands across its runway', () => {
    const w = world();
    w.air.push(
      plane({
        x: 9,
        y: 15,
        heading: 2,
        targetHeading: 2,
        altitude: 1,
        targetAltitude: 0,
        destination: { kind: 'runway', index: 0 },
      }),
    );
    tick(w);
    expect(lossOf(w)).toBe('wrong-landing-heading');
  });
});

describe('the ways a shift ends', () => {
  const cases: [string, Partial<Plane>, LossReason['kind']][] = [
    ['fuel runs out', { fuel: 0 }, 'fuel'],
    ['it comes down away from a runway', { altitude: 1, targetAltitude: 0 }, 'ground'],
    [
      'it lands on another runway',
      {
        x: 20,
        y: 14,
        heading: 4,
        targetHeading: 4,
        altitude: 1,
        targetAltitude: 0,
        destination: { kind: 'runway', index: 0 },
      },
      'wrong-runway',
    ],
    [
      'it lands when it should leave',
      { x: 20, y: 14, heading: 4, targetHeading: 4, altitude: 1, targetAltitude: 0 },
      'landed-not-exited',
    ],
    [
      'it leaves by another gate',
      { x: 1, y: 10, heading: 6, targetHeading: 6, altitude: 9, targetAltitude: 9 },
      'wrong-gate',
    ],
    [
      'it leaves when it should land',
      { x: 28, y: 10, altitude: 9, targetAltitude: 9, destination: { kind: 'runway', index: 0 } },
      'exited-not-landed',
    ],
    ['it crosses the border off a gate', { x: 28, y: 5 }, 'left-arena'],
  ];
  for (const [what, overrides, kind] of cases) {
    it(`when ${what}`, () => {
      const w = world();
      w.air.push(plane(overrides));
      tick(w);
      expect(lossOf(w)).toBe(kind);
    });
  }

  it('when two planes come within a cell and 1 000 ft, naming the first in letter order', () => {
    const w = world();
    w.air.push(
      plane({ letter: 2, x: 10, y: 5, altitude: 5 }),
      plane({ letter: 7, x: 13, y: 5, heading: 6, targetHeading: 6, altitude: 6 }),
    );
    tick(w);
    expect(w.loss?.letter).toBe(2);
    expect(w.loss?.reason).toEqual({ kind: 'separation', other: 7 });
  });
});

describe('orders', () => {
  it('sets an altitude absolutely or relative to the current one', () => {
    const w = world();
    w.air.push(plane({ altitude: 5, targetAltitude: 5 }));
    order(w, 'aa8');
    expect(w.air[0]!.targetAltitude).toBe(8);
    order(w, 'aa-3');
    expect(w.air[0]!.targetAltitude).toBe(2);
  });

  it('turns to a heading, relative to the current one, a hard 90°, or towards a beacon, gate or runway', () => {
    const w = world();
    w.air.push(plane({ x: 5, y: 5, heading: 2, targetHeading: 2 }));
    order(w, 'atx');
    expect(w.air[0]!.targetHeading).toBe(4);
    order(w, 'atl');
    expect(w.air[0]!.targetHeading).toBe(1);
    order(w, 'atR');
    expect(w.air[0]!.targetHeading).toBe(4);
    order(w, 'attb0');
    expect(w.air[0]!.targetHeading).toBe(3);
  });

  it('circles clockwise: a quarter turn right every move', () => {
    const w = world();
    w.air.push(plane({ x: 10, y: 5, heading: 0, targetHeading: 0 }));
    order(w, 'ac');
    const headings: number[] = [];
    for (let i = 0; i < 4; i++) {
      tick(w);
      headings.push(w.air[0]!.heading);
    }
    expect(headings).toEqual([2, 4, 6, 0]);
  });

  it('delays a turn until the plane reaches a beacon on its way', () => {
    const w = world();
    w.air.push(plane({ x: 12, y: 10, heading: 2, targetHeading: 2 }));
    order(w, 'atw@b0');
    tick(w);
    tick(w);
    expect(w.air[0]!.heading).toBe(2);
    tick(w);
    expect([w.air[0]!.x, w.air[0]!.waitForBeacon]).toEqual([15, null]);
    tick(w);
    expect(w.air[0]!.heading).toBe(0);
  });

  it('marks, unmarks and ignores a plane', () => {
    const w = world();
    w.air.push(plane({}));
    order(w, 'au');
    expect(w.air[0]!.status).toBe('unmarked');
    order(w, 'ai');
    expect(w.air[0]!.status).toBe('ignored');
    order(w, 'am');
    expect(w.air[0]!.status).toBe('marked');
  });

  it('advances time at once on an empty line', () => {
    expect(readLine(world(), '\n').kind).toBe('tick');
  });

  it('launches a plane on the ground on the tick it is told to climb', () => {
    const w = world();
    w.ground.push(
      plane({
        x: 10,
        y: 15,
        heading: 4,
        targetHeading: 4,
        altitude: 0,
        targetAltitude: 0,
        onGround: true,
        origin: { kind: 'runway', index: 0 },
      }),
    );
    order(w, 'aa3');
    tick(w);
    expect([w.ground.length, w.air[0]!.y, w.air[0]!.altitude]).toEqual([0, 16, 1]);
  });
});
