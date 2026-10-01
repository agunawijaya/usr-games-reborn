// The hint engine: reads the live engine state and proposes the next
// command toward victory. It is also the autoplayer used by the tests, so
// every hint it gives has been proven to win (tests/autoplay.test.js).
//
// The winning line, verified against the C source and replayed on the real
// binary (tests/golden/*-walkthrough*):
//   1. Ship: take the amulet (13) -- plus laser (20) and knife (21) -- and
//      launch from the viper tube (7) before turn 31, when the ship explodes.
//   2. Space: fly south to the tropical planet (68), down to the island and
//      land over the wide valley (84 -> 98). One Cylon (64) blocks the way.
//   3. Day 1 only: at the thermal pools (126) "take goddess" while holding the
//      amulet, then "follow" her to the throne room (268). Kiss her twice,
//      then "love goddess": she leaves the medallion. Leave it there.
//   4. Fetch a real weapon (two-handed sword, 190) and go down into the
//      catacombs (216 -> 257) by day; wait at the ladder (261) for nightfall.
//   5. Night: down to the flooded mine and west to the Dark Lord (266). Hurt
//      him (lifeline > 33) with the amulet but NOT the medallion held, then
//      "back": he takes the amulet and flees. "follow" him at once.
//   6. In the second fight "back" again: you escape to wherever `back`
//      points and the talisman and amulet drop there (follow() in command2.c).
//   7. "use amulet" returns you to the stream by the pools; walk to the
//      throne, take the medallion (three artifacts: you are now a wizard).
//   8. Give amulet, medallion and talisman to the goddess; then shoot her.

import { C, testbit, OBJSHT } from './battlestar.js';

const {
  KNIFE, SWORD, TWO_HANDED, BROAD, MAIL, HELM, SHIELD, LASER, AMULET, MEDALION, TALISMAN, BATHGOD, NORMGOD,
  ELF, WOODSMAN, DARK, CYLON, VIPER, LAND, POTION, PAPAYAS, PINEAPPLE, KIWI, COCONUTS, MANGO, MATCHES,
  NORTH, SOUTH, EAST, WEST, LAUNCHED, CANTMOVE, CANTLAUNCH, NUMOFOBJECTS, FINAL, ROBE, PAJAMAS, COMPASS,
  ROPE, RING, BRACELET, GRENADE, LEVIS, SHOES, CYCLE,
} = C;

const L_N = 0, L_S = 1, L_E = 2, L_W = 3, L_UP = 4, L_ACCESS = 5, L_DOWN = 6, L_FLY = 7;
const DIRS = [NORTH, SOUTH, EAST, WEST];
const FRUIT = [PAPAYAS, PINEAPPLE, KIWI, COCONUTS, MANGO];
const WEARABLE = new Set([KNIFE, ROBE, LEVIS, SWORD, MAIL, HELM, SHOES, PAJAMAS, COMPASS, LASER, AMULET,
  TALISMAN, MEDALION, ROPE, RING, BRACELET, GRENADE]);
const ARTIFACTS = [AMULET, MEDALION, TALISMAN];

/** Relative verb that moves from facing `dir` toward absolute `abs`. */
export function relativeVerb(dir, abs) {
  const order = { [NORTH]: 0, [EAST]: 1, [SOUTH]: 2, [WEST]: 3 };
  const d = (order[abs] - order[dir] + 4) % 4;
  return ['ahead', 'right', 'back', 'left'][d];
}

/** Absolute direction constant for link index 0..3. */
const ABS = [NORTH, SOUTH, EAST, WEST];

const name = (o) => OBJSHT[o] || ['', '', 'landing zone', '', '', '', '', '', '', '', '', '', '', '', 'Cylon',
  '', '', '', '', '', '', '', '', 'goddess', 'goddess'][o] || `object ${o}`;

