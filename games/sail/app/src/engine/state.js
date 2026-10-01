// Game state: creation, helpers and the low-level "Write" operations.
//
// The original kept per-ship state in `struct File` + a live copy of
// `struct shipspecs` shared through a tempfile (sail/extern.h:170-230,
// sail/sync.c:305-499). Here the whole battle is ONE plain, JSON-serialisable
// object, so it can be saved, replayed, diffed in tests, or later run on a
// server (ADR 003). Nothing in the engine touches the DOM, time, or
// Math.random.

import { SPECS, SCENARIOS } from './data.js';
import { createRng } from './rng.js';
import {
  L_ROUND, R_LOADED, R_INITIAL, R_LOADING, NBP, COUNTRY, MAX_TURNS, LOAD_BY_WORD, LOAD_NAME,
} from './constants.js';

const emptyBP = () => ({ turnsent: 0, toship: -1, mensent: 0 });

export function createGame({
  scenarioId,
  playerShip = null, // index (or array of indices) of human ships; null = all-AI
  seed = 1,
  captain = 'Hornblower',
  initialLoad = { L: 'round', R: 'round' },
  maxTurns = MAX_TURNS,
} = {}) {
  const sc = SCENARIOS[scenarioId];
  if (!sc) throw new Error(`no scenario ${scenarioId}`);
  const n = sc.ships.length;
  const sternCount = new Array(COUNTRY.length).fill(0);
  const ships = sc.ships.map((s, index) => {
    const specs = { ...SPECS[s.spec] };
    return {
      index,
      name: s.name,
      nationality: s.nationality,
      specId: s.spec,
      specs, // live values (the original mutated shipspecs in place)
      max: { ...specs }, // pristine copy, used by the UI and renderer
      captain: '',
      human: false,
      points: 0,
      loadL: L_ROUND,
      loadR: L_ROUND,
      readyL: R_LOADED | R_INITIAL,
      readyR: R_LOADED | R_INITIAL,
      OBP: Array.from({ length: NBP }, emptyBP),
      DBP: Array.from({ length: NBP }, emptyBP),
      struck: 0,
      captured: -1,
      pcrew: 0,
      movebuf: '',
      drift: 0,
      nfoul: 0,
      ngrap: 0,
      foul: Array.from({ length: n }, () => ({ count: 0, turn: 0 })),
      grap: Array.from({ length: n }, () => ({ count: 0, turn: 0 })),
      RH: 0,
      RG: 0,
      RR: 0,
      FS: 0, // 0 battle sails, 1 full sails set this turn, 2 full sails
      explode: 0, // 1 = on fire, 2 = blown up
      sink: 0, // 1 = sinking, 2 = sunk
      dir: s.dir,
      row: s.row,
      col: s.col,
      loadwith: 0,
      stern: sternCount[s.nationality]++,
    };
  });
  const players = [];
  const humans = playerShip === null || playerShip === undefined ? []
    : (Array.isArray(playerShip) ? playerShip : [playerShip]);
  for (const idx of humans) {
    const me = ships[idx];
    if (!me) throw new Error(`no ship ${idx} in scenario ${scenarioId}`);
    // Initial broadsides are chosen by the captain (sail/pl_main.c:216-246).
    me.captain = captain || 'no name';
    me.human = true;
    me.loadL = LOAD_BY_WORD[initialLoad.L] || L_ROUND;
    me.loadR = LOAD_BY_WORD[initialLoad.R] || L_ROUND;
    players.push(idx);
  }
  return {
    v: 1,
    scenarioId,
    name: sc.name,
    seed,
    rng: createRng(seed),
    turn: 0,
    winddir: sc.winddir,
    windspeed: sc.windspeed,
    windchange: sc.windchange,
    ships,
    players,
    maxTurns,
    over: false,
    result: null,
  };
}

export const cloneState = (state) => JSON.parse(JSON.stringify(state));

// --- predicates --------------------------------------------------------------

export const capship = (st, sp) => (sp.captured >= 0 ? st.ships[sp.captured] : sp);
export const grappled = (sp) => sp.ngrap;
export const fouled = (sp) => sp.nfoul;
export const snagged = (sp) => sp.ngrap + sp.nfoul;
export const grappled2 = (a, b) => a.grap[b.index].count;
export const fouled2 = (a, b) => a.foul[b.index].count;
export const snagged2 = (a, b) => grappled2(a, b) + fouled2(a, b);
// "X" variants only count snags older than one turn (sail/extern.h:67-69).
export const Xgrappled2 = (st, a, b) => (a.grap[b.index].turn < st.turn - 1 ? grappled2(a, b) : 0);
export const Xfouled2 = (st, a, b) => (a.foul[b.index].turn < st.turn - 1 ? fouled2(a, b) : 0);
export const Xsnagged2 = (st, a, b) => Xgrappled2(st, a, b) + Xfouled2(st, a, b);

export const isActive = (sp) => sp.dir !== 0 && !sp.struck;
export const sideOf = (st, sp) => capship(st, sp).nationality;

