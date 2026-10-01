// Sharpshooter — a port extension (port ADR 003), clearly not in the original.
//
// It plays fair: everything comes from its own screen (remembered walls and
// mirrors, the opponents it can see or remembers) and its own status line
// (ammo, gun heat). What it adds over Otto is planning:
//   * ricochets: for each of the four facings it traces the shot through the
//     mirrors it remembers, flipping each mirror as the shot deflects off it
//     (src/engine/trajectory.js), up to 8 bounces;
//   * leading: an opponent seen one cell away from where it stood last step
//     is assumed to keep walking; the shot is timed against that prediction
//     (shots cover 5 cells per step, a turn costs one step);
//   * splash: when a bank shot ends in a wall next to the target, and ammo
//     allows, it throws a grenade instead of a bullet;
//   * dodging: an opponent lined up and facing it gets a sidestep;
//   * hunting: it walks toward the last place its screen shows an opponent,
//     else toward the stalest part of its map (src/bots/explore.js), and
//     defuses remembered mines for ammo when it runs low.

import * as K from '../engine/constants.js';
import { trajectory } from '../engine/trajectory.js';
import { lookCells } from '../engine/hunt.js';
import { glibcRandom } from '../engine/rng.js';
import { noteSight, exploreStep, route, stepToward, DIRS, passable } from './explore.js';
import { otto } from './otto.js';

const { WIDTH, SPACE, isPlayer } = K;
const OPPONENT = new Set([K.LEFTS, K.RIGHT, K.ABOVE, K.BELOW]);
const TURN_KEY = { [K.LEFTS]: 'H', [K.RIGHT]: 'L', [K.ABOVE]: 'K', [K.BELOW]: 'J' };

export function sharp(g, pp, b) {
  noteSight(g, pp, b);
  const enemies = [];
  const seen = new Set();
  lookCells(g, pp, (y, x) => {
    if (y < 0 || x < 0 || y >= K.HEIGHT || x >= WIDTH) return;
    const i = y * WIDTH + x;
    if (seen.has(i) || (x === pp.x && y === pp.y)) return;
    seen.add(i);
    if (OPPONENT.has(pp.scr[i])) enemies.push({ x, y, face: pp.scr[i] });
  });
  // velocity from last step's sightings (one cell away = walking)
  const prev = b.prev || [];
  for (const e of enemies) {
    const near = prev.filter((p) => Math.abs(p.x - e.x) + Math.abs(p.y - e.y) === 1);
    e.vx = near.length === 1 ? e.x - near[0].x : 0;
    e.vy = near.length === 1 ? e.y - near[0].y : 0;
  }
  b.prev = enemies.map((e) => ({ x: e.x, y: e.y }));

  // 1. a shot worth taking
  if (enemies.length && pp.ncshot <= K.MAXNCSHOT && pp.ammo >= 1) {
    const plan = bestShot(g, pp, enemies);
    if (plan) {
      b.shots = (b.shots || 0) + 1;
      return (plan.face !== pp.face ? TURN_KEY[plan.face] : '') + plan.key;
    }
  }
  // 2. someone lined up and looking this way: sidestep
  const threat = enemies.find((e) => facesMe(pp, e));
  if (threat) {
    const side = sidestep(pp, threat);
    if (side) return side;
  }
  const r = glibcRandom(b.rs);
  // 3. the gun is hot: moving is the only way to cool it (execute.c:309-313)
  // 4. hunt: toward a visible or remembered opponent
  const target = (i) => (OPPONENT.has(pp.scr[i]) ? 1000 : 0);
  const hunt = route(g, pp, (i, d) => (target(i) ? 1000 - d : 0), 60);
  if (hunt && hunt.dist > 1) return stepToward(pp, hunt.dir);
  // 5. low on ammo: go defuse a remembered mine (walk onto it facing it: 2%)
  if (pp.ammo < 12) {
    const m = mineStep(g, pp);
    if (m) return m;
  }
  // 6. explore
  return exploreStep(g, pp, b, r) ?? otto(g, pp, b.brain, b.rs);
}

