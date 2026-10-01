import { describe, expect, it } from 'vitest';
import type { Arena } from './arena';
import { headingToward } from './geometry';
import { forecast } from './predict';
import { planRoute } from './route';
import { addPlane, createWorld, type Plane, type Randomness, tick, type World } from './world';

/**
 * First checks of the rules as the 1986 game wrote them (update.c, input.c). The full set of
 * faithfulness tests and golden runs comes with the engine stage.
 */

const OPEN_SKY: Arena = {
  id: 'test-sky',
  name: 'Test sky',
  width: 30,
  height: 21,
  tickSeconds: 5,
  spawnOneIn: 10,
  gates: [
    { x: 0, y: 10, heading: 2 },
    { x: 29, y: 10, heading: 6 },
  ],
  beacons: [{ x: 15, y: 10 }],
  runways: [{ x: 15, y: 15, heading: 4 }],
  airways: [],
  scenery: { seed: 'test' },
};

const NEVER: Randomness = { random: () => 1, rand: () => 1, flavour: () => 0 };

function sky(): World {
  return createWorld(OPEN_SKY, NEVER);
}

function plane(overrides: Partial<Plane>): Plane {
  return {
    letter: 0,
    kind: 'jet',
    x: 10,
    y: 10,
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

describe('headings', () => {
  it('rounds a displacement to the nearest of eight headings, as DIR_FROM_DXDY does', () => {
    expect(headingToward(0, -1)).toBe(0);
    expect(headingToward(1, -1)).toBe(1);
    expect(headingToward(1, 0)).toBe(2);
    expect(headingToward(0, 5)).toBe(4);
    expect(headingToward(-3, 0)).toBe(6);
    expect(headingToward(-2, -2)).toBe(7);
  });
});

describe('a tick', () => {
  it('moves jets every tick and props only on even ticks', () => {
    const world = sky();
    world.air.push(plane({ letter: 0, kind: 'jet', x: 5, y: 5 }));
    world.air.push(plane({ letter: 1, kind: 'prop', x: 5, y: 15 }));
    tick(world); // tick 1: odd
    expect(world.air.map((p) => p.x)).toEqual([6, 5]);
    tick(world); // tick 2: even
    expect(world.air.map((p) => p.x)).toEqual([7, 6]);
  });

  it('turns at most a quarter turn per move', () => {
    const world = sky();
    world.air.push(plane({ heading: 0, targetHeading: 4, x: 10, y: 10 }));
    tick(world);
    expect(world.air[0]!.heading).toBe(2);
  });

  it('changes altitude by one thousand feet per move', () => {
    const world = sky();
    world.air.push(plane({ altitude: 3, targetAltitude: 7 }));
    tick(world);
    expect(world.air[0]!.altitude).toBe(4);
  });

  it('loses separation within one cell and one thousand feet', () => {
    const world = sky();
    world.air.push(plane({ letter: 0, x: 10, y: 10, heading: 2, targetHeading: 2, altitude: 5 }));
    world.air.push(plane({ letter: 1, x: 13, y: 10, heading: 6, targetHeading: 6, altitude: 6 }));
    tick(world);
    expect(world.loss?.reason).toEqual({ kind: 'separation', other: 1 });
  });

  it('counts a descent to the ground away from a runway as an unsafe landing', () => {
    const world = sky();
    world.air.push(plane({ altitude: 1, targetAltitude: 0 }));
    tick(world);
    expect(world.loss?.reason.kind).toBe('ground');
  });

  it('lands a plane over its runway at 0 ft on the runway heading', () => {
    const world = sky();
    world.air.push(
      plane({
        x: 15,
        y: 14,
        heading: 4,
        targetHeading: 4,
        altitude: 1,
        targetAltitude: 0,
        destination: { kind: 'runway', index: 0 },
      }),
    );
    const events = tick(world);
    expect(world.loss).toBeNull();
    expect(world.safe).toBe(1);
    expect(events).toContainEqual({
      kind: 'arrived',
      letter: 0,
      at: { kind: 'runway', index: 0 },
      tick: 1,
    });
  });
});

describe('new planes', () => {
  it('give a fresh plane width plus height in fuel and enter a gate at 7 000 ft', () => {
    // A counting stream: a constant one would spin forever choosing an origin unlike the
    // destination, exactly as the original would.
    let n = 0;
    const counting: Randomness = { random: () => n++, rand: () => 1, flavour: () => 0 };
    const world = createWorld(OPEN_SKY, counting);
    const added = addPlane(world)!;
    expect(added.fuel).toBe(OPEN_SKY.width + OPEN_SKY.height);
    if (added.origin.kind === 'gate') expect(added.altitude).toBe(7);
    else expect(added.onGround).toBe(true);
  });
});

describe('the forecast', () => {
  it('warns of a loss of separation before it happens', () => {
    const world = sky();
    world.air.push(plane({ letter: 0, x: 8, y: 10, heading: 2, targetHeading: 2 }));
    world.air.push(plane({ letter: 1, x: 13, y: 10, heading: 6, targetHeading: 6 }));
    const ahead = forecast(world);
    expect(ahead.conflicts).toEqual([{ a: 0, b: 1, inTicks: 2, at: { x: 10.5, y: 10 } }]);
    expect(world.clock).toBe(0);
  });
});

describe('routes', () => {
  it('never asks for more than a quarter turn between cells', () => {
    const planned = planRoute(OPEN_SKY, { cell: { x: 5, y: 5 }, heading: 0 }, [{ x: 5, y: 12 }])!;
    let heading = 0;
    let from = { x: 5, y: 5 };
    for (const cell of planned.cells) {
      const next = headingToward(cell.x - from.x, cell.y - from.y);
      const turn = (((next - heading) % 8) + 8) % 8;
      expect(Math.min(turn, 8 - turn)).toBeLessThanOrEqual(2);
      heading = next;
      from = cell;
    }
    expect(planned.cells.at(-1)).toEqual({ x: 5, y: 12 });
  });
});
