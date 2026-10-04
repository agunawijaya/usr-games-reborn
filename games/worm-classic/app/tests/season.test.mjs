// Orchard Crawl — the season's rules: orchards and what opens them, the burrow's spot, the stars,
// the almanac, the Daily Orchard and what a crawl changes in the saved progress.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PAGES, pagesFound } from '../src/almanac.mjs';
import { distancesFrom, placeBurrow } from '../src/burrow.mjs';
import { dailyNumber, dailyOrchard, dailyShareLine, dailyStreams } from '../src/daily.mjs';
import { ORCHARDS, crawlRules, freeRules, openOrchards, seasonComplete } from '../src/orchards.mjs';
import { STARS_IN_ALL, clearedOrchards, freshProgress, packagesEarned, recordCrawl, starCount } from '../src/progress.mjs';
import { FEATS, emptySummary, newStars, onCourse, starsOf } from '../src/stars.mjs';

const manifest = JSON.parse(readFileSync(new URL('../../manifest.json', import.meta.url), 'utf8'));
const summary = (patch) => ({ ...emptySummary(), ...patch });

test('eight orchards, one look each, every harvest and feat defined', () => {
  assert.equal(ORCHARDS.length, 8);
  assert.equal(new Set(ORCHARDS.map((o) => o.theme)).size, 8);
  for (const orchard of ORCHARDS) {
    assert.ok(orchard.harvest >= 8 && orchard.harvest <= 20, orchard.id);
    assert.ok(FEATS[orchard.feat], orchard.feat);
    assert.ok(orchard.points > 0);
  }
  assert.equal(ORCHARDS[0].apples, 'single', 'the season starts by the 1980 rule');
  assert.deepEqual(ORCHARDS.at(-1).creatures, ['frog', 'bird', 'wasps', 'rival', 'gardener']);
});

test('each orchard after the first brings in something new', () => {
  for (let i = 1; i < ORCHARDS.length - 1; i++) {
    const before = ORCHARDS[i - 1];
    const now = ORCHARDS[i];
    const fresh = now.creatures.filter((c) => !ORCHARDS.slice(0, i).some((o) => o.creatures.includes(c)));
    const newGround = now.fence !== 'none' && ORCHARDS.slice(0, i).every((o) => o.fence === 'none');
    assert.ok(fresh.length > 0 || newGround || before.apples !== now.apples, now.id);
  }
});

test('the rules handed to the page use the port’s own settings', () => {
  const desert = ORCHARDS.find((o) => o.id === 'desert');
  const rules = crawlRules(desert);
  assert.equal(rules.mode, 'wild');
  assert.equal(rules.fence, 'h');
  assert.equal(rules.enemyWasps, true);
  assert.equal(rules.enemyRival, false);
  assert.equal(rules.harvest, desert.harvest);
  assert.equal(typeof rules.placeBurrow, 'function');
  const free = freeRules({ mode: 'pure', speed: 'fast', fence: 'box', creatures: ['rival'] });
  assert.equal(free.enemyRival, false, 'creatures come only with a full orchard');
  assert.equal(free.harvest, undefined, 'the free orchard has no burrow');
});

test('orchards open one after another, and the season ends with Midnight', () => {
  assert.deepEqual(openOrchards([]), ['neon-grid']);
  assert.deepEqual(openOrchards(['neon-grid']), ['neon-grid', 'savanna']);
  assert.deepEqual(openOrchards(['savanna']), ['neon-grid'], 'skipping one opens nothing beyond it');
  assert.equal(seasonComplete(ORCHARDS.slice(0, 7).map((o) => o.id)), false);
  assert.equal(seasonComplete(ORCHARDS.map((o) => o.id)), true);
});

test('the burrow opens where the worm can reach it, never inside a wall', () => {
  const walls = new Set();
  // A wall of fence down column 10 with no gap: everything east of it is out of reach.
  for (let y = 0; y < 20; y++) walls.add(`10,${y}`);
  for (let seed = 0; seed < 40; seed++) {
    let n = seed;
    const random = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
    const spot = placeBurrow({ cols: 30, rows: 20, head: { x: 4, y: 10 }, walls, random });
    assert.ok(spot, 'a spot is found');
    assert.ok(spot.x < 10, `west of the fence: ${spot.x},${spot.y}`);
    const steps = distancesFrom({ x: 4, y: 10 }, 30, 20, walls).get(`${spot.x},${spot.y}`);
    assert.ok(steps >= 6 && steps <= 14, `6 to 14 steps away: ${steps}`);
  }
});

