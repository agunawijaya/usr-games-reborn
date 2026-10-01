// Battlestar engine: a function-by-function port of the 1984 C program.
//
// Original: https://github.com/vattam/BSDGames/tree/master/battlestar
//   Copyright (c) 1983, 1993 The Regents of the University of California.
//   All rights reserved. "Battlestar - a stellar-tropical adventure game.
//   Originally written by His Lordship, Admiral David W. Horatio Riggle, on
//   the Cory PDP-11/70, University of California, Berkeley."
//
// Design (docs/architecture.md):
// - Every C global is a field of this class with the same name, so a reader
//   can hold battlestar.c open next to this file. Comments cite file:line.
// - Functions that block on input in C (getcom, fgets in su/save, the fight
//   prompt, the dogfight) are generators. The host pumps them: send() a line
//   of input, get back printed text and the next input request.
// - stdin is emulated as a character stream, so fgets(buf, 10) in `su` and the
//   "discard the rest of a long line" logic in getcom behave exactly as in C.
// - rand() is glibc's generator (rng.js): with the same seed the engine and a
//   real binary whose getpid() is pinned produce identical transcripts.
// - The engine is DOM-free and deterministic. Presentation hooks are
//   side-channel events (this.events) that never change the text stream.

import {
  C, DAYFILE, NIGHTFILE, DAYOBJS, NIGHTOBJS, OBJDES, OBJSHT, OUCH, OBJWT, OBJCUMBER, OBJFLAGS, WLIST,
} from './data/world.js';
import { GlibcRandom } from './rng.js';
import { FlightSim } from './flight.js';

const {
  KNIFE, SWORD, LAND, WOODSMAN, TWO_HANDED, CLEAVER, BROAD, MAIL, HELM, SHIELD, MAID, BODY, VIPER, LAMPON,
  CYLON, PAJAMAS, AMULET, MEDALION, TALISMAN, DEADWOOD, MALLET, LASER, BATHGOD, NORMGOD, GRENADE,
  CHAIN, ROPE, LEVIS, MACE, SHOVEL, HALBERD, COMPASS, CRASH, ELF, COINS, MATCHES, MAN, PAPAYAS,
  PINEAPPLE, KIWI, COCONUTS, MANGO, RING, POTION, BRACELET, GIRL, GIRLTALK, DARK, TIMER, CHAR, BOMB,
  DEADGOD, DEADTIME, DEADNATIVE, NATIVE, HORSE, CAR, NUMOFOBJECTS, ROBE, SHOES,
  UP, DOWN, AHEAD, BACK, RIGHT, LEFT, TAKE, USE, LOOK, QUIT, NORTH, SOUTH, EAST, WEST, SU, DROP, TAKEOFF,
  DRAW, PUTON, WEARIT, PUT, INVEN, EVERYTHING, AND, KILL, RAVAGE, UNDRESS, THROW, LAUNCH, LANDIT, LIGHT,
  FOLLOW, KISS, LOVE, GIVE, SMITE, SHOOT, ON, OFF, TIME, SLEEP, DIG, EAT, SWIM, DRINK, DOOR, SAVE, RIDE,
  DRIVE, SCORE, BURY, JUMP, KICK, OPEN, VERBOSE, BRIEF, AUXVERB,
  ARM, RIBS, SPINE, SKULL, INCISE, NECK, NUMOFINJURIES,
  CANTLAUNCH, LAUNCHED, CANTSEE, CANTMOVE, JINXED, DUG, NUMOFNOTES, ROOMDESC, NUMOFROOMS,
  LINELENGTH, TODAY, TONIGHT, CYCLE, TANKFULL, TORPEDOES, MAXWEIGHT, MAXCUMBER,
  FINAL, GARDEN, POOLS, DOCK, VERB, OBJECT, NOUNS, ADJS, WORDLEN, NWORD,
} = C;

const OBJ_PLURAL = 1;
const OBJ_AN = 2;
const DEFAULT_SAVE_FILE = '.Bstar';
export const SNAPSHOT_VERSION = 1;

// ------------------------------------------------------------------ helpers

/** The word table (parse.c wordinit/lookup). Exact-match lookup. */
const WORDS = new Map();
const MULTIPLY_DEFINED = [];
for (const [s, value, article] of WLIST) {
  if (WORDS.has(s)) MULTIPLY_DEFINED.push(s);
  else WORDS.set(s, { value, article });
}
export const VOCABULARY = WORDS;

const isspace = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\v' || c === '\f' || c === '\r';
const lower = (c) => (c >= 'A' && c <= 'Z' ? c.toLowerCase() : c);
/** printf("%s", p) with glibc's NULL handling. */
const S = (p) => (p === null || p === undefined ? '(null)' : p);
const objsht = (n) => (n >= 0 && n < NUMOFOBJECTS ? OBJSHT[n] : null);
const isPlural = (n) => n >= 0 && n < NUMOFOBJECTS && (OBJFLAGS[n] & OBJ_PLURAL);
const A_OR_AN = (n) => (n >= 0 && n < NUMOFOBJECTS && (OBJFLAGS[n] & OBJ_AN) ? 'an ' : 'a ');
const A_OR_AN_OR_THE = (n) => (isPlural(n) ? 'the ' : A_OR_AN(n));
const A_OR_AN_OR_BLANK = (n) => (isPlural(n) ? '' : A_OR_AN(n));
const IS_OR_ARE = (n) => (isPlural(n) ? 'are ' : 'is ');
const pad3 = (n) => String(n).padStart(3, ' ');
const max = (a, b) => (a < b ? b : a);
const trunc = Math.trunc;

/** 64-bit object set as two 32-bit words (extern.h testbit/setbit/clearbit). */
const newBits = () => new Uint32Array(2);
const testbit = (a, i) => (i >= 0 && i < 64 ? (a[i >> 5] >>> (i & 31)) & 1 : 0);
const setbit = (a, i) => { if (i >= 0 && i < 64) a[i >> 5] |= (1 << (i & 31)); };
const clearbit = (a, i) => { if (i >= 0 && i < 64) a[i >> 5] &= ~(1 << (i & 31)); };

/** Thrown by die()/live()/exit to unwind the generators. */
export class GameEnd extends Error {
  constructor(kind) { super(kind); this.kind = kind; }
}
/** Thrown by die() when the Override "invulnerable" flag averts a death. */
class DeathAverted extends Error {}

export const DEFAULT_OVERRIDES = Object.freeze({
  infiniteFuel: false, infiniteTorps: false, noHunger: false, noFatigue: false, invulnerable: false,
});

// Hereditary wizards and anti-wizards (init.c:95-112). The port asks for a
// "wizard name" instead of reading the Unix login (port ADR-005).
export const HEREDITARY_WIZARDS = ['riggle', 'chris', 'edward', 'comay', 'yee', 'dmr', 'ken'];
export const ANTI_WIZARDS = ['wnj', 'root', 'ted'];

function makeRooms(file) {
  const rooms = new Array(NUMOFROOMS + 1);
  rooms[0] = { link: new Int32Array(8), objects: newBits(), name: null, desc: null };
  for (let i = 1; i <= NUMOFROOMS; i++) {
    rooms[i] = { link: Int32Array.from(file[i].link), objects: newBits(), name: file[i].name, desc: file[i].desc };
  }
  return rooms;
}
// Room link accessors (extern.h struct room #defines).
const L_NORTH = 0, L_SOUTH = 1, L_EAST = 2, L_WEST = 3, L_UP = 4, L_ACCESS = 5, L_DOWN = 6, L_FLYHERE = 7;

// ------------------------------------------------------------------ engine

export class Battlestar {
  /**
   * @param {object} o
   * @param {number} [o.seed=1]          srand(getpid()) stand-in
   * @param {string} [o.username='']     the "login" checked against the wizard lists
   * @param {object} [o.snapshot]        a Battlestar.snapshot() to restore (the `-r` path)
   * @param {'start'|'prompt'} [o.resume] 'start' = like `battlestar -r` (news() runs again);
   *                                     'prompt' = continue exactly at the saved prompt
   * @param {'host'|'stdin'} [o.flightMode] 'stdin' reads dogfight keys from the input
   *                                     stream with no clock ticks (piped original)
   * @param {object} [o.overrides]       Override-panel flags (all false = original)
   * @param {function} [o.onSave]        (name, snapshot) => void|string  for the `save` verb
   */
  constructor(o = {}) {
    this.opts = o;
    this.seed = o.seed ?? 1;
    this.username = o.username ?? '';
    this.flightMode = o.flightMode ?? 'host';
    this.onSave = o.onSave ?? null;
    this.ovr = { ...DEFAULT_OVERRIDES, ...(o.overrides || {}) };
    this.cheated = Object.values(this.ovr).some(Boolean);

    // --- globals.c ---
    this.WEIGHT = MAXWEIGHT;
    this.CUMBER = MAXCUMBER;
    this.win = 1;
    this.matchcount = 20;
    this.followgod = -1;
    this.followfight = -1;
    this.words = new Array(NWORD).fill('');
    this.wordvalue = new Array(NWORD + 12).fill(0);
    this.wordtype = new Array(NWORD + 12).fill(0);
    this.wordcount = 0;
    this.wordnumber = 0;
    this.ourtime = 0;
    this.position = 0;
    this.direction = 0;
    this.left = 0; this.right = 0; this.ahead = 0; this.back = 0;
    this.ourclock = 120; // fly.c:62 "time for all the flights in the game"
    this.fuel = 0; this.torps = 0;
    this.carrying = 0; this.encumber = 0;
    this.rythmn = 0; this.ate = 0; this.snooze = 0;
    this.meetgirl = 0; this.godready = 0; this.wintime = 0;
    this.wiz = 0; this.tempwiz = 0;
    this.matchlight = 0; this.loved = 0;
    this.pleasure = 0; this.power = 0; this.ego = 0;
    this.notes = new Array(NUMOFNOTES).fill(0);
    this.inven = newBits();
    this.wear = newBits();
    this.beenthere = new Array(NUMOFROOMS + 1).fill(0);
    this.injuries = new Array(NUMOFINJURIES).fill(0);
    this.verbose = 0;
    // fly.c statics that persist between dogfights
    this.flight = { dr: 0, dc: 0, cross: 0 };

    this.dayfile = makeRooms(DAYFILE);
    this.nightfile = makeRooms(NIGHTFILE);
    this.location = this.dayfile;
    this.rng = new GlibcRandom(this.seed);

    // --- I/O ---
    this.stdin = '';
    this.eof = false;
    this.segments = []; // [{t:'text'|'prompt', s}] since the last pump
    this.transcript = []; // everything, for tests
    this.keepTranscript = o.keepTranscript ?? false;
    this.events = [];
    this.request = null;
    this.ended = false;
    this.endKind = null;
    this.lastPrompt = '';
    this.inFight = null;
    this.flightSim = null;
  }

  // ---------------------------------------------------------------- host API

  /** Runs until the first input request. */
  start() {
    this.gen = this.main();
    return this._pump(undefined);
  }

  /** Feeds one line of input (without the newline); null = EOF. */
  send(line) {
    if (this.ended) return this._result();
    if (this.request?.kind === 'line') {
      if (line === null) this.eof = true;
      else this.stdin += String(line) + '\n';
      return this._pump(undefined);
    }
    throw new Error(`engine is not waiting for a line (${this.request?.kind})`);
  }

  /** Resumes after the host finished driving a dogfight (request.kind === 'flight'). */
  resumeFlight() {
    if (this.request?.kind !== 'flight') throw new Error('no dogfight in progress');
    return this._pump(undefined);
  }

  /** True between commands at `>-: ` (not in a fight, a dogfight, su or save). */
  get atMainPrompt() {
    return !this.ended && this.request?.kind === 'line' && this.request.prompt === '>-: ' &&
      !this.flightSim && !this.inFight && this.stdin.length === 0 && this._awaitingCommand === true;
  }

  /** Override-panel actions, only between commands at the main prompt. */
  override(action, arg) {
    if (!this.atMainPrompt) return null;
    this.stdin = '';
    this._pendingMeta = { action, arg };
    return this._pump(undefined);
  }

  setOverrides(flags) {
    Object.assign(this.ovr, flags);
    if (Object.values(this.ovr).some(Boolean)) this.cheated = true;
  }

  _pump(value) {
    try {
      let r = this.gen.next(value);
      // The engine only yields input requests; loop if it asked for a line
      // it can already satisfy from buffered stdin (never happens by design,
      // requests are only made when the buffer is empty).
      if (r.done) { this.ended = true; this.request = null; } else this.request = r.value;
    } catch (e) {
      if (e instanceof GameEnd) {
        this.ended = true;
        this.endKind = e.kind;
        this.request = null;
      } else throw e;
    }
    return this._result();
  }

  _result() {
    const segs = this.segments;
    this.segments = [];
    const ev = this.events;
    this.events = [];
    return {
      output: segs.map((s) => s.s).join(''),
      segments: segs,
      events: ev,
      request: this.request,
      ended: this.ended,
      endKind: this.endKind,
    };
  }

  // ---------------------------------------------------------------- output

  print(s) {
    if (!s) return;
    this.segments.push({ t: 'text', s });
    if (this.keepTranscript) this.transcript.push(s);
  }
  puts(s) { this.print(s + '\n'); }
  emit(type, data = {}) { this.events.push({ type, ...data, time: this.ourtime, position: this.position }); }

  // ---------------------------------------------------------------- stdin

  /** fgets(buf, size, stdin): up to size-1 chars, stops after '\n'. null on EOF. */
  *fgets(size) {
    while (this.stdin.length === 0) {
      if (this.eof) return null;
      yield (this.request = { kind: 'line', prompt: this.lastPrompt });
      if (this._pendingMeta) return { meta: this._takeMeta() };
    }
    const nl = this.stdin.indexOf('\n');
    let take = nl === -1 ? this.stdin.length : nl + 1;
    take = Math.min(take, size - 1);
    const s = this.stdin.slice(0, take);
    this.stdin = this.stdin.slice(take);
    return s;
  }

  _takeMeta() { const m = this._pendingMeta; this._pendingMeta = null; return m; }

  /** getchar(): one character, -1 on EOF. */
  *getchar() {
    while (this.stdin.length === 0) {
      if (this.eof) return -1;
      yield (this.request = { kind: 'line', prompt: this.lastPrompt });
    }
    const c = this.stdin[0];
    this.stdin = this.stdin.slice(1);
    return c;
  }

  /** fgetln(): a whole line including '\n' (save file name prompt). */
  *fgetln() {
    while (this.stdin.length === 0) {
      if (this.eof) return '';
      yield (this.request = { kind: 'line', prompt: this.lastPrompt });
    }
    const nl = this.stdin.indexOf('\n');
    const take = nl === -1 ? this.stdin.length : nl + 1;
    const s = this.stdin.slice(0, take);
    this.stdin = this.stdin.slice(take);
    return s;
  }

  prompt(p) {
    this.lastPrompt = p;
    this.segments.push({ t: 'prompt', s: p });
    if (this.keepTranscript) this.transcript.push(p);
  }

