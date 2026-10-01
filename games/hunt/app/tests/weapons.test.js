// Weapons as verified in execute.c / shots.c / extern.c (docs/notes.md has
// the table and the canonical-doc discrepancies).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../src/engine/hunt.js';
import * as K from '../src/engine/constants.js';
import { openArena, put, at, run } from './lib/arena.js';

test('ammo costs and projectile glyphs: f g F G 5-9 0 @ and o O p P', () => {
  const table = [
    ['f', 1, ':'], ['1', 1, ':'], ['g', 9, 'o'], ['2', 9, 'o'], ['F', 25, 'O'], ['3', 25, 'O'],
    ['G', 49, '@'], ['4', 49, '@'], ['5', 81, '@'], ['6', 121, '@'], ['7', 169, '@'],
    ['8', 225, '@'], ['9', 289, '@'], ['0', 361, '@'], ['@', 441, '@'],
    ['o', 5, '$'], ['O', 10, '$'], ['p', 15, '$'], ['P', 20, '$'],
  ];
  for (const [keyc, cost, glyph] of table) {
    const g = openArena();
    const pp = put(g, 'p', 11, 25, '>');
    pp.ammo = 1000;
    H.key(g, pp, keyc);
    const ev = H.step(g);
    const fire = ev.find((e) => e.t === 'fire');
    assert.equal(1000 - pp.ammo, cost, `${keyc} costs ${cost}`);
    assert.equal(String.fromCharCode(fire.type), glyph, `${keyc} throws '${glyph}'`);
    if (glyph === '$') assert.equal(fire.charge, cost * K.SLIME_FACTOR, 'slime charge = 3 x cost');
    else assert.equal(fire.charge, cost);
  }
});

test('asking for more than you can afford throws the biggest thing you can', () => {
  const g = openArena();
  const pp = put(g, 'p', 11, 25, '>');
  pp.ammo = 30;
  H.key(g, pp, '@'); // 441 wanted, 25 (satchel) affordable
  const ev = H.step(g);
  assert.equal(String.fromCharCode(ev.find((e) => e.t === 'fire').type), 'O');
  assert.equal(pp.ammo, 5);
  pp.ammo = 0;
  H.key(g, pp, 'f');
  const ev2 = H.step(g);
  assert.ok(ev2.find((e) => e.t === 'msg' && e.text === 'Not enough charges.'));
});

test('the gun fires three times, then cools only when you move', () => {
  const g = openArena();
  const pp = put(g, 'p', 11, 25, '>');
  pp.ammo = 100;
  H.key(g, pp, 'ffff');
  run(g, 4);
  assert.equal(pp.ammo, 97, 'the fourth shot did not fire');
  H.key(g, pp, 'fk'); // still hot, then a move
  run(g, 2);
  assert.equal(pp.ammo, 97);
  H.key(g, pp, 'f');
  run(g, 1);
  assert.equal(pp.ammo, 96, 'one move cooled it by one');
});

test('shots move five cells per step, five times faster than a player', () => {
  const g = openArena();
  const pp = put(g, 'p', 11, 5, '>');
  H.key(g, pp, 'f');
  run(g, 1);
  assert.equal(g.bullets[0].x, 10);
  run(g, 1);
  assert.equal(g.bullets[0].x, 15);
});

test('explosion damage falls off one unit (5 points) per ring', () => {
  // [key, ammo, size]: grenade 3x3, satchel 5x5, 7x7 bomb, 21x21 bomb
  for (const [keyc, size] of [['g', 2], ['F', 3], ['G', 4], ['@', 11]]) {
    const g = openArena([[11, 30, '|']]);
    const shooter = put(g, 'shooter', 11, 3, '>');
    shooter.ammo = 1000;
    // victims at ring 0 (none: the wall), ring 1, ring 2 diagonally
    const victims = [];
    for (let r = 1; r < Math.min(size, 5); r++) {
      const v = put(g, `v${r}`, 11 - r, 29 - (r - 1), 'v');
      v.damcap = 1000;
      victims.push([v, Math.max(r, r - 1 + 1)]);
    }
    H.key(g, shooter, keyc);
    run(g, 8);
    for (const [v] of victims) {
      const dy = Math.abs(v.y - 11);
      const dx = Math.abs(v.x - 30);
      const ring = Math.max(dx, dy);
      assert.equal(v.damage, (size - ring) * K.MINDAM, `${keyc}: victim at ring ${ring}`);
    }
  }
});

