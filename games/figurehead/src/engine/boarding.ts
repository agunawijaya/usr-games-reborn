import { range } from './geometry';
import {
  addGrapple,
  capship,
  cleanSnag,
  type Ctx,
  dieroll,
  emit,
  fouled2,
  freeSections,
  friends,
  grappled2,
  meleeing,
  oldSnags,
  snagged,
  unboard,
} from './state';
import { MELEE } from './tables';
import { type Battle, GRAPE, PARTY_SLOTS, type Ship } from './types';

/**
 * Grapples, fouls, boarding parties and the fight on deck. Ported from sail/dr_1.c:50-266
 * (unfoul, boardcomp, fightitout, resolve), sail/dr_2.c:57-135 (thinkofgrapples, prizecheck),
 * sail/dr_3.c:266-314 (sendbp, is_toughmelee), sail/dr_4.c (grap, ungrap), sail/dr_5.c
 * (subtract, mensent), and the player's side in sail/pl_3.c:219-279 and sail/pl_5.c:155-259,
 * with Broadside's documented fixes to the defenders' count.
 */

// --- grapples ------------------------------------------------------------------------------

/** Grapnels hold at once between friends, one time in three against an enemy. */
export function throwGrapnels(
  ctx: Ctx,
  from: Ship,
  to: Ship,
  chance: 'computer' | 'player',
): boolean {
  const roll = dieroll(ctx);
  const holds = friends(ctx.st, from, to) || (chance === 'computer' ? roll <= 2 : roll < 3);
  if (holds) {
    addGrapple(ctx.st, from, to);
    addGrapple(ctx.st, to, from);
  }
  emit(ctx, { t: 'grapple', a: from.index, b: to.index, ok: holds });
  return holds;
}

/** Cut the grapnels one line at a time; each holds against an enemy two times in three. */
export function castOff(ctx: Ctx, from: Ship, to: Ship): boolean {
  let lines = grappled2(from, to);
  let any = false;
  const friendly = friends(ctx.st, from, to);
  while (--lines >= 0) {
    if (friendly || dieroll(ctx) < 3) {
      cleanSnag(from, to, false, 1);
      emit(ctx, { t: 'cast-off', a: from.index, b: to.index });
      any = true;
    }
  }
  return any;
}

const couldWin = (f: Ship, t: Ship): boolean => f.specs.crew2 > t.specs.crew2 * 1.5;

/** Computer captains decide whom to grapple, and when to let go (sail/dr_2.c:57-86). */
export function computerGrapples(ctx: Ctx): void {
  const { st } = ctx;
  for (const sp of st.ships) {
    if (sp.role === 'human' || sp.dir === 0) continue;
    const peaceful = sp.role === 'merchant' || sp.role === 'flee';
    for (const sq of st.ships) {
      if (sp === sq) continue;
      if (sp.nation !== capship(st, sq).nation) {
        if (sp.struck || sp.captured >= 0 || range(sp, sq) !== 1) continue;
        if (grappled2(sp, sq)) {
          if (peaceful || isTough(sp, sq)) castOff(ctx, sp, sq);
          else throwGrapnels(ctx, sp, sq, 'computer');
        } else if (!peaceful && couldWin(sp, sq)) {
          throwGrapnels(ctx, sp, sq, 'computer');
          sp.loadwith = GRAPE;
        }
      } else if (grappled2(sp, sq)) castOff(ctx, sp, sq);
    }
  }
}

/** Computer captains try to clear fouls from enemies they cannot beat (sail/dr_1.c:50-71). */
export function computerUnfoul(ctx: Ctx): void {
  const { st } = ctx;
  for (const sp of st.ships) {
    if (sp.role === 'human') continue;
    const ours = capship(st, sp).nation;
    for (const to of st.ships) {
      if (ours !== capship(st, to).nation && !isTough(sp, to)) continue;
      for (let i = fouled2(sp, to); --i >= 0;) {
        if (dieroll(ctx) <= 2) {
          cleanSnag(sp, to, false, 2);
          emit(ctx, { t: 'unfoul', a: sp.index, b: to.index });
        }
      }
    }
  }
}

// --- boarding parties ----------------------------------------------------------------------

