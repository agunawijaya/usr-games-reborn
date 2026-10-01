// Rules of the original engine: start state, movement, inventory limits,
// day/night conversion, fights, fatigue, the win line. (Transcripts of the
// real binary cover the same ground byte for byte in golden.test.js; these
// tests pin the *meaning* so a reader can see each rule in isolation.)

import test from 'node:test';
import assert from 'node:assert/strict';
import { Battlestar, C } from '../src/engine/battlestar.js';
import { runScript } from '../src/engine/run.js';

const su = (room, time = '') => ['su', String(room), String(time), '', '', '', '', '', ''];

test('start: room 22, facing north, wearing silk pajamas, 250 fuel, 10 torpedoes', () => {
  const g = new Battlestar({ seed: 1 });
  const r = g.start();
  assert.match(r.output, /^Version 4\.2, fall 1984\.\nFirst Adventure game written by His Lordship, the honorable\nAdmiral D\.W\. Riggle\n/);
  assert.equal(g.position, 22);
  assert.equal(g.direction, C.NORTH);
  assert.ok(g.wears(C.PAJAMAS));
  assert.deepEqual(g.inventory(), []);
  assert.equal(g.fuel, 250);
  assert.equal(g.torps, 10);
  assert.equal(g.snooze, 150);
  assert.equal(g.ate, 0);
  assert.equal(r.request.prompt, '>-: ');
});

test('relative movement: right from 22 faces east into 16; back reverses', () => {
  const g = new Battlestar({ seed: 1 });
  g.start();
  g.send('right');
  assert.equal(g.position, 16);
  assert.equal(g.direction, C.EAST);
  g.send('back');
  assert.equal(g.position, 22);
  assert.equal(g.direction, C.WEST);
  const r = g.send('left'); // facing west, left = south = the closet
  assert.equal(g.position, 8);
  assert.match(r.output, /walk in closet/);
});

