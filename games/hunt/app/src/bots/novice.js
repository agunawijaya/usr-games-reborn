// Novice — a port extension (port ADR 003), clearly not in the original.
//
// A beginner who plays fair and slowly:
//   * reacts 3-6 steps late to an opponent it has seen, and hesitates a
//     little between moves;
//   * shoots only at an opponent straight down its line of sight, and only
//     half the time it notices one (the other half it just turns);
//   * rarely uses grenades: one throw in ten, never slime or bombs;
//   * explores with src/bots/explore.js (Otto's right-hand walk circles in
//     braided arenas), facing the way it walks.
// Everything it knows comes from its own screen.

import * as K from '../engine/constants.js';
import { glibcRandom } from '../engine/rng.js';
import { noteSight, exploreStep } from './explore.js';
import { otto } from './otto.js';

const TURN = { [K.LEFTS]: 'H', [K.RIGHT]: 'L', [K.ABOVE]: 'K', [K.BELOW]: 'J' };

// the nearest visible opponent straight along a row or column, with no wall
// between (the screen shows it), and the facing that points at it
export function inLine(g, pp) {
  let best = null;
  for (const [f, dx, dy] of [[K.LEFTS, -1, 0], [K.RIGHT, 1, 0], [K.ABOVE, 0, -1], [K.BELOW, 0, 1]]) {
    let x = pp.x;
    let y = pp.y;
    for (let d = 1; d < 60; d++) {
      x += dx;
      y += dy;
      if (x < 0 || y < 0 || x >= K.WIDTH || y >= K.HEIGHT) break;
      const c = pp.scr[y * K.WIDTH + x];
      if (c === K.LEFTS || c === K.RIGHT || c === K.ABOVE || c === K.BELOW) {
        if (!best || d < best.d) best = { f, d, x, y };
        break;
      }
      if (K.isWallChar(c)) break;
    }
  }
  return best;
}

export function novice(g, pp, b) {
  noteSight(g, pp, b);
  const r = glibcRandom(b.rs);
  const foe = inLine(g, pp);
  if (foe) {
    // slow reactions: 3-6 steps pass before it responds to what it sees
    if (b.react == null) b.react = g.step + 3 + (r % 4);
    if (g.step >= b.react) {
      b.react = null;
      const turn = pp.face !== foe.f ? TURN[foe.f] : '';
      if ((r >> 3) % 2 === 0) return turn || null; // noticed too late: only turns
      const weapon = (r >> 5) % 10 === 0 && pp.ammo >= K.GRENREQ + 5 ? 'g' : 'f';
      return turn + weapon;
    }
  } else {
    b.react = null;
  }
  // a little hesitation between moves
  if (b.wait > 0) {
    b.wait--;
    return null;
  }
  b.wait = (r >> 7) % 2;
  return exploreStep(g, pp, b, r) ?? otto(g, pp, b.brain, b.rs);
}
