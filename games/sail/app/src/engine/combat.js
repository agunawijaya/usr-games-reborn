// Gunnery and damage.
//
// Ported from sail/pl_3.c:46-217 (acceptcombat — the player's broadside),
// sail/dr_1.c:268-398 (compcombat — the computer's), sail/assorted.c:47-287
// (table, strike) and sail/dr_2.c:88-117 (checkup: sinking & explosions).

import { HDT, HDTrake, QUAL, AMMO, RigTable, HullTable } from './data.js';
import {
  L_EMPTY, L_GRAPE, L_CHAIN, L_ROUND, L_DOUBLE, L_EXPLODE, R_EMPTY, R_LOADED, R_INITIAL,
  HULL, RIGGING, RANGE_OF_SHOT, LOAD_WORD,
} from './constants.js';
import { range, gunsbear, portside } from './geometry.js';
import { dieroll } from './rng.js';
import {
  capship, snagged, cleansnag, unboard, emit, makemsg, makesignal, freeSections, shipLabel,
} from './state.js';

// The closest ship bearing on `side` ('l'/'r'/0). anyship = include friends.
// sail/misc.c:83-108
export function closestenemy(st, from, side, anyship) {
  const nat = capship(st, from).nationality;
  let best = null;
  let olddist = 30000;
  for (const sp of st.ships) {
    if (sp === from || sp.dir === 0) continue;
    if (nat === capship(st, sp).nationality && !anyship) continue;
    if (side && gunsbear(from, sp) !== side) continue;
    const d = range(from, sp);
    if (d < olddist) {
      best = sp;
      olddist = d;
    }
  }
  return best;
}

// Heavy seas: penalties to hit, by ship class (sail/dr_1.c:384-390,
// sail/pl_3.c:171-176). This is how the original models "lower gun ports of
// ships of the line can't be opened" (sail.6:584-590).
export function highSeasPenalty(cls, windspeed) {
  let p = 0;
  if ((cls >= 5 || cls === 1) && windspeed === 5) p--;
  if (windspeed === 6 && cls === 4) p -= 2;
  if (windspeed === 6 && cls <= 3) p--;
  return p;
}
// Visual/UI flag derived from the rule above: two- and three-deckers
// (class 1-2) whose firing is penalised by the sea have their lower ports shut.
export const lowerPortsClosed = (cls, windspeed) => cls <= 2 && highSeasPenalty(cls, windspeed) < 0;

// Rake geometry: we bear on them but they cannot bear on us; a stern rake is
// fired from dead astern of the target. sail/pl_3.c:125-131
export function rakeInfo(st, from, to) {
  const rakehim = !!gunsbear(from, to) && !gunsbear(to, from);
  let temp = portside(to, from, 1) - to.dir + 1;
  if (temp < 1) temp += 8;
  else if (temp > 8) temp -= 8;
  const sternrake = temp > 4 && temp < 6;
  return { rakehim, sternrake: rakehim && sternrake, bowrake: rakehim && !sternrake };
}

// The to-hit number for one broadside. Shared by player and computer.
// Returns { hit, index, parts } where parts explains every modifier (for the
// UI's fire preview and for tests).
export function computeHit(st, sp, target, { guns, car, load, ready, crew, rng = null }) {
  const tr = range(sp, target);
  const { rakehim, sternrake } = rakeInfo(st, sp, target);
  let index = guns;
  if (tr < 3) index += car;
  index = Math.trunc((index - 1) / 3);
  index = index > 8 ? 8 : index;
  const parts = [];
  // A broadside of zero guns indexes row -1 in C (undefined behaviour); clamp.
  const row = index < 0 ? 0 : index;
  // Range 0 (overlapping hulls) would index column -1 in C; clamp to 1.
  let hit = (rakehim ? HDTrake : HDT)[row][Math.max(1, Math.min(10, tr)) - 1];
  parts.push([rakehim ? 'rake table' : 'range table', hit]);
  if (rakehim && sternrake) {
    hit++;
    parts.push(['stern rake', 1]);
  }
  const q = QUAL[row][capship(st, sp).specs.qual - 1] || 0;
  hit += q;
  if (q) parts.push(['crew quality', q]);
  if (sp.captured < 0) {
    for (let n = 0; n < 3; n++) {
      if (!crew[n]) {
        const d = index <= 5 ? 1 : 2;
        hit -= d;
        parts.push([`crew section ${n + 1} absent`, -d]);
      }
    }
  }
  if (ready & R_INITIAL) {
    const d = index <= 3 ? 1 : 2;
    hit += d;
    parts.push(['initial broadside', d]);
  }
  if (sp.captured >= 0) {
    const d = index <= 1 ? 1 : 2;
    hit -= d;
    parts.push(['prize crew', -d]);
  }
  const a = AMMO[row][load - 1];
  hit += a;
  if (a) parts.push([`${LOAD_WORD[load]} shot`, a]);
  const hs = highSeasPenalty(sp.specs.class, st.windspeed);
  hit += hs;
  if (hs) parts.push(['heavy seas', hs]);
  return { hit, index, range: tr, rakehim, sternrake, parts };
}

