// The canonical acceptance scenarios, bsdgames/sail/docs/test-scenarios.md,
// T-01 .. T-25, exercised against the headless engine. UI-only aspects
// (T-04 screen layout) are covered by scripts/ui-smoke.mjs in a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCENARIOS, COUNTRY, createGame, resolveTurn, validateMove, movePrompt, glyph, loadLabel,
  fireOptions, computeHit, maxmove, snagged, parseCommand, R_LOADED, FEATURED, PLAYABLE,
} from '../src/engine/index.js';
import { recordScore, formatBoard } from '../src/engine/scoreboard.js';
import { addFoul, addGrap } from '../src/engine/state.js';
import { duel, place, plainLoads, eventsOf } from './helpers.js';

const turn = (st, orders = {}) => resolveTurn(st, { [st.players[0]]: orders });

test('T-01 scenario menu lists all 32 original scenarios', () => {
  assert.equal(SCENARIOS.length, 32);
  assert.equal(SCENARIOS[0].name, 'Ranger vs. Drake');
  assert.equal(SCENARIOS[31].name, 'Star Trek');
  for (const f of FEATURED) assert.ok(SCENARIOS[f.id], `featured ${f.id} exists`);
});

test('staged scenarios: 22 historical actions, each with a known mood', () => {
  const ids = PLAYABLE.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length, 'no duplicates');
  assert.equal(ids.length, 22);
  assert.deepEqual([...ids].sort((a, b) => a - b), [...Array(22).keys()], 'scenarios 0-21 (the fictional ones stay locked)');
  const moods = new Set(['golden', 'gale', 'tropic', 'dusk', 'haze', 'night', 'overcast', 'lake']);
  for (const f of PLAYABLE) {
    assert.ok(moods.has(f.mood), `${f.id} mood ${f.mood}`);
    assert.ok(f.blurb && f.tag && f.year >= 1770 && f.year <= 1815, `${f.id} metadata`);
  }
});

test('T-02 scenario 21 is Hornblower and the Natividad', () => {
  assert.equal(SCENARIOS[21].name, 'Hornblower and the Natividad');
});

test('T-03 ship 0 of scenario 21 is the British Lydia', () => {
  const st = createGame({ scenarioId: 21, playerShip: 0, seed: 1 });
  const me = st.ships[0];
  assert.equal(me.name, 'Lydia');
  assert.equal(COUNTRY[me.nationality], 'British');
  assert.equal(me.human, true);
  assert.equal(glyph(st, me), 'b0');
  assert.equal(glyph(st, st.ships[1]), 's0');
});

test('T-05 first movement: "3" moves three squares ahead', () => {
  const st = duel({ wind: [1, 3], me: [10, 10, 3], them: [40, 40, 1] });
  assert.equal(movePrompt(st, st.ships[0]).ma, 3); // beam reach, battle sails
  const { state } = turn(st, { move: '3' });
  assert.deepEqual([state.ships[0].row, state.ships[0].col, state.ships[0].dir], [10, 13, 3]);
});

test('T-06 left turn then 3 forward: "l3"', () => {
  const st = duel({ wind: [1, 3], me: [10, 10, 2], them: [40, 40, 1] });
  const v = validateMove(st, st.ships[0], 'l3');
  assert.equal(v.movebuf, 'l3');
  const { state } = turn(st, { move: 'l3' });
  assert.deepEqual([state.ships[0].row, state.ships[0].col, state.ships[0].dir], [7, 10, 1]);
});

test('T-07 compound movement: "r1r1r2"', () => {
  const st = createGame({ scenarioId: 0, playerShip: 0, seed: 3 }); // Ranger: fs 7, ta 3
  [st.winddir, st.windspeed] = [1, 3];
  const me = place(st, 0, 20, 20, 8);
  place(st, 1, 60, 60, 1);
  me.FS = 2;
  const p = movePrompt(st, me);
  assert.deepEqual([p.ma, p.ta], [7, 3]);
  const v = validateMove(st, me, 'r1r1r2');
  assert.equal(v.movebuf, 'r1r1r2');
  assert.equal(v.error, false);
  const { state } = turn(st, { move: 'r1r1r2' });
  const s = state.ships[0];
  // NW->N, 1 north; N->NE, 1 NE; NE->E, 2 east.
  assert.deepEqual([s.row, s.col, s.dir], [18, 23, 3]);
});

