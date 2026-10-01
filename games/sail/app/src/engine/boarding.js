// Grappling, fouling, boarding parties and hand-to-hand melee.
//
// Ported from sail/dr_1.c:50-266 (unfoul, boardcomp, fightitout, resolve),
// sail/dr_2.c:57-135 (thinkofgrapples, prizecheck), sail/dr_3.c:266-314
// (sendbp, is_toughmelee), sail/dr_4.c (grap, ungrap), sail/dr_5.c
// (subtract, mensent) and the player's side in sail/pl_3.c:219-279 and
// sail/pl_5.c:155-259.

import { MT } from './data.js';
import { NBP, L_GRAPE } from './constants.js';
import { range } from './geometry.js';
import { dieroll } from './rng.js';
import {
  capship, snagged, fouled2, grappled2, Xsnagged2, addGrap, cleanfoul, cleangrapple,
  meleeing, unboard, emit, makemsg, makesignal, freeSections,
} from './state.js';

// --- grapples ---------------------------------------------------------------------

// Throw grapnels: automatic between friends, 1-in-3 otherwise (sail/dr_4.c:61-69).
export function grap(ctx, from, to) {
  const { st } = ctx;
  if (capship(st, from).nationality !== capship(st, to).nationality && dieroll(st.rng) > 2) {
    emit(ctx, 'grapple', { a: from.index, b: to.index, ok: false });
    return false;
  }
  addGrap(st, from, to);
  addGrap(st, to, from);
  makesignal(ctx, from, 'grappled with $$', to);
  emit(ctx, 'grapple', { a: from.index, b: to.index, ok: true });
  return true;
}

// Cut grapnels, one line at a time (sail/dr_4.c:44-59).
export function ungrap(ctx, from, to) {
  const { st } = ctx;
  let k = grappled2(from, to);
  if (!k) return;
  const friend = capship(st, from).nationality === capship(st, to).nationality;
  while (--k >= 0) {
    if (friend || dieroll(st.rng) < 3) {
      cleangrapple(st, from, to, 0);
      makesignal(ctx, from, 'ungrappling $$', to);
      emit(ctx, 'ungrapple', { a: from.index, b: to.index });
    }
  }
}

// Computer captains decide whom to grapple (sail/dr_2.c:57-86).
const couldwin = (f, t) => f.specs.crew2 > t.specs.crew2 * 1.5;
export function thinkofgrapples(ctx) {
  const { st } = ctx;
  for (const sp of st.ships) {
    if (sp.captain || sp.dir === 0) continue;
    for (const sq of st.ships) {
      const friendly = sp.nationality === capship(st, sq).nationality;
      if (!friendly) {
        if (sp.struck || sp.captured >= 0) continue;
        if (range(sp, sq) !== 1) continue;
        if (grappled2(sp, sq)) {
          if (isToughmelee(sp, sq, 0, 0)) ungrap(ctx, sp, sq);
          else grap(ctx, sp, sq);
        } else if (couldwin(sp, sq)) {
          grap(ctx, sp, sq);
          sp.loadwith = L_GRAPE;
        }
      } else ungrap(ctx, sp, sq);
    }
  }
}

// Computer captains try to clear fouls (sail/dr_1.c:50-71).
export function unfoul(ctx) {
  const { st } = ctx;
  for (const sp of st.ships) {
    if (sp.captain) continue;
    const nat = capship(st, sp).nationality;
    for (const to of st.ships) {
      if (nat !== capship(st, to).nationality && !isToughmelee(sp, to, 0, 0)) continue;
      for (let i = fouled2(sp, to); --i >= 0;) {
        if (dieroll(st.rng) <= 2) {
          cleanfoul(st, sp, to, 0);
          emit(ctx, 'unfoul', { a: sp.index, b: to.index });
        }
      }
    }
  }
}

// --- boarding parties --------------------------------------------------------------

// Put a party in the first free slot (sail/dr_3.c:266-283).
export function sendbp(ctx, from, to, sections, isdefense) {
  const bp = isdefense ? from.DBP : from.OBP;
  let n = 0;
  while (n < NBP && bp[n].turnsent) n++;
  if (n < NBP && sections) {
    bp[n] = { turnsent: Math.max(1, ctx.st.turn), toship: to.index, mensent: sections };
    if (isdefense) makemsg(ctx, from, 'repelling boarders');
    else makesignal(ctx, from, 'boarding the $$', to);
    emit(ctx, isdefense ? 'repel' : 'board', { ship: from.index, to: to.index, sections });
    return true;
  }
  return false;
}

