// Selene engine tests — faithful port of BSD pom(6).
// Run: node --test tests/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  potm, potmDetail, elongation, adj360, cRound0, describe, runPom, parseTime,
  fixedZone, formatHeader, toCompressed, phaseState, daysSinceEpoch, USAGE, ILLEGAL,
} from '../src/engine/pom.js';

const UTC = fixedZone(0, 'UTC');
const WIB = fixedZone(420, 'WIB');

// ---------------------------------------------------------------------------
// Golden fixtures: 1,616 invocations of the ORIGINAL /usr/games/pom binary
// (bsdgames 2.17, Ubuntu) captured under TZ=UTC and TZ=Asia/Jakarta, each
// with the `now` it was run at. The port must reproduce stdout, stderr and
// exit code byte-for-byte.
// ---------------------------------------------------------------------------

const golden = JSON.parse(readFileSync(new URL('./fixtures/pom-binary-golden.json', import.meta.url)));

test('golden: port matches original binary byte-for-byte', () => {
  let checked = 0;
  const failures = [];
  for (const g of golden) {
    // Asia/Jakarta used other offsets before 1964 (+07:20, +07:30, +09:00);
    // we pin WIB (+07:00), so skip header lines that are not WIB.
    if (g.tz !== 'UTC' && g.stdout.includes('(') && !g.stdout.includes('(WIB)')) continue;
    const zone = g.tz === 'UTC' ? UTC : WIB;
    const r = runPom(g.arg ?? undefined, { now: g.now, zone });
    checked++;
    if (r.stdout !== g.stdout || r.stderr !== g.stderr || r.code !== g.code) {
      failures.push({ arg: g.arg, tz: g.tz, want: g.stdout || g.stderr, got: r.stdout || r.stderr });
    }
  }
  assert.ok(checked > 1500, `expected >1500 fixtures checked, got ${checked}`);
  assert.deepEqual(failures.slice(0, 5), [], `${failures.length} mismatches`);
});

// ---------------------------------------------------------------------------
// Canonical scenarios — bsdgames/pom/docs/test-scenarios.md
// (scenarios 2-4 revised 2026-09-24; expected lines captured from the real binary)
// ---------------------------------------------------------------------------

// "now" for scenarios: 2026-09-23 12:00 WIB (the day this port was written)
const NOW = WIB.mktime({ year: 2026, mon: 8, mday: 23, hour: 12 });

test('scenario 1: current phase, no argument', () => {
  const r = runPom(undefined, { now: NOW, zone: WIB });
  assert.equal(r.code, 0);
  assert.equal(r.stderr, '');
  assert.match(
    r.stdout,
    /^The Moon is (New|Full|at the (First|Last) Quarter|(Waxing|Waning) (Crescent|Gibbous) \(\d{1,2}% of Full\))\n$/,
  );
});

test('scenario 2: known Full Moon', () => {
  const r = runPom('2026102600', { now: NOW, zone: WIB });
  assert.equal(r.stdout, 'Mon 2026 Oct 26 00:00:00 (WIB):  The Moon will be Full\n');
  assert.equal(r.code, 0);
});

test('scenario 3: known New Moon', () => {
  const r = runPom('2026110900', { now: NOW, zone: WIB });
  assert.equal(r.stdout, 'Mon 2026 Nov  9 00:00:00 (WIB):  The Moon will be New\n');
  assert.equal(r.code, 0);
});

test('scenario 4: quarter phase', () => {
  const r = runPom('2026101900', { now: NOW, zone: WIB });
  assert.equal(r.stdout, 'Mon 2026 Oct 19 00:00:00 (WIB):  The Moon will be at the First Quarter\n');
  assert.equal(r.code, 0);
});

test('scenario 5: invalid date prints usage to stderr, exit 1', () => {
  const r = runPom('991399', { now: NOW, zone: WIB });
  assert.equal(r.stdout, '');
  assert.equal(r.stderr, `${ILLEGAL}\n${USAGE}\n`);
  assert.equal(r.code, 1);
});

test('scenario 6: eight digits mean yymmddHH', () => {
  // `20261031` = yy 20, mm 26 -> month 26 is illegal. The pre-revision
  // scenarios 2-4 used such inputs; the real binary rejects them all.
  for (const a of ['20261031', '20261101', '20261024']) {
    const r = runPom(a, { now: NOW, zone: WIB });
    assert.equal(r.code, 1, a);
    assert.equal(r.stderr, `${ILLEGAL}\n${USAGE}\n`, a);
  }
  assert.equal(runPom('26103100', { now: NOW, zone: WIB }).stdout,
    'Sat 2026 Oct 31 00:00:00 (WIB):  The Moon will be Waning Gibbous (74% of Full)\n');
});

test('scenario 7: past tense and mktime normalisation', () => {
  assert.equal(runPom('25011400', { now: NOW, zone: WIB }).stdout,
    'Tue 2025 Jan 14 00:00:00 (WIB):  The Moon was Full\n');
  assert.equal(runPom('2026022900', { now: NOW, zone: WIB }).stdout,
    'Sun 2026 Mar  1 00:00:00 (WIB):  The Moon was Waxing Gibbous (91% of Full)\n');
});

