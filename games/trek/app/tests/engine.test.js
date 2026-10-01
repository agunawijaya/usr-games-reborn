// trek/fancy-web engine tests
// Run: node --test tests/*.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGame, executeCommand, snapshot, SYSTEM_ORDER, SYS } from '../src/engine.js';
import { createGalaxy, makeRng, populateQuadrant, GALAXY_SIZE, QUADRANT_SIZE, CELL, DIFFICULTY } from '../src/galaxy.js';

// ---------------------------------------------------------------------------
// Galaxy
// ---------------------------------------------------------------------------

test('createGalaxy: klingon count matches difficulty', () => {
  const rng = makeRng(42);
  const g = createGalaxy(rng, 'standard');
  let total = 0;
  for (let y = 0; y < GALAXY_SIZE; y++) {
    for (let x = 0; x < GALAXY_SIZE; x++) total += g.quadrants[y][x].klingons;
  }
  assert.equal(total, DIFFICULTY.standard.klingons);
});

test('populateQuadrant seeds sectors correctly', () => {
  const rng = makeRng(7);
  const galaxy = createGalaxy(rng, 'novice');
  // pick a quadrant with klingons
  let target = null;
  outer: for (let y = 0; y < GALAXY_SIZE; y++) {
    for (let x = 0; x < GALAXY_SIZE; x++) {
      if (galaxy.quadrants[y][x].klingons > 0) {
        target = { x, y };
        break outer;
      }
    }
  }
  assert.ok(target, 'test needs at least one klingon quadrant');
  const contents = populateQuadrant(galaxy, target.x, target.y, rng, { x: 5, y: 5 });
  assert.equal(contents.klingons.length, galaxy.quadrants[target.y][target.x].klingons);
});

// ---------------------------------------------------------------------------
// Game creation
// ---------------------------------------------------------------------------

test('createGame produces valid initial state', () => {
  const g = createGame({ difficulty: 'novice', seed: 100 });
  assert.equal(g.difficulty, 'novice');
  assert.equal(g.won, false);
  assert.equal(g.lost, false);
  assert.ok(g.ship.energy > 0);
  assert.ok(g.klingonsRemaining > 0);
  assert.equal(g.klingonsRemaining, DIFFICULTY.novice.klingons);
});

test('starting quadrant is safe (no klingons)', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const g = createGame({ difficulty: 'standard', seed });
    const q = g.galaxy.quadrants[g.ship.qy][g.ship.qx];
    assert.equal(q.klingons, 0, `seed ${seed}: start quadrant should have no klingons`);
  }
});

// ---------------------------------------------------------------------------
// Command execution
// ---------------------------------------------------------------------------

test('phaser command requires targets in quadrant', () => {
  const g = createGame({ difficulty: 'novice', seed: 200 });
  // Start quadrant is safe, so phaser should fail
  const res = executeCommand(g, { action: 'phaser', energy: 500 });
  assert.equal(res.ok, false);
  assert.ok(res.error.toLowerCase().includes('hostile'));
});

test('phaser reduces energy and damages klingons', () => {
  const g = createGame({ difficulty: 'novice', seed: 50 });
  // Seed a klingon into the current quadrant manually
  const contents = g.galaxy.quadrants[g.ship.qy][g.ship.qx].contents;
  contents.klingons.push({ id: 'K-TEST', sx: 3, sy: 3, energy: 200, destroyed: false });
  contents.sectors[3][3] = CELL.KLINGON;
  g.galaxy.quadrants[g.ship.qy][g.ship.qx].klingons = 1;

  const startEnergy = g.ship.energy;
  const res = executeCommand(g, { action: 'phaser', energy: 500 });
  assert.equal(res.ok, true);
  assert.equal(g.ship.energy, startEnergy - 500);
  assert.ok(contents.klingons[0].energy < 200 || contents.klingons[0].destroyed);
});

test('torpedo consumes torps and energy', () => {
  const g = createGame({ difficulty: 'novice', seed: 60 });
  const startTorps = g.ship.torpedoes;
  const startEnergy = g.ship.energy;
  executeCommand(g, { action: 'torpedo', bearing: 3.0 });
  assert.equal(g.ship.torpedoes, startTorps - 1);
  assert.equal(g.ship.energy, startEnergy - 50);
});

test('shields up costs energy', () => {
  const g = createGame({ difficulty: 'novice', seed: 70 });
  const startEnergy = g.ship.energy;
  const res = executeCommand(g, { action: 'shieldUp' });
  assert.equal(res.ok, true);
  assert.equal(g.ship.shieldsUp, true);
  assert.ok(g.ship.energy < startEnergy);
});