// Two-character glyph exactly as the original draws it (sail/misc.c:179-194,
// sail/extern.h:75): nation letter (upper-case under full sail) or !/#/~,
// then the stern number (captured ships use & ' ( ) * +).
export function colours(st, sp) {
  if (sp.struck) {
    if (sp.sink) return '~';
    if (sp.explode) return '#';
    return '!';
  }
  const flag = COUNTRY[capship(st, sp).nationality][0];
  return sp.FS ? flag : flag.toLowerCase();
}
export function sterncolour(sp) {
  return String.fromCharCode(sp.stern + 48 - (sp.captured >= 0 ? 10 : 0));
}
export const glyph = (st, sp) => colours(st, sp) + sterncolour(sp);

// Status-pane load label, e.g. "R!", "D*", "G" (sail/extern.h:79, pl_7.c).
export function loadLabel(sp, side) {
  const load = side === 'L' ? sp.loadL : sp.loadR;
  const ready = side === 'L' ? sp.readyL : sp.readyR;
  const mark = ready & R_LOADING ? '*' : ready & R_INITIAL ? '!' : '';
  return LOAD_NAME[load] + mark;
}
export const shipLabel = (st, sp) => `${sp.name} (${glyph(st, sp)})`;

// --- event emission -----------------------------------------------------------

export function emit(ctx, t, data = {}) {
  ctx.events.push({ t, seq: ctx.events.length, phase: ctx.phase, ...data });
}
export function makemsg(ctx, sp, text) {
  emit(ctx, 'msg', { ship: sp.index, text: `${shipLabel(ctx.st, sp)}: ${text}` });
}
export function makesignal(ctx, from, fmt, to) {
  emit(ctx, 'msg', {
    ship: from.index,
    to: to.index,
    text: `${shipLabel(ctx.st, from)}: ${fmt.replace('$$', shipLabel(ctx.st, to))}`,
  });
}

// --- snag writes (sail/sync.c:323-366) -----------------------------------------

export function addFoul(st, sp, other) {
  if (other.dir === 0) return;
  const p = sp.foul[other.index];
  if (p.count++ === 0) p.turn = st.turn;
  sp.nfoul++;
}
export function addGrap(st, sp, other) {
  if (other.dir === 0) return;
  const p = sp.grap[other.index];
  if (p.count++ === 0) p.turn = st.turn;
  sp.ngrap++;
}
function removeSnag(sp, key, nkey, other, all) {
  const p = sp[key][other.index];
  if (p.count > 0) {
    if (all) {
      sp[nkey] -= p.count;
      p.count = 0;
    } else {
      sp[nkey]--;
      p.count--;
    }
  }
}

// --- boarding party bookkeeping (sail/parties.c) ----------------------------------

export function meleeing(from, to) {
  return from.OBP.some((p) => p.turnsent && p.toship === to.index);
}
export function boarding(from, isdefense) {
  return (isdefense ? from.DBP : from.OBP).some((p) => p.turnsent);
}
export function unboard(ship, to, isdefense) {
  const bps = isdefense ? ship.DBP : ship.OBP;
  for (let n = 0; n < NBP; n++) {
    const p = bps[n];
    if (p.turnsent && (p.toship === to.index || isdefense || ship === to)) {
      bps[n] = emptyBP();
    }
  }
}

// sail/assorted.c:239-262
export function cleansnag(st, from, to, all, flag) {
  if (flag & 1) {
    removeSnag(from, 'grap', 'ngrap', to, all);
    removeSnag(to, 'grap', 'ngrap', from, all);
  }
  if (flag & 2) {
    removeSnag(from, 'foul', 'nfoul', to, all);
    removeSnag(to, 'foul', 'nfoul', from, all);
  }
  if (!snagged2(from, to)) {
    if (!snagged(from)) {
      unboard(from, from, 1);
      unboard(from, from, 0);
    } else unboard(from, to, 0);
    if (!snagged(to)) {
      unboard(to, to, 1);
      unboard(to, to, 0);
    } else unboard(to, from, 0);
  }
}
export const cleangrapple = (st, a, b, all) => cleansnag(st, a, b, all, 1);
export const cleanfoul = (st, a, b, all) => cleansnag(st, a, b, all, 2);

// Crew sections still aboard (not away in a boarding party), as 0/1 flags,
// mirroring the decimal "mensent" encoding (100 = section 1, 10 = 2, 1 = 3).
// sail/pl_3.c:60-75, sail/pl_5.c:164-183
export function freeSections(sp) {
  let men = 0;
  for (const p of sp.OBP) if (p.turnsent) men += p.mensent;
  for (const p of sp.DBP) if (p.turnsent) men += p.mensent;
  const c = [sp.specs.crew1, sp.specs.crew2, sp.specs.crew3];
  if (!men) return c.map((x) => (x !== 0 ? 1 : 0));
  return [
    Math.trunc(men / 100) ? 0 : (c[0] !== 0 ? 1 : 0),
    Math.trunc((men % 100) / 10) ? 0 : (c[1] !== 0 ? 1 : 0),
    men % 10 ? 0 : (c[2] !== 0 ? 1 : 0),
  ];
}
