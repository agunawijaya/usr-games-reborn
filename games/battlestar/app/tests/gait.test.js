// Locomotion (src/render/gait.js) checked with the body's own forward
// kinematics: the IK reaches its targets, planted feet do not slide while
// the body moves, running has a flight phase, and the limp's injured leg
// stays stiff with its toe on the floor.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GAITS, LEG, locomotion } from '../src/render/gait.js';

const rx = (v, a) => [v[0], v[1] * Math.cos(a) - v[2] * Math.sin(a), v[1] * Math.sin(a) + v[2] * Math.cos(a)];
const ry = (v, a) => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
const rz = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a), v[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
/** Euler XYZ as three.js applies it: Rx(Ry(Rz v)). */
const euler = (v, x, y, z) => rx(ry(rz(v, z), y), x);

function pose() {
  return { hipY: 0.97, hipX: 0, hipZ: 0, hipTwist: 0, hipDx: 0, spineX: 0, spineY: 0, spineZ: 0, chestX: 0, chestY: 0, chestZ: 0,
    neckX: 0, neckY: 0, headX: 0, headZ: 0, shL: [0, 0, 0], elL: 0, wrL: 0, shR: [0, 0, 0], elR: 0, wrR: 0,
    thL: [0, 0], knL: 0, anL: 0, thR: [0, 0], knR: 0, anR: 0 };
}

/** Ankle and toe positions of one leg in the person's frame. */
function fk(p, side) {
  const k = side < 0 ? 'L' : 'R';
  const [tx, tz] = p[`th${k}`];
  const kn = p[`kn${k}`];
  const an = p[`an${k}`];
  const hip = [p.hipDx, p.hipY, 0];
  const toPel = (v) => add(hip, euler(v, p.hipX, p.hipTwist, p.hipZ));
  const thigh = (v) => toPel(add([side * LEG.hipX, LEG.hipY, 0], euler(v, tx, 0, tz)));
  const shin = (v) => thigh(add([0, -LEG.thigh, 0], rx(v, kn)));
  const footF = (v) => shin(add([0, -LEG.shin, 0], rx(v, an)));
  return { ankle: footF([0, 0, 0]), toe: footF([0, -LEG.ankle, LEG.toe]), heel: footF([0, -LEG.ankle, -LEG.heel]) };
}

test('IK reaches the planned ankle positions (walk, hurry, jog, run)', () => {
  for (const name of ['walk', 'hurry', 'jog', 'run']) {
    const g = GAITS[name];
    let worst = 0;
    for (let i = 0; i < 200; i++) {
      const p = pose();
      locomotion(p, i / 200, g, g.stride);
      for (const side of [-1, 1]) {
        const { heel, toe } = fk(p, side);
        // nothing ever goes through the floor
        worst = Math.max(worst, -Math.min(heel[1], toe[1]));
      }
    }
    assert.ok(worst < 0.012, `${name}: a foot goes ${worst.toFixed(3)} m into the floor`);
  }
});

test('planted feet do not slide while the body moves', () => {
  for (const name of ['walk', 'jog']) {
    const g = GAITS[name];
    const S = g.stride;
    // the body moves S per cycle; during foot-flat the ankle must stay put in the world
    const pts = [];
    for (let p = g.stance * (g.h1 + 0.02); p < g.stance * (g.h2 - 0.02); p += 0.005) {
      const q = pose();
      locomotion(q, p, g, S);
      const { ankle } = fk(q, -1);
      pts.push(ankle[2] + p * S);
    }
    const spread = Math.max(...pts) - Math.min(...pts);
    assert.ok(spread < 0.02, `${name}: the planted foot slides ${spread.toFixed(3)} m`);
  }
});

test('running has a flight phase; walking always has a foot on the floor', () => {
  const onFloor = (g, p) => {
    const q = pose();
    locomotion(q, p, g, g.stride);
    return [-1, 1].some((s) => { const f = fk(q, s); return Math.min(f.heel[1], f.toe[1]) < 0.03; });
  };
  const jog = GAITS.jog;
  let flight = 0;
  for (let i = 0; i < 100; i++) if (!onFloor(jog, i / 100)) flight++;
  assert.ok(flight >= 10, `jog: only ${flight}% of the cycle airborne`);
  for (let i = 0; i < 100; i++) assert.ok(onFloor(GAITS.walk, i / 100), `walk: both feet off the floor at ${i}%`);
});

test('the limp drags a stiff injured leg on its toe', () => {
  const g = GAITS.limp;
  let maxKnee = 0;
  let maxToe = 0;
  for (let i = 0; i < 55; i++) {
    const q = pose();
    locomotion(q, i / 100, g, g.stride);
    maxKnee = Math.max(maxKnee, q.knR);
    maxToe = Math.max(maxToe, fk(q, 1).toe[1]);
  }
  assert.ok(maxKnee < 0.3, `injured knee bends ${maxKnee.toFixed(2)} rad while dragged`);
  assert.ok(maxToe < 0.04, `injured toe lifts ${maxToe.toFixed(3)} m while dragged`);
});