test('a bullet does 5 points: three hits kill a fresh player (capacity 10)', () => {
  const g = openArena();
  const a = put(g, 'a', 11, 10, '>');
  const b = put(g, 'b', 11, 14, '^'); // not facing the shots: cannot catch them
  a.ammo = 100;
  const damage = [];
  for (let i = 0; i < 12 && H.findPlayer(g, 'b'); i++) {
    a.ncshot = 0; // not testing the cool-down here
    H.key(g, a, 'f');
    for (const e of H.step(g)) if (e.t === 'hurt' && e.who === b.id) damage.push(b.damage);
  }
  assert.equal(H.findPlayer(g, 'b'), null, 'b died');
  assert.deepEqual(damage, [5, 10, 15], 'dead when damage exceeds the capacity of 10');
  const sc = g.scores.find((s) => s.name === 'a');
  assert.equal(sc.kills, 1);
});

test('stabbing: move into a player you are facing for 2 points; otherwise nothing', () => {
  const g = openArena();
  const a = put(g, 'a', 11, 10, '>');
  const b = put(g, 'b', 11, 11, '^');
  H.key(g, a, 'l');
  run(g, 1);
  assert.equal(b.damage, K.STABDAM);
  assert.deepEqual([a.x, a.y], [10, 11], 'a stabbing player does not move');
  H.key(g, a, 'L'); // already facing right: no-op turn
  H.key(g, b, 'h'); // b walks into a while facing up: just a beep
  const ev = H.step(g);
  assert.ok(ev.find((e) => e.t === 'bell' && e.id === b.id));
});

test('moving strafes: h/j/k/l never change your facing, H/J/K/L do', () => {
  const g = openArena();
  const a = put(g, 'a', 11, 10, '>');
  H.key(g, a, 'hjkl');
  run(g, 4);
  assert.equal(a.face, K.RIGHT);
  H.key(g, a, 'K');
  run(g, 1);
  assert.equal(a.face, K.ABOVE);
  assert.deepEqual([a.x, a.y], [10, 11]);
});

test('walking into a shot on the floor sets it off', () => {
  const g = openArena([[11, 13, '|']]);
  const a = put(g, 'a', 11, 10, '>');
  a.ammo = 100;
  const b = put(g, 'b', 5, 5, 'v');
  b.ammo = 100;
  // a grenade that lands on a mine-free floor... simplest: a slime sitting
  // in a cell. Put a shot char under a bullet by hand:
  g.bullets.unshift({ id: 999, x: 11, y: 11, face: K.RIGHT, charge: 1, type: K.SHOT, size: 1, over: K.SPACE, owner: -1, score: -1, expl: false, path: null, bounces: 0 });
  g.maze[11 * 51 + 11] = K.SHOT;
  H.key(g, a, 'l');
  const ev = H.step(g);
  assert.ok(ev.find((e) => e.t === 'boom' && e.id === 999));
  void b;
});

test('firing gives you away: everyone sees your glyph where you fired', () => {
  // fire() draws the shot on every screen (showexpl); the next moveshots()
  // puts the shot's b_over — the shooter's own glyph — back and check()s
  // that cell for EVERY player (shots.c:89-97). So after one step a player
  // across the maze sees where you are and which way you face.
  const g = openArena([[11, 26, '|']]);
  const a = put(g, 'a', 11, 25, '>');
  const far = put(g, 'far', 2, 2, '^'); // cannot see a
  const i = 11 * 51 + 25;
  H.key(g, a, 'f');
  run(g, 1);
  assert.equal(far.scr[i], K.RIGHT, "far now shows a's glyph }");
  H.key(g, a, 'j');
  run(g, 1);
  assert.equal(far.scr[i], K.SPACE, 'moving away erases it for everyone (drawplayer)');
});

void at;
