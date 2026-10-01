// The scene composer: engine state -> RoomSpec (pure data, no DOM, no GL).
//
// Every room is classified from its own data -- name, description words,
// `flyhere`, and the OUTSIDE rule -- never from room-number ranges (the
// canonical ranges are wrong, see docs/notes.md 2.1). The renderer turns a
// RoomSpec into a Three.js scene with one kit per biome (ADR-009).

import { C, DAYFILE, NIGHTFILE, OBJFLAGS, testbit } from '../engine/battlestar.js';

export const BIOMES = ['ship', 'space', 'air', 'coast', 'forest', 'cave'];

// ------------------------------------------------------------------ places

/** Battlestar interior archetypes (rooms 1-31). */
const SHIP = {
  1: 'hangar', 2: 'landing-bay', 3: 'gallery', 4: 'control', 5: 'launch-room', 6: 'workbench', 7: 'launch-tube',
  8: 'closet', 9: 'hallway-battle', 10: 'hallway-wounded', 11: 'rubble', 12: 'junction', 13: 'stateroom-slain',
  14: 'sickbay-entry', 15: 'walkway', 16: 'parlor', 17: 'hallway-dim', 18: 'sickbay', 19: 'armory',
  20: 'presidential-door', 21: 'maid-room', 22: 'stateroom', 23: 'dining-stairs', 24: 'lounge', 25: 'stairwell',
  26: 'magazine', 27: 'presidential-suite', 28: 'dining-hall', 29: 'debris', 30: 'kitchen', 31: 'arch',
};

/** Caves, sea cave, catacombs, mine and the volcanic caves. */
const CAVE = {
  160: 'sea-cave', 246: 'low-passage', 247: 'squeeze', 248: 'cathedral', 249: 'round-tunnel', 250: 'anteroom',
  251: 'blind-pool', 252: 'sloping-passage', 253: 'tiled-room', 254: 'mussel-end', 255: 'crawl', 256: 'supply-room',
  257: 'catacomb-entrance', 258: 'catacombs', 259: 'crawl-granite', 260: 'sepulcher', 261: 'shaft-top',
  262: 'ladder', 263: 'mine-flooded', 264: 'mine-blocked', 265: 'mine-crystals', 266: 'mine-vein',
  230: 'steam-cave', 231: 'steam-door', 267: 'steam-cave', 268: 'throne', 269: 'abyss', 270: 'abyss', 271: 'abyss',
  272: 'abyss-shelf', 273: 'crystal-tunnel', 274: 'hot-tunnel', 275: 'pit',
};

/** Air rooms: the cockpit over the island. Keys are name fragments. */
const AIR = [
  ['dense fog', 'fog'], ['sea of fog', 'fog'], ['approaching an island', 'approach'], ['mountainous', 'mountains'],
  ['over the ocean', 'ocean'], ['over the beach', 'beach'], ['large lagoon', 'lagoon'], ['sloping plane', 'plain'],
  ['gorge', 'gorge'], ['plantation', 'plantation'], ['along the coast', 'coast'], ['fishing village', 'village'],
  ['clearing', 'clearing'], ['over the shore', 'shore'], ['near the shore', 'shore'], ['wide valley', 'valley'],
  ['tip of the island', 'tip'], ['coastline', 'coast'], ['cottages', 'cottages'], ['crest of a mountain', 'crest'],
  ['wide beach', 'wide-beach'],
];

/**
 * Ground rooms: ordered [regex on the room name, biome, place]. First match wins;
 * 'road' and 'path' rooms are resolved afterwards from their words and neighbours.
 */
