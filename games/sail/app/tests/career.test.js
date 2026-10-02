// The game menu's career (src/career/): the first lieutenant's counsel, the Sea Service, the
// Daily Engagement, commendations and saved progress.
//
// The promise these tests keep: every action of the Sea Service and every day's engagement is won
// by giving the counsel's orders each turn, so the hidden counsel panel (Ctrl+Alt+C) proves a
// battle winnable; and the counsel never gives an order the engine refuses.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createGame, resolveTurn, SCENARIOS, PLAYABLE } from '../src/engine/index.js';
import { counsel } from '../src/career/counsel.js';
import { autoplay } from '../src/career/autopilot.js';
import { createLog, noteTurn } from '../src/career/logbook.js';
import { judgeCommendation, commendationStatus, describeCommendation } from '../src/career/commendations.js';
import { ACTIONS, SERVICE_STARS, actionAfter } from '../src/career/service.js';
import {
  dailyNumber, engagementCommendations, engagementFor, engagementRating, engagementShareLine, localDateKey,
  weekdayOf, ENGAGEMENTS,
} from '../src/career/daily.js';
import { RANKS, rankFor, nextRank, serviceStars } from '../src/career/ranks.js';
import { planAction, planDaily, planFree } from '../src/career/plans.js';
import { settleBattle } from '../src/career/progress.js';
import { loadRecord, loadService, loadEngagements } from '../src/career/store.js';
import { reportButtons, stripHtml, counselHtml } from '../src/career/report.js';

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

test('the Sea Service has ten numbered actions, each with the win first and a staged scenario', () => {
  assert.equal(ACTIONS.length, 10);
  assert.equal(SERVICE_STARS, 30);
  const staged = new Set(PLAYABLE.map((f) => f.id));
  ACTIONS.forEach((a, i) => {
    assert.equal(a.number, i + 1);
    assert.ok(staged.has(a.scenarioId), `${a.id}: scenario ${a.scenarioId} is not staged`);
    assert.ok(SCENARIOS[a.scenarioId].ships[a.ship], `${a.id}: no ship ${a.ship}`);
    assert.equal(a.commendations.length, 3);
    assert.equal(a.commendations[0].kind, 'win');
    for (const c of a.commendations) assert.notEqual(describeCommendation(c), '');
  });
  assert.equal(new Set(ACTIONS.map((a) => a.id)).size, ACTIONS.length);
  assert.equal(actionAfter(ACTIONS[9]), null);
});

test('every action of the Sea Service is won by following the counsel', () => {
  let stars = 0;
  for (const a of ACTIONS) {
    const { st, log } = autoplay({ scenarioId: a.scenarioId, playerShip: a.ship, seed: a.seed });
    assert.equal(st.result.reason, 'victory', `action ${a.number} (${a.title}) is not won by the counsel`);
    stars += a.commendations.filter((c) => judgeCommendation(c, st, a.ship, log)).length;
  }
  assert.ok(stars >= 22, `the counsel earns only ${stars} stars`);
});

test('the counsel never gives an order the engine refuses', () => {
  for (const a of ACTIONS.slice(0, 5)) {
    let st = createGame({ scenarioId: a.scenarioId, playerShip: a.ship, seed: a.seed });
    while (!st.over) {
      const advice = counsel(st, a.ship);
      const res = resolveTurn(st, { [a.ship]: advice ? advice.orders : {} });
      const refused = res.events.filter((e) => e.t === 'msg' && e.ship === a.ship && /unable to fire|No hands free|Out of crew/.test(e.text));
      assert.deepEqual(refused.map((e) => e.text), [], `${a.title} turn ${st.turn + 1}`);
      st = res.state;
    }
  }
});

test('the counsel explains every order and spells it as a command line', () => {
  const st = createGame({ scenarioId: 13, playerShip: 1, seed: 53 });
  const advice = counsel(st, 1);
  assert.ok(advice.notes.length >= 1);
  assert.equal(advice.notes.length, advice.commands.length);
  assert.match(counselHtml(advice), /First lieutenant/);
  st.over = true;
  assert.equal(counsel(st, 1), null);
});

test('a month of daily engagements is winnable from the counsel', () => {
  for (let day = 0; day < 31; day++) {
    const key = localDateKey(new Date(2026, 9, 1 + day));
    const e = engagementFor(key);
    assert.ok(ENGAGEMENTS.some((x) => x.scenarioId === e.scenarioId && x.ship === e.ship));
    const { st } = autoplay({ scenarioId: e.scenarioId, playerShip: e.ship, seed: e.seed });
    assert.equal(st.result.reason, 'victory', `engagement of ${key} is not won`);
  }
});

