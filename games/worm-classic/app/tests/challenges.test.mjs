// Orchard Crawl — the challenges: shapes and lanes, the judges, the weighted points and what a
// challenge crawl changes in the saved progress.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CHALLENGES,
  CHALLENGE_POINTS_IN_ALL,
  FAMILIES,
  challengeById,
  challengeOpen,
  filled,
  longestZigzag,
  maxPoints,
  pointsFor,
  zigzagLane,
} from '../src/challenges.mjs';
import { challengePoints, freshProgress, recordChallenge } from '../src/progress.mjs';
import { emptySummary } from '../src/stars.mjs';

/** A body drawn from a list of moves, tail first; returns its cells head first. */
function bodyFrom(moves, start = { x: 0, y: 10 }) {
  const cells = [{ ...start }];
  for (const [dx, dy] of moves) {
    const last = cells[cells.length - 1];
    cells.push({ x: last.x + dx, y: last.y + dy });
  }
  return cells.reverse();
}

const R = [1, 0];
const D = [0, 1];
const U = [0, -1];

test('a zigzag counts bends that turn left and right by turns', () => {
  assert.equal(longestZigzag(bodyFrom([R, R, R, R])), 0, 'a straight worm');
  assert.equal(longestZigzag(bodyFrom([R, R, D, D])), 1, 'one bend');
  assert.equal(longestZigzag(bodyFrom([R, D, R, D, R, D])), 5, 'a staircase of five bends');
  assert.equal(longestZigzag(bodyFrom([R, R, D, D, R, R, D, D, R])), 4, 'long legs count as well');
  // Up, along, down (a square wave) turns the same way twice: not a zigzag.
  assert.equal(longestZigzag(bodyFrom([R, R, U, U, R, R, D, D, R])), 2);
  // A U-turn bends the same way twice: the run starts again.
  assert.equal(longestZigzag(bodyFrom([R, D, R, D, D, D, [-1, 0], [-1, 0]])), 3);
});