function roomHazard(g, r, target) {
  if (r === target) return 0;
  let c = 0;
  if (g.here(ELF, r)) c += 40;
  if (g.here(WOODSMAN, r)) c += 40;
  if (g.here(DARK, r)) c += 400;
  if (g.here(CYLON, r)) c += 12;
  if (r === 69) c += 10000; // the fog trap: every exit loops back
  if (r === 97) c += 60;
  return c;
}

/**
 * Cheapest action sequence from the current state to `target` (a room).
 * Nodes are (room, airborne). Returns [{cmd, to, air}] or null.
 */
export function route(g, target, { allowAmulet = true, allowFly = true, groundOnly = false } = {}) {
  const loc = g.location;
  const startAir = !!g.notes[LAUNCHED];
  const viperAt = [];
  for (let r = 1; r <= 275; r++) if (testbit(loc[r].objects, VIPER)) viperAt.push(r);
  const key = (r, air) => r * 2 + (air ? 1 : 0);
  const dist = new Map();
  const prev = new Map();
  const start = key(g.position, startAir);
  dist.set(start, 0);
  // Tiny binary-heap-free Dijkstra (graph has < 600 nodes).
  const open = [[0, g.position, startAir]];
  const canUp = (r) => loc[r].link[L_ACCESS] || g.wiz || g.tempwiz;
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [d, r, air] = open.splice(bi, 1)[0];
    if (d > (dist.get(key(r, air)) ?? Infinity)) continue;
    if (r === target && (!air || loc[r].link[L_FLY])) {
      // reconstruct
      const out = [];
      let k = key(r, air);
      while (prev.has(k)) { const p = prev.get(k); out.unshift(p.step); k = p.from; }
      return out;
    }
    const edges = [];
    const l = loc[r].link;
    if (!air) {
      if (!groundOnly || true) {
        for (let i = 0; i < 4; i++) if (l[i] && !loc[l[i]].link[L_FLY]) edges.push({ to: l[i], air: false, cmd: { abs: ABS[i] }, cost: 1 });
        if (l[L_UP] && canUp(r) && !loc[l[L_UP]].link[L_FLY]) edges.push({ to: l[L_UP], air: false, cmd: 'up', cost: 1 });
        if (l[L_DOWN] && !loc[l[L_DOWN]].link[L_FLY]) edges.push({ to: l[L_DOWN], air: false, cmd: 'down', cost: 1 });
      }
      if (allowFly && viperAt.includes(r) && l[L_UP] && !g.notes[CANTLAUNCH] && g.fuel > 4) {
        edges.push({ to: l[L_UP], air: true, cmd: 'launch', cost: 2 });
      }
      const amuletReady = g.has(AMULET) ||
        (g.wears(AMULET) && g.carrying + objWeight(AMULET) <= g.WEIGHT && g.encumber + objBulk(AMULET) <= g.CUMBER);
      if (allowAmulet && amuletReady && r !== FINAL) {
        const to = r === 229 ? 224 : 229;
        edges.push({ to, air: false, cmd: 'use amulet', cost: 4 });
      }
    } else {
      for (let i = 0; i < 4; i++) if (l[i] && loc[l[i]].link[L_FLY]) edges.push({ to: l[i], air: true, cmd: { abs: ABS[i] }, cost: 1 });
      if (l[L_UP] && canUp(r) && loc[l[L_UP]].link[L_FLY]) edges.push({ to: l[L_UP], air: true, cmd: 'up', cost: 1 });
      if (l[L_DOWN] && loc[l[L_DOWN]].link[L_FLY]) edges.push({ to: l[L_DOWN], air: true, cmd: 'down', cost: 1 });
      if (testbit(loc[r].objects, LAND) && l[L_DOWN] && !loc[l[L_DOWN]].link[L_FLY]) {
        edges.push({ to: l[L_DOWN], air: false, cmd: 'land', cost: 1 });
      }
    }
    for (const e of edges) {
      const nd = d + e.cost + roomHazard(g, e.to, target);
      const k = key(e.to, e.air);
      if (nd < (dist.get(k) ?? Infinity)) {
        dist.set(k, nd);
        prev.set(k, { from: key(r, air), step: { cmd: e.cmd, to: e.to, air: e.air } });
        open.push([nd, e.to, e.air]);
      }
    }
  }
  return null;
}

