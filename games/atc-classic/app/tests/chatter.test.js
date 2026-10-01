// atc/fancy-web chatter tests
// Run: node --test tests/chatter.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  speakCallsign,
  chatterOnSpawn,
  chatterOnCommand,
  chatterOnLand,
  chatterOnExit,
  chatterOnLoss,
  chatterOnFuelWarn,
  SPEAKER,
} from '../src/chatter.js';
import { DIR, FEATURE, STATUS } from '../src/engine.js';

test('speakCallsign expands airline + digits', () => {
  assert.equal(speakCallsign('UAL42'), 'United four two');
  assert.equal(speakCallsign('DAL9'), 'Delta niner');
  assert.equal(speakCallsign('BAW100'), 'Speedbird one zero zero');
});

test('speakCallsign uses niner for 9', () => {
  const s = speakCallsign('UAL99');
  assert.ok(s.includes('niner niner'));
});

test('chatterOnSpawn: PILOT speaker, includes callsign + altitude', () => {
  const line = chatterOnSpawn('UAL42', 7, 'C', 'Easy');
  assert.equal(line.speaker, SPEAKER.PILOT);
  assert.ok(line.subtitle.includes('UAL42'));
  assert.ok(line.subtitle.includes('level 7000'));
  assert.ok(line.tts.includes('United four two'));
  assert.ok(line.tts.includes('seven thousand'));
});

test('chatterOnCommand altitude: YOU speaker, correct verb', () => {
  const plane = { altitude: 5, dir: DIR.N };
  const climb = chatterOnCommand('DAL10', { action: 'altitude', arg: 7 }, plane);
  const descend = chatterOnCommand('DAL10', { action: 'altitude', arg: 3 }, plane);
  const level = chatterOnCommand('DAL10', { action: 'altitude', arg: 5 }, plane);
  assert.equal(climb.speaker, SPEAKER.YOU);
  assert.ok(climb.subtitle.includes('climb and maintain'));
  assert.ok(descend.subtitle.includes('descend and maintain'));
  assert.ok(level.subtitle.includes('maintain 5000'));
});

test('chatterOnCommand turn: heading in tts uses phonetic digits', () => {
  const plane = { altitude: 5, dir: DIR.N };
  const line = chatterOnCommand('BAW7', { action: 'turn', arg: DIR.E }, plane);
  assert.ok(line.tts.includes('zero niner zero'));
  assert.ok(line.subtitle.includes('090'));
});

test('chatterOnCommand admin actions return null', () => {
  const plane = { altitude: 5, dir: DIR.N };
  assert.equal(chatterOnCommand('X', { action: 'mark' }, plane), null);
  assert.equal(chatterOnCommand('X', { action: 'ignore' }, plane), null);
  assert.equal(chatterOnCommand('X', { action: 'unmark' }, plane), null);
});

test('chatterOnLand: controller farewells', () => {
  const line = chatterOnLand('AFR12', '0');
  assert.equal(line.speaker, SPEAKER.YOU);
  assert.ok(line.subtitle.toLowerCase().includes('welcome'));
});

test('chatterOnExit: hand-off to center', () => {
  const line = chatterOnExit('UAL5', '2');
  assert.equal(line.speaker, SPEAKER.YOU);
  assert.ok(line.subtitle.toLowerCase().includes('contact center'));
});

test('chatterOnLoss: MAYDAY from pilot', () => {
  const line = chatterOnLoss('UAL42', 'ran out of fuel');
  assert.equal(line.speaker, SPEAKER.PILOT);
  assert.ok(line.subtitle.includes('MAYDAY'));
  assert.ok(line.subtitle.includes('UAL42'));
  assert.ok(line.subtitle.toLowerCase().includes('fuel'));
});

test('chatterOnFuelWarn: PILOT declares minimum fuel', () => {
  const line = chatterOnFuelWarn('AAL13');
  assert.equal(line.speaker, SPEAKER.PILOT);
  assert.ok(line.subtitle.toLowerCase().includes('minimum fuel'));
});
