// trek/fancy-web hints tests

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeHints, sortHintsByPriority, _internal } from '../src/hints.js';
import { createGame, snapshot } from '../src/engine.js';
import { CELL, ENEMY } from '../src/galaxy.js';

// ---------------------------------------------------------------------------
// bearingClock geometry
// ---------------------------------------------------------------------------

test('bearingClock: cardinal directions', () => {
  const { bearingClock } = _internal;
  // 0 = East, 3 = North, 6 = West, 9 = South (game y+ = south, so dy negative = north)
  assert.equal(bearingClock(1, 0), 0);              // E: +x
  assert.ok(Math.abs(bearingClock(0, -1) - 3) < 0.01); // N: -y
  assert.ok(Math.abs(bearingClock(-1, 0) - 6) < 0.01); // W: -x
  assert.ok(Math.abs(bearingClock(0, 1) - 9) < 0.01);  // S: +y
});

test('bearingClock: NE ≈ 1.5', () => {
  const { bearingClock } = _internal;
  const b = _internal.bearingClock(1, -1);
  assert.ok(Math.abs(b - 1.5) < 0.05);
});

// ---------------------------------------------------------------------------
// Empty situation → OK hint
// ---------------------------------------------------------------------------

test('computeHints: quiet quadrant, no klingons remaining anywhere returns OK', () => {
  const g = createGame({ difficulty: 'novice', seed: 500 });
  // Wipe the galaxy of klingons
  g.klingonsRemaining = 0;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) g.galaxy.quadrants[y][x].klingons = 0;
  g.galaxy.quadrants[g.ship.qy][g.ship.qx].contents.klingons = [];
  const hints = computeHints(snapshot(g));
  assert.ok(hints.length >= 1);
  assert.equal(hints[hints.length - 1].priority, 'ok');
});

// ---------------------------------------------------------------------------
// Hostile situations
// ---------------------------------------------------------------------------

test('computeHints: hostiles present, shields DOWN → urgent SHIELDS hint', () => {
  const g = createGame({ difficulty: 'novice', seed: 510 });
  // Force a klingon into the current quadrant
  const contents = g.galaxy.quadrants[g.ship.qy][g.ship.qx].contents;
  contents.klingons.push({ id: 'KX', sx: 3, sy: 3, type: ENEMY.WARSHIP, energy: 300, destroyed: false, attack: [30, 70] });
  contents.sectors[3][3] = CELL.KLINGON;
  g.galaxy.quadrants[g.ship.qy][g.ship.qx].klingons = 1;
  g.ship.shieldsUp = false;

  const hints = computeHints(snapshot(g));
  const shieldHint = hints.find(h => h.tag === 'SHIELDS');
  assert.ok(shieldHint, 'expected SHIELDS urgent hint');
  assert.equal(shieldHint.priority, 'urgent');
  assert.equal(shieldHint.cmd, 'shields up');
});

test('computeHints: hostiles present, shields UP → PHASER hint', () => {
  const g = createGame({ difficulty: 'novice', seed: 520 });
  const contents = g.galaxy.quadrants[g.ship.qy][g.ship.qx].contents;
  contents.klingons.push({ id: 'KX', sx: 3, sy: 3, type: ENEMY.WARSHIP, energy: 300, destroyed: false, attack: [30, 70] });
  contents.sectors[3][3] = CELL.KLINGON;
  g.galaxy.quadrants[g.ship.qy][g.ship.qx].klingons = 1;
  g.ship.shieldsUp = true;

  const hints = computeHints(snapshot(g));
  const phaser = hints.find(h => h.tag === 'PHASER');
  assert.ok(phaser, 'expected PHASER hint');
  assert.ok(phaser.cmd.startsWith('phaser '));
});