/** Turns a route's first step into a concrete command for the current facing. */
function stepCommand(g, step) {
  if (step.cmd === 'use amulet' && !g.has(AMULET)) return 'draw amulet';
  if (typeof step.cmd === 'string') return step.cmd;
  return relativeVerb(g.direction, step.cmd.abs);
}

function goTo(g, target, why, opts) {
  if (g.position === target) return null;
  const r = route(g, target, opts);
  if (!r || !r.length) return null;
  return { cmd: stepCommand(g, r[0]), why, target, path: r.map((s) => s.to), steps: r.length };
}

/** Where an object lies in the current world (first room), or 0. */
function findObject(g, obj) {
  for (let r = 1; r <= 275; r++) if (testbit(g.location[r].objects, obj)) return r;
  return 0;
}

function weaponRank(g) {
  if (g.has(TWO_HANDED)) return 3;
  if (g.has(SWORD) || g.has(BROAD)) return 2;
  if (g.has(KNIFE)) return 1;
  return 0;
}

/** Wear or drop things so that an object of weight w / bulk c can be taken. */
function makeRoom(g, obj) {
  const need = { w: objWeight(obj), c: objBulk(obj) };
  if (g.carrying + need.w <= g.WEIGHT && g.encumber + need.c <= g.CUMBER) return null;
  // Injuries shrink WEIGHT/CUMBER; the potion restores both.
  if (g.has(POTION) && (g.WEIGHT < 60 || g.CUMBER < 10) &&
      (need.w > g.WEIGHT - g.carrying || need.c > g.CUMBER - g.encumber)) {
    return { cmd: 'drink potion', why: 'Your wounds have cost you your strength. The pink potion restores it.' };
  }
  // Prefer wearing wearable items still in the hands (they keep working when drawn again).
  const holdables = g.inventory().filter((o) => WEARABLE.has(o) && o !== obj);
  // Wear bulky first; keep the laser in hand only if nothing else frees enough room.
  holdables.sort((a, b) => (a === AMULET) - (b === AMULET) || objBulk(b) - objBulk(a));
  for (const o of holdables) {
    if (o === KNIFE && !g.has(TWO_HANDED) && obj !== TWO_HANDED && FRUIT.some((f) => g.has(f))) continue;
    return { cmd: `wear ${wordFor(o)}`, why: `Free your hands for the ${name(obj)}: wearing a thing takes its weight off your arms.` };
  }
  const junk = g.inventory().filter((o) => ![AMULET, MEDALION, TALISMAN, LASER, KNIFE, TWO_HANDED, POTION].includes(o));
  if (junk.length) return { cmd: `drop ${wordFor(junk[0])}`, why: `Too much to carry; drop the ${name(junk[0])}.` };
  if (g.has(TWO_HANDED) && obj !== TWO_HANDED) {
    return { cmd: 'drop two-handed', why: (obj === MAIL || obj === HELM)
      ? 'Put the sword down for a moment to take the armour.'
      : 'The two-handed sword fills both arms; drop it now that the Dark Lord has fled.' };
  }
  return null;
}

// Weights and bulk come from the engine tables.
import { OBJWT, OBJCUMBER } from './battlestar.js';
const objWeight = (o) => OBJWT[o] ?? 0;
const objBulk = (o) => OBJCUMBER[o] ?? 0;

