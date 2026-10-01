// hunt(6) engine — a function-by-function port of the huntd daemon.
//
// Original: hunt/huntd/*.c, Copyright (c) 1983-2003, Regents of the
// University of California (Conrad C. Huang, Gregory S. Couch, Kenneth C.R.C.
// Arnold, UCSF Computer Graphics Laboratory). All rights reserved.
// https://github.com/vattam/BSDGames/tree/master/hunt
//
// Design (docs/architecture.md): the whole game is one plain JSON-safe object
// `g`. `step(g)` is one pass of driver.c's main loop: every player executes at
// most one queued command, then moveshots() moves the world, the dead are
// zapped and at most one connection is answered. No DOM, no clock, no
// Math.random: the same state + the same commands give the same next state,
// so a future Node/WebSocket server can run this file unchanged.
//
// The port keeps the C data model on purpose, because the rules live in it:
// the maze is a char grid that bullets and players are drawn into, bullets
// sit in a linked list whose order matters, and players occupy slots that
// driver.c zap() compacts with memcpy (bullets remember their owner's SLOT,
// so a slot reused after a death inherits the kill bonus — see notes.md).

import * as K from './constants.js';
import { randNum } from './rng.js';
import { makemaze } from './maze.js';

const {
  WIDTH, HEIGHT, UBOUND, DBOUND, LBOUND, RBOUND, SPACE, DOOR,
  WALL1, WALL2, WALL3, WALL4, WALL5, SHOT, GRENADE, SATCHEL, BOMB, MINE, GMINE,
  SLIME, LAVA, KNIFE, FALL, BOOT, BOOT_PAIR, LEFTS, RIGHT, ABOVE, BELOW, FLYER,
  NORTH, SOUTH, EAST, WEST, isPlayer, opposite,
} = K;

const IDX = (y, x) => y * WIDTH + x;
const SEE_OVER = (ch) => !(ch === DOOR || ch === WALL1 || ch === WALL2 || ch === WALL3 || ch === WALL4 || ch === WALL5);

// ---------------------------------------------------------------- creation

export const DEFAULT_CHEATS = Object.freeze({
  god: false,          // no damage to human players
  infiniteAmmo: false, // human ammo never drops below what a shot needs
  revealMines: false,  // renderer: show every mine (engine: no effect)
  seeAll: false,       // renderer: whole maze visible (engine: no effect)
  freezeBots: false,   // bots queue no commands
  instantRespawn: false,
  slowMotion: false,   // host: quarter-speed steps (engine: no effect)
});

export function newGame({ seed = 1, arena = 'classic' } = {}) {
  const g = {
    v: 1,
    seed: seed | 0,
    step: 0,
    maze: new Array(WIDTH * HEIGHT).fill(DOOR),
    orig: new Array(WIDTH * HEIGHT).fill(DOOR),
    slots: [],
    np: 0,
    nplayer: 0,
    boots: [],
    bullets: [],
    expl: [[], [], [], []],
    removed: [],
    remIndex: 0,
    volcano: 0,
    scores: [],
    joinq: [],
    autorejoin: false,
    rejoinDelay: 0,
    bots: {},
    nextId: 1,
    arena,
    cheats: { ...DEFAULT_CHEATS },
    humans: [],
    cheated: false,
    ev: [],
    trails: [],
  };
  for (let i = 0; i < K.MAXREMOVE; i++) g.removed.push([0, 0]);
  for (let i = 0; i < K.NBOOTS; i++) g.boots.push(newFlyer());
  return g;
}

function newFlyer() {
  return { x: 0, y: 0, face: 0, over: 0, flying: -1, flyx: 0, flyy: 0, undershot: false };
}

function newSlot() {
  return {
    id: 0, iid: 0, face: SPACE, over: SPACE, undershot: false,
    flying: -1, flyx: 0, flyy: 0, nboots: 0, damage: 0, damcap: K.MAXDAM,
    ammo: 0, ncshot: 0, scan: 0, cloak: 0, x: 0, y: 0, typed: false,
    death: '', mem: new Array(WIDTH * HEIGHT).fill(SPACE), scr: new Array(WIDTH * HEIGHT).fill(SPACE), q: [],
  };
}

// driver.c init(): the maze and the boots. `arena` is this port's optional
// mirror seeding (port ADR 006); 'classic' is makemaze.c untouched.
export function initArena(g) {
  makemaze(g, { braid: g.arena === 'ricochet' ? 45 : 0 });
  if (g.arena === 'veteran') seedMirrors(g, g.arena);
  makeboots(g);
}

// Port extension (ADR 006): the Veteran arena is aged as if every wall had
// already been blown and rebuilt once, using the regeneration rule of
// expl.c:218-225 (1% door, then 1% mirror). Runs on the daemon generator,
// after makemaze and before the boots.
function seedMirrors(g, arena) {
  const pct = arena === 'veteran' ? 1 : 0;
  if (!pct) return;
  for (let y = UBOUND; y < DBOUND; y++) {
    for (let x = LBOUND; x < RBOUND; x++) {
      const i = IDX(y, x);
      if (g.maze[i] === SPACE) continue;
      if (randNum(g, 100) < pct) g.maze[i] = DOOR;
      if (randNum(g, 100) < pct) g.maze[i] = WALL4;
    }
  }
  for (let i = 0; i < g.maze.length; i++) g.orig[i] = g.maze[i];
}

// driver.c:454-467
function makeboots(g) {
  let x;
  let y;
  do {
    x = randNum(g, WIDTH - 1) + 1;
    y = randNum(g, HEIGHT - 1) + 1;
  } while (g.maze[IDX(y, x)] !== SPACE);
  g.maze[IDX(y, x)] = BOOT_PAIR;
  for (const b of g.boots) b.flying = -1;
}

// Load a hand-made maze (tests, the lab page). Also sets Orig_maze.
export function loadMaze(g, rows) {
  for (let y = 0; y < HEIGHT; y++) {
    const r = rows[y] || '';
    for (let x = 0; x < WIDTH; x++) g.maze[IDX(y, x)] = x < r.length ? r.charCodeAt(x) : SPACE;
  }
  g.orig = g.maze.slice();
  for (const b of g.boots) b.flying = -1;
}

// ------------------------------------------------------------ small helpers

export const ident = (g, pp) => g.scores.find((s) => s.iid === pp.iid);
export const nameOf = (g, pp) => ident(g, pp)?.name ?? '?';
export const active = (g) => g.slots.slice(0, g.np);
export const findPlayer = (g, name) => active(g).find((p) => nameOf(g, p) === name) || null;
export const playerById = (g, id) => active(g).find((p) => p.id === id) || null;

function emit(g, e) { g.ev.push(e); }

// draw.c:353-361 — the one-line message area.
function message(g, pp, text) {
  emit(g, { t: 'msg', to: pp.id, name: nameOf(g, pp), text });
}

// shots.c:1046-1057
function playAt(g, y, x) {
  for (let i = 0; i < g.np; i++) {
    const pp = g.slots[i];
    if (pp.x === x && pp.y === y) return pp;
  }
  throw new Error(`driver: couldn't find player at (${x},${y})`);
}

const slotOf = (g, pp) => g.slots.indexOf(pp);
const humanSlot = (g, pp) => pp && g.humans.includes(nameOf(g, pp));

// ------------------------------------------------------------------ draw.c