test('the zigzag lane runs from its start to the burrow, and the worm fits at its start', () => {
  for (const width of [1, 2, 3]) {
    const lane = zigzagLane(width);
    const fence = new Set(lane.fenceCells.map((c) => `${c.x},${c.y}`));
    const { x, y, length } = lane.start;
    for (let i = 0; i < length + 3; i++) assert.ok(!fence.has(`${x - length + 1 + i},${y}`), `start row free, width ${width}`);
    assert.ok(!fence.has(`${lane.exit.x},${lane.exit.y}`));
    // Breadth-first from the start reaches the exit through the lane only.
    const seen = new Set([`${x},${y}`]);
    const queue = [{ x, y }];
    for (let i = 0; i < queue.length; i++) {
      for (const [dx, dy] of [R, D, U, [-1, 0]]) {
        const nx = queue[i].x + dx;
        const ny = queue[i].y + dy;
        const key = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= 30 || ny >= 20 || seen.has(key) || fence.has(key)) continue;
        seen.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
    assert.ok(seen.has(`${lane.exit.x},${lane.exit.y}`), `the exit is reachable, width ${width}`);
    assert.ok(lane.path.length > 60, 'it zigzags across the orchard');
  }
});

test('every bed can be filled: its free cells split evenly between the colours of a chessboard', () => {
  for (const challenge of FAMILIES.find((f) => f.id === 'fill-bed').challenges) {
    const rules = challenge.rules();
    const posts = new Set(rules.fenceCells.map((c) => `${c.x},${c.y}`));
    let dark = 0;
    let light = 0;
    for (let y = 0; y < rules.board.rows; y++) {
      for (let x = 0; x < rules.board.cols; x++) {
        if (posts.has(`${x},${y}`)) continue;
        if ((x + y) % 2) dark++;
        else light++;
      }
    }
    assert.equal(dark, light, challenge.id);
  }
});

test('the judges: exact length, numbers in order, the big bite, the zigzag', () => {
  const exact = challengeById('exact-1');
  const run = exact.begin();
  assert.equal(exact.onBite(run, { value: 5, points: 5, length: 18 }), null);
  assert.deepEqual(exact.onBite(run, { value: 2, points: 2, length: 20 }), { kind: 'success', reason: 'exact' });
  assert.deepEqual(exact.onBite(run, { value: 4, points: 4, length: 21 }), { kind: 'fail', reason: 'over' });

  const order = challengeById('order-1');
  const inOrder = order.begin();
  for (let n = 1; n <= 8; n++) assert.equal(order.onBite(inOrder, { value: n, points: n, length: 9 }), null);
  assert.deepEqual(order.onBite(inOrder, { value: 9, points: 9, length: 9 }), { kind: 'success', reason: 'order' });
  assert.deepEqual(order.onBite(order.begin(), { value: 2, points: 2, length: 9 }), { kind: 'fail', reason: 'order' });
  const down = challengeById('order-3');
  assert.deepEqual(down.onBite(down.begin(), { value: 1, points: 1, length: 9 }), { kind: 'fail', reason: 'order' });

  const chain = challengeById('chain-1');
  const bites = chain.begin();
  assert.equal(chain.onBite(bites, { value: 9, points: 19, length: 30 }), null);
  assert.deepEqual(chain.onBite(bites, { value: 9, points: 20, length: 30 }), { kind: 'success', reason: 'chain' });

  const zigzag = challengeById('zigzag-1');
  assert.equal(zigzag.onMove(zigzag.begin(), { segments: bodyFrom([R, D, R, D]) }), null);
  assert.deepEqual(zigzag.onMove(zigzag.begin(), { segments: bodyFrom([R, D, R, D, R, D]) }), { kind: 'success', reason: 'zigzag' });
});

test('the whole orchard gives a medal for the most it was filled, crash or not', () => {
  const orchard = challengeById('fill-orchard');
  const run = orchard.begin();
  orchard.onMove(run, { length: 160, freeCells: 600 });
  orchard.onMove(run, { length: 100, freeCells: 600 });
  assert.deepEqual(orchard.outcome(run, 'crash'), { success: true, medal: 1 });
  assert.deepEqual(orchard.outcome(orchard.begin(), 'crash'), { success: false, medal: 0 });
  assert.deepEqual(orchard.outcome(orchard.begin(), 'filled'), { success: true, medal: 4 });
  assert.equal(filled({ length: 300, freeCells: 600 }), 0.5);
});

test('points are weighted: the King Drift three at 1, 2 and 3 a tier, and every tier opens the next', () => {
  const family = (id) => FAMILIES.find((f) => f.id === id).challenges.map((c) => c.points);
  assert.deepEqual(family('zigzag'), [1, 2, 3]);
  assert.deepEqual(family('lane'), [2, 3, 4]);
  assert.deepEqual(family('drift'), [3, 4, 5]);
  assert.equal(CHALLENGE_POINTS_IN_ALL, CHALLENGES.reduce((sum, c) => sum + maxPoints(c), 0));
  assert.equal(new Set(CHALLENGES.map((c) => c.id)).size, CHALLENGES.length);
  assert.equal(challengeOpen(challengeById('lane-2'), {}), false);
  assert.equal(challengeOpen(challengeById('lane-2'), { 'lane-1': { done: true } }), true);
  assert.equal(pointsFor(challengeById('fill-orchard'), { medal: 3 }), 4);
});

test('a challenge done gives its points once, opens the next tier, and medals only go up', () => {
  const lane = challengeById('lane-1');
  const s = { ...emptySummary(), home: true, length: 3 };
  const first = recordChallenge(freshProgress(), lane, { success: true }, s);
  assert.equal(first.gained, 2);
  assert.equal(first.opened?.id, 'lane-2');
  assert.equal(challengePoints(first.progress), 2);
  const again = recordChallenge(first.progress, lane, { success: true }, s);
  assert.equal(again.gained, 0);
  assert.equal(again.opened, null);
  assert.equal(again.progress.challenges['lane-1'].tries, 2);

  const orchard = challengeById('fill-orchard');
  const silver = recordChallenge(freshProgress(), orchard, { success: true, medal: 2 }, s);
  assert.equal(silver.gained, 2);
  const bronze = recordChallenge(silver.progress, orchard, { success: true, medal: 1 }, s);
  assert.equal(bronze.gained, 0);
  assert.equal(bronze.progress.challenges['fill-orchard'].medal, 2);
});