function sendParty(ctx: Ctx, from: Ship, to: Ship, sections: number, defence: boolean): boolean {
  const parties = defence ? from.DBP : from.OBP;
  const slot = parties.findIndex((p) => !p.turnsent);
  if (slot < 0 || !sections) return false;
  parties[slot] = { turnsent: Math.max(1, ctx.st.turn), toship: to.index, mensent: sections };
  if (defence) emit(ctx, { t: 'repel', ship: from.index, sections });
  else emit(ctx, { t: 'board', ship: from.index, to: to.index, sections });
  return true;
}

/** Strength a ship has committed against `to` (or in defence), counted as hands × quality. */
function committed(ship: Ship, to: Ship, defence: boolean): number {
  const q = ship.specs.qual;
  let total = 0;
  for (const p of defence ? ship.DBP : ship.OBP) {
    if (!p.turnsent || (!defence && p.toship !== to.index)) continue;
    if (Math.trunc(p.mensent / 100)) total += ship.specs.crew1 * q;
    if (Math.trunc((p.mensent % 100) / 10)) total += ship.specs.crew2 * q;
    if (p.mensent % 10) total += ship.specs.crew3 * q;
  }
  return total;
}

/** Would a melee with `to` go badly for `ship`? (sail/dr_3.c:285-314) */
export function isTough(ship: Ship, to: Ship): boolean {
  const ours = committed(ship, to, false);
  const theirs = committed(to, ship, false);
  const ourDefence = committed(ship, to, true);
  const theirDefence = committed(to, ship, true);
  return theirs > ours + 10 || theirs + theirDefence >= ours + ourDefence + 10;
}

/** Computer captains send boarders, more of them the smaller their ship (sail/dr_1.c:73-136). */
export function computerBoarding(ctx: Ctx): void {
  const { st } = ctx;
  for (const sp of st.ships) {
    if (sp.role === 'human' || sp.dir === 0 || sp.struck || sp.captured >= 0) continue;
    if (sp.role === 'merchant' || sp.role === 'flee' || !snagged(sp)) continue;
    const crew = [sp.specs.crew1 ? 1 : 0, sp.specs.crew2 ? 1 : 0, sp.specs.crew3 ? 1 : 0];
    for (const sq of st.ships) {
      if (!oldSnags(st, sp, sq) || meleeing(sp, sq)) continue;
      if (!sq.dir || sp.nation === capship(st, sq).nation) continue;
      const gap = sp.specs.cls - sq.specs.cls;
      if (gap <= -3 && gap >= -5) {
        if (crew[0]) {
          sendParty(ctx, sp, sq, crew[0] * 100, false);
          crew[0] = 0;
        } else if (crew[1]) {
          sendParty(ctx, sp, sq, crew[1] * 10, false);
          crew[1] = 0;
        }
      } else if (gap === -2) {
        if (crew[0] || crew[1]) {
          sendParty(ctx, sp, sq, crew[0]! * 100 + crew[1]! * 10, false);
          crew[0] = crew[1] = 0;
        }
      } else if (gap >= -1 && gap <= 1) {
        if (crew[0]) {
          sendParty(ctx, sp, sq, crew[0] * 100 + crew[1]! * 10, false);
          crew[0] = crew[1] = 0;
        }
      } else if (gap >= 2 && gap <= 5) {
        sendParty(ctx, sp, sq, crew[0]! * 100 + crew[1]! * 10 + crew[2]!, false);
        crew[0] = crew[1] = crew[2] = 0;
      }
    }
  }
}

/** Hands `from` has sent against `to`, or keeps back in defence (sail/dr_5.c:67-93). */
function handsSent(from: Ship, to: Ship, defence: boolean): number {
  let men = 0;
  for (const p of defence ? from.DBP : from.OBP) {
    if (p.turnsent && (defence || p.toship === to.index)) men += p.mensent;
  }
  if (!men) return 0;
  const c1 = Math.trunc(men / 100) ? from.specs.crew1 : 0;
  const c2 = Math.trunc((men % 100) / 10) ? from.specs.crew2 : 0;
  const c3 = men % 10 ? (from.captured < 0 ? from.specs.crew3 : from.pcrew) : 0;
  return c1 + c2 + c3;
}