function facesMe(pp, e) {
  if (e.x === pp.x) return (e.face === K.BELOW && e.y < pp.y) || (e.face === K.ABOVE && e.y > pp.y);
  if (e.y === pp.y) return (e.face === K.RIGHT && e.x < pp.x) || (e.face === K.LEFTS && e.x > pp.x);
  return false;
}

function sidestep(pp, e) {
  const across = e.x === pp.x ? [DIRS[0], DIRS[1]] : [DIRS[2], DIRS[3]];
  for (const D of across) {
    const c = pp.mem[(pp.y + D.dy) * WIDTH + pp.x + D.dx];
    if (c === SPACE) return D.move; // a pure strafe: no turn
  }
  return null;
}

function mineStep(g, pp) {
  for (const D of DIRS) {
    const c = pp.mem[(pp.y + D.dy) * WIDTH + pp.x + D.dx];
    if (c === K.MINE || c === K.GMINE) return stepToward(pp, D); // face it, then step on
  }
  const r = route(g, pp, (i, d) => {
    const y = Math.floor(i / WIDTH);
    const x = i - y * WIDTH;
    for (const D of DIRS) {
      const c = pp.mem[(y + D.dy) * WIDTH + x + D.dx];
      if (c === K.MINE || c === K.GMINE) return 100 - d;
    }
    return 0;
  }, 25);
  return r ? stepToward(pp, r.dir) : null;
}

// What the bot believes is in the way: its remembered map, with opponents
// lifted off (it aims where they will be) but itself and teammates solid.
function terrainFor(pp) {
  return (y, x) => {
    const i = y * WIDTH + x;
    const c = pp.mem[i];
    if (y === pp.y && x === pp.x) return c;
    if (isPlayer(c)) {
      const s = pp.scr[i];
      if (s >= 48 && s <= 57) return c; // a teammate's digit: never shoot through
      return SPACE;
    }
    return c;
  };
}

function bestShot(g, pp, enemies) {
  const terrain = terrainFor(pp);
  let best = null;
  for (const face of K.FACES) {
    const turn = face !== pp.face ? 1 : 0;
    const tr = trajectory(terrain, pp.x, pp.y, face, { maxCells: 160, maxBounces: 8 });
    if (tr.end.kind === 'player') continue; // it would come back into us or a mate
    for (let k = 1; k <= tr.cells.length; k++) {
      const [cx, cy] = tr.cells[k - 1];
      const t = turn + 1 + Math.floor((k - 1) / K.BULSPD);
      for (const e of enemies) {
        if (e.x + e.vx * t === cx && e.y + e.vy * t === cy) {
          const bounces = tr.bounces.filter((bb) => tr.cells.findIndex(([x, y]) => x === bb.x && y === bb.y) < k).length;
          const cost = t * 10 + bounces;
          if (!best || cost < best.cost) best = { face, key: 'f', cost, bounces };
        }
      }
    }
    // splash: the shot ends in a wall right next to where the target will be
    if (tr.end.kind === 'wall' && pp.ammo >= K.GRENREQ + 6) {
      const k = tr.cells.length;
      const t = turn + 1 + Math.floor((k - 1) / K.BULSPD);
      for (const e of enemies) {
        const px = e.x + e.vx * t;
        const py = e.y + e.vy * t;
        const near = Math.max(Math.abs(px - tr.end.x), Math.abs(py - tr.end.y)) <= 1;
        const self = Math.max(Math.abs(pp.x - tr.end.x), Math.abs(pp.y - tr.end.y)) <= 1;
        if (near && !self) {
          const cost = t * 10 + tr.bounces.length + 5;
          if (!best || cost < best.cost) best = { face, key: 'g', cost, bounces: tr.bounces.length };
        }
      }
    }
  }
  return best;
}

void passable;
