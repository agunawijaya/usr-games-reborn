import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PAGES, pagesFound } from '../src/book.mjs';
import { CONTRACTS, newStamps, STAMPS_IN_ALL, stampKey } from '../src/contracts.mjs';
import { dailyFlight, dailyNumber, dailyShareLine, seededRandom } from '../src/daily.mjs';
import { freshProgress, packagesEarned, recordFlight } from '../src/progress.mjs';
import { expeditionComplete, isCleared, openRegions, REGIONS, regionOpenedBy } from '../src/regions.mjs';

const flight = (patch = {}) => ({
  escaped: true, fruit: 0, dodges: 0, locks: 0, edge: 'east', seconds: 30, rivalsAte: 0, rivalsTaken: 0, bare: true, ...patch,
});

/** Every region cleared but those named. */
const clearedAllBut = (...ids) =>
  Object.fromEntries(REGIONS.filter((r) => !ids.includes(r.id)).map((r) => [r.id, r.goal]));

test('eight regions, each harder than the one before: a hungrier bird, more rivals, quicker hunters', () => {
  assert.equal(REGIONS.length, 8);
  for (let i = 1; i < REGIONS.length; i++) {
    const [before, now] = [REGIONS[i - 1], REGIONS[i]];
    assert.ok(now.tuning.patience <= before.tuning.patience, `${now.id} waits no longer`);
    assert.ok(now.tuning.diveMs <= before.tuning.diveMs, `${now.id} dives no slower`);
    assert.ok(now.tuning.lockMs <= before.tuning.lockMs, `${now.id} locks no slower`);
    assert.ok(now.rivals >= before.rivals && now.rivalSpeed >= before.rivalSpeed, `${now.id} has no fewer or slower rivals`);
    assert.ok(now.goal >= before.goal, `${now.id} asks for no less`);
    assert.ok(now.hunter.speed >= before.hunter.speed || now.hunter.count > before.hunter.count, `${now.id} hunts no slower`);
  }
  const neon = REGIONS.find((r) => r.id === 'neon-grid');
  assert.deepEqual(
    [neon.tuning.patience, neon.tuning.patienceSpread, neon.tuning.lockMs, neon.tuning.glideSpeed, neon.tuning.firstDelay],
    [4500, 250, 900, 105, 2000],
    'the Neon Grid’s bird keeps the port’s own timing',
  );
});

test('every region’s harvest leaves room for its goal, its rivals’ share and the haul contract', () => {
  for (const region of REGIONS) {
    const hauls = CONTRACTS[region.id].filter((c) => c.id.startsWith('haul')).map((c) => Number(c.id.slice(5)));
    assert.ok(region.harvest >= region.goal * 2, `${region.id}: a harvest of at least twice the goal`);
    assert.ok(region.harvest > Math.max(...hauls), `${region.id}: its haul contract can be met`);
  }
});

test('regions open one at a time, each once the one before is cleared; Midnight cleared ends the expedition', () => {
  assert.deepEqual(openRegions({}), ['savanna']);
  assert.deepEqual(openRegions({ savanna: 3 }), ['savanna']);
  assert.deepEqual(openRegions({ savanna: 4 }), ['savanna', 'river']);
  assert.deepEqual(openRegions({ savanna: 9, river: 5, jungle: 2 }), ['savanna', 'river', 'jungle']);
  assert.equal(isCleared(REGIONS[0], { savanna: 4 }), true);
  assert.equal(regionOpenedBy('savanna', 4, 3)?.id, 'river');
  assert.equal(regionOpenedBy('savanna', 4, 4), null, 'already open');
  assert.equal(regionOpenedBy('midnight', 20, 0), null, 'the last region opens nothing');
  assert.equal(expeditionComplete(clearedAllBut('midnight')), false);
  assert.equal(expeditionComplete(clearedAllBut()), true);
});

test('three contracts a region, twenty-four stamps, each earned once', () => {
  assert.equal(STAMPS_IN_ALL, 24);
  for (const region of REGIONS) assert.equal(CONTRACTS[region.id].length, 3, region.id);
  const fresh = newStamps('savanna', flight({ fruit: 6, dodges: 1, edge: 'north' }), []);
  assert.equal(fresh.length, 3);
  assert.deepEqual(newStamps('savanna', flight({ fruit: 6, dodges: 1, edge: 'north' }), fresh), []);
  assert.deepEqual(newStamps('savanna', flight({ escaped: false, fruit: 9, dodges: 4 }), []), [], 'caught earns nothing');
});

test('a calm contract counts lock-ons; outeating counts the rivals; a decoy needs a rival taken', () => {
  const calm = CONTRACTS.jungle.find((c) => c.id.startsWith('calm'));
  assert.equal(calm.met(flight({ fruit: 5, locks: 3 })), true);
  assert.equal(calm.met(flight({ fruit: 5, locks: 4 })), false);
  const outeat = CONTRACTS.river.find((c) => c.id === 'outeat');
  assert.equal(outeat.met(flight({ fruit: 5, rivalsAte: 4 })), true);
  assert.equal(outeat.met(flight({ fruit: 4, rivalsAte: 4 })), false, 'a draw is not enough');
  const decoy = CONTRACTS.desert.find((c) => c.id.startsWith('decoy'));
  assert.equal(decoy.met(flight({ fruit: 6, rivalsTaken: 1 })), true);
  assert.equal(decoy.met(flight({ fruit: 9, rivalsTaken: 0 })), false);
});