/** Remove a melee's losses: from the sections, or from the prize crew of a taken ship. */
function takeLosses(sp: Ship, holder: Ship, lost: number): void {
  if (!lost) return;
  if (holder === sp) {
    const crew = [sp.specs.crew1, sp.specs.crew2, sp.specs.crew3];
    for (let n = 0; n < 3; n++) {
      const take = Math.min(lost, crew[n]!);
      crew[n] = crew[n]! - take;
      lost -= take;
    }
    [sp.specs.crew1, sp.specs.crew2, sp.specs.crew3] = [crew[0]!, crew[1]!, crew[2]!];
  } else {
    sp.pcrew = Math.max(0, sp.pcrew - lost);
  }
}

/**
 * Up to four rounds of fighting on `from`'s deck against `to`'s boarders (sail/dr_1.c:138-235).
 * With `defending`, `from` holds her own deck: kept-back defenders fight twice as hard, and a
 * surprised crew fights all together. Returns true when the boarders were thrown back.
 */
export function fightItOut(ctx: Ctx, from: Ship, to: Ship, defending: boolean): boolean {
  const { st } = ctx;
  const fromHolder = capship(st, from);
  const toHolder = capship(st, to);
  let menFrom = handsSent(from, to, defending);
  let menTo = handsSent(to, from, false);
  if (defending) {
    if (!menFrom) {
      menFrom =
        fromHolder === from ? from.specs.crew1 + from.specs.crew2 + from.specs.crew3 : from.pcrew;
    } else menFrom *= 2;
  }
  let fromStrength = menFrom * fromHolder.specs.qual;
  let toStrength = menTo * toHolder.specs.qual;
  let lostFrom = 0;
  let lostTo = 0;
  const rounds: { lostA: number; lostB: number }[] = [];
  let count = 0;
  for (; count < 4 && fromStrength < toStrength * 3 && toStrength < fromStrength * 3; count++) {
    const toHurt =
      MELEE[Math.max(0, Math.min(8, Math.trunc(fromStrength / 10)))]![
        2 - Math.trunc(dieroll(ctx) / 3)
      ]!;
    const fromHurt =
      MELEE[Math.max(0, Math.min(8, Math.trunc(toStrength / 10)))]![
        2 - Math.trunc(dieroll(ctx) / 3)
      ]!;
    lostTo += toHurt;
    lostFrom += fromHurt;
    menFrom -= fromHurt;
    menTo -= toHurt;
    fromStrength = menFrom * fromHolder.specs.qual;
    toStrength = menTo * toHolder.specs.qual;
    rounds.push({ lostA: fromHurt, lostB: toHurt });
  }
  const base = { a: from.index, b: to.index, defending, rounds, lostA: lostFrom, lostB: lostTo };
  if (fromStrength >= toStrength * 3 || count === 4) {
    unboard(to, from, false);
    takeLosses(from, fromHolder, lostFrom);
    takeLosses(to, toHolder, lostTo);
    emit(ctx, { t: 'melee', ...base, outcome: 'repelled' });
    return defending;
  }
  if (toStrength >= fromStrength * 3) {
    unboard(from, to, false);
    takeLosses(from, fromHolder, lostFrom);
    takeLosses(to, toHolder, lostTo);
    if (defending) {
      if (fromHolder !== from)
        fromHolder.points -= from.struck ? from.specs.pts : 2 * from.specs.pts;
      from.captured = to.index;
      to.points += from.struck ? from.specs.pts : 2 * from.specs.pts;
      // The boarders' first section stays aboard as her prize crew.
      const prize = to.specs.crew1 || to.specs.crew2;
      if (prize) {
        takeLosses(to, toHolder, prize);
        from.pcrew = prize;
      }
      emit(ctx, { t: 'melee', ...base, outcome: 'captured' });
      emit(ctx, { t: 'capture', ship: from.index, by: to.index, prizeCrew: prize });
      return false;
    }
    emit(ctx, { t: 'melee', ...base, outcome: 'beaten' });
    return false;
  }
  emit(ctx, { t: 'melee', ...base, outcome: 'undecided' });
  return false;
}

