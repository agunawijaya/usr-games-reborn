// The dogfight of fly.c as a headless, tick-driven simulation.
//
// Original: https://github.com/vattam/BSDGames/tree/master/battlestar/fly.c
// Copyright (c) 1983, 1993 The Regents of the University of California.
//
// fly.c draws a Cylon ("/-\") on a curses screen and moves it once per
// second from a SIGALRM handler (moveenemy). The player's keys do not move
// a crosshair: they set a persistent drift (dr, dc) of the *enemy* relative
// to the fixed crosshair at the screen centre -- i.e. they turn the ship.
// A torpedo hits when the enemy sits on the centre row within one column
// of the centre. The renderer turns (row, column) into a bearing off the
// nose of a 3D cockpit; this file only keeps the arithmetic.
//
// The virtual terminal is 24 x 80 (LINES x COLS), so MIDR = 11, MIDC = 39.
// Random numbers are drawn in exactly the order fly.c draws them so that
// the game's shared rand() stream stays aligned with the original.

export const LINES = 24;
export const COLS = 80;
export const MIDR = Math.trunc(LINES / 2) - 1; // 11
export const MIDC = Math.trunc(COLS / 2) - 1; // 39

export class FlightSim {
  /**
   * @param {object} g   the Battlestar engine (fuel, torps, ourclock, flight
   *                     persistents, rng, overrides are read and written)
   */
  constructor(g) {
    this.g = g;
    this.destroyed = false;
    this.done = false;
    this.outcome = null; // 'destroyed' | 'quit' | 'timeout'
    this.messages = []; // curses status lines: {row, col, text}
    this.stars = [];
    this.shots = 0;
    this.ticks = 0;
    this.lastKey = null;
    this.blastAt = -1; // tick index of the last torpedo (for the renderer)
    this.hitAt = -1;
    // visual(): screen(); row = rnd(LINES-3)+1; column = rnd(COLS-2)+1; moveenemy(0);
    this._screen();
    this.row = g.rng.rnd(LINES - 3) + 1;
    this.column = g.rng.rnd(COLS - 2) + 1;
    this.prevRow = this.row;
    this.prevColumn = this.column;
    this._moveenemy();
    // What the first curses frame shows (golden tests compare these).
    this.firstRow = this.row;
    this.firstColumn = this.column;
    this.firstTorps = g.torps;
    this.firstFuel = g.fuel;
    this.firstClock = g.ourclock;
  }

  get dr() { return this.g.flight.dr; }
  get dc() { return this.g.flight.dc; }
  get cross() { return this.g.flight.cross; }

  _screen() {
    const i = this.g.rng.rnd(100);
    for (let n = 0; n < i; n++) {
      const r = this.g.rng.rnd(LINES - 3) + 1;
      const c = this.g.rng.rnd(COLS);
      this.stars.push([r, c]);
    }
  }

  _say(row, col, text) {
    this.messages = this.messages.filter((m) => !(m.row === row && m.col === col));
    this.messages.push({ row, col, text, at: this.ticks });
  }

  /** moveenemy(): one second of the SIGALRM clock. */
  _moveenemy() {
    const g = this.g;
    this.prevRow = this.row;
    this.prevColumn = this.column;
    const { dr, dc } = g.flight;
    if (g.fuel > 0) {
      if (this.row + dr <= LINES - 3 && this.row + dr > 0) this.row += dr;
      if (this.column + dc < COLS - 1 && this.column + dc > 0) this.column += dc;
    } else if (g.fuel < 0) {
      g.fuel = 0;
      this._say(0, 60, '*** Out of fuel ***');
    }
    const d = (this.row - MIDR) * (this.row - MIDR) + (this.column - MIDC) * (this.column - MIDC);
    if (d < 16) {
      // C '%' truncates toward zero, as JS '%' does.
      this.row += (g.rng.rnd(9) - 4) % (4 - Math.abs(this.row - MIDR));
      this.column += (g.rng.rnd(9) - 4) % (4 - Math.abs(this.column - MIDC));
    }
    g.ourclock--;
  }