  /** getcom.c getcom(): prompt until a non-blank line; returns the stripped buffer. */
  *getcom(size, promptText, error) {
    let buf;
    for (;;) {
      this.prompt(promptText);
      buf = yield* this.fgets(size);
      if (buf && typeof buf === 'object') return buf; // Override action (main prompt only)
      if (buf === null) { yield* this.die('eof'); continue; }
      let i = 0;
      while (i < buf.length && isspace(buf[i])) i++;
      buf = buf.slice(i);
      if (buf.length) break;
      if (error) this.puts(error);
    }
    // "If we didn't get to the end of the line, don't read it in next time."
    if (buf[buf.length - 1] !== '\n') {
      for (;;) {
        const c = yield* this.getchar();
        if (c === '\n' || c === -1) break;
      }
    }
    return buf;
  }

  /** getcom.c getword(buf1, buf2, -1): returns [word, nextIndex|-1]. */
  static getword(buf, i) {
    let cnt = 1;
    let w = '';
    while (i < buf.length && isspace(buf[i])) i++;
    if (buf[i] !== ',') {
      if (i >= buf.length) return ['', -1];
      while (cnt < WORDLEN && i < buf.length && !isspace(buf[i]) && buf[i] !== ',') {
        w += lower(buf[i]);
        i++;
        cnt++;
      }
      if (cnt === WORDLEN) while (i < buf.length && !isspace(buf[i])) i++;
    } else {
      w = ',';
      i++;
    }
    while (i < buf.length && isspace(buf[i])) i++;
    return [w, i < buf.length ? i : -1];
  }

  // ---------------------------------------------------------------- parse.c

  static lookup(s) { return WORDS.get(s) || null; }

  parse() {
    const { words, wordvalue, wordtype } = this;
    this.wordnumber = 0;
    for (let n = 0; n <= this.wordcount; n++) {
      const wp = Battlestar.lookup(words[n]);
      if (!wp) { wordvalue[n] = -1; wordtype[n] = -1; } else { wordvalue[n] = wp.value; wordtype[n] = wp.article; }
    }
    // "We never use adjectives for anything, so yank them all."
    for (let n = 1; n < this.wordcount; n++) {
      if (wordtype[n] === ADJS) {
        for (let i = n + 1; i < this.wordcount; i++) {
          wordtype[i - 1] = wordtype[i]; wordvalue[i - 1] = wordvalue[i]; words[i - 1] = words[i];
        }
        this.wordcount--;
      }
    }
    // "Don't let a comma mean AND if followed by a verb."
    for (let n = 0; n < this.wordcount; n++) {
      if (wordvalue[n] === AND && words[n][0] === ',' && wordtype[n + 1] === VERB) {
        wordvalue[n] = -1; wordtype[n] = -1;
      }
    }
    // Trim "AND AND".
    for (let n = 1; n < this.wordcount; n++) {
      if (wordvalue[n - 1] === AND && wordvalue[n] === AND) {
        for (let i = n + 1; i < this.wordcount; i++) {
          wordtype[i - 1] = wordtype[i]; wordvalue[i - 1] = wordvalue[i]; words[i - 1] = words[i];
        }
        this.wordcount--;
      }
    }
    // (NOUN|OBJECT) AND EVERYTHING -> move EVERYTHING to the front.
    let flag = 1;
    while (flag) {
      flag = 0;
      for (let n = 1; n < this.wordcount; n++) {
        if ((wordtype[n - 1] === NOUNS || wordtype[n - 1] === OBJECT) &&
            wordvalue[n] === AND && wordvalue[n + 1] === EVERYTHING) {
          wordvalue[n + 1] = wordvalue[n - 1];
          wordvalue[n - 1] = EVERYTHING;
          wordtype[n + 1] = wordtype[n - 1];
          wordtype[n - 1] = OBJECT;
          const tmp = words[n - 1]; words[n - 1] = words[n + 1]; words[n + 1] = tmp;
          flag = 1;
        }
      }
      for (let n = 1; n < this.wordcount; n++) {
        if (wordvalue[n - 1] === EVERYTHING && wordvalue[n] === AND && wordvalue[n + 1] === EVERYTHING) {
          for (let i = n + 1; i < this.wordcount; i++) {
            wordtype[i - 1] = wordtype[i + 1]; wordvalue[i - 1] = wordvalue[i + 1]; words[i - 1] = words[i + 1] ?? '';
          }
          this.wordcount--;
          this.wordcount--;
          flag = 1;
        }
      }
    }
  }

  // ---------------------------------------------------------------- main

  /** battlestar.c main() */
  *main() {
    yield* this.initialize();
    let skipStart = this.opts.snapshot && this.opts.resume === 'prompt';
    for (;;) {
      // start:
      if (!skipStart) {
        try {
          yield* this.startBlock();
        } catch (e) {
          if (!(e instanceof DeathAverted)) throw e;
          this.describe();
        }
      } else {
        this.describe(true);
        skipStart = false;
      }
      this.emit('turn');
      // run:
      for (;;) {
        this._awaitingCommand = true;
        const next = yield* this.getcom(LINELENGTH, '>-: ', 'Please type in something.');
        this._awaitingCommand = false;
        if (typeof next === 'object') {
          const r = this.applyMeta(next.meta);
          if (r === 0) break;
          continue;
        }
        this.wordcount = 0;
        let idx = 0;
        while (idx !== -1 && this.wordcount < NWORD - 1) {
          const [w, ni] = Battlestar.getword(next, idx);
          this.words[this.wordcount] = w;
          idx = ni;
          this.wordcount++;
        }
        this.parse();
        let r;
        try {
          r = yield* this.cypher();
        } catch (e) {
          if (!(e instanceof DeathAverted)) throw e;
          r = 0;
        }
        if (r === -1) { this.emit('turn'); continue; }
        if (r === 0) break;
        throw new Error('bad return from cypher(): please submit a bug report');
      }
    }
  }

  /** The `start:` block of main(). */
  *startBlock() {
    yield* this.news();
    if (this.beenthere[this.position] <= ROOMDESC) this.beenthere[this.position]++;
    if (this.notes[LAUNCHED]) yield* this.crash();
    if (this.matchlight) {
      this.puts('Your match splutters out.');
      this.matchlight = 0;
    }
    this.describe();
  }

  /** Room text + whichway (tail of the start: block). */
  describe(resumed = false) {
    if (resumed) this.puts('');
    if (!this.notes[CANTSEE] || testbit(this.inven, LAMPON) ||
        testbit(this.location[this.position].objects, LAMPON)) {
      this.writedes();
      this.printobjs();
    } else this.puts("It's too dark to see anything in here!");
    this.whichway(this.location[this.position]);
  }

  /** init.c initialize() */
  *initialize() {
    this.puts('Version 4.2, fall 1984.');
    this.puts('First Adventure game written by His Lordship, the honorable');
    this.puts('Admiral D.W. Riggle\n');
    for (const s of MULTIPLY_DEFINED) this.print(`Multiply defined ${s}.\n`);
    this.location = this.dayfile;
    if (!this.opts.snapshot) {
      this.direction = NORTH;
      this.ourtime = 0;
      this.snooze = trunc(CYCLE * 1.5);
      this.position = 22;
      setbit(this.wear, PAJAMAS);
      this.fuel = TANKFULL;
      this.torps = TORPEDOES;
      for (const [room, obj] of DAYOBJS) setbit(this.location[room].objects, obj);
    } else {
      this.restore(this.opts.snapshot);
    }
    this.wiz = this.wizard(this.username);
    this.emit('init');
  }

  wizard(uname) {
    const flag = this.checkout(uname);
    if (flag) this.print(`You are the Great wizard ${uname}.\n`);
    return flag;
  }

  checkout(uname) {
    if (HEREDITARY_WIZARDS.includes(uname)) return 1;
    if (ANTI_WIZARDS.includes(uname)) {
      this.print(`You are the Poor anti-wizard ${uname}.  Good Luck!\n`);
      this.CUMBER = 3;
      this.WEIGHT = 9; // that'll get him!
      this.ourclock = 10;
      setbit(this.location[7].objects, WOODSMAN); // viper room
      setbit(this.location[20].objects, WOODSMAN); // laser "
      setbit(this.location[13].objects, DARK); // amulet "
      setbit(this.location[8].objects, ELF); // closet
      return 0;
    }
    return 0;
  }

  // ---------------------------------------------------------------- room.c

  writedes() {
    const room = this.location[this.position];
    this.print(`\n\t${S(room.name)}\n`);
    if (this.beenthere[this.position] < ROOMDESC || this.verbose) {
      let compass = NORTH;
      let out = '';
      for (const c of room.desc) {
        if (c !== '-' && c !== '*' && c !== '+') {
          out += c === '=' ? '-' : c;
        } else {
          if (c !== '*') out += this.truedirec(compass, c, (s) => { out += s; });
          compass++;
        }
      }
      this.print(out);
    }
  }

  printobjs() {
    const p = this.location[this.position].objects;
    let s = '\n';
    for (let n = 0; n < NUMOFOBJECTS; n++) if (testbit(p, n) && OBJDES[n]) s += OBJDES[n] + '\n';
    this.print(s);
  }

  whichway(here) {
    const l = here.link;
    switch (this.direction) {
      case NORTH: this.left = l[L_WEST]; this.right = l[L_EAST]; this.ahead = l[L_NORTH]; this.back = l[L_SOUTH]; break;
      case SOUTH: this.left = l[L_EAST]; this.right = l[L_WEST]; this.ahead = l[L_SOUTH]; this.back = l[L_NORTH]; break;
      case EAST: this.left = l[L_NORTH]; this.right = l[L_SOUTH]; this.ahead = l[L_EAST]; this.back = l[L_WEST]; break;
      case WEST: this.left = l[L_SOUTH]; this.right = l[L_NORTH]; this.ahead = l[L_WEST]; this.back = l[L_EAST]; break;
      default: break;
    }
  }

  /** room.c truedirec(); `errOut` receives the error printf when >4 directions are used. */
  truedirec(way, option, errOut) {
    // `way` is the absolute direction of the placeholder, `direction` the facing.
    const behind = option === '+' ? 'behind you' : 'back';
    const T = {
      [NORTH]: { [NORTH]: 'ahead', [SOUTH]: behind, [EAST]: 'left', [WEST]: 'right' },
      [SOUTH]: { [NORTH]: behind, [SOUTH]: 'ahead', [EAST]: 'right', [WEST]: 'left' },
      [EAST]: { [NORTH]: 'right', [SOUTH]: 'left', [EAST]: 'ahead', [WEST]: behind },
      [WEST]: { [NORTH]: 'left', [SOUTH]: 'right', [EAST]: behind, [WEST]: 'ahead' },
    };
    const r = T[way] && T[way][this.direction];
    if (r !== undefined) return r;
    // A fifth placeholder in a description ends up here, as in room.c.
    const msg = `Error: room ${this.position}.  More than four directions wanted.`;
    if (errOut) errOut(msg); else this.print(msg);
    return '!!';
  }

  newway(thisway) {
    const d = this.direction;
    const table = {
      [NORTH]: { [LEFT]: WEST, [RIGHT]: EAST, [BACK]: SOUTH },
      [SOUTH]: { [LEFT]: EAST, [RIGHT]: WEST, [BACK]: NORTH },
      [EAST]: { [LEFT]: NORTH, [RIGHT]: SOUTH, [BACK]: WEST },
      [WEST]: { [LEFT]: SOUTH, [RIGHT]: NORTH, [BACK]: EAST },
    };
    const t = table[d];
    if (t && t[thisway] !== undefined) this.direction = t[thisway];
  }

  // ---------------------------------------------------------------- misc.c

  card(array, size) {
    let i = 0;
    for (let k = 0; k < size; k++) if (array[k]) i++;
    return i;
  }

  ucard(array) {
    let j = 0;
    for (let n = 0; n < NUMOFOBJECTS; n++) if (testbit(array, n)) j++;
    return j;
  }

  // ---------------------------------------------------------------- command1.c

  moveplayer(thataway, token) {
    const from = this.position;
    this.wordnumber++;
    if ((!this.notes[CANTMOVE] && !this.notes[LAUNCHED]) ||
        testbit(this.location[this.position].objects, LAND) ||
        (this.fuel > 0 && this.notes[LAUNCHED])) {
      if (thataway) {
        this.position = thataway;
        this.newway(token);
        this.ourtime++;
        const verb = this.moveVerb || { [AHEAD]: 'ahead', [BACK]: 'back', [LEFT]: 'left', [RIGHT]: 'right' }[token];
        this.moveVerb = null;
        this.emit('move', { from, to: thataway, token, verb });
      } else {
        this.puts("You can't go this way.");
        this.newway(token);
        this.whichway(this.location[this.position]);
        this.emit('blocked', { token });
        return 0;
      }
    } else if (this.notes[CANTMOVE] && !this.notes[LAUNCHED]) {
      this.puts('You aren\'t able to move; you better drop something.');
    } else {
      this.puts('You are out of fuel; now you will rot in space forever!');
    }
    return 1;
  }

  convert(tothis) {
    if (tothis === TONIGHT) {
      for (let i = 1; i <= NUMOFROOMS; i++) this.nightfile[i].objects.set(this.dayfile[i].objects);
      for (const [room, obj] of NIGHTOBJS) setbit(this.nightfile[room].objects, obj);
      this.location = this.nightfile;
    } else {
      for (let i = 1; i <= NUMOFROOMS; i++) this.dayfile[i].objects.set(this.nightfile[i].objects);
      for (const [room, obj] of NIGHTOBJS) clearbit(this.dayfile[room].objects, obj);
      this.location = this.dayfile;
    }
  }

  get isNight() { return this.location === this.nightfile; }
  get OUTSIDE() { return this.position > 68 && this.position < 246 && this.position !== 218; }

  /** Applies an injury unless the Override "invulnerable" flag is on. */
  hurtPlayer(n) {
    if (this.ovr.invulnerable) return false;
    this.injuries[n] = 1;
    this.emit('injury', { injury: n });
    return true;
  }

