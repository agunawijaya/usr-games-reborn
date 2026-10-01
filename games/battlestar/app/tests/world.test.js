// Room-graph integrity, checked against the transcribed upstream tables.

import test from 'node:test';
import assert from 'node:assert/strict';
import { C, DAYFILE, NIGHTFILE, DAYOBJS, NIGHTOBJS, OBJSHT, OBJDES, WLIST } from '../src/engine/data/world.js';

const N = C.NUMOFROOMS;
const FILES = [['day', DAYFILE], ['night', NIGHTFILE]];

test('both room files have 275 rooms with 8 links, a name and a description', () => {
  for (const [nm, F] of FILES) {
    assert.equal(F.length, N + 1, nm);
    assert.equal(F[0], null);
    for (let r = 1; r <= N; r++) {
      assert.equal(F[r].link.length, 8, `${nm} ${r}`);
      assert.ok(F[r].name && F[r].desc, `${nm} ${r}`);
    }
  }
});

test('every exit points inside 1..275, access and flyhere are flags', () => {
  for (const [nm, F] of FILES) {
    for (let r = 1; r <= N; r++) {
      const l = F[r].link;
      for (const i of [0, 1, 2, 3, 4, 6]) assert.ok(l[i] >= 0 && l[i] <= N, `${nm} ${r} link ${i} = ${l[i]}`);
      assert.ok(l[5] === 0 || l[5] === 1, `${nm} ${r} access`);
      assert.ok(l[7] === 0 || l[7] === 1, `${nm} ${r} flyhere`);
    }
  }
});

test('every description has exactly four direction placeholders (+ - *)', () => {
  // room.c writedes() walks NORTH, SOUTH, EAST, WEST; a fifth would print an error.
  for (const [nm, F] of FILES) {
    for (let r = 1; r <= N; r++) {
      const k = (F[r].desc.match(/[-+*]/g) || []).length;
      assert.equal(k, 4, `${nm} room ${r} has ${k}`);
    }
  }
});

test('only rooms 114, 247, 248, 249, 252 and 261 change links at night', () => {
  const diff = [];
  for (let r = 1; r <= N; r++) if (DAYFILE[r].link.join() !== NIGHTFILE[r].link.join()) diff.push(r);
  assert.deepEqual(diff, [114, 247, 248, 249, 252, 261]);
  assert.equal(DAYFILE[261].link[6], 0, 'no ladder by day');
  assert.equal(NIGHTFILE[261].link[6], 262, 'ladder at night');
});

test('airspace: rooms 32-104 fly, except the landing grounds', () => {
  const fly = [];
  for (let r = 1; r <= N; r++) if (DAYFILE[r].link[7]) fly.push(r);
  assert.equal(fly[0], 32);
  assert.equal(fly[fly.length - 1], 104);
  for (const ground of [80, 89, 91, 92, 93, 98, 101, 102, 103]) assert.ok(!fly.includes(ground), `${ground}`);
  // Every landing zone (LAND object with a way down) lands on the ground.
  const land = DAYOBJS.filter(([, o]) => o === C.LAND).map(([r]) => r).filter((r) => DAYFILE[r].link[6]);
  assert.deepEqual(land.sort((a, b) => a - b), [73, 76, 77, 79, 81, 82, 84, 87, 88, 99]);
  for (const r of land) assert.equal(DAYFILE[DAYFILE[r].link[6]].link[7], 0, `landing ${r}`);
});

test('all 275 rooms are reachable from room 22', () => {
  const edges = new Map();
  const add = (a, b) => { if (b) (edges.get(a) || edges.set(a, []).get(a)).push(b); };
  for (const [, F] of FILES) {
    for (let r = 1; r <= N; r++) {
      const l = F[r].link;
      [0, 1, 2, 3, 6].forEach((i) => add(r, l[i]));
      if (l[5]) add(r, l[4]);
    }
  }
  add(7, 32); // launch
  for (const [r, o] of DAYOBJS) if (o === C.LAND && DAYFILE[r].link[6]) add(r, DAYFILE[r].link[6]); // land
  add(126, 268); // follow the goddess
  add(266, 275); // follow the Dark Lord
  for (let r = 1; r <= N; r++) if (r !== 275) add(r, r === 229 ? 224 : 229); // use amulet
  for (const [a, b] of [[242, 133], [214, 145], [215, 145], [162, 145], [159, 145], [232, 275], [3, 1], [172, 201]]) add(a, b); // jump
  const seen = new Set([22]);
  const q = [22];
  while (q.length) for (const v of edges.get(q.shift()) || []) if (!seen.has(v)) { seen.add(v); q.push(v); }
  assert.equal(seen.size, N);
});

test('object tables: 64 objects; placements reference real rooms and objects', () => {
  assert.equal(OBJSHT.length, 64);
  assert.equal(OBJDES.length, 64);
  for (const [r, o] of [...DAYOBJS, ...NIGHTOBJS]) {
    assert.ok(r >= 1 && r <= N);
    assert.ok(o >= 0 && o < 64);
  }
  // Key placements verified against dayobjs.c.
  const at = (o) => DAYOBJS.filter(([, x]) => x === o).map(([r]) => r).sort((a, b) => a - b);
  assert.deepEqual(at(C.AMULET), [13]);
  assert.deepEqual(at(C.MEDALION), []);
  assert.deepEqual(at(C.TALISMAN), []);
  assert.deepEqual(at(C.DARK), [266]);
  assert.deepEqual(at(C.VIPER), [7]);
  assert.deepEqual(at(C.CYLON), [36, 49, 64]);
  assert.deepEqual(at(C.BATHGOD), [126]);
  assert.deepEqual(at(C.TWO_HANDED), [190]);
});

test('vocabulary: 171 words, no compass words, single-letter verbs', () => {
  assert.equal(WLIST.length, 171);
  const words = new Map(WLIST.map(([s, v, t]) => [s, { v, t }]));
  for (const w of ['north', 'south', 'east', 'west', 'n', 's', 'e', 'w']) assert.ok(!words.has(w), w);
  for (const [w, v] of [['a', C.AHEAD], ['b', C.BACK], ['l', C.LEFT], ['r', C.RIGHT], ['u', C.UP], ['d', C.DOWN], ['i', C.INVEN], ['q', C.QUIT]]) {
    assert.equal(words.get(w).v, v, w);
    assert.equal(words.get(w).t, C.VERB, w);
  }
  assert.equal(words.get('the').t, C.ADJS);
});
