// The original tokenizer (getcom.c getword) and parse.c rules.

import test from 'node:test';
import assert from 'node:assert/strict';
import { Battlestar, C } from '../src/engine/battlestar.js';
import { runScript } from '../src/engine/run.js';

const words = (line) => {
  const out = [];
  let i = 0;
  while (i !== -1 && out.length < 19) {
    const [w, ni] = Battlestar.getword(line + '\n', i);
    out.push(w);
    i = ni;
  }
  return out;
};

test('getword: lower-cases, splits on blanks and commas, truncates at 14 chars', () => {
  assert.deepEqual(words('Take KNIFE'), ['take', 'knife']);
  assert.deepEqual(words('take knife,laser'), ['take', 'knife', ',', 'laser']);
  assert.deepEqual(words('right ,  back'), ['right', ',', 'back']);
  assert.deepEqual(words('abcdefghijklmnopqrstuvwxyz look'), ['abcdefghijklmn', 'look']);
  // After truncation the rest of the token is skipped up to a blank, commas included.
  assert.deepEqual(words('abcdefghijklmnop,look x'), ['abcdefghijklmn', 'x']);
});

function parsed(line, prev) {
  const g = new Battlestar({ seed: 1 });
  if (prev) {
    g.words = prev.concat(new Array(20 - prev.length).fill(''));
  }
  const w = words(line);
  w.forEach((x, i) => { g.words[i] = x; });
  g.wordcount = w.length;
  g.parse();
  return g;
}

test('parse: adjectives are removed from position 1 on, but not at 0', () => {
  const g = parsed('take the knife');
  assert.equal(g.wordcount, 2);
  assert.deepEqual(g.words.slice(0, 2), ['take', 'knife']);
  assert.equal(g.wordvalue[1], C.KNIFE);
  const h = parsed('the knife');
  assert.equal(h.wordtype[0], C.ADJS); // "the: How's that?" in the original
});

test('parse: consecutive adjectives leave the second one (the original bug)', () => {
  const g = parsed('take the old knife');
  assert.equal(g.wordtype[1], C.ADJS);
});

test('parse: a comma before a verb is not an AND', () => {
  const g = parsed('take knife, drop knife');
  assert.equal(g.wordvalue[2], -1);
  const h = parsed('take knife, laser');
  assert.equal(h.wordvalue[2], C.AND);
});

test('parse: "X and everything" moves EVERYTHING to the front', () => {
  const g = parsed('take knife and all');
  assert.equal(g.wordvalue[1], C.EVERYTHING);
  assert.equal(g.wordvalue[3], C.KNIFE);
});

test('stale words: a bare verb can re-read the previous command\'s object', () => {
  // "kiss girl" then "kiss": words[1] still holds "girl" (the original quirk).
  const g = parsed('kiss', ['kiss', 'girl']);
  assert.equal(g.wordcount, 1);
  assert.equal(g.wordvalue[1], C.NATIVE);
});

test('unknown first word: "<word>: How\'s that?"; blank line: "Please type in something."', () => {
  const { transcript } = runScript(['xyzzy', '   '], { seed: 1 });
  assert.match(transcript, /xyzzy: How's that\?/);
  assert.match(transcript, /Please type in something\./);
});

test('single letters are verbs: "a" goes ahead, "i" is the inventory', () => {
  const { transcript } = runScript(['r', 'a', 'i'], { seed: 1 });
  assert.match(transcript, /executive suites/);
  assert.match(transcript, /This is the maid's utility room\./);
  assert.match(transcript, /You aren't carrying anything\./);
});

test('commas chain commands, but relative exits are only recomputed between turns', () => {
  // "right, right" from 22: both moves use room 22's `right` (16), because
  // whichway() runs at the start of a turn, not between chained commands.
  const { game } = runScript(['right, right'], { seed: 1 });
  assert.equal(game.position, 16);
  assert.equal(game.ourtime, 2);
  assert.equal(game.direction, C.SOUTH, 'but the facing turned right twice: north -> east -> south');
});