const GROUND = [
  [/coral beach|sandy beach|almost 10 meters wide/, 'coast', 'beach-wide'],
  [/pretty rocky|impassable|lousy beach|This is a beach\?/, 'coast', 'beach-rocky'],
  [/narrow strip of sand|walking along the beach/, 'coast', 'beach'],
  [/palm trees near the shore/, 'coast', 'beach-palms'],
  [/in the dunes/, 'coast', 'dunes'],
  [/tide pools/, 'coast', 'tidepools'],
  [/at the shore|along the shore/, 'coast', 'shore-cliff'],
  [/high cliffs|turn around/, 'coast', 'cliff-lookout'],
  [/drowning/, 'coast', 'drowning'],
  [/mouth of the lagoon/, 'coast', 'lagoon-mouth'],
  [/at the lagoon|inland finger|around the lagoon|crosses the lagoon/, 'coast', 'lagoon'],
  [/plane dock|seaplane dock/, 'coast', 'dock'],
  [/main street of the village/, 'coast', 'village'],
  [/front porch/, 'coast', 'porch'],
  [/living room|in the kitchen|in the bedroom|drawing room/, 'coast', 'house'],
  [/front lawn/, 'coast', 'lawn-fountain'],
  [/tables on the lawn/, 'coast', 'party-lawn'],
  [/nosing around in the bushes/, 'coast', 'bushes'],
  [/stone walk in the garden|in the gardens/, 'coast', 'gardens'],
  [/clubhouse/, 'coast', 'clubhouse'],
  [/stables/, 'coast', 'stables'],
  [/old garage/, 'coast', 'garage'],
  [/several large buildings/, 'coast', 'estate'],
  [/papaya grove|grove of mango|breadfruit grove/, 'coast', 'orchard'],
  [/field of pineapple|kiwi|sugar cane/, 'coast', 'field'],
  [/field of small shrubs|sparse ferns|walking through some ferns/, 'coast', 'fern-field'],
  [/coconut|palm grove/, 'coast', 'grove'],
  [/thermal pools/, 'forest', 'pools'],
  [/entrance to a cave/, 'forest', 'cave-mouth'],
  [/plummets over a cliff/, 'forest', 'falls'],
  [/bank of a stream/, 'forest', 'stream'],
  [/dry stream bed|gravel wash|along the wash/, 'forest', 'wash'],
  [/Fern Canyon|narrow canyon|canyon is much wider|no wider than a foot|narrow part of the canyon/, 'forest', 'canyon'],
  [/edge of a huge chasm/, 'forest', 'chasm'],
  [/copse|hidden thicket|secret nook/, 'forest', 'thicket'],
  [/small clearing/, 'forest', 'clearing'],
  [/trail is lost|dirt trail/, 'forest', 'trail'],
  [/woods|forest|fork in the road|deeper into the trees/, 'forest', 'woods'],
  [/coast road/, 'coast', 'coast-road'],
];

const FEATURE_WORDS = [
  ['palm', 'palms'], ['fern', 'ferns'], ['surf', 'surf'], ['waterfall', 'waterfall'], ['falls', 'waterfall'],
  ['fountain', 'fountain'], ['goldfish', 'pond'], ['steam', 'steam'], ['fumarole', 'steam'], ['crystal', 'crystals'],
  ['gold', 'gold'], ['tomb', 'tombs'], ['ladder', 'ladder'], ['bridge', 'bridge'], ['canoe', 'canoes'],
  ['tables', 'tables'], ['fire pit', 'firepit'], ['sign', 'sign'], ['stone door', 'stone-door'],
  ['door', 'door'], ['staircase', 'stairs'], ['stairs', 'stairs'], ['window', 'window'], ['corpse', 'corpses'],
  ['fires', 'fires'], ['fighters', 'fighters'], ['technicians', 'technicians'], ['guards', 'guards'],
  ['nurses', 'nurses'], ['ambassadors', 'ambassadors'], ['chef', 'chef'], ['scorched figure', 'president'],
  ['rubble', 'rubble'], ['debris', 'rubble'], ['girders', 'rubble'], ['fog', 'fog'], ['mist', 'mist'],
  ['shells', 'shells'], ['rocks', 'rocks'], ['lava', 'lava'], ['coral', 'coral'], ['sedges', 'sedges'],
  ['thorn', 'thorns'], ['berr', 'berries'], ['vine', 'vines'], ['cliff', 'cliffs'], ['dune', 'dunes'],
  ['tire tracks', 'tracks'], ['bell tower', 'belltower'], ['torchlight', 'torches'], ['drums', 'drums'],
  ['luau', 'luau'], ['dancers', 'dancers'], ['moon', 'moon'], ['starscape', 'stars'], ['stars', 'stars'],
  ['stream', 'stream'], ['pool', 'pools'], ['water', 'water'], ['lagoon', 'lagoon'], ['ocean', 'ocean'],
  ['sea', 'sea'], ['grass', 'grass'], ['lawn', 'grass'], ['flowers', 'flowers'], ['bench', 'benches'],
  ['huckleberr', 'berries'], ['coniferous', 'conifers'], ['pine', 'conifers'], ['mussels', 'mussels'],
  ['algae', 'algae'], ['seaweed', 'seaweed'], ['mosaic', 'mosaic'], ['tiles', 'mosaic'], ['dynamite', 'dynamite'],
  ['ore', 'ore'], ['shrimp', 'shrimp'], ['abyss', 'abyss'], ['throne', 'throne'], ['bed', 'bed'],
  ['bar ', 'bar'], ['hay', 'hay'], ['horses', 'horses'], ['Volare', 'car'], ['fowl', 'fowl'], ['chicken', 'fowl'],
  ['beer cans', 'litter'], ['stove', 'stove'], ['couch', 'couch'], ['telephone', 'desk'], ['dresser', 'dresser'],
  ['sickbay', 'beds'], ['needles', 'beds'], ['ammunition', 'ammo'], ['weapons locker', 'locker'],
  ['cargo craft', 'fighters'], ['tools', 'tools'], ['wardrobe', 'wardrobe'], ['furs', 'wardrobe'],
  ['cereal', 'banquet'], ['cookware', 'cookware'], ['platter', 'cookware'], ['incinerator', 'incinerator'],
  ['bucket', 'bucket'], ['blood', 'blood'], ['sparkle', 'sparkle'], ['geyser', 'geysers'], ['hot', 'heat'],
  ['precipice', 'precipice'], ['stench', 'stench'], ['cobblestones', 'cobbles'], ['gravel', 'gravel'],
  ['boulders', 'boulders'], ['lookout', 'lookout'], ['kilometers of blue sea', 'vista'],
];