const ROLL6_RIG = {
  0: 'fore topsail sheets parted',
  1: 'mizzen shrouds parted',
  2: 'main topsail yard shot away',
  4: 'fore topmast and foremast shrouds shot away',
  5: 'mizzen mast and yard shot through',
  6: 'foremast and spritsail yard shattered',
  7: 'main topmast and mizzen mast shattered',
};
const ROLL6_HULL = {
  0: 'anchor cables severed',
  1: 'two anchor stocks shot away',
  2: 'quarterdeck bulwarks damaged',
  3: 'three gun ports shot away',
  4: 'four guns dismounted',
  5: 'rudder cables shot through',
  6: 'shot holes below the water line',
};

// Apply one broadside's hits to `on` (sail/assorted.c:47-237).
// Returns a damage record for the event stream.
export function table(ctx, from, on, rig, shot, hittable, roll) {
  const { st } = ctx;
  const s = on.specs;
  let hhits = 0; let chits = 0; let ghits = 0; let rhits = 0;
  let Ghit = 0; let Hhit = 0; let Rhit = 0; let Chit = 0;
  let pc = on.pcrew;
  let hull = s.hull;
  const crew = [s.crew1, s.crew2, s.crew3];
  const rigg = [s.rig1, s.rig2, s.rig3, s.rig4];
  const before = { hull: s.hull, crew: [...crew], rig: [...rigg], gunL: s.gunL, gunR: s.gunR, carL: s.carL, carR: s.carR, pcrew: on.pcrew };
  if (shot === L_GRAPE) {
    Chit = chits = hittable;
  } else {
    const h = Math.max(0, Math.min(10, hittable));
    const [H, G, C, R] = (rig ? RigTable : HullTable)[h][roll - 1];
    Chit = chits = C;
    Rhit = rhits = R;
    Hhit = hhits = H;
    Ghit = ghits = G;
    if (on.FS) rhits *= 2;
    if (shot === L_CHAIN) {
      Ghit = ghits = 0;
      Hhit = hhits = 0;
    }
  }
  if (on.captured >= 0) {
    pc -= Math.trunc((chits + 1) / 2);
    chits = Math.trunc(chits / 2);
  }
  for (let n = 0; n < 3; n++) {
    if (chits > crew[n]) {
      chits -= crew[n];
      crew[n] = 0;
    } else {
      crew[n] -= chits;
      chits = 0;
    }
  }
  for (let n = 0; n < 3; n++) {
    if (rhits > rigg[n]) {
      rhits -= rigg[n];
      rigg[n] = 0;
    } else {
      rigg[n] -= rhits;
      rhits = 0;
    }
  }
  if (rigg[3] !== -1 && rhits > rigg[3]) {
    rhits -= rigg[3];
    rigg[3] = 0;
  } else if (rigg[3] !== -1) {
    rigg[3] -= rhits;
  }
  const msgs = [];
  if (rig && !rigg[2] && (!rigg[3] || rigg[3] === -1)) msgs.push('dismasted!');
  const starboard = portside(from, on, 0);
  let guns = starboard ? s.gunR : s.gunL;
  let car = starboard ? s.carR : s.carL;
  if (ghits > car) {
    ghits -= car;
    car = 0;
  } else {
    car -= ghits;
    ghits = 0;
  }
  if (ghits > guns) {
    ghits -= guns;
    guns = 0;
  } else {
    guns -= ghits;
    ghits = 0;
  }
  hull -= ghits;
  if (Ghit) {
    if (starboard) {
      s.gunR = guns;
      s.carR = car;
    } else {
      s.gunL = guns;
      s.carL = car;
    }
  }
  hull -= hhits;
  hull = hull < 0 ? 0 : hull;
  if (on.captured >= 0 && Chit) on.pcrew = pc < 0 ? 0 : pc;
  if (Hhit) s.hull = hull;
  if (Chit) [s.crew1, s.crew2, s.crew3] = crew;
  if (Rhit) [s.rig1, s.rig2, s.rig3, s.rig4] = rigg;
  const verb = {
    [L_ROUND]: 'firing round shot on $$',
    [L_GRAPE]: 'firing grape shot on $$',
    [L_CHAIN]: 'firing chain shot on $$',
    [L_DOUBLE]: 'firing double shot on $$',
    [L_EXPLODE]: 'exploding shot on $$',
  }[shot];
  makesignal(ctx, from, verb, on);
  let rudder = false;
  if (roll === 6 && rig) {
    if (ROLL6_RIG[Rhit]) msgs.push(ROLL6_RIG[Rhit]);
  } else if (roll === 6) {
    if (ROLL6_HULL[Hhit]) msgs.push(ROLL6_HULL[Hhit]);
    if (Hhit === 5) {
      s.ta = 0; // rudder cables shot through: no more turns
      rudder = true;
    }
  }
  for (const m of msgs) makemsg(ctx, on, m);
  const after = { hull: s.hull, crew: [s.crew1, s.crew2, s.crew3], rig: [s.rig1, s.rig2, s.rig3, s.rig4], gunL: s.gunL, gunR: s.gunR, carL: s.carL, carR: s.carR, pcrew: on.pcrew };
  let struckNow = null;
  if (!hull) struckNow = strike(ctx, on, from);
  return {
    before, after, starboardSide: starboard, msgs, rudder,
    table: { H: Hhit, G: Ghit, C: Chit, R: Rhit },
    struck: struckNow,
  };
}

