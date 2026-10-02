// Deep Space Command (src/career/) — the tour, the daily patrol, commendations and saved progress.
//
// The promise these tests keep: every sortie and every day's patrol can be won by typing the
// bridge computer's first suggestion each turn, and a mission flown with the Captain's Override
// never touches the saved progress.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createGame, setOverride } from '../src/engine.js';
import { DIFFICULTY } from '../src/galaxy.js';
import { autoplay } from '../src/career/autopilot.js';
import { SORTIES, TOUR_STARS, PATROL_PRESET, sortiePreset } from '../src/career/missions.js';
import { createLog, commendationStatus, describeCommendation, judgeCommendation } from '../src/career/orders.js';
import {
  dailyNumber, localDateKey, patrolCommendations, patrolRating, patrolSeed, patrolShareLine, weekdayOf,
} from '../src/career/daily.js';
import { RANKS, nextRank, rankFor, tourStars } from '../src/career/ranks.js';
import { planFreeMission, planPatrol, planSortie, sortieAfter } from '../src/career/plans.js';
import { settleMission } from '../src/career/progress.js';
import { loadPatrols, loadRecord, loadTour } from '../src/career/store.js';
import { ordersStripHtml, reportButtons, reportHtml } from '../src/career/report.js';

/** A Map-backed stand-in for the browser's storage. */
function memoryStorage() {
  const items = new Map();
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
    keys: () => [...items.keys()],
  };
}

beforeEach(() => {
  globalThis.localStorage = memoryStorage();
});

test('every sortie registers its preset with the galaxy generator', () => {
  for (const sortie of SORTIES) {
    const preset = DIFFICULTY[sortiePreset(sortie)];
    assert.ok(preset, `no preset for ${sortie.id}`);
    assert.equal(preset.klingons, sortie.setup.klingons);
    assert.equal(createGame({ difficulty: sortiePreset(sortie), seed: sortie.seed }).galaxy.totalKlingons, sortie.setup.klingons);
  }
  assert.ok(DIFFICULTY[PATROL_PRESET]);
});

test('the tour has ten numbered sorties with three commendations each, the win first', () => {
  assert.equal(SORTIES.length, 10);
  assert.equal(TOUR_STARS, 30);
  SORTIES.forEach((sortie, i) => {
    assert.equal(sortie.number, i + 1);
    assert.equal(sortie.commendations.length, 3);
    assert.equal(sortie.commendations[0].kind, 'win');
    for (const c of sortie.commendations) assert.notEqual(describeCommendation(c), '');
  });
  assert.equal(new Set(SORTIES.map((s) => s.id)).size, SORTIES.length);
});

test('every sortie is won by following the bridge computer alone', () => {
  for (const sortie of SORTIES) {
    const { game, escapes } = autoplay({ difficulty: sortiePreset(sortie), seed: sortie.seed });
    assert.ok(game.won, `sortie ${sortie.number} (${sortie.name}) is not won by the advice`);
    assert.equal(escapes, 0, `sortie ${sortie.number} needed the autopilot's escape cycle`);
  }
});

test('the tour gets harder: more ships for the later sorties', () => {
  const ships = SORTIES.map((s) => s.setup.klingons);
  assert.ok(ships[9] > ships[0]);
  assert.equal(Math.max(...ships), ships[9]);
});

test('a month of daily patrols is winnable from the advice alone', () => {
  for (let day = 0; day < 31; day++) {
    const key = localDateKey(new Date(2026, 9, 1 + day));
    const { game, escapes } = autoplay({ difficulty: PATROL_PRESET, seed: patrolSeed(key) });
    assert.ok(game.won && escapes === 0, `patrol of ${key} is not winnable`);
  }
});

test('daily numbering matches the collection: #1 on 2026-09-01', () => {
  assert.equal(dailyNumber('2026-09-01'), 1);
  assert.equal(dailyNumber('2026-10-02'), 32);
  assert.equal(dailyNumber('2027-09-01'), 366);
  assert.equal(localDateKey(new Date(2026, 9, 2, 23, 30)), '2026-10-02');
});

test('weekdays start on Monday and each brings its own standing order', () => {
  assert.equal(weekdayOf('2026-09-28'), 0); // a Monday
  assert.equal(weekdayOf('2026-10-04'), 6); // a Sunday
  const orders = new Set();
  for (let day = 28; day < 35; day++) {
    const key = localDateKey(new Date(2026, 8, day));
    const commendations = patrolCommendations(key);
    assert.equal(commendations[0].kind, 'win');
    orders.add(JSON.stringify(commendations[1]));
  }
  assert.equal(orders.size, 7);
});

test('the same date gives everyone the same patrol', () => {
  const a = createGame({ difficulty: PATROL_PRESET, seed: patrolSeed('2026-10-02') });
  const b = createGame({ difficulty: PATROL_PRESET, seed: patrolSeed('2026-10-02') });
  assert.deepEqual(a.ship, b.ship);
  assert.notEqual(patrolSeed('2026-10-02'), patrolSeed('2026-10-03'));
});

test('commendations count only on a won mission', () => {
  const game = createGame({ difficulty: 'novice', seed: 3 });
  const log = createLog(game);
  assert.equal(judgeCommendation({ kind: 'noDock' }, game, log), false);
  assert.equal(commendationStatus({ kind: 'noDock' }, game, log), 'open');
  log.docks = 1;
  assert.equal(commendationStatus({ kind: 'noDock' }, game, log), 'lost');
  game.won = true;
  log.docks = 0;
  assert.equal(judgeCommendation({ kind: 'noDock' }, game, log), true);
  assert.equal(judgeCommendation({ kind: 'torpedoes', atMost: 0 }, game, log), true);
  log.torpedoesFired = 1;
  assert.equal(judgeCommendation({ kind: 'torpedoes', atMost: 0 }, game, log), false);
});

