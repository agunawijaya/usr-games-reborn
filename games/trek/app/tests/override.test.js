// trek/procedural-web — Captain's Override engine flags + command grammar

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createGame, executeCommand, snapshot, SYS, SYSTEM_ORDER,
  OVERRIDE_FLAGS, setOverride, clearOverrides, anyOverrideActive,
  isQuadrantVisible, overrideResupply, overrideWarpTo,
} from '../src/engine.js';
import { CELL, ENEMY, GALAXY_SIZE } from '../src/galaxy.js';
import { parseOverride, OVERRIDE_TOKENS } from '../src/override.js';

/** Put one Klingon next to the ship in the current quadrant. */
function seedKlingon(g, energy = 300, type = ENEMY.WARSHIP, dx = 2) {
  const q = g.galaxy.quadrants[g.ship.qy][g.ship.qx];
  const sx = Math.min(9, g.ship.sx + dx);
  const sy = g.ship.sy;
  q.contents.klingons.push({ id: `KT-${q.contents.klingons.length}`, sx, sy, type, energy, destroyed: false, attack: [70, 130] });
  q.contents.sectors[sy][sx] = CELL.KLINGON;
  q.klingons++;
  return q.contents.klingons[q.contents.klingons.length - 1];
}

// ---------------------------------------------------------------------------
// Defaults and bookkeeping
// ---------------------------------------------------------------------------

test('new game: every override off, not cheated', () => {
  const g = createGame({ difficulty: 'novice', seed: 1 });
  assert.deepEqual(Object.keys(g.overrides).sort(), [...OVERRIDE_FLAGS].sort());
  for (const f of OVERRIDE_FLAGS) assert.equal(g.overrides[f], false);
  assert.equal(g.cheated, false);
  assert.equal(anyOverrideActive(g), false);
  assert.equal(snapshot(g).cheated, false);
});

test('setOverride rejects unknown flags', () => {
  const g = createGame({ difficulty: 'novice', seed: 1 });
  const res = setOverride(g, 'godmode', true);
  assert.equal(res.ok, false);
  assert.equal(g.cheated, false);
});

test('engaging any flag marks the mission cheated and logs it', () => {
  const g = createGame({ difficulty: 'novice', seed: 2 });
  const res = setOverride(g, 'freezeClock', true);
  assert.equal(res.ok, true);
  assert.equal(g.cheated, true);
  assert.equal(anyOverrideActive(g), true);
  const last = g.events[g.events.length - 1];
  assert.equal(last.tag, 'override');
  assert.match(last.msg, /Freeze stardate clock ENGAGED/);
});

test('clearOverrides releases every flag but the mission stays cheated', () => {
  const g = createGame({ difficulty: 'novice', seed: 3 });
  for (const f of OVERRIDE_FLAGS) setOverride(g, f, true);
  clearOverrides(g);
  assert.equal(anyOverrideActive(g), false);
  assert.equal(g.cheated, true);
});

// ---------------------------------------------------------------------------
// Individual flags
// ---------------------------------------------------------------------------

test('infiniteEnergy: nothing spends energy; can fire more than the reserve', () => {
  const g = createGame({ difficulty: 'novice', seed: 10 });
  seedKlingon(g, 5000, ENEMY.SUPER);
  setOverride(g, 'infiniteEnergy', true);
  const e0 = g.ship.energy;
  assert.equal(executeCommand(g, { action: 'shieldUp' }).ok, true);
  assert.equal(executeCommand(g, { action: 'shieldTransfer', amount: 900 }).ok, true);
  assert.equal(executeCommand(g, { action: 'phaser', energy: 20000 }).ok, true);
  assert.equal(executeCommand(g, { action: 'torpedo', bearing: 6 }).ok, true);
  assert.equal(g.ship.energy, e0);
  // Energy at zero no longer loses the game (the loss check runs after
  // return fire, so keep a tough Klingon alive to reach it).
  seedKlingon(g, 99999, ENEMY.SUPER, 4);
  g.ship.energy = 0;
  const res = executeCommand(g, { action: 'phaser', energy: 5 });
  assert.equal(res.ok, true);
  assert.ok(res.effects.some(e => e.type === 'klingonFire'));
  assert.equal(g.lost, false);
});

test('infiniteTorpedoes: torpedo count never drops, fires from an empty bay', () => {
  const g = createGame({ difficulty: 'novice', seed: 11 });
  setOverride(g, 'infiniteTorpedoes', true);
  g.ship.torpedoes = 0;
  const res = executeCommand(g, { action: 'torpedo', bearing: 3 });
  assert.equal(res.ok, true);
  assert.equal(g.ship.torpedoes, 0);
  g.ship.torpedoes = 7;
  executeCommand(g, { action: 'torpedo', bearing: 9 });
  assert.equal(g.ship.torpedoes, 7);
});

