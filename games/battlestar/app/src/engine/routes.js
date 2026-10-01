// The two walkthroughs in docs/walkthrough.md as playable routes, so that
// the documents are generated from real games (scripts/make-walkthrough-doc.mjs)
// and stay proven (tests/walkthrough.test.js, and the golden transcripts
// replay them on the real binary).
//
//   fastest  the fewest commands from waking to "You win!" that still wins
//            practically always: one visit to the native girl fills the
//            afternoon, a nap underground shortens the wait for nightfall.
//   full     a win with every scale at its top title — Pleasure >= 35
//            (Marquis De Sade), Power >= 22 (Sauron the Great), Ego >= 20
//            (Mr. Roarke) — without the game's assault ("ravage") and
//            without killing anyone harmless: Power comes from elves and
//            woodsmen shot with the laser, earned after the talisman is won
//            and before the gifts (the amulet can still carry you back).
//
// A route is a list of steps: ['go', room], ['cmd', text], or
// ['fn', g => text | null | PLANNER]. When the steps run out, or a step asks
// for it with PLANNER, the hint planner plays on. Fights use routeFight.

import { Battlestar, C, OBJWT, OBJCUMBER } from './battlestar.js';
import { nextHint, fightHint, route, relativeVerb } from './planner.js';

const {
  AMULET, TALISMAN, LASER, TWO_HANDED, SWORD, KNIFE, MACE, CLEAVER, BROAD, CHAIN, SHOVEL, HALBERD, ELF, WOODSMAN,
  NATIVE, RING, POTION, DARK, LAUNCHED,
} = C;

export const PLANNER = Symbol('planner');
export const TARGET = { pleasure: 35, power: 22, ego: 20 };
const MELEE = [SWORD, KNIFE, TWO_HANDED, MACE, CLEAVER, BROAD, CHAIN, SHOVEL, HALBERD];
const SAFE_BED = 218; // the bedroom: indoors, so no thief comes while you sleep

/** The next command toward a room (relative verbs follow the current facing). */
export function stepToward(g, target, opts) {
  const r = route(g, target, opts);
  if (!r || !r.length) return null;
  const s = r[0];
  if (typeof s.cmd !== 'string') return relativeVerb(g.direction, s.cmd.abs);
  return s.cmd === 'use amulet' && !g.has(AMULET) ? 'draw amulet' : s.cmd;
}

function nearest(g, pred) {
  let best = null;
  for (let r = 1; r <= 275; r++) {
    if (!pred(r)) continue;
    const rt = route(g, r, { allowAmulet: false });
    if (rt && (!best || rt.length < best.d)) best = { r, d: rt.length };
  }
  return best;
}

/** Walks out of the room and back, to let time pass. */
function pace(g) {
  const l = g.location[g.position].link;
  const k = [0, 1, 2, 3].find((i) => l[i] && l[i] !== g.position);
  return k === undefined ? 'look' : stepToward(g, l[k]);
}

const canHold = (g, o) => g.carrying + (OBJWT[o] ?? 0) <= g.WEIGHT && g.encumber + (OBJCUMBER[o] ?? 0) <= g.CUMBER;

/** Fights: the laser kills an elf or a woodsman outright; the planner's policy for the Dark Lord. */
export function routeFight(g) {
  const f = g.inFight;
  if (f && f.enemy !== DARK) {
    if (g.has(LASER) && f.strength - f.lifeline <= 50) return { cmd: 'shoot', why: 'The laser kills him outright.' };
    if (g.wears(LASER) && canHold(g, LASER)) return { cmd: 'draw laser', why: 'Draw the laser (it costs no time in a fight).' };
    return { cmd: 'kill', why: 'Fight with what you hold.' };
  }
  return fightHint(g);
}

// ------------------------------------------------------------------ the routes

