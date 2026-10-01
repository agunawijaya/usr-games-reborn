// One full turn: the human "window" of orders, then the driver tick.
//
// In the original, players typed commands during a 7-second window
// (sail/pl_2.c:45-160) while a separate driver process woke up every 7 s and
// ran, in this order (sail/dr_main.c:90-112):
//
//   next -> unfoul -> checkup -> prizecheck -> moveall -> thinkofgrapples
//        -> boardcomp -> compcombat -> resolve -> reload -> checksails
//
// then each player's newturn() advanced reloading and checked for the end
// (sail/pl_7.c:116-168). This module keeps that order exactly, but makes the
// window explicit: resolveTurn(state, orders) is a pure function that
// returns a NEW state plus an ordered list of events for the renderer.

import {
  L_EMPTY, L_DOUBLE, R_EMPTY, R_LOADING, R_DOUBLE, R_LOADED, LOAD_BY_WORD, LOAD_WORD,
} from './constants.js';
import { dieroll } from './rng.js';
import { range } from './geometry.js';
import {
  cloneState, capship, snagged, fouled2, emit, makemsg, unboard, isActive, sideOf,
  freeSections, shipLabel,
} from './state.js';
import { validateMove, maxturns, maxmove, closeon, moveall } from './movement.js';
import {
  playerFire, compcombat, checkup, closestenemy,
} from './combat.js';
import {
  unfoul, thinkofgrapples, boardcomp, resolve, prizecheck,
  playerGrapple, playerUnfoul, playerParties, boardableTargets,
} from './boarding.js';

// ----------------------------------------------------------------------------
// Orders for one human ship during one turn. Every field is optional.
//
// {
//   grapple: [{ target, action: 'g' | 'u' }],
//   unfoul:  [target],
//   sails:   'full' | 'battle',
//   recall:  true,                          // 'B' — recall all parties
//   board:   [{ target, sections }],        // 'b' — offensive parties
//   repel:   sections,                      // 'b' — defensive parties
//   fire:    { L: 'hull'|'rigging'|true, R: ... },   // 'f'
//   unload:  true,                          // 'L'
//   load:    { L: 'round'|'double'|'chain'|'grape', R: ... },  // 'l'
//   repair:  'hull' | 'guns' | 'rigging',   // 'r'
//   move:    'l1r1r2',                      // 'm' — the last one wins
// }
// ----------------------------------------------------------------------------