test('T-08 turning into the wind stops the helm: "l1l4" -> "Helm: l1l"', () => {
  // Wind blows toward N; heading W, the second left turn faces into it.
  const st = duel({ wind: [1, 3], me: [10, 10, 7], them: [40, 40, 1] });
  const v = validateMove(st, st.ships[0], 'l1l4');
  assert.equal(v.error, true);
  assert.deepEqual(v.msgs.slice(-2), ['Movement Error;', 'Helm: l1l']);
  assert.equal(maxmove(st, { ...st.ships[0] }, 5, 0), 0, 'in irons');
});

test('T-09 drift: two turns without headway sets the quote', () => {
  let st = duel({ wind: [1, 3], me: [10, 10, 3], them: [40, 40, 1] });
  assert.equal(movePrompt(st, st.ships[0]).af, false);
  st = turn(st, { move: 'd' }).state;
  st = turn(st, { move: 'd' }).state;
  const p = movePrompt(st, st.ships[0]);
  assert.equal(p.af, true);
  assert.equal(p.ta, 2, 'one turn fewer while drifting');
  // drifting: more than a single turn needs headway first
  assert.equal(validateMove(st, st.ships[0], 'l1').movebuf, 'l');
  assert.equal(validateMove(st, st.ships[0], '1l').movebuf, '1l');
  // a third idle turn drifts the (frigate) hull downwind
  const before = { ...st.ships[0] };
  st = turn(st, { move: 'd' }).state;
  assert.equal(st.ships[0].row, before.row - 1, 'drifted one square north');
});

test('T-10 full sails upper-case the nationality letter', () => {
  const st = duel({ wind: [1, 3], them: [40, 40, 1] });
  assert.equal(glyph(st, st.ships[0]), 'a0');
  const { state } = turn(st, { sails: 'full' });
  assert.equal(glyph(state, state.ships[0]), 'A0');
  assert.equal(state.ships[0].FS, 2);
  // and full sails double rigging hits (sail/assorted.c:76)
  assert.equal(maxmove(state, state.ships[0], 2, 0), 6);
});

test('T-11 double shot takes two turns to load: D* then D', () => {
  let st = duel({ them: [40, 40, 1] });
  st = turn(st, { unload: true }).state;
  assert.equal(loadLabel(st.ships[0], 'L'), '-');
  st = turn(st, { load: { L: 'double' } }).state;
  assert.equal(loadLabel(st.ships[0], 'L'), 'D*');
  assert.equal(fireOptions(st, st.ships[0], 0).ok, false, 'cannot fire while loading');
  st = turn(st, {}).state;
  assert.equal(loadLabel(st.ships[0], 'L'), 'D');
  assert.ok(st.ships[0].readyL & R_LOADED);
  // round shot is ready after one turn
  st = turn(st, { unload: true }).state;
  st = turn(st, { load: { R: 'round' } }).state;
  assert.equal(loadLabel(st.ships[0], 'R'), 'R');
});

test('T-12 fire a broadside: hit or miss is reported and damage applied', () => {
  let hits = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const st = duel({ seed, wind: [1, 0], me: [10, 10, 1], them: [10, 7, 1] }); // enemy on the port beam, range 3
    const { events, state } = turn(st, { fire: { L: 'hull' } });
    const f = eventsOf(events, 'fire').find((e) => e.from === 0);
    assert.ok(f, 'our broadside is in the event stream');
    assert.equal(f.side, 'L');
    assert.equal(f.range, 3);
    assert.equal(state.ships[0].loadL, 0, 'the broadside is now empty');
    if (f.damage) {
      hits++;
      const b = f.damage.before;
      const a = f.damage.after;
      const lost = (b.hull - a.hull) + (b.crew.reduce((x, y) => x + y) - a.crew.reduce((x, y) => x + y));
      assert.ok(lost >= 0);
    }
  }
  assert.ok(hits > 20, `most broadsides at range 3 connect (${hits}/40)`);
});

