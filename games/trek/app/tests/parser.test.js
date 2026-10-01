// trek/fancy-web parser tests

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseCommand, PARSE } from '../src/parser.js';

test('parseCommand: phaser 500', () => {
  const r = parseCommand('phaser 500');
  assert.equal(r.status, PARSE.OK);
  assert.equal(r.cmd.action, 'phaser');
  assert.equal(r.cmd.energy, 500);
});

test('parseCommand: p 250 (short form)', () => {
  const r = parseCommand('p 250');
  assert.equal(r.status, PARSE.OK);
  assert.equal(r.cmd.energy, 250);
});

test('parseCommand: torpedo 3.5', () => {
  const r = parseCommand('torpedo 3.5');
  assert.equal(r.status, PARSE.OK);
  assert.equal(r.cmd.action, 'torpedo');
  assert.equal(r.cmd.bearing, 3.5);
});

test('parseCommand: torpedo out of range → error', () => {
  const r = parseCommand('torpedo 15');
  assert.equal(r.status, PARSE.ERROR);
});

test('parseCommand: move 3 4', () => {
  const r = parseCommand('move 3 4');
  assert.equal(r.status, PARSE.OK);
  assert.equal(r.cmd.action, 'move');
  assert.equal(r.cmd.course, 3);
  assert.equal(r.cmd.warp, 4);
});

test('parseCommand: srscan / lrscan aliases', () => {
  assert.equal(parseCommand('srscan').cmd.action, 'srscan');
  assert.equal(parseCommand('sr').cmd.action, 'srscan');
  assert.equal(parseCommand('lrscan').cmd.action, 'lrscan');
  assert.equal(parseCommand('lr').cmd.action, 'lrscan');
});

test('parseCommand: shields up/down/transfer', () => {
  assert.equal(parseCommand('shields up').cmd.action, 'shieldUp');
  assert.equal(parseCommand('shields down').cmd.action, 'shieldDown');
  const t = parseCommand('shields 300');
  assert.equal(t.cmd.action, 'shieldTransfer');
  assert.equal(t.cmd.amount, 300);
});

test('parseCommand: dock, damages, computer', () => {
  assert.equal(parseCommand('dock').cmd.action, 'dock');
  assert.equal(parseCommand('damages').cmd.action, 'damages');
  assert.equal(parseCommand('computer').cmd.action, 'computer');
});

test('parseCommand: help returns command list', () => {
  const r = parseCommand('help');
  assert.equal(r.status, PARSE.OK);
  assert.equal(r.cmd.action, 'help');
  assert.ok(r.cmd.text.includes('phaser'));
});

test('parseCommand: unknown verb → error', () => {
  const r = parseCommand('foobar');
  assert.equal(r.status, PARSE.ERROR);
});

test('parseCommand: quit', () => {
  const r = parseCommand('quit');
  assert.equal(r.cmd.action, 'quit');
});

test('parseCommand: case-insensitive', () => {
  assert.equal(parseCommand('PHASER 500').cmd.action, 'phaser');
  assert.equal(parseCommand('Torpedo 3').cmd.action, 'torpedo');
});