/** A parser word that names the object (first vocabulary entry). */
const WORD = {
  [KNIFE]: 'knife', [SWORD]: 'scabbard', [TWO_HANDED]: 'two-handed', [BROAD]: 'broadsword', [MAIL]: 'mail',
  [HELM]: 'helmet', [SHIELD]: 'shield', [LASER]: 'laser', [AMULET]: 'amulet', [MEDALION]: 'medallion',
  [TALISMAN]: 'talisman', [POTION]: 'potion', [PAPAYAS]: 'papayas', [PINEAPPLE]: 'pineapple', [KIWI]: 'kiwi',
  [COCONUTS]: 'coconuts', [MANGO]: 'mango', [MATCHES]: 'matches', [ROBE]: 'robe', [PAJAMAS]: 'pajamas',
  [COMPASS]: 'compass', [ROPE]: 'rope', [RING]: 'ring', [BRACELET]: 'bracelet', [GRENADE]: 'grenade',
  [LEVIS]: 'levis', [SHOES]: 'shoes',
};
export const wordFor = (o) => WORD[o] || OBJSHT[o] || String(o);

/** Would the injuries taken so far make you immobile once news() applies them? */
function wouldBePinned(g) {
  let W = g.WEIGHT;
  let Cu = g.CUMBER;
  for (let n = 0; n < 13; n++) if (g.injuries[n] === 1) W = W > 5 ? W - 5 : 0;
  if (g.injuries[6] === 1 || g.injuries[6] === 2) Cu = Cu > 5 ? Cu - 5 : 0; // ARM
  if (g.injuries[7] === 1 || g.injuries[7] === 2) Cu = Cu > 2 ? Cu - 2 : 0; // RIBS
  if (g.injuries[9] === 1 || g.injuries[9] === 2) W = 0; // SPINE
  return g.carrying > W || g.encumber > Cu;
}

/** Fight policy (the <fight!> prompt). */
export function fightHint(g) {
  const f = g.inFight;
  if (!f) return null;
  const { enemy, strength, lifeline } = f;
  if (enemy === DARK) {
    if (strength === 100) {
      // First encounter: hurt him, then retreat so he takes the amulet and flees.
      if (lifeline > strength * 0.33) {
        if (g.holds(MEDALION)) return { cmd: 'kill', why: 'Never retreat from the Dark Lord while carrying the medallion.' };
        if (g.holds(AMULET)) {
          // After the fight, news() turns fresh injuries into lost carrying capacity. If that
          // would leave you unable to move, the chase ends in the pit with no way out.
          const heavy = g.inventory().filter((o) => objWeight(o) + objBulk(o) > 0 && o !== AMULET);
          if (heavy.length && wouldBePinned(g)) {
            return { cmd: `drop ${wordFor(heavy.sort((a, b) => objWeight(b) - objWeight(a))[0])}`,
              why: 'Your wounds will leave you unable to carry this. Drop it now (dropping in a fight costs no time), then retreat.' };
          }
          return { cmd: 'back', why: 'He is wounded (more than a third). Retreat: he will seize the amulet and flee — then follow him.' };
        }
        return { cmd: 'kill', why: 'Without the amulet a retreat is fatal. Fight on.' };
      }
      return { cmd: 'kill', why: 'Wound the Dark Lord (more than a third of his strength) before you retreat. Do not shoot: he would take your laser.' };
    }
    // Cornered in the pit: a retreat at once is safe and drops the talisman where you land.
    if (lifeline <= strength * 0.33) return { cmd: 'back', why: 'Retreat now: you escape, and the talisman and amulet fall where you land.' };
    if (g.has(LASER) && strength - lifeline <= 50) return { cmd: 'shoot', why: 'He is weak enough: the laser will finish him.' };
    return { cmd: 'kill', why: 'Finish him.' };
  }
  // Elves and woodsmen: the laser never misses a foe this weak.
  if (g.has(LASER) && strength - lifeline <= 50) return { cmd: 'shoot', why: `The laser kills the ${name(enemy)} outright.` };
  // (drawing it fails when the hands are full, e.g. with the two-handed sword: then fight on)
  if (g.wears(LASER) && g.carrying + objWeight(LASER) <= g.WEIGHT && g.encumber + objBulk(LASER) <= g.CUMBER) {
    return { cmd: 'draw laser', why: 'Draw your laser.' };
  }
  return { cmd: 'kill', why: `Fight the ${name(enemy)}.` };
}

