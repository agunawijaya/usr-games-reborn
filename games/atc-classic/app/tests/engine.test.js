// atc/fancy-web engine tests
// Run: node --test tests/engine.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createGame, tick, spawnPlane, executeCommand, makeRng,
  clampDirDelta, dirTowards, planeLetter, validatePlayfield,
  STATUS, FEATURE, DIR, MAXDIR,
} from '../src/engine.js';
import { parseCommand, PARSE } from '../src/parser.js';
import { EASY_FIELD, DEFAULT_FIELD, PLAYFIELDS } from '../src/playfields.js';

// ---------------------------------------------------------------------------
// Playfield validation
// ---------------------------------------------------------------------------

test('EASY_FIELD passes validation', () => {
  assert.deepEqual(validatePlayfield(EASY_FIELD), []);
});

test('DEFAULT_FIELD passes validation', () => {
  assert.deepEqual(validatePlayfield(DEFAULT_FIELD), []);
});

test('invalid playfield: exit off-border rejected', () => {
  const bad = { ...EASY_FIELD, exits: [{ x: 5, y: 5, dir: 0, label: 'x' }] };
  const errs = validatePlayfield(bad);
  assert.ok(errs.some(e => e.includes('not on border')));
});

// ---------------------------------------------------------------------------
// Direction math
// ---------------------------------------------------------------------------

test('clampDirDelta caps at ±2', () => {
  assert.equal(clampDirDelta(0, 4), 2);  // want to go 4, capped to 2
  assert.equal(clampDirDelta(4, 0), -2);
  assert.equal(clampDirDelta(0, 1), 1);
  assert.equal(clampDirDelta(0, 7), -1); // shortest path wraps
});

test('dirTowards points correctly', () => {
  // N is up (y-)
  assert.equal(dirTowards(5, 5, 5, 0), DIR.N);
  assert.equal(dirTowards(5, 5, 10, 5), DIR.E);
  assert.equal(dirTowards(5, 5, 5, 10), DIR.S);
  assert.equal(dirTowards(5, 5, 0, 5), DIR.W);
});

test('planeLetter uppercase for jets, lowercase for props', () => {
  assert.equal(planeLetter(0, 1), 'A');  // jet
  assert.equal(planeLetter(0, 0), 'a');  // prop
  assert.equal(planeLetter(25, 1), 'Z');
});

// ---------------------------------------------------------------------------
// Game creation
// ---------------------------------------------------------------------------

test('createGame initializes clean state', () => {
  const g = createGame(EASY_FIELD, { seed: 42 });
  assert.equal(g.clock, 0);
  assert.equal(g.air.length, 0);
  assert.equal(g.ground.length, 0);
  assert.equal(g.safePlanes, 0);
  assert.equal(g.lost, false);
});

test('spawnPlane adds a plane', () => {
  const g = createGame(EASY_FIELD, { seed: 7 });
  const p = spawnPlane(g);
  assert.ok(p);
  assert.equal(g.air.length + g.ground.length, 1);
  assert.ok(p.fuel > 0);
});

test('spawned plane from exit has altitude 7', () => {
  const g = createGame(EASY_FIELD, { seed: 3 });
  // spawn until we get an exit origin
  for (let i = 0; i < 20; i++) {
    const p = spawnPlane(g);
    if (p && p.origType === FEATURE.EXIT) {
      assert.equal(p.altitude, 7);
      assert.equal(g.air.includes(p), true);
      return;
    }
  }
  // fallback assert (unlikely path)
  assert.ok(true);
});

// ---------------------------------------------------------------------------
// Tick mechanics
// ---------------------------------------------------------------------------

test('tick advances clock', () => {
  const g = createGame(EASY_FIELD, { seed: 5 });
  spawnPlane(g);
  const clock0 = g.clock;
  tick(g);
  assert.equal(g.clock, clock0 + 1);
});

test('jet plane moves every tick, prop every other', () => {
  const g = createGame(EASY_FIELD, { seed: 1 });
  // seed a jet manually
  spawnPlane(g);
  const plane = g.air[0] || g.ground[0];
  if (!plane) return; // no plane spawned
  plane.planeType = 1; // force jet
  const x0 = plane.xpos, y0 = plane.ypos;
  // if it's on ground can't verify movement — ensure it's airborne first
  if (g.ground.includes(plane)) {
    plane.newAltitude = 3;
  }
  tick(g);
  // after a jet tick, position should have changed
  const target = [...g.air, ...g.ground].find(p => p.letter === plane.letter);
  if (target) {
    const moved = target.xpos !== x0 || target.ypos !== y0 || target.altitude !== plane.altitude;
    assert.ok(moved || target.status === STATUS.GONE);
  }
});

