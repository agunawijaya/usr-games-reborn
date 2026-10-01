// Classic Otto — a port of hunt/hunt/otto.c (Greg Couch, UCSF CGL).
//
//   "This guy is buggy, unfair, stupid, and not extensible."  — otto.c:37
//
// Original: Copyright (c) 1983-2003, Regents of the University of
// California. https://github.com/vattam/BSDGames/tree/master/hunt/hunt/otto.c
//
// Otto plays the way a human does: it reads its own terminal screen (the
// player's remembered map, stale entries and all) and types keys. The logic
// is ported literally, including its bugs, because they are its personality
// (docs/notes.md, "Otto"):
//   * the duck-from-behind test reads `bitem.what & ON_SIDE` instead of
//     `.flags`, so it only ever dodges a bomb '@' coming from behind;
//   * BEEN_SAME tests `been_there[..] & NORTH` where NORTH is 0;
//   * a dead end marks `been_there[r][col]` with the scan row, not the column;
//   * attacks head-on with two small slimes ('o' 'o'), sideways with 'f' 'f'.
// Two harness-level faults of the original client are NOT reproduced (they
// would freeze or blind the bot): it steered by the last '<>^v' drawn on the
// screen (message text like "You've been slimed." contains a 'v'), and it
// waited for a READY acknowledgement that driver.c never sends for typeahead
// executed in later passes. Here otto is asked for its next keys whenever
// its typeahead is empty, which is what the code was written to expect.

import { HEIGHT, WIDTH, SPACE, MINE, GMINE, BOOT, BOOT_PAIR, SHOT, GRENADE, SATCHEL, BOMB, SLIME, ch, translate } from '../engine/constants.js';
import { screenChar } from '../engine/hunt.js';
import { glibcRandom } from '../engine/rng.js';

const OPPONENT = '{}i!';
const PUSHOVER = ' bg;*#&';
const SHOTS = '$@Oo:';

const NUMDIRECTIONS = 4;
// absolute directions (facings) - counterclockwise
const NORTH = 0;
const WEST = 1;
const SOUTH = 2;
const EAST = 3;
const ALLDIRS = 0xf;
// relative directions - counterclockwise
const FRONT = 0;
const LEFT = 1;
const BACK = 2;
const RIGHT = 3;
const DIRKEYS = 'khjl';

const DEADEND = 0x1;
const ON_LEFT = 0x2;
const ON_RIGHT = 0x4;
const ON_SIDE = ON_LEFT | ON_RIGHT;
const BEEN = 0x8;
const BEEN_SAME = 0x10;

const W2 = 64; // been_there[HEIGHT][WIDTH2]

// C's strchr(s, c) is non-NULL for c == '\0' too (it finds the terminator).
const strchr = (s, c) => c === 0 || s.includes(String.fromCharCode(c));
const direction = (abs, rel) => (abs + rel) % NUMDIRECTIONS;

export function newOttoBrain(randomSeed = 1) {
  return { numTurns: 0, been: new Array(HEIGHT * W2).fill(0) };
}

// One call of otto(y, x, face): returns the keys it types.
export function otto(g, pp, brain, rs) {
  const o = {
    g, pp, brain, rs,
    facing: 0, row: pp.y, col: pp.x,
    flbr: [newItem(), newItem(), newItem(), newItem()],
    command: '',
  };
  switch (String.fromCharCode(translate(pp.face))) {
    case '^': o.facing = NORTH; break;
    case '<': o.facing = WEST; break;
    case 'v': o.facing = SOUTH; break;
    case '>': o.facing = EAST; break;
    default: return '';
  }
  const B = brain.been;
  B[o.row * W2 + o.col] |= 1 << o.facing;

  lookAround(o);
  for (let i = 0; i < NUMDIRECTIONS; i++) {
    if (strchr(OPPONENT, o.flbr[i].what)) {
      attack(o, i);
      B.fill(0);
      return o.command;
    }
  }
  const bitem = o.flbr[BACK];
  if (strchr(SHOTS, bitem.what) && !(bitem.what & ON_SIDE)) {
    duck(o, BACK);
    B.fill(0);
  } else if (goForAmmo(o, BOOT_PAIR)) {
    B.fill(0);
  } else if (goForAmmo(o, BOOT)) {
    B.fill(0);
  } else if (goForAmmo(o, GMINE)) {
    B.fill(0);
  } else if (goForAmmo(o, MINE)) {
    B.fill(0);
  } else {
    wander(o);
  }
  return o.command;
}

function newItem() { return { what: 0, distance: -1, flags: 0 }; }

const SCREEN = (o, y, x) => {
  if (y < 0 || y >= HEIGHT || x < 0 || x >= WIDTH) return 0;
  return screenChar(o.g, o.pp, y, x);
};