  *news() {
    if (this.ovr.noFatigue) this.snooze = max(this.snooze, this.ourtime + trunc(CYCLE * 1.5));
    if (this.ovr.noHunger) this.ate = max(this.ate, this.ourtime + trunc(CYCLE / 3));
    if (this.ourtime > 30 && this.position < 32) {
      if (!this.ovr.invulnerable) {
        this.puts('An explosion of shuddering magnitude splinters bulkheads and');
        this.puts("ruptures the battlestar's hull.  You are sucked out into the");
        this.puts('frozen void of space and killed.');
        this.emit('shipExplodes');
        yield* this.die('explosion');
      }
    }
    if (this.ourtime > 20 && this.position < 32) {
      this.puts('Explosions rock the battlestar.');
      this.emit('explosions');
    }
    if (this.ourtime > this.snooze) {
      this.puts('You drop from exhaustion...');
      yield* this.zzz();
    }
    if (this.ourtime > this.snooze - 5) this.puts("You're getting tired.");
    if (this.ourtime > (this.rythmn + CYCLE)) {
      if (this.location === this.nightfile) {
        this.convert(TODAY);
        this.emit('dawn');
        if (this.OUTSIDE && this.ourtime - this.rythmn - CYCLE < 10) {
          this.puts('Dew lit sunbeams stretch out from a watery sunrise and herald the dawn.');
          this.puts('You awake from a misty dream-world into stark reality.');
          this.puts('It is day.');
        }
      } else {
        this.convert(TONIGHT);
        clearbit(this.location[POOLS].objects, BATHGOD);
        this.emit('dusk');
        if (this.OUTSIDE && this.ourtime - this.rythmn - CYCLE < 10) {
          this.puts('The dying sun sinks into the ocean, leaving a blood-stained sunset.');
          this.puts('The sky slowly fades from orange to violet to black.  A few stars');
          this.puts('flicker on, and it is night.');
          this.puts('The world seems completely different at night.');
        }
      }
      this.rythmn = this.ourtime - this.ourtime % CYCLE;
    }
    if (!this.wiz && !this.tempwiz) {
      if ((testbit(this.inven, TALISMAN) || testbit(this.wear, TALISMAN)) &&
          (testbit(this.inven, MEDALION) || testbit(this.wear, MEDALION)) &&
          (testbit(this.inven, AMULET) || testbit(this.wear, AMULET))) {
        this.tempwiz = 1;
        this.puts('The three amulets glow and reenforce each other in power.\nYou are now a wizard.');
        this.emit('wizard');
      }
    }
    if (testbit(this.location[this.position].objects, ELF)) {
      this.print(`${OBJDES[ELF]}\n`);
      yield* this.fight(ELF, this.rng.rnd(30));
    }
    if (testbit(this.location[this.position].objects, DARK)) {
      this.print(`${OBJDES[DARK]}\n`);
      yield* this.fight(DARK, 100);
    }
    if (testbit(this.location[this.position].objects, WOODSMAN)) {
      this.print(`${OBJDES[WOODSMAN]}\n`);
      yield* this.fight(WOODSMAN, 50);
    }
    switch (this.position) {
      case 267: case 257: case 274: case 246: // entering a cave
        this.notes[CANTSEE] = 1;
        break;
      case 160: case 216: case 230: case 231: case 232: // leaving a cave
        this.notes[CANTSEE] = 0;
        break;
      default: break;
    }
    if (testbit(this.location[this.position].objects, GIRL)) this.meetgirl = 1;
    if (this.meetgirl && CYCLE * 1.5 - this.ourtime < 10) {
      setbit(this.location[GARDEN].objects, GIRLTALK);
      setbit(this.location[GARDEN].objects, LAMPON);
      setbit(this.location[GARDEN].objects, ROPE);
    }
    if (this.position === DOCK && (this.beenthere[this.position] || this.ourtime > CYCLE)) {
      clearbit(this.location[DOCK].objects, GIRL);
      clearbit(this.location[DOCK].objects, MAN);
    }
    if (this.meetgirl && this.ourtime - CYCLE * 1.5 > 10) {
      clearbit(this.location[GARDEN].objects, GIRLTALK);
      clearbit(this.location[GARDEN].objects, LAMPON);
      clearbit(this.location[GARDEN].objects, ROPE);
      this.meetgirl = 0;
    }
    if (testbit(this.location[this.position].objects, CYLON)) {
      this.puts("Oh my God, you're being shot at by an alien spacecraft!");
      this.print(`The targeting computer says we have ${this.ourclock} seconds to attack!\n`);
      this.emit('cylon');
      if (!(yield* this.visual())) {
        const hurt = this.rng.rnd(NUMOFINJURIES);
        if (this.ovr.invulnerable) {
          this.puts('Laser blasts sear the cockpit, and the alien veers off in a victory roll.');
          this.puts('[Override] Your shields hold.');
        } else {
          this.hurtPlayer(hurt);
          this.puts('Laser blasts sear the cockpit, and the alien veers off in a victory roll.');
          this.puts('The viper shudders under a terrible explosion.');
          this.print(`I'm afraid you have suffered ${OUCH[hurt]}.\n`);
        }
        this.emit('cylonEscaped');
      } else {
        clearbit(this.location[this.position].objects, CYLON);
        this.emit('cylonDestroyed');
      }
    }
    if (this.injuries[SKULL] && this.injuries[INCISE] && this.injuries[NECK]) {
      this.puts("I'm afraid you have suffered fatal injuries.");
      yield* this.die('injuries');
    }
    for (let n = 0; n < NUMOFINJURIES; n++) {
      if (this.injuries[n] === 1) {
        this.injuries[n] = 2;
        if (this.WEIGHT > 5) this.WEIGHT -= 5; else this.WEIGHT = 0;
      }
    }
    if (this.injuries[ARM] === 2) {
      if (this.CUMBER > 5) this.CUMBER -= 5; else this.CUMBER = 0;
      this.injuries[ARM]++;
    }
    if (this.injuries[RIBS] === 2) {
      if (this.CUMBER > 2) this.CUMBER -= 2; else this.CUMBER = 0;
      this.injuries[RIBS]++;
    }
    if (this.injuries[SPINE] === 2) {
      this.WEIGHT = 0;
      this.injuries[SPINE]++;
    }
    if (this.carrying > this.WEIGHT || this.encumber > this.CUMBER) this.notes[CANTMOVE] = 1;
    else this.notes[CANTMOVE] = 0;
  }

  *crash() {
    if (!this.ovr.infiniteFuel) this.fuel--;
    const room = this.location[this.position];
    if (!room.link[L_FLYHERE] || (testbit(room.objects, LAND) && this.fuel <= 0)) {
      if (!room.link[L_FLYHERE]) this.puts("You're flying too low.  We're going to crash!");
      else {
        this.puts("You're out of fuel.  We'll have to crash land!");
        if (!room.link[L_DOWN]) {
          this.puts('Your viper strikes the ground and explodes into fiery fragments.');
          this.puts('Thick black smoke billows up from the wreckage.');
          this.emit('crash', { fatal: true });
          yield* this.die('crash');
        }
        this.position = room.link[L_DOWN];
      }
      this.notes[LAUNCHED] = 0;
      setbit(this.location[this.position].objects, CRASH);
      this.ourtime += this.rng.rnd(trunc(CYCLE / 4));
      this.puts('The viper explodes into the ground and you lose consciousness...');
      this.emit('crash', { fatal: false });
      yield* this.zzz();
      const hurt1 = this.rng.rnd(NUMOFINJURIES - 2) + 2;
      const hurt2 = this.rng.rnd(NUMOFINJURIES - 2) + 2;
      if (this.ovr.invulnerable) {
        this.puts('[Override] You walk away from the wreck without a scratch.');
      } else {
        this.hurtPlayer(hurt1);
        this.hurtPlayer(hurt2);
        this.hurtPlayer(0); // abrasions
        this.hurtPlayer(1); // lacerations
        this.print(`I'm afraid you have suffered ${OUCH[hurt1]} and ${OUCH[hurt2]}.\n`);
      }
    }
  }

  // ---------------------------------------------------------------- cypher.c

  *cypher() {
    const w = this;
    let n;
    let lflag = -1;
    while (w.wordnumber <= w.wordcount) {
      if (w.wordtype[w.wordnumber] !== VERB &&
          !(w.wordtype[w.wordnumber] === OBJECT && w.wordvalue[w.wordnumber] === KNIFE)) {
        w.print(`${w.wordnumber === w.wordcount ? w.words[0] : w.words[w.wordnumber]}: How's that?\n`);
        return -1;
      }
      switch (w.wordvalue[w.wordnumber]) {
        case AUXVERB:
          // Take the following word as the verb (e.g. "make love", "climb up").
          w.wordnumber++;
          continue;

        case UP:
          if (w.location[w.position].link[L_ACCESS] || w.wiz || w.tempwiz) {
            if (!w.location[w.position].link[L_ACCESS]) w.puts('Zap!  A gust of wind lifts you up.');
            w.moveVerb = 'up';
            if (!w.moveplayer(w.location[w.position].link[L_UP], AHEAD)) return -1;
          } else {
            w.puts('There is no way up.');
            return -1;
          }
          lflag = 0;
          break;

        case DOWN:
          w.moveVerb = 'down';
          if (!w.moveplayer(w.location[w.position].link[L_DOWN], AHEAD)) return -1;
          lflag = 0;
          break;

        case LEFT:
          w.moveVerb = 'left';
          if (!w.moveplayer(w.left, LEFT)) return -1;
          lflag = 0;
          break;

        case RIGHT:
          w.moveVerb = 'right';
          if (!w.moveplayer(w.right, RIGHT)) return -1;
          lflag = 0;
          break;

        case AHEAD:
          w.moveVerb = 'ahead';
          if (!w.moveplayer(w.ahead, AHEAD)) return -1;
          lflag = 0;
          break;

        case BACK:
          w.moveVerb = 'back';
          if (!w.moveplayer(w.back, BACK)) return -1;
          lflag = 0;
          break;

        case SHOOT:
          if (w.wordnumber < w.wordcount && w.wordvalue[w.wordnumber + 1] === EVERYTHING) {
            let things = 0;
            for (n = 0; n < NUMOFOBJECTS; n++) {
              if (testbit(w.location[w.position].objects, n) && OBJSHT[n]) {
                things++;
                w.wordvalue[w.wordnumber + 1] = n;
                w.wordnumber = yield* w.shoot();
              }
            }
            if (!things) w.puts('Nothing to shoot at!');
            w.wordnumber++;
            w.wordnumber++;
          } else yield* w.shoot();
          break;

        case TAKE:
          if (w.wordnumber < w.wordcount && w.wordvalue[w.wordnumber + 1] === EVERYTHING) {
            let things = 0;
            for (n = 0; n < NUMOFOBJECTS; n++) {
              if (testbit(w.location[w.position].objects, n) && OBJSHT[n]) {
                things++;
                w.wordvalue[w.wordnumber + 1] = n;
                switch (n) {
                  case BATHGOD:
                    w.wordvalue[w.wordnumber + 1] = NORMGOD;
                  // falls through
                  case NORMGOD: case AMULET: case MEDALION: case TALISMAN: case MAN: case TIMER: case NATIVE:
                    w.wordtype[w.wordnumber + 1] = NOUNS;
                    break;
                  default:
                    w.wordtype[w.wordnumber + 1] = OBJECT;
                }
                w.wordnumber = yield* w.take(w.location[w.position].objects);
              }
            }
            w.wordnumber++;
            w.wordnumber++;
            if (!things) w.puts('Nothing to take!');
          } else yield* w.take(w.location[w.position].objects);
          break;

        case DROP:
          if (w.wordnumber < w.wordcount && w.wordvalue[w.wordnumber + 1] === EVERYTHING) {
            let things = 0;
            for (n = 0; n < NUMOFOBJECTS; n++) {
              if (testbit(w.inven, n)) {
                things++;
                w.wordvalue[w.wordnumber + 1] = n;
                w.wordnumber = yield* w.drop('Dropped');
              }
            }
            w.wordnumber++;
            w.wordnumber++;
            if (!things) w.puts('Nothing to drop!');
          } else yield* w.drop('Dropped');
          break;

        case KICK:
        case THROW:
          if (w.wordnumber < w.wordcount && w.wordvalue[w.wordnumber + 1] === EVERYTHING) {
            let things = 0;
            const wv = w.wordvalue[w.wordnumber];
            for (n = 0; n < NUMOFOBJECTS; n++) {
              if (testbit(w.inven, n) || (testbit(w.location[w.position].objects, n) && OBJSHT[n])) {
                things++;
                w.wordvalue[w.wordnumber + 1] = n;
                w.wordnumber = yield* w.throw(w.wordvalue[w.wordnumber] === KICK ? 'Kicked' : 'Thrown');
              }
            }
            w.wordnumber += 2;
            if (!things) w.print(`Nothing to ${wv === KICK ? 'kick' : 'throw'}!\n`);
          } else yield* w.throw(w.wordvalue[w.wordnumber] === KICK ? 'Kicked' : 'Thrown');
          break;

        case TAKEOFF:
          if (w.wordnumber < w.wordcount && w.wordvalue[w.wordnumber + 1] === EVERYTHING) {
            let things = 0;
            for (n = 0; n < NUMOFOBJECTS; n++) {
              if (testbit(w.wear, n)) {
                things++;
                w.wordvalue[w.wordnumber + 1] = n;
                w.wordnumber = yield* w.takeoff();
              }
            }
            w.wordnumber += 2;
            if (!things) w.puts('Nothing to take off!');
          } else yield* w.takeoff();
          break;

        case DRAW:
          if (w.wordnumber < w.wordcount && w.wordvalue[w.wordnumber + 1] === EVERYTHING) {
            let things = 0;
            for (n = 0; n < NUMOFOBJECTS; n++) {
              if (testbit(w.wear, n)) {
                things++;
                w.wordvalue[w.wordnumber + 1] = n;
                w.wordnumber = yield* w.draw();
              }
            }
            w.wordnumber += 2;
            if (!things) w.puts('Nothing to draw!');
          } else yield* w.draw();
          break;

        case PUTON:
          if (w.wordnumber < w.wordcount && w.wordvalue[w.wordnumber + 1] === EVERYTHING) {
            let things = 0;
            for (n = 0; n < NUMOFOBJECTS; n++) {
              if (testbit(w.location[w.position].objects, n) && OBJSHT[n]) {
                things++;
                w.wordvalue[w.wordnumber + 1] = n;
                w.wordnumber = yield* w.puton();
              }
            }
            w.wordnumber += 2;
            if (!things) w.puts('Nothing to put on!');
          } else yield* w.puton();
          break;

        case WEARIT:
          if (w.wordnumber < w.wordcount && w.wordvalue[w.wordnumber + 1] === EVERYTHING) {
            let things = 0;
            for (n = 0; n < NUMOFOBJECTS; n++) {
              if (testbit(w.inven, n)) {
                things++;
                w.wordvalue[w.wordnumber + 1] = n;
                w.wordnumber = w.wearit();
              }
            }
            w.wordnumber += 2;
            if (!things) w.puts('Nothing to wear!');
          } else w.wearit();
          break;

        case EAT:
          if (w.wordnumber < w.wordcount && w.wordvalue[w.wordnumber + 1] === EVERYTHING) {
            let things = 0;
            for (n = 0; n < NUMOFOBJECTS; n++) {
              if (testbit(w.inven, n)) {
                things++;
                w.wordvalue[w.wordnumber + 1] = n;
                w.wordnumber = w.eat();
              }
            }
            w.wordnumber += 2;
            if (!things) w.puts('Nothing to eat!');
          } else w.eat();
          break;

        case PUT:
          yield* w.put();
          break;

        case INVEN:
          if (w.ucard(w.inven)) {
            w.puts('You are holding:\n');
            for (n = 0; n < NUMOFOBJECTS; n++) if (testbit(w.inven, n)) w.print(`\t${S(OBJSHT[n])}\n`);
            if (w.WEIGHT === 0) {
              w.print(`\n= ${w.carrying} kilogram${w.carrying === 1 ? '.' : 's.'} (can't lift any weight${w.carrying ? ' or move with what you have' : ''})\n`);
            } else {
              w.print(`\n= ${w.carrying} kilogram${w.carrying === 1 ? '.' : 's.'} (${trunc(w.carrying * 100 / w.WEIGHT)}%)\n`);
            }
            if (w.CUMBER === 0) w.print("Your arms can't pick anything up.\n");
            else w.print(`Your arms are ${trunc(w.encumber * 100 / w.CUMBER)}% full.\n`);
          } else w.puts("You aren't carrying anything.");

          if (w.ucard(w.wear)) {
            w.puts('\nYou are wearing:\n');
            for (n = 0; n < NUMOFOBJECTS; n++) if (testbit(w.wear, n)) w.print(`\t${S(OBJSHT[n])}\n`);
          } else w.puts('\nYou are stark naked.');
          if (w.card(w.injuries, NUMOFINJURIES)) {
            w.puts('\nYou have suffered:\n');
            for (n = 0; n < NUMOFINJURIES; n++) if (w.injuries[n]) w.print(`\t${OUCH[n]}\n`);
            w.print(`\nYou can still carry up to ${w.WEIGHT} kilogram${w.WEIGHT === 1 ? '.' : 's.'}\n`);
          } else w.puts('\nYou are in perfect health.');
          w.wordnumber++;
          break;

        case USE:
          lflag = w.use();
          break;

        case OPEN:
          if (w.wordnumber < w.wordcount && w.wordvalue[w.wordnumber + 1] === EVERYTHING) {
            let things = 0;
            for (n = 0; n < NUMOFOBJECTS; n++) {
              if (testbit(w.inven, n)) {
                things++;
                w.wordvalue[w.wordnumber + 1] = n;
                w.dooropen();
              }
            }
            w.wordnumber += 2;
            if (!things) w.puts('Nothing to open!');
          } else w.dooropen();
          break;

        case LOOK:
          if (!w.notes[CANTSEE] || testbit(w.inven, LAMPON) ||
              testbit(w.location[w.position].objects, LAMPON) || w.matchlight) {
            w.beenthere[w.position] = 2;
            w.writedes();
            w.printobjs();
            if (w.matchlight) {
              w.puts('\nYour match splutters out.');
              w.matchlight = 0;
            }
          } else w.puts("I can't see anything.");
          w.emit('look');
          return -1;

        case SU:
          if (w.wiz || w.tempwiz) {
            const ask = function* (label, get, set) {
              w.print(label(get()));
              w.lastPrompt = label(get()).replace(/^\n/, '');
              const buffer = yield* w.fgets(10);
              if (buffer === null) return;
              if (buffer[0] !== '\n') {
                const v = sscanfInt(buffer);
                if (v !== null) set(v);
              }
            };
            yield* ask((v) => `\nRoom (was ${v}) = `, () => w.position, (v) => {
              // Rooms outside 1..275 would index past the room table in C (a crash); refused here.
              if (v >= 1 && v <= NUMOFROOMS) w.position = v;
            });
            yield* ask((v) => `Time (was ${v}) = `, () => w.ourtime, (v) => { w.ourtime = v; });
            yield* ask((v) => `Fuel (was ${v}) = `, () => w.fuel, (v) => { w.fuel = v; });
            yield* ask((v) => `Torps (was ${v}) = `, () => w.torps, (v) => { w.torps = v; });
            yield* ask((v) => `CUMBER (was ${v}) = `, () => w.CUMBER, (v) => { w.CUMBER = v; });
            yield* ask((v) => `WEIGHT (was ${v}) = `, () => w.WEIGHT, (v) => { w.WEIGHT = v; });
            yield* ask((v) => `Clock (was ${v}) = `, () => w.ourclock, (v) => { w.ourclock = v; });
            w.print(`Wizard (was ${w.wiz}, ${w.tempwiz}) = `);
            w.lastPrompt = `Wizard (was ${w.wiz}, ${w.tempwiz}) = `;
            const buffer = yield* w.fgets(10);
            if (buffer !== null && buffer[0] !== '\n') {
              const junk = sscanfInt(buffer);
              if (!junk) { w.tempwiz = 0; w.wiz = 0; }
            }
            w.print('\nDONE.\n');
            w.emit('su');
            return 0;
          }
          w.puts("You aren't a wizard.");
          break;

        case SCORE:
          w.print('\tPLEASURE\tPOWER\t\tEGO\n');
          w.print(`\t${pad3(w.pleasure)}\t\t${pad3(w.power)}\t\t${pad3(w.ego)}\n\n`);
          w.print(`This gives you the rating of ${w.rate()} in ${w.ourtime} turns.\n`);
          w.print(`You have visited ${w.card(w.beenthere, NUMOFROOMS)} out of ${NUMOFROOMS} rooms this run (${trunc(w.card(w.beenthere, NUMOFROOMS) * 100 / NUMOFROOMS)}%).\n`);
          if (w.cheated) w.puts('[Override was used in this game: the score is marked as cheated.]');
          break;

        case KNIFE:
        case KILL:
          yield* w.murder();
          break;

        case UNDRESS:
        case RAVAGE:
          yield* w.ravage();
          break;

        case SAVE: {
          w.print(`\nSave file name (default ${DEFAULT_SAVE_FILE}): `);
          w.lastPrompt = `Save file name (default ${DEFAULT_SAVE_FILE}): `;
          let filename = yield* w.fgetln();
          let name;
          if (filename.length === 0 || filename === '\n') name = DEFAULT_SAVE_FILE;
          else name = filename.endsWith('\n') ? filename.slice(0, -1) : filename;
          w.save(name);
          break;
        }

        case VERBOSE:
          w.verbose = 1;
          w.print('[Maximum verbosity]\n');
          break;

        case BRIEF:
          w.verbose = 0;
          w.print('[Standard verbosity]\n');
          break;

        case FOLLOW:
          lflag = yield* w.follow();
          break;

        case GIVE:
          yield* w.give();
          break;

        case KISS:
          yield* w.kiss();
          break;

        case LOVE:
          yield* w.love();
          break;

        case RIDE:
          lflag = w.ride();
          break;

        case DRIVE:
          lflag = yield* w.drive();
          break;

        case LIGHT:
          yield* w.light();
          break;

        case LAUNCH:
          if (!w.launch()) return -1;
          lflag = 0;
          break;

        case LANDIT:
          if (!w.land()) return -1;
          lflag = 0;
          break;

        case TIME:
          w.chime();
          break;

        case SLEEP:
          yield* w.zzz();
          break;

        case DIG:
          w.dig();
          break;

        case JUMP:
          lflag = w.jump();
          break;

        case BURY:
          w.bury();
          break;

        case SWIM:
          w.puts("Surf's up!");
          break;

        case DRINK:
          yield* w.drink();
          break;

        case QUIT:
          yield* w.die('quit');
          break;

        default:
          w.puts("How's that?");
          return -1;
      }
      if (w.wordnumber < w.wordcount && w.words[w.wordnumber++][0] === ',') continue;
      return lflag;
    }
    return lflag;
  }

