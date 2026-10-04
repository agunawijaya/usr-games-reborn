import { restoreRng } from '@usr-games/kit';
import {
  boardable,
  computerBoarding,
  computerGrapples,
  computerUnfoul,
  playerGrapple,
  playerParty,
  playerUnfoul,
  prisonersRise,
  resolveMelees,
} from './boarding';
import { applySignal, computerSails, planComputerHelms } from './captains';
import { distance, gunsBear, range } from './geometry';
import { burnAndSink, closestShip, computerGunnery, playerFire, strike } from './gunnery';
import { checkHelm, moveAll } from './movement';
import {
  capship,
  cloneBattle,
  crewOf,
  type Ctx,
  dieroll,
  emit,
  fouled2,
  freeSections,
  isActive,
  isDismasted,
  unboard,
} from './state';
import {
  type Battle,
  type BattleEnd,
  type BattleEvent,
  DOUBLE,
  EMPTY,
  type Orders,
  R_DOUBLE,
  R_EMPTY,
  R_LOADED,
  R_LOADING,
  type Ship,
} from './types';

/**
 * One turn. The original split it between each player's window of orders (sail/pl_2.c:45-160)
 * and the driver that woke every seven seconds (sail/dr_main.c:90-112):
 *
 *   orders -> weather -> unfoul -> sink and burn -> prisoners -> helms -> move -> grapples
 *          -> boarders -> computer broadsides -> melee -> sails -> reloading
 *
 * resolveTurn keeps that order as a pure function: a new battle and the events to play back.
 * Figurehead adds four rules, each marked where it acts: a beaten computer ship yields, ships
 * can leave the chart, a hurricane ends the battle instead of sinking every ship, and the
 * player may strike her own flag.
 */

interface TurnFlags {
  loaded: boolean;
  fired: boolean;
  sails: boolean;
  turned: boolean;
}

function setSails(ctx: Ctx, me: Ship, want: 'full' | 'battle', flags: TurnFlags): void {
  const { st } = ctx;
  let rig = me.specs.rig1;
  if (st.windspeed === 6 || (st.windspeed === 5 && me.specs.cls > 4)) rig = 0;
  if (!me.specs.crew3 || !rig) {
    if (!rig) emit(ctx, { t: 'note', ship: me.index, note: 'sails-torn' });
    return;
  }
  const full = want === 'full';
  if ((me.FS !== 0) === full) return;
  me.FS = full ? 1 : 0;
  flags.sails = true;
  emit(ctx, { t: 'sails', ship: me.index, full, forced: false });
}

function loadGuns(ctx: Ctx, me: Ship, load: NonNullable<Orders['load']>, flags: TurnFlags): void {
  for (const side of ['L', 'R'] as const) {
    const shot = load[side];
    if (!shot) continue;
    if (!me.specs.crew3) {
      emit(ctx, { t: 'note', ship: me.index, note: 'no-crew-to-load' });
      return;
    }
    if ((side === 'L' ? me.loadL : me.loadR) !== EMPTY) continue;
    const ready = (shot === DOUBLE ? R_DOUBLE : 0) | R_LOADING;
    if (side === 'L') [me.loadL, me.readyL] = [shot, ready];
    else [me.loadR, me.readyR] = [shot, ready];
    flags.loaded = true;
    emit(ctx, { t: 'load', ship: me.index, side, load: shot });
  }
}

