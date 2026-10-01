// Scene composer (ADR-009): a pure function from engine state to a RoomSpec.
// Every room composes by day and by night, landmark rooms get their places,
// composing never touches the game, and the sameness budget holds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Battlestar, C } from '../src/engine/battlestar.js';
import { composeRoom, signature, ROOM_CLASS, BIOMES } from '../src/scene/composer.js';

function all(night) {
  const g = new Battlestar({ seed: 1 });
  g.start();
  if (night) g.convert(C.TONIGHT);
  const specs = [];
  for (let r = 1; r <= 275; r++) {
    g.position = r;
    g.whichway(g.room(r));
    specs.push(composeRoom(g));
  }
  return specs;
}
const day = all(false);
const night = all(true);

test('every room composes a valid spec, day and night', () => {
  for (const s of [...day, ...night]) {
    assert.ok(BIOMES.includes(s.biome), `room ${s.room}: biome ${s.biome}`);
    assert.equal(typeof s.place, 'string');
    assert.ok(s.place.length > 0);
    for (const k of ['ahead', 'back', 'left', 'right']) assert.ok(k in s.around, `room ${s.room}: around.${k}`);
    assert.equal(typeof s.light.night, 'boolean');
    assert.ok(Array.isArray(s.props) && s.props.every((p) => Number.isInteger(p.obj)));
    assert.ok(Number.isInteger(s.seed));
  }
});

test('every room is classified; biome sizes match the world map', () => {
  const count = {};
  for (let r = 1; r <= 275; r++) {
    assert.ok(ROOM_CLASS[r], `room ${r} unclassified`);
    count[ROOM_CLASS[r].biome] = (count[ROOM_CLASS[r].biome] || 0) + 1;
  }
  assert.equal(count.ship, 31);
  assert.equal(count.space, 37);
  assert.equal(count.air, 27);
  assert.equal(count.cave, 33);
  assert.equal(count.coast + count.forest, 147);
});

test('landmark rooms get their places', () => {
  const at = (r) => day[r - 1];
  assert.equal(at(22).place, 'stateroom');
  assert.equal(at(181).place, 'cave-mouth');
  assert.equal(at(126).place, 'pools');
  assert.equal(at(268).place, 'throne');
  assert.equal(at(270).place, 'abyss');
  assert.equal(at(235).place, 'clubhouse');
  assert.equal(at(22).biome, 'ship');
  assert.equal(at(73).biome, 'air');
});

test('composing is pure: the game state is untouched', () => {
  const g = new Battlestar({ seed: 3 });
  g.start();
  g.send('right');
  const before = JSON.stringify(g.snapshot());
  composeRoom(g);
  composeRoom(g);
  assert.equal(JSON.stringify(g.snapshot()), before);
});

test('night changes the world where the original does (114, 247-252, 261)', () => {
  for (const r of [114, 247, 248, 249, 252, 261]) assert.ok(day[r - 1].night === false && night[r - 1].night === true);
});

test('sameness budget: rooms look different from each other', () => {
  const by = {};
  for (const s of day) (by[s.biome] ||= new Set()).add(signature(s));
  // space rooms share one original description ("You are in space"); the
  // planet, carrier and seeded starfield still vary, so a lower floor there
  const floor = { ship: 1, space: 0.2, air: 0.9, coast: 0.85, forest: 0.85, cave: 1 };
  for (const [b, set] of Object.entries(by)) {
    const n = day.filter((s) => s.biome === b).length;
    assert.ok(set.size / n >= floor[b], `${b}: ${set.size} looks for ${n} rooms`);
  }
});

test('surroundings are relative to the facing', () => {
  const g = new Battlestar({ seed: 1 });
  g.start();
  const a = composeRoom(g);
  g.direction = g.direction === C.NORTH ? C.SOUTH : C.NORTH;
  g.whichway(g.room(g.position));
  const b = composeRoom(g);
  assert.equal(a.around.ahead.exit, b.around.back.exit);
});