// draw.c:260-282 — copy one maze cell onto a player's screen memory.
// p_maze (mem) holds raw maze chars; scr is what the client terminal shows,
// written with the same translation the daemon applies when it sends the
// byte: your own glyph as < > ^ v, a teammate as the team digit.
function check(g, pp, y, x) {
  if (y < 0 || y >= HEIGHT || x < 0 || x >= WIDTH) return;
  const i = IDX(y, x);
  const ch = g.maze[i];
  if (ch === pp.mem[i]) return;
  pp.mem[i] = ch;
  if (x === pp.x && y === pp.y) pp.scr[i] = K.translate(ch);
  else if (isPlayer(ch)) pp.scr[i] = playerSym(g, pp, y, x) ?? ch;
  else pp.scr[i] = ch;
}

// draw.c:125-171 — what a player sees: the 3x3 around them, then a 3-wide
// strip ahead and to both sides, never behind. `visit` lets the renderer ask
// for the same cell set without touching any state.
export function lookCells(g, pp, visit) {
  const x = pp.x;
  const y = pp.y;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) visit(y + dy, x + dx);
  switch (pp.face) {
    case LEFTS: see(g, pp, LEFTS, visit); see(g, pp, ABOVE, visit); see(g, pp, BELOW, visit); break;
    case RIGHT: see(g, pp, RIGHT, visit); see(g, pp, ABOVE, visit); see(g, pp, BELOW, visit); break;
    case ABOVE: see(g, pp, ABOVE, visit); see(g, pp, LEFTS, visit); see(g, pp, RIGHT, visit); break;
    case BELOW: see(g, pp, BELOW, visit); see(g, pp, LEFTS, visit); see(g, pp, RIGHT, visit); break;
    default: break; // FLYER sees only the 3x3
  }
}

function look(g, pp) {
  lookCells(g, pp, (y, x) => check(g, pp, y, x));
}

// draw.c:173-258
function see(g, pp, face, visit) {
  const M = g.maze;
  let x = pp.x;
  let y = pp.y;
  let i;
  let cnt;
  switch (face) {
    case LEFTS: {
      let sx = x;
      for (i = 0; SEE_OVER(M[IDX(y, --sx)]); i++);
      if (i === 0) break;
      cnt = i;
      for (let row = y - 1; row <= y + 1; row++) {
        x = pp.x - 1;
        i = cnt;
        while (i--) visit(row, --x);
      }
      break;
    }
    case RIGHT: {
      let sx = x + 1;
      for (i = 0; SEE_OVER(M[IDX(y, sx++)]); i++);
      if (i === 0) break;
      cnt = i;
      for (let row = y - 1; row <= y + 1; row++) {
        x = pp.x + 1;
        i = cnt;
        while (i--) visit(row, ++x);
      }
      break;
    }
    case ABOVE: {
      y--;
      if (!SEE_OVER(M[IDX(y, x)])) break;
      do {
        --y;
        visit(y, x - 1);
        visit(y, x);
        visit(y, x + 1);
      } while (SEE_OVER(M[IDX(y, x)]));
      break;
    }
    case BELOW: {
      y++;
      if (!SEE_OVER(M[IDX(y, x)])) break;
      do {
        y++;
        visit(y, x - 1);
        visit(y, x);
        visit(y, x + 1);
      } while (SEE_OVER(M[IDX(y, x)]));
      break;
    }
  }
}

// draw.c:310-351 — (un)draw a player; scanners see the mover unless cloaked.
// Each draw costs the mover one unit of cloak and every scanner one unit of
// scan, which is why cloak and scan are measured in moves, not in time.
function drawplayer(g, pp, draw) {
  const x = pp.x;
  const y = pp.y;
  g.maze[IDX(y, x)] = draw ? pp.face : pp.over;
  for (let n = 0; n < g.np; n++) {
    const newp = g.slots[n];
    if (!draw || newp === pp) { check(g, newp, y, x); continue; }
    if (newp.scan === 0) {
      newp.scan--;
    } else if (newp.scan > 0) {
      if (pp.cloak < 0) check(g, newp, y, x);
      newp.scan--;
    }
  }
  if (!draw || pp.cloak < 0) return;
  pp.cloak--;
}

// draw.c:389-406 — a teammate shows as the team digit. Evaluated when the
// screen is read (the original evaluates it when the byte is sent; the two
// agree because the check() that sends it always runs with the player there).
export function playerSym(g, pp, y, x) {
  const ch = g.maze[IDX(y, x)];
  let npp = null;
  for (let i = 0; i < g.np; i++) if (g.slots[i].x === x && g.slots[i].y === y) { npp = g.slots[i]; break; }
  if (!npp) return null;
  const mine = ident(g, pp).team;
  const theirs = ident(g, npp).team;
  if (theirs === SPACE) return ch;
  if (mine !== theirs) return ch;
  return mine;
}

// What the hunt client's curses screen shows at (y, x).
export function screenChar(g, pp, y, x) {
  return pp.scr[IDX(y, x)];
}

// ------------------------------------------------------------------ expl.c

// expl.c:48-109 — explosions are drawn on EVERY player's screen (they are
// loud); a wall inside the border that is caught in one is removed.
function showexpl(g, y, x, type) {
  if (y < 0 || y >= HEIGHT || x < 0 || x >= WIDTH) return;
  g.expl[0].push([y, x, type]);
  const i = IDX(y, x);
  for (let n = 0; n < g.np; n++) {
    const pp = g.slots[n];
    if (pp.mem[i] === type) continue;
    pp.mem[i] = type;
    pp.scr[i] = type; // sent untranslated, even a player glyph
  }
  switch (g.maze[i]) {
    case WALL1: case WALL2: case WALL3: case DOOR: case WALL4: case WALL5:
      if (y >= UBOUND && y < DBOUND && x >= LBOUND && x < RBOUND) removeWall(g, y, x);
      break;
  }
}

// expl.c:116-148 — explosions stay on screen for EXPLEN steps.
function rollexpl(g) {
  for (const [y, x, e] of g.expl[K.EXPLEN - 1]) {
    const i = IDX(y, x);
    const c = (y < UBOUND || y >= DBOUND || x < LBOUND || x >= RBOUND) ? g.maze[i] : SPACE;
    for (let n = 0; n < g.np; n++) {
      const pp = g.slots[n];
      if (pp.mem[i] === e) { pp.mem[i] = c; pp.scr[i] = c; }
    }
  }
  for (let k = K.EXPLEN - 1; k > 0; k--) g.expl[k] = g.expl[k - 1];
  g.expl[0] = [];
}