test('invulnerable: heavy return fire changes no shield, hull or system', () => {
  const g = createGame({ difficulty: 'novice', seed: 12 });
  for (let i = 0; i < 3; i++) seedKlingon(g, 5000, ENEMY.SUPER, 1 + i);
  setOverride(g, 'invulnerable', true);
  g.ship.shieldsUp = false;
  const hull = g.ship.hull, shields = g.ship.shields;
  const systems = { ...g.ship.systems };
  let hits = 0;
  for (let i = 0; i < 20; i++) {
    const res = executeCommand(g, { action: 'phaser', energy: 1 });
    assert.equal(res.ok, true);
    const fx = res.effects.filter(e => e.type === 'klingonFire');
    hits += fx.length;
    for (const e of fx) { assert.equal(e.hullDamage, 0); assert.equal(e.invulnerable, true); }
  }
  assert.ok(hits >= 60);
  assert.equal(g.ship.shields, shields);
  assert.equal(g.ship.hull, hull);
  assert.deepEqual(g.ship.systems, systems);
  assert.equal(g.lost, false);
});

test('freezeClock: moves and shots no longer advance the stardate', () => {
  const g = createGame({ difficulty: 'novice', seed: 13 });
  setOverride(g, 'freezeClock', true);
  const sd = g.stardate;
  executeCommand(g, { action: 'move', course: 0, warp: 3 });
  executeCommand(g, { action: 'lrscan' });
  executeCommand(g, { action: 'shieldUp' });
  assert.equal(g.stardate, sd);
  g.stardate = g.stardateEnd - 0.01;
  executeCommand(g, { action: 'lrscan' });
  assert.equal(g.lost, false);
});

test('oneShot: a 1-unit phaser destroys a full-strength Super-Commander', () => {
  const g = createGame({ difficulty: 'novice', seed: 14 });
  const k = seedKlingon(g, 1200, ENEMY.SUPER, 6);
  setOverride(g, 'oneShot', true);
  const res = executeCommand(g, { action: 'phaser', energy: 1 });
  assert.equal(res.ok, true);
  assert.equal(k.destroyed, true);
  const dmg = res.effects.find(e => e.type === 'phaser').damages[0];
  assert.equal(dmg.destroyed, true);
  assert.ok(dmg.damage >= 1200);
});

test('without oneShot the same 1-unit phaser only scratches it', () => {
  const g = createGame({ difficulty: 'novice', seed: 14 });
  const k = seedKlingon(g, 1200, ENEMY.SUPER, 6);
  executeCommand(g, { action: 'phaser', energy: 1 });
  assert.equal(k.destroyed, false);
});

test('revealMap: every quadrant visible without touching the scanned flags', () => {
  const g = createGame({ difficulty: 'standard', seed: 15 });
  const scannedBefore = g.galaxy.quadrants.flat().map(q => q.scanned);
  assert.ok(scannedBefore.includes(false));
  setOverride(g, 'revealMap', true);
  for (let y = 0; y < GALAXY_SIZE; y++) for (let x = 0; x < GALAXY_SIZE; x++) {
    assert.equal(isQuadrantVisible(g, x, y), true);
  }
  assert.deepEqual(g.galaxy.quadrants.flat().map(q => q.scanned), scannedBefore);
  setOverride(g, 'revealMap', false);
  const hidden = g.galaxy.quadrants.flat().filter((q, i) => !isQuadrantVisible(g, i % 8, Math.floor(i / 8)));
  assert.ok(hidden.length > 0, 'fog of war returns when the override is released');
});

test('instantWarp: refused while off; jumps anywhere for free while on', () => {
  const g = createGame({ difficulty: 'standard', seed: 16 });
  const tx = (g.ship.qx + 5) % 8, ty = (g.ship.qy + 3) % 8;
  assert.equal(overrideWarpTo(g, tx, ty).ok, false);
  setOverride(g, 'instantWarp', true);
  const e0 = g.ship.energy, sd = g.stardate;
  const res = overrideWarpTo(g, tx, ty);
  assert.equal(res.ok, true);
  assert.equal(g.ship.qx, tx);
  assert.equal(g.ship.qy, ty);
  assert.ok(g.ship.energy === e0 || res.effects.some(e => e.type === 'klingonFire'));
  assert.equal(g.stardate, sd);
  const q = g.galaxy.quadrants[ty][tx];
  assert.ok(q.contents, 'destination quadrant materialised');
  assert.equal(q.contents.sectors[g.ship.sy][g.ship.sx], CELL.ENTERPRISE);
  assert.ok(res.effects[0].type === 'warpMove' && res.effects[0].instant);
  assert.equal(overrideWarpTo(g, tx, ty).ok, false, 'already there');
  assert.equal(overrideWarpTo(g, 9, 0).ok, false, 'out of range');
});

test('instantWarp into an already-visited quadrant lands on a free sector', () => {
  const g = createGame({ difficulty: 'expert', seed: 17 });
  setOverride(g, 'instantWarp', true);
  const home = { x: g.ship.qx, y: g.ship.qy };
  const away = { x: (home.x + 4) % 8, y: (home.y + 4) % 8 };
  for (let i = 0; i < 12; i++) {
    overrideWarpTo(g, away.x, away.y);
    const c = g.galaxy.quadrants[away.y][away.x].contents;
    assert.equal(c.sectors[g.ship.sy][g.ship.sx], CELL.ENTERPRISE);
    overrideWarpTo(g, home.x, home.y);
    const h = g.galaxy.quadrants[home.y][home.x].contents;
    assert.equal(h.sectors[g.ship.sy][g.ship.sx], CELL.ENTERPRISE);
  }
});

