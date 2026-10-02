// The tutorial: four short lessons in a training hall of our own design.
// Walk; aim and fire at a training target; bank a shot off a mirror into a
// pocket the target cannot be reached in any other way; tag a slow rookie.
// The hall is a hand-made maze for the engine (loadMaze); the target is a
// player that never types a key. Pure, no DOM.

import * as H from '../engine/hunt.js';
import * as K from '../engine/constants.js';
import { addBot } from '../bots/index.js';

const W = K.WIDTH;
export const TARGET = 'target';
const ROOKIE = 'rookie';
const STEPS_TO_WALK = 8;

// The training hall, 51 x 23. The pocket in the middle opens only through
// the mirror at its foot; the pillars on the right are cover for lesson four.
function trainingHall() {
  const rows = [];
  for (let y = 0; y < K.HEIGHT; y++) {
    const row = [];
    for (let x = 0; x < W; x++) {
      const corner = (y === 0 || y === K.HEIGHT - 1) && (x === 0 || x === W - 1);
      row.push(corner ? '+' : y === 0 || y === K.HEIGHT - 1 ? '-' : x === 0 || x === W - 1 ? '|' : ' ');
    }
    rows.push(row);
  }
  const put = (y, x, ch) => { rows[y][x] = ch; };
  put(4, 24, '+'); put(4, 25, '-'); put(4, 26, '+');
  for (let y = 5; y <= 16; y++) { put(y, 24, '|'); put(y, 26, '|'); }
  put(17, 25, '/');
  for (const [y, x] of [[6, 8], [6, 9], [16, 8], [16, 9], [6, 40], [6, 41], [16, 40], [16, 41]]) put(y, x, '-');
  for (let y = 10; y <= 12; y++) put(y, 34, '|');
  return rows.map((row) => row.join(''));
}

// A new entry drops two mines (answer.c); the hall starts clear of them.
function sweepMines(g) {
  for (let i = 0; i < g.maze.length; i++) {
    if (g.maze[i] === K.MINE || g.maze[i] === K.GMINE) g.maze[i] = g.orig[i];
  }
}

function place(g, pp, y, x, face) {
  g.maze[pp.y * W + pp.x] = pp.over;
  pp.over = g.maze[y * W + x];
  pp.x = x;
  pp.y = y;
  pp.face = face;
  g.maze[y * W + x] = face;
}

export function createTraining(name, enterStatus = K.Q_CLOAK) {
  const g = H.newGame({ seed: 7 });
  H.loadMaze(g, trainingHall());
  g.autorejoin = true;
  g.rejoinDelay = 20;
  g.mode = 'ffa';
  g.botSpeed = 'slow';
  g.humans = [name];
  const me = H.connect(g, name, ' ', enterStatus);
  me.enter = enterStatus;
  me.flying = -1; // lessons start on the floor, whatever the entry choice
  sweepMines(g);
  return g;
}

const START = [
  { y: 11, x: 6, face: K.RIGHT },
  { y: 11, x: 10, face: K.ABOVE },
  { y: 17, x: 12, face: K.ABOVE },
  { y: 11, x: 6, face: K.RIGHT },
];

/** Puts the player at the lesson's start and sets out what it needs. */
export function setUpLesson(g, name, index) {
  const me = H.findPlayer(g, name);
  if (me) {
    const at = START[index];
    place(g, me, at.y, at.x, at.face);
    me.damage = 0;
  }
  if (index === 1 || index === 2) {
    const target = H.findPlayer(g, TARGET) ?? H.connect(g, TARGET, ' ', K.Q_SCAN);
    target.flying = -1;
    if (index === 1) place(g, target, 11, 22, K.LEFTS);
    else place(g, target, 5, 25, K.BELOW);
    // already worn down, so one shot tags it; no ammo left to spill as slime when it goes
    target.damage = target.damcap;
    target.ammo = 0;
  }
  if (index === 3 && !H.findPlayer(g, ROOKIE)) {
    H.connect(g, ROOKIE, ' ', K.Q_CLOAK);
    addBot(g, ROOKIE, 'novice', 31);
  }
  sweepMines(g);
}

/** progress: { steps } kept by the caller between steps. */
export function lessonDone(g, name, index, events, progress) {
  const me = H.findPlayer(g, name);
  switch (index) {
    case 0:
      progress.steps += events.filter((e) => e.t === 'move' && me && e.id === me.id).length;
      return progress.steps >= STEPS_TO_WALK;
    case 1:
    case 2:
      return events.some((e) => e.t === 'death' && e.name === TARGET);
    default:
      return (g.scores.find((row) => row.name === name)?.gkills ?? 0) >= 1;
  }
}

export const LESSON_COUNT = START.length;
export const showsCoach = (index) => index === 2;

const FACE_RIGHT = { modern: '→ (or point the mouse at it)', classic: 'L' };
const FIRE = { modern: 'Space', classic: 'f', easy: 'Space' };

/** The lesson's title and instruction, worded for the control scheme. */
export function lessonCopy(index, scheme) {
  const walkKeys = { modern: 'W A S D', classic: 'h j k l', easy: 'the arrow keys or W A S D', aim: 'the arrow keys or W A S D' }[scheme];
  const turnNote = scheme === 'easy' ? 'You turn as you walk.' : scheme === 'aim' ? 'Walking never changes where you aim.' : 'Walking never turns you: you keep facing the same way.';
  const aimRight = scheme === 'aim'
    ? 'hold Shift and press → to fire that way'
    : scheme === 'easy'
      ? `step right once to turn toward it, then fire with ${FIRE.easy}`
      : `face right with ${FACE_RIGHT[scheme]}, then fire with ${FIRE[scheme]}`;
  switch (index) {
    case 0:
      return { title: 'Walk', text: `Walk with ${walkKeys}. ${turnNote} Take ${STEPS_TO_WALK} steps.` };
    case 1:
      return { title: 'Aim and fire', text: `A training target waits to your right: ${aimRight}.` };
    case 2:
      return { title: 'Bank shot', text: `The target hides in a pocket behind the mirror. Fire into the mirror and the shot turns the corner: ${aimRight}. The Coach line shows the path. Every hit flips the mirror, so if a shot goes astray, fire again.` };
    default:
      return { title: 'A real rival', text: 'A rookie roams the hall, slowly. Find it and tag it once. Being hit out is fine here; turn Fog off in Settings if you lose it.' };
  }
}