test('the burrow avoids taken cells, and gives up when there is no room', () => {
  const walls = new Set();
  const taken = new Set();
  for (let x = 0; x < 30; x++) for (let y = 0; y < 20; y++) if (x > 2 || y > 2) walls.add(`${x},${y}`);
  // A pocket of three by three: the only cells three steps away are the far corner and its two
  // neighbours, and apples lie on all three.
  assert.deepEqual(placeBurrow({ cols: 30, rows: 20, head: { x: 0, y: 0 }, walls, taken, random: () => 0 }), { x: 2, y: 1 });
  for (const cell of ['2,1', '1,2', '2,2']) taken.add(cell);
  assert.equal(placeBurrow({ cols: 30, rows: 20, head: { x: 0, y: 0 }, walls, taken }), null);
});

test('three stars: home, points and the feat, all on a crawl that comes home', () => {
  const savanna = ORCHARDS.find((o) => o.id === 'savanna');
  const stars = starsOf(savanna);
  assert.deepEqual(stars.map((s) => s.id), ['home', 'points', 'feat']);
  const crashed = summary({ home: false, score: 999, frogs: 2 });
  assert.deepEqual(newStars(savanna, crashed), []);
  const home = summary({ home: true, score: savanna.points, frogs: 1 });
  assert.deepEqual(newStars(savanna, home), ['home', 'points', 'feat']);
  assert.deepEqual(newStars(savanna, home, ['home', 'feat']), ['points']);
  assert.equal(onCourse(stars[2], summary({ frogs: 1 })), true, 'the ledger shows a feat already done');
});

test('the feats ask for what each orchard brings in', () => {
  assert.equal(FEATS['no-theft'].met(summary({ birdVisits: 0 })), false, 'the bird has to come first');
  assert.equal(FEATS['no-theft'].met(summary({ birdVisits: 2, stolen: 0 })), true);
  assert.equal(FEATS['no-theft'].met(summary({ birdVisits: 2, stolen: 1 })), false);
  assert.equal(FEATS.short.met(summary({ length: 49 })), true);
  assert.equal(FEATS.short.met(summary({ length: 50 })), false);
  assert.equal(FEATS.night.met(summary({ frogs: 1, rivalCrashes: 0 })), false);
  assert.equal(FEATS.night.met(summary({ frogs: 1, rivalCrashes: 1 })), true);
});

test('almanac pages fill in once, each from its own meeting', () => {
  assert.equal(PAGES.length, 8);
  assert.deepEqual(pagesFound(summary({ harvested: 3, home: true })), ['apple', 'burrow']);
  assert.deepEqual(pagesFound(summary({ harvested: 3, frogs: 1 }), ['apple']), ['frog']);
  assert.deepEqual(pagesFound(summary({ gardenerVisits: 1, gardenerSeenOff: 0 })), []);
});

test('the Daily Orchard: numbered like the Hall, the eight in turn, the same draws for everyone', () => {
  assert.equal(dailyNumber('2026-09-01'), 1);
  assert.equal(dailyNumber('2026-10-03'), 33);
  assert.equal(dailyOrchard('2026-09-01').orchard.id, ORCHARDS[0].id);
  assert.equal(dailyOrchard('2026-09-09').orchard.id, ORCHARDS[0].id);
  const a = dailyStreams('2026-10-03');
  const b = dailyStreams('2026-10-03');
  for (let i = 0; i < 20; i++) assert.equal(a.value(), b.value());
  assert.notEqual(dailyStreams('2026-10-04').value(), dailyStreams('2026-10-03').value());
  // The streams are independent: drawing places does not shift the numbers.
  const c = dailyStreams('2026-10-03');
  const d = dailyStreams('2026-10-03');
  for (let i = 0; i < 7; i++) c.place();
  assert.equal(c.value(), d.value());
});