test('daily numbering matches the collection and the weekday sets the standing order', () => {
  assert.equal(dailyNumber('2026-09-01'), 1);
  assert.equal(dailyNumber('2026-10-02'), 32);
  assert.equal(weekdayOf('2026-09-28'), 0); // a Monday
  const orders = new Set();
  for (let day = 28; day < 35; day++) orders.add(JSON.stringify(engagementCommendations(localDateKey(new Date(2026, 8, day)))[1]));
  assert.equal(orders.size, 7);
  assert.deepEqual(engagementFor('2026-10-02'), engagementFor('2026-10-02'));
});

test('commendations count only on a won battle, and the strip shows how each stands', () => {
  const st = createGame({ scenarioId: 7, playerShip: 0, seed: 68 });
  const log = createLog(st, 0);
  const masts = { kind: 'masts' };
  assert.equal(judgeCommendation(masts, st, 0, log), false);
  assert.equal(commendationStatus(masts, st, 0, log), 'open');
  log.mastLost = true;
  assert.equal(commendationStatus(masts, st, 0, log), 'lost');
  log.rakes = 1;
  assert.equal(commendationStatus({ kind: 'rakes', atLeast: 1 }, st, 0, log), 'met');
  const plan = planAction(ACTIONS[0]);
  assert.match(stripHtml(plan, st, 0, log), /1\. First Command/);
});

test('the logbook counts broadsides, rakes and prizes from the events', () => {
  const st = createGame({ scenarioId: 13, playerShip: 1, seed: 1 });
  const log = createLog(st, 1);
  noteTurn(log, [
    { t: 'fire', from: 1, rake: true, sternrake: true },
    { t: 'fire', from: 0 },
    { t: 'strike', ship: 0, by: 1 },
  ], st, 1, { repair: 'hull' });
  assert.equal(log.broadsides, 1);
  assert.equal(log.rakes, 1);
  assert.equal(log.sternRakes, 1);
  assert.equal(log.struckToGuns, 1);
  assert.equal(log.repairs, 1);
});

test('ranks climb with the stars and are never taken away', () => {
  assert.equal(rankFor(0).title, 'Midshipman');
  assert.equal(rankFor(30).title, 'Admiral');
  assert.equal(nextRank(30), null);
  for (let i = 1; i < RANKS.length; i++) assert.ok(RANKS[i].stars > RANKS[i - 1].stars);
  assert.equal(serviceStars({ actions: { a: { stars: [true, false, true] } } }), 2);
});

test('winning an action saves its stars, opens the next and fills the record', () => {
  const a = ACTIONS[0];
  const plan = planAction(a);
  const { st, log } = autoplay({ scenarioId: a.scenarioId, playerShip: a.ship, seed: a.seed });
  const summary = settleBattle(plan, st, a.ship, log);
  assert.deepEqual(summary.opened, ACTIONS[1]);
  assert.equal(loadService().actions[a.id].won, true);
  assert.equal(loadRecord().victories, 1);
  const again = settleBattle(plan, st, a.ship, log);
  assert.equal(again.opened, null);
  assert.deepEqual(again.newlyEarned, [false, false, false]);
  assert.equal(loadRecord().battles, 2);
  assert.deepEqual(reportButtons(plan, st, summary, true).map((b) => b.key), ['N', 'R', 'M', 'H', 'L']);
});

test('the first engagement of the day is the one on record', () => {
  const plan = planDaily('2026-10-02');
  const { st, log } = autoplay({ scenarioId: plan.scenarioId, playerShip: plan.ship, seed: plan.seed });
  const first = settleBattle(plan, st, plan.ship, log);
  assert.equal(first.firstToday, true);
  assert.ok(first.rating > 1000);
  assert.equal(settleBattle(plan, st, plan.ship, log).firstToday, false);
  assert.equal(loadEngagements().days['2026-10-02'].number, 32);
  assert.deepEqual(reportButtons(plan, st, first, false).map((b) => b.key), ['S', 'R', 'M', 'L']);
  const line = engagementShareLine({ number: 32, earned: first.earned, rating: first.rating, won: true });
  assert.match(line, /^Broadside · Daily Engagement #32 · [★☆]{3} · [\d,]+$/);
  assert.doesNotMatch(line, /https?:/);
  assert.equal(engagementRating({ result: { reason: 'struck' } }, plan.ship, { struckToGuns: 1, boardedPrizes: 0 }, []), 200);
});

test('progress lives under the collection prefix, so the Hall can forget it', () => {
  const plan = planFree(13, 1, 4);
  const { st, log } = autoplay({ scenarioId: 13, playerShip: 1, seed: 4 });
  settleBattle(plan, st, 1, log);
  const keys = globalThis.localStorage.keys();
  assert.ok(keys.length > 0);
  for (const key of keys) assert.ok(key.startsWith('usr-games:sail:'), key);
});
