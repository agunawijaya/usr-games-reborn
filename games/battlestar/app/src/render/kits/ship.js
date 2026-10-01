// Biome 1 — the battlestar interior (rooms 1-31).
// Composed from data: a place table (shell size and style) plus set dressing
// chosen by the room's own description features. Doorways sit where the room
// really has exits (relative to the facing). Lighting follows the countdown to
// the hull breach (spec.light.alert: 0 at turn 0, 1 at turn 30).

import * as THREE from 'three';
import { mat, glowMat } from '../materials.js';
import { rng, box, cyl, mesh, shell, stairs, scatter } from '../geo.js';
import { particles, glowSprite } from '../fx.js';
import { makeViper } from '../craft.js';
import { crowd } from '../people.js';
import { palette, stateroomSet, roomTrim, windowFrame, consoleBezel, stairMats, parlorSet, chandelier, sofa, sideTable } from '../furnish.js';
import { stairCore, stairway, steelMats, steelFlight, railing, rod, lining, stub } from '../stairs.js';
import { rbox, latheGeo, cushionGeo, blobGeo } from '../model.js';
import { poseOf } from '../humans.js';
import {
  SM, workstation, lockers, crate, weaponRack, launchHatch, catwalk, landingStrut, beacon, ventPipe, lightFitting,
  workbench, hospitalBed, ivStand, incinerator, galley, banquetTable, diningChair, wardrobe, magnesiumDoor, boltedDoor,
  bulkheadFrame, blastGash, jaggedHole, holeEdge, strewnClothes, mopBucket, utilityShelf, sprocketRocket, ottoman,
  mirror, lockedDoor, archway, swingLeaves, slideLeaves, conduits, wreckage,
} from '../shipfit.js';
import { NOISE } from '../glsl.js';

// ---------------------------------------------------------------- materials
const M = {
  mil: () => mat('panel', { c1: 0x4d5866, c2: 0x12161b, c3: 0xffa45a, p: [1.25, 0.07, 2.75, 0], q: [0.55, 0, 0, 0], seed: 1 }),
  milScorched: () => mat('panel', { c1: 0x4d5866, c2: 0x12161b, c3: 0xff7a3a, p: [1.25, 0.07, 2.75, 0.75], q: [0.8, 0, 0, 0], seed: 2 }),
  milCeil: () => mat('panel', { c1: 0x2c323a, c2: 0x0b0d10, c3: 0xffe0b0, p: [1.6, 0, 0, 0], q: [0.3, 0, 0, 0], seed: 3 }),
  deck: () => mat('grate', { c1: 0x4a5058, c2: 0x101215, c3: 0xff6a30, p: [0.4, 0.03, 0, 0] }),
  deckPlate: () => mat('panel', { c1: 0x3a3f45, c2: 0x0e1012, c3: 0xffd060, p: [2.5, 0, 0, 0.15], q: [0.7, 0, 0, 0], seed: 4 }),
  lux: () => mat('paneling', { c1: 0x6a3319, c2: 0x33160a, c3: 0xdfe3ea, p: [1.1, 1.25, 0.12, 0.95], seed: 7 }),
  luxGold: () => mat('paneling', { c1: 0x46200e, c2: 0x1c0b05, c3: 0xffc24a, p: [0.9, 1.1, 0.1, 1.0], seed: 8 }),
  furniture: () => mat('wood', { c1: 0x7a3e1c, c2: 0x3e1c0c, c3: 0xdfe3ea, p: [1.6, 3.0, 0.015, 0] }),
  fur: () => mat('carpet', { c1: 0xe0d2bc, c2: 0xb9a78c, c3: 0xffffff, p: [70, 0.35, 0, 0] }),
  velvet: () => mat('carpet', { c1: 0x4a0c14, c2: 0x2a060c, c3: 0xd8a840, p: [80, 0.45, 0, 0] }),
  plasterGold: () => mat('plaster', { c1: 0xe6d6bc, c2: 0x5a2c16, c3: 0xd8a840, p: [1.0, 2.9, 0, 0] }),
  med: () => mat('panel', { c1: 0xc9d6d4, c2: 0x5d6b6a, c3: 0x9affe8, p: [1.0, 0.05, 2.6, 0], q: [0.25, 0, 0, 0], seed: 5 }),
  medFloor: () => mat('tile', { c1: 0xbfcac8, c2: 0xaab6b4, c3: 0xd0dad8, p: [0.6, 0.02, 0.3, 0] }),
  steel: () => mat('metal', { c1: 0xd6dbe0, c2: 0x7a8088, p: [0.2, 0.15, 0, 0] }),
  galley: () => mat('panel', { c1: 0xb8c0c8, c2: 0x3a4048, c3: 0xfff0d8, p: [0.8, 0.05, 2.5, 0], q: [0.2, 0, 0, 0], seed: 14 }),
  bronze: () => mat('metal', { c1: 0xc8864a, c2: 0x5a3a1a, p: [0.25, 0.3, 0, 0] }),
  ivory: () => mat('metal', { c1: 0xf2ead8, c2: 0xc8b898, p: [0.35, 0.1, 0, 0] }),
  ebony: () => mat('wood', { c1: 0x1a1210, c2: 0x0a0605, c3: 0xffc24a, p: [4, 0, 0, 0] }),
  coral: () => mat('stone', { c1: 0xe0705a, c2: 0xb04a3a, p: [3, 0, 0, 0] }),
  crate: () => mat('panel', { c1: 0x5a6a3a, c2: 0x1a2010, c3: 0xffffff, p: [0.6, 0, 0, 0.1], q: [0.4, 0, 0, 0], seed: 6 }),
  dark: () => mat('metal', { c1: 0x22262b, c2: 0x0b0c0e, p: [0.45, 0.3, 0, 0] }),
  blood: () => mat('metal', { c1: 0x3a0404, c2: 0x1a0202, p: [0.08, 0, 0, 0] }),
};

// ---------------------------------------------------------------- places
// style: mil (military grey), lux (luxury wood and fur), med (sick bay), galley.
const PLACES = {
  hangar: { w: 30, d: 34, h: 13, style: 'mil', floor: 'plate', fighters: 4, catwalk: true, crates: 10, crowd: ['pilots', 5] },
  'landing-bay': { w: 26, d: 22, h: 11, style: 'mil', floor: 'plate', bayDoor: true, fighters: 2, crowd: ['wounded', 3], wreck: true },
  gallery: { w: 16, d: 5, h: 4, style: 'mil', floor: 'deck', overlook: true, noFarWall: true },
  control: { w: 12, d: 11, h: 4.2, style: 'mil', floor: 'deck', consoles: 6, crowd: ['technicians', 4], locker: true, stair: true, drop: 5.85 },
  'launch-room': { w: 16, d: 14, h: 5.5, style: 'mil', floor: 'plate', tubes: 3, crowd: ['guards', 2], stair: true },
  workbench: { w: 8, d: 7, h: 3.6, style: 'mil', floor: 'deck', bench: true },
  'launch-tube': { w: 7, d: 22, h: 7, style: 'mil', floor: 'plate', tube: true, crowd: ['guards', 2] },
  closet: { w: 5, d: 6, h: 3.2, style: 'lux', floor: 'velvet', wardrobe: true },
  'hallway-battle': { w: 4, d: 18, h: 3.4, style: 'milScorched', floor: 'deck', corpses: 4, sparks: true, holes: true },
  'hallway-wounded': { w: 4, d: 18, h: 3.4, style: 'mil', floor: 'deck', crowd: ['wounded', 5], blood: true },
  rubble: { w: 4.5, d: 12, h: 3.6, style: 'milScorched', floor: 'deck', rubble: 14, ceilingHole: true, sparks: true },
  junction: { w: 10, d: 10, h: 3.6, style: 'mil', floor: 'deck', crowd: ['wounded', 6] },
  'stateroom-slain': { w: 9, d: 9, h: 3.4, style: 'lux', floor: 'fur', bed: true, clutter: 12, floorHole: true },
  'sickbay-entry': { w: 4.5, d: 14, h: 3.4, style: 'med', floor: 'med', crowd: ['wounded', 5] },
  walkway: { w: 3, d: 16, h: 3.2, style: 'mil', floor: 'deck' },
  parlor: { w: 12, d: 12, h: 4.5, style: 'lux', floor: 'velvet', grandStairs: 'ivory', chandelier: true },
  'hallway-dim': { w: 3.5, d: 16, h: 3.2, style: 'mil', floor: 'deck', dim: true },
  sickbay: { w: 12, d: 12, h: 3.6, style: 'med', floor: 'med', beds: 6, crowd: ['nurses', 3], incinerator: true },
  armory: { w: 9, d: 10, h: 3.8, style: 'mil', floor: 'plate', racks: 4, crowd: ['guards', 1] },
  'presidential-door': { w: 5, d: 10, h: 3.8, style: 'lux', floor: 'velvet', magnesiumDoor: true },
  'maid-room': { w: 5, d: 5, h: 3, style: 'mil', floor: 'deck', bucket: true },
  stateroom: { w: 10, d: 9, h: 3.4, style: 'lux', floor: 'fur', bed: true, spaceWindow: true, gadgets: true },
  'dining-stairs': { w: 10, d: 10, h: 4.5, style: 'lux', floor: 'velvet', grandStairs: 'ebony', chandelier: true },
  lounge: { w: 12, d: 11, h: 4, style: 'luxGold', floor: 'velvet', rubble: 8, grandStairs: 'coral', sparks: true },
  stairwell: { w: 3.5, d: 7.5, h: 6, style: 'mil', floor: 'deck', steepStairs: true, dust: true, stair: true, stairOrder: ['centre', 'right', 'left'] },
  magazine: { w: 10, d: 12, h: 3.6, style: 'mil', floor: 'plate', ammo: true },
  'presidential-suite': { w: 12, d: 11, h: 4, style: 'luxGold', floor: 'velvet', bed: true, crowd: ['corpses', 1], chandelier: true, corpseSpot: [0.1, -0.05, -2.4] },
  'dining-hall': { w: 14, d: 18, h: 4.5, style: 'luxGold', floor: 'velvet', banquet: true, crowd: ['ambassadors', 14], chill: true, chandelier: true },
  debris: { w: 5, d: 10, h: 3.6, style: 'milScorched', floor: 'deck', rubble: 18, sparks: true },
  kitchen: { w: 9, d: 9, h: 3.4, style: 'galley', floor: 'med', counters: true, crowd: ['corpses', 1], woodDoor: true, corpseSpot: [0.15, 0.08, Math.PI / 2] },
  arch: { w: 6, d: 6, h: 4.5, style: 'luxGold', floor: 'velvet', archway: true, boltedDoor: true },
};

function wallMat(style) {
  return { mil: M.mil, milScorched: M.milScorched, lux: M.lux, luxGold: M.luxGold, med: M.med, galley: M.galley }[style]();
}
function floorMat(kind) {
  return { deck: M.deck, plate: M.deckPlate, fur: M.fur, velvet: M.velvet, med: M.medFloor }[kind]();
}

// ---------------------------------------------------------------- set pieces