/** All hands to the pumps, the guns or the rigging: two points every three turns (sail/pl_6.c:47-139). */
function repair(ctx: Ctx, me: Ship, kind: 'hull' | 'guns' | 'rigging', flags: TurnFlags): void {
  if (flags.loaded || flags.fired || flags.sails || flags.turned) {
    emit(ctx, { t: 'note', ship: me.index, note: 'no-hands-repair' });
    return;
  }
  const p = me.specs;
  const key = kind === 'hull' ? 'RH' : kind === 'guns' ? 'RG' : 'RR';
  let count = 2;
  const mend = (
    field: 'hull' | 'gunL' | 'gunR' | 'rig1' | 'rig2' | 'rig3' | 'rig4',
    most: number,
  ) => {
    if (most - p[field] > count) {
      p[field] += count;
      count = 0;
    } else {
      count -= most - p[field];
      p[field] = most;
    }
  };
  me[key]++;
  let done = false;
  if (me[key] >= 3) {
    if (kind === 'hull') {
      const most = Math.trunc(p.guns / 4);
      if (p.hull < most) mend('hull', most);
    } else if (kind === 'guns') {
      if (p.gunL < p.gunR) {
        const most = Math.trunc(p.guns / 5) - p.carL;
        if (p.gunL < most) mend('gunL', most);
      } else {
        const most = Math.trunc(p.guns / 5) - p.carR;
        if (p.gunR < most) mend('gunR', most);
      }
    } else {
      // A jury rig brings a mast back to two at most.
      if (p.rig4 >= 0 && p.rig4 < 2) mend('rig4', 2);
      if (count && p.rig3 < 2) mend('rig3', 2);
      if (count && p.rig2 < 2) mend('rig2', 2);
      if (count && p.rig1 < 2) mend('rig1', 2);
    }
    if (count === 2) {
      me[key] = 2;
      done = true;
    } else me[key] = 0;
  }
  emit(ctx, { t: 'repair', ship: me.index, kind, progress: me[key], done });
}

function applyPlayerOrders(ctx: Ctx, me: Ship, o: Orders): void {
  const { st } = ctx;
  if (me.dir === 0 || me.struck) return;
  const flags: TurnFlags = { loaded: false, fired: false, sails: false, turned: false };
  if (o.signal && o.signal !== st.signal) {
    st.signal = o.signal;
    applySignal(st);
    emit(ctx, { t: 'signal', signal: o.signal });
  }
  if (o.strike) {
    // Figurehead's rule: the captain may lower her flag to save her people.
    const taker = closestShip(st, me, null, false);
    if (taker) {
      strike(ctx, me, taker, true);
      return;
    }
  }
  for (const g of o.grapple ?? []) {
    const sp = st.ships[g.target];
    if (sp) playerGrapple(ctx, me, sp, g.action);
  }
  for (const t of o.unfoul ?? []) {
    const sp = st.ships[t];
    if (sp && fouled2(me, sp)) playerUnfoul(ctx, me, sp);
  }
  if (o.sails) setSails(ctx, me, o.sails, flags);
  if (o.recall) {
    unboard(me, me, true);
    unboard(me, me, false);
    emit(ctx, { t: 'note', ship: me.index, note: 'hands-to-stations' });
  }
  const allowed = new Set(boardable(st, me));
  for (const b of o.board ?? []) {
    if (allowed.has(b.target) && b.sections > 0)
      playerParty(ctx, me, st.ships[b.target]!, b.sections, false);
  }
  if (o.repel && o.repel > 0 && freeSections(me)[2]) playerParty(ctx, me, me, o.repel, true);
  for (const side of ['L', 'R'] as const) {
    const aim = o.fire?.[side];
    if (aim && playerFire(ctx, me, side, aim)) flags.fired = true;
  }
  if (o.unload) {
    me.loadL = me.loadR = EMPTY;
    me.readyL = me.readyR = R_EMPTY;
    emit(ctx, { t: 'note', ship: me.index, note: 'unloaded' });
  }
  if (o.load) loadGuns(ctx, me, o.load, flags);
  if (typeof o.helm === 'string') {
    const helm = checkHelm(st, me, o.helm);
    if (helm.unable) {
      if (o.helm !== '' && o.helm !== 'd')
        emit(ctx, { t: 'note', ship: me.index, note: 'unable-to-move' });
      me.movebuf = '';
    } else {
      if (helm.dropFullSails) me.FS = 0;
      me.movebuf = helm.helm;
      flags.turned = /[lr]/.test(helm.helm);
      emit(ctx, { t: 'helm', ship: me.index, helm: helm.helm, problems: helm.problems });
    }
  } else me.movebuf = '';
  if (o.repair) repair(ctx, me, o.repair, flags);
}