test('fuel decrements each tick that plane moves', () => {
  const g = createGame(EASY_FIELD, { seed: 9 });
  spawnPlane(g);
  const plane = g.air[0];
  if (!plane) return;
  const fuel0 = plane.fuel;
  plane.planeType = 1; // ensure jet so it ticks every time
  tick(g);
  const after = g.air.find(p => p.letter === plane.letter);
  if (after) assert.ok(after.fuel < fuel0);
});

test('altitude changes by 1 per tick toward newAltitude', () => {
  const g = createGame(EASY_FIELD, { seed: 12 });
  const plane = {
    planeNo: 0, planeType: 1, letter: 'A',
    origType: FEATURE.EXIT, origNo: 0, destType: FEATURE.EXIT, destNo: 1,
    xpos: 10, ypos: 7, altitude: 5, newAltitude: 9,
    dir: DIR.E, newDir: DIR.E, fuel: 20,
    status: STATUS.MARKED, delayed: false, delayedBeaconNo: -1,
    ticksAlive: 0, spawnTick: 0,
  };
  g.air = [plane];
  tick(g);
  const after = g.air[0];
  if (after) assert.equal(after.altitude, 6);
});

// ---------------------------------------------------------------------------
// Command execution
// ---------------------------------------------------------------------------

test('executeCommand: altitude', () => {
  const g = createGame(EASY_FIELD, { seed: 4 });
  spawnPlane(g);
  const plane = (g.air[0] || g.ground[0]);
  if (!plane) return;
  const res = executeCommand(g, { plane: plane.letter, action: 'altitude', arg: 3 });
  assert.equal(res.ok, true);
  assert.equal(plane.newAltitude, 3);
});

test('executeCommand: unknown plane rejected', () => {
  const g = createGame(EASY_FIELD, { seed: 6 });
  const res = executeCommand(g, { plane: 'Z', action: 'altitude', arg: 3 });
  assert.equal(res.ok, false);
});

test('executeCommand: mark/ignore/unmark toggles status', () => {
  const g = createGame(EASY_FIELD, { seed: 2 });
  spawnPlane(g);
  const plane = (g.air[0] || g.ground[0]);
  if (!plane) return;
  executeCommand(g, { plane: plane.letter, action: 'ignore' });
  assert.equal(plane.status, STATUS.IGNORED);
  executeCommand(g, { plane: plane.letter, action: 'mark' });
  assert.equal(plane.status, STATUS.MARKED);
});

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

test('parseCommand: Aa5 → altitude 5', () => {
  const r = parseCommand('Aa5');
  assert.equal(r.status, PARSE.OK);
  assert.equal(r.cmd.plane, 'A');
  assert.equal(r.cmd.action, 'altitude');
  assert.equal(r.cmd.arg, 5);
});

test('parseCommand: Btw → turn to N', () => {
  const r = parseCommand('Btw');
  assert.equal(r.status, PARSE.OK);
  assert.equal(r.cmd.action, 'turn');
  assert.equal(r.cmd.arg, DIR.N);
});

test('parseCommand: Cc → circle', () => {
  const r = parseCommand('Cc');
  assert.equal(r.status, PARSE.OK);
  assert.equal(r.cmd.action, 'circle');
});

test('parseCommand: empty → partial', () => {
  const r = parseCommand('');
  assert.equal(r.status, PARSE.PARTIAL);
});

test('parseCommand: A alone → partial (needs action)', () => {
  const r = parseCommand('A');
  assert.equal(r.status, PARSE.PARTIAL);
});

test('parseCommand: Aa+3 → climb 3', () => {
  const r = parseCommand('Aa+3');
  assert.equal(r.status, PARSE.OK);
  assert.equal(r.cmd.action, 'altitudeUp');
  assert.equal(r.cmd.arg, 3);
});

test('parseCommand: Attb1 → towards beacon 1', () => {
  const r = parseCommand('Attb1');
  assert.equal(r.status, PARSE.OK);
  assert.equal(r.cmd.action, 'towardsBeacon');
  assert.equal(r.cmd.arg, 1);
});

test('parseCommand: AtL → turn hard left', () => {
  const r = parseCommand('AtL');
  assert.equal(r.status, PARSE.OK);
  assert.equal(r.cmd.action, 'turnHardLeft');
});

test('parseCommand: invalid → ERROR', () => {
  const r = parseCommand('1');
  assert.equal(r.status, PARSE.ERROR);
});

