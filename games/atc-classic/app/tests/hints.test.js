// atc/fancy-web hints tests
// Run: node --test tests/hints.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hintForPlane } from '../src/hints.js';
import { DIR, FEATURE, STATUS } from '../src/engine.js';
import { EASY_FIELD } from '../src/playfields.js';

function makePlane(overrides = {}) {
  // Default newAltitude / newDir to match altitude / dir. Tests that need
  // divergent commanded values (i.e. "plane commanded but not yet reached
  // target") can override them explicitly.
  const alt = overrides.altitude ?? 5;
  const dir = overrides.dir ?? DIR.E;
  return {
    planeNo: 0, planeType: 1, letter: 'A',
    origType: FEATURE.EXIT, origNo: 0,
    destType: FEATURE.EXIT, destNo: 1,
    xpos: 10, ypos: 7,
    altitude: alt,
    newAltitude: overrides.newAltitude ?? alt,
    dir: dir,
    newDir: overrides.newDir ?? dir,
    fuel: 25,
    status: STATUS.MARKED,
    delayed: false, delayedBeaconNo: -1,
    ticksAlive: 0, spawnTick: 0,
    ...overrides,
  };
}

test('ground plane suggests takeoff (a+7)', () => {
  const p = makePlane({ altitude: 0, origType: FEATURE.AIRPORT, origNo: 0 });
  const hint = hintForPlane(p, EASY_FIELD, true);
  assert.equal(hint.priority, 'normal');
  assert.equal(hint.tag, 'READY');
  assert.equal(hint.command, 'Aa+7');
});

test('exit-bound plane at wrong altitude → climb to 9', () => {
  const p = makePlane({ destType: FEATURE.EXIT, destNo: 1, altitude: 5, fuel: 25 });
  const hint = hintForPlane(p, EASY_FIELD, false);
  assert.equal(hint.priority, 'normal');
  assert.equal(hint.tag, 'CLIMB');
  assert.equal(hint.command, 'Aa9');
});

test('exit-bound plane at alt 9 but off heading → tte', () => {
  // Exit 1 is at (19, 7) on EASY. Plane at (10,7) heading N → not pointed at exit.
  const p = makePlane({
    destType: FEATURE.EXIT, destNo: 1,
    xpos: 10, ypos: 7, altitude: 9, dir: DIR.N,
  });
  const hint = hintForPlane(p, EASY_FIELD, false);
  assert.equal(hint.priority, 'normal');
  assert.equal(hint.tag, 'HEADING');
  assert.equal(hint.command, 'Atte1');
});

test('exit-bound plane on course → ok', () => {
  const p = makePlane({
    destType: FEATURE.EXIT, destNo: 1,
    xpos: 10, ypos: 7, altitude: 9, dir: DIR.E,
  });
  const hint = hintForPlane(p, EASY_FIELD, false);
  assert.equal(hint.priority, 'ok');
  assert.equal(hint.command, null);
});

test('fuel critical → urgent direct-to-dest', () => {
  const p = makePlane({ fuel: 5, destType: FEATURE.EXIT, destNo: 1 });
  const hint = hintForPlane(p, EASY_FIELD, false);
  assert.equal(hint.priority, 'urgent');
  assert.equal(hint.tag, 'FUEL');
  assert.ok(hint.command.startsWith('Atte'));
});

test('imminent wall → urgent turn away from border', () => {
  // Plane at (0, 5) heading W: next tick x=-1, out of bounds, and no exit here.
  const p = makePlane({
    xpos: 0, ypos: 5, dir: DIR.W, altitude: 5, fuel: 25,
    destType: FEATURE.EXIT, destNo: 1,
  });
  const hint = hintForPlane(p, EASY_FIELD, false);
  assert.equal(hint.priority, 'urgent');
  assert.equal(hint.tag, 'WALL');
});

test('one cell short of destination exit at correct altitude → on course', () => {
  // Plane at (18, 7) heading E, altitude 9, dest exit 1 at (19, 7).
  // Next tick lands exactly on the exit.
  const p = makePlane({
    xpos: 18, ypos: 7, dir: DIR.E, altitude: 9, fuel: 25,
    destType: FEATURE.EXIT, destNo: 1,
  });
  const hint = hintForPlane(p, EASY_FIELD, false);
  assert.equal(hint.priority, 'ok');
});