/** Every seventh turn the weather may shift (sail/dr_1.c:400-478). */
function weather(ctx: Ctx): void {
  const { st } = ctx;
  st.turn++;
  if (st.turn % 7 !== 0 || (dieroll(ctx) < st.windchange && st.windspeed)) return;
  const prevDir = st.winddir;
  const prevSpeed = st.windspeed;
  switch (dieroll(ctx)) {
    case 1:
      st.winddir = 1;
      break;
    case 3:
      st.winddir++;
      break;
    case 4:
      st.winddir--;
      break;
    case 5:
      st.winddir += 2;
      break;
    case 6:
      st.winddir -= 2;
      break;
  }
  if (st.winddir > 8) st.winddir -= 8;
  if (st.winddir < 1) st.winddir += 8;
  if (st.windspeed) {
    const roll = dieroll(ctx);
    if (roll <= 2) st.windspeed--;
    else if (roll >= 5) st.windspeed++;
  } else st.windspeed++;
  emit(ctx, { t: 'wind', dir: st.winddir, speed: st.windspeed, prevDir, prevSpeed });
  if (st.windspeed === 7) emit(ctx, { t: 'note', ship: -1, note: 'hurricane' });
}

/** Figurehead's rule: a ship that sails off the chart has left the battle. */
function leaveChart(ctx: Ctx): void {
  const { st } = ctx;
  for (const sp of st.ships) {
    if (sp.dir === 0) continue;
    if (sp.row >= 0 && sp.row < st.rows && sp.col >= 0 && sp.col < st.cols) continue;
    sp.dir = 0;
    sp.escaped = true;
    if (sp.role === 'merchant' && !sp.struck && sp.captured < 0) {
      st.safe.push(sp.index);
      emit(ctx, { t: 'safe', ship: sp.index });
    } else emit(ctx, { t: 'escape', ship: sp.index });
  }
}

/**
 * Figurehead's rule: a computer ship that can no longer fight or run yields to the enemy
 * at hand, her hull still sound. Merchantmen yield to any warship alongside.
 */
function beatenShipsYield(ctx: Ctx): void {
  const { st } = ctx;
  for (const sp of st.ships) {
    if (sp.role === 'human' || !isActive(sp) || sp.captured >= 0) continue;
    const crew = crewOf(sp);
    const threat = st.ships.find(
      (other) =>
        isActive(other) &&
        capship(st, other).nation !== capship(st, sp).nation &&
        other.role !== 'merchant' &&
        range(other, sp) <= (sp.role === 'merchant' ? 2 : 4) &&
        gunsBear(other, sp) !== null,
    );
    if (!threat) continue;
    const beaten =
      sp.role === 'merchant' ||
      crew <= sp.startCrew * 0.25 ||
      ((isDismasted(sp) || !sp.specs.crew3) && crew <= sp.startCrew * 0.6) ||
      (sp.specs.hull <= sp.max.hull * 0.3 && crew <= sp.startCrew * 0.6);
    if (!beaten) continue;
    strike(ctx, sp, threat, true);
    emit(ctx, { t: 'note', ship: sp.index, note: 'yielded', other: threat.index });
  }
}

/** The player's end of turn: guns finish loading, torn sails come in (sail/pl_7.c:116-168). */
function playerTurnEnds(ctx: Ctx, me: Ship): void {
  const { st } = ctx;
  for (const key of ['readyL', 'readyR'] as const) {
    if (me[key] & R_LOADING) me[key] = me[key] & R_DOUBLE ? R_LOADING : R_LOADED;
  }
  if (me.FS && (!me.specs.rig1 || st.windspeed === 6)) {
    me.FS = 0;
    emit(ctx, { t: 'sails', ship: me.index, full: false, forced: true });
  }
  if (me.FS === 1) me.FS = 2;
}

const hostileTo = (st: Battle, me: Ship) => (sp: Ship) =>
  sp !== me && capship(st, sp).nation !== capship(st, me).nation;