  // ---------------------------------------------------------------- command2.c

  wearit() {
    const firstnumber = this.wordnumber;
    this.wordnumber++;
    while (this.wordnumber <= this.wordcount &&
           (this.wordtype[this.wordnumber] === OBJECT || this.wordtype[this.wordnumber] === NOUNS) &&
           this.wordvalue[this.wordnumber] !== DOOR) {
      const value = this.wordvalue[this.wordnumber];
      if (value >= 0 && objsht(value) === null) break;
      switch (value) {
        case -1:
          this.puts('Wear what?');
          return firstnumber;
        case KNIFE: case ROBE: case LEVIS: case SWORD: case MAIL: case HELM: case SHOES: case PAJAMAS:
        case COMPASS: case LASER: case AMULET: case TALISMAN: case MEDALION: case ROPE: case RING:
        case BRACELET: case GRENADE:
          if (testbit(this.inven, value)) {
            clearbit(this.inven, value);
            setbit(this.wear, value);
            this.carrying -= OBJWT[value];
            this.encumber -= OBJCUMBER[value];
            this.ourtime++;
            this.print(`You are now wearing ${A_OR_AN_OR_THE(value)}${S(objsht(value))}.\n`);
            this.emit('wear', { object: value });
          } else if (testbit(this.wear, value)) {
            this.print(`You are already wearing the ${S(objsht(value))}.\n`);
          } else {
            this.print(`You aren't holding the ${S(objsht(value))}.\n`);
          }
          if (this.wordnumber < this.wordcount - 1 && this.wordvalue[++this.wordnumber] === AND) this.wordnumber++;
          else return firstnumber;
          break;
        default:
          this.print(`You can't wear ${A_OR_AN_OR_BLANK(value)}${S(objsht(value))}!\n`);
          return firstnumber;
      }
    }
    this.puts("Don't be ridiculous.");
    return firstnumber;
  }

  *put() {
    if (this.wordvalue[this.wordnumber + 1] === ON) {
      this.wordvalue[++this.wordnumber] = PUTON;
      this.wordtype[this.wordnumber] = VERB;
      return yield* this.cypher();
    }
    if (this.wordvalue[this.wordnumber + 1] === DOWN) {
      this.wordvalue[++this.wordnumber] = DROP;
      this.wordtype[this.wordnumber] = VERB;
      return yield* this.cypher();
    }
    this.puts("I don't understand what you want to put.");
    return -1;
  }

  *draw() { return yield* this.take(this.wear); }

  use() {
    this.wordnumber++;
    if (this.wordvalue[this.wordnumber] === AMULET && testbit(this.inven, AMULET) && this.position !== FINAL) {
      this.puts('The amulet begins to glow.');
      if (testbit(this.inven, MEDALION)) {
        this.puts('The medallion comes to life too.');
        if (this.position === 114) {
          this.location[this.position].link[L_DOWN] = 160;
          this.whichway(this.location[this.position]);
          this.puts('The waves subside and it is possible to descend to the sea cave now.');
          this.ourtime++;
          this.emit('seaCaveOpens');
          return -1;
        }
      }
      this.puts('A light mist falls over your eyes and the sound of purling water trickles in');
      this.puts('your ears.   When the mist lifts you are standing beside a cool stream.');
      const from = this.position;
      if (this.position === 229) this.position = 224;
      else this.position = 229;
      this.ourtime++;
      this.notes[CANTSEE] = 0;
      this.emit('teleport', { from, to: this.position, how: 'amulet' });
      return 0;
    } else if (this.position === FINAL) this.puts("The amulet won't work in here.");
    else if (this.wordvalue[this.wordnumber] === COMPASS && testbit(this.inven, COMPASS)) {
      this.print(`Your compass points ${this.truedirec(NORTH, '-')}.\n`);
    } else if (this.wordvalue[this.wordnumber] === COMPASS) this.puts("You aren't holding the compass.");
    else if (this.wordvalue[this.wordnumber] === AMULET) this.puts("You aren't holding the amulet.");
    else this.puts('There is no apparent use.');
    return -1;
  }

  *murder() {
    let n;
    const weapons = [SWORD, KNIFE, TWO_HANDED, MACE, CLEAVER, BROAD, CHAIN, SHOVEL, HALBERD];
    for (n = 0; !(weapons.includes(n) && testbit(this.inven, n)) && n < NUMOFOBJECTS; n++);
    if (n === NUMOFOBJECTS) {
      if (testbit(this.inven, LASER)) {
        this.print('Your laser should do the trick.\n');
        this.wordnumber++;
        switch (this.wordvalue[this.wordnumber]) {
          case NORMGOD: case TIMER: case NATIVE: case MAN:
            this.wordvalue[--this.wordnumber] = SHOOT;
            yield* this.cypher();
            break;
          case -1:
            this.puts('Kill what?');
            break;
          default:
            if (this.wordtype[this.wordnumber] !== OBJECT || this.wordvalue[this.wordnumber] === EVERYTHING) {
              this.puts("You can't kill that!");
            } else {
              const v = this.wordvalue[this.wordnumber];
              this.print(`You can't kill ${A_OR_AN_OR_BLANK(v)}${S(objsht(v))}!\n`);
            }
        }
      } else this.puts("You don't have suitable weapons to kill.");
    } else {
      this.print(`Your ${S(objsht(n))} should do the trick.\n`);
      this.wordnumber++;
      switch (this.wordvalue[this.wordnumber]) {
        case NORMGOD:
          if (testbit(this.location[this.position].objects, BATHGOD)) {
            this.puts("The goddess's head slices off.  Her corpse floats in the water.");
            clearbit(this.location[this.position].objects, BATHGOD);
            setbit(this.location[this.position].objects, DEADGOD);
            this.power += 5;
            this.notes[JINXED]++;
            this.emit('slay', { who: NORMGOD });
          } else if (testbit(this.location[this.position].objects, NORMGOD)) {
            this.puts('The goddess pleads but you strike her mercilessly.  Her broken body lies in a\npool of blood.');
            clearbit(this.location[this.position].objects, NORMGOD);
            setbit(this.location[this.position].objects, DEADGOD);
            this.power += 5;
            this.notes[JINXED]++;
            this.emit('slay', { who: NORMGOD });
            if (this.wintime) yield* this.live();
          } else this.puts("I don't see her anywhere.");
          break;
        case TIMER:
          if (testbit(this.location[this.position].objects, TIMER)) {
            this.puts('The old man offers no resistance.');
            clearbit(this.location[this.position].objects, TIMER);
            setbit(this.location[this.position].objects, DEADTIME);
            this.power++;
            this.notes[JINXED]++;
            this.emit('slay', { who: TIMER });
          } else this.puts('Who?');
          break;
        case NATIVE:
          if (testbit(this.location[this.position].objects, NATIVE)) {
            this.puts('The girl screams as you cut her body to shreds.  She is dead.');
            clearbit(this.location[this.position].objects, NATIVE);
            setbit(this.location[this.position].objects, DEADNATIVE);
            this.power += 5;
            this.notes[JINXED]++;
            this.emit('slay', { who: NATIVE });
          } else this.puts('What girl?');
          break;
        case MAN:
          if (testbit(this.location[this.position].objects, MAN)) {
            this.puts('You strike him to the ground, and he coughs up blood.');
            this.puts('Your fantasy is over.');
            yield* this.die('fantasy');
          }
        // falls through (as in C: no break after the MAN case)
        case -1:
          this.puts('Kill what?');
          break;
        default:
          if (this.wordtype[this.wordnumber] !== OBJECT || this.wordvalue[this.wordnumber] === EVERYTHING) {
            this.puts("You can't kill that!");
          } else this.print(`You can't kill the ${S(objsht(this.wordvalue[this.wordnumber]))}!\n`);
      }
    }
  }

