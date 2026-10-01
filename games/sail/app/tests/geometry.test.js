// Geometry: Ed Wang's angle(), range, arcs of fire (ADR 004).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  angle, distance, range, gunsbear, portside, relativeBearing,
} from '../src/engine/index.js';

test('distance is the long axis plus half the short axis', () => {
  assert.equal(distance(3, 4), 5);
  assert.equal(distance(-2, 6), 7);
  assert.equal(distance(5, 0), 5);
  assert.equal(distance(1, 1), 1);
});

test('angle(): the eight compass points (1 = N, clockwise)', () => {
  // dr > 0 is NORTH (row decreasing), dc > 0 is EAST.
  const cases = [
    [[1, 0], 1], [[1, 1], 2], [[0, 1], 3], [[-1, 1], 4],
    [[-1, 0], 5], [[-1, -1], 6], [[0, -1], 7], [[1, -1], 8],
  ];
  for (const [[dr, dc], want] of cases) assert.equal(angle(dr, dc), want, `angle(${dr},${dc})`);
});

test('angle(): octant boundaries sit at the 2.4 ratio (~22.6 degrees)', () => {
  assert.equal(angle(5, 2), 1); // 2 * 2.4 = 4.8 < 5: still north
  assert.equal(angle(5, 3), 2); // 7.2 > 5: north-east
  assert.equal(angle(2, 5), 3); // 5 > 2 * 2.4: east
  assert.equal(angle(12, 5), 1); // exactly 2.4: stays north (strict >)
});

test('angle(): the original edge cases are preserved and pinned', () => {
  assert.equal(angle(0, 0), 7, 'zero vector falls through to west');
});

test('range() takes the closest of bow/stern pairs when near', () => {
  const a = { row: 10, col: 10, dir: 1 };
  const b = { row: 10, col: 11, dir: 1 };
  assert.equal(range(a, b), 1);
  const far = { row: 10, col: 30, dir: 3 };
  assert.equal(range(a, far), 20);
  assert.equal(range(a, { row: 0, col: 0, dir: 0 }), -1, 'sunk ships have no range');
});

test('gunsbear(): starboard beam and port beam', () => {
  const me = { row: 10, col: 10, dir: 1 };
  assert.equal(gunsbear(me, { row: 10, col: 13, dir: 1 }), 'r');
  assert.equal(gunsbear(me, { row: 10, col: 7, dir: 1 }), 'l');
  assert.equal(gunsbear(me, { row: 5, col: 10, dir: 1 }), 0, 'dead ahead does not bear');
});

test('gunsbear(): port bow now bears like starboard bow (ADR 004 fix)', () => {
  const me = { row: 10, col: 10, dir: 1 };
  assert.equal(relativeBearing(me, { row: 7, col: 13 }), 2);
  assert.equal(relativeBearing(me, { row: 7, col: 7 }), 8);
  assert.equal(gunsbear(me, { row: 7, col: 13, dir: 1 }), 'r');
  assert.equal(gunsbear(me, { row: 7, col: 7, dir: 1 }), 'l');
});

test('gunsbear(): the second probe is the target STERN (ADR 004 fix)', () => {
  // Target bow dead ahead, its stern on our starboard bow: bears 'r' only
  // if the probe steps to the real stern square (row + DR, col + DC).
  // The original's sign error probed (4, 12) instead and found nothing.
  const me = { row: 10, col: 10, dir: 1 };
  const target = { row: 5, col: 11, dir: 8 }; // heading NW, stern at (6, 12)
  assert.equal(gunsbear(me, target), 'r');
});

test('portside(): which of the target\'s batteries faces us', () => {
  const on = { row: 10, col: 10, dir: 1 }; // heading north
  assert.equal(portside({ row: 10, col: 13, dir: 1 }, on, 0), true, 'shooter to the east hits starboard');
  assert.equal(portside({ row: 10, col: 7, dir: 1 }, on, 0), false, 'shooter to the west hits port');
  // The negative-modulo fix: target heading NW, shooter due south.
  const nw = { row: 10, col: 10, dir: 8 };
  assert.equal(portside({ row: 14, col: 10, dir: 1 }, nw, 0), false, 'port quarter is port');
});
