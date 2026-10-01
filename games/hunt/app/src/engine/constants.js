// hunt(6) constants, from huntd/hunt.h, huntd/extern.c and hunt/Makeconfig.
//
// Original: Copyright (c) 1983-2003, Regents of the University of
// California (Conrad Huang, Gregory Couch, Kenneth Arnold, UCSF CGL).
// https://github.com/vattam/BSDGames/tree/master/hunt
//
// The build flags that shape the rules are the Linux defaults in
// hunt/Makeconfig:27: RANDOM REFLECT MONITOR OOZE FLY VOLCANO BOOTS OTTO.
// DRONE is not enabled there, so the wandering "?" bomb does not exist.

const c = (s) => s.charCodeAt(0);

// hunt.h:120-126 — the maze is 51 x 23, NOT the 80 x 24 terminal.
export const WIDTH = 51;
export const HEIGHT = 23;
export const UBOUND = 1;
export const DBOUND = HEIGHT - 1;
export const LBOUND = 1;
export const RBOUND = WIDTH - 1;
export const SCREEN_WIDTH = 80;
export const SCREEN_HEIGHT = 24;

// hunt.h:105-111 (MONITOR defined): 15 players + 1 monitor.
export const MAXPL = 15;

// Maze characters, hunt.h:146-183.
export const DOOR = c('#');
export const WALL1 = c('-');
export const WALL2 = c('|');
export const WALL3 = c('+');
export const WALL4 = c('/');
export const WALL5 = c('\\');
export const KNIFE = c('K');
export const SHOT = c(':');
export const GRENADE = c('o');
export const SATCHEL = c('O');
export const BOMB = c('@');
export const MINE = c(';');
export const GMINE = c('g');
export const SLIME = c('$');
export const LAVA = c('~');
export const FALL = c('F');
export const BOOT = c('b');
export const BOOT_PAIR = c('B');
export const SPACE = c(' ');
export const NBOOTS = 2;

// Facing glyphs as stored in the maze: other players see these.
export const ABOVE = c('i');
export const BELOW = c('!');
export const RIGHT = c('}');
export const LEFTS = c('{');
export const FLYER = c('&');

export const isPlayer = (ch) => ch === LEFTS || ch === RIGHT || ch === ABOVE || ch === BELOW || ch === FLYER;
export const isWallChar = (ch) => ch === WALL1 || ch === WALL2 || ch === WALL3 || ch === WALL4 || ch === WALL5 || ch === DOOR;

// Status bits used by remap().
export const NORTH = 0o1;
export const SOUTH = 0o2;
export const EAST = 0o10;
export const WEST = 0o20;

// Rules, hunt.h:205-246.
export const BULSPD = 5;        // shots move 5 cells per step
export const ISHOTS = 15;       // ammo on entry
export const NSHOTS = 5;        // ammo gained by everyone when someone enters
export const MAXNCSHOT = 2;     // gun overheats after 3 shots until you move
export const MAXDAM = 10;       // initial damage capacity
export const MINDAM = 5;        // damage unit
export const STABDAM = 2;

export const BULREQ = 1;
export const GRENREQ = 9;
export const SATREQ = 25;
export const MAXBOMB = 11;
// extern.c:76-87
export const SHOT_REQ = [1, 9, 25, 49, 81, 121, 169, 225, 289, 361, 441];
export const SHOT_TYPE = [SHOT, GRENADE, SATCHEL, BOMB, BOMB, BOMB, BOMB, BOMB, BOMB, BOMB, BOMB];

export const SLIME_FACTOR = 3;
export const MAXSLIME = 4;
export const SLIMESPEED = 5;
export const LAVASPEED = 1;
// extern.c:89-91
export const SLIME_REQ = [5, 10, 15, 20];

export const CLOAKLEN = 20;
export const EXPLEN = 4;
export const MAXREMOVE = 40;    // expl.c:152
export const SCOREDECAY = 15;   // answer.c:46

// Enter status, hunt.h:248-252.
export const Q_QUIT = 0;
export const Q_CLOAK = 1;
export const Q_FLY = 2;
export const Q_SCAN = 3;

// Direction helpers for the renderer and bots.
export const FACES = [LEFTS, RIGHT, ABOVE, BELOW];
export const DX = { [LEFTS]: -1, [RIGHT]: 1, [ABOVE]: 0, [BELOW]: 0 };
export const DY = { [LEFTS]: 0, [RIGHT]: 0, [ABOVE]: -1, [BELOW]: 1 };

// draw.c:368-383 — your own glyph on your own screen.
export function translate(ch) {
  switch (ch) {
    case LEFTS: return c('<');
    case RIGHT: return c('>');
    case ABOVE: return c('^');
    case BELOW: return c('v');
  }
  return ch;
}

// shots.c:1064-1081
export function opposite(face, dir) {
  switch (face) {
    case LEFTS: return dir === RIGHT;
    case RIGHT: return dir === LEFTS;
    case ABOVE: return dir === BELOW;
    case BELOW: return dir === ABOVE;
    default: return false;
  }
}

// hunt.h:271-277 stat_char(): '&' flying, '+' cloaked, '*' scanning.
export function statChar(pp) {
  if (pp.flying >= 0) return '&';
  if (pp.cloak >= 0) return '+';
  return pp.scan < 0 ? ' ' : '*';
}

export const ch = c;
export const chr = (n) => String.fromCharCode(n);