// otto.c:234-307
function stopLook(itemp, c, dist, side) {
  switch (c) {
    case SPACE:
      if (side) itemp.flags &= ~DEADEND;
      return 0;
    case MINE: case GMINE: case BOOT: case BOOT_PAIR:
      if (itemp.distance === -1) {
        itemp.distance = dist;
        itemp.what = c;
        if (side < 0) itemp.flags |= ON_LEFT;
        else if (side > 0) itemp.flags |= ON_RIGHT;
      }
      return 0;
    case SHOT: case GRENADE: case SATCHEL: case BOMB: case SLIME:
      if (itemp.distance === -1 || (!side
          && ((itemp.flags & ON_SIDE) || itemp.what === GMINE || itemp.what === MINE))) {
        itemp.distance = dist;
        itemp.what = c;
        itemp.flags &= ~ON_SIDE;
        if (side < 0) itemp.flags |= ON_LEFT;
        else if (side > 0) itemp.flags |= ON_RIGHT;
      }
      return 0;
    case ch('{'): case ch('}'): case ch('i'): case ch('!'):
      itemp.distance = dist;
      itemp.what = c;
      itemp.flags &= ~(ON_SIDE | DEADEND);
      if (side < 0) itemp.flags |= ON_LEFT;
      else if (side > 0) itemp.flags |= ON_RIGHT;
      return 1;
    default:
      // a wall or unknown object
      if (side) return 0;
      if (itemp.distance === -1) {
        itemp.distance = dist;
        itemp.what = c;
      }
      return 1;
  }
}

// otto.c:309-407
function ottolook(o, relDir, itemp) {
  const B = o.brain.been;
  const { row, col } = o;
  let r = 0;
  let c = 0;
  itemp.what = 0;
  itemp.distance = -1;
  itemp.flags = DEADEND | BEEN; // true until proven false

  switch (direction(o.facing, relDir)) {
    case NORTH:
      if (B[(row - 1) * W2 + col] & NORTH) itemp.flags |= BEEN_SAME;
      north: for (r = row - 1; r >= 0; r--) {
        for (c = col - 1; c < col + 2; c++) {
          if (stopLook(itemp, SCREEN(o, r, c), row - r, c - col)) break north;
          if (c === col && !B[r * W2 + c]) itemp.flags &= ~BEEN;
        }
      }
      if (itemp.flags & DEADEND) {
        itemp.flags |= BEEN;
        B[r * W2 + col] |= NORTH;
        for (r = row - 1; r > row - itemp.distance; r--) B[r * W2 + col] = ALLDIRS;
      }
      break;
    case SOUTH:
      if (B[(row + 1) * W2 + col] & SOUTH) itemp.flags |= BEEN_SAME;
      south: for (r = row + 1; r < HEIGHT; r++) {
        for (c = col - 1; c < col + 2; c++) {
          if (stopLook(itemp, SCREEN(o, r, c), r - row, col - c)) break south;
          if (c === col && !B[r * W2 + c]) itemp.flags &= ~BEEN;
        }
      }
      if (itemp.flags & DEADEND) {
        itemp.flags |= BEEN;
        B[r * W2 + col] |= SOUTH;
        for (r = row + 1; r < row + itemp.distance; r++) B[r * W2 + col] = ALLDIRS;
      }
      break;
    case WEST:
      if (B[row * W2 + col - 1] & WEST) itemp.flags |= BEEN_SAME;
      west: for (c = col - 1; c >= 0; c--) {
        for (r = row - 1; r < row + 2; r++) {
          if (stopLook(itemp, SCREEN(o, r, c), col - c, row - r)) break west;
          if (r === row && !B[r * W2 + c]) itemp.flags &= ~BEEN;
        }
      }
      if (itemp.flags & DEADEND) {
        itemp.flags |= BEEN;
        B[r * W2 + col] |= WEST;
        for (c = col - 1; c > col - itemp.distance; c--) B[row * W2 + c] = ALLDIRS;
      }
      break;
    case EAST:
      if (B[row * W2 + col + 1] & EAST) itemp.flags |= BEEN_SAME;
      east: for (c = col + 1; c < WIDTH; c++) {
        for (r = row - 1; r < row + 2; r++) {
          if (stopLook(itemp, SCREEN(o, r, c), c - col, r - row)) break east;
          if (r === row && !B[r * W2 + c]) itemp.flags &= ~BEEN;
        }
      }
      if (itemp.flags & DEADEND) {
        itemp.flags |= BEEN;
        B[r * W2 + col] |= EAST;
        for (c = col + 1; c < col + itemp.distance; c++) B[row * W2 + c] = ALLDIRS;
      }
      break;
  }
}

function lookAround(o) {
  for (let i = 0; i < NUMDIRECTIONS; i++) ottolook(o, i, o.flbr[i]);
}