test('blocked moves do not pass time', () => {
  const g = new Battlestar({ seed: 1 });
  g.start();
  const r = g.send('ahead');
  assert.match(r.output, /You can't go this way\./);
  assert.equal(g.ourtime, 0);
});

test('inventory limits: too heavy, too cumbersome, wearing frees the arms', () => {
  const { transcript, game } = runScript([
    ...su(19), 'take warhead', 'drop warhead',
  ], { seed: 1, username: 'riggle' });
  // 55 kg warhead: takeable when empty-handed (55 <= 60), then dropping it kills.
  assert.match(transcript, /warhead:\nTaken\./);
  assert.match(transcript, /The bomb explodes\./);
  assert.equal(game.ended, true);
  // Presence is checked before bulk, so the refusal only shows for an object that is here.
  const b = runScript(['take two-handed', ...su(258), 'take mail'], { seed: 1, username: 'riggle' });
  assert.match(b.transcript, /The coat of mail is too cumbersome to hold\./);
  const c = runScript([...su(20), 'take laser', 'wear laser', 'i'], { seed: 1, username: 'riggle' });
  assert.match(c.transcript, /You are now wearing a laser\./);
  assert.match(c.transcript, /You aren't carrying anything\.\n\nYou are wearing:\n\n\tpajamas\n\tlaser\n/);
});

test('dropping an artifact destroys it', () => {
  const { game } = runScript(['right', 'right', 'take amulet', 'drop amulet'], { seed: 1 });
  assert.equal(game.here(C.AMULET), false);
  assert.equal(game.has(C.AMULET), false);
});

test('eating needs a knife; "stuffed" only while ourtime <= ate - 100', () => {
  const { transcript, game } = runScript([...su(109), 'take papayas', 'eat papayas', 'take knife', 'eat papayas'],
    { seed: 1, username: 'riggle' });
  assert.match(transcript, /You need a knife\./);
  assert.match(transcript, /Eaten\.  You can explore a little longer now\./);
  assert.equal(game.snooze, 160);
});

test('the ship explodes after turn 30', () => {
  const { transcript, endKind } = runScript(['right', ...Array(40).fill('back')], { seed: 1 });
  assert.match(transcript, /Explosions rock the battlestar\./);
  assert.match(transcript, /frozen void of space and killed\./);
  assert.equal(endKind, 'died');
});

test('day/night: dusk at the first news() after turn 100 swaps files, adds night objects, removes the bathing goddess', () => {
  const g = new Battlestar({ seed: 1, username: 'riggle', flightMode: 'stdin' });
  g.start();
  for (const l of su(80, 100)) g.send(l);
  assert.equal(g.isNight, false);
  assert.ok(g.here(C.BATHGOD, 126));
  const r = g.send('right');
  assert.equal(g.isNight, true);
  assert.match(r.output, /The dying sun sinks into the ocean/);
  assert.ok(g.here(C.ELF, 216) && g.here(C.WOODSMAN, 216), 'night guards at the catacomb entrance');
  assert.ok(g.here(C.CYLON, 68), 'night Cylon over the tropical planet');
  assert.equal(g.here(C.BATHGOD, 126), false);
  // dawn removes night objects but the goddess does not come back
  g.send('sleep');
  for (const l of su(80, 200)) g.send(l);
  g.send('up'); g.send('down'); // any turn-ending command runs news()
  g.send('look');
  for (const l of su(114)) g.send(l);
  assert.equal(g.isNight, false);
  assert.equal(g.here(C.ELF, 216), false);
  assert.equal(g.here(C.BATHGOD, 126), false);
});

test('fights: the laser kills an elf in one shot; a woodsman too', () => {
  const { transcript } = runScript(['take laser', ...su(146), 'shoot'], { seed: 5, username: 'riggle' });
  assert.match(transcript, /The Elf took a direct hit!\nYou have killed the Elf\./);
  const w = runScript(['take laser', ...su(172), 'shoot'], { seed: 5, username: 'riggle' });
  assert.match(w.transcript, /You have killed the Woodsman\./);
});

test('fights: shooting the Dark Lord at full strength costs you the laser', () => {
  const { transcript, game } = runScript(['take laser', ...su(266), 'shoot', 'back'], { seed: 5, username: 'riggle' });
  assert.match(transcript, /deflects the laser blast and whips the pistol from you!/);
  assert.equal(game.has(C.LASER), false);
});

/** Drives the Dark Lord fight at 266 as a wizard: wound him, then retreat. */
function darkLordRetreat(seed, takes) {
  const g = new Battlestar({ seed, username: 'riggle', flightMode: 'stdin', keepTranscript: true });
  g.start();
  for (const l of [...takes, ...su(266)]) g.send(l);
  let guard = 0;
  while (!g.ended && g.inFight && guard++ < 60) g.send(g.inFight.lifeline > 33 ? 'back' : 'kill');
  return g;
}

test('fights: retreating from the wounded Dark Lord with the amulet makes him flee with it', () => {
  let ok = false;
  for (let seed = 1; seed < 40 && !ok; seed++) {
    const g = darkLordRetreat(seed, ['take amulet', 'wear amulet', 'take two-handed']);
    const t = g.transcript.join('');
    if (!/he flees down the dark caverns/.test(t)) continue;
    ok = true;
    assert.equal(g.holds(C.AMULET), false);
    assert.equal(g.followfight, g.ourtime, '"follow" must be the very next command');
    assert.equal(g.here(C.DARK), false);
    const r = g.send('follow');
    assert.match(r.output, /You have cornered him\./);
    assert.equal(g.position, 275);
    const r2 = g.send('back'); // escape at once: talisman and amulet drop where you land
    assert.match(r2.output, /You escape stunned and disoriented from the fight\./);
    const at = g.position;
    assert.ok(g.here(C.TALISMAN, at) && g.here(C.AMULET, at), `artifacts dropped in ${at}`);
  }
  assert.ok(ok);
});

test('fights: retreating from the Dark Lord while holding the medallion ends the world', () => {
  let ok = false;
  for (let seed = 1; seed < 40 && !ok; seed++) {
    const g = darkLordRetreat(seed, ['take amulet', 'take medallion', 'wear amulet', 'wear medallion', 'take two-handed']);
    if (/The planet is consumed by darkness\./.test(g.transcript.join(''))) {
      ok = true;
      assert.equal(g.endKind, 'died');
    }
  }
  assert.ok(ok);
});

test('the three artifacts make you a wizard; only shooting the goddess after the gifts wins', () => {
  const g = new Battlestar({ seed: 2, flightMode: 'stdin', keepTranscript: true });
  g.start();
  // White-box set-up: the throne room with the goddess, won over, carrying the three artifacts.
  g.position = 268;
  g.location[268].objects[0] |= 1 << C.NORMGOD;
  g.godready = 3;
  g.loved = 1;
  g.win = 0; // as after taking the medallion (win--)
  for (const o of [C.AMULET, C.MEDALION, C.TALISMAN, C.LASER]) { g.inven[o >> 5] |= 1 << (o & 31); }
  g.carrying = 8; g.encumber = 7;
  let r;
  const all = () => g.transcript.join('');
  g.send('down'); // turn-ending commands run news(), which checks the artifacts
  g.send('up');
  assert.match(all(), /The three amulets glow and reenforce each other in power\.\nYou are now a wizard\./);
  assert.equal(g.tempwiz, 1);
  assert.equal(g.ended, false, 'being a wizard is not winning');
  g.send('give amulet to goddess');
  g.send('give medallion to goddess');
  assert.equal(g.wintime, 0);
  r = g.send('give talisman to goddess');
  assert.match(r.output, /crowns you Prince Liverwort, Lord of Fungus/);
  assert.match(r.output, /you're going to have to\nshoot her!\)/);
  assert.ok(g.wintime > 0);
  r = g.send('shoot goddess');
  assert.match(r.output, /She has stopped moving\.\n\nYou win!\n/);
  assert.equal(g.endKind, 'won');
});

test('rate(): titles on all three axes, ties go to pleasure then power', () => {
  const g = new Battlestar({ seed: 1 });
  const cases = [
    [[0, 0, 0], 'novice'], [[5, 0, 0], 'junior voyeur'], [[20, 0, 0], 'Don Juan'], [[35, 0, 0], 'Marquis De Sade'],
    [[0, 4, 0], 'serf'], [[0, 5, 0], 'Samurai'], [[0, 8, 0], 'Klingon'], [[0, 13, 0], 'Darth Vader'], [[0, 22, 0], 'Sauron the Great'],
    [[0, 0, 4], 'Polyanna'], [[0, 0, 5], 'philanthropist'], [[0, 0, 10], 'Tattoo'], [[0, 0, 20], 'Mr. Roarke'],
    [[7, 7, 7], 'junior voyeur'], [[1, 9, 9], 'Klingon'],
  ];
  for (const [[p, w, e], title] of cases) {
    g.pleasure = p; g.power = w; g.ego = e;
    assert.equal(g.rate(), title, `${p}/${w}/${e}`);
  }
});

test('fatigue: collapsing outdoors can bring an elf thief (an artifact stolen is destroyed)', () => {
  // Deterministic scan for a seed where the thief strikes, then check the rule.
  let found = false;
  for (let seed = 1; seed < 80 && !found; seed++) {
    const g = new Battlestar({ seed, username: 'riggle', flightMode: 'stdin' });
    g.start();
    for (const l of ['take amulet', ...su(80, 150)]) g.send(l);
    const r = g.send('ahead'); // facing north from the coral beach: the palms (106)
    if (/A fiendish little Elf is stealing your treasures!/.test(r.output)) {
      found = true;
      assert.equal(g.holds(C.AMULET), false);
      assert.equal(g.here(C.AMULET), false, 'destroyed, not dropped');
    }
  }
  assert.ok(found, 'some seed produces the elf thief');
});