function applyPlayerOrders(ctx, ms, o = {}) {
  const { st } = ctx;
  const flags = { changed: false, loaded: false, fired: false, turned: false };
  if (ms.dir === 0 || ms.struck) return flags;

  for (const g of o.grapple || []) {
    const sp = st.ships[g.target];
    if (sp) playerGrapple(ctx, ms, sp, g.action === 'u' ? 'u' : 'g');
  }
  for (const t of o.unfoul || []) {
    const sp = st.ships[t];
    if (sp && fouled2(ms, sp)) playerUnfoul(ctx, ms, sp);
  }

  // 'c' — change sail (sail/pl_4.c:46-71)
  if (o.sails === 'full' || o.sails === 'battle') {
    let rig = ms.specs.rig1;
    if (st.windspeed === 6 || (st.windspeed === 5 && ms.specs.class > 4)) rig = 0;
    if (ms.specs.crew3 && rig) {
      const want = o.sails === 'full' ? 1 : 0;
      if ((ms.FS !== 0) !== !!want) {
        ms.FS = want;
        flags.changed = true;
        emit(ctx, 'sails', { ship: ms.index, full: !!want });
        makemsg(ctx, ms, want ? 'setting full sails' : 'reducing to battle sails');
      }
    } else if (!rig) makemsg(ctx, ms, 'Sails rent to pieces');
  }

  // 'B' — hands to stations (sail/pl_2.c:82-86)
  if (o.recall) {
    unboard(ms, ms, 1);
    unboard(ms, ms, 0);
    makemsg(ctx, ms, "'Hands to stations!'");
  }
  // 'b' — boarders and defenders (sail/pl_5.c:155-206)
  const allowed = new Set(boardableTargets(st, ms));
  for (const b of o.board || []) {
    if (allowed.has(b.target) && b.sections > 0) playerParties(ctx, ms, st.ships[b.target], b.sections, 0);
  }
  if (o.repel > 0 && freeSections(ms)[2]) playerParties(ctx, ms, ms, o.repel, 1);

  // 'f' — fire (sail/pl_3.c:46-217)
  for (const side of ['L', 'R']) {
    const f = o.fire && o.fire[side];
    if (!f) continue;
    const ev = playerFire(ctx, ms, side === 'R' ? 1 : 0, f === 'hull' ? 'hull' : 'rigging');
    if (ev) flags.fired = true;
  }

  // 'L' — unload both broadsides (sail/pl_2.c:94-100)
  if (o.unload) {
    ms.loadL = L_EMPTY;
    ms.loadR = L_EMPTY;
    ms.readyL = R_EMPTY;
    ms.readyR = R_EMPTY;
    makemsg(ctx, ms, 'Broadsides unloaded');
  }
  // 'l' — load an EMPTY broadside (sail/pl_6.c:152-205)
  if (o.load) {
    for (const side of ['L', 'R']) {
      const w = o.load[side];
      if (!w) continue;
      if (!ms.specs.crew3) {
        makemsg(ctx, ms, 'Out of crew');
        break;
      }
      const load = LOAD_BY_WORD[w];
      if (!load) continue;
      if ((side === 'L' ? ms.loadL : ms.loadR) !== L_EMPTY) continue;
      const ready = (load === L_DOUBLE ? R_DOUBLE : 0) | R_LOADING;
      if (side === 'L') {
        ms.loadL = load;
        ms.readyL = ready;
      } else {
        ms.loadR = load;
        ms.readyR = ready;
      }
      flags.loaded = true;
      emit(ctx, 'load', { ship: ms.index, side, load });
      makemsg(ctx, ms, `loading ${side === 'L' ? 'port' : 'starboard'} broadside with ${LOAD_WORD[load]}`);
    }
  }

  // 'm' — helm order (sail/pl_5.c:54-153)
  let mv = null;
  if (typeof o.move === 'string') {
    mv = validateMove(st, ms, o.move);
    if (mv.fsDropped) ms.FS = 0;
    for (const m of mv.msgs) makemsg(ctx, ms, m);
    ms.movebuf = mv.unable ? '' : mv.movebuf;
    flags.turned = /[lr]/.test(ms.movebuf);
  } else {
    ms.movebuf = '';
  }

  // 'r' — repair (sail/pl_6.c:47-139). All hands: nothing else this turn.
  if (o.repair) repair(ctx, ms, o.repair, flags);
  return flags;
}

