// Control Room 1986 — the career, the briefing, the Daily, the report and the service record.
// Run: node --test tests/career.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGame, executeCommand, spawnPlane, tick } from '../src/engine.js';
import { hintForPlane } from '../src/hints.js';
import { parseCommand, PARSE } from '../src/parser.js';
import { PLAYFIELDS } from '../src/playfields.js';
import {
  ASSIGNMENTS, isEndorsed, isUnlocked, newCareer, nextAssignmentIndex, nextRankNeed, RANKS,
  rankIndex, stampTotal, withShift,
} from '../src/career.js';
import {
  createTracker, describeTask, generateTasks, taskProgress, taskState, tasksDone, trackCommand,
  trackFullShift, trackRefusal, trackTick,
} from '../src/briefing.js';
import { dailyNumber, dailySector, dailySeed, dailyShareLine, seededRandom } from '../src/daily.js';
import { leader, ordersPerMinute, REPORT_WIDTH, reportLines } from '../src/report.js';
import { newService, withPage, withShift as withServiceShift } from '../src/service.js';

// —— the career ——

test('twelve assignments on the three sectors, each with two tasks besides its target', () => {
  assert.equal(ASSIGNMENTS.length, 12);
  assert.equal(new Set(ASSIGNMENTS.map((a) => a.id)).size, 12);
  for (const a of ASSIGNMENTS) {
    assert.ok(PLAYFIELDS[a.sector], `${a.id}: known sector`);
    assert.equal(a.tasks.length, 2, `${a.id}: two tasks`);
    for (const task of a.tasks) {
      if (task.kind === 'landAt') assert.ok(PLAYFIELDS[a.sector].airports[task.airport], `${a.id}: the airport exists`);
    }
  }
});

test('assignments open one after another, and the next offered is the first not passed', () => {
  let career = newCareer();
  assert.equal(isUnlocked(career, 0), true);
  assert.equal(isUnlocked(career, 1), false);
  assert.equal(nextAssignmentIndex(career), 0);
  career = withShift(career, ASSIGNMENTS[0].id, true, 2);
  assert.equal(isUnlocked(career, 1), true);
  assert.equal(nextAssignmentIndex(career), 1);
});

test('a failed shift changes nothing; a pass keeps the better stamp count', () => {
  let career = withShift(newCareer(), 'first-watch', false, 3);
  assert.deepEqual(career.passed, {});
  career = withShift(career, 'first-watch', true, 3);
  career = withShift(career, 'first-watch', true, 1);
  assert.equal(career.passed['first-watch'], 3);
});

test('ranks follow assignments passed, and the chief needs thirty stamps as well', () => {
  const passAll = (stamps) =>
    ASSIGNMENTS.reduce((c, a) => withShift(c, a.id, true, stamps), newCareer());
  assert.equal(RANKS[rankIndex(newCareer())].id, 'trainee');
  const three = ASSIGNMENTS.slice(0, 3).reduce((c, a) => withShift(c, a.id, true, 1), newCareer());
  assert.equal(RANKS[rankIndex(three)].id, 'assistant');
  assert.equal(RANKS[rankIndex(passAll(2))].id, 'supervisor');
  assert.equal(stampTotal(passAll(2)), 24);
  assert.match(nextRankNeed(passAll(2)).text, /^6 more stamps$/);
  assert.equal(RANKS[rankIndex(passAll(3))].id, 'chief');
  assert.equal(nextRankNeed(passAll(3)), null);
});

test('a sector is endorsed when all its assignments are passed', () => {
  const easy = ASSIGNMENTS.filter((a) => a.sector === 'easy');
  const career = easy.reduce((c, a) => withShift(c, a.id, true, 1), newCareer());
  assert.equal(isEndorsed(career, 'easy'), true);
  assert.equal(isEndorsed(career, 'killer'), false);
});