  *ravage() {
    while (this.wordtype[++this.wordnumber] !== NOUNS && this.wordnumber <= this.wordcount) continue;
    const here = this.location[this.position].objects;
    const v = this.wordvalue[this.wordnumber];
    if (this.wordtype[this.wordnumber] === NOUNS && (testbit(here, v) || (v === NORMGOD && testbit(here, BATHGOD)))) {
      this.ourtime++;
      switch (v) {
        case NORMGOD:
          this.puts('You attack the goddess, and she screams as you beat her.  She falls down');
          if (testbit(here, BATHGOD)) this.puts('crying and tries to cover her nakedness.');
          else this.puts('crying and tries to hold her torn and bloodied dress around her.');
          this.power += 5;
          this.pleasure += 8;
          this.ego -= 10;
          this.wordnumber--;
          this.godready = -30000;
          yield* this.murder();
          this.win = -30000;
          break;
        case NATIVE:
          this.puts('The girl tries to run, but you catch her and throw her down.  Her face is');
          this.puts('bleeding, and she screams as you tear off her clothes.');
          this.power += 3;
          this.pleasure += 5;
          this.ego -= 10;
          this.wordnumber--;
          yield* this.murder();
          if (this.rng.rnd(100) < 50) {
            this.puts('Her screams have attracted attention.  I think we are surrounded.');
            for (const r of [this.ahead, this.back, this.left, this.right]) {
              setbit(this.location[r].objects, WOODSMAN);
              setbit(this.location[r].objects, DEADWOOD);
              setbit(this.location[r].objects, MALLET);
            }
          }
          break;
        default:
          this.puts('You are perverted.');
      }
    } else this.puts('Who?');
  }

  *follow() {
    if (this.followfight === this.ourtime) {
      this.puts('The Dark Lord leaps away and runs down secret tunnels and corridors.');
      this.puts('You chase him through the darkness and splash in pools of water.');
      this.puts('You have cornered him.  His laser sword extends as he steps forward.');
      const from = this.position;
      this.position = FINAL;
      this.emit('teleport', { from, to: FINAL, how: 'chase' });
      yield* this.fight(DARK, 75);
      setbit(this.location[this.position].objects, TALISMAN);
      setbit(this.location[this.position].objects, AMULET);
      return 0;
    } else if (this.followgod === this.ourtime) {
      this.puts('The goddess leads you down a steamy tunnel and into a high, wide chamber.');
      this.puts('She sits down on a throne.');
      const from = this.position;
      this.position = 268;
      setbit(this.location[this.position].objects, NORMGOD);
      this.notes[CANTSEE] = 1;
      this.emit('teleport', { from, to: 268, how: 'goddess' });
      return 0;
    }
    this.puts('There is no one to follow.');
    return -1;
  }

  // ---------------------------------------------------------------- command3.c

  dig() {
    if (testbit(this.inven, SHOVEL)) {
      this.puts('OK');
      this.ourtime++;
      switch (this.position) {
        case 144: // copse near beach
          if (!this.notes[DUG]) {
            setbit(this.location[this.position].objects, DEADWOOD);
            setbit(this.location[this.position].objects, COMPASS);
            setbit(this.location[this.position].objects, KNIFE);
            setbit(this.location[this.position].objects, MACE);
            this.notes[DUG] = 1;
            this.emit('dug');
          }
          break;
        default:
          this.puts('Nothing happens.');
      }
    } else this.puts("You don't have a shovel.");
  }

  jump() {
    const from = this.position;
    switch (this.position) {
      default:
        this.puts('Nothing happens.');
        return -1;
      case 242: this.position = 133; break;
      case 214: case 215: case 162: case 159: this.position = 145; break;
      case 232: this.position = FINAL; break;
      case 3: this.position = 1; break;
      case 172: this.position = 201; break;
    }
    this.puts('Ahhhhhhh...');
    if (!this.ovr.invulnerable) {
      this.injuries[12] = this.injuries[8] = this.injuries[7] = this.injuries[6] = 1;
    }
    for (let n = 0; n < NUMOFOBJECTS; n++) {
      if (testbit(this.inven, n)) {
        clearbit(this.inven, n);
        setbit(this.location[this.position].objects, n);
      }
    }
    this.carrying = 0;
    this.encumber = 0;
    this.emit('jump', { from, to: this.position });
    return 0;
  }

  bury() {
    if (testbit(this.inven, SHOVEL)) {
      while (this.wordtype[++this.wordnumber] !== OBJECT && this.wordtype[this.wordnumber] !== NOUNS &&
             this.wordnumber < this.wordcount) continue;
      let value = this.wordvalue[this.wordnumber];
      const here = this.location[this.position].objects;
      if (this.wordtype[this.wordnumber] === NOUNS && (testbit(here, value) || value === BODY)) {
        switch (value) {
          case BODY:
            this.wordtype[this.wordnumber] = OBJECT;
            if (testbit(this.inven, MAID) || testbit(here, MAID)) value = MAID;
            if (testbit(this.inven, DEADWOOD) || testbit(here, DEADWOOD)) value = DEADWOOD;
            if (testbit(this.inven, DEADGOD) || testbit(here, DEADGOD)) value = DEADGOD;
            if (testbit(this.inven, DEADTIME) || testbit(here, DEADTIME)) value = DEADTIME;
            if (testbit(this.inven, DEADNATIVE) || testbit(here, DEADNATIVE)) value = DEADNATIVE;
            break;
          case NATIVE:
          case NORMGOD:
            this.puts('She screams as you wrestle her into the hole.');
          // falls through
          case TIMER:
            this.power += 7;
            this.ego -= 10;
          // falls through
          case AMULET:
          case MEDALION:
          case TALISMAN:
            this.wordtype[this.wordnumber] = OBJECT;
            break;
          default:
            this.puts('Wha..?');
        }
      }
      if (this.wordtype[this.wordnumber] === OBJECT && this.position > 88 &&
          (testbit(this.inven, value) || testbit(here, value))) {
        this.puts('Buried.');
        if (testbit(this.inven, value)) {
          clearbit(this.inven, value);
          this.carrying -= OBJWT[value] ?? 0;
          this.encumber -= OBJCUMBER[value] ?? 0;
        }
        clearbit(here, value);
        switch (value) {
          case MAID: case DEADWOOD: case DEADNATIVE: case DEADTIME: case DEADGOD:
            this.ego += 2;
            this.print(`The ${S(objsht(value))} should rest easier now.\n`);
            break;
          default: break;
        }
      } else this.puts("It doesn't seem to work.");
    } else this.puts("You aren't holding a shovel.");
  }

  *drink() {
    if (testbit(this.inven, POTION)) {
      this.puts('The cool liquid runs down your throat but turns to fire and you choke.');
      this.puts('The heat reaches your limbs and tingles your spirit.  You feel like falling');
      this.puts('asleep.');
      clearbit(this.inven, POTION);
      this.WEIGHT = MAXWEIGHT;
      this.CUMBER = MAXCUMBER;
      for (let n = 0; n < NUMOFINJURIES; n++) this.injuries[n] = 0;
      this.ourtime++;
      this.emit('heal');
      yield* this.zzz();
    } else this.puts("I'm not thirsty.");
  }

  *shoot() {
    const firstnumber = this.wordnumber;
    const here = () => this.location[this.position].objects;
    if (!testbit(this.inven, LASER)) this.puts("You aren't holding a blaster.");
    else {
      this.wordnumber++;
      while (this.wordnumber <= this.wordcount && this.wordtype[this.wordnumber] === OBJECT) {
        const value = this.wordvalue[this.wordnumber];
        this.print(`${S(objsht(value))}:\n`);
        if (testbit(here(), value)) {
          clearbit(here(), value);
          this.ourtime++;
          this.print(`The ${S(objsht(value))} explode${isPlural(value) ? '.' : 's.'}\n`);
          this.emit('shot', { object: value, destroyed: true });
          if (value === BOMB) yield* this.die('bomb');
        } else this.print(`I don't see any ${S(objsht(value))} around here.\n`);
        if (this.wordnumber < this.wordcount - 1 && this.wordvalue[++this.wordnumber] === AND) this.wordnumber++;
        else return firstnumber;
      }
      // special cases with their own return()'s
      if (this.wordnumber <= this.wordcount && this.wordtype[this.wordnumber] === NOUNS) {
        this.ourtime++;
        switch (this.wordvalue[this.wordnumber]) {
          case DOOR:
            switch (this.position) {
              case 189: case 231:
                this.puts('The door is unhinged.');
                this.location[189].link[L_NORTH] = 231;
                this.location[231].link[L_SOUTH] = 189;
                this.whichway(this.location[this.position]);
                this.emit('doorOpens', { room: this.position });
                break;
              case 30:
                this.puts('The wooden door splinters.');
                this.location[30].link[L_WEST] = 25;
                this.whichway(this.location[this.position]);
                this.emit('doorOpens', { room: 30 });
                break;
              case 31:
                this.puts('The laser blast has no effect on the door.');
                break;
              case 20:
                this.puts('The blast hits the door and it explodes into flame.  The magnesium burns');
                this.puts('so rapidly that we have no chance to escape.');
                this.emit('fire');
                yield* this.die('magnesium');
                break;
              default:
                this.puts('Nothing happens.');
            }
            break;
          case NORMGOD:
            if (testbit(here(), BATHGOD)) {
              this.puts('The goddess is hit in the chest and splashes back against the rocks.');
              this.puts('Dark blood oozes from the charred blast hole.  Her naked body floats in the');
              this.puts('pools and then off downstream.');
              clearbit(here(), BATHGOD);
              setbit(this.location[180].objects, DEADGOD);
              this.power += 5;
              this.ego -= 10;
              this.notes[JINXED]++;
              this.emit('slay', { who: NORMGOD });
            } else if (testbit(here(), NORMGOD)) {
              this.puts('The blast catches the goddess in the stomach, knocking her to the ground.');
              this.puts('She writhes in the dirt as the agony of death taunts her.');
              this.puts('She has stopped moving.');
              clearbit(here(), NORMGOD);
              setbit(here(), DEADGOD);
              this.power += 5;
              this.ego -= 10;
              this.notes[JINXED]++;
              this.emit('slay', { who: NORMGOD });
              if (this.wintime) yield* this.live();
              break;
            } else this.puts("I don't see any goddess around here.");
            break;
          case TIMER:
            if (testbit(here(), TIMER)) {
              this.puts('The old man slumps over the bar.');
              this.power++;
              this.ego -= 2;
              this.notes[JINXED]++;
              clearbit(here(), TIMER);
              setbit(here(), DEADTIME);
              this.emit('slay', { who: TIMER });
            } else this.puts('What old-timer?');
            break;
          case MAN:
            if (testbit(here(), MAN)) {
              this.puts('The man falls to the ground with blood pouring all over his white suit.');
              this.puts('Your fantasy is over.');
              yield* this.die('fantasy');
            } else this.puts('What man?');
            break;
          case NATIVE:
            if (testbit(here(), NATIVE)) {
              this.puts('The girl is blown backwards several feet and lies in a pool of blood.');
              clearbit(here(), NATIVE);
              setbit(here(), DEADNATIVE);
              this.power += 5;
              this.ego -= 2;
              this.notes[JINXED]++;
              this.emit('slay', { who: NATIVE });
            } else this.puts('There is no girl here.');
            break;
          case -1:
            this.puts('Shoot what?');
            break;
          default:
            this.print(`You can't shoot the ${S(objsht(this.wordvalue[this.wordnumber]))}.\n`);
        }
      } else this.puts('You must be a looney.');
    }
    return firstnumber;
  }

  // ---------------------------------------------------------------- command4.c

  *take(from) {
    const firstnumber = this.wordnumber;
    if (this.wordnumber < this.wordcount && this.wordvalue[this.wordnumber + 1] === OFF) {
      this.wordnumber++;
      this.wordvalue[this.wordnumber] = TAKEOFF;
      this.wordtype[this.wordnumber] = VERB;
      return yield* this.cypher();
    }
    this.wordnumber++;
    while (this.wordnumber <= this.wordcount && this.wordtype[this.wordnumber] === OBJECT) {
      const value = this.wordvalue[this.wordnumber];
      this.print(`${S(objsht(value))}:\n`);
      const heavy = (this.carrying + (OBJWT[value] ?? 0)) <= this.WEIGHT;
      const bulky = (this.encumber + (OBJCUMBER[value] ?? 0)) <= this.CUMBER;
      if ((testbit(from, value) || this.wiz || this.tempwiz) && heavy && bulky && !testbit(this.inven, value)) {
        setbit(this.inven, value);
        this.carrying += OBJWT[value] ?? 0;
        this.encumber += OBJCUMBER[value] ?? 0;
        this.ourtime++;
        if (testbit(from, value)) this.print('Taken.\n');
        else this.print('Zap! Taken from thin air.\n');
        clearbit(from, value);
        if (value === MEDALION) this.win--;
        this.emit(from === this.wear ? 'draw' : 'take', { object: value });
      } else if (testbit(this.inven, value)) {
        this.print(`You're already holding ${A_OR_AN_OR_BLANK(value)}${S(objsht(value))}.\n`);
      } else if (!testbit(from, value)) {
        this.print(`I don't see any ${S(objsht(value))} around here.\n`);
      } else if (!heavy) {
        this.print(`The ${S(objsht(value))} ${IS_OR_ARE(value)}too heavy.\n`);
      } else {
        this.print(`The ${S(objsht(value))} ${IS_OR_ARE(value)}too cumbersome to hold.\n`);
      }
      if (this.wordnumber < this.wordcount - 1 && this.wordvalue[++this.wordnumber] === AND) this.wordnumber++;
      else return firstnumber;
    }
    // special cases with their own return()'s
    if (this.wordnumber <= this.wordcount && this.wordtype[this.wordnumber] === NOUNS) {
      const here = this.location[this.position].objects;
      switch (this.wordvalue[this.wordnumber]) {
        case SWORD:
          if (testbit(from, SWORD)) {
            this.wordtype[this.wordnumber--] = OBJECT;
            return yield* this.take(from);
          }
          if (testbit(from, TWO_HANDED)) {
            this.wordvalue[this.wordnumber] = TWO_HANDED;
            this.wordtype[this.wordnumber--] = OBJECT;
            return yield* this.take(from);
          }
          this.wordvalue[this.wordnumber] = BROAD;
          this.wordtype[this.wordnumber--] = OBJECT;
          return yield* this.take(from);

        case BODY:
          if (testbit(from, MAID)) this.wordvalue[this.wordnumber] = MAID;
          else if (testbit(from, DEADWOOD)) this.wordvalue[this.wordnumber] = DEADWOOD;
          else if (testbit(from, DEADNATIVE)) this.wordvalue[this.wordnumber] = DEADNATIVE;
          else if (testbit(from, DEADGOD)) this.wordvalue[this.wordnumber] = DEADGOD;
          else this.wordvalue[this.wordnumber] = DEADTIME;
          this.wordtype[this.wordnumber--] = OBJECT;
          return yield* this.take(from);

        case AMULET:
          if (testbit(here, AMULET)) {
            this.puts('The amulet is warm to the touch, and its beauty catches your breath.');
            this.puts('A mist falls over your eyes, but then it is gone.  Sounds seem clearer');
            this.puts('and sharper but far away as if in a dream.  The sound of purling water');
            this.puts('reaches you from afar.  The mist falls again, and your heart leaps in horror.');
            this.puts('The gold freezes your hands and fathomless darkness engulfs your soul.');
          }
          this.wordtype[this.wordnumber--] = OBJECT;
          return yield* this.take(from);

        case MEDALION:
          if (testbit(here, MEDALION)) {
            this.puts('The medallion is warm, and it rekindles your spirit with the warmth of life.');
            this.puts('Your amulet begins to glow as the medallion is brought near to it, and together\nthey radiate.');
          }
          this.wordtype[this.wordnumber--] = OBJECT;
          return yield* this.take(from);

        case TALISMAN:
          if (testbit(here, TALISMAN)) {
            this.puts('The talisman is cold to the touch, and it sends a chill down your spine.');
          }
          this.wordtype[this.wordnumber--] = OBJECT;
          return yield* this.take(from);

        case NORMGOD:
          if (testbit(here, BATHGOD) && (testbit(this.wear, AMULET) || testbit(this.inven, AMULET))) {
            this.puts('She offers a delicate hand, and you help her out of the sparkling springs.');
            this.puts('Water droplets like liquid silver bedew her golden skin, but when they part');
            this.puts('from her, they fall as teardrops.  She wraps a single cloth around her and');
            this.puts('ties it at the waist.  Around her neck hangs a golden amulet.');
            this.puts('She bids you to follow her, and walks away.');
            this.pleasure++;
            this.followgod = this.ourtime;
            clearbit(here, BATHGOD);
            this.emit('goddessRises');
          } else if (!testbit(here, BATHGOD)) this.puts("You're in no position to take her.");
          else this.puts('She moves away from you.');
          break;

        default:
          this.puts("It doesn't seem to work.");
      }
    } else this.puts("You've got to be kidding.");
    return firstnumber;
  }

