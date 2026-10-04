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

test('speakCallsign expands the carrier’s radio name + digits', () => {
  assert.equal(speakCallsign('HBM42'), 'Hornbeam four two');
  assert.equal(speakCallsign('QLW9'), 'Quailwood niner');
  assert.equal(speakCallsign('STW100'), 'Stackwind one zero zero');
});

test('speakCallsign uses niner for 9', () => {
  const s = speakCallsign('HBM99');
  assert.ok(s.includes('niner niner'));
});

test('chatterOnSpawn: PILOT speaker, includes callsign + altitude', () => {
  const line = chatterOnSpawn('HBM42', 7, 'C', 'Easy');
  assert.equal(line.speaker, SPEAKER.PILOT);
  assert.ok(line.subtitle.includes('HBM42'));
  assert.ok(line.subtitle.includes('level 7000'));
  assert.ok(line.tts.includes('Hornbeam four two'));
  assert.ok(line.tts.includes('seven thousand'));
});

test('chatterOnCommand altitude: YOU speaker, correct verb', () => {
  const plane = { altitude: 5, dir: DIR.N };
  const climb = chatterOnCommand('QLW10', { action: 'altitude', arg: 7 }, plane);
  const descend = chatterOnCommand('QLW10', { action: 'altitude', arg: 3 }, plane);
  const level = chatterOnCommand('QLW10', { action: 'altitude', arg: 5 }, plane);
  assert.equal(climb.speaker, SPEAKER.YOU);
  assert.ok(climb.subtitle.includes('climb and maintain'));
  assert.ok(descend.subtitle.includes('descend and maintain'));
  assert.ok(level.subtitle.includes('maintain 5000'));
});

test('chatterOnCommand turn: heading in tts uses phonetic digits', () => {
  const plane = { altitude: 5, dir: DIR.N };
  const line = chatterOnCommand('STW7', { action: 'turn', arg: DIR.E }, plane);
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
  const line = chatterOnLand('ELW12', '0');
  assert.equal(line.speaker, SPEAKER.YOU);
  assert.ok(line.subtitle.toLowerCase().includes('welcome'));
});

test('chatterOnExit: hand-off to center', () => {
  const line = chatterOnExit('GYF5', '2');
  assert.equal(line.speaker, SPEAKER.YOU);
  assert.ok(line.subtitle.toLowerCase().includes('contact center'));
});

test('chatterOnLoss: the controller says what happened, calmly', () => {
  const line = chatterOnLoss('HBM42', 'fuel exhausted, diverted');
  assert.equal(line.speaker, SPEAKER.YOU);
  assert.equal(line.subtitle, 'HBM42, fuel exhausted, diverted. All stations, stand by.');
  assert.ok(line.tts.startsWith('Hornbeam four two, fuel exhausted'));
});

test('chatterOnFuelWarn: PILOT declares minimum fuel', () => {
  const line = chatterOnFuelWarn('CPW13');
  assert.equal(line.speaker, SPEAKER.PILOT);
  assert.ok(line.subtitle.toLowerCase().includes('minimum fuel'));
});