/** The cheat panel's suggestions for every plane, as the in-Hall suite types them. */
function autoplayUntil(sector, seed, target, maxTicks = 600) {
  const pf = PLAYFIELDS[sector];
  const game = createGame(pf, { seed });
  spawnPlane(game);
  for (let step = 0; step < maxTicks && !game.lost && game.safePlanes < target; step++) {
    for (const plane of [...game.ground, ...game.air]) {
      const onGround = game.ground.includes(plane);
      const hint = hintForPlane(plane, pf, onGround, onGround ? [] : game.air.filter((o) => o !== plane));
      if (!hint?.command) continue;
      const parsed = parseCommand(hint.command);
      if (parsed.status === PARSE.OK) executeCommand(game, parsed.cmd);
    }
    tick(game);
  }
  return game.safePlanes >= target;
}

test('every target is reachable: the cheat autoplayer gets there on some seeds', () => {
  // The autoplayer has no judgment (it serves every plane at once), so a thinking controller does
  // better; at 400 seeds it reaches the first target on about two in three and the hardest on a
  // few. Here 400 seeds must reach each one at least once.
  for (const a of ASSIGNMENTS) {
    let reached = false;
    for (let seed = 5000; seed < 5400 && !reached; seed++) reached = autoplayUntil(a.sector, seed, a.target);
    assert.ok(reached, `${a.id}: ${a.target} home on ${a.sector}`);
  }
});

// —— the briefing ——

test('the tracker counts arrivals from the engine’s events and forgets reused letters', () => {
  const tracker = createTracker([
    { kind: 'land', count: 2 },
    { kind: 'landAt', airport: 1, count: 1 },
    { kind: 'exitVia', exit: 3 },
    { kind: 'beacon' },
    { kind: 'hold' },
  ]);
  trackCommand(tracker, { action: 'towardsBeacon' }, { letter: 'A' });
  trackCommand(tracker, { action: 'circle' }, { letter: 'b' });
  // b leaves the radar some other way and a new plane takes its letter: no hold to count.
  trackTick(tracker, [{ type: 'spawn', plane: 'b' }], []);
  trackTick(tracker, [{ type: 'land', plane: 'A', airport: 1 }, { type: 'exit', plane: 'b', exit: 3 }], []);
  const [land, landAt, exitVia, beacon, hold] = tracker.tasks;
  assert.equal(taskState(tracker, land), 'open');
  assert.equal(taskProgress(tracker, land), '1/2');
  assert.equal(taskState(tracker, landAt), 'done');
  assert.equal(taskState(tracker, exitVia), 'done');
  assert.equal(taskState(tracker, beacon), 'done');
  assert.equal(taskState(tracker, hold), 'open');
});

test('keeping tasks hold until broken and count only unbroken at the end', () => {
  const tracker = createTracker([{ kind: 'cleanRadio' }, { kind: 'steadyFuel' }, { kind: 'fullShift' }]);
  assert.deepEqual(tasksDone(tracker), [true, true, false]);
  trackRefusal(tracker);
  trackTick(tracker, [], [{ fuel: 6 }]);
  trackFullShift(tracker);
  assert.equal(taskState(tracker, tracker.tasks[0]), 'broken');
  assert.deepEqual(tasksDone(tracker), [false, false, true]);
});

test('an open shift draws three different kinds of task, and a seed always draws the same', () => {
  for (const key of Object.keys(PLAYFIELDS)) {
    for (let seed = 1; seed <= 40; seed++) {
      const tasks = generateTasks(PLAYFIELDS[key], seededRandom(seed));
      assert.equal(tasks.length, 3);
      const families = tasks.map((t) => (t.kind === 'landAt' ? 'land' : t.kind === 'exitVia' ? 'exit' : t.kind));
      assert.equal(new Set(families).size, 3);
      for (const t of tasks) assert.doesNotMatch(describeTask(t, PLAYFIELDS[key]), /undefined|Unknown/);
      assert.deepEqual(generateTasks(PLAYFIELDS[key], seededRandom(seed)), tasks);
    }
  }
});

// —— the Daily ——

test('daily numbers match the Hall’s: #1 on 2026-09-01, #32 on 2026-10-02', () => {
  assert.equal(dailyNumber('2026-09-01'), 1);
  assert.equal(dailyNumber('2026-10-02'), 32);
  assert.equal(dailyNumber('2027-01-01'), 123);
});