// Colours struck (sail/assorted.c:264-287). 1/3 sinking, 1/3 catching fire.
export function strike(ctx, ship, from) {
  if (ship.struck) return null;
  ship.struck = 1;
  from.points += ship.specs.pts;
  unboard(ship, ship, 0);
  unboard(ship, ship, 1);
  let fate = null;
  switch (dieroll(ctx.st.rng)) {
    case 3: case 4: ship.sink = 1; fate = 'sink'; break;
    case 5: case 6: ship.explode = 1; fate = 'fire'; break;
    default: break;
  }
  emit(ctx, 'strike', { ship: ship.index, by: from.index, fate });
  makemsg(ctx, ship, 'striking her colours!');
  return fate || 'struck';
}

// One broadside. Used by both the human (acceptcombat) and the computer
// (compcombat); `human` switches the handful of places where they differ.
function broadside(ctx, sp, r, opts) {
  const { st } = ctx;
  const side = r ? 'R' : 'L';
  const ready = r ? sp.readyR : sp.readyL;
  const guns = r ? sp.specs.gunR : sp.specs.gunL;
  const car = r ? sp.specs.carR : sp.specs.carL;
  const { target, load, shootat, human, crew } = opts;
  const h = computeHit(st, sp, target, { guns, car, load, ready, crew });
  if (!human && (ready & R_INITIAL)) {
    if (r) sp.readyR &= ~R_INITIAL;
    else sp.readyL &= ~R_INITIAL;
  }
  const ev = {
    from: sp.index, to: target.index, side, load, aim: shootat === HULL ? 'hull' : 'rigging',
    range: h.range, rake: h.rakehim, sternrake: h.sternrake, hit: h.hit, parts: h.parts,
    initial: !!(ready & R_INITIAL), guns, car: h.range < 3 ? car : 0,
  };
  if (h.rakehim) {
    makemsg(ctx, sp, h.sternrake
      ? `Stern Rake! ${target.name} splintering!`
      : `Raking the ${target.name}!`);
  }
  if (h.hit >= 0) {
    const roll = dieroll(st.rng);
    let hit = h.hit;
    if (load !== L_GRAPE) hit = hit > 10 ? 10 : hit;
    ev.roll = roll;
    ev.damage = table(ctx, sp, target, shootat, load, hit, roll);
  } else {
    ev.miss = true;
    makesignal(ctx, sp, `${LOAD_WORD[load]} shot falls short of $$`, target);
  }
  emit(ctx, 'fire', ev);
  return ev;
}

// Can `sp` fire side r right now, and at whom? Mirrors the checks in
// sail/pl_3.c:88-99 so the UI can preview before the player commits.
export function fireOptions(st, sp, r) {
  const load = r ? sp.loadR : sp.loadL;
  const ready = r ? sp.readyR : sp.readyL;
  const guns = r ? sp.specs.gunR : sp.specs.gunL;
  const car = r ? sp.specs.carR : sp.specs.carL;
  const crew = freeSections(sp);
  const no = (why) => ({ ok: false, why });
  if ((!guns && !car) || load === L_EMPTY || (ready & R_LOADED) === 0) return no('not loaded');
  if (sp.struck || !crew[2]) return no('no gun crews');
  const target = closestenemy(st, sp, r ? 'r' : 'l', 1);
  if (!target) return no('nothing bears');
  if (target.struck) return no(`${target.name} has struck`);
  const tr = range(sp, target);
  if (tr > RANGE_OF_SHOT[load] || (!guns && tr >= 3)) return no(`${target.name} out of range (${tr})`);
  const canAim = load > L_CHAIN && tr < 6;
  const h = computeHit(st, sp, target, { guns, car, load, ready, crew });
  return {
    ok: true, target: target.index, range: tr, canAim, hit: h.hit, parts: h.parts,
    rake: h.rakehim, sternrake: h.sternrake,
    friendly: capship(st, target).nationality === capship(st, sp).nationality,
  };
}