const HOLO = /* glsl */ `
uniform float uTime; uniform vec3 uCol; uniform float uSeed; varying vec2 vUv;
${NOISE}
void main() {
  vec2 uv = vUv;
  float scan = 0.55 + 0.45 * sin(uv.y * 180.0 - uTime * 6.0);
  float grid = step(0.96, fract(uv.x * 12.0)) + step(0.96, fract(uv.y * 8.0));
  float bars = step(uv.y * 1.2, bs_noise2(vec2(floor(uv.x * 14.0) + uSeed, floor(uTime * 3.0))) * 0.9) * step(0.55, uv.x);
  float wave = 1.0 - smoothstep(0.0, 0.02, abs(uv.y - 0.7 - 0.12 * sin(uv.x * 20.0 + uTime * 3.0 + uSeed)));
  float ring = 1.0 - smoothstep(0.0, 0.015, abs(length((uv - vec2(0.25, 0.35)) * vec2(1.4, 1.0)) - 0.16 - 0.02 * sin(uTime * 2.0)));
  float edge = 1.0 - smoothstep(0.0, 0.03, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
  float a = (0.08 + grid * 0.25 + bars * 0.6 + wave + ring + edge * 0.8) * scan;
  float flick = 0.85 + 0.15 * step(0.1, fract(sin(floor(uTime * 12.0) * 91.3 + uSeed) * 4375.5));
  gl_FragColor = vec4(uCol * a * flick * 1.6, 1.0);
}`;

function holoPanel(w, h, color, seed) {
  const m = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: HOLO,
    uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(color) }, uSeed: { value: seed } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const q = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  q.userData.tick = (t) => { m.uniforms.uTime.value = t; };
  return q;
}

function console_(r, color) {
  const g = new THREE.Group();
  g.add(box(1.6, 0.9, 0.7, M.dark(), { pos: [0, 0.45, 0] }));
  g.add(box(1.6, 0.06, 0.8, M.steel(), { pos: [0, 0.92, -0.05], rot: [0.25, 0, 0] }));
  for (let i = 0; i < 10; i++) {
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.02, 0.05), glowMat([0xff4040, 0x40ff80, 0xffc040, 0x40c0ff][i % 4], 3), { pos: [-0.6 + i * 0.13, 0.96, 0.1] }));
  }
  const holo = holoPanel(1.4, 0.8, color, r.range(0, 10));
  holo.position.set(0, 1.55, -0.1);
  holo.rotation.x = -0.12;
  g.add(holo);
  g.userData.tick = holo.userData.tick;
  return g;
}

function spaceWindow(w, h, seed) {
  const m = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: /* glsl */ `uniform float uTime; uniform float uSeed; varying vec2 vUv;
      ${NOISE}
      void main() {
        vec2 p = vUv * vec2(3.0, 1.6);
        float n = bs_fbm2(p * 1.4 + uSeed);
        vec3 col = vec3(0.01, 0.012, 0.03) + vec3(0.3, 0.1, 0.45) * smoothstep(0.45, 0.9, n) * 0.5;
        float s = pow(bs_hash12(floor(vUv * vec2(420.0, 240.0))), 90.0) * 4.0;
        col += vec3(s);
        // distant battle: streaks and flashes
        float t = uTime * 0.6 + uSeed;
        for (int i = 0; i < 4; i++) {
          float fi = float(i);
          float ph = fract(t * 0.35 + fi * 0.27);
          vec2 a = vec2(bs_hash11(fi + floor(t * 0.35 + fi * 0.27)), 0.3 + 0.5 * bs_hash11(fi * 7.0 + floor(t * 0.35)));
          vec2 d = normalize(vec2(1.0, (bs_hash11(fi * 3.0) - 0.5) * 0.6));
          vec2 q = vUv - (a + d * ph * 0.6);
          float line = 1.0 - smoothstep(0.0, 0.0025, abs(q.x * d.y - q.y * d.x));
          float along = smoothstep(-0.05, 0.0, dot(q, d)) * (1.0 - smoothstep(0.0, 0.06, dot(q, d)));
          col += vec3(1.0, 0.3, 0.2) * line * along * 2.0;
        }
        float fl = pow(max(0.0, sin(uTime * 1.3 + uSeed * 3.0)), 60.0);
        col += vec3(1.0, 0.6, 0.3) * fl * smoothstep(0.35, 0.0, length(vUv - vec2(0.7, 0.55))) * 1.2;
        gl_FragColor = vec4(col, 1.0);
      }`,
    uniforms: { uTime: { value: 0 }, uSeed: { value: seed } },
  });
  const q = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  q.userData.tick = (t) => { m.uniforms.uTime.value = t; };
  return q;
}

function bed(r, luxury = true) {
  const g = new THREE.Group();
  g.add(box(2.2, 0.45, 2.4, M.furniture(), { pos: [0, 0.22, 0] }));
  g.add(box(2.24, 0.03, 2.44, mat('gold', { c1: 0xdfe3ea, c2: 0xffffff, p: [0.3, 0, 0, 0] }), { pos: [0, 0.3, 0] }));
  g.add(box(2.1, 0.25, 2.2, mat('cloth', { c1: luxury ? 0xf0e6d8 : 0xdde6e6, c2: luxury ? 0xc8b8a0 : 0xaab6b6, p: [2, 0, 0, 0] }), { pos: [0, 0.55, 0.05] }));
  g.add(box(2.3, 1.3, 0.15, M.luxGold(), { pos: [0, 0.65, -1.2] }));
  for (const s of [-0.5, 0.5]) g.add(box(0.7, 0.18, 0.45, mat('cloth', { c1: 0xf8f0e6, c2: 0xd8c8b8, p: [3, 0, 0, 0] }), { pos: [s, 0.75, -0.9] }));
  return g;
}

function girders(r, n, span) {
  const g = new THREE.Group();
  const m = M.milScorched();
  for (let i = 0; i < n; i++) {
    const len = r.range(1.5, 4.5);
    const b = box(0.25, 0.35, len, m, { pos: [r.range(-span, span), r.range(0.1, 1.4), r.range(-4, 3)] });
    b.rotation.set(r.range(-0.6, 0.6), r.range(0, Math.PI), r.range(-0.4, 0.4));
    g.add(b);
  }
  return g;
}

function fighterRow(r, n, w, d, modelled = false) {
  const g = new THREE.Group();
  g.userData.spots = [];
  for (let i = 0; i < n; i++) {
    const v = makeViper();
    v.scale.setScalar(0.9);
    const x = (i % 2 ? 1 : -1) * (w * 0.28 + r.range(-1, 1));
    const z = -d * 0.1 - Math.floor(i / 2) * 11 + r.range(-1, 1);
    g.userData.spots.push([x, z]);
    const ry = (i % 2 ? -1 : 1) * 0.5 + r.range(-0.2, 0.2);
    if (modelled) {
      // standing on its landing gear: two main struts under the wings, one at the nose
      const craft = new THREE.Group();
      craft.position.set(x, 0, z);
      craft.rotation.y = ry;
      v.position.set(0, 1.35, 0);
      craft.add(v);
      for (const [sx, sz] of [[-1.0, 0.9], [1.0, 0.9], [0, -1.9]]) {
        const s = landingStrut(0.95);
        s.position.set(sx, 0, sz);
        craft.add(s);
      }
      g.add(craft);
    } else {
      v.position.set(x, 1.35, z);
      v.rotation.y = ry;
      g.add(v);
      for (const dx of [-1.2, 1.2]) g.add(box(0.12, 1.2, 0.12, M.dark(), { pos: [x + dx * 0.6, 0.6, z] }));
    }
  }
  return g;
}

/** A dining chair for the banquet, facing `face` (the table). */
function banquetChair(x, z, face) {
  const c = new THREE.Group();
  const wood = M.ebony();
  const seat = mat('carpet', { c1: 0x4a0c14, c2: 0x2a060c, c3: 0xd8a840, p: [80, 0.45, 0, 0] });
  c.add(rbox(0.5, 0.08, 0.48, 0.02, seat, { pos: [0, 0.4, 0] }));
  c.add(rbox(0.46, 0.62, 0.05, 0.02, wood, { pos: [0, 0.48, -0.24] }));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c.add(rbox(0.04, 0.4, 0.04, 0.01, wood, { pos: [sx * 0.21, 0, sz * 0.2] }));
  c.position.set(x - Math.sin(face) * 0.05, 0, z - Math.cos(face) * 0.05);
  c.rotation.y = face;
  return c;
}

/**
 * Where the crew of a room works and walks: stations (with the task done
 * there), an aisle to walk along, how many of them move, and their gait.
 * Returns null for rooms where people are placed by hand.
 */
function crewWorld(role, place, P, { W, D, spots, alert, r }) {
  const st = (x, z, face, task, extra = {}) => ({ pos: [x, z], face, task, ...extra });
  if (role === 'technicians' && spots.consoles.length) {
    const stations = spots.consoles.map(([x, z, a]) => st(x + Math.sin(a) * -0.72, z + Math.cos(a) * 0.72, Math.PI - a, 'type'));
    // supervisors' spots in the middle of the room
    stations.push(st(-1.2, -D * 0.05, Math.PI * 0.9, 'tablet', { walkOnly: true, prop: 'tablet' }), st(1.4, 0.4, -Math.PI * 0.85, 'tablet', { walkOnly: true, prop: 'tablet' }));
    const aisle = [];
    for (let i = 0; i <= 6; i++) { const a = (i / 6 - 0.5) * 2.2; aisle.push([Math.sin(a) * W * 0.2, -D * 0.1 - Math.cos(a) * D * 0.12]); }
    return { world: { stations, aisle, dwell: [4, 9] }, walkers: 1, gait: alert > 0.4 ? 'hurry' : 'walk' };
  }
  if (role === 'pilots' && spots.fighters.length) {
    const stations = [];
    for (const [x, z] of spots.fighters) {
      const side = x > 0 ? -1 : 1;
      stations.push(st(x + side * 2.3, z + 0.6, side > 0 ? Math.PI / 2 : -Math.PI / 2, 'inspect'));
      stations.push(st(x + side * 1.6, z - 1.2, side > 0 ? Math.PI * 0.7 : -Math.PI * 0.7, 'kneel', { walkOnly: false }));
    }
    const aisle = [];
    for (let z = D / 2 - 3; z >= -D / 2 + 3; z -= 5) aisle.push([0, z]);
    return { world: { stations, aisle, dwell: [2.5, 6] }, walkers: 3, gait: alert > 0.2 ? 'jog' : 'walk' };
  }
  if (role === 'guards') {
    const stations = [st(-1.6, -D / 2 + 3, 0.25, 'guard'), st(1.6, -D / 2 + 3, -0.25, 'guard'), st(-1.6, D / 2 - 3, Math.PI - 0.2, 'guard'), st(1.6, D / 2 - 3, Math.PI + 0.2, 'guard')];
    return { world: { stations, aisle: [[0, D / 2 - 3], [0, -D / 2 + 3]], dwell: [6, 12] }, walkers: 0, gait: 'walk' };
  }
  if (role === 'nurses' && spots.beds.length) {
    const stations = spots.beds.map(([x, z]) => st(x - Math.sign(x) * 0.85, z, x > 0 ? Math.PI / 2 : -Math.PI / 2, 'tend'));
    const aisle = [];
    for (let z = D / 2 - 2; z >= -D / 2 + 2; z -= 2.8) aisle.push([0, z]);
    return { world: { stations, aisle, dwell: [4, 9] }, walkers: 2, gait: 'walk' };
  }
  if (role === 'wounded') {
    // along the walls, sitting or lying; one of them limps down the middle
    const stations = [];
    const n = 8;
    for (let i = 0; i < n; i++) {
      const s = i % 2 ? 1 : -1;
      const z = D / 2 - 2 - (i / n) * (D - 4) + r.range(-0.4, 0.4);
      const lie = i % 3 === 2;
      stations.push(lie
        ? st(s * (W / 2 - 0.55), z + 0.9, Math.PI, 'lie')
        : st(s * (W / 2 - 0.5), z, -s * Math.PI / 2, 'sitWall'));
    }
    stations.push(st(0, D / 2 - 2, Math.PI, 'stand', { walkOnly: true }), st(0, -D / 2 + 2, 0, 'stand', { walkOnly: true }));
    return { world: { stations, aisle: [[0, D / 2 - 2], [0, 0], [0, -D / 2 + 2]], dwell: [1, 2.5], walkOnly: true }, walkers: place === 'junction' || place === 'landing-bay' ? 0 : 1, gait: 'limp' };
  }
  return null;
}