test('the Daily Flight: numbered like the Hall, the regions in turn, the same draws for everyone', () => {
  assert.equal(dailyNumber('2026-09-01'), 1);
  assert.equal(dailyNumber('2026-10-02'), 32);
  assert.equal(dailyFlight('2026-09-01').region.id, REGIONS[0].id);
  assert.equal(dailyFlight('2026-09-09').region.id, REGIONS[0].id);
  const a = seededRandom(dailyFlight('2026-10-02').seed);
  const b = seededRandom(dailyFlight('2026-10-02').seed);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
  assert.equal(
    dailyShareLine({ number: 32, regionName: 'Midnight', escaped: true, fruit: 9, dodges: 3 }),
    'Talon’s Shadow #32 · Midnight · escaped with 🍎9 · 🪶3'.replace('’', "'"),
  );
});

test('a flight is recorded: best haul, stamps, pages, a region cleared and the next opened, packages', () => {
  const { progress, stamps, opened, pages, packages, firstClear, completed } = recordFlight(freshProgress(), {
    regionId: 'savanna',
    summary: flight({ fruit: 6, dodges: 1, edge: 'north' }),
    daily: null,
  });
  assert.equal(progress.bestHaul.savanna, 6);
  assert.equal(stamps.length, 3);
  assert.equal(firstClear, true);
  assert.equal(completed, false);
  assert.equal(opened?.id, 'river');
  assert.deepEqual(pages, ['savanna/bird', 'savanna/fruit']);
  assert.ok(packages.includes('first-escape'));
  assert.ok(packages.includes('first-stamp'));
  assert.equal(progress.escapes, 1);
  assert.equal(progress.fruitSecured, 6);
});

test('clearing Midnight, the last region, completes the expedition once', () => {
  const goal = REGIONS[REGIONS.length - 1].goal;
  const before = { ...freshProgress(), bestHaul: clearedAllBut('midnight') };
  const short = recordFlight(before, { regionId: 'midnight', summary: flight({ fruit: goal - 1 }), daily: null });
  assert.equal(short.completed, false);
  const last = recordFlight(short.progress, { regionId: 'midnight', summary: flight({ fruit: goal }), daily: null });
  assert.equal(last.completed, true);
  assert.ok(last.packages.includes('owl-light'));
  const again = recordFlight(last.progress, { regionId: 'midnight', summary: flight({ fruit: goal + 2 }), daily: null });
  assert.equal(again.completed, false, 'the ending comes once');
});

test('caught keeps no haul and opens nothing, but the field book still learns', () => {
  const { progress, opened, pages } = recordFlight(freshProgress(), {
    regionId: 'savanna',
    summary: flight({ escaped: false, fruit: 8, dodges: 2 }),
    daily: null,
  });
  assert.equal(progress.bestHaul.savanna, undefined);
  assert.equal(opened, null);
  assert.deepEqual(pages, ['savanna/bird', 'savanna/fruit']);
  assert.equal(progress.catches, 1);
});

test('only the first Daily Flight of a day counts, and it stamps nothing', () => {
  let state = freshProgress();
  const first = recordFlight(state, { regionId: 'midnight', summary: flight({ fruit: 3 }), daily: '2026-10-02' });
  assert.equal(first.firstDaily, true);
  assert.deepEqual(first.stamps, []);
  state = first.progress;
  const second = recordFlight(state, { regionId: 'midnight', summary: flight({ fruit: 9 }), daily: '2026-10-02' });
  assert.equal(second.firstDaily, false);
  assert.equal(second.progress.dailies['2026-10-02'].fruit, 3);
  assert.equal(second.progress.dailyFlights, 1);
});

test('the packages follow the progress', () => {
  const full = freshProgress();
  full.pages = PAGES.map((p) => p.key);
  full.stamps = REGIONS.flatMap((r) => CONTRACTS[r.id].map((c) => stampKey(r.id, c)));
  full.dailyFlights = 7;
  full.bestHaul = clearedAllBut();
  const ids = packagesEarned(full, flight({ fruit: 15, dodges: 5 }));
  for (const id of ['field-guide', 'stamp-collector', 'daily-flier', 'into-the-night', 'full-basket', 'dodger', 'owl-light']) {
    assert.ok(ids.includes(id), id);
  }
  assert.deepEqual(packagesEarned(freshProgress(), flight({ fruit: 0 })), ['empty-handed']);
});

test('a page is found once', () => {
  assert.deepEqual(pagesFound('river', flight({ fruit: 1 }), []), ['river/fruit']);
  assert.deepEqual(pagesFound('river', flight({ fruit: 1, dodges: 1 }), ['river/fruit']), ['river/bird']);
});