/**
 * The next step toward victory.
 * @returns {{cmd: string|null, why: string, goal: string, phase: number, target?: number}}
 */
export function nextHint(g, request = g.request) {
  if (g.ended) return { cmd: null, goal: 'Game over', phase: 99, why: g.endKind === 'won' ? 'You have won.' : 'Start a new game.' };
  if (request && request.kind === 'flight') {
    return { cmd: null, goal: 'Dogfight', phase: 2, why: 'Steer so the raider drifts into the centre of the reticle, then fire. Torpedoes hit only on the centre row, within one column of the cross.' };
  }
  if (g.inFight) return { ...fightHint(g), goal: 'Fight', phase: g.inFight.enemy === DARK ? 6 : 0 };
  if (request && request.kind === 'line' && request.prompt !== '>-: ') {
    return { cmd: '', goal: 'Answer the prompt', phase: 0, why: 'Press Enter to keep the current value.' };
  }
  const h = plan(g);
  return h;
}

function plan(g) {
  const pos = g.position;
  const air = !!g.notes[LAUNCHED];
  const night = g.isNight;
  const holdsAll = ARTIFACTS.every((a) => g.holds(a));

  // --- Endgame ---------------------------------------------------------
  if (g.wintime) {
    if (g.here(NORMGOD)) {
      const MELEE = [SWORD, KNIFE, TWO_HANDED, BROAD];
      if (g.has(LASER)) return H('shoot goddess', 'She kicked you awake: the game tells you what it takes to win.', 'Finale', 8);
      if (MELEE.some((o) => g.has(o))) return H('kill goddess', 'The game says you must end her reign to win.', 'Finale', 8);
      for (const o of [LASER, KNIFE, SWORD]) {
        if (!g.wears(o)) continue;
        const room = makeRoom(g, o);
        if (room) return { ...room, goal: 'Finale', phase: 8 };
        return H(`draw ${wordFor(o)}`, `Draw the ${name(o)}.`, 'Finale', 8);
      }
      const knifeAt = findObject(g, KNIFE);
      if (knifeAt) return nav(g, knifeAt, 'You need a weapon: there is a knife nearby.', 'Finale', 8);
    }
    return nav(g, 268, 'Return to the throne room.', 'Finale', 8);
  }

  // Time-critical: follow the goddess / the Dark Lord on the very next command.
  if (g.followgod === g.ourtime && !g.loved && !g.here(NORMGOD, 268)) return H('follow', 'Follow her before the moment passes.', 'Meet the goddess', 3);
  if (g.followfight === g.ourtime) return H('follow', 'Chase the Dark Lord now.', 'The Dark Lord', 6);

  // Emergencies: unable to move under the load. (notes[CANTMOVE] is only refreshed by
  // news(); judge the real load. A stale flag clears itself on the next move attempt.)
  if ((g.carrying > g.WEIGHT || g.encumber > g.CUMBER) && !air) {
    const junk = g.inventory().filter((o) => ![AMULET, MEDALION, TALISMAN, LASER, KNIFE].includes(o));
    const w = g.inventory().find((o) => WEARABLE.has(o));
    if (w !== undefined) return H(`wear ${wordFor(w)}`, 'You are overloaded. Worn things weigh nothing on your arms.', 'Recover', 0);
    if (junk.length) return H(`drop ${wordFor(junk[0])}`, 'You are overloaded; drop something.', 'Recover', 0);
    if (g.has(POTION)) return H('drink potion', 'The pink potion heals every injury.', 'Recover', 0);
  }

  // --- 1. Escape the battlestar ----------------------------------------
  if (pos <= 31) {
    const t = g.ourtime;
    const toTube = (from) => groundDistance(g, from, 7);
    const wants = [[AMULET, 13, true], [LASER, 20, false], [KNIFE, 21, false]];
    for (const [obj, room, essential] of wants) {
      if (g.holds(obj)) continue;
      if (pos === room && g.here(obj)) return H(`take ${wordFor(obj)}`, `Take the ${name(obj)}.`, 'Escape the Battlestar', 1);
      if (!g.here(obj, room)) continue;
      const leg = route(g, room)?.length ?? 99;
      const back = toTube(room);
      if (essential || t + leg + 1 + back + 1 < 30) {
        return nav(g, room, `The ${name(obj)} is in room ${room}.${essential ? ' You need it to win.' : ''} The ship explodes after turn 30.`, 'Escape the Battlestar', 1);
      }
    }
    if (pos === 7) return H('launch', 'Climb into the viper and launch.', 'Escape the Battlestar', 1);
    return nav(g, 7, 'Get to the viper launch tube before the battlestar explodes (after turn 30).', 'Escape the Battlestar', 1);
  }

  // --- 2. In flight: land where the next ground goal is ----------------
  if (air) {
    const groundGoal = nextGroundTarget(g);
    // Pick the landing zone closest to the ground goal.
    let best = null;
    for (let r = 69; r <= 104; r++) {
      const room = g.location[r];
      if (!room.link[L_FLY] || !testbit(room.objects, LAND) || !room.link[L_DOWN]) continue;
      const fly = route(g, r, { allowAmulet: false })?.length;
      if (fly === undefined) continue;
      const walk = groundDistance(g, room.link[L_DOWN], groundGoal);
      const cost = fly + walk;
      if (!best || cost < best.cost) best = { r, cost };
    }
    if (best) {
      if (pos === best.r) return H('land', `Land here: it is the closest landing to room ${groundGoal}.`, 'Fly to the island', 2);
      return nav(g, best.r, 'Fly toward the landing zone.', 'Fly to the island', 2);
    }
    return nav(g, 68, 'Head for the tropical planet.', 'Fly to the island', 2);
  }

  // --- 3. Meet the bathing goddess (first day only) --------------------
  const goddessAtThrone = g.here(NORMGOD, 268);
  if (!goddessAtThrone && !g.loved) {
    if (g.here(BATHGOD, 126)) {
      if (!g.holds(AMULET)) return H(null, 'The bathing goddess only rises for someone carrying the amulet from the battlestar.', 'Meet the goddess', 3);
      if (pos === 126) return H('take goddess', 'Offer your hand to the bathing goddess (you carry the amulet).', 'Meet the goddess', 3);
      return nav(g, 126, 'A goddess bathes in the thermal pools — but only until the first sunset.', 'Meet the goddess', 3);
    }
    return H(null, 'The bathing goddess is gone (she leaves at the first dusk). This run can no longer be won; start again and reach the thermal pools on the first day.', 'Stuck', 99);
  }

  // --- 4. Court the goddess --------------------------------------------
  if (!g.loved) {
    if (pos === 268) {
      if (g.godready < 2) return H('kiss goddess', 'She needs to warm to you: kiss her until she stops squirming.', 'Win the goddess', 4);
      return H('love goddess', 'She is ready.', 'Win the goddess', 4);
    }
    return nav(g, 268, 'Go to the goddess in the throne room.', 'Win the goddess', 4);
  }

  // --- 7/8. After the talisman: medallion, gifts ------------------------
  const talismanSecured = g.holds(TALISMAN) || g.win >= 3;
  if (talismanSecured || (g.followfight !== -1 && findObject(g, TALISMAN))) {
    // Pick up the talisman and the amulet wherever they fell.
    for (const obj of [TALISMAN, AMULET]) {
      if (g.holds(obj)) continue;
      const at = findObject(g, obj);
      if (!at) continue;
      if (pos === at) {
        const room = makeRoom(g, obj);
        if (room) return { ...room, goal: 'Claim the talisman', phase: 7 };
        return H(`take ${wordFor(obj)}`, `The ${name(obj)} lies here.`, 'Claim the talisman', 7);
      }
      return nav(g, at, `The ${name(obj)} fell in room ${at}.`, 'Claim the talisman', 7);
    }
    if (!g.holds(MEDALION) && g.here(MEDALION, 268)) {
      if (pos === 268) {
        const room = makeRoom(g, MEDALION);
        if (room) return { ...room, goal: 'Take the medallion', phase: 7 };
        return H('take medallion', 'Now it is safe to take the medallion.', 'Take the medallion', 7);
      }
      return nav(g, 268, 'Back to the throne room for the medallion. The amulet can carry you to the stream near the pools.', 'Take the medallion', 7);
    }
    if (pos !== 268) return nav(g, 268, 'Bring the three artifacts to the goddess.', 'The gifts', 8);
    for (const obj of ARTIFACTS) {
      if (g.wears(obj)) return H(`draw ${wordFor(obj)}`, `Hold the ${name(obj)} in your hands to give it.`, 'The gifts', 8);
      if (g.has(obj)) return H(`give ${wordFor(obj)} to goddess`, `Return the ${name(obj)} to the last goddess of the waters.`, 'The gifts', 8);
    }
  }

  // --- 5. Prepare and descend -------------------------------------------
  // Medallion must NOT be carried when retreating from the Dark Lord.
  if (g.holds(MEDALION) && !g.holds(TALISMAN)) {
    return H(null, 'You carry the medallion: retreating from the Dark Lord now would destroy the world. (Dropping an artifact destroys it, so this run is lost.)', 'Stuck', 99);
  }
  if (!g.holds(AMULET)) return H(null, 'Without the amulet the Dark Lord cannot be made to flee. This run is lost.', 'Stuck', 99);

  if (weaponRank(g) < 3) {
    const at = g.here(TWO_HANDED, 190) ? 190 : findObject(g, TWO_HANDED);
    const reach = at && groundDistance(g, pos, at) < 90;
    if (at && reach && !night) {
      if (pos === at) {
        const room = makeRoom(g, TWO_HANDED);
        if (room) return { ...room, goal: 'Arm yourself', phase: 5 };
        return H('take two-handed', 'The two-handed sword hits hardest of all weapons.', 'Arm yourself', 5);
      }
      return nav(g, at, 'Fetch the two-handed sword from the cottage drawing room.', 'Arm yourself', 5);
    }
  }
  if (!g.has(POTION) && g.here(POTION, 190) && pos === 190) {
    const room = makeRoom(g, POTION);
    if (!room) return H('take potion', 'The pink potion heals every injury. Take it.', 'Arm yourself', 5);
  }
  // Heal if badly hurt before the big fight.
  if (g.has(POTION) && g.card(g.injuries, 13) >= 2 && pos !== 266) {
    return H('drink potion', 'Drink the potion to heal before the fight.', 'Arm yourself', 5);
  }
  // Keep the laser at hand once the heavy lifting is done? The two-handed sword
  // must be in the hands for the fight; the laser can stay worn.
  const darkAt = findObject(g, DARK);
  if (darkAt) {
    const below = [262, 263, 264, 265, 266].includes(pos);
    const armour = [MAIL, HELM].filter((o) => !g.wears(o) && findObject(g, o) + (g.has(o) ? 1 : 0));
    // Mail and helm (worn) push every blow toward the harmless end of the injury
    // table: with both on, a skull fracture or broken neck can no longer happen.
    if (armour.length && !below) {
      const o = armour[0];
      if (g.has(o)) return H(`wear ${wordFor(o)}`, `Put on the ${name(o)}.`, 'Armour', 5);
      const at = findObject(g, o);
      if (pos === at) {
        const room = makeRoom(g, o);
        if (room) return { ...room, goal: 'Armour', phase: 5 };
        return H(`take ${wordFor(o)}`, `Take the ${name(o)} from the tombs.`, 'Armour', 5);
      }
      if (night || route(g, at)) {
        const h = nav(g, at, `Armour from the royal tombs (room ${at}) protects your head and neck in the fight to come.`, 'Armour', 5);
        if (h.cmd) return h;
      }
      if (!night) {
        if (pos === 252) return nav(g, 255, 'Wait near the sloping passage for nightfall: the way to the tombs opens at night.', 'Wait for night', 5);
        if (pos === 255 && g.beenthere[252]) return nav(g, 252, `Wait for nightfall (after turn ${nextDusk(g) - 1}).`, 'Wait for night', 5);
        return nav(g, 252, 'Go down into the catacombs by day (secret entrance in the woods near the road, room 216: at night an elf and a woodsman guard it) and wait below.', 'Descend by day', 5);
      }
    }
    // Re-arm if the sword was put down to make room for the armour.
    if (!g.has(TWO_HANDED) && g.here(TWO_HANDED) && !below) {
      const room = makeRoom(g, TWO_HANDED);
      if (room) return { ...room, goal: 'Arm yourself', phase: 5 };
      return H('take two-handed', 'Pick the sword up again.', 'Arm yourself', 5);
    }
    if (!night && !below) {
      // The ladder under the flooded shaft (261 -> 262) only exists at night.
      if (pos === 261) return nav(g, 259, `Wait here for nightfall (after turn ${nextDusk(g) - 1}): the ladder below appears only at night. Pace between the tunnels.`, 'Wait for night', 5);
      if (pos === 259 && g.beenthere[261]) return nav(g, 261, `Wait for nightfall (after turn ${nextDusk(g) - 1}).`, 'Wait for night', 5);
      return nav(g, 261, 'Go down into the catacombs by day (the secret entrance is in the woods near the road, room 216: at night an elf and a woodsman guard it) and wait at the top of the flooded shaft.', 'Descend by day', 5);
    }
    if (below && pos !== 266) {
      const injured = g.card(g.injuries, 13) > 0;
      if (g.has(POTION) && injured) return H('drink potion', 'Heal before the fight: the potion mends every wound (and lets you sleep safely down here).', 'Rest before the fight', 6);
      if (g.snooze - g.ourtime < 75) return H('sleep', 'Rest first. Every round of a fight costs you stamina, and exhaustion weakens your blows. Underground no elf can rob you in your sleep.', 'Rest before the fight', 6);
    }
    if (!g.has(TWO_HANDED) && g.wears(KNIFE) && !g.has(KNIFE)) return H('draw knife', 'Hold a weapon.', 'The Dark Lord', 6);
    return nav(g, darkAt, 'The Dark Lord waits in the mine. Hurt him, then retreat while holding the amulet (not the medallion).', 'The Dark Lord', 6);
  }
  return H(null, 'No next step found.', 'Explore', 0);
}

