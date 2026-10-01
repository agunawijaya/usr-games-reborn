// Constants of the sail rules engine.
//
// Ported from the original BSD sail (Dave Riggle, Ed Wang, Craig Leres):
//   load/ready codes    <- sail/extern.h:94-110
//   name tables         <- sail/globals.c:504-544
// Copyright (c) 1983, 1993 The Regents of the University of California.

// Shot types (loadL / loadR). L_EMPTY must stay 0.
export const L_EMPTY = 0;
export const L_GRAPE = 1;
export const L_CHAIN = 2;
export const L_ROUND = 3;
export const L_DOUBLE = 4;
export const L_EXPLODE = 5; // pseudo-shot used for exploding-ship damage

// Readiness bit flags (readyL / readyR).
export const R_EMPTY = 0;
export const R_LOADING = 1;
export const R_DOUBLE = 2;
export const R_LOADED = 4;
export const R_INITIAL = 8;

export const HULL = 0;
export const RIGGING = 1;

export const NBP = 3; // boarding-party slots per ship (offense and defense)

export const RANGE_OF_SHOT = [0, 1, 3, 10, 1]; // indexed by L_*
export const LOAD_NAME = ['-', 'G', 'C', 'R', 'D', 'E'];
export const LOAD_WORD = ['empty', 'grape', 'chain', 'round', 'double', 'explode'];
export const LOAD_BY_WORD = { grape: L_GRAPE, chain: L_CHAIN, round: L_ROUND, double: L_DOUBLE };

export const COUNTRY = ['American', 'British', 'Spanish', 'French', 'Japanese', 'Federation', 'Klingon', 'Orion'];
export const CLASS_NAME = ['Drift wood', 'Ship of the Line', 'Ship of the Line', 'Frigate', 'Corvette', 'Sloop', 'Brig'];
export const QUAL_NAME = ['dead', 'mutinous', 'green', 'mundane', 'crack', 'elite'];
export const DIRECTION_NAME = [
  'dead ahead', 'off the starboard bow', 'off the starboard beam', 'off the starboard quarter',
  'dead astern', 'off the port quarter', 'off the port beam', 'off the port bow', 'dead ahead',
];
export const COMPASS = ['', 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const WIND_NAME = ['becalmed', 'light breeze', 'moderate breeze', 'fresh breeze',
  'strong breeze', 'gale', 'full gale', 'hurricane'];

// Grid deltas. A ship's STERN is at (row + DR[dir], col + DC[dir]); moving
// forward subtracts them. dir 1 = north (row decreasing), clockwise.
export const DR = [0, 1, 1, 0, -1, -1, -1, 0, 1];
export const DC = [0, 0, -1, -1, -1, 0, 1, 1, 1];
// Diagonal distances: moving N squares diagonally covers DTAB[N] rows/cols.
export const DTAB = [0, 1, 1, 2, 3, 4, 4, 5];

// Port additions -----------------------------------------------------------
export const MAX_TURNS = 200; // battle broken off at nightfall (ADR 003)