test('shieldTransfer adds to shields, subtracts from energy', () => {
  const g = createGame({ difficulty: 'novice', seed: 80 });
  const startEnergy = g.ship.energy;
  const startShields = g.ship.shields;
  executeCommand(g, { action: 'shieldTransfer', amount: 400 });
  assert.equal(g.ship.energy, startEnergy - 400);
  assert.equal(g.ship.shields, startShields + 400);
});

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

test('warp move changes quadrant', () => {
  const g = createGame({ difficulty: 'novice', seed: 90 });
  const oldQx = g.ship.qx;
  const oldQy = g.ship.qy;
  // Pick a course that's guaranteed to move away from a corner: aim toward
  // the arena centre.
  const towardCentreCourse = oldQx < 4 ? 0 : 6;  // East if we're left-side, else West
  const res = executeCommand(g, { action: 'move', course: towardCentreCourse, warp: 2 });
  assert.equal(res.ok, true);
  const moved = g.ship.qx !== oldQx || g.ship.qy !== oldQy;
  assert.ok(moved, `ship at (${oldQx},${oldQy}) should have moved with course ${towardCentreCourse}`);
});

test('warp move consumes stardate', () => {
  const g = createGame({ difficulty: 'novice', seed: 100 });
  const startSd = g.stardate;
  executeCommand(g, { action: 'move', course: 3, warp: 3 });
  assert.ok(g.stardate > startSd);
});

// ---------------------------------------------------------------------------
// Docking
// ---------------------------------------------------------------------------

test('dock refills energy, torpedoes, shields, hull', () => {
  const g = createGame({ difficulty: 'novice', seed: 110 });
  // Manually seed a starbase adjacent to the ship
  const contents = g.galaxy.quadrants[g.ship.qy][g.ship.qx].contents;
  const bx = Math.min(QUADRANT_SIZE - 1, g.ship.sx + 1);
  const by = g.ship.sy;
  contents.starbase = { sx: bx, sy: by };
  contents.sectors[by][bx] = CELL.STARBASE;

  // Damage the ship a bit
  g.ship.energy = 500;
  g.ship.torpedoes = 2;
  g.ship.hull = 60;
  g.ship.systems[SYS.PHASERS] = 5;

  const res = executeCommand(g, { action: 'dock' });
  assert.equal(res.ok, true);
  assert.ok(g.ship.energy > 500);
  assert.equal(g.ship.torpedoes, 10);
  assert.equal(g.ship.hull, 100);
  assert.equal(g.ship.systems[SYS.PHASERS], 0);
  assert.equal(g.ship.docked, true);
});

test('dock fails if no starbase in quadrant', () => {
  const g = createGame({ difficulty: 'novice', seed: 120 });
  // Ensure no starbase in current quadrant
  const contents = g.galaxy.quadrants[g.ship.qy][g.ship.qx].contents;
  contents.starbase = null;
  contents.sectors.forEach(r => r.forEach((_, i) => { if (r[i] === CELL.STARBASE) r[i] = CELL.EMPTY; }));

  const res = executeCommand(g, { action: 'dock' });
  assert.equal(res.ok, false);
});

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

test('snapshot exposes required render fields', () => {
  const g = createGame({ difficulty: 'novice', seed: 130 });
  const s = snapshot(g);
  assert.ok('stardate' in s);
  assert.ok('ship' in s);
  assert.ok('galaxy' in s);
  assert.ok('quadrant' in s);
  assert.ok(Array.isArray(s.quadrant.contents.klingons));
});

// ---------------------------------------------------------------------------
// Win / loss
// ---------------------------------------------------------------------------

test('destroying all klingons triggers victory', () => {
  const g = createGame({ difficulty: 'novice', seed: 140 });
  // Set klingons remaining to 1 and place one in the current quadrant
  const contents = g.galaxy.quadrants[g.ship.qy][g.ship.qx].contents;
  g.klingonsRemaining = 1;
  contents.klingons.push({ id: 'K-LAST', sx: g.ship.sx + 1, sy: g.ship.sy, energy: 50, destroyed: false });
  contents.sectors[g.ship.sy][g.ship.sx + 1] = CELL.KLINGON;
  g.galaxy.quadrants[g.ship.qy][g.ship.qx].klingons = 1;
  // Overkill phaser
  executeCommand(g, { action: 'phaser', energy: 1000 });
  assert.equal(g.won, true);
});

test('stardate exhaustion triggers loss', () => {
  const g = createGame({ difficulty: 'novice', seed: 150 });
  // Push stardate near budget
  g.stardate = g.stardateEnd - 0.05;
  // Any command that advances stardate causes loss
  executeCommand(g, { action: 'shieldUp' });
  assert.equal(g.lost, true);
});