export function checkEnd(st: Battle): BattleEnd | null {
  if (st.windspeed === 7) return { reason: 'weather', win: null };
  if (st.player >= 0) {
    const me = st.ships[st.player]!;
    if (me.captured >= 0) return { reason: 'captured', win: false };
    if (me.dir === 0) {
      if (me.escaped) return { reason: 'withdrew', win: null };
      return me.sink ? { reason: 'sunk', win: false } : { reason: 'burnt', win: false };
    }
    if (me.struck) return { reason: 'struck', win: false };
    if (st.retake >= 0) {
      const her = st.ships[st.retake]!;
      if (her.dir !== 0 && capship(st, her).nation === me.nation)
        return { reason: 'victory', win: true };
      if (her.dir === 0) return { reason: 'escaped', win: false };
    } else if (st.harbour) {
      if (distance(me.row - st.harbour.row, me.col - st.harbour.col) <= st.harbour.radius) {
        return { reason: 'harbour', win: true };
      }
    } else {
      const merchants = st.ships.filter((sp) => sp.role === 'merchant' && sp.nation === me.nation);
      // Still fighting under another flag: enemies, and any of ours they have taken.
      const fighting = st.ships.filter((sp) => sp !== me && isActive(sp) && hostileTo(st, me)(sp));
      const enemies = st.ships.filter((sp) => sp.nation !== me.nation);
      if (merchants.length) {
        const afloat = merchants.filter((sp) => isActive(sp) && sp.captured < 0);
        if (!afloat.length && !st.safe.length) return { reason: 'convoy-lost', win: false };
        if (!afloat.length || !fighting.length) return { reason: 'victory', win: true };
      } else if (!fighting.length) {
        const taken = enemies.some((sp) => !sp.escaped);
        return taken ? { reason: 'victory', win: true } : { reason: 'escaped', win: null };
      }
    }
  } else {
    const sides = new Set(st.ships.filter(isActive).map((sp) => capship(st, sp).nation));
    if (sides.size <= 1) return { reason: 'victory', win: sides.has(0) };
  }
  if (st.turn >= st.maxTurns) return { reason: 'nightfall', win: null };
  return null;
}

export interface TurnResult {
  battle: Battle;
  events: BattleEvent[];
}

/** Play one turn. The input battle is not changed. */
export function resolveTurn(battle: Battle, orders: Orders = {}): TurnResult {
  if (battle.over) return { battle, events: [] };
  const st = cloneBattle(battle);
  const rng = restoreRng(st.rng);
  const ctx: Ctx = { st, rng, events: [], phase: 'orders' };
  emit(ctx, { t: 'turn', turn: st.turn + 1 });
  const me = st.player >= 0 ? st.ships[st.player] : undefined;
  if (me) applyPlayerOrders(ctx, me, orders);

  ctx.phase = 'weather';
  weather(ctx);
  computerUnfoul(ctx);
  burnAndSink(ctx);
  prisonersRise(ctx);
  planComputerHelms(st);
  ctx.phase = 'move';
  moveAll(ctx);
  leaveChart(ctx);
  ctx.phase = 'engage';
  computerGrapples(ctx);
  computerBoarding(ctx);
  computerGunnery(ctx);
  ctx.phase = 'melee';
  resolveMelees(ctx);
  for (const sp of st.ships) sp.loadwith = EMPTY;
  computerSails(ctx);

  ctx.phase = 'end';
  if (me) playerTurnEnds(ctx, me);
  beatenShipsYield(ctx);
  for (const sp of st.ships) {
    // A prize taken by the player's side follows her flag instead of fleeing or trading.
    if (me && sp.captured >= 0 && sp.role !== 'human' && capship(st, sp).nation === me.nation) {
      sp.role = 'follow';
    }
  }
  const end = checkEnd(st);
  if (end) {
    st.over = true;
    st.end = end;
    if (end.reason === 'harbour' && me) emit(ctx, { t: 'harbour', ship: me.index });
    emit(ctx, { t: 'end', end });
  }
  st.rng = rng.state();
  return { battle: st, events: ctx.events };
}

/** Hand the player's ship to a computer captain, for simulations. */
export function autopilot(battle: Battle): Battle {
  const st = cloneBattle(battle);
  if (st.player >= 0) st.ships[st.player]!.role = 'attack';
  st.player = -1;
  return st;
}