test('the day decides the sector and the seed, the same for everyone', () => {
  assert.equal(dailySector('2026-10-04'), 'killer'); // a Sunday
  assert.equal(dailySector('2026-09-28'), 'easy'); // a Monday
  assert.equal(dailySeed('2026-10-02'), dailySeed('2026-10-02'));
  assert.notEqual(dailySeed('2026-10-02'), dailySeed('2026-10-03'));
});

test('the share line is one line with stamps and no link', () => {
  const line = dailyShareLine({ number: 32, sectorName: 'Default', safe: 7, tasksDone: [true, true, false] });
  assert.equal(line, 'Control Room 1986 #32 · Default · 7 home · 🟩🟩⬜');
  assert.doesNotMatch(line, /https?:|\n/);
});

// —— the report and the record ——

const summary = (overrides = {}) => ({
  mode: 'career',
  dateKey: '2026-10-02',
  sectorName: 'Default',
  assignment: { number: 4, total: 12, title: 'The reference sector', target: 3 },
  daily: null,
  safe: 3,
  landings: 2,
  exits: 1,
  takeoffs: 1,
  orders: 18,
  refused: 1,
  seconds: 240,
  ended: 'relieved',
  lostPlane: null,
  lostReason: null,
  tasks: [
    { text: 'Bring 3 planes home', done: true },
    { text: 'Land a plane at airport 0', done: true },
    { text: 'Turn a plane toward a beacon, then bring it home', done: false },
  ],
  rank: { title: 'Assistant Controller', promoted: true, next: 'Controller, 2 more assignments' },
  ...overrides,
});

test('the report fits the paper and says how the shift ended', () => {
  const lines = reportLines(summary());
  for (const l of lines) assert.ok(l.text.length <= REPORT_WIDTH, `fits: ${l.text}`);
  const text = lines.map((l) => l.text).join('\n');
  assert.match(text, /ASSIGNMENT 4\/12 · THE REFERENCE SECTOR/);
  assert.match(text, /PLANES HOME \.+ 3 · TARGET 3/);
  assert.match(text, /ORDERS A MINUTE \.+ 4\.5/);
  assert.match(text, /COMMENDATION STAMPS \.+ 2 OF 3/);
  assert.match(text, /RELIEVED ON SCHEDULE/);
  assert.match(text, /ASSISTANT CONTROLLER · PROMOTED/);
  const lost = reportLines(summary({ ended: 'lost', lostPlane: 'k', lostReason: 'ran out of fuel on a very long approach' }));
  for (const l of lost) assert.ok(l.text.length <= REPORT_WIDTH, `fits: ${l.text}`);
  assert.match(lost.map((l) => l.text).join(' '), /SHIFT ENDED · K: RAN OUT OF FUEL/);
});

test('leaders and rates read as the paper prints them', () => {
  assert.equal(leader('ORDERS GIVEN', 18).length, REPORT_WIDTH);
  assert.equal(ordersPerMinute(10, 10), '0.0');
  assert.equal(ordersPerMinute(30, 300), '6.0');
});

test('the service record adds shifts up, keeps bests and the first Daily of each day', () => {
  let service = withServiceShift(newService(), summary({ mode: 'open', assignment: null, safe: 6 }), 'default');
  service = withServiceShift(service, summary({ mode: 'open', assignment: null, safe: 4 }), 'default');
  assert.equal(service.shifts, 2);
  assert.equal(service.planesHome, 10);
  assert.equal(service.bestOpen.default, 6);
  const daily = summary({ mode: 'daily', assignment: null, daily: { number: 32 }, safe: 5 });
  service = withServiceShift(service, daily, 'default');
  service = withServiceShift(service, { ...daily, safe: 9 }, 'default');
  assert.equal(service.dailies['2026-10-02'].safe, 5);
  const idle = withServiceShift(newService(), summary({ ended: 'quit', orders: 0, safe: 0 }), 'easy');
  assert.equal(idle.shifts, 0);
});

test('the logbook keeps the newest twenty', () => {
  let pages = [];
  for (let i = 0; i < 25; i++) pages = withPage(pages, i);
  assert.equal(pages.length, 20);
  assert.equal(pages[0], 24);
});