// Would a melee with `to` go badly for `ship`? (sail/dr_3.c:285-314)
export function isToughmelee(ship, to, isdefense, count) {
  const qual = ship.specs.qual;
  const bps = isdefense ? ship.DBP : ship.OBP;
  let obp = 0;
  for (const bp of bps) {
    if (bp.turnsent && (to.index === bp.toship || isdefense)) {
      obp += Math.trunc(bp.mensent / 100) ? ship.specs.crew1 * qual : 0;
      obp += Math.trunc((bp.mensent % 100) / 10) ? ship.specs.crew2 * qual : 0;
      obp += bp.mensent % 10 ? ship.specs.crew3 * qual : 0;
    }
  }
  if (count || isdefense) return obp;
  const OBP = isToughmelee(to, ship, 0, count + 1);
  const dbp = isToughmelee(ship, to, 1, count + 1);
  const DBP = isToughmelee(to, ship, 1, count + 1);
  return OBP > obp + 10 || OBP + DBP >= obp + dbp + 10;
}

// Computer captains send boarders across (sail/dr_1.c:73-136). The size of
// the party depends on the class difference (small ships go all in).
export function boardcomp(ctx) {
  const { st } = ctx;
  for (const sp of st.ships) {
    if (sp.captain || sp.dir === 0) continue;
    if (sp.struck || sp.captured >= 0) continue;
    if (!snagged(sp)) continue;
    const crew = [sp.specs.crew1 !== 0 ? 1 : 0, sp.specs.crew2 !== 0 ? 1 : 0, sp.specs.crew3 !== 0 ? 1 : 0];
    for (const sq of st.ships) {
      if (!Xsnagged2(st, sp, sq)) continue;
      if (meleeing(sp, sq)) continue;
      if (!sq.dir || sp.nationality === capship(st, sq).nationality) continue;
      switch (sp.specs.class - sq.specs.class) {
        case -3: case -4: case -5:
          if (crew[0]) {
            sendbp(ctx, sp, sq, crew[0] * 100, 0);
            crew[0] = 0;
          } else if (crew[1]) {
            sendbp(ctx, sp, sq, crew[1] * 10, 0);
            crew[1] = 0;
          }
          break;
        case -2:
          if (crew[0] || crew[1]) {
            sendbp(ctx, sp, sq, crew[0] * 100 + crew[1] * 10, 0);
            crew[0] = crew[1] = 0;
          }
          break;
        case -1: case 0: case 1:
          if (crew[0]) {
            sendbp(ctx, sp, sq, crew[0] * 100 + crew[1] * 10, 0);
            crew[0] = crew[1] = 0;
          }
          break;
        case 2: case 3: case 4: case 5:
          sendbp(ctx, sp, sq, crew[0] * 100 + crew[1] * 10 + crew[2], 0);
          crew[0] = crew[1] = crew[2] = 0;
          break;
        default: break;
      }
    }
  }
}

// Men committed by `from` against `to` (sail/dr_5.c:67-93).
// FIXES (ADR 004): (a) defensive parties are stored with toship = the
// defender itself, so the original never found them and the man page's
// "DBPs fight twice as hard" never happened — defensive parties now match
// regardless of toship; (b) section 3 was counted whenever ANY party was out
// (a dead store overwrote the `men % 10` test) — it now counts only if sent.
export function mensent(from, to, isdefense) {
  const pc = from.pcrew;
  const crew = [from.specs.crew1, from.specs.crew2, from.specs.crew3];
  let men = 0;
  for (const bp of isdefense ? from.DBP : from.OBP) {
    if (bp.turnsent && (isdefense || bp.toship === to.index)) men += bp.mensent;
  }
  let total = 0;
  if (men) {
    const c1 = Math.trunc(men / 100) ? crew[0] : 0;
    const c2 = Math.trunc((men % 100) / 10) ? crew[1] : 0;
    const c3 = men % 10 ? (from.captured < 0 ? crew[2] : pc) : 0;
    total = c1 + c2 + c3;
  }
  return { men: total, crew, captured: from.captured, pc };
}

// Remove casualties section by section (sail/dr_5.c:44-65).
function subtract(from, fromcap, totalfrom, crewfrom, pcfrom) {
  if (fromcap === from && totalfrom) {
    for (let n = 0; n < 3; n++) {
      if (totalfrom > crewfrom[n]) {
        totalfrom -= crewfrom[n];
        crewfrom[n] = 0;
      } else {
        crewfrom[n] -= totalfrom;
        totalfrom = 0;
      }
    }
    [from.specs.crew1, from.specs.crew2, from.specs.crew3] = crewfrom;
  } else if (totalfrom) {
    let pc = pcfrom - totalfrom;
    pc = pc < 0 ? 0 : pc;
    from.pcrew = pc;
  }
}