// otto.c:427-462 — as a side effect modifies facing and location (row, col)
function faceAndMoveDirection(o, relDir, distance) {
  const oldFacing = o.facing;
  o.facing = direction(o.facing, relDir);
  const cmd = DIRKEYS[o.facing];
  if (relDir !== FRONT) {
    o.command += cmd.toUpperCase();
    if (distance === 0) {
      // rotate ottolook's to be in right position
      const items = [];
      for (let i = 0; i < NUMDIRECTIONS; i++) items[i] = { ...o.flbr[(i + oldFacing) % NUMDIRECTIONS] };
      for (let i = 0; i < NUMDIRECTIONS; i++) Object.assign(o.flbr[i], items[i]);
    }
  }
  while (distance--) {
    o.command += cmd;
    switch (o.facing) {
      case NORTH: o.row--; break;
      case WEST: o.col--; break;
      case SOUTH: o.row++; break;
      case EAST: o.col++; break;
    }
    if (distance === 0) lookAround(o);
  }
}

// otto.c:464-490 (itemp is a pointer into flbr[], so re-read after a look)
function attack(o, relDir) {
  const itemp = o.flbr[relDir];
  if (!(itemp.flags & ON_SIDE)) {
    faceAndMoveDirection(o, relDir, 0);
    o.command += 'oo';
    duck(o, FRONT);
    o.command += ' ';
  } else if (itemp.distance > 1) {
    faceAndMoveDirection(o, relDir, 2);
    duck(o, FRONT);
  } else {
    faceAndMoveDirection(o, relDir, 1);
    const rd = (itemp.flags & ON_LEFT) ? LEFT : RIGHT;
    faceAndMoveDirection(o, rd, 0);
    o.command += 'ff';
    duck(o, FRONT);
    o.command += ' ';
  }
}

// otto.c:492-536 — sidestep if there is room, else step along the line.
function duck(o, relDir) {
  const dir = direction(o.facing, relDir);
  const { row, col } = o;
  const push = (y, x) => strchr(PUSHOVER, SCREEN(o, y, x));
  switch (dir) {
    case NORTH: case SOUTH:
      if (push(row, col - 1)) o.command += 'h';
      else if (push(row, col + 1)) o.command += 'l';
      else if (dir === NORTH && push(row + 1, col)) o.command += 'j';
      else if (dir === SOUTH && push(row - 1, col)) o.command += 'k';
      else if (dir === NORTH) o.command += 'k';
      else o.command += 'j';
      break;
    case WEST: case EAST:
      if (push(row - 1, col)) o.command += 'k';
      else if (push(row + 1, col)) o.command += 'j';
      else if (dir === WEST && push(row, col + 1)) o.command += 'l';
      else if (dir === EAST && push(row, col - 1)) o.command += 'h';
      else if (dir === WEST) o.command += 'h';
      else o.command += 'l';
      break;
  }
}

// otto.c:542-567 — go for the closest mine if possible
function goForAmmo(o, mine) {
  let relDir = -1;
  let dist = WIDTH;
  for (let i = 0; i < NUMDIRECTIONS; i++) {
    if (o.flbr[i].what === mine && o.flbr[i].distance < dist) {
      relDir = i;
      dist = o.flbr[i].distance;
    }
  }
  if (relDir === -1) return false;
  if (!(o.flbr[relDir].flags & ON_SIDE) || o.flbr[relDir].distance > 1) {
    if (dist > 4) dist = 4;
    faceAndMoveDirection(o, relDir, dist);
  } else {
    return false; // until it's done right
  }
  return true;
}

// otto.c:569-626
function wander(o) {
  const F = o.flbr;
  const brain = o.brain;
  let i;
  for (i = 0; i < NUMDIRECTIONS; i++) if (!(F[i].flags & BEEN) || F[i].distance <= 1) break;
  if (i === NUMDIRECTIONS) brain.been.fill(0);
  let dirMask = 0;
  let dirCount = 0;
  for (i = 0; i < NUMDIRECTIONS; i++) {
    const j = (RIGHT + i) % NUMDIRECTIONS;
    if (F[j].distance <= 1 || (F[j].flags & DEADEND)) continue;
    if (!(F[j].flags & BEEN_SAME)) {
      dirMask = 1 << j;
      dirCount = 1;
      break;
    }
    if (j === FRONT
        && brain.numTurns > 4 + (glibcRandom(o.rs) % ((F[FRONT].flags & BEEN) ? 7 : HEIGHT))) continue;
    dirMask |= 1 << j;
    dirCount = 1;
    break;
  }
  let relDir;
  if (dirCount === 0) {
    duck(o, glibcRandom(o.rs) % NUMDIRECTIONS);
    brain.numTurns = 0;
    return;
  }
  relDir = ffs(dirMask) - 1;
  if (relDir === FRONT) brain.numTurns++;
  else brain.numTurns = 0;
  faceAndMoveDirection(o, relDir, 1);
}

function ffs(m) {
  for (let b = 0; b < 32; b++) if (m & (1 << b)) return b + 1;
  return 0;
}