function repair(ctx, ms, kind, flags) {
  if (flags.loaded || flags.fired || flags.changed || flags.turned) {
    makemsg(ctx, ms, 'No hands free to repair');
    return;
  }
  const key = { hull: 'RH', guns: 'RG', rigging: 'RR' }[kind];
  if (!key) return;
  const p = ms.specs;
  let count = 2;
  const fix = (field, m) => {
    if (m - p[field] > count) {
      p[field] += count;
      count = 0;
    } else {
      count -= m - p[field];
      p[field] = m;
    }
  };
  const before = { hull: p.hull, gunL: p.gunL, gunR: p.gunR, rig: [p.rig1, p.rig2, p.rig3, p.rig4] };
  ms[key]++;
  let done = false;
  if (ms[key] >= 3) {
    if (kind === 'hull') {
      const max = Math.trunc(p.guns / 4);
      if (p.hull < max) fix('hull', max);
    } else if (kind === 'guns') {
      if (p.gunL < p.gunR) {
        const max = Math.trunc(p.guns / 5) - p.carL;
        if (p.gunL < max) fix('gunL', max);
      } else {
        const max = Math.trunc(p.guns / 5) - p.carR;
        if (p.gunR < max) fix('gunR', max);
      }
    } else {
      const X = 2; // jury rig: masts come back to 2 at most
      if (p.rig4 >= 0 && p.rig4 < X) fix('rig4', X);
      if (count && p.rig3 < X) fix('rig3', X);
      if (count && p.rig2 < X) fix('rig2', X);
      if (count && p.rig1 < X) fix('rig1', X);
    }
    if (count === 2) {
      makemsg(ctx, ms, 'Repairs completed.');
      ms[key] = 2;
      done = true;
    } else {
      ms[key] = 0;
    }
  }
  emit(ctx, 'repair', {
    ship: ms.index, kind, progress: ms[key], done, before,
    after: { hull: p.hull, gunL: p.gunL, gunR: p.gunR, rig: [p.rig1, p.rig2, p.rig3, p.rig4] },
  });
}

// --- driver --------------------------------------------------------------------------

// Turn counter and weather (sail/dr_1.c:400-478). Returns false when the
// hurricane ends the game.
function next(ctx) {
  const { st } = ctx;
  if (st.windspeed === 7) return false;
  st.turn++;
  if (st.turn % 7 === 0 && (dieroll(st.rng) >= st.windchange || !st.windspeed)) {
    const prev = { dir: st.winddir, speed: st.windspeed };
    switch (dieroll(st.rng)) {
      case 1: st.winddir = 1; break;
      case 2: break;
      case 3: st.winddir++; break;
      case 4: st.winddir--; break;
      case 5: st.winddir += 2; break;
      case 6: st.winddir -= 2; break;
      default: break;
    }
    if (st.winddir > 8) st.winddir -= 8;
    if (st.winddir < 1) st.winddir += 8;
    if (st.windspeed) {
      switch (dieroll(st.rng)) {
        case 1: case 2: st.windspeed--; break;
        case 5: case 6: st.windspeed++; break;
        default: break;
      }
    } else st.windspeed++;
    emit(ctx, 'wind', { dir: st.winddir, speed: st.windspeed, prevDir: prev.dir, prevSpeed: prev.speed });
    if (st.windspeed === 7) emit(ctx, 'msg', { text: 'The glass is falling like a stone. HURRICANE!' });
  }
  return true;
}

// Computer captains choose their helm orders (sail/dr_3.c:61-83).
function planComputerMoves(st) {
  for (const sp of st.ships) {
    if (sp.captain || sp.dir === 0) continue;
    if (!sp.struck && st.windspeed && !snagged(sp) && sp.specs.crew3) {
      const { turns } = maxturns(sp);
      const ma = maxmove(st, sp, sp.dir, 0);
      const closest = closestenemy(st, sp, 0, 0);
      sp.movebuf = closest ? closeon(st, sp, closest, turns, ma) : '';
    } else sp.movebuf = '';
  }
}

// Computer ships forget their grape preference each turn (sail/dr_3.c:316-324).
function reload(st) {
  for (const sp of st.ships) sp.loadwith = 0;
}

// Computer captains crowd on sail only when the enemy is far (sail/dr_3.c:326-353).
function checksails(ctx) {
  const { st } = ctx;
  for (const sp of st.ships) {
    if (sp.captain) continue;
    let rig = sp.specs.rig1;
    if (st.windspeed === 6 || (st.windspeed === 5 && sp.specs.class > 4)) rig = 0;
    let full = 0;
    if (rig && sp.specs.crew3) {
      const close = closestenemy(st, sp, 0, 0);
      full = close && range(sp, close) > 9 ? 1 : 0;
    }
    if ((sp.FS !== 0) !== !!full) {
      sp.FS = full;
      if (sp.dir) emit(ctx, 'sails', { ship: sp.index, full: !!full });
    }
  }
}

