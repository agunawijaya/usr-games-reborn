import { describe, expect, it } from 'vitest';
import type { Arena } from './arena';
import { giveOrder, readLine } from './commands';
import { createWorld, type Plane, type World } from './world';

/** Terminal mode: the 1986 grammar, read key by key, with Skyloom's additions and fixes. */

const SKY: Arena = {
  id: 'terminal-sky',
  name: 'Terminal sky',
  width: 30,
  height: 21,
  tickSeconds: 5,
  spawnOneIn: 10,
  gates: [
    { x: 0, y: 10, heading: 2 },
    { x: 29, y: 10, heading: 6 },
  ],
  beacons: [{ x: 15, y: 10 }],
  runways: [{ x: 10, y: 15, heading: 4 }],
  airways: [],
  scenery: { seed: 'terminal' },
};

function sky(...planes: Partial<Plane>[]): World {
  const w = createWorld(SKY, { random: () => 1, rand: () => 1, flavour: () => 0 });
  planes.forEach((p, i) =>
    w.air.push({
      letter: i,
      kind: 'jet',
      x: 8,
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
      ...p,
    }),
  );
  return w;
}

describe('reading a line', () => {
  it('echoes each key as words of its own', () => {
    const state = readLine(sky({}), 'atl');
    expect(state.kind).toBe('reading');
    if (state.kind === 'reading') expect(state.echo.words).toBe('a: heading left');
  });

  it('lists the choices at any point with ?', () => {
    const state = readLine(sky({}), 'a?');
    expect(state.kind).toBe('reading');
    if (state.kind === 'reading') expect(state.choices).toContain('c hold');
  });

  it('refuses a key that does not fit, and says what would', () => {
    const state = readLine(sky({}), 'ak');
    expect(state.kind).toBe('error');
    if (state.kind === 'error') {
      expect(state.reason).toBe('key');
      expect(state.at).toBe(1);
      expect(state.choices).toContain('t heading');
    }
  });

  it('refuses an order that cannot be given, in plain words', () => {
    const state = readLine(sky({}), 'b');
    expect(state).toMatchObject({
      kind: 'error',
      reason: 'rule',
      message: 'There is no plane b in the sky',
    });
  });

  it('opens the shell with !, as a wink at the original loophole', () => {
    expect(readLine(sky({}), 'a!').kind).toBe('shell');
  });
});

describe('Skyloom additions', () => {
  it('holds left with cl and right with cr, as the manual promised', () => {
    const left = readLine(sky({}), 'acl\n');
    const right = readLine(sky({}), 'acr\n');
    expect(left.kind === 'order' && left.order.draft.hold).toBe('left');
    expect(right.kind === 'order' && right.order.draft.hold).toBe('right');
  });

  it('holds right with a plain c, as the original circled', () => {
    const state = readLine(sky({}), 'ac\n');
    expect(state.kind === 'order' && state.order.draft.hold).toBe('right');
  });

  it('says so when a relative change would change nothing (the original never could)', () => {
    expect(readLine(sky({}), 'aa+0\n')).toMatchObject({
      kind: 'error',
      message: 'That would not change its altitude',
    });
  });
});

describe('the original grammar, kept', () => {
  it('reads a after a relative turn as “at”, never as 270°, as the original table did', () => {
    const state = readLine(sky({}), 'atla');
    expect(state.kind === 'reading' && state.echo.words).toBe('a: heading left at');
  });

  it('refuses a delay at a beacon that is not ahead', () => {
    const state = readLine(sky({ x: 20, y: 10 }), 'atw@b0\n');
    expect(state).toMatchObject({
      kind: 'error',
      message: 'That beacon is not ahead of the plane',
    });
  });

  it('turns towards a place from the beacon when the order has both', () => {
    const state = readLine(sky({ x: 8, y: 10 }), 'atta0@b0\n');
    expect(
      state.kind === 'order' && [state.order.draft.waitForBeacon, state.order.draft.targetHeading],
    ).toEqual([0, 5]);
  });

  it('refuses turns, holds and marks for a plane on the ground', () => {
    const w = sky({ altitude: 0, targetAltitude: 0, onGround: true });
    expect(readLine(w, 'atx\n')).toMatchObject({ message: 'A plane on the ground cannot turn' });
    expect(readLine(w, 'ac\n')).toMatchObject({ message: 'A plane on the ground cannot hold' });
    expect(readLine(w, 'am\n')).toMatchObject({ message: 'Only planes in the air can be marked' });
  });

  it('keeps altitudes between the ground and the ceiling', () => {
    expect(readLine(sky({ altitude: 8 }), 'aa+2\n')).toMatchObject({
      message: 'That is above the 9 000 ft ceiling',
    });
    expect(readLine(sky({ altitude: 1 }), 'aa-2\n')).toMatchObject({
      message: 'That is below the ground',
    });
  });

  it('changes only the part of the plane the order is about', () => {
    const w = sky({ route: [{ x: 9, y: 10 }], waitForBeacon: 0 });
    const climb = readLine(w, 'aa7\n');
    if (climb.kind === 'order') giveOrder(w, climb.order);
    expect([w.air[0]!.targetAltitude, w.air[0]!.route.length, w.air[0]!.waitForBeacon]).toEqual([
      7, 1, 0,
    ]);
    const turn = readLine(w, 'atx\n');
    if (turn.kind === 'order') giveOrder(w, turn.order);
    expect([w.air[0]!.targetHeading, w.air[0]!.route.length, w.air[0]!.waitForBeacon]).toEqual([
      4,
      0,
      null,
    ]);
  });
});