// Hand-to-hand fighting (sail/dr_1.c:138-235). `key` = `from` is defending
// its own deck against `to`'s boarders. Returns 1 if the boarders were
// thrown back, 0 otherwise (including capture).
export function fightitout(ctx, from, to, key) {
  const { st } = ctx;
  const f = mensent(from, to, key);
  const t = mensent(to, from, 0);
  let menfrom = f.men;
  let mento = t.men;
  const crewfrom = f.crew;
  const crewto = t.crew;
  const fromcap = f.captured >= 0 ? st.ships[f.captured] : from;
  const tocap = t.captured >= 0 ? st.ships[t.captured] : to;
  if (key) {
    if (!menfrom) {
      // crew surprised: everyone aboard fights, unorganised
      menfrom = fromcap === from ? from.specs.crew1 + from.specs.crew2 + from.specs.crew3 : from.pcrew;
    } else {
      menfrom *= 2; // DBPs fight at an advantage
    }
  }
  let fromstrength = menfrom * fromcap.specs.qual;
  let strengthto = mento * tocap.specs.qual;
  let totalfrom = 0;
  let totalto = 0;
  let count;
  const rounds = [];
  for (count = 0;
    ((fromstrength < strengthto * 3 && strengthto < fromstrength * 3) || fromstrength === -1) && count < 4;
    count++) {
    let index = Math.min(8, Math.trunc(fromstrength / 10));
    const toinjured = MT[Math.max(0, index)][2 - Math.trunc(dieroll(st.rng) / 3)];
    totalto += toinjured;
    index = Math.min(8, Math.trunc(strengthto / 10));
    const frominjured = MT[Math.max(0, index)][2 - Math.trunc(dieroll(st.rng) / 3)];
    totalfrom += frominjured;
    menfrom -= frominjured;
    mento -= toinjured;
    fromstrength = menfrom * fromcap.specs.qual;
    strengthto = mento * tocap.specs.qual;
    rounds.push({ fromLost: frominjured, toLost: toinjured });
  }
  const ev = { a: from.index, b: to.index, key: !!key, rounds, killedA: totalfrom, killedB: totalto };
  if (fromstrength >= strengthto * 3 || count === 4) {
    unboard(to, from, 0);
    subtract(from, fromcap, totalfrom, crewfrom, f.pc);
    subtract(to, tocap, totalto, crewto, t.pc);
    makemsg(ctx, from, `boarders from ${to.name} repelled`);
    makemsg(ctx, to, `killed in melee: ${totalto}.  ${from.name}: ${totalfrom}`);
    emit(ctx, 'melee', { ...ev, outcome: 'repelled' });
    if (key) return 1;
  } else if (strengthto >= fromstrength * 3) {
    unboard(from, to, 0);
    subtract(from, fromcap, totalfrom, crewfrom, f.pc);
    subtract(to, tocap, totalto, crewto, t.pc);
    if (key) {
      if (fromcap !== from) {
        // FIX (ADR 004): C wrote `points - struck ? pts : 2*pts`, which parses
        // as `(points - struck) ? ...`; the evident intent is subtraction.
        fromcap.points -= from.struck ? from.specs.pts : 2 * from.specs.pts;
      }
      from.captured = to.index;
      let topoints = 2 * from.specs.pts + to.points;
      if (from.struck) topoints -= from.specs.pts;
      to.points = topoints;
      const prize = crewto[0] ? crewto[0] : crewto[1];
      if (prize) {
        subtract(to, tocap, prize, crewto, t.pc);
        from.pcrew = prize; // subtract(from, to, -prize, crewfrom, 0)
      }
      makemsg(ctx, from, `captured by the ${to.name}!`);
      makemsg(ctx, to, `killed in melee: ${totalto}.  ${from.name}: ${totalfrom}`);
      emit(ctx, 'melee', { ...ev, outcome: 'captured' });
      emit(ctx, 'capture', { ship: from.index, by: to.index, prize });
      return 0;
    }
    emit(ctx, 'melee', { ...ev, outcome: 'beaten' });
  } else {
    emit(ctx, 'melee', { ...ev, outcome: 'undecided' });
  }
  return 0;
}

// Resolve every melee on the board (sail/dr_1.c:237-266).
export function resolve(ctx) {
  const { st } = ctx;
  const ships = st.ships;
  for (let i = 0; i < ships.length; i++) {
    const sp = ships[i];
    if (sp.dir === 0) continue;
    for (let j = i + 1; j < ships.length; j++) {
      const sq = ships[j];
      if (sq.dir && meleeing(sp, sq) && meleeing(sq, sp)) fightitout(ctx, sp, sq, 0);
    }
    let thwart = 2;
    for (const sq of ships) {
      if (sq.dir && meleeing(sq, sp)) thwart = fightitout(ctx, sp, sq, 1);
      if (!thwart) break;
    }
    if (!thwart) {
      for (const sq of ships) {
        if (sq.dir && meleeing(sq, sp)) unboard(sq, sp, 0);
        unboard(sp, sq, 0);
      }
      unboard(sp, sp, 1);
    } else if (thwart === 2) unboard(sp, sp, 1);
  }
}

