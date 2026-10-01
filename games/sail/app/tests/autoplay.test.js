// AI-vs-AI autoplay stress test: every one of the 32 original scenarios,
// several seeds each, run to completion with the computer captaining every
// ship. Proves termination, checks state invariants after every turn, and
// checks that battles are reproducible from (scenario, seed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCENARIOS, PLAYABLE, createGame, resolveTurn, autopilot, cloneState,
} from '../src/engine/index.js';
import { suggestHelm } from '../src/engine/hints.js';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

function invariants(st) {
  for (const sp of st.ships) {
    const s = sp.specs;
    const where = `${st.name} t${st.turn} ${sp.name}`;
    assert.ok(s.hull >= 0 && s.hull <= sp.max.hull, `${where}: hull ${s.hull}`);
    for (const k of ['crew1', 'crew2', 'crew3', 'gunL', 'gunR', 'carL', 'carR']) {
      assert.ok(s[k] >= 0 && s[k] <= sp.max[k], `${where}: ${k} ${s[k]}`);
    }
    for (const k of ['rig1', 'rig2', 'rig3']) assert.ok(s[k] >= 0 && s[k] <= sp.max[k], `${where}: ${k}`);
    assert.ok(sp.max.rig4 === -1 ? s.rig4 === -1 : s.rig4 >= 0 && s.rig4 <= sp.max.rig4, `${where}: rig4 ${s.rig4}`);
    assert.equal(sp.nfoul, sp.foul.reduce((a, f) => a + f.count, 0), `${where}: foul count`);
    assert.equal(sp.ngrap, sp.grap.reduce((a, g) => a + g.count, 0), `${where}: grapple count`);
    for (const o of st.ships) {
      assert.equal(sp.foul[o.index].count, o.foul[sp.index].count, `${where}: fouls are mutual`);
    }
    assert.ok(sp.dir >= 0 && sp.dir <= 8);
    assert.ok([0, 1, 2].includes(sp.FS));
    if (sp.captured >= 0) assert.ok(st.ships[sp.captured], `${where}: captor exists`);
  }
  assert.ok(st.windspeed >= 0 && st.windspeed <= 7);
  assert.ok(st.winddir >= 1 && st.winddir <= 8);
}

function play(scenarioId, seed) {
  let st = autopilot(createGame({ scenarioId, seed }));
  const log = [];
  while (!st.over) {
    const r = resolveTurn(st, {});
    st = r.state;
    invariants(st);
    log.push(r.events.length);
    assert.ok(st.turn <= st.maxTurns, 'turn limit respected');
  }
  return { st, log };
}

test('every scenario terminates under AI-vs-AI play, invariants hold', () => {
  const tally = {};
  for (const sc of SCENARIOS) {
    for (const seed of SEEDS) {
      const { st } = play(sc.id, seed);
      assert.ok(st.over && st.result, `${sc.name} seed ${seed} ended`);
      tally[st.result.reason] = (tally[st.result.reason] || 0) + 1;
    }
  }
  const total = SCENARIOS.length * SEEDS.length;
  // Most battles are decided by gunfire, boarding or weather, not by the clock.
  const byClock = tally.nightfall || 0;
  assert.ok(byClock / total < 0.15, `nightfall ended ${byClock}/${total} (${JSON.stringify(tally)})`);
});

test('every playable scenario is decided before nightfall in most seeds', () => {
  for (const f of PLAYABLE) {
    let decided = 0;
    for (const seed of SEEDS) if (play(f.id, seed).st.result.reason !== 'nightfall') decided++;
    assert.ok(decided >= SEEDS.length - 1, `${f.id}: ${decided}/${SEEDS.length}`);
  }
});

test('battles are reproducible from (scenario, seed, orders)', () => {
  const a = play(18, 11);
  const b = play(18, 11);
  assert.deepEqual(a.st, b.st);
  assert.deepEqual(a.log, b.log);
  const c = play(18, 12);
  assert.notDeepEqual(a.st.ships.map((s) => [s.row, s.col]), c.st.ships.map((s) => [s.row, s.col]));
});

test('state survives a JSON round trip mid-battle and continues identically', () => {
  let st = autopilot(createGame({ scenarioId: 13, seed: 4 }));
  for (let i = 0; i < 3; i++) st = resolveTurn(st, {}).state;
  const saved = JSON.parse(JSON.stringify(st));
  const x = resolveTurn(st, {});
  const y = resolveTurn(saved, {});
  assert.deepEqual(x.state, y.state);
});

test('resolveTurn never mutates its input', () => {
  const st = createGame({ scenarioId: 21, playerShip: 0, seed: 2 });
  const copy = cloneState(st);
  resolveTurn(st, { 0: { move: '1', fire: { L: 'hull', R: 'hull' } } });
  assert.deepEqual(st, copy);
});

test('a hurricane destroys all ships and ends the battle', () => {
  let found = null;
  for (let seed = 1; seed < 400 && !found; seed++) {
    const st = createGame({ scenarioId: 17, playerShip: 0, seed });
    Object.assign(st, { turn: 6, windspeed: 6, windchange: 1 });
    st.ships.forEach((sp, i) => Object.assign(sp, { row: 10 + i * 30, col: 10, dir: 1 }));
    const r = resolveTurn(st, { 0: {} });
    if (r.state.over && r.state.result.reason === 'hurricane') found = r;
  }
  assert.ok(found, 'the gale rises to a hurricane for some seed');
  assert.equal(found.state.windspeed, 7);
  assert.ok(found.events.some((e) => e.t === 'wind' && e.speed === 7));
  // the storm turn itself is still played (ships move, then the end)
  assert.ok(found.events.some((e) => e.t === 'move'));
  assert.equal(found.events[found.events.length - 1].t, 'end');
});

// A human who fires both broadsides every turn, reloads at once and takes
// the sailing master's advice (the driver's own move search).
function captain(scenarioId, playerShip, seed) {
  let st = createGame({ scenarioId, playerShip, seed });
  while (!st.over) {
    const hint = suggestHelm(st, playerShip);
    const orders = {
      fire: { L: 'hull', R: 'hull' },
      load: { L: 'round', R: 'round' },
      move: hint ? hint.helm : 'd',
    };
    st = resolveTurn(st, { [playerShip]: orders }).state;
  }
  return st.result;
}

test('a human captain can win the featured duels (winnability)', () => {
  // Shannon (crack crew), Constitution, and a British 74 at Algeciras. The
  // historically doomed sides (Chesapeake, Guerriere) rarely win, by design.
  for (const [id, ship] of [[13, 1], [10, 0], [18, 0]]) {
    let wins = 0;
    for (const seed of SEEDS) if (captain(id, ship, seed).win) wins++;
    assert.ok(wins >= 1, `scenario ${id} ship ${ship}: ${wins}/${SEEDS.length} wins`);
  }
});

test('the naive "sail straight and blaze away" captain usually loses', () => {
  let wins = 0;
  for (const seed of SEEDS) {
    let st = createGame({ scenarioId: 13, playerShip: 1, seed });
    while (!st.over) {
      st = resolveTurn(st, { 1: { fire: { L: 'hull', R: 'hull' }, load: { L: 'round', R: 'round' }, move: '1' } }).state;
    }
    if (st.result.win) wins++;
  }
  assert.ok(wins <= SEEDS.length / 2, `computer captains are not pushovers (${wins} naive wins)`);
});