  *throw(name) {
    let deposit = 0;
    const first = this.wordnumber;
    if ((yield* this.drop(name)) !== -1) {
      const here = this.location[this.position];
      switch (this.wordvalue[this.wordnumber]) {
        case AHEAD: deposit = this.ahead; break;
        case BACK: deposit = this.back; break;
        case LEFT: deposit = this.left; break;
        case RIGHT: deposit = this.right; break;
        case UP: deposit = here.link[L_UP] * ((here.link[L_ACCESS] || this.position === FINAL) ? 1 : 0); break;
        case DOWN: deposit = here.link[L_DOWN]; break;
        default: break;
      }
      this.wordnumber = first + 1;
      while (this.wordnumber <= this.wordcount) {
        const value = this.wordvalue[this.wordnumber];
        if (deposit && testbit(this.location[this.position].objects, value)) {
          clearbit(this.location[this.position].objects, value);
          if (value !== GRENADE) setbit(this.location[deposit].objects, value);
          else {
            this.puts('A thundering explosion nearby sends up a cloud of smoke and shrapnel.');
            this.location[deposit].objects.fill(0);
            setbit(this.location[deposit].objects, CHAR);
            this.emit('grenade', { room: deposit });
          }
          if (value === ROPE && this.position === FINAL) {
            this.location[this.position].link[L_ACCESS] = 1;
            this.emit('ropeUp');
          }
          switch (deposit) {
            case 189: case 231:
              this.puts('The stone door is unhinged.');
              this.location[189].link[L_NORTH] = 231;
              this.location[231].link[L_SOUTH] = 189;
              this.emit('doorOpens', { room: deposit });
              break;
            case 30:
              this.puts('The wooden door is blown open.');
              this.location[30].link[L_WEST] = 25;
              this.emit('doorOpens', { room: 30 });
              break;
            case 31:
              this.puts('The door is not damaged.');
              break;
            default: break;
          }
        } else if (value === GRENADE && testbit(this.location[this.position].objects, value)) {
          this.puts('You are blown into shreds when your grenade explodes.');
          this.emit('grenade', { room: this.position });
          yield* this.die('grenade');
        }
        if (this.wordnumber < this.wordcount - 1 && this.wordvalue[++this.wordnumber] === AND) this.wordnumber++;
        else return first;
      }
      return first;
    }
    return first;
  }

  *drop(name) {
    const firstnumber = this.wordnumber;
    this.wordnumber++;
    while (this.wordnumber <= this.wordcount &&
           (this.wordtype[this.wordnumber] === OBJECT || this.wordtype[this.wordnumber] === NOUNS)) {
      let value = this.wordvalue[this.wordnumber];
      const here = this.location[this.position].objects;
      if (value === BODY) { // special case
        this.wordtype[this.wordnumber] = OBJECT;
        if (testbit(this.inven, MAID) || testbit(here, MAID)) value = MAID;
        else if (testbit(this.inven, DEADWOOD) || testbit(here, DEADWOOD)) value = DEADWOOD;
        else if (testbit(this.inven, DEADGOD) || testbit(here, DEADGOD)) value = DEADGOD;
        else if (testbit(this.inven, DEADTIME) || testbit(here, DEADTIME)) value = DEADTIME;
        else if (testbit(this.inven, DEADNATIVE) || testbit(here, DEADNATIVE)) value = DEADNATIVE;
      }
      if (this.wordtype[this.wordnumber] === NOUNS && value === DOOR) {
        if (name[0] === 'K') this.puts('You hurt your foot.');
        else this.puts("You're not holding a door.");
      } else if (objsht(value) === null) {
        if (name[0] === 'K') this.puts("That's not for kicking!");
        else this.puts("You don't have that.");
      } else {
        this.print(`${S(objsht(value))}:\n`);
        if (testbit(this.inven, value)) {
          clearbit(this.inven, value);
          this.carrying -= OBJWT[value];
          this.encumber -= OBJCUMBER[value];
          if (value === BOMB) {
            this.puts('The bomb explodes.  A blinding white light and immense concussion obliterate us.');
            this.emit('bomb');
            yield* this.die('bomb');
          }
          if (value !== AMULET && value !== MEDALION && value !== TALISMAN) setbit(here, value);
          else this.tempwiz = 0;
          this.ourtime++;
          if (name[0] === 'K') this.puts('Drop kicked.');
          else this.print(`${name}.\n`);
          this.emit('drop', { object: value, how: name });
        } else if (name[0] !== 'K') {
          this.print(`You aren't holding the ${S(objsht(value))}.\n`);
          if (testbit(here, value)) {
            if (name[0] === 'T') this.puts('Kicked instead.');
            else if (name[0] === 'G') this.puts('Given anyway.');
          }
        } else if (testbit(here, value)) this.puts('Kicked.');
        else if (testbit(this.wear, value)) this.puts("Not while it's being worn.");
        else this.puts('Not found.');
      }
      if (this.wordnumber < this.wordcount - 1 && this.wordvalue[++this.wordnumber] === AND) this.wordnumber++;
      else return firstnumber;
    }
    this.puts('Do what?');
    return -1;
  }

  *takeoff() {
    this.wordnumber = yield* this.take(this.wear);
    return yield* this.drop('Dropped');
  }

  *puton() {
    this.wordnumber = yield* this.take(this.location[this.position].objects);
    return this.wearit();
  }

  eat() {
    const firstnumber = this.wordnumber;
    this.wordnumber++;
    while (this.wordnumber <= this.wordcount) {
      let value = this.wordvalue[this.wordnumber];
      if (this.wordtype[this.wordnumber] !== OBJECT || objsht(value) === null) value = -2;
      switch (value) {
        case -2:
          this.puts("You can't eat that!");
          return firstnumber;
        case -1:
          this.puts('Eat what?');
          return firstnumber;
        case PAPAYAS: case PINEAPPLE: case KIWI: case COCONUTS: case MANGO:
          this.print(`${S(objsht(value))}:\n`);
          if (testbit(this.inven, value) &&
              (this.ourtime > this.ate - CYCLE || this.ovr.noHunger) &&
              testbit(this.inven, KNIFE)) {
            clearbit(this.inven, value);
            this.carrying -= OBJWT[value];
            this.encumber -= OBJCUMBER[value];
            this.ate = max(this.ourtime, this.ate) + trunc(CYCLE / 3);
            this.snooze += trunc(CYCLE / 10);
            this.ourtime++;
            this.puts('Eaten.  You can explore a little longer now.');
            this.emit('eat', { object: value });
          } else if (!testbit(this.inven, value)) this.print(`You aren't holding the ${S(objsht(value))}.\n`);
          else if (!testbit(this.inven, KNIFE)) this.puts('You need a knife.');
          else this.puts("You're stuffed.");
          if (this.wordnumber < this.wordcount - 1 && this.wordvalue[++this.wordnumber] === AND) this.wordnumber++;
          else return firstnumber;
          break;
        default:
          this.print(`You can't eat ${A_OR_AN_OR_BLANK(value)}${S(objsht(value))}!\n`);
          return firstnumber;
      }
    }
    return firstnumber;
  }

  // ---------------------------------------------------------------- command5.c

  *kiss() {
    while (this.wordtype[++this.wordnumber] !== NOUNS && this.wordnumber <= this.wordcount) continue;
    const here = this.location[this.position].objects;
    // "The goddess must be "taken" first if bathing."
    if (this.wordtype[this.wordnumber] === NOUNS && this.wordvalue[this.wordnumber] === NORMGOD && testbit(here, BATHGOD)) {
      this.wordvalue[--this.wordnumber] = TAKE;
      yield* this.cypher();
      return;
    }
    if (this.wordtype[this.wordnumber] === NOUNS) {
      if (testbit(here, this.wordvalue[this.wordnumber])) {
        this.pleasure++;
        this.print('Kissed.\n');
        this.emit('kiss', { who: this.wordvalue[this.wordnumber] });
        switch (this.wordvalue[this.wordnumber]) {
          case NORMGOD:
            switch (this.godready++) {
              case 0: this.puts('She squirms and avoids your advances.'); break;
              case 1: this.puts("She is coming around; she didn't fight it as much."); break;
              case 2: this.puts("She's beginning to like it."); break;
              default: this.puts("She's gone limp.");
            }
            break;
          case NATIVE:
            this.puts('Her lips are warm and her body robust.  She pulls you down to the ground.');
            break;
          case TIMER:
            this.puts('The old man blushes.');
            break;
          case MAN:
            this.puts('The dwarf punches you in the kneecap.');
            break;
          default:
            this.pleasure--;
        }
      } else this.puts('I see nothing like that here.');
    } else this.puts("I'd prefer not to.");
  }

  *love() {
    while (this.wordtype[++this.wordnumber] !== NOUNS && this.wordnumber <= this.wordcount) continue;
    const here = this.location[this.position].objects;
    if (this.wordtype[this.wordnumber] === NOUNS) {
      if ((testbit(here, BATHGOD) || testbit(here, NORMGOD)) && this.wordvalue[this.wordnumber] === NORMGOD) {
        if (this.loved) {
          this.print('Loved.\n');
          return;
        }
        if (this.godready >= 2) {
          this.puts("She cuddles up to you, and her mouth starts to work:\n'That was my sister's amulet.  The lovely goddess, Purl, was she.  The Empire\ncaptured her just after the Darkness came.  My other sister, Vert, was killed\nby the Dark Lord himself.  He took her amulet and warped its power.\nYour quest was foretold by my father before he died, but to get the Dark Lord's\namulet you must use cunning and skill.  I will leave you my amulet,");
          this.puts("which you may use as you wish.  As for me, I am the last goddess of the\nwaters.  My father was the Island King, and the rule is rightfully mine.'\n\nShe pulls the throne out into a large bed.");
          this.power++;
          this.pleasure += 15;
          this.ego++;
          if (this.card(this.injuries, NUMOFINJURIES)) {
            this.puts('Her kisses revive you; your wounds are healed.\n');
            for (let n = 0; n < NUMOFINJURIES; n++) this.injuries[n] = 0;
            this.WEIGHT = MAXWEIGHT;
            this.CUMBER = MAXCUMBER;
          }
          this.print('Goddess:\n');
          if (!this.loved) setbit(here, MEDALION);
          this.loved = 1;
          this.ourtime += 10;
          this.print('Loved.\n');
          this.emit('loved', { who: NORMGOD });
          yield* this.zzz();
          return;
        }
        this.puts('You wish!');
        return;
      }
      if (testbit(here, this.wordvalue[this.wordnumber])) {
        if (this.wordvalue[this.wordnumber] === NATIVE) {
          this.puts('The girl is easy prey.  She peels off her sarong and indulges you.');
          this.power++;
          this.pleasure += 5;
          this.print('Girl:\n');
          this.ourtime += 10;
          this.print('Loved.\n');
          this.emit('loved', { who: NATIVE });
          yield* this.zzz();
        }
        const v = this.wordvalue[this.wordnumber];
        if (v === MAN || v === BODY || v === ELF || v === TIMER) this.puts('Kinky!');
        else this.puts("It doesn't seem to work.");
      } else this.puts("Where's your lover?");
    } else this.puts("It doesn't seem to work.");
  }

  *zzz() {
    const oldtime = this.ourtime;
    if ((this.snooze - this.ourtime) < (0.75 * CYCLE)) {
      this.ourtime += trunc(0.75 * CYCLE - (this.snooze - this.ourtime));
      this.print('<zzz>' + '.'.repeat(max(0, this.ourtime - oldtime)) + '\n');
      this.emit('sleep', { from: oldtime, to: this.ourtime });
      this.snooze += 3 * (this.ourtime - oldtime);
      if (this.notes[LAUNCHED]) {
        if (!this.ovr.infiniteFuel) this.fuel -= (this.ourtime - oldtime);
        if (this.location[this.position].link[L_DOWN]) {
          this.position = this.location[this.position].link[L_DOWN];
          yield* this.crash();
        } else this.notes[LAUNCHED] = 0;
      }
      if (this.OUTSIDE && this.rng.rnd(100) < 50) {
        this.puts('You are awakened abruptly by the sound of someone nearby.');
        switch (this.rng.rnd(4)) {
          case 0: {
            if (this.ucard(this.inven)) {
              let n = this.rng.rnd(NUMOFOBJECTS);
              while (!testbit(this.inven, n)) n = this.rng.rnd(NUMOFOBJECTS);
              clearbit(this.inven, n);
              if (n !== AMULET && n !== MEDALION && n !== TALISMAN) setbit(this.location[this.position].objects, n);
              this.carrying -= OBJWT[n];
              this.encumber -= OBJCUMBER[n];
              this.emit('stolen', { object: n });
            }
            this.puts('A fiendish little Elf is stealing your treasures!');
            yield* this.fight(ELF, 10);
            break;
          }
          case 1:
            setbit(this.location[this.position].objects, DEADWOOD);
            break;
          case 2:
            setbit(this.location[this.position].objects, HALBERD);
            break;
          default:
            break;
        }
      }
    } else return 0;
    return 1;
  }