// expl.c:162-244 — at most MAXREMOVE walls are missing at once; removing one
// more rebuilds the oldest (1% of rebuilt walls become a door, 1% a diagonal
// mirror). A wall rebuilt under a player throws them into the air.
function removeWall(g, y, x) {
  let r = g.remIndex;
  let saveChar = 0;
  let found = g.removed[r][0] === 0;
  // The C loops until it finds a free or rebuildable slot; with every slot
  // blocked it would spin forever. The guard below is the only deviation.
  for (let tries = 0; !found && tries < K.MAXREMOVE; tries++) {
    const [ry, rx] = g.removed[r];
    const ch = g.maze[IDX(ry, rx)];
    if (ch === SPACE || ch === LEFTS || ch === RIGHT || ch === ABOVE || ch === BELOW || ch === FLYER) {
      saveChar = ch;
      found = true;
      break;
    }
    if (++r >= K.MAXREMOVE) r = 0;
  }
  if (g.removed[r][0] !== 0) {
    const [ry, rx] = g.removed[r];
    const ri = IDX(ry, rx);
    if (saveChar === SPACE) {
      g.maze[ri] = g.orig[ri];
    } else {
      const pp = playAt(g, ry, rx);
      if (pp.flying >= 0) {
        pp.flying += randNum(g, 10);
      } else {
        pp.flying = randNum(g, 20);
        pp.flyx = 2 * randNum(g, 6) - 5;
        pp.flyy = 2 * randNum(g, 6) - 5;
      }
      pp.over = g.orig[ri];
      pp.face = FLYER;
      g.maze[ri] = FLYER;
      emit(g, { t: 'thrown', id: pp.id, x: rx, y: ry });
      showexpl(g, ry, rx, FLYER);
    }
    if (randNum(g, 100) === 0) g.maze[ri] = DOOR;
    if (randNum(g, 100) === 0) g.maze[ri] = WALL4;
    emit(g, { t: 'wallBack', x: rx, y: ry, c: g.maze[ri] === FLYER ? g.orig[ri] : g.maze[ri] });
  }
  emit(g, { t: 'wallGone', x, y, c: g.maze[IDX(y, x)] });
  g.removed[r] = [y, x];
  if (++r >= K.MAXREMOVE) g.remIndex = 0;
  else g.remIndex = r;
  g.maze[IDX(y, x)] = SPACE;
}

// ----------------------------------------------------------------- shots.c

let bulletId = 0;
function createShot(g, type, y, x, face, charge, size, owner, score, expl, over) {
  return {
    id: g.nextId++, x, y, face, charge, type, size, over,
    owner, score, expl, path: null, bounces: 0,
  };
}
void bulletId;

// execute.c:443-483
function addShot(g, type, y, x, face, charge, owner, expl, over) {
  let size;
  switch (type) {
    case SHOT: case MINE: size = 1; break;
    case GRENADE: case GMINE: size = 2; break;
    case SATCHEL: size = 3; break;
    case BOMB:
      for (size = 3; size < K.MAXBOMB; size++) if (K.SHOT_REQ[size] >= charge) break;
      size++;
      break;
    default: size = 0; break;
  }
  const ownerSlot = owner ? slotOf(g, owner) : -1;
  const bp = createShot(g, type, y, x, face, charge, size, ownerSlot,
    owner ? owner.iid : -1, expl, over);
  g.bullets.unshift(bp);
  return bp;
}

const ownerOf = (g, bp) => (bp.owner >= 0 ? g.slots[bp.owner] : null);
const scoreOf = (g, bp) => (bp.score >= 0 ? g.scores.find((s) => s.iid === bp.score) : null);

// shots.c:66-179 — one step of the world.
function moveshots(g) {
  rollexpl(g);
  if (g.bullets.length) {
    let blist = g.bullets;
    g.bullets = [];
    for (let k = 0; k < blist.length; k++) {
      const bp = blist[k];
      const x = bp.x;
      const y = bp.y;
      bp.path = [[x, y]];
      g.maze[IDX(y, x)] = bp.over;
      for (let n = 0; n < g.np; n++) check(g, g.slots[n], y, x);
      switch (bp.type) {
        case SHOT: case GRENADE: case SATCHEL: case BOMB:
          if (moveNormalShot(g, bp, blist, k)) g.bullets.unshift(bp);
          break;
        case SLIME:
          if (bp.expl || moveNormalShot(g, bp, blist, k)) g.bullets.unshift(bp);
          break;
        default:
          g.bullets.unshift(bp);
          break;
      }
      // For the renderer and tests: where every shot went this step.
      if (bp.path.length > 1) {
        g.trails.push({ id: bp.id, type: bp.type, face: bp.face, path: bp.path.slice(), expl: bp.expl, gone: !!bp.gone, bounces: bp.bounces });
      }
    }

    blist = g.bullets;
    g.bullets = [];
    for (let k = 0; k < blist.length; k++) {
      const bp = blist[k];
      if (!bp.expl) {
        saveBullet(g, bp);
        continue;
      }
      chkshot(g, bp, blist, k + 1);
    }

    for (let n = 0; n < g.np; n++) {
      const pp = g.slots[n];
      g.maze[IDX(pp.y, pp.x)] = pp.face;
    }
  }
  // ret:
  for (const b of g.boots) if (b.flying >= 0) moveFlyer(g, b, true);
  for (let n = 0; n < g.np; n++) {
    const pp = g.slots[n];
    if (pp.flying >= 0) moveFlyer(g, pp, false);
    look(g, pp);
  }
}

// shots.c:185-365 — BULSPD cells per step, one cell at a time.
function moveNormalShot(g, bp, blist, k) {
  for (let i = 0; i < K.BULSPD; i++) {
    if (bp.expl) break;
    let x = bp.x;
    let y = bp.y;
    switch (bp.face) {
      case LEFTS: x--; break;
      case RIGHT: x++; break;
      case ABOVE: y--; break;
      case BELOW: y++; break;
    }
    const cell = g.maze[IDX(y, x)];
    switch (cell) {
      case SHOT:
        if (randNum(g, 100) < 5) {
          zapshot(g, g.bullets, 0, bp);
          zapshot(g, blist, k + 1, bp);
        }
        break;
      case GRENADE:
        if (randNum(g, 100) < 10) {
          zapshot(g, g.bullets, 0, bp);
          zapshot(g, blist, k + 1, bp);
        }
        break;
      case WALL4: { // '/' reflects, then flips to '\'
        const from = bp.face;
        switch (bp.face) {
          case LEFTS: bp.face = BELOW; break;
          case RIGHT: bp.face = ABOVE; break;
          case ABOVE: bp.face = RIGHT; break;
          case BELOW: bp.face = LEFTS; break;
        }
        g.maze[IDX(y, x)] = WALL5;
        bp.bounces++;
        emit(g, { t: 'bounce', id: bp.id, x, y, from, to: bp.face, mirror: WALL4, n: bp.bounces, type: bp.type });
        break;
      }
      case WALL5: { // '\' reflects, then flips to '/'
        const from = bp.face;
        switch (bp.face) {
          case LEFTS: bp.face = ABOVE; break;
          case RIGHT: bp.face = BELOW; break;
          case ABOVE: bp.face = LEFTS; break;
          case BELOW: bp.face = RIGHT; break;
        }
        g.maze[IDX(y, x)] = WALL4;
        bp.bounces++;
        emit(g, { t: 'bounce', id: bp.id, x, y, from, to: bp.face, mirror: WALL5, n: bp.bounces, type: bp.type });
        break;
      }
      case DOOR: { // RANDOM: doors scatter shots
        const from = bp.face;
        switch (randNum(g, 4)) {
          case 0: bp.face = ABOVE; break;
          case 1: bp.face = BELOW; break;
          case 2: bp.face = LEFTS; break;
          case 3: bp.face = RIGHT; break;
        }
        bp.bounces++;
        emit(g, { t: 'scatter', id: bp.id, x, y, from, to: bp.face, n: bp.bounces, type: bp.type });
        break;
      }
      case FLYER: {
        const pp = playAt(g, y, x);
        message(g, pp, 'Zing!');
        break;
      }
      case LEFTS: case RIGHT: case BELOW: case ABOVE: {
        // give the person a chance to catch a grenade if s/he is facing it
        const pp = playAt(g, y, x);
        const pid = ident(g, pp);
        pid.shot += bp.charge;
        let fell = true;
        if (opposite(bp.face, cell)) {
          if (randNum(g, 100) < 10) {
            const owner = ownerOf(g, bp);
            const score = scoreOf(g, bp);
            if (owner) message(g, owner, 'Your charge was absorbed!');
            if (score) score.robbed += bp.charge;
            pp.ammo += bp.charge;
            if (pp.damage + bp.size * K.MINDAM > pp.damcap) pid.saved++;
            message(g, pp, 'Absorbed charge (good shield!)');
            pid.absorbed += bp.charge;
            emit(g, { t: 'absorb', id: bp.id, who: pp.id, x, y, charge: bp.charge, type: bp.type });
            bp.path.push([x, y]);
            bp.gone = true;
            return false;
          }
          pid.faced += bp.charge;
        }
        // Small chance that the bullet just misses the person.
        if (randNum(g, 100) < 5) {
          pid.ducked += bp.charge;
          if (pp.damage + bp.size * K.MINDAM > pp.damcap) pid.saved++;
          const score = scoreOf(g, bp);
          if (score) score.missed += bp.charge;
          message(g, pp, 'Zing!');
          emit(g, { t: 'zing', id: bp.id, who: pp.id, x, y });
          const owner = ownerOf(g, bp);
          if (owner) {
            message(g, owner, (score.missed & 0x7) === 0x7 ? 'My!  What a bad shot you are!' : 'Missed him');
          }
          fell = false;
        }
        if (fell) bp.expl = true;
        break;
      }
      case WALL1: case WALL2: case WALL3:
        bp.expl = true;
        break;
    }
    bp.x = x;
    bp.y = y;
    bp.path.push([x, y]);
  }
  return true;
}