/** Common opening: the amulet and the laser, launch, the goddess, the sword, one visit to the girl, down by day. */
const OPENING = [
  ['go', 13, 'The murdered stateroom: the amulet is on the floor.'],
  ['cmd', 'take amulet', 'The amulet: without it the goddess will not rise and the Dark Lord cannot be made to flee.'],
  ['go', 20, 'The presidential suite: the laser.'],
  ['cmd', 'take laser', 'The laser: it kills elves and woodsmen in one shot.'],
  ['go', 7, 'To the viper launch tube, before the ship explodes after turn 30.'],
  ['cmd', 'launch', 'Into space.'],
  ['go', 80, 'Fly south to the tropical planet, down over the island, land on the coral beach. Break off the dogfight with the raider (q).'],
  ['go', 126, 'The amulet carries you to the stream; walk to the thermal pools, where the goddess bathes on the first day only.'],
  ['cmd', 'take goddess', 'She rises only for someone who carries the amulet.'],
  ['cmd', 'follow', 'Follow her at once: she leads you to her throne room.'],
  ['cmd', 'kiss goddess', 'She squirms.'],
  ['cmd', 'kiss goddess', 'She is coming around.'],
  ['cmd', 'love goddess', 'She tells her story, pulls the throne out into a bed, and leaves the medallion (leave it where it lies).'],
  ['go', 190, 'The cottage drawing room: the two-handed sword and the potion.'],
  ['cmd', 'wear laser', 'Worn things weigh nothing on your arms.'],
  ['cmd', 'wear amulet', 'Free your hands for the sword.'],
  ['cmd', 'take two-handed', 'The two-handed sword hits hardest of all weapons.'],
  ['cmd', 'take potion', 'The pink potion heals every wound.'],
  ['go', 167, 'The native girl is here by day.'],
  ['cmd', 'love girl', 'Ten turns pass in one command (and Pleasure +5, Power +1).'],
  ['go', 216, 'The woods near the road: the secret way down into the catacombs. Pass here before dusk (at night an elf and a woodsman guard it).'],
  ['cmd', 'down', 'Into the catacombs.'],
  ['cmd', 'down', 'Deeper.'],
  ['cmd', 'sleep', 'A short nap underground (no thief comes here) shortens the wait for nightfall.'],
];

// Full score: earn Power once the talisman is won, then take the ring.
const HUNT = ['fn', (g) => {
  const stillNeeded = g.power + 5 - 15 < TARGET.power; // the gifts cost 15 Power, the final blow gives 5
  if (!stillNeeded) {
    if (g.has(RING)) return null;
    if (g.position === SAFE_BED) return g.here(RING) ? 'take ring' : null;
    return stepToward(g, SAFE_BED);
  }
  if (g.has(TWO_HANDED)) return 'drop two-handed';
  if (g.card(g.injuries, 13) > 0 && g.has(POTION)) return 'drink potion';
  if (g.wears(LASER) && !g.has(LASER)) return 'draw laser';
  if (!MELEE.some((o) => g.has(o)) && g.here(HALBERD)) return 'take halberd';
  const rest = g.snooze - g.ourtime;
  if (rest < 40) return g.position === SAFE_BED ? 'sleep' : stepToward(g, SAFE_BED);
  const foes = nearest(g, (r) => g.here(ELF, r) || g.here(WOODSMAN, r));
  if (foes && foes.d < 30) return g.position === foes.r ? 'look' : stepToward(g, foes.r);
  const girl = nearest(g, (r) => g.here(NATIVE, r));
  if (girl && rest >= 90) return g.position === girl.r ? 'love girl' : stepToward(g, girl.r);
  if (foes) return stepToward(g, foes.r);
  if (rest < 75) return g.position === SAFE_BED ? 'sleep' : stepToward(g, SAFE_BED);
  if (girl && rest >= 85) return g.position === girl.r ? 'love girl' : stepToward(g, girl.r);
  return pace(g);
}, 'Hunt elves and woodsmen with the laser (2 Power each) and visit the native girl while rested; sleep only in the bedroom (218).'];

