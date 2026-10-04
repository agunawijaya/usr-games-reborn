import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BASE_SPEED, carryEffects, CARRY, diveIsFair, FAIR_RAVENOUS_DIVES, ravenous } from '../src/carry.mjs';
import { seededRandom } from '../src/daily.mjs';
import { clearance, FIELD, isClear, LAYOUTS, pushOut, startFor } from '../src/fences.mjs';
import { REGIONS } from '../src/regions.mjs';
import { makeRival, stepRival } from '../src/rivals.mjs';

/** A clear spot for a fruit, as the page picks one: inside the margin, away from fences. */
function clearSpot(random, fences) {
  for (;;) {
    const x = 60 + random() * (FIELD.width - 120);
    const y = 60 + random() * (FIELD.height - 120);
    if (isClear(x, y, 28, fences)) return { x, y };
  }
}

test('every region names a layout, and every layout keeps clear of the edges and the start', () => {
  for (const region of REGIONS) assert.ok(LAYOUTS[region.fence], region.id);
  for (const [name, fences] of Object.entries(LAYOUTS)) {
    for (const r of fences) {
      assert.ok(r.x >= 60 && r.y >= 60, `${name}: room to pass on the west and north`);
      assert.ok(r.x + r.w <= FIELD.width - 60 && r.y + r.h <= FIELD.height - 60, `${name}: room on the east and south`);
    }
    // The snake starts with 45 segments 8 px apart, heading east.
    const start = startFor(name);
    for (let i = 0; i < 45; i++) {
      assert.ok(clearance(start.x - i * 8, start.y, fences) > 14, `${name}: the starting body is clear`);
    }
  }
});

test('a head driven into a fence is put back at its edge, the shortest way', () => {
  const [bar] = LAYOUTS.I; // x 444–456, y 170–430
  const head = { x: 447, y: 300 };
  assert.equal(pushOut(head, 8, LAYOUTS.I), true);
  assert.deepEqual(head, { x: bar.x - 8, y: 300 });
  const free = { x: 300, y: 300 };
  assert.equal(pushOut(free, 8, LAYOUTS.I), false);
  assert.deepEqual(free, { x: 300, y: 300 });
});

test('carrying makes the snake slower, stiffer and longer and the bird hungrier, each to a floor', () => {
  const none = carryEffects(0);
  assert.deepEqual(none, { speed: 1, turn: 1, grow: 0, patience: 1, lock: 1, dive: 1 });
  let before = none;
  for (let carried = 1; carried <= 30; carried++) {
    const now = carryEffects(carried);
    for (const key of ['speed', 'turn', 'patience', 'lock', 'dive']) assert.ok(now[key] <= before[key], `${key} at ${carried}`);
    assert.ok(now.grow >= before.grow);
    before = now;
  }
  assert.equal(before.speed, CARRY.slowest);
  assert.equal(before.patience, CARRY.hungriest);
  assert.equal(before.grow, CARRY.longest);
});

test('until the field is bare, a snake keeping straight on clears every dive, however much it carries', () => {
  for (const region of REGIONS) assert.ok(diveIsFair(region.tuning), region.id);
});

test('once the field is bare, three dives stay fair, then they quicken until staying is impossible', () => {
  for (let n = 0; n < FAIR_RAVENOUS_DIVES; n++) assert.equal(ravenous(n).dive, 1, `ravenous dive ${n + 1} is fair`);
  for (const region of REGIONS) {
    const slowest = BASE_SPEED * CARRY.slowest;
    const reach = (n) => slowest * region.tuning.diveMs * CARRY.quickestDive * ravenous(n).dive;
    assert.ok(reach(FAIR_RAVENOUS_DIVES + 2) < region.tuning.strikeRadius, `${region.id}: three quick dives later a straight run is not enough`);
  }
  assert.ok(ravenous(0).patienceMs >= 500);
});

test('rivals find the fruit round every fence, never pass through one, and leave once the field is bare', () => {
  for (const [name, fences] of Object.entries(LAYOUTS)) {
    const random = seededRandom(7);
    const rival = makeRival(0, 0.08);
    const apples = Array.from({ length: 4 }, () => clearSpot(random, fences));
    let eaten = 0;
    let bare = false;
    for (let t = 0; t < 240_000 && !rival.gone; t += 16) {
      const world = { apples, fences, bare, width: FIELD.width, height: FIELD.height, random };
      const ate = stepRival(rival, world, 16);
      const head = rival.segments[0];
      if (!rival.leaving) assert.ok(clearance(head.x, head.y, fences) > 6.9, `${name}: the head stays out of the fence`);
      if (ate >= 0) {
        eaten++;
        if (eaten < 12) apples[ate] = clearSpot(random, fences);
        else apples.splice(ate, 1);
      }
      if (apples.length === 0) bare = true;
    }
    assert.equal(eaten, 15, `${name}: a rival ate all 15 within four minutes`);
    assert.ok(rival.gone, `${name}: it left once the field was bare`);
  }
});