// shots.c:516-562
function saveBullet(g, bp) {
  const i = IDX(bp.y, bp.x);
  bp.over = g.maze[i];
  switch (bp.over) {
    case SHOT: case GRENADE: case SATCHEL: case BOMB: case SLIME: case LAVA:
      findUnder(g.bullets, bp);
      break;
  }
  switch (bp.over) {
    case LEFTS: case RIGHT: case ABOVE: case BELOW: case FLYER:
      markPlayer(g, bp);
      break;
    case BOOT: case BOOT_PAIR:
      markBoot(g, bp);
      g.maze[i] = bp.type;
      break;
    default:
      g.maze[i] = bp.type;
      break;
  }
  g.bullets.unshift(bp);
}

// shots.c:568-653 — a player (or a boot) in the air after a wall grew under
// them, or after entering the game flying.
function moveFlyer(g, pp, isBoot) {
  if (pp.undershot) {
    fixshots(g, pp.y, pp.x, pp.over);
    pp.undershot = false;
  }
  g.maze[IDX(pp.y, pp.x)] = pp.over;
  let x = pp.x + pp.flyx;
  let y = pp.y + pp.flyy;
  if (x < 1) {
    x = 1 - x;
    pp.flyx = -pp.flyx;
  } else if (x > WIDTH - 2) {
    x = (WIDTH - 2) - (x - (WIDTH - 2));
    pp.flyx = -pp.flyx;
  }
  if (y < 1) {
    y = 1 - y;
    pp.flyy = -pp.flyy;
  } else if (y > HEIGHT - 2) {
    y = (HEIGHT - 2) - (y - (HEIGHT - 2));
    pp.flyy = -pp.flyy;
  }
  for (;;) {
    const ch = g.maze[IDX(y, x)];
    if (ch === WALL1 || ch === WALL2 || ch === WALL3 || ch === WALL4 || ch === WALL5 || ch === DOOR) {
      if (pp.flying === 0) pp.flying++;
      break;
    }
    if (ch === SPACE) break;
    switch (randNum(g, 4)) {
      case 0: if (x < WIDTH - 2) x++; else x--; break;
      case 1: if (x > 1) x--; else x++; break;
      case 2: if (y < HEIGHT - 2) y++; else y--; break;
      case 3: if (y > 1) y--; else y++; break;
    }
  }
  const fx = pp.x;
  const fy = pp.y;
  pp.y = y;
  pp.x = x;
  if (pp.flying-- === 0) {
    if (pp.face !== BOOT && pp.face !== BOOT_PAIR) {
      checkdam(g, pp, null, null, randNum(g, Math.trunc(pp.damage / 5)), FALL);
      pp.face = randDir(g);
      emit(g, { t: 'land', id: pp.id, x, y });
    } else {
      if (g.maze[IDX(y, x)] === BOOT) pp.face = BOOT_PAIR;
      g.maze[IDX(y, x)] = SPACE;
    }
  }
  if (isBoot) emit(g, { t: 'bootFly', fx, fy, x, y, landed: pp.flying < 0, face: pp.face });
  else emit(g, { t: 'fly', id: pp.id, fx, fy, x, y });
  pp.over = g.maze[IDX(y, x)];
  g.maze[IDX(y, x)] = pp.face;
  showexpl(g, y, x, pp.face);
}

// shots.c:659-746 — detonation: a square of side 2*size-1, damage falling
// off by one unit (5 points) per ring. Mines caught in it go off next step.
function chkshot(g, bp, blist, nextK) {
  let delta = 0;
  switch (bp.type) {
    case SHOT: case MINE: case GRENADE: case GMINE: case SATCHEL: case BOMB:
      delta = bp.size - 1;
      break;
    case SLIME: case LAVA:
      chkslime(g, bp, blist, nextK);
      return;
  }
  emit(g, { t: 'boom', id: bp.id, x: bp.x, y: bp.y, type: bp.type, size: bp.size, owner: ownerOf(g, bp)?.id ?? null });
  for (let y = bp.y - delta; y <= bp.y + delta; y++) {
    if (y < 0 || y >= HEIGHT) continue;
    const dy = y - bp.y;
    const absdy = dy < 0 ? -dy : dy;
    for (let x = bp.x - delta; x <= bp.x + delta; x++) {
      if (x < 0 || x >= WIDTH) continue;
      let dx = x - bp.x;
      let expl;
      if (dx === 0) expl = dy === 0 ? K.ch('*') : K.ch('|');
      else if (dy === 0) expl = K.ch('-');
      else if (dx === dy) expl = K.ch('\\');
      else if (dx === -dy) expl = K.ch('/');
      else expl = K.ch('*');
      showexpl(g, y, x, expl);
      const cell = g.maze[IDX(y, x)];
      switch (cell) {
        case LEFTS: case RIGHT: case ABOVE: case BELOW: case FLYER: {
          if (dx < 0) dx = -dx;
          const damage = absdy > dx ? bp.size - absdy : bp.size - dx;
          const pp = playAt(g, y, x);
          checkdam(g, pp, ownerOf(g, bp), scoreOf(g, bp), damage * K.MINDAM, bp.type);
          break;
        }
        case GMINE: case MINE:
          addShot(g, cell === GMINE ? GRENADE : SHOT, y, x, LEFTS,
            cell === GMINE ? K.GRENREQ : K.BULREQ, null, true, SPACE);
          g.maze[IDX(y, x)] = SPACE;
          emit(g, { t: 'mineChain', x, y, big: cell === GMINE });
          break;
      }
    }
  }
}