// A prize whose prisoners outnumber the prize crew six to one rises up
// (sail/dr_2.c:119-135).
export function prizecheck(ctx) {
  const { st } = ctx;
  for (const sp of st.ships) {
    if (sp.captured < 0) continue;
    if (sp.struck || sp.dir === 0) continue;
    if (sp.specs.crew1 + sp.specs.crew2 + sp.specs.crew3 > sp.pcrew * 6) {
      const cap = st.ships[sp.captured];
      makemsg(ctx, sp, 'prize crew overthrown');
      cap.points -= 2 * sp.specs.pts;
      emit(ctx, 'overthrown', { ship: sp.index, from: cap.index });
      sp.captured = -1;
    }
  }
}

// --- the human's side ----------------------------------------------------------------

// 'g' — grapple or ungrapple (sail/pl_3.c:219-257).
export function playerGrapple(ctx, ms, sp, action) {
  const { st } = ctx;
  if (sp === ms || sp.dir === 0) return false;
  if (range(ms, sp) > 1 && !grappled2(ms, sp)) {
    makemsg(ctx, ms, `${sp.name} is too far to grapple`);
    return false;
  }
  if (action === 'g') {
    if (dieroll(st.rng) < 3 || ms.nationality === capship(st, sp).nationality) {
      addGrap(st, ms, sp);
      addGrap(st, sp, ms);
      makesignal(ctx, ms, 'grappled with $$', sp);
      emit(ctx, 'grapple', { a: ms.index, b: sp.index, ok: true });
      return true;
    }
    makemsg(ctx, ms, `attempt to grapple ${sp.name} fails`);
    emit(ctx, 'grapple', { a: ms.index, b: sp.index, ok: false });
    return false;
  }
  let ok = false;
  for (let i = grappled2(ms, sp); --i >= 0;) {
    if (ms.nationality === capship(st, sp).nationality || dieroll(st.rng) < 3) {
      cleangrapple(st, ms, sp, 0);
      makesignal(ctx, ms, 'ungrappling with $$', sp);
      emit(ctx, 'ungrapple', { a: ms.index, b: sp.index });
      ok = true;
    } else makemsg(ctx, ms, `attempt to ungrapple ${sp.name} fails`);
  }
  return ok;
}

// 'u' — try to cut loose from a foul (sail/pl_3.c:259-279).
export function playerUnfoul(ctx, ms, to) {
  const { st } = ctx;
  let ok = false;
  for (let i = fouled2(ms, to); --i >= 0;) {
    if (dieroll(st.rng) <= 2) {
      cleanfoul(st, ms, to, 0);
      makesignal(ctx, ms, 'Unfouling $$', to);
      emit(ctx, 'unfoul', { a: ms.index, b: to.index });
      ok = true;
    } else makemsg(ctx, ms, `attempt to unfoul ${to.name} fails`);
  }
  return ok;
}

// Ships the human may send boarders to right now (sail/pl_5.c:184-197).
export function boardableTargets(st, ms) {
  const crew = freeSections(ms);
  if (!crew[2]) return [];
  return st.ships.filter((sp) => sp !== ms && sp.dir !== 0 && range(ms, sp) <= 1
    && ms.nationality !== capship(st, sp).nationality
    && (meleeing(ms, sp) || fouled2(ms, sp) || grappled2(ms, sp)))
    .map((sp) => sp.index);
}

// 'b' — form a party of `count` sections (sail/pl_5.c:208-259). The party
// takes free sections in order 1, 2, 3.
export function playerParties(ctx, ms, to, count, isdefense) {
  const crew = freeSections(ms);
  const bps = isdefense ? ms.DBP : ms.OBP;
  const slot = bps.findIndex((p) => !p.turnsent);
  if (slot < 0 || count <= 0) {
    makemsg(ctx, ms, 'sending no crew sections');
    return 0;
  }
  let men = 0;
  let left = count;
  for (let k = 0; k < 3 && left > 0; k++) {
    men += crew[k] * (k === 0 ? 100 : k === 1 ? 10 : 1);
    if (men) left--;
  }
  if (!men) return 0;
  bps[slot] = { turnsent: Math.max(1, ctx.st.turn), toship: to.index, mensent: men };
  if (isdefense) makemsg(ctx, ms, 'repelling boarders');
  else makesignal(ctx, ms, 'boarding the $$', to);
  emit(ctx, isdefense ? 'repel' : 'board', { ship: ms.index, to: to.index, sections: men });
  return men;
}