  /** Host calls this once per second of real time (or once per key in turn-based mode). */
  tick() {
    if (this.done) return;
    this.ticks++;
    this._moveenemy();
  }

  /**
   * One getchar() of the visual() loop. Returns true if the key was a
   * command (for turn-based pacing), false for help / unknown keys.
   */
  key(ch) {
    if (this.done) return false;
    const g = this.g;
    const f = g.flight;
    const burn = (n) => { if (!g.ovr.infiniteFuel) g.fuel -= n; };
    this.lastKey = ch;
    switch (ch) {
      case 'h': case 'r': f.dc = -1; burn(1); break;
      case 'H': case 'R': f.dc = -5; burn(10); break;
      case 'l': f.dc = 1; burn(1); break;
      case 'L': f.dc = 5; burn(10); break;
      case 'j': case 'u': f.dr = 1; burn(1); break;
      case 'J': case 'U': f.dr = 5; burn(10); break;
      case 'k': case 'd': f.dr = -1; burn(1); break;
      case 'K': case 'D': f.dr = -5; burn(10); break;
      case '+': f.cross = f.cross ? 0 : 1; break;
      case ' ': case 'f':
        if (g.torps) {
          if (!g.ovr.infiniteTorps) g.torps -= 2;
          this.shots++;
          this.blastAt = this.ticks;
          if (this.row === MIDR && this.column - MIDC < 2 && MIDC - this.column < 2) {
            this.destroyed = true;
            this.hitAt = this.ticks;
          }
        } else this._say(0, 0, '*** Out of torpedoes. ***');
        break;
      case 'q':
        this.done = true;
        this.outcome = 'quit';
        return true;
      case null: case undefined: case -1: // EOF from a script: getchar() == EOF
        break;
      default:
        this._say(0, 26, 'Commands = r,R,l,L,u,U,d,D,f,+,q');
        return false; // `continue` in fly.c: no destroyed/clock check
    }
    if (this.destroyed) {
      this.done = true;
      this.outcome = 'destroyed';
    } else if (g.ourclock <= 0) {
      this.done = true;
      this.outcome = 'timeout';
    }
    return true;
  }

  /** Snapshot for the renderer / HUD. */
  view() {
    return {
      row: this.row, column: this.column, prevRow: this.prevRow, prevColumn: this.prevColumn,
      dr: this.dr, dc: this.dc, cross: this.cross,
      torps: this.g.torps, fuel: this.g.fuel, clock: this.g.ourclock,
      stars: this.stars, messages: this.messages, shots: this.shots,
      ticks: this.ticks, blastAt: this.blastAt, hitAt: this.hitAt,
      done: this.done, outcome: this.outcome,
    };
  }
}

/**
 * A simple autopilot used by tests, hints and the demo: steer the drift
 * toward the centre and fire when aligned. Returns the key to press, or
 * null to just let a tick pass.
 */
export function autopilotKey(sim) {
  const v = sim.view();
  if (v.torps <= 0 && !sim.g.ovr.infiniteTorps) return 'q';
  if (v.row === MIDR && Math.abs(v.column - MIDC) < 2) return 'f';
  const wantDc = v.column < MIDC ? (MIDC - v.column > 8 ? 5 : 1) : (v.column - MIDC > 8 ? -5 : -1);
  const wantDr = v.row < MIDR ? (MIDR - v.row > 6 ? 5 : 1) : (v.row - MIDR > 6 ? -5 : -1);
  if (v.column !== MIDC && v.dc !== wantDc) return { 5: 'L', 1: 'l', '-1': 'r', '-5': 'R' }[wantDc];
  if (v.row !== MIDR && v.dr !== wantDr) return { 5: 'U', 1: 'u', '-1': 'd', '-5': 'D' }[wantDr];
  return null;
}
