// Our own names: no real airline, call sign or airport in what the game shows or says, and no
// exception for this game in the collection's trademark guard.
// Run: node --test tests/names.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CARRIERS, newCallsign, radioName } from '../src/carriers.js';
import { PLAYFIELDS } from '../src/playfields.js';

const APP = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const REPO = join(APP, '..', '..', '..');

/** The airlines, call signs and airport the game carried before polish P1-C. */
const REAL = [
  'United', 'Delta', 'American', 'Southwest', 'FedEx', 'JetBlue', 'Air ?Canada', 'Speedbird', 'Lufthansa',
  'Air ?France', 'KLM', 'Qantas', 'All ?Nippon', 'Japan ?Air', 'Cathay',
  'UAL', 'DAL', 'AAL', 'SWA', 'FDX', 'JBU', 'ACA', 'BAW', 'DLH', 'AFR', 'QFA', 'ANA', 'JAL', 'CPA',
  'KJFK', 'JFK', 'KTNG',
];
const PATTERN = new RegExp(`\\b(?:${REAL.join('|')})\\b`);

function shippedFiles() {
  const src = readdirSync(join(APP, 'src'))
    .filter((name) => name.endsWith('.js'))
    .map((name) => join(APP, 'src', name));
  return [...src, join(APP, 'index.html'), join(APP, '..', 'manifest.json')];
}

test('no real airline, call sign or airport anywhere the game shows or speaks', () => {
  for (const file of shippedFiles()) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => assert.doesNotMatch(line, PATTERN, `${file}:${i + 1}`));
  }
});

test('the carriers are the game’s own: three-letter codes, radio names, and call signs from them', () => {
  for (const carrier of CARRIERS) {
    assert.match(carrier.code, /^[A-Z]{3}$/);
    assert.doesNotMatch(`${carrier.code} ${carrier.radio}`, PATTERN);
  }
  assert.equal(new Set(CARRIERS.map((c) => c.code)).size, CARRIERS.length);
  let draw = 0;
  const callsign = newCallsign(() => [0.2, 0.5][draw++ % 2]);
  assert.match(callsign, /^[A-Z]{3}\d{1,4}$/);
  assert.equal(radioName(callsign), CARRIERS[3].radio);
});

test('every sector code starts with Q, which no ICAO region uses for its airports', () => {
  for (const field of Object.values(PLAYFIELDS)) assert.match(field.displayName, /^Q[A-Z]{3} /);
});

test('the trademark guard keeps no exception for this game', () => {
  const config = JSON.parse(readFileSync(join(REPO, 'scripts', 'guards.config.json'), 'utf8'));
  assert.deepEqual(config.words.trademarkAllow.filter((entry) => entry.path.includes('atc-classic')), []);
});