// shots.c:753-802 — a slime shot that hit something backs off a wall and
// starts to ooze.
function chkslime(g, bp, blist, nextK) {
  switch (g.maze[IDX(bp.y, bp.x)]) {
    case WALL1: case WALL2: case WALL3: case WALL4: case WALL5: case DOOR:
      switch (bp.face) {
        case LEFTS: bp.x++; break;
        case RIGHT: bp.x--; break;
        case ABOVE: bp.y++; break;
        case BELOW: bp.y--; break;
      }
      break;
  }
  const nbp = { ...bp, path: null };
  if (!bp.oozing) emit(g, { t: 'splat', id: bp.id, x: nbp.x, y: nbp.y, type: bp.type, charge: bp.charge });
  nbp.oozing = true;
  moveSlime(g, nbp, nbp.type === SLIME ? K.SLIMESPEED : K.LAVASPEED, blist, nextK);
}

// shots.c:809-963 — slime splits its charge among the open directions
// (ahead and to the sides; back only when boxed in), one cell per charge,
// SLIMESPEED cells deep per step, then waits and keeps oozing next step.
function moveSlime(g, bp, speed, blist, nextK) {
  if (speed === 0) {
    if (bp.charge > 0) saveBullet(g, bp);
    return;
  }
  showexpl(g, bp.y, bp.x, bp.type === LAVA ? LAVA : K.ch('*'));
  emit(g, { t: 'ooze', x: bp.x, y: bp.y, type: bp.type });
  switch (g.maze[IDX(bp.y, bp.x)]) {
    case LEFTS: case RIGHT: case ABOVE: case BELOW: case FLYER: {
      const pp = playAt(g, bp.y, bp.x);
      message(g, pp, "You've been slimed.");
      emit(g, { t: 'slimed', who: pp.id, x: bp.x, y: bp.y, type: bp.type });
      checkdam(g, pp, ownerOf(g, bp), scoreOf(g, bp), K.MINDAM, bp.type);
      break;
    }
    case SHOT: case GRENADE: case SATCHEL: case BOMB:
      explshot(g, blist, nextK, bp.y, bp.x);
      explshot(g, g.bullets, 0, bp.y, bp.x);
      break;
  }

  if (--bp.charge <= 0) return;

  let dirmask = 0;
  let count = 0;
  const w = (y, x) => iswall(g, y, x);
  switch (bp.face) {
    case LEFTS:
      if (!w(bp.y, bp.x - 1)) { dirmask |= WEST; count++; }
      if (!w(bp.y - 1, bp.x)) { dirmask |= NORTH; count++; }
      if (!w(bp.y + 1, bp.x)) { dirmask |= SOUTH; count++; }
      if (dirmask === 0 && !w(bp.y, bp.x + 1)) { dirmask |= EAST; count++; }
      break;
    case RIGHT:
      if (!w(bp.y, bp.x + 1)) { dirmask |= EAST; count++; }
      if (!w(bp.y - 1, bp.x)) { dirmask |= NORTH; count++; }
      if (!w(bp.y + 1, bp.x)) { dirmask |= SOUTH; count++; }
      if (dirmask === 0 && !w(bp.y, bp.x - 1)) { dirmask |= WEST; count++; }
      break;
    case ABOVE:
      if (!w(bp.y - 1, bp.x)) { dirmask |= NORTH; count++; }
      if (!w(bp.y, bp.x - 1)) { dirmask |= WEST; count++; }
      if (!w(bp.y, bp.x + 1)) { dirmask |= EAST; count++; }
      if (dirmask === 0 && !w(bp.y + 1, bp.x)) { dirmask |= SOUTH; count++; }
      break;
    case BELOW:
      if (!w(bp.y + 1, bp.x)) { dirmask |= SOUTH; count++; }
      if (!w(bp.y, bp.x - 1)) { dirmask |= WEST; count++; }
      if (!w(bp.y, bp.x + 1)) { dirmask |= EAST; count++; }
      if (dirmask === 0 && !w(bp.y - 1, bp.x)) { dirmask |= NORTH; count++; }
      break;
  }
  if (count === 0) {
    // No place to go. Just sit here for a while and wait.
    saveBullet(g, bp);
    return;
  }
  if (bp.charge < count) {
    while (count > bp.charge) {
      if (dirmask & WEST) dirmask &= ~WEST;
      else if (dirmask & EAST) dirmask &= ~EAST;
      else if (dirmask & NORTH) dirmask &= ~NORTH;
      else if (dirmask & SOUTH) dirmask &= ~SOUTH;
      count--;
    }
  }
  const i = Math.trunc(bp.charge / count);
  const j = bp.charge % count;
  const child = (y, x, face, charge) => {
    const nbp = createShot(g, bp.type, y, x, face, charge, bp.size, bp.owner, bp.score, true, SPACE);
    nbp.oozing = true;
    moveSlime(g, nbp, speed - 1, blist, nextK);
  };
  if (dirmask & WEST) { count--; child(bp.y, bp.x - 1, LEFTS, i); }
  if (dirmask & EAST) { count--; child(bp.y, bp.x + 1, RIGHT, count < j ? i + 1 : i); }
  if (dirmask & NORTH) { count--; child(bp.y - 1, bp.x, ABOVE, count < j ? i + 1 : i); }
  if (dirmask & SOUTH) { count--; child(bp.y + 1, bp.x, BELOW, count < j ? i + 1 : i); }
}

// shots.c:969-995
function iswall(g, y, x) {
  if (y < 0 || x < 0 || y >= HEIGHT || x >= WIDTH) return true;
  switch (g.maze[IDX(y, x)]) {
    case WALL1: case WALL2: case WALL3: case WALL4: case WALL5: case DOOR: case SLIME: case LAVA:
      return true;
  }
  return false;
}

// shots.c:1002-1021 — note the C compares against the shot's position BEFORE
// the cell it just moved into (bp->b_x has not been updated yet).
function zapshot(g, list, from, obp) {
  let explode = false;
  for (let k = from; k < list.length; k++) {
    const bp = list[k];
    if (bp.x !== obp.x || bp.y !== obp.y) continue;
    if (bp.face === obp.face) continue;
    explode = true;
    break;
  }
  if (!explode) return;
  explshot(g, list, from, obp.y, obp.x);
}

// shots.c:1027-1040
function explshot(g, list, from, y, x) {
  for (let k = from; k < list.length; k++) {
    const bp = list[k];
    if (bp.x === x && bp.y === y) {
      bp.expl = true;
      const owner = ownerOf(g, bp);
      if (owner) message(g, owner, 'Shot intercepted');
      emit(g, { t: 'intercept', id: bp.id, x, y });
    }
  }
}

// shots.c:1088-1098
function isBullet(g, y, x) {
  for (const bp of g.bullets) if (bp.y === y && bp.x === x) return bp;
  return null;
}

// shots.c:1105-1115
function fixshots(g, y, x, over) {
  for (const bp of g.bullets) if (bp.y === y && bp.x === x) bp.over = over;
}

// shots.c:1122-1133
function findUnder(list, bp) {
  for (const nbp of list) {
    if (bp.y === nbp.y && bp.x === nbp.x) {
      bp.over = nbp.over;
      break;
    }
  }
}

// shots.c:1139-1150
function markPlayer(g, bp) {
  for (let n = 0; n < g.np; n++) {
    const pp = g.slots[n];
    if (pp.y === bp.y && pp.x === bp.x) {
      pp.undershot = true;
      break;
    }
  }
}

// shots.c:1157-1168
function markBoot(g, bp) {
  for (const pp of g.boots) {
    if (pp.y === bp.y && pp.x === bp.x) {
      pp.undershot = true;
      break;
    }
  }
}

