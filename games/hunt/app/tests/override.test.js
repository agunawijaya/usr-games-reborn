// Override (cheat layer 2): every flag works, and with every flag off the
// simulation is identical to the recorded baseline (seeded replay).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as H from '../src/engine/hunt.js';
import * as K from '../src/engine/constants.js';
import { createMatch, tick, scoreboard } from '../src/engine/match.js';
import { setOverride, overrideActive, OVERRIDE_FLAGS } from '../src/engine/override.js';
import { BASELINE_MATCHES, chain } from './lib/baseline.js';

const baseline = JSON.parse(readFileSync(new URL('./fixtures/baseline.json', import.meta.url), 'utf8'));

test('all flags off: seeded replays match the recorded baseline hash for hash', () => {
  for (const [i, cfg] of BASELINE_MATCHES.entries()) {
    assert.deepEqual(chain(cfg).hashes, baseline[i].hashes, `match seed ${cfg.seed}`);
  }
});

test('view and host flags never touch the simulation (reveal mines, see all, slow motion)', () => {
  const cfg = BASELINE_MATCHES[0];
  const got = chain(cfg, 3000, { flags: { revealMines: true, seeAll: true, slowMotion: true } }).hashes;
  assert.deepEqual(got, baseline[0].hashes);
});

test('the flag list covers every engine and view flag, and turning one on marks the match cheated', () => {
  const g = createMatch({ seed: 5, bots: 2 });
  assert.equal(overrideActive(g), false);
  assert.deepEqual(OVERRIDE_FLAGS.map((f) => f.key).sort(), Object.keys(H.DEFAULT_CHEATS).sort());
  setOverride(g, 'seeAll', true);
  assert.equal(overrideActive(g), true);
  setOverride(g, 'seeAll', false);
  assert.equal(overrideActive(g), false);
  assert.equal(g.cheated, true, 'cheated stays set for the rest of the match');
  assert.equal(scoreboard(g).find((r) => r.name === 'you').cheated, true);
  assert.throws(() => setOverride(g, 'nope', true));
});

test('god mode: you take no damage, bots still do', () => {
  const g = createMatch({ seed: 7, bots: 4, difficulty: 'sharp', rejoinDelay: 0 });
  setOverride(g, 'god', true);
  let botHurt = 0;
  for (let t = 0; t < 3000; t++) {
    for (const e of tick(g)) {
      if (e.t !== 'hurt') continue;
      const p = H.playerById(g, e.who);
      if (p && H.nameOf(g, p) === 'you') assert.equal(e.amt, 0);
      else if (e.amt > 0) botHurt++;
    }
  }
  assert.equal(g.scores.find((s) => s.name === 'you').deaths, 0);
  assert.ok(botHurt > 0);
});

test('infinite ammo: you can keep throwing 21x21 bombs', () => {
  const g = createMatch({ seed: 8, bots: 0 });
  setOverride(g, 'infiniteAmmo', true);
  const me = H.findPlayer(g, 'you');
  me.ammo = 0;
  let bombs = 0;
  for (let t = 0; t < 40; t++) {
    me.ncshot = 0;
    if (!me.q.length) H.key(g, me, '@');
    for (const e of tick(g)) if (e.t === 'fire' && e.charge === 441) bombs++;
    if (!H.findPlayer(g, 'you')) break;
  }
  assert.ok(bombs >= 1);
});

test('freeze bots: bots stop typing and stand still', () => {
  const g = createMatch({ seed: 9, bots: 6 });
  for (let t = 0; t < 50; t++) tick(g);
  setOverride(g, 'freezeBots', true);
  for (let t = 0; t < 5; t++) tick(g); // let typeahead drain
  const where = () => H.active(g).filter((p) => g.bots[H.nameOf(g, p)] && p.flying < 0).map((p) => `${H.nameOf(g, p)}@${p.x},${p.y}`).sort().join(' ');
  const before = where();
  for (let t = 0; t < 200; t++) {
    for (const e of tick(g)) assert.notEqual(e.t, 'bot');
  }
  const after = where();
  const moved = before.split(' ').filter((s) => !after.includes(s));
  assert.ok(moved.length <= 1, `frozen (a dead-and-reentered bot may differ): ${moved}`);
});

test('instant respawn: you re-enter in the same pass, like answer() after zap()', () => {
  const g = createMatch({ seed: 10, bots: 2, rejoinDelay: 30 });
  setOverride(g, 'instantRespawn', true);
  const before = H.findPlayer(g, 'you').id;
  H.findPlayer(g, 'you').death = '| Quit |';
  const ev = tick(g);
  assert.ok(ev.find((e) => e.t === 'death' && e.name === 'you'));
  assert.ok(ev.find((e) => e.t === 'enter' && e.name === 'you'));
  assert.notEqual(H.findPlayer(g, 'you').id, before, 'a new life');
  const g2 = createMatch({ seed: 10, bots: 2, rejoinDelay: 30 });
  H.findPlayer(g2, 'you').death = '| Quit |';
  for (let t = 0; t < 10; t++) tick(g2);
  assert.equal(H.findPlayer(g2, 'you'), null, 'without the flag you wait out the delay');
});

test('engine flags only change the human: a bots-only match is unaffected by god/infinite ammo', () => {
  const cfg = { seed: 11, bots: 6, difficulty: 'mixed', human: null };
  const run = (flags) => {
    const g = createMatch(cfg);
    for (const [k, v] of Object.entries(flags)) setOverride(g, k, v);
    for (let t = 0; t < 1500; t++) tick(g);
    return JSON.stringify(g.scores);
  };
  assert.equal(run({ god: true, infiniteAmmo: true, instantRespawn: true }), run({}));
  void K;
});