test('overrideResupply: full repair anywhere, not a dock, marks cheated', () => {
  const g = createGame({ difficulty: 'novice', seed: 18 });
  g.ship.energy = 12; g.ship.torpedoes = 0; g.ship.hull = 9; g.ship.shields = 0;
  for (const s of SYSTEM_ORDER) g.ship.systems[s] = 6;
  const res = overrideResupply(g);
  assert.equal(res.ok, true);
  assert.equal(g.ship.energy, 10000);
  assert.equal(g.ship.torpedoes, 10);
  assert.equal(g.ship.hull, 100);
  assert.equal(g.ship.shields, 1500);
  assert.equal(g.ship.systems[SYS.WARP], 0);
  assert.equal(g.ship.docked, false);
  assert.equal(g.cheated, true);
});

test('end-of-mission log line is marked [CHEATED] only when cheated', () => {
  const clean = createGame({ difficulty: 'novice', seed: 19 });
  clean.stardate = clean.stardateEnd - 0.01;
  executeCommand(clean, { action: 'lrscan' });
  assert.equal(clean.lost, true);
  assert.doesNotMatch(clean.events.at(-1).msg, /CHEATED/);

  const dirty = createGame({ difficulty: 'novice', seed: 19 });
  setOverride(dirty, 'revealMap', true);
  dirty.stardate = dirty.stardateEnd - 0.01;
  executeCommand(dirty, { action: 'lrscan' });
  assert.equal(dirty.lost, true);
  assert.match(dirty.events.at(-1).msg, /CHEATED/);
  assert.equal(dirty.lostReason, clean.lostReason, 'loss reason text itself unchanged');
});

test('overrides are refused once the game is over', () => {
  const g = createGame({ difficulty: 'novice', seed: 20 });
  g.lost = true;
  assert.equal(setOverride(g, 'oneShot', true).ok, false);
  assert.equal(overrideResupply(g).ok, false);
});

// ---------------------------------------------------------------------------
// Typed grammar
// ---------------------------------------------------------------------------

test('parseOverride: non-override text falls through (null)', () => {
  assert.equal(parseOverride('phaser 500'), null);
  assert.equal(parseOverride('overdrive'), null);
});

test('parseOverride: panel, status, clear, resupply', () => {
  assert.deepEqual(parseOverride('override').cmd, { action: 'panel' });
  assert.deepEqual(parseOverride('OVERRIDE status').cmd, { action: 'status' });
  assert.deepEqual(parseOverride('override off').cmd, { action: 'clear' });
  assert.deepEqual(parseOverride('override clear').cmd, { action: 'clear' });
  assert.deepEqual(parseOverride('override resupply').cmd, { action: 'resupply' });
  assert.deepEqual(parseOverride('override repair').cmd, { action: 'resupply' });
});

test('parseOverride: flag aliases toggle or set', () => {
  assert.deepEqual(parseOverride('override energy').cmd, { action: 'toggle', flag: 'infiniteEnergy' });
  assert.deepEqual(parseOverride('override torps on').cmd, { action: 'set', flag: 'infiniteTorpedoes', on: true });
  assert.deepEqual(parseOverride('override shields off').cmd, { action: 'set', flag: 'invulnerable', on: false });
  assert.deepEqual(parseOverride('override map').cmd, { action: 'toggle', flag: 'revealMap' });
  assert.deepEqual(parseOverride('override clock on').cmd, { action: 'set', flag: 'freezeClock', on: true });
  assert.deepEqual(parseOverride('override oneshot').cmd, { action: 'toggle', flag: 'oneShot' });
  assert.deepEqual(parseOverride('override warp').cmd, { action: 'toggle', flag: 'instantWarp' });
  assert.deepEqual(parseOverride('override warp on').cmd, { action: 'set', flag: 'instantWarp', on: true });
});

test('parseOverride: warp coordinates are 1-based like the chart labels', () => {
  assert.deepEqual(parseOverride('override warp 3-5').cmd, { action: 'warpTo', qx: 2, qy: 4 });
  assert.deepEqual(parseOverride('override warp 8 1').cmd, { action: 'warpTo', qx: 7, qy: 0 });
  assert.equal(parseOverride('override warp 9-1').ok, false);
  assert.equal(parseOverride('override warp 0-4').ok, false);
});

test('parseOverride: unknown words are errors, not silent no-ops', () => {
  const r = parseOverride('override banana');
  assert.equal(r.ok, false);
  assert.match(r.error, /Unknown override/);
  assert.equal(parseOverride('override energy maybe').ok, false);
});

test('every flag has at least one typed alias', () => {
  for (const f of OVERRIDE_FLAGS) {
    const hit = OVERRIDE_TOKENS.some(t => parseOverride(`override ${t}`)?.cmd?.flag === f);
    assert.ok(hit, `no typed alias reaches ${f}`);
  }
});