// --------------------------------------------------------------- execute.c

// execute.c:77-188 — one keystroke.
export function execute(g, pp, ch) {
  const c = String.fromCharCode(ch);
  if (pp.flying >= 0) {
    if (c === 'q') pp.death = '| Quit |';
    return;
  }
  switch (c) {
    case 'h': movePlayer(g, pp, LEFTS); break;
    case 'H': face(g, pp, LEFTS); break;
    case 'j': movePlayer(g, pp, BELOW); break;
    case 'J': face(g, pp, BELOW); break;
    case 'k': movePlayer(g, pp, ABOVE); break;
    case 'K': face(g, pp, ABOVE); break;
    case 'l': movePlayer(g, pp, RIGHT); break;
    case 'L': face(g, pp, RIGHT); break;
    case 'f': case '1': fire(g, pp, 0); break;
    case 'g': case '2': fire(g, pp, 1); break;
    case 'F': case '3': fire(g, pp, 2); break;
    case 'G': case '4': fire(g, pp, 3); break;
    case '5': fire(g, pp, 4); break;
    case '6': fire(g, pp, 5); break;
    case '7': fire(g, pp, 6); break;
    case '8': fire(g, pp, 7); break;
    case '9': fire(g, pp, 8); break;
    case '0': fire(g, pp, 9); break;
    case '@': fire(g, pp, 10); break;
    case 'o': fireSlime(g, pp, 0); break;
    case 'O': fireSlime(g, pp, 1); break;
    case 'p': fireSlime(g, pp, 2); break;
    case 'P': fireSlime(g, pp, 3); break;
    case 's': scan(g, pp); break;
    case 'c': cloak(g, pp); break;
    case 'q': pp.death = '| Quit |'; break;
  }
}

// execute.c:194-324 — moving never changes your facing: you can strafe and
// back up. Walking into someone you face stabs them.
function movePlayer(g, pp, dir) {
  let y = pp.y;
  let x = pp.x;
  switch (dir) {
    case LEFTS: x--; break;
    case RIGHT: x++; break;
    case ABOVE: y--; break;
    case BELOW: y++; break;
  }
  let moved = false;
  const i = IDX(y, x);
  const cell = g.maze[i];
  switch (cell) {
    case SPACE: case DOOR:
      moved = true;
      break;
    case WALL1: case WALL2: case WALL3: case WALL4: case WALL5:
      emit(g, { t: 'bump', id: pp.id, x, y });
      break;
    case MINE: case GMINE: {
      let prob;
      if (dir === pp.face) prob = 2;
      else if (opposite(dir, pp.face)) prob = 95;
      else prob = 50;
      pickup(g, pp, y, x, prob, cell);
      g.maze[i] = SPACE;
      moved = true;
      break;
    }
    case SHOT: case GRENADE: case SATCHEL: case BOMB: case SLIME: {
      const bp = isBullet(g, y, x);
      if (bp) bp.expl = true;
      g.maze[i] = SPACE;
      moved = true;
      break;
    }
    case LEFTS: case RIGHT: case ABOVE: case BELOW:
      if (dir !== pp.face) {
        emit(g, { t: 'bell', id: pp.id });
      } else {
        const newp = playAt(g, y, x);
        emit(g, { t: 'stab', id: pp.id, who: newp.id, x, y });
        checkdam(g, newp, pp, ident(g, pp), K.STABDAM, KNIFE);
      }
      break;
    case FLYER: {
      const newp = playAt(g, y, x);
      message(g, newp, "Oooh, there's a short guy waving at you!");
      message(g, pp, "You couldn't quite reach him!");
      break;
    }
    case BOOT: case BOOT_PAIR: {
      if (cell === BOOT) pp.nboots++;
      else pp.nboots += 2;
      for (const newp of g.boots) {
        if (newp.flying < 0) continue;
        if (newp.y === y && newp.x === x) {
          newp.flying = -1;
          if (newp.undershot) fixshots(g, y, x, newp.over);
        }
      }
      if (pp.nboots === 2) message(g, pp, 'Wow!  A pair of boots!');
      else message(g, pp, 'You can hobble around on one boot.');
      emit(g, { t: 'boots', id: pp.id, x, y, n: pp.nboots });
      g.maze[i] = SPACE;
      moved = true;
      break;
    }
  }
  if (moved) {
    if (pp.ncshot > 0) --pp.ncshot;
    if (pp.undershot) {
      fixshots(g, pp.y, pp.x, pp.over);
      pp.undershot = false;
    }
    const fx = pp.x;
    const fy = pp.y;
    drawplayer(g, pp, false);
    pp.over = g.maze[i];
    pp.y = y;
    pp.x = x;
    drawplayer(g, pp, true);
    emit(g, { t: 'move', id: pp.id, fx, fy, x, y });
  }
}

// execute.c:330-339
function face(g, pp, dir) {
  if (pp.face !== dir) {
    pp.face = dir;
    drawplayer(g, pp, true);
    emit(g, { t: 'turn', id: pp.id, face: dir });
  }
}

// Override flag: infinite ammo tops a human up before each shot.
function topUp(g, pp, need) {
  if (g.cheats.infiniteAmmo && humanSlot(g, pp) && pp.ammo < need) pp.ammo = need;
}

// execute.c:345-387 — you get the biggest weapon you can afford up to the
// one you asked for. Firing flashes the shot on EVERY screen, which gives
// your position away for EXPLEN steps.
function fire(g, pp, reqIndex) {
  topUp(g, pp, K.SHOT_REQ[reqIndex]);
  while (reqIndex >= 0 && pp.ammo < K.SHOT_REQ[reqIndex]) reqIndex--;
  if (reqIndex < 0) {
    message(g, pp, 'Not enough charges.');
    return;
  }
  if (pp.ncshot > K.MAXNCSHOT) { emit(g, { t: 'hot', id: pp.id }); return; }
  pp.ncshot++;
  pp.ammo -= K.SHOT_REQ[reqIndex];
  const bp = addShot(g, K.SHOT_TYPE[reqIndex], pp.y, pp.x, pp.face, K.SHOT_REQ[reqIndex], pp, false, pp.face);
  pp.undershot = true;
  emit(g, { t: 'fire', id: pp.id, bid: bp.id, x: pp.x, y: pp.y, face: pp.face, type: bp.type, charge: bp.charge });
  showexpl(g, pp.y, pp.x, K.SHOT_TYPE[reqIndex]);
}

// execute.c:394-436 — slime charge is three times the ammo spent.
function fireSlime(g, pp, reqIndex) {
  topUp(g, pp, K.SLIME_REQ[reqIndex]);
  while (reqIndex >= 0 && pp.ammo < K.SLIME_REQ[reqIndex]) reqIndex--;
  if (reqIndex < 0) {
    message(g, pp, 'Not enough charges.');
    return;
  }
  if (pp.ncshot > K.MAXNCSHOT) { emit(g, { t: 'hot', id: pp.id }); return; }
  pp.ncshot++;
  pp.ammo -= K.SLIME_REQ[reqIndex];
  const bp = addShot(g, SLIME, pp.y, pp.x, pp.face, K.SLIME_REQ[reqIndex] * K.SLIME_FACTOR, pp, false, pp.face);
  pp.undershot = true;
  emit(g, { t: 'fire', id: pp.id, bid: bp.id, x: pp.x, y: pp.y, face: pp.face, type: SLIME, charge: bp.charge });
  showexpl(g, pp.y, pp.x, SLIME);
}

