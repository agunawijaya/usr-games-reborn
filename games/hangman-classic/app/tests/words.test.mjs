// The ciphers behind the five doors: every one a common word that SCOWL and ENABLE both accept
// (the collection's agreed list, packages/words), three to twelve letters, never repeated, and
// each with the clue the room shows when the cipher is lost.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { uncommonReason } from '@usr-games/words';

const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ROOMS = ['pirate', 'lab', 'temple', 'crypt', 'void'];
const WORDS_PER_ROOM = 40;

/** The `{ word, clue }` entries of one room's `words: [...]` list in the page's THEMES. */
function roomWords(room) {
  const start = page.indexOf(`    ${room}: {`);
  assert.ok(start > 0, `the page has a ${room} room`);
  const listStart = page.indexOf('words: [', start);
  const listEnd = page.indexOf('],', listStart);
  const list = page.slice(listStart, listEnd);
  return [...list.matchAll(/\{ word: '([^']*)',\s*clue: '((?:[^'\\]|\\.)*)' \}/g)].map(
    ([, word, clue]) => ({ word, clue }),
  );
}

const rooms = Object.fromEntries(ROOMS.map((room) => [room, roomWords(room)]));

test('every room has its forty ciphers, each with a clue', () => {
  for (const room of ROOMS) {
    assert.equal(rooms[room].length, WORDS_PER_ROOM, `${room} has ${WORDS_PER_ROOM} ciphers`);
    for (const { word, clue } of rooms[room]) assert.ok(clue.trim().length > 8, `${word} has a clue`);
  }
});

test('ciphers are capital letters, three to twelve of them', () => {
  const misshapen = ROOMS.flatMap((room) => rooms[room].map(({ word }) => word)).filter(
    (word) => !/^[A-Z]{3,12}$/.test(word),
  );
  assert.deepEqual(misshapen, []);
});

test('every cipher is a common word that SCOWL and ENABLE both accept', () => {
  const outside = ROOMS.flatMap((room) =>
    rooms[room]
      .map(({ word }) => [word, uncommonReason(word.toLowerCase())])
      .filter(([, reason]) => reason !== null)
      .map(([word, reason]) => `${room} ${word}: ${reason}`),
  );
  assert.deepEqual(outside, []);
});

test('no cipher appears twice, in one room or across rooms', () => {
  const seen = new Map();
  const repeats = [];
  for (const room of ROOMS) {
    for (const { word } of rooms[room]) {
      if (seen.has(word)) repeats.push(`${word} (${seen.get(word)}, ${room})`);
      else seen.set(word, room);
    }
  }
  assert.deepEqual(repeats, []);
});