/** Every fight on deck this turn (sail/dr_1.c:237-266). */
export function resolveMelees(ctx: Ctx): void {
  const ships = ctx.st.ships;
  for (let i = 0; i < ships.length; i++) {
    const sp = ships[i]!;
    if (sp.dir === 0) continue;
    for (let j = i + 1; j < ships.length; j++) {
      const sq = ships[j]!;
      if (sq.dir && meleeing(sp, sq) && meleeing(sq, sp)) fightItOut(ctx, sp, sq, false);
    }
    let held: 'none' | 'held' | 'lost' = 'none';
    for (const sq of ships) {
      if (sq.dir && meleeing(sq, sp)) held = fightItOut(ctx, sp, sq, true) ? 'held' : 'lost';
      if (held === 'lost') break;
    }
    if (held === 'lost') {
      for (const sq of ships) {
        if (sq.dir && meleeing(sq, sp)) unboard(sq, sp, false);
        unboard(sp, sq, false);
      }
      unboard(sp, sp, true);
    } else if (held === 'none') unboard(sp, sp, true);
  }
}

/** A prize whose prisoners outnumber her prize crew six to one rises and is free again. */
export function prisonersRise(ctx: Ctx): void {
  const { st } = ctx;
  for (const sp of st.ships) {
    if (sp.captured < 0 || sp.struck || sp.dir === 0) continue;
    if (sp.specs.crew1 + sp.specs.crew2 + sp.specs.crew3 > sp.pcrew * 6) {
      const holder = st.ships[sp.captured]!;
      holder.points -= 2 * sp.specs.pts;
      emit(ctx, { t: 'overthrown', ship: sp.index, from: holder.index });
      sp.captured = -1;
    }
  }
}

// --- the player's side -------------------------------------------------------------------

/** Ships the player may board now: alongside, an enemy, grappled, fouled or already fighting. */
export function boardable(st: Battle, me: Ship): number[] {
  if (!freeSections(me)[2]) return [];
  return st.ships
    .filter(
      (sp) =>
        sp !== me &&
        sp.dir !== 0 &&
        range(me, sp) <= 1 &&
        me.nation !== capship(st, sp).nation &&
        (meleeing(me, sp) || fouled2(me, sp) > 0 || grappled2(me, sp) > 0),
    )
    .map((sp) => sp.index);
}

/** Ships close enough to throw grapnels at, or already grappled. */
export function grapplable(st: Battle, me: Ship): number[] {
  return st.ships
    .filter((sp) => sp !== me && sp.dir !== 0 && (range(me, sp) <= 1 || grappled2(me, sp) > 0))
    .map((sp) => sp.index);
}

export function playerGrapple(ctx: Ctx, me: Ship, sp: Ship, action: 'grapple' | 'cast-off'): void {
  if (sp === me || sp.dir === 0) return;
  if (range(me, sp) > 1 && !grappled2(me, sp)) {
    emit(ctx, { t: 'note', ship: me.index, note: 'too-far-to-grapple', other: sp.index });
    return;
  }
  if (action === 'grapple') {
    if (!throwGrapnels(ctx, me, sp, 'player')) {
      emit(ctx, { t: 'note', ship: me.index, note: 'grapple-failed', other: sp.index });
    }
    return;
  }
  if (!castOff(ctx, me, sp))
    emit(ctx, { t: 'note', ship: me.index, note: 'cast-off-failed', other: sp.index });
}

export function playerUnfoul(ctx: Ctx, me: Ship, to: Ship): void {
  let freed = false;
  for (let i = fouled2(me, to); --i >= 0;) {
    if (dieroll(ctx) <= 2) {
      cleanSnag(me, to, false, 2);
      emit(ctx, { t: 'unfoul', a: me.index, b: to.index });
      freed = true;
    }
  }
  if (!freed) emit(ctx, { t: 'note', ship: me.index, note: 'unfoul-failed', other: to.index });
}

/** Form a party of `count` free sections, taken in order 1, 2, 3 (sail/pl_5.c:208-259). */
export function playerParty(ctx: Ctx, me: Ship, to: Ship, count: number, defence: boolean): number {
  const crew = freeSections(me);
  const parties = defence ? me.DBP : me.OBP;
  if (count <= 0 || !parties.some((p) => !p.turnsent)) return 0;
  let men = 0;
  let left = count;
  for (let k = 0; k < PARTY_SLOTS && left > 0; k++) {
    men += crew[k]! * [100, 10, 1][k]!;
    if (men) left--;
  }
  if (!men) return 0;
  sendParty(ctx, me, to, men, defence);
  return men;
}