  chime() {
    const phase = trunc((this.ourtime % CYCLE) / trunc(CYCLE / 7));
    const DAY = ['It is just after sunrise.', 'It is early morning.', 'It is late morning.', 'It is near noon.',
      'It is early afternoon.', 'It is late afternoon.', 'It is near sunset.'];
    const NIGHT = ['It is just after sunset.', 'It is early evening.', 'The evening is getting old.',
      'It is near midnight.', 'These are the wee hours of the morning.', 'The night is waning.',
      'It is almost morning.'];
    if ((trunc(this.ourtime / CYCLE) + 1) % 2 && this.OUTSIDE) {
      if (DAY[phase]) this.puts(DAY[phase]);
    } else if (this.OUTSIDE) {
      if (NIGHT[phase]) this.puts(NIGHT[phase]);
    } else this.puts("I can't tell the time in here.");
  }

  *give() {
    let obj = -1, result = -1, person = 0, last1 = 0, last2 = 0;
    const firstnumber = this.wordnumber;
    while (this.wordtype[++this.wordnumber] !== OBJECT && this.wordvalue[this.wordnumber] !== AMULET &&
           this.wordvalue[this.wordnumber] !== MEDALION && this.wordvalue[this.wordnumber] !== TALISMAN &&
           this.wordnumber <= this.wordcount) continue;
    if (this.wordnumber <= this.wordcount) {
      obj = this.wordvalue[this.wordnumber];
      if (obj === EVERYTHING) this.wordtype[this.wordnumber] = -1;
      last1 = this.wordnumber;
    }
    this.wordnumber = firstnumber;
    while ((this.wordtype[++this.wordnumber] !== NOUNS || this.wordvalue[this.wordnumber] === obj) &&
           this.wordnumber <= this.wordcount);
    if (this.wordtype[this.wordnumber] === NOUNS) {
      person = this.wordvalue[this.wordnumber];
      last2 = this.wordnumber;
    }
    this.wordnumber = last1 - 1;
    const here = this.location[this.position].objects;
    if (person && testbit(here, person)) {
      if (person === NORMGOD && this.godready < 2 && !(obj === RING || obj === BRACELET)) {
        this.puts("The goddess won't look at you.");
      } else result = yield* this.drop('Given');
    } else {
      this.puts("I don't think that is possible.");
      this.wordnumber = max(last1, last2) + 1;
      return 0;
    }
    if (result !== -1 && (testbit(here, obj) || obj === AMULET || obj === MEDALION || obj === TALISMAN)) {
      clearbit(here, obj);
      this.ourtime++;
      this.ego++;
      this.emit('give', { object: obj, to: person });
      switch (person) {
        case NATIVE:
          this.puts('She accepts it shyly.');
          this.ego += 2;
          break;
        case NORMGOD:
          if (obj === RING || obj === BRACELET) {
            this.puts('She takes the charm and puts it on.  A little kiss on the cheek is');
            this.puts('your reward.');
            this.ego += 5;
            this.godready += 3;
          }
          if (obj === AMULET || obj === MEDALION || obj === TALISMAN) {
            this.win++;
            this.ego += 5;
            this.power -= 5;
            if (this.win >= 3) {
              this.puts('The powers of the earth are now legitimate.  You have destroyed the Darkness');
              this.puts('and restored the goddess to her throne.  The entire island celebrates with');
              this.puts('dancing and spring feasts.  As a measure of her gratitude, the goddess weds you');
              this.puts('in the late summer and crowns you Prince Liverwort, Lord of Fungus.');
              this.puts('\nBut, as the year wears on and autumn comes along, you become restless and');
              this.puts('yearn for adventure.  The goddess, too, realizes that the marriage can\'t last.');
              this.puts('She becomes bored and takes several more natives as husbands.  One evening,');
              this.puts('after having been out drinking with the girls, she kicks the throne particularly');
              this.puts("hard and wakes you up.  (If you want to win this game, you're going to have to\nshoot her!)");
              clearbit(here, MEDALION);
              this.wintime = this.ourtime;
              this.emit('wedding');
            }
          }
          break;
        case TIMER:
          if (obj === COINS) {
            this.puts('He fingers the coins for a moment and then looks up agape.  `Kind you are and');
            this.puts('I mean to repay you as best I can.\'  Grabbing a pencil and cocktail napkin...\n');
            this.print(NAPKIN_MAP);
            this.puts('\n`This map shows a secret entrance to the catacombs.');
            this.puts("You will know when you arrive because I left an old pair of shoes there.'");
            this.emit('napkinMap');
          }
          break;
        default: break;
      }
    }
    this.wordnumber = max(last1, last2) + 1;
    return firstnumber;
  }

  // ---------------------------------------------------------------- command6.c

  launch() {
    if (testbit(this.location[this.position].objects, VIPER) && !this.notes[CANTLAUNCH]) {
      if (this.fuel > 4) {
        const from = this.position;
        clearbit(this.location[this.position].objects, VIPER);
        this.position = this.location[this.position].link[L_UP];
        this.notes[LAUNCHED] = 1;
        this.ourtime++;
        if (!this.ovr.infiniteFuel) this.fuel -= 4;
        this.puts('You climb into the viper and prepare for launch.');
        this.puts('With a touch of your thumb the turbo engines ignite, thrusting you back into\nyour seat.');
        this.emit('launch', { from, to: this.position });
        return 1;
      }
      this.puts('Not enough fuel to launch.');
    } else this.puts("Can't launch.");
    return 0;
  }

  land() {
    const room = this.location[this.position];
    if (this.notes[LAUNCHED] && testbit(room.objects, LAND) && room.link[L_DOWN]) {
      const from = this.position;
      this.notes[LAUNCHED] = 0;
      this.position = room.link[L_DOWN];
      setbit(this.location[this.position].objects, VIPER);
      if (!this.ovr.infiniteFuel) this.fuel -= 2;
      this.ourtime++;
      this.puts('You are down.');
      this.emit('land', { from, to: this.position });
      return 1;
    }
    this.puts("You can't land here.");
    return 0;
  }

  /** command6.c die(): "bye." + rating, post(' '), exit(0). */
  *die(cause = 'death') {
    if (this.ovr.invulnerable && cause !== 'quit' && cause !== 'eof' && cause !== 'fantasy') {
      this.puts('[Override] You should have died here. Invulnerability averts it.');
      this.emit('deathAverted', { cause });
      throw new DeathAverted(cause);
    }
    this.print(`bye.\nYour rating was ${this.rate()}.\n`);
    if (this.cheated) this.puts('[Override was used in this game: the score is marked as cheated.]');
    this.post(' ', cause);
    this.emit('die', { cause });
    throw new GameEnd(cause === 'quit' || cause === 'eof' ? 'quit' : 'died');
    // eslint-disable-next-line no-unreachable
    yield;
  }

  /** command6.c live(): "You win!", post('!'), exit(0). */
  *live() {
    this.puts('\nYou win!');
    if (this.cheated) this.puts('[Override was used in this game: the score is marked as cheated.]');
    this.post('!', 'win');
    this.emit('win');
    throw new GameEnd('won');
    // eslint-disable-next-line no-unreachable
    yield;
  }

  post(ch, cause) {
    this.scorePost = {
      ch, cause, rating: this.rate(), username: this.username,
      wizard: this.wiz ? 'wizard' : this.tempwiz ? 'WIZARD!' : '',
      cheated: this.cheated, pleasure: this.pleasure, power: this.power, ego: this.ego, turns: this.ourtime,
      visited: this.card(this.beenthere, NUMOFROOMS),
    };
  }

  rate() {
    const score = max(max(this.pleasure, this.power), this.ego);
    if (score === this.pleasure) {
      if (score < 5) return 'novice';
      if (score < 20) return 'junior voyeur';
      if (score < 35) return 'Don Juan';
      return 'Marquis De Sade';
    } else if (score === this.power) {
      if (score < 5) return 'serf';
      if (score < 8) return 'Samurai';
      if (score < 13) return 'Klingon';
      if (score < 22) return 'Darth Vader';
      return 'Sauron the Great';
    }
    if (score < 5) return 'Polyanna';
    if (score < 10) return 'philanthropist';
    if (score < 20) return 'Tattoo';
    return 'Mr. Roarke';
  }

  *drive() {
    if (testbit(this.location[this.position].objects, CAR)) {
      this.puts('You hop in the car and turn the key.  There is a perceptible grating noise,');
      this.puts('and an explosion knocks you unconscious...');
      clearbit(this.location[this.position].objects, CAR);
      setbit(this.location[this.position].objects, CRASH);
      if (!this.ovr.invulnerable) this.injuries[5] = this.injuries[6] = this.injuries[7] = this.injuries[8] = 1;
      this.ourtime += 15;
      this.emit('carExplodes');
      yield* this.zzz();
      return 0;
    }
    this.puts('There is nothing to drive here.');
    return -1;
  }

  ride() {
    if (testbit(this.location[this.position].objects, HORSE)) {
      this.puts('You climb onto the stallion and kick it in the guts.  The stupid steed launches');
      this.puts('forward through bush and fern.  You are thrown and the horse gallops off.');
      const from = this.position;
      clearbit(this.location[this.position].objects, HORSE);
      for (;;) {
        this.position = this.rng.rnd(NUMOFROOMS + 1);
        if (this.position && this.OUTSIDE && this.beenthere[this.position] &&
            !this.location[this.position].link[L_FLYHERE]) break;
      }
      setbit(this.location[this.position].objects, HORSE);
      const l = this.location[this.position].link;
      if (l[L_NORTH]) this.position = l[L_NORTH];
      else if (l[L_SOUTH]) this.position = l[L_SOUTH];
      else if (l[L_EAST]) this.position = l[L_EAST];
      else this.position = l[L_WEST];
      this.emit('teleport', { from, to: this.position, how: 'horse' });
      return 0;
    }
    this.puts('There is no horse here.');
    return -1;
  }

  *light() {
    if (testbit(this.inven, MATCHES) && this.matchcount) {
      this.puts('Your match splutters to life.');
      this.ourtime++;
      this.matchlight = 1;
      this.matchcount--;
      this.emit('match');
      if (this.position === 217) {
        this.puts('The whole bungalow explodes with an intense blast.');
        this.emit('gasExplosion');
        yield* this.die('gas');
      }
    } else this.puts("You're out of matches.");
  }

  dooropen() {
    this.wordnumber++;
    if (this.wordnumber <= this.wordcount && this.wordtype[this.wordnumber] === NOUNS &&
        this.wordvalue[this.wordnumber] === DOOR) {
      switch (this.position) {
        case 189: case 231:
          if (this.location[189].link[L_NORTH] === 231) this.puts('The door is already open.');
          else this.puts('The door does not budge.');
          break;
        case 30:
          if (this.location[30].link[L_WEST] === 25) this.puts('The door is gone.');
          else this.puts('The door is locked tight.');
          break;
        case 31:
          this.puts("That's one immovable door.");
          break;
        case 20:
          this.puts('The door is already ajar.');
          break;
        default:
          this.puts('What door?');
      }
    } else this.puts("That doesn't open.");
  }

  // ---------------------------------------------------------------- command7.c