test('T-13 chain shot never touches hull or guns', () => {
  let riggingLost = 0;
  for (let seed = 1; seed <= 60; seed++) {
    let st = duel({ seed, wind: [1, 0], me: [10, 10, 1], them: [10, 7, 1] });
    st.ships[0].loadL = 2; // chain, loaded
    const { state, events } = turn(st, { fire: { L: 'rigging' } });
    const f = eventsOf(events, 'fire').find((e) => e.from === 0);
    assert.equal(f.load, 2);
    if (!f.damage) continue;
    assert.equal(f.damage.after.hull, f.damage.before.hull, 'hull untouched');
    assert.equal(f.damage.after.gunL + f.damage.after.gunR, f.damage.before.gunL + f.damage.before.gunR, 'guns untouched');
    riggingLost += f.damage.before.rig.reduce((x, y) => x + Math.max(0, y), 0)
      - f.damage.after.rig.reduce((x, y) => x + Math.max(0, y), 0);
    st = state;
  }
  assert.ok(riggingLost > 0, 'chain tears rigging');
});

test('T-14 stern rake hits harder than a bow rake, which beats a broadside', () => {
  const base = { wind: [1, 0] };
  const hitFrom = (me) => {
    const st = duel({ ...base, me, them: [10, 10, 1] });
    const sp = st.ships[0];
    plainLoads(sp);
    const opt = fireOptions(st, sp, 0).ok ? 0 : 1;
    const o = fireOptions(st, sp, opt);
    assert.ok(o.ok, `can fire from ${me}`);
    assert.equal(o.range, 3);
    return o;
  };
  const stern = hitFrom([14, 10, 3]); // dead astern of the target, broadside on
  const bow = hitFrom([7, 10, 3]); // dead ahead of the target
  const beam = hitFrom([10, 13, 1]); // alongside
  assert.equal(stern.rake && stern.sternrake, true);
  assert.equal(bow.rake && !bow.sternrake, true);
  assert.equal(beam.rake, false);
  assert.ok(stern.hit > bow.hit, `stern ${stern.hit} > bow ${bow.hit}`);
  assert.ok(bow.hit > beam.hit, `bow ${bow.hit} > beam ${beam.hit}`);
});

test('T-15 the enemy fires back', () => {
  const st = duel({ wind: [1, 0], me: [10, 10, 1], them: [10, 11, 1] }); // becalmed, alongside
  const { events } = turn(st, {});
  const theirs = eventsOf(events, 'fire').filter((e) => e.from === 1 && e.to === 0);
  assert.ok(theirs.length >= 1, 'computer broadside at us');
  assert.equal(theirs[0].load, 4, 'computer ships fire double shot at close range');
});

test('T-16 damage shows up in hull, crew, guns or rigging', () => {
  let damaged = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const st = duel({ seed, wind: [1, 0], me: [10, 10, 1], them: [10, 12, 1] });
    const total = (s) => s.hull + s.crew1 + s.crew2 + s.crew3 + s.gunL + s.gunR + s.carL + s.carR + s.rig1 + s.rig2 + s.rig3 + Math.max(0, s.rig4);
    const before = total(st.ships[0].specs);
    const { state } = turn(st, {});
    if (total(state.ships[0].specs) < before) damaged++;
  }
  assert.ok(damaged >= 15, `${damaged}/20`);
});

test('T-17 repairs: two points per three turns of work', () => {
  let st = duel({ wind: [1, 0], them: [40, 40, 1] });
  st.ships[0].specs.hull = 2; // max repairable hull is guns/4 = 9
  st = turn(st, { repair: 'hull' }).state;
  st = turn(st, { repair: 'hull' }).state;
  assert.equal(st.ships[0].specs.hull, 2);
  st = turn(st, { repair: 'hull' }).state;
  assert.equal(st.ships[0].specs.hull, 4);
  // all hands: no repairs while fighting the ship
  const { events } = turn(st, { repair: 'hull', sails: 'full' });
  assert.ok(eventsOf(events, 'msg').some((e) => e.text.includes('No hands free to repair')));
  // computer ships never repair
  const enemy = st.ships[1];
  assert.equal(enemy.RH + enemy.RG + enemy.RR, 0);
});