// Each human's end of turn (sail/pl_7.c:116-168).
function newturn(ctx, ms) {
  const { st } = ctx;
  for (const side of ['L', 'R']) {
    const k = `ready${side}`;
    if (ms[k] & R_LOADING) {
      ms[k] = ms[k] & R_DOUBLE ? R_LOADING : R_LOADED;
    }
  }
  if (ms.FS && (!ms.specs.rig1 || st.windspeed === 6)) {
    ms.FS = 0;
    emit(ctx, 'sails', { ship: ms.index, full: false, forced: true });
  }
  if (ms.FS === 1) ms.FS = 2;
}

// --- termination (port addition, ADR 003) -----------------------------------------------

export function checkEnd(st) {
  if (st.windspeed === 7) {
    return { reason: 'hurricane', text: 'Hurricane!  All ships destroyed.' };
  }
  const active = st.ships.filter(isActive);
  if (st.players.length) {
    const me = st.ships[st.players[0]];
    if (me.captured >= 0) return { reason: 'captured', text: 'Your ship was captured.', win: false };
    if (me.dir === 0) return { reason: 'lost', text: me.sink ? 'Your ship has foundered.' : 'Your ship has blown up.', win: false };
    if (me.struck) return { reason: 'struck', text: 'You have struck your colours.', win: false };
    const mySide = sideOf(st, me);
    const hostile = active.filter((sp) => sideOf(st, sp) !== mySide);
    if (!hostile.length) return { reason: 'victory', text: 'The enemy is beaten — the day is yours!', win: true };
  } else {
    const sides = new Set(active.map((sp) => sideOf(st, sp)));
    if (sides.size <= 1) return { reason: 'decided', text: 'One flag remains.', side: [...sides][0] ?? null };
  }
  if (st.turn >= st.maxTurns) {
    return { reason: 'nightfall', text: 'Night falls and the fleets draw apart.' };
  }
  return null;
}

// --- the public entry point -------------------------------------------------------------

// resolveTurn(state, ordersByShip) -> { state, events, flags }
// ordersByShip: { [shipIndex]: orders }. The input state is not modified.
export function resolveTurn(state, ordersByShip = {}) {
  if (state.over) return { state, events: [] };
  const st = cloneState(state);
  const ctx = { st, events: [], phase: 'player' };
  emit(ctx, 'turn', { turn: st.turn + 1 });

  // 1. The humans' window (their shots fly before anything moves).
  const flags = {};
  for (const idx of st.players) {
    flags[idx] = applyPlayerOrders(ctx, st.ships[idx], ordersByShip[idx]);
  }

  // 2. The driver tick.
  ctx.phase = 'driver';
  if (!next(ctx)) {
    st.over = true;
    st.result = checkEnd(st);
    emit(ctx, 'end', { result: st.result });
    return { state: st, events: ctx.events, flags };
  }
  unfoul(ctx);
  checkup(ctx);
  prizecheck(ctx);
  planComputerMoves(st);
  ctx.phase = 'move';
  moveall(ctx);
  ctx.phase = 'engage';
  thinkofgrapples(ctx);
  boardcomp(ctx);
  compcombat(ctx);
  ctx.phase = 'melee';
  resolve(ctx);
  reload(st);
  checksails(ctx);

  // 3. The humans' end of turn.
  ctx.phase = 'end';
  for (const idx of st.players) newturn(ctx, st.ships[idx]);

  const res = checkEnd(st);
  if (res) {
    st.over = true;
    st.result = res;
    emit(ctx, 'end', { result: res });
  }
  return { state: st, events: ctx.events, flags };
}

// Convenience for AI-vs-AI runs: hand the human ship to the computer.
export function autopilot(state) {
  const st = cloneState(state);
  for (const i of st.players) {
    st.ships[i].captain = '';
    st.ships[i].human = false;
  }
  st.players = [];
  return st;
}

export { shipLabel, capship };
