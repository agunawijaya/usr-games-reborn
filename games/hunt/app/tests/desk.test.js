// The collection's additions around the port: the career, match goals, bot
// speed, the Easy and Aim key schemes, and the tutorial's training hall.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../src/engine/hunt.js';
import * as K from '../src/engine/constants.js';
import { createMatch, tick } from '../src/engine/match.js';
import { runBots } from '../src/bots/index.js';
import {
  MATCHES, MAX_STARS, emptyCareer, isUnlocked, matchAfter, nextMatch, rankOf, recordResult, starsFor, starsOf, winsOf,
} from '../src/desk/career.js';
import { goalOutcome, matchSummary } from '../src/desk/goal.js';
import { LESSON_COUNT, TARGET, createTraining, lessonDone, setUpLesson } from '../src/desk/tutorial.js';
import { actionFor, facingAfter, keysFor } from '../src/keymap.js';
import { openArena, put, run } from './lib/arena.js';

test('career: ten matches, each opening once the one before is won', () => {
  assert.equal(MATCHES.length, 10);
  assert.equal(MAX_STARS, 30);
  assert.equal(new Set(MATCHES.map((m) => m.id)).size, 10);
  let career = emptyCareer();
  assert.equal(nextMatch(career).id, 'first-light');
  assert.equal(isUnlocked(career, 1), false);
  career = recordResult(career, 'first-light', 1).career;
  assert.equal(isUnlocked(career, 1), true);
  assert.equal(matchAfter(career, 'first-light').id, 'two-to-chase');
  assert.equal(nextMatch(career).id, 'two-to-chase');
});

test('career: stars by times hit out; a replay never lowers a best; ranks by matches won', () => {
  assert.deepEqual([0, 1, 2].map((hits) => starsFor('won', hits)), [3, 2, 1]);
  assert.equal(starsFor('lost', 0), 0);
  let career = emptyCareer();
  career = recordResult(career, 'first-light', 2).career;
  const replay = recordResult(career, 'first-light', 1);
  assert.equal(replay.newBest, false);
  assert.equal(replay.career.best['first-light'], 2);
  assert.equal(rankOf(career).title, 'Cadet');
  const second = recordResult(career, 'two-to-chase', 3);
  assert.equal(second.promotion.title, 'Runner');
  assert.equal(winsOf(second.career), 2);
  assert.equal(starsOf(second.career), 5);
});

test('goal: won at the goal\'s tags, lost at its hit-outs, never by rivals tagging each other', () => {
  const g = openArena();
  put(g, 'you', 11, 10, '>');
  put(g, 'otto', 11, 30, '<');
  const goal = { tags: 3, lives: 3 };
  const mine = () => g.scores.find((row) => row.name === 'you');
  const theirs = () => g.scores.find((row) => row.name === 'otto');
  assert.equal(goalOutcome(g, 'you', goal), null);
  theirs().gkills = 9;
  assert.equal(goalOutcome(g, 'you', goal), null);
  mine().deaths = 3;
  assert.equal(goalOutcome(g, 'you', goal), 'lost');
  mine().deaths = 2;
  mine().gkills = 3;
  assert.equal(goalOutcome(g, 'you', goal), 'won');
  assert.deepEqual(matchSummary(g, 'you'), { tags: 3, hitOut: 2, entries: mine().entries });
  assert.equal(goalOutcome(g, 'you', null), null);
});

test('bot speed: Medium and Slow bots act on two and one steps in three; Fast on every one', () => {
  const movesIn = (botSpeed) => {
    const g = createMatch({ seed: 5, arena: 'ricochet', roster: ['sharp'], human: null, botSpeed });
    let acted = 0;
    for (let i = 0; i < 300; i++) {
      const events = tick(g);
      acted += events.filter((e) => e.t === 'move' || e.t === 'turn' || e.t === 'fire').length;
    }
    return acted;
  };
  const fast = movesIn('fast');
  const medium = movesIn('medium');
  const slow = movesIn('slow');
  assert.ok(fast > medium && medium > slow, `${fast} > ${medium} > ${slow}`);
  assert.ok(slow <= fast / 2.5, `slow ${slow} is about a third of fast ${fast}`);
});