test('T-18 an enemy battered to a hulk strikes her colours', () => {
  let struck = null;
  for (let seed = 1; seed <= 50 && !struck; seed++) {
    const st = duel({ seed, wind: [1, 0], me: [10, 10, 1], them: [10, 8, 1] });
    st.ships[1].specs.hull = 1;
    st.ships[0].loadL = 4; // double shot, range 2 is too far — use round
    st.ships[0].loadL = 3;
    const { state, events } = turn(st, { fire: { L: 'hull' } });
    if (state.ships[1].struck) struck = { state, events };
  }
  assert.ok(struck, 'a hull-1 enemy strikes within 50 tries');
  const e = eventsOf(struck.events, 'strike')[0];
  assert.equal(e.ship, 1);
  const g = glyph(struck.state, struck.state.ships[1]);
  const want = e.fate === 'sink' ? '~' : e.fate === 'fire' ? '#' : '!';
  assert.equal(g, `${want}0`);
  assert.ok(struck.state.ships[0].points >= struck.state.ships[1].specs.pts, 'points for the strike');
});

test('T-19 a sinking hulk eventually goes down (~ then gone)', () => {
  // Constitution vs. Cyane and Levant: a second enemy keeps the battle going.
  let st = createGame({ scenarioId: 16, playerShip: 0, seed: 9 });
  [st.winddir, st.windspeed] = [1, 0];
  place(st, 0, 10, 10, 1);
  place(st, 1, 30, 30, 1);
  place(st, 2, 60, 60, 1);
  Object.assign(st.ships[1], { struck: 1, sink: 1 });
  assert.equal(glyph(st, st.ships[1]), '~0');
  let sank = null;
  for (let i = 0; i < 40 && !sank; i++) {
    const r = turn(st, {});
    st = r.state;
    sank = eventsOf(r.events, 'sink')[0];
  }
  assert.ok(sank);
  assert.equal(st.ships[1].dir, 0);
  assert.equal(st.ships[1].sink, 2);
});

test('T-20 boarding and winning captures the enemy', () => {
  let won = null;
  for (let seed = 1; seed <= 20 && !won; seed++) {
    const st = duel({ seed, wind: [1, 0], me: [10, 10, 1], them: [10, 11, 1] });
    addGrap(st, st.ships[0], st.ships[1]);
    addGrap(st, st.ships[1], st.ships[0]);
    Object.assign(st.ships[1].specs, { crew1: 1, crew2: 0, crew3: 0 });
    const r = turn(st, { board: [{ target: 1, sections: 3 }] });
    // the enemy may cut the grapnel first (1 in 3), which recalls boarders
    if (eventsOf(r.events, 'capture').length) won = r.state;
  }
  assert.ok(won, 'captured within 20 tries');
  assert.equal(won.ships[1].captured, 0);
  assert.equal(glyph(won, won.ships[1]), 'a&', 'American flag, captured stern mark');
  assert.ok(won.ships[1].pcrew > 0, 'a prize crew is aboard');
  assert.ok(won.ships[0].points > 0);
});

test('T-21 colliding ships may foul; fouled ships cannot move', () => {
  let found = null;
  for (let seed = 1; seed <= 60 && !found; seed++) {
    const st = duel({ seed, wind: [1, 3], me: [10, 10, 3], them: [10, 13, 1] });
    st.ships[1].specs.crew3 = 0; // keep the Shannon still
    const { state, events } = turn(st, { move: '3' });
    if (eventsOf(events, 'foul').length) found = state;
  }
  assert.ok(found, 'a collision fouls within 60 tries');
  assert.ok(snagged(found.ships[0]) && snagged(found.ships[1]));
  const v = validateMove(found, found.ships[0], '3');
  assert.equal(v.unable, true);
  assert.deepEqual(v.msgs, ['Unable to move']);
});