test('airport-bound: far and TOO LOW → CLIMB first (safety over heading)', () => {
  // Airport 0 in EASY is at (5, 5) SE. Plane at (15, 10) alt 3 far away.
  // Distance is 10, so alt 3 is way below glidepath and plane will crash
  // before arriving. Hint must prioritise CLIMB over HEADING.
  const p = makePlane({
    destType: FEATURE.AIRPORT, destNo: 0,
    xpos: 15, ypos: 10, altitude: 3, dir: DIR.N,
  });
  const hint = hintForPlane(p, EASY_FIELD, false);
  assert.equal(hint.tag, 'CLIMB');
  assert.equal(hint.priority, 'urgent');
});

test('airport-bound: far off approach line → route via WAYPOINT', () => {
  // Airport 0 in EASY is at (5, 5) SE-runway. Plane at (15, 10) is NOT
  // on the approach line (opposite side of runway direction), so cheat
  // routes to an approach-line cell first, then aligns runway heading.
  const p = makePlane({
    destType: FEATURE.AIRPORT, destNo: 0,
    xpos: 15, ypos: 10, altitude: 9, dir: DIR.N,
  });
  const hint = hintForPlane(p, EASY_FIELD, false);
  assert.equal(hint.tag, 'WAYPOINT');
});

test('airport-bound: right over airport, altitude 0, wrong heading → align runway', () => {
  // Airport 0 at (5,5) with runway direction SE.
  const p = makePlane({
    destType: FEATURE.AIRPORT, destNo: 0,
    xpos: 5, ypos: 5, altitude: 0, dir: DIR.N,   // wrong heading
  });
  const hint = hintForPlane(p, EASY_FIELD, false);
  assert.equal(hint.priority, 'urgent');
  assert.equal(hint.tag, 'ALIGN');
  // c = SE compass key
  assert.equal(hint.command, 'Atc');
});

test('airport-bound: at airport altitude > 0 → touchdown command', () => {
  const p = makePlane({
    destType: FEATURE.AIRPORT, destNo: 0,
    xpos: 5, ypos: 5, altitude: 3, dir: DIR.SE,
  });
  const hint = hintForPlane(p, EASY_FIELD, false);
  assert.equal(hint.priority, 'urgent');
  assert.equal(hint.tag, 'TOUCHDOWN');
  assert.equal(hint.command, 'Aa0');
});

test('after Aa9 command: altitude commanded but not reached → hint moves past altitude', () => {
  // Plane at altitude 5, newAltitude commanded to 9 (i.e., player just typed Aa9).
  // Position pointed correctly. Hint should NOT re-suggest Aa9 — it should
  // acknowledge command and either move to heading suggestion or ON COURSE/EXECUTING.
  const p = makePlane({
    destType: FEATURE.EXIT, destNo: 1,
    xpos: 10, ypos: 7, altitude: 5, newAltitude: 9, dir: DIR.E, newDir: DIR.E,
  });
  const hint = hintForPlane(p, EASY_FIELD, false);
  assert.notEqual(hint.tag, 'CLIMB', 'should not re-suggest CLIMB after Aa9 already commanded');
  assert.equal(hint.command, null, 'no new command needed');
});

test('altitude commanded but wrong heading → suggest heading next', () => {
  const p = makePlane({
    destType: FEATURE.EXIT, destNo: 1,
    xpos: 10, ypos: 7, altitude: 5, newAltitude: 9, dir: DIR.N, newDir: DIR.N,
  });
  const hint = hintForPlane(p, EASY_FIELD, false);
  assert.equal(hint.tag, 'HEADING');
  assert.equal(hint.command, 'Atte1');
});

test('EXECUTING tag when plane converging on commanded state', () => {
  const p = makePlane({
    destType: FEATURE.EXIT, destNo: 1,
    xpos: 10, ypos: 7, altitude: 6, newAltitude: 9,   // still climbing
    dir: DIR.E, newDir: DIR.E,
  });
  const hint = hintForPlane(p, EASY_FIELD, false);
  assert.equal(hint.priority, 'ok');
  assert.equal(hint.tag, 'EXECUTING');
  assert.ok(hint.explain.includes('climbing'), 'explain should mention climbing');
});

test('airport-bound: plane past SE-runway airport is NOT on approach line → routes back', () => {
  // Airport 0 at (5,5) runway SE. Plane at (6,6) is SE of airport — on
  // the wrong side of the runway. Cheat should NOT try to land it; instead
  // steer to the approach line (opposite side).
  const p = makePlane({
    destType: FEATURE.AIRPORT, destNo: 0,
    xpos: 6, ypos: 6, altitude: 4, dir: DIR.SE,
  });
  const hint = hintForPlane(p, EASY_FIELD, false);
  // Should be WAYPOINT routing (or CLIMB if urgent altitude issue).
  assert.ok(hint.tag === 'WAYPOINT' || hint.tag === 'CLIMB',
    `expected WAYPOINT or CLIMB routing, got ${hint.tag}`);
});