test('Fast is the daemon as it was, and bot speed never slows a human seat', () => {
  const fast = createMatch({ seed: 3, arena: 'classic', bots: 3, difficulty: 'otto', human: null, botSpeed: 'fast' });
  const daemon = createMatch({ seed: 3, arena: 'classic', bots: 3, difficulty: 'otto', human: null });
  for (let i = 0; i < 200; i++) { tick(fast); H.step(daemon, runBots); }
  assert.equal(H.snapshot(fast), H.snapshot(daemon));

  const g = createMatch({ seed: 4, arena: 'ricochet', bots: 1, difficulty: 'novice', human: 'you', botSpeed: 'slow' });
  const me = H.findPlayer(g, 'you');
  me.flying = -1;
  H.key(g, me, 'HHH');
  for (let i = 0; i < 3; i++) tick(g);
  assert.equal(me.q.length, 0, 'the human used every step');
});

test('keys: Easy walks by turning first; under Aim the arrows walk, Shift fires that way, Alt throws a grenade', () => {
  assert.deepEqual(keysFor('goLeft', 'faceRight'), ['H', 'h']);
  assert.deepEqual(keysFor('goLeft', 'faceLeft'), ['h']);
  assert.equal(actionFor({ code: 'ArrowUp' }, 'easy'), 'goUp');
  assert.equal(actionFor({ code: 'ArrowUp' }, 'aim'), 'moveUp');
  assert.equal(actionFor({ code: 'KeyW' }, 'aim'), 'moveUp');
  assert.equal(actionFor({ code: 'ArrowUp', shiftKey: true }, 'aim'), 'shotUp');
  assert.equal(actionFor({ code: 'ArrowUp', altKey: true }, 'aim'), 'grenadeUp');
  assert.equal(actionFor({ code: 'Space' }, 'aim'), 'shot');
  assert.equal(actionFor({ code: 'KeyR' }, 'aim'), 'satchel');
  assert.deepEqual(keysFor('shotDown', 'faceUp'), ['J', 'f']);
  assert.deepEqual(keysFor('grenadeUp', 'faceUp'), ['g']);
  // a turn already waiting in the queue counts
  assert.equal(facingAfter('faceUp', ['L'.charCodeAt(0), 'f'.charCodeAt(0)]), 'faceRight');
  assert.equal(actionFor({ code: 'Period' }, 'modern'), 'wait');
  assert.equal(actionFor({ key: '.' }, 'classic'), 'wait');
});

// A shot misses 5 times in 100 (shots.c, "Zing!"); these seeds are ones where it does not.
test('tutorial: one shot to the right tags the target', () => {
  const g = createTraining('you');
  setUpLesson(g, 'you', 1);
  H.key(g, H.findPlayer(g, 'you'), 'Lf');
  let done = false;
  for (let i = 0; i < 12 && !done; i++) done = lessonDone(g, 'you', 1, tick(g), {});
  assert.ok(done);
});

test('tutorial: the mirror is the only way into the pocket, and a shot into it turns up the pocket', () => {
  const g = createTraining('you');
  setUpLesson(g, 'you', 2);
  const target = H.findPlayer(g, TARGET);
  assert.deepEqual([target.x, target.y], [25, 5]);
  for (let y = 5; y <= 16; y++) {
    assert.ok(K.isWallChar(g.maze[y * K.WIDTH + 24]) && K.isWallChar(g.maze[y * K.WIDTH + 26]), `pocket walls at row ${y}`);
  }
  assert.equal(g.maze[17 * K.WIDTH + 25], K.WALL4);
  H.key(g, H.findPlayer(g, 'you'), 'Lf');
  let done = false;
  let bounced = false;
  for (let i = 0; i < 12 && !done; i++) {
    const events = tick(g);
    bounced ||= events.some((e) => e.t === 'bounce');
    assert.ok(!events.some((e) => e.t === 'splat'), 'the target spills no slime');
    done = lessonDone(g, 'you', 2, events, {});
  }
  assert.ok(bounced && done);
});

test('tutorial: walking counts steps; the last lesson wants one tag; mines are swept', () => {
  const g = createTraining('you');
  setUpLesson(g, 'you', 0);
  const progress = { steps: 0 };
  const me = H.findPlayer(g, 'you');
  H.key(g, me, 'lll');
  let done = false;
  for (let i = 0; i < 3; i++) done = lessonDone(g, 'you', 0, tick(g), progress);
  assert.equal(progress.steps, 3);
  assert.equal(done, false);
  setUpLesson(g, 'you', 3);
  assert.ok(H.findPlayer(g, 'rookie'));
  assert.ok(!g.maze.some((c) => c === K.MINE || c === K.GMINE));
  g.scores.find((row) => row.name === 'you').gkills = 1;
  assert.ok(lessonDone(g, 'you', 3, [], progress));
  assert.equal(LESSON_COUNT, 4);
  void run;
});