  *fight(enemy, strength) {
    let lifeline = 0;
    let hurt;
    let exhaustion = 0;
    this.inFight = { enemy, strength, lifeline: 0, rounds: 0 };
    this.emit('fightStart', { enemy, strength });
    try {
      for (;;) {
        // fighton:
        this.ourtime++;
        this.snooze -= 5;
        if (this.ovr.noFatigue) this.snooze = max(this.snooze, this.ourtime + trunc(CYCLE * 1.5));
        if (this.snooze > this.ourtime) exhaustion = trunc(CYCLE / (this.snooze - this.ourtime));
        else {
          this.puts('You collapse exhausted, and he pulverizes your skull.');
          yield* this.die('exhausted');
        }
        if (this.snooze - this.ourtime < 20) this.puts("You look tired! I hope you're able to fight.");
        const next = yield* this.getcom(LINELENGTH, '<fight!>-: ', null);
        let idx = 0;
        for (let i = 0; idx !== -1 && i < 10; i++) {
          const [w, ni] = Battlestar.getword(next, idx);
          this.words[i] = w;
          idx = ni;
        }
        this.parse();
        this.inFight.rounds++;
        switch (this.wordvalue[this.wordnumber]) {
          case KILL:
          case SMITE: {
            const inj = this.card(this.injuries, NUMOFINJURIES);
            if (testbit(this.inven, TWO_HANDED)) {
              hurt = this.rng.rnd(70) - 2 * inj - this.ucard(this.wear) - exhaustion;
            } else if (testbit(this.inven, SWORD) || testbit(this.inven, BROAD)) {
              // C '%' by zero would trap (SIGFPE) when WEIGHT == carrying; treated as 0 here.
              const roll = this.rng.rnd(50);
              const m = this.WEIGHT - this.carrying;
              hurt = (m === 0 ? 0 : roll % m) - inj - this.encumber - exhaustion;
            } else if (testbit(this.inven, KNIFE) || testbit(this.inven, MALLET) || testbit(this.inven, CHAIN) ||
                       testbit(this.inven, MACE) || testbit(this.inven, HALBERD)) {
              hurt = this.rng.rnd(15) - inj - exhaustion;
            } else hurt = this.rng.rnd(7) - this.encumber;
            let gain = 0;
            if (hurt < 5) {
              switch (this.rng.rnd(3)) {
                case 0: this.puts('You swung wide and missed.'); break;
                case 1: this.puts('He checked your blow. CLASH! CLANG!'); break;
                case 2: this.puts('His filthy tunic hangs by one less thread.'); break;
                default: break;
              }
            } else if (hurt < 10) {
              switch (this.rng.rnd(3)) {
                case 0: this.puts("He's bleeding."); break;
                case 1: this.puts('A trickle of blood runs down his face.'); break;
                case 2: this.puts('A huge purple bruise is forming on the side of his face.'); break;
                default: break;
              }
              gain = 1;
            } else if (hurt < 20) {
              switch (this.rng.rnd(3)) {
                case 0: this.puts('He staggers back quavering.'); break;
                case 1: this.puts('He jumps back with his hand over the wound.'); break;
                case 2: this.puts('His shirt falls open with a swath across the chest.'); break;
                default: break;
              }
              gain = 5;
            } else if (hurt < 30) {
              switch (this.rng.rnd(3)) {
                case 0: this.print(`A bloody gash opens up on his ${this.rng.rnd(2) ? 'left' : 'right'} side.\n`); break;
                case 1: this.puts('The steel bites home and scrapes along his ribs.'); break;
                case 2: this.puts('You pierce him, and his breath hisses through clenched teeth.'); break;
                default: break;
              }
              gain = 10;
            } else if (hurt < 40) {
              switch (this.rng.rnd(3)) {
                case 0:
                  this.puts('You smite him to the ground.');
                  if (strength - lifeline > 20) this.puts('But in a flurry of steel he regains his feet!');
                  break;
                case 1:
                  this.puts('The force of your blow sends him to his knees.');
                  this.puts('His arm swings lifeless at his side.');
                  break;
                case 2:
                  this.puts('Clutching his blood drenched shirt, he collapses stunned.');
                  break;
                default: break;
              }
              gain = 20;
            } else {
              switch (this.rng.rnd(3)) {
                case 0:
                  this.puts('His ribs crack under your powerful swing, flooding his lungs with blood.');
                  break;
                case 1:
                  this.puts('You shatter his upheld arm in a spray of blood.  The blade continues deep');
                  this.puts('into his back, severing the spinal cord.');
                  gain += 25;
                  break;
                case 2:
                  this.puts('With a mighty lunge the steel slides in, and gasping, he falls to the ground.');
                  gain += 25;
                  break;
                default: break;
              }
              gain += 30;
            }
            lifeline += gain;
            this.inFight.lifeline = lifeline;
            this.emit('strike', { enemy, hurt, gain, lifeline, strength });
            break;
          }

          case BACK:
            if (enemy === DARK && lifeline > strength * 0.33) {
              this.puts('He throws you back against the rock and pummels your face.');
              if (testbit(this.inven, AMULET) || testbit(this.wear, AMULET)) {
                this.print('Lifting the amulet from you, ');
                if (testbit(this.inven, MEDALION) || testbit(this.wear, MEDALION)) {
                  this.puts('his power grows and the walls of\nthe earth tremble.');
                  this.puts('When he touches the medallion, your chest explodes and the foundations of the\nearth collapse.');
                  this.puts('The planet is consumed by darkness.');
                  yield* this.die('darkness');
                }
                if (testbit(this.inven, AMULET)) {
                  clearbit(this.inven, AMULET);
                  this.carrying -= OBJWT[AMULET];
                  this.encumber -= OBJCUMBER[AMULET];
                } else clearbit(this.wear, AMULET);
                this.puts('he flees down the dark caverns.');
                clearbit(this.location[this.position].objects, DARK);
                this.hurtPlayer(SKULL);
                this.followfight = this.ourtime;
                this.emit('darkLordFlees');
                return 0;
              }
              this.puts("I'm afraid you have been killed.");
              yield* this.die('darklord');
            } else {
              this.puts('You escape stunned and disoriented from the fight.');
              this.puts('A victorious bellow echoes from the battlescene.');
              this.emit('fightEscape', { enemy });
              if (this.back && this.position !== this.back) this.moveplayer(this.back, BACK);
              else if (this.ahead && this.position !== this.ahead) this.moveplayer(this.ahead, AHEAD);
              else if (this.left && this.position !== this.left) this.moveplayer(this.left, LEFT);
              else if (this.right && this.position !== this.right) this.moveplayer(this.right, RIGHT);
              else this.moveplayer(this.location[this.position].link[L_DOWN], AHEAD);
              return 0;
            }
            break;

          case SHOOT:
            if (testbit(this.inven, LASER)) {
              if (strength - lifeline <= 50) {
                this.print(`The ${S(objsht(enemy))} took a direct hit!\n`);
                lifeline += 50;
                this.inFight.lifeline = lifeline;
                this.emit('strike', { enemy, laser: true, gain: 50, lifeline, strength });
              } else {
                this.puts('With his bare hand he deflects the laser blast and whips the pistol from you!');
                clearbit(this.inven, LASER);
                setbit(this.location[this.position].objects, LASER);
                this.carrying -= OBJWT[LASER];
                this.encumber -= OBJCUMBER[LASER];
                this.emit('disarmed', { enemy });
              }
            } else this.puts("Unfortunately, you don't have a blaster handy.");
            break;

          case DROP:
          case DRAW:
            yield* this.cypher();
            this.ourtime--;
            break;

          default:
            this.puts("You don't have a chance; he is too quick.");
            break;
        }
        if (lifeline >= strength) {
          this.print(`You have killed the ${S(objsht(enemy))}.\n`);
          if (enemy === ELF || enemy === DARK) {
            this.puts('A watery black smoke consumes his body and then vanishes with a peal of thunder!');
          }
          clearbit(this.location[this.position].objects, enemy);
          this.power += 2;
          this.notes[JINXED]++;
          this.emit('fightWon', { enemy });
          return 0;
        }
        this.puts('He attacks...');
        // "Some embellishments."
        hurt = this.rng.rnd(NUMOFINJURIES) - (testbit(this.inven, SHIELD) !== 0 ? 1 : 0) -
          (testbit(this.wear, MAIL) !== 0 ? 1 : 0) - (testbit(this.wear, HELM) !== 0 ? 1 : 0);
        hurt += (testbit(this.wear, AMULET) !== 0 ? 1 : 0) + (testbit(this.wear, MEDALION) !== 0 ? 1 : 0) +
          (testbit(this.wear, TALISMAN) !== 0 ? 1 : 0);
        hurt = hurt < 0 ? 0 : hurt;
        hurt = hurt >= NUMOFINJURIES ? NUMOFINJURIES - 1 : hurt;
        if (!this.injuries[hurt] && !this.ovr.invulnerable) {
          this.hurtPlayer(hurt);
          this.print(`I'm afraid you have suffered ${OUCH[hurt]}.\n`);
          this.emit('wounded', { enemy, injury: hurt });
        } else {
          this.puts('You emerge unscathed.');
          this.emit('parried', { enemy });
        }
        if (this.injuries[SKULL] && this.injuries[INCISE] && this.injuries[NECK]) {
          this.puts("I'm afraid you have suffered fatal injuries.");
          yield* this.die('injuries');
        }
      }
    } finally {
      this.inFight = null;
    }
  }

  // ---------------------------------------------------------------- fly.c

  /** fly.c visual(): returns 1 if the Cylon was destroyed, 0 if the pilot quit. */
  *visual() {
    this.emit('sleep1'); // sleep(1) before curses takes the screen
    const sim = new FlightSim(this);
    this.flightSim = sim;
    if (this.opts.onFlight) this.opts.onFlight(sim);
    try {
      if (this.flightMode === 'stdin') {
        // Piped input: keys arrive instantly, so SIGALRM never fires between them.
        while (!sim.done) {
          const c = yield* this.getchar();
          sim.key(c === -1 ? null : c);
          if (c === -1 && this.eof && !sim.done) {
            // An EOF'd pipe spins until the clock runs out (real time in C).
            while (!sim.done) { sim.tick(); sim.key(null); }
          }
        }
      } else {
        yield (this.request = { kind: 'flight', sim });
        if (!sim.done) { sim.done = true; sim.outcome = 'quit'; }
      }
    } finally {
      this.flightSim = null;
    }
    this.emit('flightEnd', { outcome: sim.outcome });
    if (sim.outcome === 'timeout') {
      yield* this.die('timeout');
      return 0;
    }
    return sim.outcome === 'destroyed' ? 1 : 0;
  }

  // ---------------------------------------------------------------- save.c

  /** Saves a JSON snapshot through the host hook (replaces the binary .Bstar). */
  save(name) {
    const snap = this.snapshot();
    let err = null;
    try {
      if (this.onSave) err = this.onSave(name, snap) || null;
      else err = 'no storage';
    } catch (e) {
      err = e.message;
    }
    if (err) this.print(`battlestar: ${name}: ${err}\n`);
    else {
      this.print(`Saved in ${name}.\n`);
      this.emit('saved', { name });
    }
  }

  /** Full engine state as plain JSON (versioned). */
  snapshot() {
    const rooms = (file) => file.map((r) => [Array.from(r.link), Array.from(r.objects)]);
    const pick = [
      'WEIGHT', 'CUMBER', 'ourclock', 'direction', 'position', 'ourtime', 'fuel', 'torps', 'carrying',
      'encumber', 'rythmn', 'followfight', 'ate', 'snooze', 'meetgirl', 'followgod', 'godready', 'win',
      'wintime', 'matchlight', 'matchcount', 'loved', 'pleasure', 'power', 'ego', 'tempwiz', 'verbose',
      'left', 'right', 'ahead', 'back', 'wordcount', 'wordnumber', 'cheated',
    ];
    const s = { format: 'battlestar-fancy-web', version: SNAPSHOT_VERSION };
    for (const k of pick) s[k] = this[k];
    s.night = this.location === this.nightfile;
    s.notes = [...this.notes];
    s.inven = Array.from(this.inven);
    s.wear = Array.from(this.wear);
    s.injuries = [...this.injuries];
    s.beenthere = [...this.beenthere];
    s.flight = { ...this.flight };
    s.words = [...this.words];
    s.wordvalue = [...this.wordvalue];
    s.wordtype = [...this.wordtype];
    s.dayfile = rooms(this.dayfile);
    s.nightfile = rooms(this.nightfile);
    s.rng = this.rng.snapshot();
    s.overrides = { ...this.ovr };
    return JSON.parse(JSON.stringify(s));
  }

  restore(s) {
    if (!s || s.format !== 'battlestar-fancy-web') throw new Error('not a battlestar save');
    if (s.version > SNAPSHOT_VERSION) throw new Error(`save version ${s.version} is newer than this game`);
    const keys = [
      'WEIGHT', 'CUMBER', 'ourclock', 'direction', 'position', 'ourtime', 'fuel', 'torps', 'carrying',
      'encumber', 'rythmn', 'followfight', 'ate', 'snooze', 'meetgirl', 'followgod', 'godready', 'win',
      'wintime', 'matchlight', 'matchcount', 'loved', 'pleasure', 'power', 'ego', 'tempwiz', 'verbose',
      'left', 'right', 'ahead', 'back', 'wordcount', 'wordnumber',
    ];
    for (const k of keys) if (k in s) this[k] = s[k];
    this.cheated = this.cheated || !!s.cheated;
    this.notes = [...s.notes];
    this.inven = Uint32Array.from(s.inven);
    this.wear = Uint32Array.from(s.wear);
    this.injuries = [...s.injuries];
    this.beenthere = [...s.beenthere];
    this.flight = { ...s.flight };
    if (s.words) this.words = [...s.words];
    if (s.wordvalue) this.wordvalue = [...s.wordvalue];
    if (s.wordtype) this.wordtype = [...s.wordtype];
    const load = (file, data) => data.forEach(([link, objects], i) => {
      file[i].link = Int32Array.from(link);
      file[i].objects = Uint32Array.from(objects);
    });
    load(this.dayfile, s.dayfile);
    load(this.nightfile, s.nightfile);
    this.location = s.night ? this.nightfile : this.dayfile;
    this.rng = GlibcRandom.fromSnapshot(s.rng);
  }

  // ---------------------------------------------------------------- Override

  /** Applies an Override-panel action at the main prompt. Returns 0 (re-describe) or -1. */
  applyMeta(meta) {
    this.cheated = true;
    switch (meta.action) {
      case 'teleport': {
        const to = meta.arg | 0;
        if (to < 1 || to > NUMOFROOMS) return -1;
        const from = this.position;
        this.position = to;
        if (!this.location[to].link[L_FLYHERE]) this.notes[LAUNCHED] = 0;
        this.puts(`[Override] Teleported to room ${to}.`);
        this.emit('teleport', { from, to, how: 'override' });
        return 0;
      }
      case 'daynight': {
        if (this.location === this.nightfile) { this.convert(TODAY); this.emit('dawn'); } else {
          this.convert(TONIGHT);
          clearbit(this.location[POOLS].objects, BATHGOD);
          this.emit('dusk');
        }
        this.rythmn = this.ourtime - this.ourtime % CYCLE;
        this.puts(`[Override] It is now ${this.location === this.nightfile ? 'night' : 'day'}.`);
        return 0;
      }
      default:
        return -1;
    }
  }

  // ---------------------------------------------------------------- queries (UI, hints)

  has(obj) { return !!testbit(this.inven, obj); }
  wears(obj) { return !!testbit(this.wear, obj); }
  holds(obj) { return this.has(obj) || this.wears(obj); }
  here(obj, room = this.position) { return !!testbit(this.location[room].objects, obj); }
  room(n = this.position) { return this.location[n]; }
  canSee() {
    return !this.notes[CANTSEE] || this.has(LAMPON) || this.here(LAMPON) || !!this.matchlight;
  }
  objectsIn(room = this.position) {
    const out = [];
    for (let n = 0; n < NUMOFOBJECTS; n++) if (testbit(this.location[room].objects, n)) out.push(n);
    return out;
  }
  inventory() {
    const out = [];
    for (let n = 0; n < NUMOFOBJECTS; n++) if (testbit(this.inven, n)) out.push(n);
    return out;
  }
  worn() {
    const out = [];
    for (let n = 0; n < NUMOFOBJECTS; n++) if (testbit(this.wear, n)) out.push(n);
    return out;
  }
  /** Absolute direction words for exits, from the current facing. */
  exits(room = this.position) {
    const l = this.location[room].link;
    return { north: l[L_NORTH], south: l[L_SOUTH], east: l[L_EAST], west: l[L_WEST], up: l[L_UP], down: l[L_DOWN],
      access: l[L_ACCESS], flyhere: l[L_FLYHERE] };
  }
}

/** sscanf(buffer, "%d", &x): leading whitespace, optional sign, digits. null if no match. */
function sscanfInt(buf) {
  const m = /^[ \t\n\v\f\r]*([+-]?\d+)/.exec(buf);
  if (!m) return null;
  const v = parseInt(m[1], 10);
  return v | 0;
}

// command5.c give(): the old-timer's cocktail-napkin map, verbatim (tabs kept).
const NAPKIN_MAP = [
  '+-----------------------------------------------------------------------------+\n',
  '|\t\t\t\t   xxxxxxxx\\\t\t\t\t      |\n',
  '|\t\t\t\t       xxxxx\\\tCLIFFS\t\t\t      |\n',
  '|\t\tFOREST\t\t\t  xxx\\\t\t\t\t      |\n',
  '|\t\t\t\t\\\\\t     x\\        \tOCEAN\t\t      |\n',
  '|\t\t\t\t||\t       x\\\t\t\t      |\n',
  '|\t\t\t\t||  ROAD\tx\\\t\t\t      |\n',
  '|\t\t\t\t||\t\tx\\\t\t\t      |\n',
  '|\t\tSECRET\t\t||\t  .........\t\t\t      |\n',
  '|\t\t - + -\t\t||\t   ........\t\t\t      |\n',
  '|\t\tENTRANCE\t||\t\t...      BEACH\t\t      |\n',
  '|\t\t\t\t||\t\t...\t\t  E\t      |\n',
  '|\t\t\t\t||\t\t...\t\t  |\t      |\n',
  '|\t\t\t\t//\t\t...\t    N <-- + --- S     |\n',
  '|\t\tPALM GROVE     //\t\t...\t\t  |\t      |\n',
  '|\t\t\t      //\t\t...\t\t  W\t      |\n',
  '+-----------------------------------------------------------------------------+\n',
].join('');

export { C, testbit, OBJSHT, OBJDES, OUCH, OBJWT, OBJCUMBER, OBJFLAGS, DAYFILE, NIGHTFILE, L_UP, L_DOWN, L_ACCESS, L_FLYHERE };