function H(cmd, why, goal, phase) { return { cmd, why, goal, phase }; }

function nav(g, target, why, goal, phase) {
  const h = goTo(g, target, why);
  if (h) return { ...h, goal, phase };
  if (g.position === target) return { cmd: 'look', why, goal, phase, target };
  return { cmd: null, why: `${why} (No route from here right now.)`, goal, phase, target };
}

function groundDistance(g, from, to) {
  if (!to || from === to) return 0;
  const saved = g.position;
  const savedAir = g.notes[LAUNCHED];
  g.position = from;
  g.notes[LAUNCHED] = 0;
  const r = route(g, to, { allowFly: false });
  g.position = saved;
  g.notes[LAUNCHED] = savedAir;
  return r ? r.length : 999;
}

function nextDusk(g) {
  return g.rythmn + CYCLE + 1;
}

/** Where the plan wants to go once on the ground (used to choose a landing zone). */
function nextGroundTarget(g) {
  if (!g.loved && !g.here(NORMGOD, 268) && g.here(BATHGOD, 126)) return 126;
  if (!g.loved) return 268;
  if (weaponRank(g) < 3 && g.here(TWO_HANDED, 190)) return 190;
  return 216;
}

/** Autoplay helper: the command to send for the current request. */
export function autoCommand(g, request = g.request) {
  const h = nextHint(g, request);
  return h.cmd;
}