test('ranks climb with tour stars and never skip a title', () => {
  assert.equal(rankFor(0).title, 'Ensign');
  assert.equal(rankFor(TOUR_STARS).title, 'Admiral');
  assert.equal(nextRank(TOUR_STARS), null);
  for (let i = 1; i < RANKS.length; i++) assert.ok(RANKS[i].stars > RANKS[i - 1].stars);
  assert.equal(tourStars({ sorties: { a: { stars: [true, false, true] }, b: { stars: [true, true, true] } } }), 5);
});

test('winning a sortie saves its stars, opens the next one and fills the record', () => {
  const sortie = SORTIES[0];
  const mission = planSortie(sortie);
  const { game, log } = autoplay({ difficulty: mission.difficulty, seed: mission.seed });
  const summary = settleMission(mission, game, log);
  assert.ok(summary.counted);
  assert.equal(summary.earned[0], true);
  assert.deepEqual(summary.unlocked, SORTIES[1]);
  const tour = loadTour();
  assert.equal(tour.sorties[sortie.id].won, true);
  assert.deepEqual(tour.sorties[sortie.id].stars, summary.earned);
  const record = loadRecord();
  assert.equal(record.missions, 1);
  assert.equal(record.victories, 1);
  assert.equal(record.shipsDestroyed, game.kills);

  // Flying it again keeps every star already earned and opens nothing new.
  const again = settleMission(mission, game, log);
  assert.equal(again.unlocked, null);
  assert.deepEqual(again.newlyEarned, [false, false, false]);
  assert.equal(loadRecord().missions, 2);
});

test('the first patrol of the day is the one on record', () => {
  const mission = planPatrol('2026-10-02');
  const { game, log } = autoplay({ difficulty: mission.difficulty, seed: mission.seed });
  const first = settleMission(mission, game, log);
  assert.equal(first.firstPatrolToday, true);
  assert.ok(first.rating > 1000);
  const second = settleMission(mission, game, log);
  assert.equal(second.firstPatrolToday, false);
  const day = loadPatrols().days['2026-10-02'];
  assert.equal(day.number, 32);
  assert.equal(day.rating, first.rating);
  assert.equal(loadRecord().patrolsFlown, 1);
});

test('a mission flown with the Captain\'s Override saves nothing', () => {
  const sortie = SORTIES[0];
  const mission = planSortie(sortie);
  const game = createGame({ difficulty: mission.difficulty, seed: mission.seed });
  const log = createLog(game);
  setOverride(game, 'oneShot', true);
  game.won = true;
  const summary = settleMission(mission, game, log);
  assert.equal(summary.counted, false);
  assert.equal(summary.unlocked, null);
  assert.deepEqual(loadTour(), { sorties: {} });
  assert.equal(loadRecord().missions, 0);
  assert.equal(globalThis.localStorage.keys().length, 0);
});

test('progress lives under the collection prefix, so the Hall can forget it', () => {
  const mission = planFreeMission('novice', 5);
  const { game, log } = autoplay({ difficulty: mission.difficulty, seed: mission.seed });
  settleMission(mission, game, log);
  const keys = globalThis.localStorage.keys();
  assert.ok(keys.length > 0);
  for (const key of keys) assert.ok(key.startsWith('usr-games:trek:'), key);
});

test('a free mission has no commendations and reports without stars', () => {
  const mission = planFreeMission('expert');
  assert.equal(mission.difficulty, 'expert');
  assert.deepEqual(mission.commendations, []);
  assert.equal(planFreeMission('nonsense').difficulty, 'standard');
});

test('the report offers the way on first, then the collection\'s results order', () => {
  const sortie = SORTIES[0];
  const mission = planSortie(sortie);
  const { game, log } = autoplay({ difficulty: mission.difficulty, seed: mission.seed });
  const summary = settleMission(mission, game, log);
  const buttons = reportButtons(mission, game, summary, true);
  assert.deepEqual(buttons.map((b) => b.key), ['N', 'R', 'M', 'H']);
  assert.equal(buttons[0].primary, true);
  assert.deepEqual(reportButtons(mission, game, summary, false).map((b) => b.key), ['N', 'R', 'M']);
  const html = reportHtml({ mission, game, log, summary, reason: 'cleared', abandoned: false, buttons });
  assert.match(html, /VICTORY/);
  assert.match(html, /Sortie 2 · Picket Duty is open/);
  assert.equal(sortieAfter(SORTIES[9]), null);
});

test('a daily report carries a share line without a link', () => {
  const mission = planPatrol('2026-10-02');
  const { game, log } = autoplay({ difficulty: mission.difficulty, seed: mission.seed });
  const summary = settleMission(mission, game, log);
  const line = patrolShareLine({ number: 32, earned: summary.earned, rating: summary.rating, won: true });
  assert.match(line, /^Trek — Deep Space · Daily Patrol #32 · [★☆]{3} · [\d,]+$/);
  assert.doesNotMatch(line, /https?:/);
  assert.deepEqual(reportButtons(mission, game, summary, true).map((b) => b.key), ['S', 'R', 'M', 'H']);
  assert.equal(patrolRating({ won: false, kills: 3 }, log, [false, false, false]), 120);
});

test('the orders strip shows each commendation with its state', () => {
  const mission = planSortie(SORTIES[2]);
  const game = createGame({ difficulty: mission.difficulty, seed: mission.seed });
  const log = createLog(game);
  const html = ordersStripHtml(mission, game, log);
  assert.match(html, /Sortie 3 · Torpedo School/);
  assert.equal((html.match(/<li class="open"/g) ?? []).length, 3);
  assert.match(html, /0\/3/);
});
