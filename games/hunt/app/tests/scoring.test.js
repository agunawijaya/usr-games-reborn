// Kills, deaths and the score (driver.c checkdam, answer.c get_ident).
// The score is kills / entries — a decayed average kept per session — and
// is stored as a C float, so the engine rounds it to float32.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../src/engine/hunt.js';
import * as K from '../src/engine/constants.js';
import { openArena, put } from './lib/arena.js';

const score = (g, n) => g.scores.find((s) => s.name === n);

test('a kill: +1 kill, +2 damage capacity, 2 points healed, death message', () => {
  const g = openArena();
  const a = put(g, 'a', 11, 10, '>');
  const b = put(g, 'b', 11, 12, '^');
  a.damage = 5;
  b.damage = 10;
  H.checkdam(g, b, a, H.ident(g, a), 5, K.SHOT);
  assert.equal(b.death, '| Shot to death by a |');
  assert.equal(score(g, 'a').kills, 1);
  assert.equal(score(g, 'a').gkills, 1);
  assert.equal(a.damcap, 12);
  assert.equal(a.damage, 3);
  assert.equal(score(g, 'b').deaths, 1);
  assert.equal(score(g, 'a').score, Math.fround(1 / 1));
});

test('killing yourself or a teammate costs a kill', () => {
  const g = openArena();
  const a = put(g, 'a', 11, 10, '>', '1');
  const mate = put(g, 'mate', 11, 12, '^', '1');
  const foe = put(g, 'foe', 11, 14, '^', '2');
  mate.damage = 10;
  H.checkdam(g, mate, a, H.ident(g, a), 5, K.GRENADE);
  assert.equal(score(g, 'a').kills, -1);
  assert.equal(score(g, 'a').bkills, 1);
  assert.equal(mate.death, '| Bombed by a |');
  a.damage = 10;
  H.checkdam(g, a, a, H.ident(g, a), 5, K.GRENADE);
  assert.equal(score(g, 'a').kills, -2);
  foe.damage = 10;
  H.checkdam(g, foe, a, H.ident(g, a), 5, K.SHOT);
  assert.equal(score(g, 'a').kills, -1, 'a dead player’s shots still score');
});

test('a mine or an act of God gets no credit', () => {
  const g = openArena();
  const a = put(g, 'a', 11, 10, '>');
  a.damage = 10;
  H.checkdam(g, a, null, null, 5, K.MINE);
  assert.equal(a.death, '| Blown apart by a mine |');
  const b = put(g, 'b', 5, 10, '>');
  b.damage = 10;
  H.checkdam(g, b, null, null, 5, K.FALL);
  assert.equal(b.death, '| Killed on impact by act of God |');
});

test('the score is kills per entry, and old kills decay after 15 entries', () => {
  const g = openArena();
  H.connect(g, 'a');
  const ip = score(g, 'a');
  ip.kills = 6;
  for (let i = 2; i <= 15; i++) {
    const pp = H.findPlayer(g, 'a');
    pp.death = '| Quit |';
    H.step(g);
    H.connect(g, 'a');
    assert.equal(ip.entries, i);
    assert.equal(ip.score, Math.fround(6 / i));
  }
  const pp = H.findPlayer(g, 'a');
  pp.death = '| Quit |';
  H.step(g);
  H.connect(g, 'a');
  assert.equal(ip.entries, 15, 'entries stop at SCOREDECAY');
  assert.equal(ip.kills, Math.fround(Math.fround(6 * 14) / 15));
});

test('stabbed to death drops no ammo: the knife empties the victim', () => {
  const g = openArena();
  const a = put(g, 'a', 11, 10, '>');
  const b = put(g, 'b', 11, 11, '^');
  b.damage = 9;
  b.ammo = 99;
  H.key(g, a, 'l');
  const ev = H.step(g);
  const d = ev.find((e) => e.t === 'death');
  assert.equal(d.text, '| Stabbed to death by a |');
  assert.equal(d.detonate, null);
});