// execute.c:525-549 — cloak hides you from scanners (not from sight).
function cloak(g, pp) {
  topUp(g, pp, 1);
  if (pp.ammo <= 0) {
    message(g, pp, 'No more charges');
    return;
  }
  if (pp.nboots > 0) {
    message(g, pp, 'Boots are too noisy to cloak!');
    return;
  }
  --pp.ammo;
  pp.cloak += K.CLOAKLEN;
  if (pp.scan >= 0) pp.scan = -1;
  emit(g, { t: 'cloak', id: pp.id });
}

// execute.c:555-573 — scan shows every uncloaked player who moves.
function scan(g, pp) {
  topUp(g, pp, 1);
  if (pp.ammo <= 0) {
    message(g, pp, 'No more charges');
    return;
  }
  --pp.ammo;
  pp.scan += g.nplayer * 20; // SCANLEN
  if (pp.cloak >= 0) pp.cloak = -1;
  emit(g, { t: 'scan', id: pp.id });
}

// execute.c:579-607 — stepping onto a mine: trip it or defuse it for ammo.
function pickup(g, pp, y, x, prob, obj) {
  const req = obj === MINE ? K.BULREQ : K.GRENREQ;
  if (randNum(g, 100) < prob) {
    addShot(g, obj, y, x, LEFTS, req, null, true, pp.face);
    emit(g, { t: 'trip', id: pp.id, x, y, big: obj === GMINE });
  } else {
    pp.ammo += req;
    emit(g, { t: 'defuse', id: pp.id, x, y, big: obj === GMINE, ammo: req });
  }
}

// ---------------------------------------------------------------- driver.c

// driver.c:475-603 — damage, death and kill credit. A kill raises the
// killer's damage capacity by 2 and heals 2; the score is the (decayed)
// ratio kills / entries. Killing yourself or a teammate costs a kill.
export function checkdam(g, ouch, gotcha, credit, amt, shotType) {
  if (ouch.death !== '') return;
  if (g.cheats.god && humanSlot(g, ouch)) {
    emit(g, { t: 'hurt', who: ouch.id, amt: 0, type: shotType, x: ouch.x, y: ouch.y, blocked: true });
    return;
  }
  if (shotType === SLIME) {
    switch (ouch.nboots) {
      case 1: amt = Math.trunc((amt + 1) / 2); break;
      case 2:
        if (gotcha) message(g, gotcha, 'He has boots on!');
        return;
    }
  }
  ouch.damage += amt;
  emit(g, { t: 'hurt', who: ouch.id, amt, type: shotType, x: ouch.x, y: ouch.y, by: gotcha ? gotcha.id : null });
  if (ouch.damage <= ouch.damcap) return;

  // Someone DIED
  let cp;
  switch (shotType) {
    default: cp = 'Killed'; break;
    case FALL: cp = 'Killed on impact'; break;
    case KNIFE: cp = 'Stabbed to death'; ouch.ammo = 0; break;
    case SHOT: cp = 'Shot to death'; break;
    case GRENADE: case SATCHEL: case BOMB: cp = 'Bombed'; break;
    case MINE: case GMINE: cp = 'Blown apart'; break;
    case SLIME:
      cp = 'Slimed';
      if (credit) credit.slime++;
      break;
    case LAVA: cp = 'Baked'; break;
  }
  if (!credit) {
    ouch.death = `| ${cp} by ${(shotType === MINE || shotType === GMINE) ? 'a mine' : 'act of God'} |`;
    return;
  }
  ouch.death = `| ${cp} by ${credit.name} |`;
  const oid = ident(g, ouch);
  if (ouch === gotcha) { // No use killing yourself
    credit.kills = Math.fround(credit.kills - 1);
    credit.bkills++;
  } else if (oid.team === SPACE || oid.team !== credit.team) {
    credit.kills = Math.fround(credit.kills + 1);
    credit.gkills++;
  } else {
    credit.kills = Math.fround(credit.kills - 1);
    credit.bkills++;
  }
  credit.score = Math.fround(credit.kills / credit.entries);
  oid.deaths++;
  if (!ouch.typed) oid.stillb++;
  if (!gotcha) return;
  gotcha.damcap += K.STABDAM;
  gotcha.damage -= K.STABDAM;
  if (gotcha.damage < 0) gotcha.damage = 0;
}

// driver.c:609-735 — a dead player leaves the maze; their remaining ammo
// may go off as a bomb or slime where they fell, feeding the volcano.
function zap(g, i) {
  const pp = g.slots[i];
  if (pp.undershot) fixshots(g, pp.y, pp.x, pp.over);
  drawplayer(g, pp, false);
  g.nplayer--;

  for (const bp of g.bullets) {
    if (bp.owner === i) bp.owner = -1;
    if (bp.x === pp.x && bp.y === pp.y) bp.over = SPACE;
  }

  let n = randNum(g, pp.ammo);
  let x = randNum(g, pp.ammo);
  let y;
  let len = SLIME;
  if (x > n) n = x;
  if (pp.ammo === 0) {
    x = 0;
  } else if (n === pp.ammo - 1) {
    x = pp.ammo;
    len = SLIME;
  } else {
    for (x = K.MAXBOMB - 1; x > 0; x--) if (n >= K.SHOT_REQ[x]) break;
    for (y = K.MAXSLIME - 1; y > 0; y--) if (n >= K.SLIME_REQ[y]) break;
    if (y >= 0 && K.SLIME_REQ[y] > K.SHOT_REQ[x]) {
      x = K.SLIME_REQ[y];
      len = SLIME;
    } else if (x !== 0) {
      len = K.SHOT_TYPE[x];
      x = K.SHOT_REQ[x];
    }
  }
  emit(g, { t: 'death', id: pp.id, name: nameOf(g, pp), x: pp.x, y: pp.y, text: pp.death, detonate: x > 0 ? { type: len, charge: x } : null });
  if (x > 0) {
    addShot(g, len, pp.y, pp.x, pp.face, x, null, true, SPACE);
    const text = `${nameOf(g, pp)} detonated.`;
    for (let k = 0; k < g.np; k++) message(g, g.slots[k], text);
    while (pp.nboots-- > 0) {
      const np = g.boots.find((b) => b.flying < 0);
      if (!np) throw new Error('Too many boots');
      np.undershot = false;
      np.x = pp.x;
      np.y = pp.y;
      np.flying = randNum(g, 20);
      np.flyx = 2 * randNum(g, 6) - 5;
      np.flyy = 2 * randNum(g, 6) - 5;
      np.over = SPACE;
      np.face = BOOT;
      showexpl(g, np.y, np.x, BOOT);
    }
  } else if (pp.nboots > 0) {
    g.maze[IDX(pp.y, pp.x)] = pp.nboots === 2 ? BOOT_PAIR : BOOT;
    if (pp.undershot) fixshots(g, pp.y, pp.x, g.maze[IDX(pp.y, pp.x)]);
  }

  // VOLCANO
  g.volcano += pp.ammo - x;
  if (randNum(g, 100) < Math.trunc(g.volcano / 50)) {
    let vx;
    let vy;
    do {
      vx = randNum(g, Math.trunc(WIDTH / 2)) + Math.trunc(WIDTH / 4);
      vy = randNum(g, Math.trunc(HEIGHT / 2)) + Math.trunc(HEIGHT / 4);
    } while (g.maze[IDX(vy, vx)] !== SPACE);
    addShot(g, LAVA, vy, vx, LEFTS, g.volcano, null, true, SPACE);
    for (let k = 0; k < g.np; k++) message(g, g.slots[k], 'Volcano eruption.');
    emit(g, { t: 'volcano', x: vx, y: vy, charge: g.volcano });
    g.volcano = 0;
  }

  // End_player--; memcpy(pp, End_player) — the stale copy stays behind.
  g.np--;
  if (i !== g.np) g.slots[i] = cloneSlot(g.slots[g.np]);
}

