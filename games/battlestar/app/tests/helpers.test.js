// Parser helpers (ADR-008): lines made of known words go to the engine
// verbatim; only lines the original would reject are rewritten, and every
// rewrite says what it did. Strict mode turns all of it off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { assist, correct, tokens, completions } from '../src/ui/helpers.js';
import { Battlestar, VOCABULARY, C } from '../src/engine/battlestar.js';

test('tokens split like getword(): blanks and commas, lower-case', () => {
  assert.deepEqual(tokens('Take Sword,  KILL man'), ['take', 'sword', ',', 'kill', 'man']);
});

test('known lines are passed through byte-for-byte', () => {
  for (const l of ['take sword', 'get all', 'kill man', 'Take Sword', 'a', 'drop amulet, take medallion']) {
    assert.deepEqual(assist(l), { line: l, rewritten: false });
  }
});

test('property: any line of vocabulary words is never rewritten (seeded sample)', () => {
  const words = [...VOCABULARY.keys()];
  let s = 7;
  const rnd = (n) => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s % n; };
  for (let i = 0; i < 500; i++) {
    const n = 1 + rnd(4);
    const line = Array.from({ length: n }, () => words[rnd(words.length)]).join(rnd(5) ? ' ' : ', ');
    assert.equal(assist(line).rewritten, false, line);
  }
});

test('unknown words: aliases, filler and typos are fixed and reported', () => {
  assert.deepEqual(assist('grab sword'), { line: 'take sword', rewritten: true, note: 'grab → take' });
  assert.equal(assist('go ahead').line, 'ahead');
  assert.equal(assist('pick up the sword').line, 'take the sword');
  assert.equal(assist('examine goddess').line, 'look goddess');
  assert.equal(assist('take amulett').line, 'take amulet');
  assert.equal(assist('x').line, 'look');
  assert.match(assist('swrod').note, /swrod → sword/);
});

test('strict mode sends everything verbatim', () => {
  assert.deepEqual(assist('grab sword', { strict: true }), { line: 'grab sword', rewritten: false });
});

test('correct(): unique nearest word only; short or ambiguous words stay unknown', () => {
  assert.equal(correct('swrod'), 'sword');
  assert.equal(correct('medalion'), 'medallion');
  assert.equal(correct('zz'), null);
  assert.equal(correct('qqqqqqqq'), null);
});

test('completion: verbs first, then the words for objects in reach', () => {
  const g = new Battlestar({ seed: 1 });
  g.start();
  assert.ok(completions('inv', g).includes('inven'));
  assert.ok(completions('la', g).includes('launch'));
  g.position = 8; // the walk-in closet holds the clothes
  const objs = completions('take ', g);
  assert.ok(objs.length > 0, 'object words offered for a room with objects');
  for (const w of objs) assert.ok(VOCABULARY.has(w), `${w} is an original word`);
  assert.ok(C.VERB !== undefined);
});
