// Bots: Classic Otto is golden-tested against otto.c (tests/golden.test.js,
// scenarios 03 and 07). These tests pin the two labelled extensions.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../src/engine/hunt.js';
import * as K from '../src/engine/constants.js';
import { createMatch, tick } from '../src/engine/match.js';
import { addBot, runBots } from '../src/bots/index.js';
import { openArena, put } from './lib/arena.js';

function duel(kA, kB, seed, arena, steps = 3000) {
  const g = createMatch({ seed, bots: 0, human: null, arena, rejoinDelay: 10 });
  H.connect(g, 'A');
  addBot(g, 'A', kA, seed * 3 + 1);
  H.connect(g, 'B');
  addBot(g, 'B', kB, seed * 5 + 2);
  const keys = { A: 0, B: 0 };
  const heavy = { A: 0, B: 0 };
  for (let t = 0; t < steps; t++) {
    for (const e of tick(g)) {
      if (e.t === 'bot') keys[e.name] += e.cmd.length;
      if (e.t === 'fire' && e.type !== K.SHOT) {
        const p = H.playerById(g, e.id);
        if (p) heavy[H.nameOf(g, p)]++;
      }
    }
  }
  const s = Object.fromEntries(g.scores.map((x) => [x.name, x.gkills]));
  return { kills: [s.A, s.B], keys, heavy };
}

test('difficulty ladder over 10 duels: Novice < Classic Otto < Sharpshooter (Classic arena)', () => {
  const total = (a, b, arena) => {
    const k = [0, 0];
    for (let s = 1; s <= 10; s++) {
      const r = duel(a, b, s, arena).kills;
      k[0] += r[0];
      k[1] += r[1];
    }
    return k;
  };
  const [o, n] = total('otto', 'novice', 'classic');
  assert.ok(o > n, `otto ${o} vs novice ${n}`);
  const [s1, o1] = total('sharp', 'otto', 'classic');
  assert.ok(s1 > 1.5 * o1, `classic: sharp ${s1} vs otto ${o1}`);
  const [s2, o2] = total('sharp', 'otto', 'ricochet');
  assert.ok(s2 > 1.5 * o2, `ricochet: sharp ${s2} vs otto ${o2}`);
});

test('Novice reacts 3-6 steps late and never throws slime or bombs', () => {
  let firstFire = null;
  const g = openArena();
  const n = put(g, 'rookie', 11, 10, '>');
  const foe = put(g, 'foe', 11, 20, '^');
  foe.cloak = -1;
  addBot(g, 'rookie', 'novice', 4);
  for (let t = 1; t <= 40 && firstFire == null; t++) {
    for (const e of H.step(g, runBots)) if (e.t === 'fire' && e.id === n.id) firstFire = t;
  }
  assert.ok(firstFire != null && firstFire >= 4, `first shot at step ${firstFire}`);
  let heavy = 0;
  for (let s = 1; s <= 4; s++) {
    const g2 = createMatch({ seed: s, bots: 6, difficulty: 'novice', human: null, rejoinDelay: 5 });
    for (let t = 0; t < 1500; t++) for (const e of tick(g2)) if (e.t === 'fire' && e.type !== K.SHOT && e.type !== K.GRENADE) heavy++;
  }
  assert.equal(heavy, 0);
});

test('Sharpshooter banks a shot off a mirror at a target Otto would not shoot', () => {
  // The target stands in the right-hand lane of the sharpshooter's view,
  // one row off its line of fire; a '\\' ahead turns the shot into it.
  const g = openArena([[5, 20, '\\']]);
  const ace = put(g, 'ace', 5, 5, '>');
  const target = put(g, 'target', 6, 20, '^');
  target.cloak = -1;
  addBot(g, 'ace', 'sharp', 1);
  H.step(g); // ace looks; target is on its screen now
  g.ev = [];
  ace.q = [];
  runBots(g);
  const cmd = g.ev.find((e) => e.t === 'bot').cmd;
  assert.equal(cmd, 'f', 'fires straight ahead: the mirror does the aiming');
  const ev = [];
  for (let i = 0; i < 5; i++) ev.push(...H.step(g)); // 15 cells to the mirror: 3 steps
  assert.ok(ev.find((e) => e.t === 'bounce' && e.x === 20 && e.y === 5));
  assert.ok(ev.find((e) => (e.t === 'hurt' || e.t === 'zing' || e.t === 'absorb') && (e.who === target.id)), 'the shot reached the target');

  // Classic Otto in the same spot does not take that shot.
  const g2 = openArena([[5, 20, '\\']]);
  const otto = put(g2, 'otto', 5, 5, '>');
  put(g2, 'target', 6, 20, '^');
  addBot(g2, 'otto', 'otto', 1);
  H.step(g2);
  g2.ev = [];
  otto.q = [];
  runBots(g2);
  assert.notEqual(g2.ev.find((e) => e.t === 'bot').cmd, 'f');
});

test('Sharpshooter never fires a shot that would come back into itself or a teammate', () => {
  // A mirror box that would return the shot to the shooter.
  const g = openArena([[5, 10, '\\'], [8, 10, '/'], [8, 4, '\\'], [5, 4, '/']]);
  const ace = put(g, 'ace', 5, 6, '>', '1');
  put(g, 'mate', 5, 8, 'v', '1');
  addBot(g, 'ace', 'sharp', 3);
  H.step(g);
  g.ev = [];
  ace.q = [];
  runBots(g);
  const cmd = g.ev.find((e) => e.t === 'bot').cmd;
  assert.ok(!/^f$/.test(cmd), `did not shoot its mate: ${cmd}`);
});

test('bots only know what their own screen shows (no wall-hack)', () => {
  // An opponent behind a wall is not attacked by any bot kind.
  for (const kind of ['otto', 'novice', 'sharp']) {
    const g = openArena([[11, 15, '|']]);
    const bot = put(g, 'bot', 11, 10, '>');
    put(g, 'hidden', 11, 20, '<');
    addBot(g, 'bot', kind, 9);
    H.step(g);
    g.ev = [];
    bot.q = [];
    bot.ammo = 50;
    runBots(g);
    const e = g.ev.find((ev) => ev.t === 'bot');
    const cmd = e ? e.cmd : '';
    assert.ok(!/[fgoFG]/.test(cmd), `${kind} fired blind: ${cmd}`);
  }
});