function cloneSlot(s) {
  return { ...s, mem: s.mem.slice(), scr: s.scr.slice(), q: s.q.slice() };
}

// ---------------------------------------------------------------- answer.c

// answer.c:377-429
function getIdent(g, name, team) {
  let ip = g.scores.find((s) => s.name === name && s.team === team);
  if (ip) {
    if (ip.entries < K.SCOREDECAY) ip.entries++;
    else ip.kills = Math.fround(Math.fround(ip.kills * (K.SCOREDECAY - 1)) / K.SCOREDECAY);
    ip.score = Math.fround(ip.kills / ip.entries);
  } else {
    ip = {
      iid: g.nextId++, name, team, kills: 0, entries: 1, score: 0,
      absorbed: 0, faced: 0, shot: 0, robbed: 0, slime: 0, missed: 0, ducked: 0,
      gkills: 0, bkills: 0, deaths: 0, stillb: 0, saved: 0,
    };
    g.scores.unshift(ip);
  }
  return ip;
}

// answer.c:356-371
function randDir(g) {
  switch (randNum(g, 4)) {
    case 0: return LEFTS;
    case 1: return RIGHT;
    case 2: return BELOW;
    default: return ABOVE;
  }
}

// answer.c:229-350 — a player enters: random empty cell, random facing,
// 15 ammo, cloaked by default. Every entry drops one small and one large
// mine somewhere and gives 5 ammo to the newcomer per player already in the
// game and 5 to each of them.
export function connect(g, name, team = ' ', status = K.Q_CLOAK) {
  if (g.np >= K.MAXPL) return null;
  if (g.slots.length <= g.np) g.slots.push(newSlot());
  const pp = g.slots[g.np++];
  const ip = getIdent(g, name, typeof team === 'number' ? team : team.charCodeAt(0));
  pp.iid = ip.iid;
  pp.id = g.nextId++;
  pp.death = '';
  pp.q = [];
  pp.y = 0;
  pp.x = 0;
  stplayer(g, pp, status);
  return pp;
}

function stplayer(g, newpp, status) {
  g.nplayer++;
  const M = g.maze;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const border = y < UBOUND || y >= DBOUND || x < LBOUND || x >= RBOUND;
      newpp.mem[IDX(y, x)] = border ? M[IDX(y, x)] : SPACE;
      newpp.scr[IDX(y, x)] = newpp.mem[IDX(y, x)]; // drawmaze() after CLEAR
    }
  }
  let x;
  let y;
  do {
    x = randNum(g, WIDTH - 1) + 1;
    y = randNum(g, HEIGHT - 1) + 1;
  } while (M[IDX(y, x)] !== SPACE);
  newpp.over = SPACE;
  newpp.x = x;
  newpp.y = y;
  newpp.undershot = false;
  if (status === K.Q_FLY) {
    newpp.flying = randNum(g, 20);
    newpp.flyx = 2 * randNum(g, 6) - 5;
    newpp.flyy = 2 * randNum(g, 6) - 5;
    newpp.face = FLYER;
  } else {
    newpp.flying = -1;
    newpp.face = randDir(g);
  }
  newpp.damage = 0;
  newpp.damcap = K.MAXDAM;
  newpp.typed = false;
  newpp.ammo = K.ISHOTS;
  newpp.nboots = 0;
  if (status === K.Q_SCAN) {
    newpp.scan = g.nplayer * 20;
    newpp.cloak = 0;
  } else {
    newpp.scan = 0;
    newpp.cloak = K.CLOAKLEN;
  }
  newpp.ncshot = 0;

  do {
    x = randNum(g, WIDTH - 1) + 1;
    y = randNum(g, HEIGHT - 1) + 1;
  } while (M[IDX(y, x)] !== SPACE);
  M[IDX(y, x)] = GMINE;
  do {
    x = randNum(g, WIDTH - 1) + 1;
    y = randNum(g, HEIGHT - 1) + 1;
  } while (M[IDX(y, x)] !== SPACE);
  M[IDX(y, x)] = MINE;

  for (let n = 0; n < g.np; n++) {
    const pp = g.slots[n];
    if (pp !== newpp) {
      pp.ammo += K.NSHOTS;
      newpp.ammo += K.NSHOTS;
    }
  }
  drawplayer(g, newpp, true);
  look(g, newpp);
  if (status === K.Q_FLY) showexpl(g, newpp.y, newpp.x, FLYER);
  emit(g, { t: 'enter', id: newpp.id, name: nameOf(g, newpp), x: newpp.x, y: newpp.y, status });
}

// ------------------------------------------------------------- the loop

// Queue a keystroke (typeahead). Returns false when the buffer is full.
export function key(g, pp, chars, max = Infinity) {
  let ok = true;
  for (const c of chars) {
    if (pp.q.length >= max) { ok = false; break; }
    pp.q.push(typeof c === 'number' ? c : c.charCodeAt(0));
    pp.typed = true;
  }
  return ok;
}

// Ask for a (re-)entry; answered at the end of a step, one per step, like
// answer() in driver.c's loop. delay (steps) is this port's respawn pause;
// the original client reconnects at once (delay 0).
export function requestJoin(g, name, team = ' ', status = K.Q_CLOAK, delay = 0) {
  g.joinq.push({ name, team: typeof team === 'number' ? team : team.charCodeAt(0), status, at: g.step + delay });
}

// One pass of driver.c's main loop (driver.c:178-212 + answer()).
// think (optional) runs once the world has moved: the bots.
export function step(g, think) {
  g.ev = [];
  g.trails = [];
  g.step++;
  for (let n = 0; n < g.np; n++) {
    const pp = g.slots[n];
    if (pp.q.length) execute(g, pp, pp.q.shift());
  }
  moveshots(g);
  for (let i = 0; i < g.np;) {
    const pp = g.slots[i];
    if (pp.death === '') { i++; continue; }
    const name = nameOf(g, pp);
    const team = ident(g, pp).team;
    const status = pp.enter ?? K.Q_CLOAK;
    zap(g, i);
    // otto's quit() re-enters cloaked; humans re-enter with their choice.
    if (g.bots[name] && g.autorejoin) requestJoin(g, name, team, K.Q_CLOAK, g.rejoinDelay || 0);
    else if (g.humans.includes(name) && g.autorejoin) requestJoin(g, name, team, status, g.cheats.instantRespawn ? 0 : (g.rejoinDelay || 0));
  }
  const k = g.joinq.findIndex((j) => j.at <= g.step);
  if (k >= 0) {
    const j = g.joinq.splice(k, 1)[0];
    const pp = connect(g, j.name, j.team, j.status);
    if (pp) pp.enter = j.status;
  }
  if (think) think(g);
  return g.ev;
}

// Plain-data snapshot / restore (JSON round trip keeps everything).
export const snapshot = (g) => JSON.stringify(g);
export const restore = (s) => JSON.parse(s);

export { IDX, SEE_OVER, iswall, randDir };