function wordsOf(file, n) {
  return `${file[n].name} ${file[n].desc}`;
}

/** Static classification of a room: { biome, place, air }. */
export function classify(n) {
  const d = DAYFILE[n];
  if (n <= 31) return { biome: 'ship', place: SHIP[n] };
  if (n <= 66) return { biome: 'space', place: 'space' };
  if (n === 67) return { biome: 'space', place: 'orbit-blue' };
  if (n === 68) return { biome: 'space', place: 'orbit-tropical' };
  if (d.link[7]) {
    const hit = AIR.find(([frag]) => d.name.includes(frag));
    return { biome: 'air', place: hit ? hit[1] : 'coast' };
  }
  if (CAVE[n]) return { biome: 'cave', place: CAVE[n] };
  for (const [re, biome, place] of GROUND) if (re.test(d.name)) return { biome, place };
  return { biome: null, place: /road|path/.test(d.name) ? 'road' : 'misc' };
}

// Resolve roads and paths by their own words, then by neighbours.
const CLASS = new Array(276).fill(null);
for (let n = 1; n <= 275; n++) CLASS[n] = classify(n);
for (let pass = 0; pass < 4; pass++) {
  for (let n = 1; n <= 275; n++) {
    if (CLASS[n].biome) continue;
    const text = wordsOf(DAYFILE, n);
    if (/coconut|palm|lagoon|village|grove|garden/.test(text)) { CLASS[n] = { biome: 'coast', place: 'road' }; continue; }
    if (/forest|trees|woods|foliage|canopy/.test(text)) { CLASS[n] = { biome: 'forest', place: 'road' }; continue; }
    const votes = { coast: 0, forest: 0 };
    for (const i of [0, 1, 2, 3]) {
      const m = DAYFILE[n].link[i];
      const b = m && CLASS[m] && CLASS[m].biome;
      if (b === 'coast' || b === 'forest') votes[b]++;
    }
    if (votes.coast || votes.forest || pass === 3) {
      CLASS[n] = { biome: votes.forest > votes.coast ? 'forest' : 'coast', place: 'road' };
    }
  }
}
export const ROOM_CLASS = CLASS;

/** Feature tags found in a description (both day and night texts). */
export function features(n, night) {
  const text = wordsOf(night ? NIGHTFILE : DAYFILE, n);
  const out = new Set();
  for (const [w, tag] of FEATURE_WORDS) if (text.includes(w)) out.add(tag);
  return out;
}

