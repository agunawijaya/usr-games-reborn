// The delay suffix: an order that waits until the plane flies over a beacon (`Atd@b0`).
// Run: node --test tests/delay.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGame, executeCommand, isOnTrack, tick, DIR, FEATURE, MAXDIR, STATUS } from '../src/engine.js';
import { parseCommand, PARSE } from '../src/parser.js';
import { EASY_FIELD } from '../src/playfields.js';

// Easy's only beacon sits at (10, 7), on the airway from exit 3 (0, 7) to exit 1 (19, 7).
const BEACON = EASY_FIELD.beacons[0];

/** A quiet sector (no new traffic) with one jet flying east along row 7, four cells short of beacon 0. */
function sectorWithJet(overrides = {}) {
  const game = createGame({ ...EASY_FIELD, newplaneMean: 1e9 }, { seed: 3 });
  const plane = {
    planeNo: 0, planeType: 1, letter: 'A',
    origType: FEATURE.EXIT, origNo: 3, destType: FEATURE.EXIT, destNo: 0,
    xpos: BEACON.x - 4, ypos: BEACON.y, altitude: 7, newAltitude: 7,
    dir: DIR.E, newDir: DIR.E, fuel: 30,
    status: STATUS.MARKED, delayed: false, delayedBeaconNo: -1,
    ticksAlive: 0, spawnTick: 0,
    ...overrides,
  };
  game.air.push(plane);
  return { game, plane };
}

function order(game, typed) {
  const parsed = parseCommand(typed);
  assert.equal(parsed.status, PARSE.OK, `${typed} parses`);
  return executeCommand(game, parsed.cmd);
}

test('a delayed turn holds the heading until the beacon, then turns', () => {
  const { game, plane } = sectorWithJet();
  assert.deepEqual(order(game, 'Atw@b0').ok, true);
  assert.equal(plane.delayed, true);
  assert.equal(plane.delayedBeaconNo, 0);
  const beaconEvents = [];
  for (let i = 0; i < 4; i++) {
    beaconEvents.push(...tick(game).events.filter((e) => e.type === 'beacon'));
    assert.equal(plane.dir, DIR.E, `still heading east after tick ${i + 1}`);
  }
  assert.deepEqual([plane.xpos, plane.ypos], [BEACON.x, BEACON.y]);
  assert.equal(plane.delayed, false);
  assert.deepEqual(beaconEvents, [{ type: 'beacon', plane: 'A', beacon: 0 }], 'the event names the beacon');
  tick(game);
  assert.equal(plane.dir, DIR.N, 'a quarter turn takes one tick, as always');
});

test('both spellings of the suffix mean the same', () => {
  assert.deepEqual(parseCommand('Atw@b0'), parseCommand('Atwab0'));
});

test('a towards order that waits is aimed from the beacon, not from the plane', () => {
  // From (6, 7) exit 0 at (10, 0) lies north-east; from the beacon at (10, 7) it lies due north.
  const { game, plane } = sectorWithJet();
  assert.equal(order(game, 'Atte0@b0').ok, true);
  assert.equal(plane.newDir, DIR.N);
});

test('only direction orders can wait', () => {
  const { game } = sectorWithJet();
  for (const typed of ['Aa9@b0', 'Am@b0', 'Ai@b0', 'Au@b0']) {
    const result = order(game, typed);
    assert.equal(result.ok, false, typed);
    assert.match(result.error, /turn or a circle/);
  }
});

test('the beacon must lie on the present track', () => {
  const north = sectorWithJet({ dir: DIR.N, newDir: DIR.N });
  assert.match(order(north.game, 'Atd@b0').error, /not on A's track/);
  const past = sectorWithJet({ xpos: BEACON.x + 2 });
  assert.match(order(past.game, 'Atw@b0').error, /not on A's track/);
  const unknown = sectorWithJet();
  assert.match(order(unknown.game, 'Atw@b4').error, /No beacon 4/);
});

test('a towards order that would gain nothing is refused', () => {
  const { game } = sectorWithJet();
  assert.match(order(game, 'Attb0@b0').error, /already be there/);
  assert.match(order(game, 'Atte1@b0').error, /already heading that way/);
});

test('a new direction replaces a waiting turn; altitude and status orders leave it', () => {
  const { game, plane } = sectorWithJet();
  order(game, 'Atw@b0');
  order(game, 'Aa9');
  order(game, 'Au');
  assert.equal(plane.delayed, true);
  order(game, 'Atc');
  assert.equal(plane.delayed, false);
  assert.equal(plane.newDir, DIR.SE);
});

test('circling can wait for a beacon too', () => {
  const { game, plane } = sectorWithJet();
  assert.equal(order(game, 'Ac@b0').ok, true);
  assert.equal(plane.newDir, MAXDIR);
});

test('isOnTrack follows straight lines in all eight directions', () => {
  const plane = { xpos: 5, ypos: 5, dir: DIR.NE };
  assert.equal(isOnTrack(plane, { x: 8, y: 2 }), true);
  assert.equal(isOnTrack(plane, { x: 8, y: 3 }), false);
  assert.equal(isOnTrack(plane, { x: 5, y: 5 }), false, 'not where it already is');
  assert.equal(isOnTrack({ ...plane, dir: DIR.W }, { x: 1, y: 5 }), true);
  assert.equal(isOnTrack({ ...plane, dir: DIR.S }, { x: 5, y: 9 }), true);
});