const FINALE_FULL = [
  ['fn', (g) => (g.has(RING) ? 'give ring to goddess' : null), 'The ring: Ego +6.'],
  ['fn', (g) => (g.pleasure < TARGET.pleasure ? 'kiss goddess' : null), 'Kisses cost no time: Pleasure +1 each.'],
  ['fn', (g) => {
    if (MELEE.some((o) => g.has(o))) return null;
    for (const o of ['halberd', 'mace', 'shovel']) if (g.here(C[o.toUpperCase()])) return `take ${o}`;
    const at = nearest(g, (r) => g.here(HALBERD, r) || g.here(MACE, r) || g.here(SHOVEL, r));
    return at ? stepToward(g, at.r) : null;
  }, 'A blade for the last blow.'],
  ['cmd', 'kill goddess', 'With a blade: Power +5 and no Ego lost (the laser would cost 10 Ego).'],
];

export const ROUTES = {
  fastest: OPENING,
  full: [
    ...OPENING,
    ['fn', (g) => (g.holds(TALISMAN) && g.holds(AMULET) ? null : PLANNER)],
    HUNT,
    ['fn', (g) => (g.wintime ? null : PLANNER)],
    ...FINALE_FULL,
  ],
};

/**
 * Plays a route with piped-input semantics (the dogfight is left with `q`).
 * @returns {{input: string[], rows: object[], won: boolean, g: Battlestar, stuck?: string}}
 */
export function playRoute(seed, name, { maxSteps = 3000 } = {}) {
  const steps = ROUTES[name];
  const g = new Battlestar({ seed, flightMode: 'stdin' });
  let r = g.start();
  const input = [];
  const rows = [];
  let i = 0;
  let last = { sig: '', n: 0 };
  for (let n = 0; !r.ended && n < maxSteps; n++) {
    let cmd = null;
    let why = '';
    let kind = 'route';
    let goal = '';
    if (g.flightSim) { cmd = 'q'; why = 'Break off the dogfight.'; kind = 'dogfight'; }
    else if (g.inFight) { const h = routeFight(g); cmd = h.cmd; why = h.why; kind = 'fight'; }
    else if ((g.carrying > g.WEIGHT || g.encumber > g.CUMBER) && !g.notes[LAUNCHED]) {
      const h = nextHint(g, r.request); cmd = h.cmd; why = h.why; kind = 'planner'; goal = h.goal;
    } else {
      while (i < steps.length && cmd === null) {
        const s = steps[i];
        if (s[0] === 'go') {
          if (g.position === s[1]) { i++; continue; }
          cmd = stepToward(g, s[1]);
          if (!cmd) return { input, rows, won: false, g, stuck: `no route to ${s[1]}` };
          why = s[2];
        } else if (s[0] === 'cmd') { cmd = s[1]; why = s[2]; i++; }
        else {
          const c = s[1](g);
          if (c === PLANNER) { const h = nextHint(g, r.request); cmd = h.cmd; why = h.why; kind = 'planner'; goal = h.goal; if (!cmd) return { input, rows, won: false, g, stuck: h.why }; }
          else if (c) { cmd = c; why = s[2] || ''; }
          else i++;
        }
      }
      if (cmd === null) {
        const h = nextHint(g, r.request);
        cmd = h.cmd; why = h.why; kind = 'planner'; goal = h.goal;
        if (!cmd) return { input, rows, won: false, g, stuck: h.why };
      }
    }
    const sig = `${cmd}|${g.ourtime}|${g.position}|${g.pleasure}|${g.power}|${g.ego}`;
    last = last.sig === sig ? { sig, n: last.n + 1 } : { sig, n: 1 };
    if (last.n > 6) return { input, rows, won: false, g, stuck: `loop: ${cmd}` };
    const from = g.position;
    input.push(cmd);
    r = g.send(cmd);
    rows.push({ cmd, why, kind, goal, step: i, from, room: g.position, t: g.ourtime, night: g.isNight, pleasure: g.pleasure, power: g.power, ego: g.ego });
  }
  return { input, rows, won: r.endKind === 'won', endKind: r.endKind, g };
}