test('game-level media captures reproduce (real binary screenshots)', () => {
  const now = WIB.mktime({ year: 2025, mon: 8, mday: 1, hour: 0 });
  assert.equal(runPom('25011400', { now, zone: WIB }).stdout,
    'Tue 2025 Jan 14 00:00:00 (WIB):  The Moon was Full\n');
  assert.equal(runPom('25030700', { now, zone: WIB }).stdout,
    'Fri 2025 Mar  7 00:00:00 (WIB):  The Moon was at the First Quarter\n');
});

// ---------------------------------------------------------------------------
// Algorithm details
// ---------------------------------------------------------------------------

test('adj360 keeps the closed interval [0, 360]', () => {
  assert.equal(adj360(-10), 350);
  assert.equal(adj360(725), 5);
  assert.equal(adj360(360), 360); // original loop leaves 360 alone
  assert.equal(adj360(0), 0);
});

test('potm is 50 * (1 - cos D) and elongation is D normalised', () => {
  for (const days of [-5000, -1, 0, 1, 1234.5, 13000.25]) {
    const { D, percent } = potmDetail(days);
    assert.ok(Math.abs(percent - 50 * (1 - Math.cos(D * Math.PI / 180))) < 1e-9);
    assert.equal(potm(days), percent);
    const e = elongation(days);
    assert.ok(e >= 0 && e < 360);
    assert.ok(Math.abs(Math.cos(e * Math.PI / 180) - Math.cos(D * Math.PI / 180)) < 1e-9);
  }
});

test('cRound0 mirrors printf %1.0f (ties to even)', () => {
  assert.equal(cRound0(2.5), 2);
  assert.equal(cRound0(3.5), 4);
  assert.equal(cRound0(3.4999), 3);
  assert.equal(cRound0(49.51), 50);
});

test('tense: was / is / will be compares whole seconds', () => {
  const t = 1790000000;
  assert.equal(describe(t - 1, t).tense, 'was');
  assert.equal(describe(t, t).tense, 'is');
  assert.equal(describe(t + 0.4, t).tense, 'is');
  assert.equal(describe(t + 1, t).tense, 'will be');
});

test('all eight phase names are reachable across a month', () => {
  const seen = new Set();
  const start = WIB.mktime({ year: 2026, mon: 9, mday: 1, hour: 0 });
  for (let h = 0; h < 24 * 31; h++) seen.add(describe(start + h * 3600, NOW).key);
  for (const k of ['new', 'waxing-crescent', 'first-quarter', 'waxing-gibbous',
    'full', 'waning-gibbous', 'last-quarter', 'waning-crescent']) {
    assert.ok(seen.has(k), `missing ${k}`);
  }
});

test('parseTime: defaults fields from now and zeroes minutes/seconds', () => {
  const now = WIB.mktime({ year: 2026, mon: 8, mday: 23, hour: 14, min: 37, sec: 12 });
  const r = parseTime('05', { now, zone: WIB });
  assert.ok(r.ok);
  assert.equal(formatHeader(r.t, WIB), 'Wed 2026 Sep 23 05:00:00 (WIB)');
  const r2 = parseTime('2026022900', { now, zone: WIB }); // mktime normalises
  assert.equal(formatHeader(r2.t, WIB), 'Sun 2026 Mar  1 00:00:00 (WIB)');
  const r3 = parseTime('68010100', { now, zone: WIB });   // yy < 69 -> 20yy
  assert.equal(WIB.localtime(r3.t).year, 2068);
  const r4 = parseTime('69010100', { now, zone: WIB });   // yy >= 69 -> 19yy
  assert.equal(WIB.localtime(r4.t).year, 1969);
});

test('parseTime: rejects every malformed shape', () => {
  for (const a of ['', '1', '123', '12345', '1234567', '123456789', '12345678901',
    'ab', '1a', ' 12', '+12', '-1', '24', '0000', '000000', '2026130100', '2026003100']) {
    assert.equal(parseTime(a, { now: NOW, zone: WIB }).ok, false, JSON.stringify(a));
  }
});

test('toCompressed round-trips through parseTime', () => {
  const t = WIB.mktime({ year: 2031, mon: 6, mday: 4, hour: 21 });
  const arg = toCompressed(t, WIB);
  assert.equal(arg, '2031070421');
  assert.equal(parseTime(arg, { now: NOW, zone: WIB }).t, t);
});

test('phaseState: lit fraction equals (1 - cos D) / 2 and waxing iff D < 180', () => {
  for (let k = 0; k < 60; k++) {
    const t = NOW + k * 43200;
    const s = phaseState(t);
    const expect = (1 - Math.cos(s.elongation * Math.PI / 180)) / 2;
    assert.ok(Math.abs(s.illuminated - expect) < 1e-9);
    assert.equal(s.waxing, s.elongation < 180);
    assert.equal(s.days, daysSinceEpoch(t));
  }
});