// ---------------------------------------------------------------- build

const REL = ['ahead', 'right', 'back', 'left'];
const FACE = { 1010: 0, 1012: 1, 1011: 2, 1013: 3 }; // north, east, south, west
/** Where each wall stands and the turn that makes a piece's front (+z) face into the room. */
const wallAt = (W, D) => ({
  ahead: { x: 0, z: -D / 2, ry: 0 },
  right: { x: W / 2, z: 0, ry: -Math.PI / 2 },
  back: { x: 0, z: D / 2, ry: Math.PI },
  left: { x: -W / 2, z: 0, ry: Math.PI / 2 },
});
const bbox = (poly) => [Math.min(...poly.map((p) => p[0])), Math.max(...poly.map((p) => p[0])), Math.min(...poly.map((p) => p[1])), Math.max(...poly.map((p) => p[1]))];
const overlaps = (a, b) => a[0] < b[1] && a[1] > b[0] && a[2] < b[3] && a[3] > b[2];

export function buildShip(spec, ctx) {
  const r = rng(spec.seed);
  const points = [];
  const P = PLACES[spec.place] || PLACES.walkway;
  const group = new THREE.Group();
  const ticks = [];
  const alert = spec.light.alert;
  const feat = new Set(spec.features);
  const W = P.w;
  const D = P.d;
  const H = P.h;
  const style = P.style;
  const lux = style.startsWith('lux');
  const med = style === 'med';
  // The modelled art style (A, chosen by the owner; ADR-013) in every room.
  // ?style=legacy shows the old primitives for comparison; ?style=b the
  // rejected stylised candidate (stateroom only).
  const artKey = ctx.artStyle === 'legacy' ? null : ctx.artStyle === 'b' && spec.place === 'stateroom' ? 'b' : 'a';
  const art = artKey ? palette(artKey) : null;
  const ex = spec.exits;
  const face = FACE[spec.facing] ?? 0;
  /** The wall (relative to the facing) of an absolute direction: 0 north, 1 east, 2 south, 3 west. */
  const relOf = (a) => REL[(a - face + 4) % 4];
  const walls = wallAt(W, D);
  /** A point `d` metres in from wall k, and the turn that faces a piece into the room. */
  const inside = (k, d) => {
    const wa = walls[k];
    return [wa.x + Math.sin(wa.ry) * d, wa.z + Math.cos(wa.ry) * d, wa.ry];
  };
  const doorW = lux ? 1.8 : 1.6;
  const doorH = Math.min(2.6, H - 0.4);
  const slab = 0.35;
  const big = Math.max(W, D);
  // physically based falloff: scale intensity by the square of the room size
  const size2 = Math.max(9, (big / 2) ** 2);
  const extraLights = []; // lights for what is seen through openings
  let focus = null; // a point of interest for close-up shots (the bed)

  // ---------------------------------------------------------------- openings between decks (style A)
  // doorway centres as shell() will cut them, so stairs keep clear of them
  const offs = -D * 0.12;
  const doorAt = {};
  if (ex.ahead) doorAt.ahead = { x: 0, z: -D / 2 };
  if (ex.back) doorAt.back = { x: 0, z: D / 2 };
  if (ex.left) doorAt.left = { x: -W / 2, z: offs };
  if (ex.right) doorAt.right = { x: W / 2, z: offs };
  let core = null; // a switchback stair core (parlor 16, lounge 24)
  let arrival = null; // the top of the parlor's core seen from the floor above (23)
  let way = null; // a straight steel stair through a ceiling or a floor hatch
  let rent = null; // a torn opening (11 up, 13 down)
  const floorHoles = [];
  const ceilHoles = [];
  const hatchRects = P.tubes ? [-1, 0, 1].map((i) => [i * 4.2 - 2.15, i * 4.2 + 2.15, -D / 2, -D / 2 + 0.7]) : [];
  if (art) {
    if (spec.place === 'parlor') core = stairCore(stairMats(art), { H, slab, zFoot: 1.6, x0: 0 });
    else if (spec.place === 'lounge' && ex.up) core = stairCore(stairMats(art, 'coral'), { H, slab, zFoot: 2.4, x0: (ex.right ? -1 : 1) * (W / 2 - 2.2), down: false });
    else if (spec.place === 'dining-stairs' && ex.down) {
      arrival = stairCore(stairMats(art, 'ebony'), { H: PLACES.parlor.h, slab, zFoot: 2.2, x0: 0, down: false, upperRoom: false });
      floorHoles.push(...arrival.ceilHoles);
    } else if (P.ceilingHole && ex.up) {
      const c = [0.3, -D * 0.2];
      rent = { dir: 'up', c, poly: jaggedHole(c[0], c[1], 1.15, 1.45, (spec.seed % 13) + 1) };
      ceilHoles.push(rent.poly);
    } else if (P.floorHole && ex.down) {
      const c = [-1.4, 0.5];
      rent = { dir: 'down', c, poly: jaggedHole(c[0], c[1], 1.0, 1.2, (spec.seed % 13) + 1) };
      floorHoles.push(rent.poly);
    } else if (P.stair && (ex.up || ex.down)) {
      way = stairway(steelMats({ worn: !!P.dust }), { dir: ex.up ? 'up' : 'down', W, D, H, slab, drop: P.drop ?? 4, openings: doorAt, openFar: !!P.noFarWall, avoid: hatchRects, order: P.stairOrder, force: true });
      if (way) {
        floorHoles.push(...way.floorHoles);
        ceilHoles.push(...way.ceilHoles);
      }
    }
    if (core) {
      floorHoles.push(...core.floorHoles);
      ceilHoles.push(...core.ceilHoles);
    }
  }
  // the gallery's stair drops off the balcony's edge to the bay below
  const galleryStair = art && P.overlook && ex.down ? { x: -2.4, w: 1.1 } : null;
  if (galleryStair) floorHoles.push([[galleryStair.x - 0.65, -D / 2 + 0.02], [galleryStair.x + 0.65, -D / 2 + 0.02], [galleryStair.x + 0.65, -D / 2 + 1.2], [galleryStair.x - 0.65, -D / 2 + 1.2]]);

  const wall = art?.wall || wallMat(style);
  const floor = art?.floor || floorMat(P.floor);
  const ceil = art?.ceil || (lux ? M.plasterGold() : M.milCeil());
  const { group: sh, openings } = shell({ w: W, d: D, h: H, exits: ex, wall, floor, ceil, doorW, doorH, openFar: !!P.noFarWall, floorHoles, ceilHoles });
  group.add(sh);

  // special doorways: the magnesium door of the presidential suite (north),
  // the arch into the dining hall (west)
  const special = {};
  if (P.magnesiumDoor) special[relOf(0)] = 'magnesium';
  if (P.archway) special[relOf(3)] = 'arch';

  // doorway dressing + a short corridor behind each opening so it has depth
  for (const [k, o] of Object.entries(openings)) {
    if (k === 'back' || (k === 'ahead' && P.noFarWall)) continue;
    const frame = new THREE.Group();
    const beyondM = mat('panel', { c1: 0x121418, c2: 0x040506, c3: 0xff9a40, p: [1.0, 0.03, 2.2, 0], q: [0.8, 0, 0, 0], seed: 9, side: THREE.BackSide });
    if (art) {
      frame.add(box(doorW + 0.2, doorH + 0.1, 3.0, beyondM, { pos: [0, (doorH + 0.1) / 2, -1.65], shadow: false }));
      if (special[k] === 'magnesium') frame.add(magnesiumDoor());
      else if (special[k] === 'arch') frame.add(archway(doorW, doorH));
      else if (lux) frame.add(swingLeaves(doorW, doorH));
      else {
        frame.add(bulkheadFrame(doorW, doorH));
        frame.add(slideLeaves(doorW, doorH));
        frame.add(rbox(1.2, 0.03, 0.04, 0.01, glowMat(0xffa040, 2), { pos: [0, doorH + 0.26, 0.17], center: true, shadow: false }));
      }
    } else {
      const trim = lux ? M.ivory() : M.dark();
      frame.add(box(0.1, 2.5, 0.32, trim, { pos: [-0.9, 1.25, 0] }), box(0.1, 2.5, 0.32, trim, { pos: [0.9, 1.25, 0] }), box(1.9, 0.12, 0.32, trim, { pos: [0, 2.46, 0] }));
      frame.add(box(1.6, 0.025, 0.04, glowMat(lux ? 0xffd9a0 : 0xffa040, 2), { pos: [0, 2.37, 0.18], shadow: false }));
      frame.add(box(1.6, 2.4, 3.0, beyondM, { pos: [0, 1.2, -1.65], shadow: false }));
      // half-open sliding door leaves
      const leafM = lux ? M.luxGold() : mat('panel', { c1: 0x59636f, c2: 0x15191e, c3: 0xffb060, p: [0.5, 0, 0, 0], q: [0.4, 0, 0, 0], seed: 10 });
      frame.add(box(0.55, 2.4, 0.08, leafM, { pos: [-0.62, 1.2, -0.05] }), box(0.55, 2.4, 0.08, leafM, { pos: [0.62, 1.2, -0.05] }));
    }
    frame.position.copy(o).setY(0);
    if (k === 'left') frame.rotation.y = Math.PI / 2;
    if (k === 'right') frame.rotation.y = -Math.PI / 2;
    group.add(frame);
  }
  if (art && lux) group.add(roomTrim(art, { W, D, H, openings, doorW }));

  // ---------------------------------------------------------------- stairs, ladders, holes
  let parlor = null;
  if (core) {
    group.add(core.group);
    if (spec.place === 'parlor') {
      parlor = parlorSet(art, { W, D, H });
      group.add(parlor.group);
    } else {
      extraLights.push({ pos: core.lights.above, color: 0xffe2b8, intensity: 0.3 * size2, distance: 0 });
    }
  }
  if (arrival) {
    const lower = PLACES.parlor.h + slab;
    arrival.group.position.y = -lower;
    group.add(arrival.group);
    const b = arrival.bounds;
    group.add(stub(stairMats(art, 'ebony'), [b.x0, b.x1, b.z0, b.z1], { y: -lower, h: PLACES.parlor.h, margin: 1.2, below: true }));
    extraLights.push({ pos: [b.x0 + 0.6, -lower + arrival.levels.landing + 1.6, b.z0 + 0.8], color: 0xffd6a0, intensity: 0.35 * size2, distance: 0 });
  }
  if (way) {
    group.add(way.group);
    extraLights.push({ pos: way.light, color: 0xffe8cc, intensity: 0.3 * size2, distance: 0 });
  }
  if (rent) {
    const b = bbox(rent.poly);
    const sm = steelMats();
    if (rent.dir === 'up') {
      // the caved-in ceiling: torn plates and cables, the stateroom above, a heap to climb
      group.add(holeEdge(rent.poly, H, 1, spec.seed));
      group.add(lining(rent.poly, H, slab, sm.edge));
      group.add(stub(stairMats(art), b, { y: H + slab, h: 3.2, margin: 1.2 }));
      const heap = wreckage(1.5, spec.seed, { girders: 3, plates: 10, ramp: true });
      heap.position.set(rent.c[0], 0, rent.c[1] + 0.3);
      group.add(heap);
      extraLights.push({ pos: [rent.c[0], H + slab + 2.2, rent.c[1]], color: 0xffd0a0, intensity: 0.45 * size2, distance: 0 });
    } else {
      // the collapsed floor, and the hallway below it
      const lower = PLACES.rubble.h + slab;
      group.add(holeEdge(rent.poly, 0, 1, spec.seed));
      group.add(lining(rent.poly, -slab, slab, sm.edge));
      group.add(stub({ ...sm, shaft: M.milScorched() }, b, { y: -lower, h: PLACES.rubble.h, margin: 1.6, below: true }));
      const heap = wreckage(1.4, spec.seed + 3, { girders: 2, plates: 6 });
      heap.position.set(rent.c[0], -lower, rent.c[1]);
      group.add(heap);
      const sm2 = particles('smoke', 16, { quality: ctx.quality, seed: 3, pos: [rent.c[0], -1.2, rent.c[1]], spread: [1.2, 0.6, 1.2], vel: [0, 0.25, 0], size: 90, alpha: 0.16 });
      group.add(sm2);
      ticks.push(sm2.userData.tick);
      extraLights.push({ pos: [rent.c[0], -lower + 2.2, rent.c[1]], color: 0xff9a50, intensity: 1.0 * size2, distance: 0, flicker: 0.3 });
    }
  }
  if (!art) {
    // the old stairs, holes and ladders (style legacy)
    if (ex.up && !P.grandStairs && !P.steepStairs) {
      if (P.ceilingHole) {
        group.add(mesh(new THREE.CircleGeometry(1.4, 20), glowMat(0x8a7a6a, 0.6), { pos: [0.6, H - 0.02, -D * 0.2], rot: [Math.PI / 2, 0, 0] }));
      } else {
        const st = stairs({ width: 1.6, rise: H, run: H * 1.2, steps: Math.round(H * 3.5), material: M.dark(), rail: M.steel() });
        st.position.set(W / 2 - 1.2, 0, -D / 2 + H * 1.2 + 0.4);
        group.add(st);
      }
    }
    if (ex.down && !P.grandStairs) {
      if (P.floorHole) {
        group.add(mesh(new THREE.CircleGeometry(1.2, 20), glowMat(0x201810, 1), { pos: [-1.2, 0.02, -D * 0.15], rot: [-Math.PI / 2, 0, 0] }));
        group.add(particles('smoke', 20, { quality: ctx.quality, seed: 3, pos: [-1.2, 0.2, -D * 0.15], spread: [1.5, 0.2, 1.5], size: 90, alpha: 0.2 }));
      } else {
        const st = stairs({ width: 1.5, rise: 3, run: 3.6, steps: 10, material: M.dark(), rail: M.steel() });
        st.rotation.y = Math.PI;
        st.position.set(-W / 2 + 1.2, -3, -D / 2 + 0.6);
        group.add(st);
        group.add(box(1.8, 0.05, 3.9, glowMat(0x000000, 0), { pos: [-W / 2 + 1.2, 0.005, -D / 2 + 2.4] }));
      }
    }
    if (P.grandStairs) {
      const railM = { ivory: M.ivory, ebony: M.ebony, coral: M.coral }[P.grandStairs]();
      const st = stairs({ width: 3, rise: H - 0.2, run: 5.5, steps: 16, material: M.velvet(), rail: railM });
      st.position.set(ex.up ? W / 2 - 2.2 : -W / 2 + 2.2, 0, -D / 2 + 6);
      group.add(st);
    }
    if (P.steepStairs) {
      const st = stairs({ width: 2.4, rise: H, run: 4, steps: 20, material: M.dark(), rail: M.steel() });
      st.position.set(0, 0, 0.5);
      group.add(st);
    }
  }

  // ---------------------------------------------------------------- dressing
  const spots = { consoles: [], fighters: [], beds: [] };
  let stairRect = way ? way.footprint : null;
  if (P.catwalk && art) {
    // "Above is a gallery overlooking the bay": a catwalk along the far wall,
    // a steel stair up to it, and the gallery's lit windows and door above
    const cwY = 7;
    const sm = steelMats();
    const steps = Math.round(cwY / 0.21);
    const L = steps * 0.165;
    const x = -W / 2 + 0.8;
    const zTop = -D / 2 + 2.2;
    const f = steelFlight(sm, { width: 1.2, steps, rise: cwY / steps, going: 0.165 });
    f.position.set(x, 0, zTop + L);
    group.add(f);
    stairRect = [x - 0.8, x + 0.8, zTop, zTop + L + 1];
    const cw = catwalk(W, cwY, 2.2, { gap: [x - 0.65, x + 0.65] });
    cw.position.z = -D / 2 + 1.1;
    group.add(cw);
    const door = new THREE.Group();
    door.add(bulkheadFrame(1.6, 2.4));
    door.add(mesh(new THREE.PlaneGeometry(1.6, 2.4), glowMat(0xffd8a8, 0.5), { pos: [0, 1.2, -0.06], shadow: false }));
    door.position.set(x + 2.6, cwY, -D / 2 + 0.13);
    group.add(door);
    for (let i = 0; i < 6; i++) {
      const pane = new THREE.Group();
      pane.add(rbox(2.6, 1.5, 0.12, 0.03, SM.gunmetal(), { center: true }));
      pane.add(mesh(new THREE.PlaneGeometry(2.4, 1.3), glowMat(0xbfd4ff, 0.35), { pos: [0, 0, 0.065], shadow: false }));
      pane.position.set(-W / 2 + 7 + i * 3.2, cwY + 2.6, -D / 2 + 0.14);
      group.add(pane);
    }
  } else if (P.catwalk) {
    group.add(box(W, 0.15, 2.2, M.deck(), { pos: [0, 7, -D / 2 + 1.1] }));
    group.add(box(W, 0.9, 0.06, M.steel(), { pos: [0, 7.5, -D / 2 + 2.2] }));
    for (let i = 0; i < 6; i++) group.add(box(0.3, 7, 0.3, M.dark(), { pos: [-W / 2 + 2 + i * (W - 4) / 5, 3.5, -D / 2 + 2.2] }));
  }
  if (P.fighters) {
    const fr = fighterRow(r, P.fighters, W, D, !!art);
    spots.fighters = fr.userData.spots;
    group.add(fr);
  }
  if (P.crates) {
    let placed = 0;
    for (let tries = 0; placed < P.crates && tries < P.crates * 4; tries++) {
      const s = r.range(0.7, 1.3);
      const x = r.pick([-1, 1]) * r.range(W * 0.2, W * 0.45);
      const z = r.range(-D * 0.45, D * 0.3);
      const stacked = placed % 3 === 2;
      if (art) {
        const fp = [x - s, x + s, z - s, z + s];
        if (stairRect && overlaps(fp, stairRect)) continue;
        if (spots.fighters.some(([fx, fz]) => Math.hypot(fx - x, fz - z) < 4.2)) continue;
        const c = crate(s * 1.4, s, s);
        c.position.set(x, 0, z);
        c.rotation.y = r.range(-0.3, 0.3);
        group.add(c);
        if (stacked) {
          const c2 = crate(s * 1.1, s * 0.8, s * 0.9);
          c2.position.set(x + r.range(-0.1, 0.1), s, z);
          c2.rotation.y = r.range(-0.4, 0.4);
          group.add(c2);
        }
      } else {
        group.add(box(s * 1.4, s, s, M.crate(), { pos: [x, s / 2 + (stacked ? s : 0), z], rot: [0, r.range(-0.3, 0.3), 0] }));
      }
      placed++;
    }
  }
  if (P.bayDoor || P.spaceWindow || feat.has('window')) {
    // a window to space (22: "a window in the wall ahead" when facing north)
    let win;
    if (P.bayDoor) {
      win = spaceWindow(W * 0.8, H * 0.7, r.range(0, 10));
      win.position.set(0, H * 0.42, -D / 2 + 0.2);
      group.add(mesh(new THREE.PlaneGeometry(W * 0.8, H * 0.7), glowMat(0x3a6aff, 0.25, { transparent: true, opacity: 0.25, additive: true }), { pos: [0, H * 0.42, -D / 2 + 0.6] }));
      if (art) {
        // the bay door's heavy frame
        const fr = new THREE.Group();
        for (const s of [-1, 1]) fr.add(rbox(0.6, H * 0.7 + 0.6, 0.5, 0.06, SM.gunmetal(), { pos: [s * (W * 0.4 + 0.3), H * 0.07 - 0.3, 0] }));
        fr.add(rbox(W * 0.8 + 1.8, 0.6, 0.5, 0.06, SM.gunmetal(), { pos: [0, H * 0.77, 0] }));
        for (let i = 0; i < 16; i++) fr.add(rbox(0.5, 0.12, 0.02, 0.01, i % 2 ? SM.hazard() : SM.dark(), { pos: [-W * 0.4 + 0.3 + i * (W * 0.8 - 0.6) / 15, H * 0.77 + 0.24, 0.26], rot: [0, 0, 0.6], shadow: false }));
        fr.position.set(0, 0, -D / 2 + 0.3);
        group.add(fr);
      }
    } else if (P.overlook) {
      win = spaceWindow(W * 0.9, 2.4, r.range(0, 10));
      win.position.set(0, 2.2, -D / 2 + 0.2);
    } else {
      // on the ship's north wall, wherever that is from the current facing
      const [wx, wz, ry] = inside(relOf(0), 0.14);
      win = spaceWindow(3.2, 1.6, r.range(0, 10));
      win.position.set(wx, 1.8, wz);
      win.rotation.y = ry;
      if (art) win.add(windowFrame(art, 3.2, 1.6));
      else win.add(box(3.5, 1.9, 0.1, M.luxGold(), { pos: [0, 0, -0.06] }));
    }
    ticks.push(win.userData.tick);
    group.add(win);
  }
  if (P.overlook) {
    points.push({ pos: [0, -4, -24], color: 0xff7a30, intensity: 900, distance: 0, flicker: 0.7 });
    // "a view of the entire landing bay ... fires are spreading out of control and laser blasts lick at the shadows"
    if (art) {
      const sm = steelMats();
      const zr = -D / 2 + 1.2;
      const gx = galleryStair ? [galleryStair.x - 0.65, galleryStair.x + 0.65] : null;
      const runs = gx ? [[-W / 2 + 0.15, gx[0]], [gx[1], W / 2 - 0.15]] : [[-W / 2 + 0.15, W / 2 - 0.15]];
      for (const [a, b] of runs) group.add(railing(sm, [[a, 0, zr], [b, 0, zr]], { spacing: 1.6 }));
      // the balcony's edge beam, cut where the stair goes down
      const ledge = gx ? [[-W / 2, gx[0]], [gx[1], W / 2]] : [[-W / 2, W / 2]];
      for (const [a, b] of ledge) group.add(rbox(b - a, 0.35, 1.2, 0.03, SM.gunmetal(), { pos: [(a + b) / 2, -0.35, -D / 2 + 0.6] }));
      if (galleryStair) {
        const drop = 9;
        const steps = Math.round(drop / 0.21);
        const L = steps * 0.165;
        const f = steelFlight(sm, { width: galleryStair.w, steps, rise: drop / steps, going: 0.165 });
        f.rotation.y = Math.PI;
        f.position.set(galleryStair.x, -drop, -D / 2 + 1.2 - L);
        group.add(f);
        // hangers from the balcony holding the flight
        for (const s of [-1, 1]) group.add(rod([galleryStair.x + s * 0.6, -0.3, -D / 2 + 0.2], [galleryStair.x + s * 0.6, -3.4, -D / 2 - 1.8], 0.03, sm.rail));
      }
    } else {
      group.add(box(W, 0.06, 0.06, M.steel(), { pos: [0, 1.0, -D / 2 + 1.2] }), box(W, 0.04, 0.04, M.steel(), { pos: [0, 0.55, -D / 2 + 1.2] }));
      for (let i = 0; i < 9; i++) group.add(box(0.05, 1.0, 0.05, M.steel(), { pos: [-W / 2 + 1 + i * (W - 2) / 8, 0.5, -D / 2 + 1.2] }));
      group.add(box(W, 0.2, 1.2, M.deck(), { pos: [0, -0.1, -D / 2 + 0.6] }));
    }
    const bay = new THREE.Group();
    bay.add(mesh(new THREE.PlaneGeometry(60, 50), M.deckPlate(), { rot: [-Math.PI / 2, 0, 0], pos: [0, -9, -30], shadow: false }));
    bay.add(box(60, 24, 0.5, M.mil(), { pos: [0, 2, -55] }));
    for (let i = 0; i < 5; i++) {
      const v = makeViper({ damaged: i % 2 === 0 });
      v.position.set(r.range(-18, 18), -7.8, -18 - i * 6);
      v.rotation.y = r.range(-1, 1);
      bay.add(v);
    }
    for (let i = 0; i < 4; i++) {
      const pos = [r.range(-20, 20), -8.5, r.range(-40, -15)];
      const fire = particles('embers', 70, { quality: ctx.quality, seed: 60 + i, pos, spread: [4, 0.5, 4], vel: [0.2, 3, 0], size: 9 });
      const smoke = particles('smoke', 30, { quality: ctx.quality, seed: 70 + i, pos: [pos[0], pos[1] + 3, pos[2]], spread: [5, 1, 5], vel: [0.3, 2, 0], size: 420, alpha: 0.35 });
      const glow = glowSprite(0xff6a20, 9, 0.9);
      glow.position.set(pos[0], pos[1] + 1, pos[2]);
      bay.add(fire, smoke, glow);
      ticks.push(fire.userData.tick, smoke.userData.tick);
    }
    group.add(bay);
    const win = spaceWindow(W * 0.9, 1.4, r.range(0, 10));
    win.position.set(0, H - 1.0, -D / 2 - 0.1);
    group.add(win);
    ticks.push(win.userData.tick);
  }
  if (P.consoles) {
    for (let i = 0; i < P.consoles; i++) {
      const color = i % 3 ? 0x5ad8ff : 0xffb050;
      const a = (i / (P.consoles - 1) - 0.5) * 2.2;
      const x = Math.sin(a) * W * (art ? 0.3 : 0.36);
      const z = -D * 0.1 - Math.cos(a) * D * 0.32;
      if (art && stairRect && overlaps([x - 0.8, x + 0.8, z - 0.8, z + 0.8], stairRect)) continue;
      const c = art ? workstation(color, spec.seed + i, holoPanel) : console_(r, color);
      c.position.set(x, 0, z);
      c.rotation.y = -a;
      spots.consoles.push([x, z, a]);
      group.add(c);
      ticks.push(c.userData.tick);
    }
  }
  if (P.locker) {
    if (art) {
      // "A weapons locker has been left open."
      const lk = lockers(3, spec.seed, { weapons: true });
      lk.position.set(W / 2 - 0.3, 0, D * 0.15);
      lk.rotation.y = -Math.PI / 2;
      group.add(lk);
    } else {
      group.add(box(1.2, 2.2, 0.6, M.dark(), { pos: [W / 2 - 0.5, 1.1, D * 0.1] }));
      group.add(box(0.6, 2.1, 0.05, M.steel(), { pos: [W / 2 - 1.2, 1.1, D * 0.1 + 0.55], rot: [0, 1.1, 0] }));
    }
  }
  if (P.tubes) {
    for (let i = 0; i < P.tubes; i++) {
      if (art) {
        const h = launchHatch(i === 1);
        h.position.set((i - 1) * 4.2, 2.15, -D / 2 + 0.13);
        group.add(h);
      } else {
        group.add(mesh(new THREE.TorusGeometry(1.6, 0.25, 10, 32), M.dark(), { pos: [(i - 1) * 4.2, 2.1, -D / 2 + 0.3] }));
        group.add(mesh(new THREE.CircleGeometry(1.5, 32), glowMat(i === 1 ? 0xffa040 : 0x0a0a10, i === 1 ? 0.4 : 1), { pos: [(i - 1) * 4.2, 2.1, -D / 2 + 0.2] }));
      }
    }
  }
  if (P.tube) {
    const tunnel = mesh(new THREE.CylinderGeometry(3.3, 3.3, D, 32, 1, true), mat('panel', { c1: 0x3d4652, c2: 0x0e1115, c3: 0xff9a40, p: [1.5, 0.08, 0, 0], q: [0.5, 0, 0, 0], seed: 12, side: THREE.BackSide }), { pos: [0, 3.2, 0], rot: [Math.PI / 2, 0, 0] });
    group.add(tunnel);
    for (let i = 0; i < 6; i++) group.add(mesh(new THREE.TorusGeometry(3.25, 0.04, 6, 40), glowMat(0xffa040, 1.1), { pos: [0, 3.2, D / 2 - 3 - i * 3.4] }));
    if (art) {
      // structural hoops, the catapult track and its shuttle
      const hoop = latheGeo([[3.28, -0.18], [3.12, -0.16], [3.08, 0], [3.12, 0.16], [3.28, 0.18]], 48);
      hoop.rotateX(Math.PI / 2);
      for (let i = 0; i < 7; i++) group.add(mesh(hoop, SM.gunmetal(), { pos: [0, 3.2, D / 2 - 1.3 - i * 3.4], shadow: false }));
      for (const s of [-1, 1]) {
        group.add(rbox(0.22, 0.16, D, 0.03, SM.steel(), { pos: [s * 0.8, 0.02, 0] }));
        group.add(rbox(0.08, 0.05, D, 0.02, SM.chrome(), { pos: [s * 0.8, 0.18, 0] }));
      }
      for (let i = 0; i < Math.floor(D / 1.2); i++) group.add(rbox(2.2, 0.08, 0.25, 0.02, SM.dark(), { pos: [0, 0, -D / 2 + 0.6 + i * 1.2], shadow: false }));
      const shuttle = new THREE.Group();
      shuttle.add(rbox(1.9, 0.22, 1.4, 0.05, SM.paint(0x8a6a2a), {}));
      shuttle.add(rbox(0.3, 0.5, 0.3, 0.05, SM.dark(), { pos: [0, 0.22, -0.4] }));
      shuttle.position.set(0, 0.2, -D / 2 + 5);
      group.add(shuttle);
    } else {
      group.add(box(0.3, 0.2, D, M.steel(), { pos: [-0.8, 0.1, 0] }), box(0.3, 0.2, D, M.steel(), { pos: [0.8, 0.1, 0] }));
    }
    const glowEnd = glowSprite(0x9ab8ff, 5, 0.35);
    glowEnd.position.set(0, 3.2, -D / 2);
    group.add(glowEnd);
  }
  if (P.bench) {
    if (art) {
      const wb = workbench(spec.seed);
      wb.position.set(0, 0, -D / 2 + 0.7);
      group.add(wb);
      // "... pneumatic wrenches and turbo sprocket rockets"
      for (let i = 0; i < 2; i++) {
        const rk = sprocketRocket();
        rk.position.set(-W / 2 + 0.9, 0, -D / 2 + 1.8 + i * 0.6);
        rk.rotation.y = Math.PI / 2 + 0.1;
        group.add(rk);
      }
      const shelf = utilityShelf(spec.seed);
      shelf.position.set(W / 2 - 0.35, 0, -D / 2 + 1.6);
      shelf.rotation.y = -Math.PI / 2;
      group.add(shelf);
    } else {
      group.add(box(3, 0.9, 1.1, M.steel(), { pos: [0, 0.45, -D / 2 + 1.2] }));
      for (let i = 0; i < 8; i++) group.add(box(r.range(0.1, 0.4), r.range(0.05, 0.2), r.range(0.05, 0.3), i % 3 ? M.dark() : M.bronze(), { pos: [r.range(-1.3, 1.3), 1.0, -D / 2 + 1.2 + r.range(-0.3, 0.3)], rot: [0, r.range(0, 3), 0] }));
      group.add(box(0.35, 0.22, 0.2, mat('metal', { c1: 0xc83a2a, c2: 0x6a1a10, p: [0.4, 0.3, 0, 0] }), { pos: [0.9, 1.02, -D / 2 + 1.0] }));
    }
  }
  if (P.wardrobe) {
    if (art) {
      // "Furs and robes of kings hang on rack after rack"
      for (const s of [-1, 1]) {
        const door = s < 0 ? ex.left : ex.right;
        const z1 = door ? offs - 1.0 : D / 2 - 0.9;
        const z0 = -D / 2 + 0.3;
        const wd = wardrobe(z1 - z0, spec.seed + s);
        wd.position.set(s * (W / 2 - 0.4), 0, (z0 + z1) / 2);
        if (s > 0) wd.rotation.y = Math.PI;
        group.add(wd);
      }
      const ot = ottoman();
      ot.position.set(0, 0, 0.2);
      ot.rotation.y = Math.PI / 2;
      group.add(ot);
      if (!ex.ahead) {
        const mr = mirror();
        mr.position.set(0.9, 0, -D / 2 + 0.2);
        group.add(mr);
      }
    } else {
      for (let i = 0; i < 2; i++) {
        const x = i ? W / 2 - 0.5 : -W / 2 + 0.5;
        group.add(box(0.05, 0.05, D * 0.8, M.ivory(), { pos: [x, 2.1, 0] }));
        for (let k = 0; k < 14; k++) {
          const c = [0x5a1a6a, 0xc8a040, 0x2a2a3a, 0xe8e0d0, 0x6a0c18, 0x3a5a4a][k % 6];
          group.add(box(0.12, 1.3, 0.55, mat('cloth', { c1: c, c2: 0x201818, p: [4, 0, 0, 0] }), { pos: [x, 1.4, -D * 0.38 + k * (D * 0.76 / 13)], rot: [0, 0, r.range(-0.08, 0.08)] }));
        }
      }
    }
  }
  if (P.bed && art) {
    const bedSide = spec.place === 'presidential-suite' ? 0 : P.floorHole ? 1 : r.pick([-1, 1]);
    const set = stateroomSet(art, { W, D, bedSide, seed: spec.seed % 97 });
    group.add(set.group);
    focus = set.bed;
    if (spec.place === 'presidential-suite') {
      // a sofa and a side table along the left wall
      const so = sofa(art, 2.2);
      so.position.set(-W / 2 + 0.55, 0, -D * 0.24);
      so.rotation.y = Math.PI / 2;
      group.add(so);
      const st = sideTable(art, { lamp: true });
      st.position.set(-W / 2 + 0.45, 0, -D * 0.24 - 1.55);
      group.add(st);
    }
  } else if (P.bed) {
    const b = bed(r);
    b.position.set(r.pick([-1, 1]) * W * 0.24, 0, -D / 2 + 1.6);
    group.add(b);
    focus = b.position.toArray();
    group.add(box(0.6, 0.6, 0.5, M.lux(), { pos: [b.position.x + 1.6, 0.3, -D / 2 + 0.6] }));
  }
  if (P.gadgets || feat.has('window')) {
    // "Electronic equipment built into the walls and ceiling is flashing wildly."
    const leds = [];
    for (const side of [-1, 1]) {
      const rackZ = r.range(-D * 0.25, D * 0.1);
      const panelM = mat('panel', { c1: 0x1c2026, c2: 0x07080a, c3: 0x7af0ff, p: [0.3, 0, 0, 0], q: [0.2, 0, 0, 0], seed: 13 });
      if (art) {
        group.add(rbox(0.05, 1.4, 2.2, art.style === 'b' ? 0.02 : 0.008, panelM, { pos: [side * (W / 2 - 0.15), 1.6, rackZ], center: true }));
        const bz = consoleBezel(art, 2.2, 1.4);
        bz.position.set(side * (W / 2 - 0.15), 1.6, rackZ);
        if (side > 0) bz.rotation.y = Math.PI;
        group.add(bz);
      } else {
        group.add(box(0.08, 1.4, 2.2, panelM, { pos: [side * (W / 2 - 0.16), 1.6, rackZ] }));
      }
      for (let k = 0; k < 36; k++) {
        const c = [0x7af0ff, 0xff4a3a, 0x9aff7a, 0xffc24a][k % 4];
        const led = mesh(new THREE.BoxGeometry(0.02, 0.025, 0.05), glowMat(c, 2.5), { pos: [side * (W / 2 - 0.21), 1.05 + (k % 9) * 0.13, rackZ - 0.9 + Math.floor(k / 9) * 0.55], shadow: false });
        group.add(led);
        leds.push([led, r.range(0, 10), r.range(2, 9)]);
      }
    }
    ticks.push((t) => { for (const [l, ph, sp] of leds) l.visible = Math.sin(t * sp + ph) > -0.2; });
  }
  if (P.bed && lux && !art) {
    // great wooden furniture inlaid with platinum and gold
    const side = box(1.8, 0.85, 0.55, M.furniture(), { pos: [0, 0.43, 0] });
    const sb = new THREE.Group();
    sb.add(side);
    sb.add(box(1.84, 0.04, 0.59, M.luxGold(), { pos: [0, 0.87, 0] }));
    for (let k = 0; k < 3; k++) sb.add(box(0.5, 0.02, 0.01, mat('gold', { c1: 0xffc24a, c2: 0xffffff, p: [0.4, 0, 0, 0] }), { pos: [-0.6 + k * 0.6, 0.6, 0.28] }));
    const lampBase = cyl(0.06, 0.09, 0.35, mat('gold', { c1: 0xffc24a, c2: 0xffffff, p: [0.3, 0, 0, 0] }), { pos: [0.6, 1.05, 0] }, 12);
    sb.add(lampBase);
    sb.add(mesh(new THREE.ConeGeometry(0.2, 0.22, 16, 1, true), glowMat(0xffd9a0, 1.4, { side: THREE.DoubleSide }), { pos: [0.6, 1.3, 0] }));
    sb.position.set(-W / 2 + 0.5, 0, D * 0.05);
    sb.rotation.y = Math.PI / 2;
    group.add(sb);
    const chair = new THREE.Group();
    chair.add(box(0.6, 0.5, 0.6, M.velvet(), { pos: [0, 0.25, 0] }));
    chair.add(box(0.6, 0.7, 0.12, M.furniture(), { pos: [0, 0.75, -0.26] }));
    chair.position.set(W * 0.28, 0, D * 0.05);
    chair.rotation.y = -0.6;
    group.add(chair);
  }
  if (P.clutter) {
    if (art) {
      // "Clothes, trinkets and personal belongings are scattered all across the floor."
      const cl = strewnClothes(P.clutter, [W * 0.38, D * 0.32], spec.seed);
      cl.position.z = -D * 0.05;
      for (const m of [...cl.children]) {
        const x = m.position.x;
        const z = m.position.z + cl.position.z;
        if (rent && Math.hypot(x - rent.c[0], z - rent.c[1]) < 1.7) cl.remove(m);
      }
      group.add(cl);
    } else {
      for (let i = 0; i < P.clutter; i++) {
        const c = [0xe8d8f0, 0x5a1a6a, 0xc8a040, 0x2a4a7a, 0xf0e6d8][i % 5];
        group.add(box(r.range(0.2, 0.6), 0.04, r.range(0.2, 0.5), mat('cloth', { c1: c, c2: 0x201818, p: [4, 0, 0, 0] }), { pos: [r.range(-W * 0.4, W * 0.4), 0.02, r.range(-D * 0.4, D * 0.2)], rot: [0, r.range(0, 3), 0] }));
      }
    }
  }
  if (P.chandelier && !parlor) {
    if (art) {
      const zs = P.banquet ? [-D * 0.3, -D * 0.05, D * 0.2] : arrival ? [-1.0] : [0];
      const chs = zs.map((z) => {
        const ch = chandelier(art, { drop: 1.1, arms: P.banquet ? 10 : 8, radius: P.banquet ? 0.7 : 0.6 });
        ch.position.set(0, H, z);
        group.add(ch);
        return ch;
      });
      ticks.push((t) => chs.forEach((ch, i) => { ch.rotation.z = Math.sin(t * 1.3 + i) * 0.012 * (1 + alert * 3); }));
    } else {
      const ch = new THREE.Group();
      ch.add(mesh(new THREE.TorusGeometry(0.9, 0.04, 8, 32), M.ivory(), { rot: [Math.PI / 2, 0, 0] }));
      for (let i = 0; i < 12; i++) ch.add(mesh(new THREE.OctahedronGeometry(0.06, 0), glowMat(0xffe6c0, 4), { pos: [Math.cos(i / 12 * Math.PI * 2) * 0.9, -0.12, Math.sin(i / 12 * Math.PI * 2) * 0.9] }));
      ch.position.set(0, H - 0.8, -D * 0.1);
      group.add(ch);
      ticks.push((t) => { ch.rotation.z = Math.sin(t * 1.3) * 0.03 * (1 + alert * 3); });
    }
  }
  // the banquet's seats (table-local z) for the place settings and the ambassadors
  const seats = [];
  const tableZ = -D * 0.05;
  if (P.banquet) {
    const L = D * 0.7;
    for (let i = 0; i < 14; i++) seats.push([i % 2 ? 1 : -1, -L / 2 + 0.8 + Math.floor(i / 2) * ((L - 1.6) / 6)]);
    if (art) {
      const t = banquetTable(L, seats, spec.seed);
      t.position.z = tableZ;
      group.add(t);
    } else {
      group.add(box(2.4, 0.1, D * 0.7, M.luxGold(), { pos: [0, 0.8, -D * 0.05] }));
      for (let i = 0; i < 14; i++) group.add(mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.05, 12), M.ivory(), { pos: [i % 2 ? 0.8 : -0.8, 0.88, -D * 0.38 + Math.floor(i / 2) * 1.6] }));
    }
  }
  if (P.beds) {
    const occupied = new Set([0, 2, 4].map((i) => i % P.beds));
    for (let i = 0; i < P.beds; i++) {
      const x = (i % 2 ? 1 : -1) * (W / 2 - 1.4);
      const z = -D / 2 + 2 + Math.floor(i / 2) * 2.8;
      if (art) {
        const b = hospitalBed(spec.seed + i, { blanket: !occupied.has(i) });
        b.position.set(x, 0, z);
        group.add(b);
        if (occupied.has(i)) {
          const iv = ivStand();
          iv.position.set(x + Math.sign(x) * 0.78, 0, z - 0.7);
          group.add(iv);
        }
      } else {
        const b = new THREE.Group();
        b.add(box(1.0, 0.7, 2.1, M.steel(), { pos: [0, 0.35, 0] }));
        b.add(box(0.95, 0.15, 2.0, mat('cloth', { c1: 0xdde6e6, c2: 0xa8b8b8, p: [2, 0, 0, 0] }), { pos: [0, 0.75, 0] }));
        b.position.set(x, 0, z);
        group.add(b);
      }
      spots.beds.push([x, z]);
    }
  }
  if (P.incinerator) {
    if (art) {
      // "... thrown into the incinerators": on the far wall, or the back one if a door is there
      const inc = incinerator();
      const [ix, iz, ry] = inside(ex.ahead ? 'back' : 'ahead', 0.15);
      inc.position.set(ix, 0, iz);
      inc.rotation.y = ry;
      group.add(inc);
      const mouth = inc.userData.mouth;
      ticks.push((t) => { mouth.material.color.setRGB(5 + Math.sin(t * 7) * 1.2, 1.8 + Math.sin(t * 5) * 0.4, 0.3); });
    } else {
      group.add(box(2.4, 2.2, 0.4, M.dark(), { pos: [0, 1.1, -D / 2 + 0.3] }));
      const mouth = mesh(new THREE.PlaneGeometry(1.4, 0.9), glowMat(0xff5a10, 5), { pos: [0, 1.0, -D / 2 + 0.52] });
      group.add(mouth);
      ticks.push((t) => { mouth.material.color.setRGB(5 + Math.sin(t * 7) * 1.2, 1.8 + Math.sin(t * 5) * 0.4, 0.3); });
    }
  }
  if (P.racks || P.ammo) {
    const n = P.racks || 6;
    if (art) {
      const L = 2.4;
      const rows = Math.ceil(n / 2);
      for (let i = 0; i < n; i++) {
        const s = i % 2 ? 1 : -1;
        const z = rows > 1 ? -D / 2 + 1.5 + Math.floor(i / 2) * ((D * 0.65 - 1.5) / (rows - 1)) : 0;
        const door = s < 0 ? ex.left : ex.right;
        if (door && Math.abs(z - offs) < L / 2 + 1.1) continue;
        const rack = weaponRack(P.ammo ? 'ammo' : 'rifles', spec.seed + i, L);
        rack.position.set(s * (W / 2 - 0.4), 0, z);
        if (s > 0) rack.rotation.y = Math.PI;
        group.add(rack);
      }
      if (P.ammo) {
        // more crates stacked down the middle
        for (let i = 0; i < 4; i++) {
          const c = crate(1.1, 0.7, 0.8);
          c.position.set(r.range(-0.4, 0.4), 0, -D / 2 + 2.2 + i * 1.6);
          c.rotation.y = r.range(-0.2, 0.2);
          group.add(c);
        }
      }
    } else {
      for (let i = 0; i < n; i++) {
        const rack = new THREE.Group();
        rack.add(box(0.5, 2.4, 3.2, M.dark(), { pos: [0, 1.2, 0] }));
        const items = scatter(new THREE.CylinderGeometry(0.06, 0.06, 0.45, 8), M.bronze(), 40, (k) => ({
          pos: [0.28, 0.35 + Math.floor(k / 10) * 0.5, -1.4 + (k % 10) * 0.31], rot: [0, 0, P.ammo ? 0 : Math.PI / 2],
        }));
        rack.add(items);
        rack.position.set((i % 2 ? 1 : -1) * (W / 2 - 1), 0, -D / 2 + 2.5 + Math.floor(i / 2) * 4);
        if (i % 2) rack.rotation.y = Math.PI;
        group.add(rack);
      }
    }
  }
  if (P.magnesiumDoor) {
    const o = art ? openings[relOf(0)] : null;
    if (!art) {
      const door = box(1.8, 2.7, 0.12, mat('metal', { c1: 0xe8ecf0, c2: 0xa0a8b0, p: [0.12, 0.1, 0, 0] }), { pos: [0.6, 1.35, -D / 2 + 0.25], rot: [0, 0.45, 0] });
      group.add(door);
      const gems = scatter(new THREE.OctahedronGeometry(0.03, 0), glowMat(0xffd0f0, 3), 60, (i) => ({
        pos: [-0.95 + (i % 2) * 1.9, 0.3 + (Math.floor(i / 2) / 30) * 2.4, -D / 2 + 0.35],
      }));
      group.add(gems);
    }
    const gp = art ? (o && relOf(0) !== 'back' ? [o.x * 0.94, 1.5, o.z * 0.94] : null) : [0, 1.5, -D / 2 + 0.6];
    if (gp) {
      const gl = particles('glitter', 30, { quality: ctx.quality, seed: 8, pos: gp, spread: [2, 2.6, 0.2], size: 4 });
      group.add(gl);
      ticks.push(gl.userData.tick);
    }
  }
  if (P.bucket) {
    if (art) {
      // "... drowned in a bucket of Pine Sol": the bucket and the utility shelves
      const bk = mopBucket();
      bk.position.set(0.6, 0, -0.9);
      group.add(bk);
      const [sx, sz, ry] = inside(ex.ahead ? 'back' : 'ahead', 0.3);
      const sf = utilityShelf(spec.seed);
      sf.position.set(sx + 0.9 * Math.cos(ry), 0, sz - 0.9 * Math.sin(ry));
      sf.rotation.y = ry;
      group.add(sf);
    } else {
      group.add(cyl(0.25, 0.2, 0.4, mat('metal', { c1: 0x6a7a8a, c2: 0x2a3036, p: [0.4, 0.5, 0, 0] }), { pos: [1.2, 0.2, -1.2] }, 16));
    }
  }
  let galleyWall = null;
  if (P.counters) {
    if (art) {
      // "shining stainless steel and burnished bronze cookware ... on a sterling platter"
      galleyWall = ['ahead', 'left', 'right'].find((k) => !openings[k]) || 'ahead';
      const [gx, gz, ry] = inside(galleyWall, 0.41);
      const len = (galleyWall === 'ahead' ? W : D) - 1.2;
      const gl = galley(len, spec.seed);
      gl.position.set(gx, 0, gz);
      gl.rotation.y = ry;
      group.add(gl);
      const island = new THREE.Group();
      island.add(rbox(2.4, 0.1, 0.9, 0.02, SM.rubber(), {}));
      island.add(rbox(2.36, 0.78, 0.86, 0.02, SM.steel(), { pos: [0, 0.1, 0] }));
      island.add(rbox(2.5, 0.05, 1.0, 0.015, SM.chrome(), { pos: [0, 0.88, 0] }));
      const platter = latheGeo([[0, 0], [0.34, 0], [0.4, 0.03], [0.38, 0.035], [0.3, 0.012], [0, 0.012]], 40);
      island.add(mesh(platter, SM.chrome(), { pos: [0.3, 0.93, 0] }));
      const fruitC = [0xff8a2a, 0xffd23a, 0x6aa02a, 0xc81a2a, 0x8a2a8a];
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        island.add(mesh(new THREE.SphereGeometry(r.range(0.04, 0.06), 12, 10), mat('matte', { c1: fruitC[i % 5], p: [0.45, 0, 0, 0] }), { pos: [0.3 + Math.cos(a) * 0.22, 0.99, Math.sin(a) * 0.22] }));
      }
      for (let i = 0; i < 3; i++) island.add(rbox(0.12, 0.07, 0.09, 0.01, mat('matte', { c1: 0xf0d070, p: [0.6, 0, 0, 0] }), { pos: [0.3 + (i - 1) * 0.12, 0.945, 0.02], rot: [0, i, 0] }));
      island.add(mesh(cushionGeo(0.24, 0.08, 0.14, { r: 0.03, puff: 0.3 }), mat('matte', { c1: 0x9a3a2a, p: [0.55, 0, 0, 0] }), { pos: [0.18, 0.945, -0.08] }));
      // a bronze pot and pan on the island, a rack of pans above it
      island.add(mesh(latheGeo([[0, 0], [0.16, 0], [0.17, 0.02], [0.17, 0.2], [0, 0.2]], 24), SM.gold(), { pos: [-0.7, 0.905, 0] }));
      for (let i = 0; i < 5; i++) island.add(mesh(latheGeo([[0, 0], [0.12, 0], [0.14, 0.05], [0, 0.05]], 20), i % 2 ? SM.gold() : SM.chrome(), { pos: [-0.8 + i * 0.4, 1.95, 0], rot: [Math.PI / 2, 0, 0] }));
      island.add(rod([-1.1, 2.1, 0], [1.1, 2.1, 0], 0.015, SM.chrome()));
      island.position.set(0, 0, -0.4);
      group.add(island);
      island.add(rod([-1.1, 2.1, 0], [-1.1, H, 0], 0.012, SM.chrome()), rod([1.1, 2.1, 0], [1.1, H, 0], 0.012, SM.chrome()));
    } else {
      group.add(box(W - 1, 0.95, 0.8, M.steel(), { pos: [0, 0.47, -D / 2 + 0.5] }));
      for (let i = 0; i < 8; i++) group.add(cyl(r.range(0.12, 0.22), r.range(0.12, 0.2), r.range(0.12, 0.3), M.bronze(), { pos: [-W / 2 + 1.2 + i * (W - 2.4) / 7, 1.05, -D / 2 + 0.5] }, 14));
      group.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 24), M.steel(), { pos: [W / 2 - 2, 0.98, -D / 2 + 1.2] }));
      for (let i = 0; i < 6; i++) group.add(mesh(new THREE.SphereGeometry(0.08, 10, 8), mat('cloth', { c1: [0xff8a2a, 0xffd23a, 0x6aa02a, 0xc81a2a][i % 4], c2: 0x3a2a10, p: [4, 0, 0, 0] }), { pos: [W / 2 - 2 + Math.sin(i) * 0.3, 1.07, -D / 2 + 1.2 + Math.cos(i) * 0.3] }));
    }
  }
  if (P.woodDoor) {
    if (art) {
      // "There is a locked door": on a wall with no doorway and no galley
      const k = ['left', 'right', 'ahead'].find((w) => !openings[w] && w !== galleyWall);
      if (k) {
        const [dx, dz, ry] = inside(k, 0.13);
        const d = lockedDoor();
        d.position.set(dx + (k === 'ahead' ? W * 0.3 : 0), 0, dz);
        d.rotation.y = ry;
        group.add(d);
      }
    } else if (!ex.left && !ex.right) {
      group.add(box(1.4, 2.4, 0.1, mat('wood', { c1: 0x7a5030, c2: 0x3a2412, p: [2, 0, 0, 0] }), { pos: [-W / 2 + 0.14, 1.2, 0], rot: [0, Math.PI / 2, 0] }));
    }
  }
  if (P.archway && !art) {
    const arch = mesh(new THREE.TorusGeometry(1.6, 0.18, 10, 24, Math.PI), M.ivory(), { pos: [0, 2.6, -D / 2 + 0.3] });
    group.add(arch);
  }
  if (P.boltedDoor) {
    if (art) {
      // "The door leading out is bolted shut from the outside": on a solid wall in view
      const k = ['ahead', relOf(1), 'left', 'right'].find((w) => !openings[w] && w !== 'back' && w !== relOf(3));
      if (k) {
        const [dx, dz, ry] = inside(k, 0.13);
        const d = boltedDoor();
        d.position.set(dx, 0, dz);
        d.rotation.y = ry;
        group.add(d);
      }
    } else {
      group.add(box(2.2, 2.6, 0.2, M.dark(), { pos: [0, 1.3, -D / 2 + 0.25] }));
      for (let i = 0; i < 3; i++) group.add(box(2.6, 0.12, 0.3, M.steel(), { pos: [0, 0.6 + i * 0.8, -D / 2 + 0.4] }));
    }
  }
  if (P.rubble) {
    if (art) {
      // wreckage heaps, clear of the stairs and the torn opening's climbing heap
      const keep = [];
      if (core) keep.push([core.bounds.x0 - 0.6, core.bounds.x1 + 0.6, core.bounds.z0 - 0.6, core.bounds.z1 + 1.2]);
      if (rent) keep.push([rent.c[0] - 2, rent.c[0] + 2, rent.c[1] - 2, rent.c[1] + 2]);
      const heaps = Math.max(1, Math.round(P.rubble / 7));
      let made = 0;
      for (let tries = 0; made < heaps && tries < 20; tries++) {
        const x = r.range(-W * 0.3, W * 0.3);
        const z = r.range(-D * 0.4, D * 0.15);
        const rad = Math.min(W * 0.3, 1.8);
        if (keep.some((k) => overlaps([x - rad, x + rad, z - rad, z + rad], k))) continue;
        const h = wreckage(rad, spec.seed + tries, { girders: 2 + (P.rubble > 10 ? 1 : 0), plates: 7 });
        h.position.set(x, 0, z);
        group.add(h);
        made++;
      }
      if (spec.place === 'lounge') {
        // what is left of the first-class lounge
        const so = sofa(art, 2.2);
        so.position.set(ex.right ? W / 2 - 1.8 : -W / 2 + 1.8, 0, D / 2 - 2.2);
        so.rotation.set(0, ex.right ? -2.2 : 2.2, 0.0);
        group.add(so);
        const so2 = sofa(art, 1.8);
        so2.position.set(0.4, 0.45, -D * 0.3);
        so2.rotation.set(Math.PI / 2 - 0.25, 0.4, 0);
        group.add(so2);
        const st = sideTable(art, { lamp: false });
        st.position.set(-0.8, 0.15, 0.6);
        st.rotation.set(0.2, 0.5, Math.PI / 2);
        group.add(st);
      }
    } else {
      group.add(girders(r, P.rubble, W * 0.4));
    }
  }
  if (P.holes) {
    // blast damage: torn, glowing-edged gashes in the walls
    for (let i = 0; i < 4; i++) {
      const side = r.pick([-1, 1]);
      const gw = r.range(0.5, 1.1);
      const gh = r.range(0.3, 0.7);
      const pos = [side * (W / 2 - 0.126), r.range(0.9, 2.5), r.range(-D / 2 + 2, D / 2 - 3)];
      let gash;
      if (art) {
        gash = blastGash(gw * 1.3, gh * 1.4, spec.seed + i);
        gash.position.set(...pos);
        gash.rotation.set(0, -side * Math.PI / 2, r.range(-0.5, 0.5));
      } else {
        gash = mesh(new THREE.PlaneGeometry(gw, gh), glowMat(0x2a0c02, 1), { pos, rot: [0, -side * Math.PI / 2, r.range(-0.5, 0.5)], shadow: false });
      }
      group.add(gash);
      const em = particles('embers', 12, { quality: ctx.quality, seed: 40 + i, pos: [pos[0] - side * 0.2, pos[1], pos[2]], spread: [0.1, 0.4, 0.5], vel: [-side * 0.1, 0.4, 0], size: 4 });
      group.add(em);
      ticks.push(em.userData.tick);
    }
  }
  if (P.blood || feat.has('blood')) {
    for (let i = 0; i < 5; i++) {
      const pos = art ? [r.range(-W * 0.25, W * 0.25), 0.003, D * 0.3 - i * D * 0.15] : [r.range(-W * 0.3, W * 0.3), 0.012, r.range(-D * 0.4, D * 0.3)];
      const rx = r.range(0.3, 0.9);
      if (art) group.add(mesh(blobGeo(rx, rx * r.range(0.5, 1), { t: 0.002, wobble: 0.35, lobes: 7, seed: spec.seed + i }), M.blood(), { pos, rot: [0, r.range(0, 3), 0], shadow: false }));
      else group.add(mesh(new THREE.CircleGeometry(rx, 16), M.blood(), { pos, rot: [-Math.PI / 2, 0, 0], scale: [1, r.range(0.5, 1), 1], shadow: false }));
    }
  }
  if (P.corpses || feat.has('corpses')) {
    const n = P.corpses || 3;
    if (art) {
      // "Gaping corpses litter the floor": fallen crew, not capsules
      const dead = crowd('corpses', n, r);
      dead.children.forEach((f, i) => {
        const s = i % 2 ? 1 : -1;
        f.position.set(s * r.range(0.3, W * 0.3), 0, D / 2 - 2.5 - i * ((D - 5) / Math.max(1, n - 1)));
        f.rotation.y = r.range(-Math.PI, Math.PI);
      });
      group.add(dead);
      ticks.push(dead.userData.update);
    } else {
      for (let i = 0; i < n; i++) {
        const geo = new THREE.CapsuleGeometry(0.25, 1.1, 4, 10);
        geo.rotateZ(Math.PI / 2);
        geo.scale(1, 0.5, 0.8);
        group.add(mesh(geo, mat('cloth', { c1: 0x3a3632, c2: 0x1a1816, p: [3, 0, 0, 0] }), { pos: [r.range(-W * 0.35, W * 0.35), 0.13, r.range(-D * 0.4, D * 0.3)], rot: [0, r.range(0, 3), 0] }));
      }
    }
  }

  // people from the room's description
  const crowdSpec = P.crowd;
  if (crowdSpec) {
    const [role, n0] = crowdSpec;
    const n = ctx.quality === 'low' ? Math.ceil(n0 / 2) : n0;
    const cw = crewWorld(role, spec.place, P, { W, D, spots, alert, r });
    const cr = crowd(role, n, r, cw ? { world: cw.world, walkers: cw.walkers, gait: cw.gait } : {});
    const seatsNear = seats.slice().sort((a, b) => b[1] - a[1]);
    if (!cw) {
      cr.children.forEach((f, i) => {
        if (role === 'ambassadors' && P.banquet) {
          // nearest places first, so the few (Low quality) sit where they are seen
          const [s, z0] = seatsNear[i % seatsNear.length];
          const x = s * (art ? 1.25 : 1.72);
          const z = art ? tableZ + z0 : -D * 0.38 + Math.floor(i / 2) * 2.3;
          f.position.set(x, 0, z);
          f.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
          if (!art) group.add(banquetChair(x, z, f.rotation.y));
        } else if (art && P.corpseSpot) {
          f.position.set(P.corpseSpot[0] * W, 0, P.corpseSpot[1] * D);
          f.rotation.y = P.corpseSpot[2];
        } else {
          f.position.set(r.range(-W * 0.35, W * 0.35), 0, r.range(-D * 0.4, D * 0.2));
          f.rotation.y = r.range(-Math.PI, Math.PI);
        }
      });
    }
    if (art && P.banquet) {
      // a dining chair at every place, the ambassadors' and the empty ones
      for (const [s, z0] of seats) {
        const c = diningChair();
        const ry = s > 0 ? -Math.PI / 2 : Math.PI / 2;
        c.position.set(s * 1.3, 0, tableZ + z0);
        c.rotation.y = ry;
        group.add(c);
      }
    }
    if (cw?.extra) group.add(cw.extra);
    group.add(cr);
    ticks.push(cr.userData.update);
  }
  // patients in the sick bay's beds
  if (P.beds && spots.beds.length) {
    const pts = crowd('wounded', Math.min(3, spots.beds.length), r);
    pts.children.forEach((f, i) => {
      const [bx, bz] = spots.beds[i * 2 % spots.beds.length];
      // on the mattress, feet toward the aisle end, face up
      f.position.set(bx, art ? 0.78 : 0.72, bz + 0.9);
      f.rotation.y = 0;
    });
    pts.userData.agents.forEach((a) => { a.task = 'lie'; a.target = poseOf('lie'); a.hold(null); });
    group.add(pts);
    ticks.push(pts.userData.update);
  }

  // hazard effects
  if (P.sparks || alert > 0.66) {
    for (let i = 0; i < (P.sparks ? 3 : 1); i++) {
      const sp = particles('sparks', 50, { quality: ctx.quality, seed: 10 + i, pos: [r.range(-W * 0.4, W * 0.4), H - 0.3, r.range(-D * 0.4, D * 0.2)] });
      group.add(sp);
      ticks.push(sp.userData.tick);
    }
  }
  // steam vents along the walls
  if (style.startsWith('mil') || style === 'galley') {
    const n = spec.place === 'hangar' ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const st = particles('steam', 40, { quality: ctx.quality, seed: 20 + i, pos: [r.pick([-1, 1]) * (W / 2 - 0.4), 0.2, r.range(-D * 0.3, D * 0.1)] });
      group.add(st);
      ticks.push(st.userData.tick);
      const px = st.position.x > 0 ? W / 2 - 0.25 : -W / 2 + 0.25;
      const pz = st.position.z - 0.5;
      if (art) {
        const inDoor = Object.entries(doorAt).some(([k, d]) => (k === 'left' || k === 'right') && Math.sign(d.x) === Math.sign(px) && Math.abs(pz - d.z) < 1.1);
        if (!inDoor && !(stairRect && overlaps([px - 0.2, px + 0.2, pz - 0.2, pz + 0.2], stairRect))) {
          const vp = ventPipe(H);
          vp.position.set(px, 0, pz);
          vp.rotation.y = px > 0 ? -Math.PI / 2 : Math.PI / 2;
          group.add(vp);
        }
      } else {
        group.add(cyl(0.12, 0.12, H, M.dark(), { pos: [px, H / 2, pz] }, 10));
      }
    }
  }
  // cable runs along the walls of the corridors
  if (art && (style.startsWith('mil') || med) && D >= 10 && W <= 5) {
    for (const s of [-1, 1]) {
      const k = s < 0 ? 'left' : 'right';
      const runs = doorAt[k] ? [[-D / 2 + 0.3, doorAt[k].z - 1.0], [doorAt[k].z + 1.0, D / 2 - 0.3]] : [[-D / 2 + 0.3, D / 2 - 0.3]];
      for (const [a, b] of runs) {
        if (b - a < 1) continue;
        const cd = conduits(b - a, Math.min(2.55, H - 0.6));
        cd.position.set(s * (W / 2 - 0.125), 0, (a + b) / 2);
        cd.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
        group.add(cd);
      }
    }
  }
  if (alert > 0.2 || P.dust || feat.has('rubble')) {
    const sm = particles(alert > 0.5 ? 'smoke' : 'motes', alert > 0.5 ? 30 : 60, { quality: ctx.quality, seed: 30, pos: [0, H * 0.6, -D * 0.1], spread: [W, H * 0.4, D], vel: [0.05, 0.08, 0], size: alert > 0.5 ? 200 : 3, alpha: alert > 0.5 ? 0.12 * alert : 0.3 });
    group.add(sm);
    ticks.push(sm.userData.tick);
  }
  // rotating alarm beacons
  const beacons = [];
  if (alert > 0.05 && style !== 'lux') {
    for (const s of [-1, 1]) {
      if (art) {
        const b = beacon();
        b.rotation.x = Math.PI; // hung from the ceiling
        b.position.set(s * (W / 2 - 0.4), H, -D * 0.2);
        group.add(b);
        beacons.push(b.userData.dome);
      } else {
        const b = new THREE.Group();
        b.add(cyl(0.12, 0.14, 0.2, M.dark(), {}, 10));
        const cone = mesh(new THREE.ConeGeometry(0.08, 0.1, 12), glowMat(0xff2010, 2.2), { pos: [0, 0.14, 0] });
        b.add(cone);
        b.position.set(s * (W / 2 - 0.3), H - 0.35, -D * 0.2);
        group.add(b);
        beacons.push(cone);
      }
    }
  }

  // ---------------------------------------------------------------- lights
  const hemiSky = lux ? 0xffd2a8 : med ? 0xd8fff8 : 0x8fa0bc;
  const warm = lux ? 0xffcf9a : med ? 0xe8fff8 : 0xffe0bc;
  const dimK = P.dim ? 0.35 : 1;
  if (parlor) {
    // one light for the two chandeliers (between them), warm light from the floor
    // above through the well, and a dimmer lamp in the stairwell going down
    points.push({ pos: [0, H - 0.4, 3.2], color: 0xffd6a0, intensity: 1.0 * size2 * dimK, distance: 0, flicker: 0.05 + alert * 0.3 });
    points.push({ pos: core.lights.above, color: 0xffe2b8, intensity: 0.9 * size2, distance: 0 });
    points.push({ pos: core.lights.below, color: 0xffc890, intensity: 0.18 * size2, distance: 0, flicker: 0.05 });
  } else if (lux) {
    for (const sd of [-1, 1]) points.push({ pos: [sd * Math.min(W / 2 - 0.5, W * 0.3), 2.1, -D * 0.12], color: warm, intensity: 0.7 * size2 * dimK, distance: 0, flicker: alert * 0.4 });
  } else {
    points.push({ pos: [0, H * 0.8, -D * 0.1], color: warm, intensity: 1.3 * size2 * dimK * (1 - alert * 0.3), distance: 0, flicker: alert * 0.5 });
  }
  // what is seen through a stair opening comes before the window and the alarm
  for (const l of extraLights) if (points.length < 3) points.push(l);
  const windowed = P.spaceWindow || feat.has('window') || P.bayDoor || P.overlook;
  if (windowed && points.length < 3) points.push({ pos: [0, 1.8, -D / 2 + 1.2], color: 0x8a9cff, intensity: (P.bayDoor ? 0.6 : 0.25) * size2, distance: 0, flicker: 0.1 });
  points.push({ pos: [W * 0.3, H - 0.5, -D * 0.35], color: 0xff2a10, intensity: ((lux ? 0.12 : 0.3) + alert * (lux ? 0.6 : 1.4)) * size2, distance: 0, strobe: 0.8 + alert * 2.4 });
  if ((P.consoles || P.tube) && points.length < 4) points.push({ pos: [0, 1.6, -D * 0.3], color: P.tube ? 0x9ab8ff : 0x5ad8ff, intensity: (P.tube ? 0.25 : 0.45) * size2, distance: 0 });
  if ((P.incinerator || P.sparks || P.wreck) && points.length < 4) points.push({ pos: [0, 1.2, -D / 2 + 1], color: 0xff6a20, intensity: 0.4 * size2, distance: 0, flicker: 0.8 });
  // ceiling fixtures (what the env map's bright bands stand for)
  if (!lux && !P.tube) {
    const n = Math.max(2, Math.round(D / 6));
    for (let i = 0; i < n; i++) {
      const z = D / 2 - (i + 0.5) * (D / n);
      const len = Math.min(W * 0.5, 6);
      if (art) {
        if (ceilHoles.some((h) => overlaps(bbox(h), [-len / 2, len / 2, z - 0.3, z + 0.3]))) continue;
        const lf = lightFitting(len, med ? 0xe8fff8 : 0xfff0d8, P.dim ? 0.5 : 1.5);
        lf.position.set(0, H, z);
        group.add(lf);
      } else {
        group.add(box(len, 0.06, 0.35, glowMat(med ? 0xe8fff8 : 0xfff0d8, P.dim ? 0.5 : 1.5), { pos: [0, H - 0.05, z], shadow: false }));
      }
    }
  }

  const view = {
    group,
    camera: {
      pos: P.overlook ? [0, 1.7, D / 2 - 1.2] : [0, 1.65, D / 2 - 1.1],
      look: P.overlook ? [0, -4.5, -D / 2 - 18] : [0, 1.5, -D / 2 + 1],
      fov: W > 20 ? 66 : 62,
    },
    lights: {
      hemi: { sky: hemiSky, ground: 0x2a2420, intensity: (lux ? 0.45 : 0.75) * dimK },
      key: { dir: [0.3, 1, 0.4], color: warm, intensity: (lux ? 0.5 : 1.1) * dimK, shadow: true },
      points,
    },
    fog: { color: P.chill ? 0x0a1420 : alert > 0.5 ? 0x140a08 : 0x06070a, density: (W > 20 ? 0.012 : 0.02) + alert * 0.03 + (P.chill ? 0.03 : 0) },
    background: 0x020203,
    sky: null,
    env: lux ? 'ship-lux' : med ? 'ship-med' : 'ship-mil',
    envIntensity: P.dim ? 0.4 : 0.9,
    focus,
    largeSpots: P.tube ? [[0, 0, -3]] : P.fighters ? [[0, 0, -6], [5, 0, -9], [-5, 0, -10]] : undefined,
    grade: {
      exposure: 0.95, saturation: lux ? 0.95 : 0.9, contrast: 1.06,
      tint: lux ? [1.03, 1.0, 0.95] : med ? [0.95, 1.02, 1.03] : [0.98, 1.0, 1.04], vignette: 0.45, bloom: 0.45, threshold: 1.5,
    },
    update(t) {
      for (const f of ticks) if (f) f(t);
      for (const c of beacons) c.parent.rotation.y = t * 5;
    },
    fx(type) {
      if (type === 'explosions') view.shake = 1;
    },
  };
  return view;
}