test('computeHints: strong single hostile + torpedoes → TORPEDO recommended', () => {
  const g = createGame({ difficulty: 'novice', seed: 530 });
  const contents = g.galaxy.quadrants[g.ship.qy][g.ship.qx].contents;
  contents.klingons.push({ id: 'KS', sx: 6, sy: 6, type: ENEMY.SUPER, energy: 1000, destroyed: false, attack: [80, 130] });
  contents.sectors[6][6] = CELL.KLINGON;
  g.galaxy.quadrants[g.ship.qy][g.ship.qx].klingons = 1;
  g.ship.shieldsUp = true;
  g.ship.torpedoes = 5;

  const hints = computeHints(snapshot(g));
  const torpedo = hints.find(h => h.tag === 'TORPEDO');
  assert.ok(torpedo, 'expected TORPEDO hint for strong target');
  assert.ok(torpedo.cmd.startsWith('torpedo '));
});

// ---------------------------------------------------------------------------
// Fuel / damage / dock
// ---------------------------------------------------------------------------

test('computeHints: hull critical + starbase adjacent → urgent DOCK', () => {
  const g = createGame({ difficulty: 'novice', seed: 540 });
  const contents = g.galaxy.quadrants[g.ship.qy][g.ship.qx].contents;
  // Seed starbase next to ship
  const bx = Math.min(9, g.ship.sx + 1);
  const by = g.ship.sy;
  contents.starbase = { sx: bx, sy: by };
  contents.sectors[by][bx] = CELL.STARBASE;
  g.ship.hull = 25;

  const hints = computeHints(snapshot(g));
  const dock = hints.find(h => h.tag === 'DOCK');
  assert.ok(dock, 'expected DOCK urgent');
  assert.equal(dock.cmd, 'dock');
});

test('computeHints: low energy + starbase adjacent → FUEL-DOCK', () => {
  const g = createGame({ difficulty: 'novice', seed: 550 });
  const contents = g.galaxy.quadrants[g.ship.qy][g.ship.qx].contents;
  const bx = Math.min(9, g.ship.sx + 1);
  const by = g.ship.sy;
  contents.starbase = { sx: bx, sy: by };
  contents.sectors[by][bx] = CELL.STARBASE;
  g.ship.energy = 800;

  const hints = computeHints(snapshot(g));
  const fuel = hints.find(h => h.tag === 'FUEL-DOCK');
  assert.ok(fuel, 'expected FUEL-DOCK');
});

// ---------------------------------------------------------------------------
// No hostiles → hunt / scan
// ---------------------------------------------------------------------------

test('computeHints: safe quadrant + klingons remaining → HUNT hint', () => {
  const g = createGame({ difficulty: 'novice', seed: 560 });
  // Ensure at least one other scanned quadrant has klingons
  // (createGame already scans neighbours, populates start-safe)
  // Find a klingon quadrant elsewhere and mark it scanned.
  let found = null;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    if ((x !== g.ship.qx || y !== g.ship.qy) && g.galaxy.quadrants[y][x].klingons > 0) {
      g.galaxy.quadrants[y][x].scanned = true;
      found = { x, y };
    }
  }
  assert.ok(found, 'test seed should have at least one klingon quadrant');

  const hints = computeHints(snapshot(g));
  const hunt = hints.find(h => h.tag === 'HUNT');
  assert.ok(hunt, 'expected HUNT hint');
  assert.ok(hunt.cmd.startsWith('move '));
});

// ---------------------------------------------------------------------------
// Priority ordering
// ---------------------------------------------------------------------------

test('sortHintsByPriority puts urgent first', () => {
  const hs = [
    { priority: 'normal', tag: 'A', cmd: null, explain: '' },
    { priority: 'urgent', tag: 'B', cmd: null, explain: '' },
    { priority: 'ok',     tag: 'C', cmd: null, explain: '' },
    { priority: 'urgent', tag: 'D', cmd: null, explain: '' },
  ];
  const sorted = sortHintsByPriority(hs);
  assert.equal(sorted[0].priority, 'urgent');
  assert.equal(sorted[1].priority, 'urgent');
  assert.equal(sorted[2].priority, 'normal');
  assert.equal(sorted[3].priority, 'ok');
});