test('the share line has no link', () => {
  const line = dailyShareLine({ number: 33, orchardName: 'Desert', home: true, apples: 13, score: 214, stars: 2 });
  assert.equal(line, 'Orchard Crawl #33 · Desert · home · 🍎13 · 214 pts · ★★☆');
  assert.doesNotMatch(line, /https?:/);
});

test('a crawl home clears the orchard, opens the next and keeps its best', () => {
  const first = ORCHARDS[0];
  const s = summary({ home: true, score: 155, harvested: first.harvest, bestBite: 16, chains: 1, length: 40 });
  const outcome = recordCrawl(freshProgress(), { kind: 'orchard', orchardId: first.id, summary: s });
  assert.deepEqual(outcome.stars, ['home', 'points', 'feat']);
  assert.equal(outcome.firstClear, true);
  assert.equal(outcome.opened?.id, 'savanna');
  assert.equal(outcome.progress.best[first.id], 155);
  assert.deepEqual(clearedOrchards(outcome.progress), [first.id]);
  assert.ok(outcome.packages.includes('first-home'));
  assert.ok(outcome.packages.includes('old-rules'), 'one apple at a time, 150 or more');
  const again = recordCrawl(outcome.progress, { kind: 'orchard', orchardId: first.id, summary: { ...s, score: 1 } });
  assert.equal(again.firstClear, false);
  assert.equal(again.progress.best[first.id], 155, 'a lower score keeps the best');
});

test('a crash keeps nothing but the totals and the almanac', () => {
  const s = summary({ home: false, score: 400, harvested: 9, frogs: 1, reason: 'self' });
  const outcome = recordCrawl(freshProgress(), { kind: 'orchard', orchardId: 'neon-grid', summary: s });
  assert.deepEqual(outcome.stars, []);
  assert.equal(outcome.progress.best['neon-grid'], undefined);
  assert.equal(outcome.progress.crashes, 1);
  assert.deepEqual(outcome.pages, ['apple', 'frog']);
});

test('only the first Daily Orchard of the day is recorded, and it opens nothing', () => {
  const key = '2026-10-03';
  const { orchard } = dailyOrchard(key);
  const s = summary({ home: true, score: 50, harvested: orchard.harvest });
  const first = recordCrawl(freshProgress(), { kind: 'daily', orchardId: orchard.id, dailyKey: key, summary: s });
  assert.equal(first.firstDaily, true);
  assert.deepEqual(first.progress.dailies[key], { home: true, score: 50, apples: orchard.harvest, stars: 1 });
  assert.deepEqual(clearedOrchards(first.progress), []);
  const second = recordCrawl(first.progress, { kind: 'daily', orchardId: orchard.id, dailyKey: key, summary: { ...s, score: 500 } });
  assert.equal(second.firstDaily, false);
  assert.equal(second.progress.dailies[key].score, 50);
});

test('clearing Midnight with every star ends the season', () => {
  let progress = freshProgress();
  let last;
  for (const orchard of ORCHARDS) {
    const s = summary({ home: true, score: orchard.points, harvested: orchard.harvest, bestBite: 20, chains: 1, frogs: 1, length: 30, birdVisits: 1, rottenEaten: 2, rivalCrashes: 1, gardenerSeenOff: 1 });
    last = recordCrawl(progress, { kind: 'orchard', orchardId: orchard.id, summary: s });
    progress = last.progress;
  }
  assert.equal(last.completed, true);
  assert.equal(starCount(progress), STARS_IN_ALL);
  for (const id of ['season-end', 'all-stars', 'night-shift']) assert.ok(last.packages.includes(id), id);
});

test('every package the game can earn is in the manifest', () => {
  const declared = manifest.packages.map((p) => p.id);
  assert.equal(declared.length, 12);
  const everything = { ...freshProgress(), frogs: 3, dailyCrawls: 7, longest: 120, pages: PAGES.map((p) => p.id), stars: Object.fromEntries(ORCHARDS.map((o) => [o.id, ['home', 'points', 'feat']])) };
  const earned = packagesEarned(everything, summary({ home: true, score: 200, bestBite: 25, rivalCrashes: 1, gardenerSeenOff: 1 }), true);
  assert.deepEqual([...earned].sort(), [...declared].sort());
});