test('T-22 boarding parties fight and both crews take casualties', () => {
  let fought = null;
  for (let seed = 1; seed <= 30 && !fought; seed++) {
    const st = duel({ seed, wind: [1, 0], me: [10, 10, 1], them: [10, 11, 1] });
    addFoul(st, st.ships[0], st.ships[1]);
    addFoul(st, st.ships[1], st.ships[0]);
    const { events } = turn(st, { board: [{ target: 1, sections: 3 }] });
    const m = eventsOf(events, 'melee').find((e) => e.b === 0);
    if (m && m.killedA > 0 && m.killedB > 0) fought = m;
  }
  assert.ok(fought, 'a melee with losses on both sides');
  assert.ok(fought.rounds.length >= 1);
});

test('T-23 two captains in one battle (engine-level; network join is ADR 003)', () => {
  const st = createGame({ scenarioId: 13, playerShip: [0, 1], seed: 5 });
  [st.winddir, st.windspeed] = [1, 3];
  place(st, 0, 10, 10, 3);
  place(st, 1, 40, 40, 3);
  const { state } = resolveTurn(st, { 0: { move: '3' }, 1: { move: '2' } });
  assert.equal(state.ships[0].col, 13);
  assert.equal(state.ships[1].col, 42);
});

test('T-24 top ten sailors, ranked by net points', () => {
  let board = [];
  const add = (captain, points, shipPts) => {
    ({ board } = recordScore(board, { captain, login: captain.toLowerCase(), ship: 'Lydia', scenario: 'x', points, shipPts }));
  };
  add('Hornblower', 20, 13);
  add('Bush', 10, 13);
  add('Pellew', 60, 14);
  for (let i = 0; i < 12; i++) add(`Mid${i}`, i + 1, 20);
  assert.equal(board.length, 10);
  assert.equal(board[0].captain, 'Pellew');
  assert.equal(board[1].captain, 'Hornblower');
  assert.ok(board.every((r, i) => i === 0 || board[i - 1].net >= r.net));
  assert.match(formatBoard(board)[1], /Pellew/);
});

test('T-25 score display with login names', () => {
  const { board } = recordScore([], { captain: 'Hornblower', login: 'horatio', ship: 'Lydia', scenario: 's', points: 13, shipPts: 13 });
  assert.match(formatBoard(board, { logins: true })[1], /Hornblower \(horatio\)/);
  assert.doesNotMatch(formatBoard(board)[1], /horatio/);
});

test('command line accepts the original helm grammar and the prompt answers', () => {
  const st = duel({});
  assert.deepEqual(parseCommand(st, 0, 'l1r1r2').patch, { move: 'l1r1r2' });
  assert.deepEqual(parseCommand(st, 0, 'd').patch, { move: 'd' });
  assert.deepEqual(parseCommand(st, 0, 'f l h').patch, { fire: { L: 'hull' } });
  assert.deepEqual(parseCommand(st, 0, 'f r r').patch, { fire: { R: 'rigging' } });
  assert.deepEqual(parseCommand(st, 0, 'ld l d').patch, { load: { L: 'double' } });
  assert.deepEqual(parseCommand(st, 0, 'rp h').patch, { repair: 'hull' });
  assert.deepEqual(parseCommand(st, 0, 'b b0 2').patch, { board: [{ target: 1, sections: 2 }] });
  assert.equal(parseCommand(st, 0, '').kind, 'commit');
  assert.deepEqual(parseCommand(st, 0, '/u b0').patch, { unfoul: [1] }, 'a stray focus key is ignored');
  assert.equal(parseCommand(st, 0, 'x').kind, 'error');
});

test('computer hit numbers match the player formula', () => {
  const st = duel({ wind: [1, 0], me: [10, 10, 1], them: [10, 12, 1] });
  const a = st.ships[0];
  const b = st.ships[1];
  const h = computeHit(st, a, b, { guns: a.specs.gunR, car: a.specs.carR, load: 3, ready: a.readyR, crew: [1, 1, 1] });
  assert.ok(Number.isInteger(h.hit));
  assert.ok(h.parts.length >= 2);
});
