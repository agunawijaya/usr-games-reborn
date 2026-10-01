// Derived views over the pom engine: principal-phase events and
// month grids. Everything here is computed from pom's own elongation
// (potm's D), so the calendar and event list always agree with the
// one-line BSD output and with the rendered Moon.

import { daysSinceEpoch, elongation, describe } from './pom.js';

export const EVENT_TYPES = [
  { key: 'new', angle: 0, name: 'New Moon' },
  { key: 'first-quarter', angle: 90, name: 'First Quarter' },
  { key: 'full', angle: 180, name: 'Full Moon' },
  { key: 'last-quarter', angle: 270, name: 'Last Quarter' },
];

const STEP = 6 * 3600; // coarse scan step (s); D moves ~3 deg per step

// Signed angular distance from `target` to `e`, in (-180, 180].
function delta(e, target) {
  let d = (e - target) % 360;
  if (d <= -180) d += 360;
  if (d > 180) d -= 360;
  return d;
}

const E = (t) => elongation(daysSinceEpoch(t));

/**
 * Find the next `count` principal phases strictly after `fromT`
 * (Unix seconds). Bisection to 1 s on pom's elongation.
 */
export function upcomingEvents(fromT, count = 8) {
  const out = [];
  let a = fromT;
  let ea = E(a);
  while (out.length < count) {
    const b = a + STEP;
    const eb = E(b);
    for (const ev of EVENT_TYPES) {
      const da = delta(ea, ev.angle);
      const db = delta(eb, ev.angle);
      if (da < 0 && db >= 0 && db - da < 90) {
        let lo = a;
        let hi = b;
        while (hi - lo > 1) {
          const mid = (lo + hi) / 2;
          if (delta(E(mid), ev.angle) < 0) lo = mid;
          else hi = mid;
        }
        out.push({ ...ev, t: Math.round(hi) });
      }
    }
    a = b;
    ea = eb;
  }
  out.sort((x, y) => x.t - y.t);
  return out.slice(0, count);
}

/** Events in [fromT, toT). */
export function eventsBetween(fromT, toT) {
  const res = [];
  let cursor = fromT - 1;
  for (;;) {
    const batch = upcomingEvents(cursor, 4);
    for (const ev of batch) {
      if (ev.t >= toT) return res;
      if (ev.t >= fromT) res.push(ev);
    }
    cursor = batch[batch.length - 1].t;
  }
}

/**
 * A month grid for the calendar. `year` full year, `mon` 0..11.
 * Each day is sampled at local noon, the pom command for that
 * sample being `pom ccyymmdd12`.
 */
export function monthGrid(year, mon, { zone, now, weekStart = 0 }) {
  const first = zone.mktime({ year, mon, mday: 1, hour: 12 });
  const firstLt = zone.localtime(first);
  const days = [];
  for (let mday = 1; mday <= 31; mday++) {
    const t = zone.mktime({ year, mon, mday, hour: 12 });
    const lt = zone.localtime(t);
    if (lt.mon !== mon) break;
    days.push({ mday, t, wday: lt.wday, report: describe(t, now), events: [] });
  }
  const start = zone.mktime({ year, mon, mday: 1, hour: 0 });
  const end = zone.mktime({ year, mon: mon + 1, mday: 1, hour: 0 });
  for (const ev of eventsBetween(start, end)) {
    const lt = zone.localtime(ev.t);
    const day = days[lt.mday - 1];
    if (day) day.events.push(ev);
  }
  return { year, mon, lead: (firstLt.wday - weekStart + 7) % 7, days };
}
