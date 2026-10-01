// Selene derived-view tests: phase events and month grids.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fixedZone, describe, elongation, daysSinceEpoch } from '../src/engine/pom.js';
import { upcomingEvents, eventsBetween, monthGrid } from '../src/engine/events.js';

const WIB = fixedZone(420, 'WIB');
const NOW = WIB.mktime({ year: 2026, mon: 8, mday: 23, hour: 12 });

test('upcomingEvents cycles New -> FQ -> Full -> LQ in order', () => {
  const evs = upcomingEvents(NOW, 12);
  assert.equal(evs.length, 12);
  const order = ['new', 'first-quarter', 'full', 'last-quarter'];
  for (let i = 1; i < evs.length; i++) {
    assert.ok(evs[i].t > evs[i - 1].t);
    const a = order.indexOf(evs[i - 1].key);
    assert.equal(evs[i].key, order[(a + 1) % 4]);
  }
});

test('event instants hit the target elongation to within a second of motion', () => {
  for (const ev of upcomingEvents(NOW, 8)) {
    let e = elongation(daysSinceEpoch(ev.t));
    let d = Math.abs(e - ev.angle);
    d = Math.min(d, 360 - d);
    assert.ok(d < 0.01, `${ev.key} off by ${d} deg`);
  }
});

test('event spacing is a plausible synodic quarter (6.5-8.5 days)', () => {
  const evs = upcomingEvents(NOW, 16);
  for (let i = 1; i < evs.length; i++) {
    const days = (evs[i].t - evs[i - 1].t) / 86400;
    assert.ok(days > 6.5 && days < 8.5, `gap ${days}`);
  }
});

test('the pom sentence at each Full/New event hour agrees with the event', () => {
  for (const ev of upcomingEvents(NOW, 12)) {
    if (ev.key !== 'full' && ev.key !== 'new') continue;
    const r = describe(ev.t, NOW);
    assert.equal(r.key, ev.key);
  }
});

test('October 2026 events match the original binary around them', () => {
  // Real /usr/games/pom (TZ=Asia/Jakarta): Oct 19 00h First Quarter,
  // Oct 26 & 27 00h Full, Nov 9 00h New.
  const from = WIB.mktime({ year: 2026, mon: 9, mday: 15, hour: 0 });
  const to = WIB.mktime({ year: 2026, mon: 10, mday: 15, hour: 0 });
  const evs = eventsBetween(from, to);
  const day = (ev) => WIB.localtime(ev.t);
  const fq = evs.find((e) => e.key === 'first-quarter');
  const full = evs.find((e) => e.key === 'full');
  const nw = evs.find((e) => e.key === 'new');
  assert.deepEqual([day(fq).mon, day(fq).mday], [9, 18]);  // just before Oct 19 00h
  assert.deepEqual([day(full).mon, day(full).mday], [9, 26]);
  assert.deepEqual([day(nw).mon, day(nw).mday], [10, 9]);
});

test('monthGrid: correct length, lead offset and events attached', () => {
  const g = monthGrid(2026, 9, { zone: WIB, now: NOW });
  assert.equal(g.days.length, 31);
  assert.equal(g.lead, 4); // 1 Oct 2026 is a Thursday
  const flat = g.days.flatMap((d) => d.events.map((e) => e.key));
  assert.ok(flat.includes('full'));
  assert.ok(flat.includes('first-quarter'));
  const feb = monthGrid(2028, 1, { zone: WIB, now: NOW });
  assert.equal(feb.days.length, 29); // leap year
});