// ------------------------------------------------------------------ landmarks

// Words that name what lies in a direction ("The ocean is +", "a road +").
const LANDMARK_WORDS = [
  ['ocean', 'sea'], ['sea', 'sea'], ['surf', 'sea'], ['waves', 'sea'], ['water', 'water'], ['lagoon', 'lagoon'],
  ['beach', 'beach'], ['sand', 'beach'], ['shore', 'beach'], ['dunes', 'dunes'], ['rocks', 'rocks'],
  ['cliff', 'cliff'], ['forest', 'forest'], ['woods', 'forest'], ['trees', 'forest'], ['thicket', 'forest'],
  ['ferns', 'ferns'], ['vines', 'forest'], ['palm', 'grove'], ['grove', 'grove'], ['coconut', 'grove'],
  ['plantation', 'grove'], ['field', 'field'], ['pineapple', 'field'], ['road', 'road'], ['driveway', 'road'],
  ['path', 'path'], ['trail', 'path'], ['walk', 'path'], ['steps', 'path'], ['village', 'village'],
  ['house', 'house'], ['bungalow', 'house'], ['cottage', 'house'], ['buildings', 'house'], ['clubhouse', 'house'],
  ['barn', 'house'], ['stable', 'house'], ['garage', 'house'], ['door', 'door'], ['lawn', 'lawn'],
  ['gardens', 'gardens'], ['fountain', 'lawn'], ['clearing', 'clearing'], ['pools', 'pools'], ['stream', 'stream'],
  ['falls', 'falls'], ['waterfall', 'falls'], ['cave', 'cave'], ['canyon', 'canyon'], ['bridge', 'bridge'],
  ['dock', 'dock'], ['land rises', 'hills'], ['mountains', 'hills'], ['crest', 'hills'], ['wash', 'stream'],
  ['bed', 'bed'], ['living room', 'room'], ['bedroom', 'room'], ['kitchen', 'room'], ['study', 'room'],
];

/**
 * What the description says lies in each compass slot. Returns
 * { 1010: [...], 1011: [...], 1012: [...], 1013: [...] } keyed by NORTH..WEST.
 */
export function landmarks(n, night) {
  const desc = (night ? NIGHTFILE : DAYFILE)[n].desc;
  const out = { [C.NORTH]: [], [C.SOUTH]: [], [C.EAST]: [], [C.WEST]: [] };
  let slot = C.NORTH;
  let clause = '';
  let prev = [];
  for (const ch of desc) {
    if (ch === '+' || ch === '-' || ch === '*') {
      if (ch !== '*') {
        const c = clause.toLowerCase().replace(/\s+/g, ' ').trim();
        let hits;
        if (/^(,|and|or|, and|, or|,)?$/.test(c)) hits = prev; // "The road continues - and -."
        else {
          const tail = c.split(' ').slice(-6).join(' ');
          const set = new Set();
          for (const [w, k] of LANDMARK_WORDS) if (tail.includes(w)) set.add(k);
          hits = [...set];
        }
        out[slot] = hits;
        prev = hits;
      }
      slot++;
      clause = '';
    } else if (ch === '.' || ch === '!' || ch === '?') { clause = ''; prev = []; } else clause += ch;
  }
  return out;
}

/**
 * Surroundings relative to the facing: for ahead/right/back/left, the exit (if
 * any), the neighbour's biome and place, and the text's landmarks.
 */
export function surroundings(g, n = g.position) {
  const l = g.location[n].link;
  const abs = [C.NORTH, C.EAST, C.SOUTH, C.WEST];
  const linkIndex = { [C.NORTH]: 0, [C.SOUTH]: 1, [C.EAST]: 2, [C.WEST]: 3 };
  const k = abs.indexOf(g.direction);
  const marks = landmarks(n, g.isNight);
  const out = {};
  ['ahead', 'right', 'back', 'left'].forEach((rel, i) => {
    const a = abs[(k + i) % 4];
    const to = l[linkIndex[a]];
    const nb = to && to !== n ? ROOM_CLASS[to] : null;
    out[rel] = { exit: to && to !== n ? to : 0, loop: to === n, biome: nb?.biome ?? null, place: nb?.place ?? null, marks: marks[a] };
  });
  return out;
}