// The human's broadside (sail/pl_3.c:46-217). aim: 'hull' | 'rigging'.
export function playerFire(ctx, sp, r, aim) {
  const { st } = ctx;
  const opt = fireOptions(st, sp, r);
  if (!opt.ok) {
    makemsg(ctx, sp, `unable to fire ${r ? 'right' : 'left'} broadside (${opt.why})`);
    return null;
  }
  const load = r ? sp.loadR : sp.loadL;
  const target = st.ships[opt.target];
  const shootat = opt.canAim && aim === 'hull' ? HULL : RIGGING;
  const ev = broadside(ctx, sp, r, { target, load, shootat, human: true, crew: freeSections(sp) });
  if (r) {
    sp.loadR = L_EMPTY;
    sp.readyR = R_EMPTY;
  } else {
    sp.loadL = L_EMPTY;
    sp.readyL = R_EMPTY;
  }
  return ev;
}

// The computer's gunnery (sail/dr_1.c:268-398). Computer ships never unload:
// "the computer ships can fire double shot every turn" (sail.6:602).
// FIX (ADR 004): the original accumulated boarding-party `men` across ALL
// ships without resetting it, so later ships in the list could think their
// gun crews were away boarding. It is reset per ship here.
export function compcombat(ctx) {
  const { st } = ctx;
  for (const sp of st.ships) {
    if (sp.captain || sp.dir === 0) continue;
    const crew = freeSections(sp);
    // freeSections() returns 0/1 flags; the C code keeps raw counts when no
    // parties are out, but only ever tests them for zero.
    for (let r = 0; r < 2; r++) {
      if (!crew[2] || sp.struck) continue;
      const ready = r ? sp.readyR : sp.readyL;
      const guns = r ? sp.specs.gunR : sp.specs.gunL;
      const car = r ? sp.specs.carR : sp.specs.carL;
      if (!guns && !car) continue;
      if ((ready & R_LOADED) === 0) continue;
      const closest = closestenemy(st, sp, r ? 'r' : 'l', 0);
      if (!closest) continue;
      const nearestAny = closestenemy(st, sp, r ? 'r' : 'l', 1);
      if (range(closest, sp) > range(sp, nearestAny)) continue; // a friend is in the way
      if (closest.struck) continue;
      const target = range(sp, closest);
      if (target > 10) continue;
      if (!guns && target >= 3) continue;
      let load = L_ROUND;
      if (target === 1 && sp.loadwith === L_GRAPE) load = L_GRAPE;
      if (target <= 3 && closest.FS) load = L_CHAIN;
      if (target === 1 && load !== L_GRAPE) load = L_DOUBLE;
      const shootat = load > L_CHAIN && target < 6 ? HULL : RIGGING;
      broadside(ctx, sp, r, { target: closest, load, shootat, human: false, crew });
    }
  }
}

// Burning and sinking hulks finish their fate on a 5-6 (sail/dr_2.c:88-117).
export function checkup(ctx) {
  const { st } = ctx;
  for (const sp of st.ships) {
    if (sp.dir === 0) continue;
    const { explode, sink } = sp;
    if (explode !== 1 && sink !== 1) continue;
    if (dieroll(st.rng) < 5) continue;
    if (sink === 1) sp.sink = 2;
    else sp.explode = 2;
    const where = { row: sp.row, col: sp.col, dir: sp.dir };
    sp.dir = 0;
    if (snagged(sp)) for (const sq of st.ships) cleansnag(st, sp, sq, 1, 3);
    if (sink !== 1) {
      makemsg(ctx, sp, 'exploding!');
      emit(ctx, 'explode', { ship: sp.index, ...where });
      for (const sq of st.ships) {
        // range() needs the exploding ship's position; it still has row/col.
        if (sp !== sq && sq.dir && rangeFromPose(where, sq) < 4) {
          const dmg = table(ctx, sp, sq, RIGGING, L_EXPLODE, Math.trunc(sp.specs.guns / 13), 6);
          emit(ctx, 'blast', { from: sp.index, to: sq.index, damage: dmg });
        }
      }
    } else {
      makemsg(ctx, sp, 'sinking!');
      emit(ctx, 'sink', { ship: sp.index, ...where });
    }
  }
}

// In C the exploding ship's dir is already 0 when range(sp, sq) runs, but
// range() only checks the *target's* dir and reads the source's stern from
// its (now zero) dir, i.e. treats it as a single square. Reproduce that.
function rangeFromPose(pose, to) {
  return range({ row: pose.row, col: pose.col, dir: 0 }, to);
}

export { shipLabel };
