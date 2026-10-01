// No UI or cheat shortcut may collide with a game key, in either control
// scheme (port ADR 004), and every original hunt command stays reachable.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACTIONS, CLASSIC, MODERN_DEFAULT, MOUSE, UI_KEYS, UI_CODES, facingToward } from '../src/keymap.js';

// KeyboardEvent.code of each UI key (US layout)
const UI_KEY_CODE = { Escape: 'Escape', '?': 'Slash', '`': 'Backquote', '\\': 'Backslash', Tab: 'Tab' };

test('UI shortcuts (pause, help, coach, override, scores, view, camera) are not game keys in Classic', () => {
  for (const k of Object.keys(UI_KEYS)) assert.equal(CLASSIC[k], undefined, `"${k}" is both ${UI_KEYS[k]} and a hunt command`);
});

test('UI shortcuts are not game keys in Modern', () => {
  for (const k of Object.keys(UI_KEYS)) {
    const code = UI_KEY_CODE[k];
    assert.ok(code, `no code known for UI key ${k}`);
    assert.equal(MODERN_DEFAULT[code], undefined, `${code} is both ${UI_KEYS[k]} and ${MODERN_DEFAULT[code]}`);
  }
  for (const code of Object.keys(UI_CODES)) assert.equal(MODERN_DEFAULT[code], undefined, code);
});

test('the cheat keys are single characters outside every hunt command', () => {
  const huntKeys = new Set(Object.values(ACTIONS).concat(['1', '2', '3', '4', 'q']));
  for (const [k, what] of Object.entries(UI_KEYS)) {
    if (what !== 'coach' && what !== 'override') continue;
    assert.equal(k.length, 1);
    assert.ok(!huntKeys.has(k), `${k} is a hunt command`);
  }
});

test('every command execute.c accepts is reachable with the Classic keys', () => {
  // execute.c:99-187 (q is the pause menu here: quitting is a menu choice)
  for (const c of 'hjklHJKLf1g2F3G4567890@oOpPsc') {
    assert.ok(CLASSIC[c], `hunt key ${c} is not mapped`);
    assert.equal(ACTIONS[CLASSIC[c]] === c || /[1-4]/.test(c), true, `${c} maps to ${CLASSIC[c]}`);
  }
});

test('every action has a Modern binding, and no two actions share a key', () => {
  const bound = new Set(Object.values(MODERN_DEFAULT));
  for (const a of Object.keys(ACTIONS)) {
    if (a === 'bomb21') continue; // 441 charges: reachable in Classic ('@'); in Modern via remapping
    assert.ok(bound.has(a), `no Modern key for ${a}`);
  }
  // one code -> one action is guaranteed by the object; mouse buttons too
  assert.deepEqual(Object.values(MOUSE).sort(), ['grenade', 'shot']);
});

test('mouse facing is 4-way with a dead band around the diagonals', () => {
  assert.equal(facingToward(10, 0, null), 'faceRight');
  assert.equal(facingToward(-10, 1, null), 'faceLeft');
  assert.equal(facingToward(0, -10, null), 'faceUp');
  assert.equal(facingToward(1, 10, null), 'faceDown');
  // just past the diagonal but inside the dead band: keep the current facing
  const nearDiag = [Math.cos((45 + 5) * Math.PI / 180), Math.sin((45 + 5) * Math.PI / 180)];
  assert.equal(facingToward(nearDiag[0], nearDiag[1], 'faceRight'), 'faceRight');
  // well past it: turn
  const past = [Math.cos(70 * Math.PI / 180), Math.sin(70 * Math.PI / 180)];
  assert.equal(facingToward(past[0], past[1], 'faceRight'), 'faceDown');
});

test('main.js and input.js route UI keys before game keys, and rebinding refuses UI keys', () => {
  const input = readFileSync(new URL('../src/input.js', import.meta.url), 'utf8');
  assert.match(input, /const ui = UI_KEYS\[e\.key\] \|\| UI_CODES\[e\.code\]/);
  assert.ok(input.indexOf('UI_KEYS[e.key]') < input.indexOf('actionFor(e'), 'UI keys are checked first');
  assert.match(input, /rebind\(code, action\) \{\s*if \(RESERVED\.has\(code\)\)/);
});