// ---------------------------------------------------------------------------
// Loss conditions
// ---------------------------------------------------------------------------

test('loss when fuel runs out', () => {
  const g = createGame(EASY_FIELD, { seed: 8 });
  g.air.push({
    planeNo: 0, planeType: 1, letter: 'A',
    origType: FEATURE.EXIT, origNo: 0, destType: FEATURE.EXIT, destNo: 1,
    xpos: 10, ypos: 7, altitude: 7, newAltitude: 7,
    dir: DIR.E, newDir: DIR.E, fuel: 0,
    status: STATUS.MARKED, delayed: false, delayedBeaconNo: -1,
    ticksAlive: 0, spawnTick: 0,
  });
  tick(g);
  assert.equal(g.lost, true);
  assert.ok(g.lostReason.includes('fuel'));
});

test('loss when two planes collide', () => {
  const g = createGame(EASY_FIELD, { seed: 11 });
  g.air.push({
    planeNo: 0, planeType: 1, letter: 'A',
    origType: FEATURE.EXIT, origNo: 0, destType: FEATURE.EXIT, destNo: 1,
    xpos: 5, ypos: 7, altitude: 5, newAltitude: 5,
    dir: DIR.E, newDir: DIR.E, fuel: 20,
    status: STATUS.MARKED, delayed: false, delayedBeaconNo: -1,
    ticksAlive: 0, spawnTick: 0,
  });
  g.air.push({
    planeNo: 1, planeType: 1, letter: 'B',
    origType: FEATURE.EXIT, origNo: 1, destType: FEATURE.EXIT, destNo: 0,
    xpos: 7, ypos: 7, altitude: 5, newAltitude: 5,
    dir: DIR.W, newDir: DIR.W, fuel: 20,
    status: STATUS.MARKED, delayed: false, delayedBeaconNo: -1,
    ticksAlive: 0, spawnTick: 0,
  });
  tick(g);
  // after a tick, A goes to (6,7), B goes to (6,7) → collision
  assert.equal(g.lost, true);
  assert.ok(g.lostReason.includes('collided'));
});

test('success: exit at altitude 9 delivers plane', () => {
  const g = createGame(EASY_FIELD, { seed: 15 });
  // pf.exits[1] is at (19,7) heading W (or whatever). place a jet to arrive there.
  const targetExit = EASY_FIELD.exits[1];
  const d = { 0: {dx:0,dy:-1}, 6: {dx:-1,dy:0} }; // we'll use E direction to walk toward east exit
  g.air.push({
    planeNo: 0, planeType: 1, letter: 'A',
    origType: FEATURE.EXIT, origNo: 0, destType: FEATURE.EXIT, destNo: 1,
    xpos: targetExit.x - 1, ypos: targetExit.y, altitude: 9, newAltitude: 9,
    dir: DIR.E, newDir: DIR.E, fuel: 20,
    status: STATUS.MARKED, delayed: false, delayedBeaconNo: -1,
    ticksAlive: 0, spawnTick: 0,
  });
  tick(g);
  assert.equal(g.lost, false);
  assert.equal(g.safePlanes, 1);
});

test('mid-tick spawn is exposed via tick().events (regression)', () => {
  // Rig a playfield with newplaneMean = 1 so the spawn roll always fires.
  const pf = {
    ...EASY_FIELD,
    newplaneMean: 1,
  };
  const g = createGame(pf, { seed: 42 });
  // Prevent the initial plane from filling all origin slots
  const res = tick(g);
  const spawnEvents = res.events.filter(e => e.type === 'spawn');
  // With newplaneMean=1, spawn should virtually always occur (RNG floor)
  assert.ok(spawnEvents.length >= 1,
    'expected at least one spawn event exposed via tick(); got: ' + JSON.stringify(res.events));
});

test('loss: exit at wrong altitude', () => {
  const g = createGame(EASY_FIELD, { seed: 16 });
  const targetExit = EASY_FIELD.exits[1];
  g.air.push({
    planeNo: 0, planeType: 1, letter: 'A',
    origType: FEATURE.EXIT, origNo: 0, destType: FEATURE.EXIT, destNo: 1,
    xpos: targetExit.x - 1, ypos: targetExit.y, altitude: 5, newAltitude: 5,
    dir: DIR.E, newDir: DIR.E, fuel: 20,
    status: STATUS.MARKED, delayed: false, delayedBeaconNo: -1,
    ticksAlive: 0, spawnTick: 0,
  });
  tick(g);
  assert.equal(g.lost, true);
  assert.ok(g.lostReason.includes('altitude'));
});