// ------------------------------------------------------------------ objects -> props

const PERSON = new Set([C.WOODSMAN, C.BATHGOD, C.NORMGOD, C.ELF, C.MAN, C.GIRL, C.GIRLTALK, C.DARK, C.TIMER,
  C.NATIVE]);
const BODIES = new Set([C.MAID, C.DEADWOOD, C.DEADGOD, C.DEADTIME, C.DEADNATIVE]);

/** Props: objects lying in the room, excluding pure markers. */
export function roomProps(g, n) {
  const props = [];
  const people = [];
  for (const o of g.objectsIn(n)) {
    if (o === C.LAND) continue;
    if (PERSON.has(o)) people.push(o);
    else props.push({ obj: o, body: BODIES.has(o), plural: !!(OBJFLAGS[o] & 1) });
  }
  return { props, people };
}

// ------------------------------------------------------------------ spec

const REL = ['ahead', 'right', 'back', 'left'];

/** Exits relative to the current facing (what the player will type). */
export function relativeExits(g, n = g.position) {
  const l = g.location[n].link;
  const abs = { [C.NORTH]: l[0], [C.EAST]: l[2], [C.SOUTH]: l[1], [C.WEST]: l[3] };
  const order = [C.NORTH, C.EAST, C.SOUTH, C.WEST];
  const k = order.indexOf(g.direction);
  const out = {};
  for (let i = 0; i < 4; i++) out[REL[i]] = abs[order[(k + i) % 4]] || 0;
  out.up = (l[5] || g.wiz || g.tempwiz) ? l[4] : 0;
  out.down = l[6];
  return out;
}

/** Engine state -> RoomSpec. */
export function composeRoom(g) {
  const n = g.position;
  const night = g.isNight;
  const cls = ROOM_CLASS[n] || { biome: 'coast', place: 'misc' };
  const file = night ? NIGHTFILE : DAYFILE;
  const { props, people } = roomProps(g, n);
  const seen = g.canSee();
  const phase = Math.max(0, Math.min(1, ((g.ourtime - g.rythmn) % 100) / 100));
  const inj = g.card(g.injuries, 13);
  return {
    room: n,
    name: file[n].name,
    night,
    biome: cls.biome,
    place: cls.place,
    features: [...features(n, night)],
    facing: g.direction,
    exits: relativeExits(g),
    around: surroundings(g),
    flying: !!g.notes[C.LAUNCHED],
    light: {
      night,
      phase, // 0 = just after sunrise/sunset, 1 = the end of the half-cycle
      dark: !seen,
      cantsee: !!g.notes[C.CANTSEE], // the room itself is unlit (caves)
      lanternHeld: g.has(C.LAMPON),
      lantern: g.has(C.LAMPON) || g.here(C.LAMPON),
      match: !!g.matchlight,
      outside: g.OUTSIDE,
      // Battlestar countdown: 0 at launch of the game, 1 when the hull breaks (turn 30).
      alert: n <= 31 ? Math.min(1, g.ourtime / 30) : 0,
      explosions: n <= 31 && g.ourtime > 20,
    },
    props: seen ? props : props.filter((p) => p.obj === C.LAMPON),
    people: seen ? people : people.filter((o) => o === C.DARK),
    status: {
      injuries: inj,
      fatal: (g.injuries[C.SKULL] ? 1 : 0) + (g.injuries[C.INCISE] ? 1 : 0) + (g.injuries[C.NECK] ? 1 : 0),
      tired: Math.max(0, Math.min(1, 1 - (g.snooze - g.ourtime) / 30)),
      hungry: g.ourtime > g.ate,
      wizard: !!(g.wiz || g.tempwiz),
      overloaded: g.carrying > g.WEIGHT || g.encumber > g.CUMBER,
    },
    flight: { fuel: g.fuel, torps: g.torps, clock: g.ourclock, time: g.ourtime },
    seed: (n * 2654435761 + (night ? 97 : 0)) >>> 0,
  };
}

/** A stable signature of how a room will look, for the sameness budget test. */
export function signature(spec) {
  return [spec.biome, spec.place, spec.features.slice().sort().join('+'),
    Object.values(spec.exits).map((e) => (e ? 1 : 0)).join(''), spec.seed % 7].join('|');
}

export { testbit };
