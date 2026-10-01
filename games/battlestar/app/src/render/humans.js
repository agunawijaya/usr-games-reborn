// People: modelled, clothed bodies on a small skeleton, animated
// procedurally — a gait cycle driven by the distance walked (so feet do not
// slide), idle weight shifts and glances, and work poses (typing at a
// console, reading a tablet, carrying, kneeling, tending the wounded,
// standing guard, sitting hurt against a wall). An agent moves each person
// between work stations along aisles, turning and slowing like a person.
//
// Forward is +z in a person's own frame; y is up; the soles are at y = 0.
// Sign conventions: hip/shoulder flexion (limb forward) is negative x;
// knee flexion (shin back) is positive x; elbow flexion is negative x;
// spine and neck lean forward is positive x; ankle plantarflexion positive x.
// Presentation guardrails (ADR-009): everyone is clothed; nothing explicit.

import * as THREE from 'three';
import { mat } from './materials.js';
import { mesh } from './geo.js';
import { latheGeo, roundedBoxGeo, tubeGeo, weldNormals } from './model.js';
import { GAITS, locomotion } from './gait.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (u) => u * u * (3 - 2 * u);

// ---------------------------------------------------------------- geometry

const GEO = new Map();
function cached(key, make) {
  if (!GEO.has(key)) { const g = make(); g.userData.shared = true; GEO.set(key, g); }
  return GEO.get(key);
}

/** A lathe with an elliptical cross-section (sx across, sz front-back). */
function body(profile, sx, sz, seg = 22) {
  const g = latheGeo(profile, seg);
  g.scale(sx, 1, sz);
  return weldNormals(g);
}

/** A limb segment hanging from 0 down to -len, radius r0 at the top, r1 at the bottom, with an optional muscle bulge. */
function limb(len, r0, r1, bulge = 0, bulgeAt = 0.6, seg = 14) {
  const pts = [[0, -len - r1 * 0.55], [r1 * 0.72, -len - r1 * 0.38], [r1, -len]];
  for (let i = 1; i < 8; i++) {
    const t = i / 8;
    const r = lerp(r1, r0, t) + bulge * Math.exp(-((t - bulgeAt) ** 2) / 0.05);
    pts.push([r, -len + t * len]);
  }
  pts.push([r0, 0], [r0 * 0.72, r0 * 0.38], [0, r0 * 0.55]);
  return weldNormals(latheGeo(pts, seg));
}

function shapes(sex) {
  const f = sex === 'f';
  return cached(`body-${sex}`, () => {
    const o = new THREE.BufferGeometry();
    o.userData.parts = {
      pelvis: body(f
        ? [[0, -0.125], [0.1, -0.12], [0.168, -0.07], [0.18, 0], [0.168, 0.06], [0.14, 0.1], [0.1, 0.12], [0, 0.125]]
        : [[0, -0.125], [0.09, -0.12], [0.153, -0.07], [0.168, 0], [0.163, 0.06], [0.148, 0.1], [0.11, 0.12], [0, 0.125]], 1, 0.74),
      abdomen: body(f
        ? [[0, -0.07], [0.1, -0.065], [0.13, -0.02], [0.126, 0.06], [0.132, 0.13], [0.12, 0.17], [0, 0.18]]
        : [[0, -0.07], [0.11, -0.065], [0.143, -0.02], [0.141, 0.06], [0.148, 0.13], [0.135, 0.17], [0, 0.18]], 1, 0.72),
      chest: body(f
        ? [[0, -0.08], [0.11, -0.075], [0.138, -0.02], [0.148, 0.04], [0.152, 0.1], [0.145, 0.16], [0.128, 0.2], [0.09, 0.235], [0.05, 0.25], [0, 0.255]]
        : [[0, -0.08], [0.12, -0.075], [0.152, -0.02], [0.17, 0.04], [0.177, 0.1], [0.172, 0.16], [0.154, 0.2], [0.105, 0.235], [0.055, 0.25], [0, 0.255]], 1, 0.66),
      delt: (() => { const g = new THREE.SphereGeometry(f ? 0.046 : 0.052, 18, 14); g.scale(1, 1.15, 1); return g; })(),
      upper: limb(0.28, f ? 0.05 : 0.057, f ? 0.043 : 0.048, 0.003, 0.62),
      fore: limb(0.245, f ? 0.042 : 0.047, f ? 0.034 : 0.038, 0.004, 0.7),
      hand: (() => { const g = roundedBoxGeo(0.028, f ? 0.085 : 0.095, f ? 0.064 : 0.072, 0.013, 3, 1); g.translate(0, -0.05, 0.004); return g; })(),
      thumb: (() => { const g = new THREE.CapsuleGeometry(0.011, 0.035, 4, 8); g.rotateX(-0.5); g.translate(0, -0.03, 0.038); return g; })(),
      thigh: limb(0.42, f ? 0.092 : 0.095, f ? 0.066 : 0.07, 0.004, 0.75),
      shin: limb(0.425, f ? 0.064 : 0.068, f ? 0.056 : 0.06, 0.003, 0.72),
      shoe: (() => { const g = roundedBoxGeo(f ? 0.082 : 0.094, 0.078, f ? 0.225 : 0.25, 0.034, 3, 2); g.translate(0, -0.047, 0.05); return g; })(),
      neck: (() => { const g = new THREE.CylinderGeometry(f ? 0.043 : 0.05, f ? 0.047 : 0.055, 0.11, 14); g.translate(0, 0.03, 0); return g; })(),
      skull: (() => { const g = new THREE.SphereGeometry(0.1, 26, 20); g.scale(f ? 0.86 : 0.9, f ? 1.08 : 1.12, f ? 0.98 : 1.02); g.translate(0, 0.095, -0.005); return g; })(),
      jaw: (() => { const g = new THREE.SphereGeometry(0.07, 18, 14); g.scale(f ? 0.92 : 1.02, 0.72, 0.95); g.translate(0, 0.035, 0.028); return g; })(),
      nose: (() => { const g = new THREE.ConeGeometry(0.013, 0.035, 8); g.rotateX(Math.PI / 2 + 0.35); g.translate(0, 0.085, 0.1); return g; })(),
      ear: (() => { const g = new THREE.SphereGeometry(0.022, 10, 8); g.scale(0.45, 1, 0.8); return g; })(),
      eye: new THREE.SphereGeometry(0.011, 10, 8),
      brow: (() => { const g = new THREE.CapsuleGeometry(0.006, 0.03, 3, 6); g.rotateZ(Math.PI / 2); return g; })(),
      hairShort: (() => { const g = new THREE.SphereGeometry(0.108, 24, 14, 0, TAU, 0, Math.PI * 0.55); g.scale(f ? 0.9 : 0.94, 1.12, 1.06); g.rotateX(-0.25); g.translate(0, 0.105, -0.018); return g; })(),
      // long hair: falls behind and beside the face to the shoulders, open at the front
      hairLong: (() => {
        const pts = [[0.07, -0.19], [0.1, -0.12], [0.114, -0.02], [0.118, 0.07], [0.112, 0.15], [0.09, 0.2], [0.05, 0.225], [0.001, 0.232]].map(([r, y]) => new THREE.Vector2(r, y));
        const g = new THREE.LatheGeometry(pts, 26, 0.9, TAU - 1.8);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { const y = p.getY(i); const a = Math.atan2(p.getX(i), p.getZ(i)); if (y < 0.02) p.setY(i, y + 0.012 * Math.sin(a * 9)); }
        g.scale(f ? 0.96 : 1, 1, 0.94); g.translate(0, -0.035, 0.012); g.computeVertexNormals(); return g;
      })(),
      bun: new THREE.SphereGeometry(0.045, 14, 10),
    };
    return o;
  }).userData.parts;
}

// ---------------------------------------------------------------- materials

const SKIN = [0xf1c8a8, 0xe3b08c, 0xcf9670, 0xa86f4c, 0x80503a, 0x5b3726];
const HAIR = [0x16110e, 0x2e1e14, 0x4d3220, 0x7a5634, 0xb4905c, 0x8a8a88];
const cloth = (c, sheen = 0.2) => mat('fabric', { c1: c, c2: new THREE.Color(c).multiplyScalar(0.72).getHex(), p: [1.3, sheen, 0, 0.6] });
const skinM = (c) => mat('matte', { c1: c, c2: new THREE.Color(c).multiplyScalar(1.04).getHex(), p: [0.55, 1.8, 0, 0] });
const plain = (c, rough = 0.5, metal = 0) => mat('matte', { c1: c, p: [rough, 0, metal, 0] });

/** Outfits by role. Colours: top, bottom, shoes, extras. */
const OUTFITS = {
  technicians: { top: 0x3c5a78, bottom: 0x2e4056, shoes: 0x1a1a1c, belt: 0x22201e, extras: ['headset', 'collar', 'patch'], sleeves: 'rolled' },
  pilots: { top: 0x8a6a3a, bottom: 0x7a5e34, shoes: 0x241c14, belt: 0x2a2018, extras: ['harness', 'helmet', 'collar'], gloves: 0x2a2420 },
  guards: { top: 0x2a2f36, bottom: 0x23272d, shoes: 0x121214, belt: 0x16161a, extras: ['vest', 'helmet', 'rifle'], gloves: 0x1a1a1c },
  nurses: { top: 0xe8eef0, bottom: 0xdfe6e8, shoes: 0xf0f0f0, extras: ['cap', 'collar'], sleeves: 'short' },
  wounded: { top: 0x4a5566, bottom: 0x3a4250, shoes: 0x1a1a1c, belt: 0x22201e, extras: ['bandage', 'collar'] },
  corpses: { top: 0x3e4654, bottom: 0x323844, shoes: 0x1a1a1c, belt: 0x22201e, extras: [] },
  ambassadors: { top: 0x5a1a4a, bottom: 0x4a1640, shoes: 0x1a1414, extras: ['robe', 'sash'], robe: [0x5a1a4a, 0x1a3a5a, 0x3a4a1a, 0x6a4a1a, 0x2a2a3a] },
  crew: { top: 0x55606c, bottom: 0x3e4650, shoes: 0x1a1a1c, belt: 0x22201e, extras: ['collar'] },
  // the island's people: women in dresses (bare lower legs, sandals), men in shirts and trousers
  dancers: { top: 0xd8663a, bottom: 0x2a2a34, shoes: 0x5a3a24, extras: [], sleeves: 'short', palette: [0xd8663a, 0x2a8a8a, 0xe0b040, 0xb8386a, 0xf0e6d0],
    f: { extras: ['dressShort', 'earrings'], shoes: 0x8a5a3a }, m: { extras: ['collar'], palette: [0xf0ece0, 0x2a6a8a, 0xc8583a, 0x3a3a48, 0xe8d8a0] } },
  natives: { top: 0xe8dcc0, bottom: 0x6a4a2a, shoes: 0x4a3420, extras: ['sarong', 'lei'], sleeves: 'short', palette: [0xe8dcc0, 0xc86a3a, 0x3a7a6a, 0xe0b848], sarong: [0x6a4a2a, 0x2a4a6a, 0x8a3a2a, 0x3a5a3a],
    f: { extras: ['sarong', 'lei', 'flower'], palette: [0xc84a3a, 0xe8b048, 0x2a8a7a, 0xf0e0c8], sarong: [0x2a6a8a, 0xd8a040, 0x8a2a4a, 0x2a7a5a, 0xf0e6d0] } },
  guests: { top: 0xf2ece0, bottom: 0x3a3a44, shoes: 0x2a2020, extras: ['collar'], sleeves: 'short', palette: [0xf2ece0, 0xd8b0a0, 0x9ab8d8, 0xe8d890, 0xc0c8a8],
    f: { extras: ['dressShort', 'earrings'], shoes: 0xc8a888, palette: [0xf2d0c8, 0x9ab8d8, 0xe8d890, 0xf6f2ea, 0xc8e0c0] }, m: { bottom: 0xd8d0c0 } },
  men: { top: 0xe8e0d0, bottom: 0x5a4a36, shoes: 0x3a2a1c, extras: ['collar'], sleeves: 'rolled', palette: [0xe8e0d0, 0xb8c8d8, 0xd8c098, 0x8a9a7a] },
  girls: { top: 0xe8a0a0, bottom: 0xe8a0a0, shoes: 0xc89878, extras: ['dressShort'], sleeves: 'short', palette: [0xe8a0a0, 0xa0c8e8, 0xf0e090] },
  bar: { top: 0xe0d8c8, bottom: 0x3a3230, shoes: 0x2a2020, extras: ['collar'], sleeves: 'short', palette: [0xe0d8c8, 0x8aa0b8, 0xc8a080, 0x7a8a6a],
    f: { extras: ['dressShort', 'earrings'], palette: [0x6a1a2a, 0x1a2a4a, 0xd8c0a0] } },
  // named characters
  elf: { top: 0x3e5a2a, bottom: 0x4a3a26, shoes: 0x3a2616, belt: 0x2a1a0e, tunic: 0x355024, hood: 0x2e4420, extras: ['tunic', 'hood', 'boots', 'bracers', 'elfEars'], bracer: 0x5a3a1e },
  woodsman: { top: 0xa8281e, plaid: 0x120c0a, bottom: 0x3a3a2e, shoes: 0x2a1c12, belt: 0x2a1a10, hat: 0x2a2a2e, extras: ['beard', 'beanie', 'boots', 'suspenders'], sleeves: 'rolled', strap: 0x3a2616 },
  darklord: { top: 0x16141a, bottom: 0x121016, shoes: 0x0a0a0c, gloves: 0x0e0e10, belt: 0x1a1818, skin: 0x0b0a0d, eyeGlow: 0xb070ff, armor: 0x24222a, hood: 0x0e0d10, cape: 0x0c0b0e,
    extras: ['armor', 'pauldrons', 'cape', 'hoodUp', 'boots', 'bracers'], bracer: 0x24222a },
  suit: { top: 0xf2efe6, bottom: 0xefebe2, shoes: 0xf0ece4, shirt: 0xb8cce0, tie: 0x7a1a2a, hat: 0xece2c8, band: 0x2a1e18, extras: ['jacket', 'collar', 'panama', 'moustache'] },
  dwarf: { top: 0x6a3a1e, bottom: 0x4a3a2a, shoes: 0x2a1a10, belt: 0x1a120a, tunic: 0x5a3018, hood: 0x3a5a3a, hoodPoint: true, extras: ['tunic', 'beardLong', 'hoodUp', 'boots'] },
  swarthy: { top: 0x5a1a26, bottom: 0x5a1a26, shoes: 0x1a1010, shawl: 0x1c1a26, extras: ['dress', 'shawl', 'earrings'], sleeves: 'long' },
  nativegirl: { top: 0xc84a3a, bottom: 0x2a7a6a, shoes: 0x4a3420, lei: [0xf04a6a, 0xffd040, 0xffffff], flower: 0xf0506a, extras: ['lei', 'flower'], sleeves: 'short' },
  oldtimer: { top: 0x8a7a5a, bottom: 0x4a4036, shoes: 0x2a2018, belt: 0x2a1a10, vest: 0x3a2e24, hat: 0x5a5044, beard: 0x9a9690, extras: ['waistcoat', 'flatcap', 'stubble', 'eyepatch'], sleeves: 'rolled' },
  goddess: { top: 0xffffff, bottom: 0xffffff, shoes: 0xffffff, extras: ['dress'] },
};

// ---------------------------------------------------------------- the body

/**
 * Builds one person. o: { sex, height, skin, hair, hairStyle, outfit (a role
 * name or an OUTFITS entry), material (one material for everything: the
 * silhouettes of the island's characters), seed }.
 * Returns the root Group with userData.rig.
 */
export function buildHuman(o = {}) {
  const sex = o.sex || 'm';
  const f = sex === 'f';
  const S = shapes(sex);
  let fit = typeof o.outfit === 'string' ? OUTFITS[o.outfit] || OUTFITS.crew : o.outfit || OUTFITS.crew;
  if (fit[sex]) fit = { ...fit, ...fit[sex] };
  const ex = new Set([...(fit.extras || []), ...(o.extras || [])]);
  const one = o.material || null;
  const pick = (a) => a[Math.floor((o.seed ?? 0) * 7919) % a.length];
  const topC = o.top ?? (fit.palette ? pick(fit.palette) : fit.top);
  const skirted = ex.has('skirt') || ex.has('dressShort') || ex.has('dress');
  const skinC = fit.skin ?? o.skin ?? SKIN[2];
  const M = {
    skin: one || skinM(skinC),
    hair: one || plain(o.hair ?? HAIR[1], 0.55),
    top: one || (fit.plaid ? mat('fabric', { c1: topC, c2: fit.plaid, p: [0.16, 0.1, 0, 0.5] }) : cloth(topC)),
    bottom: one || cloth(skirted ? topC : o.bottom ?? fit.bottom),
    shoes: one || plain(fit.shoes, 0.35),
    gloves: one || (fit.gloves ? plain(fit.gloves, 0.6) : null),
    belt: one || plain(fit.belt ?? 0x2a2420, 0.4),
    eye: one || (fit.eyeGlow ? mat('glow', { c1: fit.eyeGlow, p: [3, 0.2, 0, 0] }) : plain(0x1a1614, 0.2)),
    metal: one || mat('metal', { c1: 0x8a9098, c2: 0x3a3e44, p: [0.35, 0.2, 0, 0] }),
    gold: one || mat('gold', { c1: 0xd8a848, c2: 0xffffff, p: [0.3, 0.2, 0, 0] }),
    white: one || cloth(0xf4f2ee, 0.1),
  };
  // below a dress or skirt the lower legs are bare (or stockinged)
  M.shin = one || (skirted || ex.has('sarong') ? (fit.stockings ? cloth(fit.stockings, 0.4) : skinM(skinC)) : M.bottom);
  const add = (parent, geo, m, pos, rot, scale) => {
    const x = mesh(geo, m, { pos, rot, scale });
    parent.add(x);
    return x;
  };
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.97;
  root.add(hips);
  add(hips, S.pelvis, M.bottom);
  if (fit.belt !== undefined || ex.has('harness')) {
    // a belt hugging the waist (the abdomen's radius there is ~0.14 × 0.72)
    const b = cached(`belt${f}`, () => { const q = new THREE.TorusGeometry(f ? 0.128 : 0.142, 0.016, 8, 32); q.rotateX(Math.PI / 2); q.scale(1, 1.4, 0.74); return q; });
    add(hips, b, M.belt, [0, 0.09, 0]);
    add(hips, cached('buckle', () => roundedBoxGeo(0.05, 0.036, 0.012, 0.004, 2, 1)), M.gold, [0, 0.09, (f ? 0.128 : 0.142) * 0.74 + 0.012]);
  }
  const spine = new THREE.Group();
  spine.position.y = 0.1;
  hips.add(spine);
  add(spine, S.abdomen, M.top);
  const chest = new THREE.Group();
  chest.position.y = 0.18;
  spine.add(chest);
  add(chest, S.chest, M.top);
  const neck = new THREE.Group();
  neck.position.y = 0.25;
  chest.add(neck);
  add(neck, S.neck, M.skin);
  const head = new THREE.Group();
  head.position.y = 0.06;
  neck.add(head);
  add(head, S.skull, M.skin);
  add(head, S.jaw, M.skin);
  add(head, S.nose, M.skin);
  for (const s of [-1, 1]) {
    add(head, S.ear, M.skin, [s * (f ? 0.086 : 0.091), 0.085, -0.01]);
    add(head, S.eye, M.eye, [s * 0.034, 0.105, 0.087]);
    add(head, S.brow, M.hair, [s * 0.036, 0.125, 0.09], [0, 0, -s * 0.12]);
  }
  const hairStyle = o.hairStyle || (f ? 'long' : 'short');
  const helmet = ex.has('helmet');
  if (helmet) {
    const hg = cached('helmet', () => { const q = new THREE.SphereGeometry(0.122, 24, 14, 0, TAU, 0, Math.PI * 0.58); q.scale(0.96, 1.05, 1.08); return q; });
    add(head, hg, fit === OUTFITS.pilots ? plain(0xd8d4c8, 0.35) : plain(0x2a3038, 0.4), [0, 0.1, -0.01]);
    if (fit === OUTFITS.pilots) {
      const v = new THREE.SphereGeometry(0.126, 20, 10, -0.9, 1.8, Math.PI * 0.32, Math.PI * 0.2);
      add(head, v, one || mat('metal', { c1: 0x1a2430, c2: 0x0a0e14, p: [0.08, 0, 0, 0] }), [0, 0.1, 0]);
    }
  } else if (hairStyle !== 'none') {
    add(head, S.hairShort, M.hair);
    if (hairStyle === 'long') add(head, S.hairLong, one || mat('matte', { c1: o.hair ?? HAIR[1], p: [0.55, 0, 0, 0], side: THREE.DoubleSide }), [0, 0.02, -0.03]);
    if (hairStyle === 'bun') add(head, S.bun, M.hair, [0, 0.13, -0.1]);
  }
  if (ex.has('cap')) {
    const c = cached('nurseCap', () => new THREE.CylinderGeometry(0.075, 0.09, 0.05, 18));
    add(head, c, M.white, [0, 0.2, -0.02], [-0.2, 0, 0]);
  }
  if (ex.has('headset')) {
    const band = new THREE.TorusGeometry(0.105, 0.007, 6, 20, Math.PI);
    add(head, band, M.metal, [0, 0.1, -0.01], [0, 0, 0]);
    add(head, new THREE.CylinderGeometry(0.028, 0.028, 0.02, 12), M.metal, [-0.098, 0.09, -0.01], [0, 0, Math.PI / 2]);
    const mic = new THREE.CapsuleGeometry(0.004, 0.08, 3, 6);
    add(head, mic, M.metal, [-0.08, 0.05, 0.05], [0.9, 0.5, 0]);
  }
  if (ex.has('bandage') && (o.seed ?? 0) > 0.4) {
    const bd = new THREE.TorusGeometry(0.1, 0.018, 8, 24);
    bd.rotateX(Math.PI / 2 - 0.25);
    bd.scale(0.95, 1, 1.04);
    add(head, bd, M.white, [0, 0.12, -0.005]);
  }
  if (ex.has('collar')) {
    const c = cached('collar', () => { const q = new THREE.TorusGeometry(0.058, 0.014, 8, 20); q.rotateX(Math.PI / 2); return q; });
    add(chest, c, M.top, [0, 0.245, 0.005]);
  }
  if (ex.has('vest')) {
    const v = roundedBoxGeo(0.34, 0.34, 0.25, 0.06, 3, 1);
    add(chest, v, plain(0x3a4048, 0.55), [0, 0.1, 0.005]);
  }
  if (ex.has('harness')) {
    for (const s of [-1, 1]) {
      const st = new THREE.TorusGeometry(0.16, 0.012, 6, 20, Math.PI);
      add(chest, st, M.belt, [s * 0.06, 0.02, 0], [0, Math.PI / 2, 0], [1, 1.35, 0.72]);
    }
  }
  if (ex.has('patch')) add(chest, roundedBoxGeo(0.05, 0.05, 0.01, 0.006, 2, 1), M.gold, [-0.1, 0.14, 0.108]);
  if (ex.has('sash')) {
    const sa = new THREE.TorusGeometry(0.2, 0.025, 6, 24);
    add(chest, sa, M.gold, [0, 0.06, 0], [0.2, 0, 0.9], [0.75, 1, 0.55]);
  }
  // arms
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(s * (f ? 0.168 : 0.19), 0.185, -0.005);
    chest.add(sh);
    add(sh, S.delt, M.top, [-s * 0.012, -0.012, 0]);
    add(sh, S.upper, M.top);
    const el = new THREE.Group();
    el.position.y = -0.28;
    sh.add(el);
    const sleeve = fit.sleeves === 'short' ? M.skin : M.top;
    add(el, S.fore, fit.sleeves === 'rolled' ? M.skin : sleeve);
    if (fit.sleeves === 'rolled') {
      const cuff = new THREE.TorusGeometry(0.04, 0.011, 6, 16);
      cuff.rotateX(Math.PI / 2);
      add(el, cuff, M.top, [0, -0.02, 0]);
    }
    const wr = new THREE.Group();
    wr.position.y = -0.245;
    el.add(wr);
    const hand = M.gloves || M.skin;
    add(wr, S.hand, hand);
    add(wr, S.thumb, hand);
    arms.push({ sh, el, wr, side: s });
  }
  // legs
  const legs = [];
  for (const s of [-1, 1]) {
    const th = new THREE.Group();
    th.position.set(s * (f ? 0.09 : 0.095), -0.04, 0);
    hips.add(th);
    add(th, S.thigh, M.bottom);
    const kn = new THREE.Group();
    kn.position.y = -0.42;
    th.add(kn);
    add(kn, S.shin, M.shin);
    const an = new THREE.Group();
    an.position.y = -0.425;
    kn.add(an);
    add(an, S.shoe, M.shoes);
    if (o.legScale) th.scale.y = o.legScale;
    legs.push({ th, kn, an, side: s });
  }
  // skirts and robes hang from the hips and flare
  if (ex.has('robe')) {
    const rc = fit.robe ? pick(fit.robe) : fit.top;
    const rg = cached('robe', () => { const q = latheGeo([[0.17, 0.12], [0.2, 0], [0.24, -0.3], [0.29, -0.6], [0.32, -0.88], [0.31, -0.9]], 28); q.scale(1, 1, 0.85); return q; });
    add(hips, rg, one || mat('fabric', { c1: rc, c2: new THREE.Color(rc).multiplyScalar(0.72).getHex(), p: [1.3, 0.4, 0, 0.6], side: THREE.DoubleSide }));
  }
  if (ex.has('skirt') || ex.has('sarong')) {
    const long = ex.has('sarong');
    const sg = cached(`skirt${long}`, () => { const q = latheGeo([[0.165, 0.1], [0.19, 0], [0.24, long ? -0.4 : -0.25], [0.27, long ? -0.66 : -0.4]], 26); q.scale(1, 1, 0.85); return q; });
    // a sarong is its own cloth, not the top's
    const wrapC = long && fit.sarong ? fit.sarong[Math.floor((o.seed ?? 0) * 104729) % fit.sarong.length] : topC;
    add(hips, sg, one || mat('fabric', { c1: wrapC, c2: new THREE.Color(wrapC).multiplyScalar(0.7).getHex(), p: [1.1, 0.2, 0.3, 0.6], c3: new THREE.Color(wrapC).lerp(new THREE.Color(0xfff4e0), 0.55).getHex(), side: THREE.DoubleSide }));
  }
  const rig = { hips, spine, chest, neck, head, arms, legs, legLift: o.legScale ? -0.931 * (1 - o.legScale) : 0 };
  accessorize(ex, fit, rig, S, M, f, one, o, topC);
  root.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  const k = (o.height ?? (f ? 1.66 : 1.77)) / 1.76;
  root.scale.setScalar(k);
  root.userData.rig = rig;
  root.userData.materials = M;
  return root;
}

// ---------------------------------------------------------------- clothes and faces

const clothDS = (c, sheen = 0.2) => mat('fabric', { c1: c, c2: new THREE.Color(c).multiplyScalar(0.72).getHex(), p: [1.3, sheen, 0, 0.6], side: THREE.DoubleSide });
const mixHex = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();

/** Merges geometries (position + normal) into one, so a many-part detail is one draw. */
function mergeParts(list) {
  const pos = [];
  const nor = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

const CHEST = {
  m: [[0.12, -0.075], [0.152, -0.02], [0.17, 0.04], [0.177, 0.1], [0.172, 0.16], [0.154, 0.2], [0.105, 0.235], [0.055, 0.25]],
  f: [[0.11, -0.075], [0.138, -0.02], [0.148, 0.04], [0.152, 0.1], [0.145, 0.16], [0.128, 0.2], [0.09, 0.235], [0.05, 0.25]],
};
/**
 * A piece of cloth (shirt front, tie, lapel) laid onto the front of the
 * chest, bent to follow its curve, `lift` metres proud of it. rows:
 * [[y, xLeft, xRight], ...] in chest coordinates, bottom to top.
 * sc: the scale of the chest shell under it.
 */
function onChest(rows, f, lift, sc = [1, 1, 1], nx = 6, ny = 12) {
  const prof = CHEST[f ? 'f' : 'm'];
  const [sx, sy, sz] = sc;
  const r = (y) => {
    y /= sy;
    if (y <= prof[0][1]) return prof[0][0];
    for (let i = 1; i < prof.length; i++) if (y <= prof[i][1]) { const [r0, y0] = prof[i - 1]; const [r1, y1] = prof[i]; return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0); }
    return prof[prof.length - 1][0];
  };
  const edge = (y) => {
    for (let i = 1; i < rows.length; i++) {
      if (y <= rows[i][0] + 1e-9) { const [ya, la, ra] = rows[i - 1]; const [yb, lb, rb] = rows[i]; const t = (y - ya) / (yb - ya); return [la + (lb - la) * t, ra + (rb - ra) * t]; }
    }
    return [rows[rows.length - 1][1], rows[rows.length - 1][2]];
  };
  const y0 = rows[0][0];
  const y1 = rows[rows.length - 1][0];
  const pos = [];
  const idx = [];
  for (let j = 0; j <= ny; j++) {
    const y = y0 + ((y1 - y0) * j) / ny;
    const [l, rr] = edge(y);
    for (let i = 0; i <= nx; i++) {
      const x = l + ((rr - l) * i) / nx;
      const R = r(y) * sx;
      pos.push(x, y, R * 0.66 * sz * Math.sqrt(Math.max(0, 1 - (x / R) ** 2)) + lift);
    }
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + nx + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A five-petal blossom facing +z. */
function blossomGeo(r) {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const p = new THREE.SphereGeometry(r * 0.55, 8, 6);
    p.scale(0.62, 1, 0.3);
    p.translate(0, r * 0.55, 0);
    p.rotateZ((i / 5) * TAU);
    parts.push(p);
  }
  const c = new THREE.SphereGeometry(r * 0.2, 6, 5);
  c.translate(0, 0, r * 0.1);
  parts.push(c);
  return mergeParts(parts);
}

/**
 * Clothes and features beyond the basic outfit: hats, hoods, a cape,
 * armour, a suit's jacket and tie, waistcoat, shawl, dresses, beards,
 * an eye patch, pointed ears, a lei, flowers, earrings, boots, bracers.
 */
function accessorize(ex, fit, rig, S, M, f, one, o, topC) {
  const { hips, spine, chest, head, arms, legs } = rig;
  const add = (parent, geo, m, pos, rot, scale) => { const x = mesh(geo, m, { pos, rot, scale }); parent.add(x); return x; };
  const C = (c, sheen) => one || cloth(c, sheen);
  const CD = (c, sheen) => one || clothDS(c, sheen);
  const P = (c, r = 0.5, m = 0) => one || plain(c, r, m);
  const hairC = o.hair ?? HAIR[1];
  // ---- faces
  if (ex.has('beard') || ex.has('beardLong')) {
    const bm = P(fit.beard ?? hairC, 0.75);
    add(head, cached('beard', () => { const g = new THREE.SphereGeometry(0.08, 20, 14, 0, TAU, Math.PI * 0.36, Math.PI * 0.64); g.scale(1.1, 0.95, 0.9); g.translate(0, 0.035, 0.03); return g; }), bm);
    for (const s of [-1, 1]) add(head, cached('mst', () => { const g = new THREE.CapsuleGeometry(0.008, 0.026, 3, 8); g.rotateZ(Math.PI / 2); return g; }), bm, [s * 0.018, 0.064, 0.096], [0, s * 0.3, -s * 0.28]);
    if (ex.has('beardLong')) add(head, cached('beardLong', () => { const g = latheGeo([[0.001, -0.24], [0.025, -0.21], [0.055, -0.12], [0.072, -0.03], [0.07, 0.02], [0, 0.04]], 16); g.scale(1, 1, 0.62); return weldNormals(g); }), bm, [0, 0.005, 0.06], [0.28, 0, 0]);
  }
  if (ex.has('moustache')) for (const s of [-1, 1]) add(head, cached('mstThin', () => { const g = new THREE.CapsuleGeometry(0.004, 0.024, 3, 6); g.rotateZ(Math.PI / 2); return g; }), P(hairC, 0.6), [s * 0.016, 0.066, 0.097], [0, s * 0.3, -s * 0.18]);
  if (ex.has('stubble')) add(head, cached('stubble', () => { const g = new THREE.SphereGeometry(0.0712, 18, 12, 0, TAU, Math.PI * 0.42, Math.PI * 0.58); g.scale(1.03, 0.73, 0.97); g.translate(0, 0.035, 0.028); return g; }), one || mat('matte', { c1: mixHex(o.skin ?? SKIN[2], fit.beard ?? hairC, 0.45), p: [0.9, 0, 0, 0] }));
  if (ex.has('eyepatch')) {
    const pm = P(0x0c0a08, 0.6);
    add(head, cached('patch', () => { const g = new THREE.SphereGeometry(0.021, 12, 8, 0, TAU, 0, Math.PI * 0.42); g.rotateX(Math.PI / 2); g.scale(1.1, 0.9, 0.55); return g; }), pm, [0.035, 0.106, 0.09]);
    add(head, cached('patchStrap', () => new THREE.TorusGeometry(0.104, 0.0025, 4, 40)), pm, [0, 0.14, -0.006], [Math.PI / 2 + 0.15, 0, -0.55], [0.92, 1.1, 1]);
  }
  if (ex.has('elfEars')) for (const s of [-1, 1]) add(head, cached('elfEar', () => { const g = new THREE.ConeGeometry(0.017, 0.075, 10); g.scale(0.45, 1, 1); g.translate(0, 0.03, 0); return g; }), M.skin, [s * 0.09, 0.09, -0.014], [-0.55, 0, -s * 0.5]);
  if (ex.has('earrings')) for (const s of [-1, 1]) add(head, cached('earring', () => new THREE.TorusGeometry(0.011, 0.0022, 6, 16)), M.gold, [s * (f ? 0.088 : 0.093), 0.052, -0.008], [0, Math.PI / 2, 0]);
  if (ex.has('flower')) {
    const fl = cached('hibiscus', () => blossomGeo(0.034));
    add(head, fl, one || mat('matte', { c1: fit.flower ?? 0xf0506a, c2: 0xffe0a0, p: [0.6, 0.06, 0, 0] }), [0.086, 0.14, -0.005], [0, Math.PI / 2 - 0.3, 0.2]);
  }
  // ---- headwear
  if (ex.has('panama') || ex.has('straw')) {
    const wide = ex.has('straw');
    const hc = fit.hat ?? (wide ? 0xd8c088 : 0xece2c8);
    const hm = one || mat('fabric', { c1: hc, c2: new THREE.Color(hc).multiplyScalar(0.8).getHex(), p: [2.4, 0.05, 0, 1], side: THREE.DoubleSide });
    add(head, cached(`hat${wide}`, () => weldNormals(latheGeo([[wide ? 0.215 : 0.172, 0.014], [wide ? 0.2 : 0.162, 0.005], [0.1, 0.012], [0.098, 0.075], [0.08, 0.098], [0.001, 0.104]], 30))), hm, [0, 0.132, -0.008], [-0.07, 0, 0], [0.96, 1, 1.06]);
    add(head, cached('hatband', () => new THREE.CylinderGeometry(0.1005, 0.1005, 0.022, 28, 1, true)), P(fit.band ?? 0x2a1e18, 0.5), [0, 0.158, -0.006], [-0.07, 0, 0], [0.965, 1, 1.065]);
  }
  if (ex.has('beanie')) {
    const bm = C(fit.hat ?? 0x3a3a40, 0.1);
    add(head, cached('beanie', () => { const g = new THREE.SphereGeometry(0.112, 24, 14, 0, TAU, 0, Math.PI * 0.5); g.scale(0.95, 1.05, 1.06); return g; }), bm, [0, 0.128, -0.012]);
    add(head, cached('beanieRoll', () => { const g = new THREE.TorusGeometry(0.104, 0.018, 8, 28); g.rotateX(Math.PI / 2); g.scale(0.95, 1, 1.06); return g; }), bm, [0, 0.135, -0.012]);
  }
  if (ex.has('flatcap')) {
    const cm = C(fit.hat ?? 0x5a5044, 0.1);
    add(head, cached('flatcap', () => { const g = new THREE.SphereGeometry(0.118, 24, 12, 0, TAU, 0, Math.PI * 0.42); g.scale(0.98, 0.7, 1.12); return g; }), cm, [0, 0.12, 0.0], [0.1, 0, 0]);
    add(head, cached('capBrim', () => { const g = new THREE.CylinderGeometry(0.092, 0.092, 0.008, 18, 1, false, -Math.PI / 2, Math.PI); g.scale(1, 1, 0.55); return g; }), cm, [0, 0.148, 0.07], [0.28, 0, 0]);
  }
  if (ex.has('hood')) {
    const hm = CD(fit.hood ?? topC);
    add(chest, cached('cowl', () => { const g = new THREE.TorusGeometry(0.1, 0.034, 10, 24); g.rotateX(Math.PI / 2); g.scale(1.05, 0.7, 0.9); return g; }), hm, [0, 0.245, -0.01]);
    add(chest, cached('hoodBack', () => { const g = new THREE.SphereGeometry(0.13, 18, 12); g.scale(0.95, 0.85, 0.42); return g; }), hm, [0, 0.19, -0.12], [-0.25, 0, 0]);
  }
  if (ex.has('hoodUp')) {
    const hm = CD(fit.hood ?? topC, 0.3);
    add(head, cached('hoodUp', () => { const g = new THREE.SphereGeometry(0.134, 28, 18, Math.PI / 2 + 0.8, TAU - 1.6, 0, Math.PI * 0.78); g.scale(0.97, 1.1, 1.1); return g; }), hm, [0, 0.1, -0.014]);
    add(chest, cached(`mantle${f}`, () => { const g = latheGeo([[0.27, 0.06], [0.265, 0.12], [0.235, 0.2], [0.17, 0.265], [0.09, 0.31]], 28); g.scale(1, 1, 0.74); return g; }), hm);
    if (fit.hoodPoint) add(head, cached('hoodPoint', () => new THREE.ConeGeometry(0.07, 0.2, 14)), hm, [0, 0.2, -0.1], [-1.0, 0, 0]);
  }
  // ---- body
  if (ex.has('cape')) {
    const c = fit.cape ?? 0x121014;
    const cm = one || mat('fabric', { c1: c, c2: new THREE.Color(c).multiplyScalar(0.6).getHex(), c3: fit.capeLining ?? c, p: [1.1, 0.8, 0, 0.5], side: THREE.DoubleSide });
    const cape = new THREE.Group();
    cape.position.set(0, 0.245, -0.03);
    chest.add(cape);
    add(cape, cached('cape', () => {
      const q = new THREE.CylinderGeometry(0.23, 0.52, 1.32, 30, 10, true, Math.PI / 2 - 0.12, Math.PI + 0.24);
      q.translate(0, -0.66, 0);
      const p = q.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i); const y = p.getY(i); const z = p.getZ(i);
        const a = Math.atan2(x, z);
        const d = -y / 1.32; // 0 at the shoulders, 1 at the hem
        const fold = 1 + 0.08 * d * Math.sin(a * 7);
        p.setXYZ(i, x * fold, y + 0.02 * d * Math.sin(a * 5), z * fold * (0.55 + 0.25 * d));
      }
      q.computeVertexNormals();
      return q;
    }), cm);
    rig.cape = cape;
  }
  let am = null;
  if (ex.has('armor') || ex.has('pauldrons')) am = one || mat('metal', { c1: fit.armor ?? 0x2a2a30, c2: 0x08080a, p: [0.26, 0.2, 0, 0] });
  if (ex.has('armor')) {
    add(chest, S.chest, am, [0, 0.002, 0.004], null, [1.07, 1.02, 1.12]);
    for (let i = 0; i < 3; i++) add(spine, cached(`abPlate${f}`, () => { const g = new THREE.TorusGeometry(f ? 0.132 : 0.146, 0.013, 6, 28); g.rotateX(Math.PI / 2); g.scale(1, 1, 0.74); return g; }), am, [0, 0.02 + i * 0.055, 0]);
    add(hips, cached(`tassets${f}`, () => { const g = latheGeo([[0.235, -0.2], [0.205, -0.05], [0.185, 0.05], [0.172, 0.1]], 24); g.scale(1, 1, 0.8); return g; }), one || mat('metal', { c1: fit.armor ?? 0x2a2a30, c2: 0x08080a, p: [0.26, 0.2, 0, 0], side: THREE.DoubleSide }));
  }
  if (ex.has('pauldrons')) for (const a of arms) {
    add(a.sh, cached('pauldron', () => { const g = new THREE.SphereGeometry(0.086, 18, 10, 0, TAU, 0, Math.PI * 0.5); g.scale(1, 0.75, 1); return g; }), am, [a.side * 0.006, 0.004, 0], [0, 0, -a.side * 0.35]);
    add(a.sh, cached('pauldron2', () => { const g = new THREE.SphereGeometry(0.076, 18, 10, 0, TAU, 0, Math.PI * 0.45); g.scale(1, 0.7, 1); return g; }), am, [a.side * 0.022, -0.042, 0], [0, 0, -a.side * 0.55]);
  }
  if (ex.has('bracers')) for (const a of arms) add(a.el, cached(`bracer${f}`, () => weldNormals(latheGeo([[0.047, -0.225], [0.051, -0.205], [0.054, -0.08], [0.05, -0.06]], 16))), P(fit.bracer ?? 0x3a2616, 0.6));
  if (ex.has('boots')) for (const l of legs) add(l.kn, cached(`boot${f}`, () => weldNormals(latheGeo([[0.063, -0.43], [0.067, -0.3], [0.069, -0.2], [0.076, -0.17], [0.07, -0.158]], 18))), M.shoes);
  if (ex.has('tunic')) add(hips, cached(`tunic${f}`, () => { const g = latheGeo([[0.255, -0.27], [0.228, -0.15], [0.192, 0], [0.172, 0.1]], 26); g.scale(1, 1, 0.84); return g; }), CD(fit.tunic ?? topC));
  if (ex.has('jacket')) {
    const jm = CD(topC, 0.15);
    add(hips, cached(`jacketHem${f}`, () => { const g = latheGeo([[0.19, -0.2], [0.187, -0.1], [0.178, 0.02], [0.162, 0.12]], 26); g.scale(1, 1, 0.8); return g; }), jm);
    const shirt = one || cloth(fit.shirt ?? 0xf8f6f0, 0.1);
    // an open V of shirt with the tie, framed by lapels, following the chest
    add(chest, cached(`shirtV${f}`, () => onChest([[0.04, 0, 0], [0.235, -0.055, 0.055]], f, 0.002)), shirt);
    add(chest, cached(`tie${f}`, () => onChest([[0.05, 0, 0], [0.08, -0.016, 0.016], [0.228, -0.011, 0.011]], f, 0.005, [1, 1, 1], 3, 10)), one || cloth(fit.tie ?? 0x6a1a26, 0.4));
    for (const s of [-1, 1]) {
      const rows = [[0.04, 0, 0], [0.09, 0.0141, 0.04], [0.215, 0.0493, 0.085], [0.235, 0.055, 0.07]].map(([y, a, b]) => (s > 0 ? [y, a, b] : [y, -b, -a]));
      add(chest, cached(`lapel${s}${f}`, () => onChest(rows, f, 0.006)), one || cloth(topC, 0.15));
    }
    for (const y of [0.0, 0.06]) add(spine, cached('button', () => new THREE.SphereGeometry(0.008, 8, 6)), P(fit.button ?? 0xd8d0c0, 0.3), [0, y + 0.02, (f ? 0.13 : 0.143) * 0.72 + 0.004]);
  }
  if (ex.has('waistcoat')) {
    const vm = C(fit.vest ?? 0x4a3a2a, 0.2);
    add(chest, S.chest, vm, [0, 0, 0.002], null, [1.035, 0.97, 1.06]);
    add(spine, S.abdomen, vm, null, null, [1.03, 1, 1.05]);
    add(chest, cached(`vestV${f}`, () => onChest([[0.07, 0, 0], [0.235, -0.05, 0.05]], f, 0.003, [1.035, 0.97, 1.06])), M.top);
    for (let i = 0; i < 4; i++) add(spine, cached('vbutton', () => new THREE.SphereGeometry(0.006, 8, 6)), P(0x8a7a5a, 0.4), [0, 0.03 + i * 0.045, (f ? 0.13 : 0.143) * 0.72 * 1.05 + 0.002]);
  }
  if (ex.has('suspenders')) {
    const sm = P(fit.strap ?? 0x2a1c14, 0.6);
    for (const s of [-1, 1]) add(chest, cached(`susp${s}`, () => tubeGeo([[s * 0.07, -0.07, 0.108], [s * 0.085, 0.1, 0.112], [s * 0.1, 0.205, 0.078], [s * 0.1, 0.25, 0], [s * 0.08, 0.18, -0.1], [s * 0.05, -0.07, -0.108]], 0.009, 30)), sm);
  }
  if (ex.has('shawl')) add(chest, cached(`shawl${f}`, () => { const g = latheGeo([[0.285, -0.04], [0.272, 0.08], [0.242, 0.18], [0.172, 0.252], [0.07, 0.282]], 32); g.scale(1, 1, 0.74); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getX(i), p.getZ(i)); if (p.getY(i) < 0) p.setY(i, p.getY(i) - 0.05 * (0.5 + 0.5 * Math.cos(a)) - 0.012 * Math.sin(a * 9)); } return weldNormals(g); }), CD(fit.shawl ?? 0x1a1a2a, 0.4));
  if (ex.has('dress') || ex.has('dressShort')) {
    const long = ex.has('dress');
    add(hips, cached(`dress${long}${f}`, () => {
      const g = latheGeo(long ? [[0.305, -0.87], [0.31, -0.84], [0.285, -0.62], [0.235, -0.3], [0.19, 0], [0.165, 0.1]] : [[0.27, -0.46], [0.255, -0.32], [0.205, -0.06], [0.182, 0.02], [0.165, 0.1]], 30);
      g.scale(1, 1, 0.85);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); const d = Math.max(0, -y) / (long ? 0.87 : 0.46); const a = Math.atan2(p.getX(i), p.getZ(i)); const k = 1 + 0.05 * d * Math.sin(a * 8); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
      return weldNormals(g);
    }), CD(topC, 0.35));
  }
  if (ex.has('lei')) {
    const cols = fit.lei ?? [0xf04a6a, 0xffd040, 0xffffff, 0xff8a3a];
    for (let c = 0; c < cols.length; c++) {
      add(chest, cached(`lei${f}${c}${cols.length}`, () => {
        const parts = [];
        const n = 24;
        for (let i = c; i < n; i += cols.length) {
          const a = (i / n) * TAU;
          const front = (Math.cos(a) + 1) / 2;
          const b = new THREE.SphereGeometry(0.021, 8, 6);
          b.scale(1, 0.7, 1);
          b.translate(Math.sin(a) * (f ? 0.12 : 0.135), 0.245 - 0.075 * front, Math.cos(a) * (0.092 + 0.02 * front));
          parts.push(b);
        }
        return mergeParts(parts);
      }), one || mat('matte', { c1: cols[c], p: [0.7, 0, 0, 0] }));
    }
  }
}

// ---------------------------------------------------------------- props people hold

export function heldProp(kind) {
  const g = new THREE.Group();
  if (kind === 'tablet') {
    g.add(mesh(roundedBoxGeo(0.2, 0.28, 0.012, 0.008, 2, 1), plain(0x1e2126, 0.3), {}));
    g.add(mesh(new THREE.PlaneGeometry(0.17, 0.24), mat('glow', { c1: 0x6ad8ff, p: [0.8, 0.1, 0, 0] }), { pos: [0, 0, 0.007] }));
  } else if (kind === 'crate') {
    g.add(mesh(roundedBoxGeo(0.46, 0.3, 0.34, 0.02, 2, 1), mat('panel', { c1: 0x5a6a3a, c2: 0x1a2010, c3: 0xffffff, p: [0.6, 0, 0, 0.1], q: [0.4, 0, 0, 0], seed: 6 }), {}));
  } else if (kind === 'rifle') {
    const m = plain(0x1c1e22, 0.45, 0.3);
    g.add(mesh(roundedBoxGeo(0.05, 0.09, 0.5, 0.012, 2, 1), m, { pos: [0, 0, 0.05] }));
    g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 10), m, { pos: [0, 0.015, 0.47], rot: [Math.PI / 2, 0, 0] }));
    g.add(mesh(roundedBoxGeo(0.04, 0.14, 0.05, 0.01, 2, 1), m, { pos: [0, -0.09, -0.02], rot: [0.3, 0, 0] }));
    g.add(mesh(roundedBoxGeo(0.045, 0.08, 0.2, 0.012, 2, 1), m, { pos: [0, -0.02, -0.28] }));
    g.add(mesh(new THREE.BoxGeometry(0.03, 0.02, 0.06), mat('glow', { c1: 0xff5a3a, p: [1.2, 0.2, 0, 0] }), { pos: [0, 0.055, 0.12] }));
  } else if (kind === 'glass') {
    g.add(mesh(latheGeo([[0, 0], [0.028, 0], [0.03, 0.004], [0.033, 0.1], [0.03, 0.1], [0.026, 0.012], [0, 0.012]], 16), new THREE.MeshStandardMaterial({ color: 0xeef4f8, roughness: 0.05, transparent: true, opacity: 0.4 }), {}));
    g.add(mesh(latheGeo([[0, 0.012], [0.026, 0.012], [0.029, 0.06], [0, 0.06]], 14), plain(0xc8801a, 0.2), {}));
  } else if (kind === 'kit') {
    g.add(mesh(roundedBoxGeo(0.3, 0.2, 0.14, 0.03, 2, 1), cloth(0xe8e8e4), {}));
    g.add(mesh(new THREE.BoxGeometry(0.08, 0.02, 0.01), plain(0xc03030, 0.5), { pos: [0, 0.03, 0.072] }));
    g.add(mesh(new THREE.BoxGeometry(0.02, 0.08, 0.01), plain(0xc03030, 0.5), { pos: [0, 0.03, 0.072] }));
  }
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return g;
}

// ---------------------------------------------------------------- poses

/** A full set of joint angles; missing fields mean 0 / rest. */
function zeroPose() {
  return {
    hipY: 0.97, hipX: 0, hipZ: 0, hipTwist: 0, hipDx: 0,
    spineX: 0, spineY: 0, spineZ: 0, chestX: 0, chestY: 0, chestZ: 0,
    neckX: 0, neckY: 0, headX: 0, headZ: 0,
    shL: [0, 0, 0], elL: 0, wrL: 0, shR: [0, 0, 0], elR: 0, wrR: 0,
    thL: [0, 0], knL: 0, anL: 0, thR: [0, 0], knR: 0, anR: 0,
    rootX: 0, rootY: 0, rootLift: 0,
  };
}
const KEYS = Object.keys(zeroPose());

/** Static poses (targets), in the conventions above. */
export const POSE = {
  stand: { shL: [-0.03, 0, -0.08], shR: [-0.03, 0, 0.08], elL: -0.18, elR: -0.18 },
  attention: { shL: [0, 0, -0.04], shR: [0, 0, 0.04], elL: -0.08, elR: -0.08, chestX: -0.03 },
  type: { spineX: 0.06, chestX: 0.12, neckX: 0.25, headX: 0.12, shL: [-0.8, 0.25, -0.18], shR: [-0.8, -0.25, 0.18], elL: -0.95, elR: -0.95, wrL: 0.25, wrR: 0.25 },
  tablet: { chestX: 0.05, neckX: 0.35, headX: 0.15, shL: [-0.35, 0.3, -0.12], elL: -1.55, wrL: -0.2, shR: [-0.45, -0.35, 0.14], elR: -1.35, wrR: 0.2 },
  carry: { chestX: -0.06, shL: [-0.6, 0.25, -0.22], shR: [-0.6, -0.25, 0.22], elL: -1.15, elR: -1.15, wrL: 0.3, wrR: 0.3 },
  inspect: { chestX: -0.18, neckX: -0.45, shR: [-1.7, -0.2, 0.15], elR: -0.3, shL: [-0.1, 0, -0.12], elL: -0.3 },
  kneel: { hipY: 0.54, spineX: 0.28, chestX: 0.15, neckX: 0.25, thR: [-1.57, 0.05], knR: 1.57, anR: 0, thL: [0, -0.05], knL: 1.57, anL: 0.9,
    shL: [-0.85, 0.2, -0.15], elL: -0.55, shR: [-0.95, -0.2, 0.15], elR: -0.45 },
  tend: { spineX: 0.35, chestX: 0.35, neckX: 0.25, shL: [-0.95, 0.15, -0.15], elL: -0.4, shR: [-1.05, -0.1, 0.12], elR: -0.5, thL: [-0.08, 0], thR: [0.05, 0], knL: 0.12, knR: 0.1 },
  guard: { chestX: -0.02, shL: [-0.7, 0.2, -0.28], elL: -1.2, wrL: 0.2, shR: [-0.25, -0.2, 0.2], elR: -1.45, wrR: -0.1, thL: [0.04, -0.05], thR: [-0.04, 0.05] },
  sitWall: { hipY: 0.13, spineX: -0.25, chestX: -0.1, neckX: 0.45, thL: [-1.25, -0.12], knL: 1.9, anL: -0.3, thR: [-1.45, 0.1], knR: 0.45, anR: 0.2,
    shL: [-0.35, 0.3, -0.2], elL: -1.55, shR: [-0.15, 0.2, 0.25], elR: -0.9 },
  lie: { rootX: -Math.PI / 2, rootLift: 0.11, neckX: -0.1, headZ: 0.35, shL: [-0.1, 0, -0.35], shR: [0.05, 0, 0.5], elL: -0.3, elR: -0.9, thL: [-0.08, -0.08], thR: [0.02, 0.1], knL: 0.25, knR: 0.05, anL: 0.5, anR: 0.6 },
  slumpChair: { hipY: 0.58, spineX: 0.55, chestX: 0.45, neckX: 0.6, thL: [-1.5, -0.08], thR: [-1.5, 0.08], knL: 1.5, knR: 1.45, shL: [-0.8, 0.2, -0.2], elL: -0.5, shR: [-0.7, -0.2, 0.25], elR: -0.6 },
  sitChair: { hipY: 0.58, spineX: -0.05, thL: [-1.5, -0.1], thR: [-1.5, 0.1], knL: 1.5, knR: 1.5, shL: [-0.45, 0.1, -0.1], elL: -1.0, shR: [-0.45, -0.1, 0.1], elR: -1.0 },
  bar: { hipY: 0.78, spineX: 0.25, chestX: 0.15, thL: [-1.3, -0.1], thR: [-1.2, 0.12], knL: 1.2, knR: 1.6, shL: [-1.0, 0.3, -0.2], elL: -1.3, shR: [-1.05, -0.3, 0.2], elR: -1.2 },
  wave: { shR: [-0.2, -0.2, 2.6], elR: -0.5, shL: [-0.03, 0, -0.08], elL: -0.2 },
  lunge: { hipY: 0.84, spineX: 0.3, thL: [-0.8, -0.1], knL: 0.7, thR: [0.45, 0.1], knR: 0.35, shL: [-1.2, 0.3, -0.3], elL: -0.4, shR: [-0.3, -0.4, 0.3], elR: -1.3 },
  raise: { chestX: -0.15, shL: [-2.8, 0, -0.2], elL: -0.35, shR: [-2.7, 0, 0.2], elR: -0.35, thL: [-0.15, -0.05], thR: [0.15, 0.05] },
  recline: { rootX: -1.2, rootLift: 0.34, spineX: 0.2, thL: [-0.35, -0.05], thR: [-0.12, 0.05], knL: 0.5, knR: 0.15, shL: [-2.4, 0.3, -0.5], elL: -0.5, shR: [0.2, -0.3, 0.3], elR: -0.5 },
  sit: { hipY: 0.58, thL: [-1.5, -0.1], thR: [-1.5, 0.1], knL: 1.5, knR: 1.5, shL: [-0.4, 0.1, -0.1], elL: -0.9, shR: [-0.4, -0.1, 0.1], elR: -0.9 },
  // the island's characters
  clasp: { chestX: 0.06, neckX: 0.1, shL: [-0.15, 0.6, 0.05], elL: -1.35, wrL: 0.1, shR: [-0.15, -0.6, -0.05], elR: -1.35, wrR: 0.1, thL: [0.02, -0.03], thR: [-0.02, 0.03] },
  armsCross: { chestX: -0.04, shL: [-0.2, 1.0, 0.05], elL: -1.9, shR: [-0.25, -0.95, -0.05], elR: -1.85, thL: [0.03, -0.08], thR: [-0.03, 0.08] },
  beckon: { chestX: 0.04, neckX: 0.08, shL: [-0.05, 0, -0.08], elL: -0.35, shR: [-0.55, -0.15, 0.25], elR: -1.6, wrR: -0.5 },
  offer: { chestX: 0.08, neckX: 0.12, shL: [-0.75, 0.3, -0.12], elL: -0.8, wrL: 0.2, shR: [-0.75, -0.3, 0.12], elR: -0.8, wrR: 0.2 },
  sitGround: { hipY: 0.14, spineX: 0.28, chestX: 0.12, neckX: -0.12, thL: [-2.5, -0.16], knL: 2.0, anL: 0.12, thR: [-2.45, 0.16], knR: 1.95, anR: 0.16,
    shL: [-0.75, 0.35, -0.12], elL: -1.0, wrL: 0.2, shR: [-0.75, -0.35, 0.12], elR: -1.0, wrR: 0.2 },
  stool: { hipY: 0.78, spineX: 0.2, chestX: 0.12, neckX: 0.2, thL: [-1.35, -0.12], thR: [-1.25, 0.14], knL: 1.35, knR: 1.75, anL: 0, anR: 0.3,
    shL: [-0.55, 0.25, -0.15], elL: -1.2, wrL: 0.2, shR: [-0.45, -0.2, 0.15], elR: -1.1 },
  brandish: { spineX: -0.04, chestX: -0.1, chestY: -0.15, neckX: 0.05, shL: [-1.1, 0.7, 0.1], elL: -1.3, shR: [-1.6, -0.3, 0.6], elR: -1.6,
    thL: [-0.3, -0.1], knL: 0.25, thR: [0.25, 0.1], knR: 0.1, hipY: 0.95 },
  halberd: { hipY: 0.86, spineX: 0.22, chestX: 0.06, chestY: 0.3, neckX: -0.15, neckY: -0.25, thL: [-0.85, -0.12], knL: 0.75, anL: 0.1, thR: [0.4, 0.12], knR: 0.25, anR: -0.1,
    shL: [-1.1, 0.2, -0.45], elL: -1.1, shR: [-0.55, -0.35, 0.3], elR: -1.25, wrR: 0.2 },
  sword: { chestX: -0.02, chestY: -0.2, neckY: 0.2, thL: [-0.25, -0.1], knL: 0.2, thR: [0.2, 0.1], knR: 0.1, shR: [-1.25, -0.1, 0.12], elR: -0.35, wrR: -0.1,
    shL: [-0.25, 0.1, -0.25], elL: -0.5 },
  throne: { hipY: 0.58, spineX: -0.12, chestX: -0.05, neckX: 0.05, thL: [-1.45, -0.12], thR: [-1.45, 0.12], knL: 1.45, knR: 1.45, anL: 0.05, anR: 0.05,
    shL: [-0.35, 0.15, -0.3], elL: -0.6, shR: [-0.35, -0.15, 0.3], elR: -0.6 },
  // half lying, legs together and along the pelvis (so a gown covers them), propped on a bolster
  ferns: { rootX: -1.35, rootLift: 0.25, spineX: 0.3, chestX: 0.2, neckX: 0.35, thL: [-0.12, -0.04], knL: 0.25, anL: 0.5, thR: [0, 0.04], knR: 0.05, anR: 0.55,
    shL: [-2.5, 0.3, -0.4], elL: -1.7, shR: [-0.2, -0.2, 0.3], elR: -0.5 },
  bathe: { spineX: -0.1, chestX: -0.05, neckX: -0.1, headZ: 0.12, shL: [-0.35, 0.3, -0.35], elL: -1.0, shR: [-0.3, -0.3, 0.4], elR: -0.9 },
};

/** A full pose from a partial one; arrays are copied so nothing is shared. */
function fill(p) {
  const z = zeroPose();
  for (const k of Object.keys(p)) z[k] = Array.isArray(p[k]) ? [...p[k]] : p[k];
  return z;
}
/** A pose by name, as a full set of angles. */
export function poseOf(name) { return fill(POSE[name] || POSE.stand); }
function blendInto(out, a, b, t) {
  for (const k of KEYS) {
    const x = a[k];
    const y = b[k];
    if (Array.isArray(x)) out[k] = x.map((v, i) => lerp(v, y[i], t));
    else out[k] = lerp(x, y, t);
  }
  return out;
}

export function applyPose(fig, p) {
  const r = fig.userData.rig;
  r.hips.position.set(p.hipDx, p.hipY + (r.legLift || 0), 0);
  r.hips.rotation.set(p.hipX, p.hipTwist, p.hipZ);
  r.spine.rotation.set(p.spineX, p.spineY, p.spineZ);
  r.chest.rotation.set(p.chestX, p.chestY, p.chestZ);
  r.neck.rotation.set(p.neckX, p.neckY, 0);
  r.head.rotation.set(p.headX, 0, p.headZ);
  const [aL, aR] = r.arms;
  aL.sh.rotation.set(...p.shL); aL.el.rotation.x = p.elL; aL.wr.rotation.x = p.wrL;
  aR.sh.rotation.set(...p.shR); aR.el.rotation.x = p.elR; aR.wr.rotation.x = p.wrR;
  const [lL, lR] = r.legs;
  lL.th.rotation.set(p.thL[0], 0, p.thL[1]); lL.kn.rotation.x = p.knL; lL.an.rotation.x = p.anL;
  lR.th.rotation.set(p.thR[0], 0, p.thR[1]); lR.kn.rotation.x = p.knR; lR.an.rotation.x = p.anR;
  fig.userData.body.rotation.x = p.rootX;
  fig.userData.body.position.y = p.rootLift;
}

export { GAITS };

// ---------------------------------------------------------------- agents

/**
 * A person that stands, works and walks. world: { stations: [{ pos:[x,z],
 * face, task, prop }], aisle: [[x, z], ...], gait, dwell:[min,max], walker }.
 */
class Agent {
  constructor(fig, rnd, opts) {
    this.fig = fig;
    this.r = rnd;
    this.o = opts;
    this.pose = fill(POSE.stand);
    this.target = fill(POSE[opts.task] || POSE.stand);
    this.gait = GAITS[opts.gait || 'walk'];
    this.speed = 0;
    this.phase = this.r.range(0, 1);
    this.ind = this.r.range(0, 1); // small individual differences in how people move
    this.path = [];
    this.task = opts.task || 'stand';
    this.until = this.r.range(2, 8);
    this.t = null;
    this.heading = fig.rotation.y;
    this.look = 0;
    this.lookTarget = 0;
    this.nextLook = this.r.range(1, 4);
    this.ph = this.r.range(0, 10);
    this.prop = null;
    this.station = opts.home ?? null;
    if (opts.prop) this.hold(opts.prop);
  }

  hold(kind) {
    if (this.prop) { this.prop.parent.remove(this.prop); this.prop = null; }
    if (!kind) return;
    const p = heldProp(kind);
    const rig = this.fig.userData.rig;
    if (kind === 'tablet') { p.position.set(0, -0.09, 0.03); p.rotation.set(-1.2, 0, 0.1); rig.arms[0].wr.add(p); }
    else if (kind === 'crate') { p.position.set(0, 0.02, 0.36); rig.chest.add(p); }
    else if (kind === 'rifle') { p.position.set(0.02, -0.03, 0.26); p.rotation.set(0.35, -0.35, 0.25); rig.chest.add(p); }
    else if (kind === 'kit') { p.position.set(0, -0.12, 0.02); rig.arms[1].wr.add(p); }
    else if (kind === 'glass') { p.position.set(0, -0.085, 0.035); p.rotation.set(Math.PI / 2, 0, 0); rig.arms[1].wr.add(p); }
    this.prop = p;
  }

  goTo(station) {
    const from = [this.fig.position.x, this.fig.position.z];
    const to = station.approach || station.pos;
    const aisle = this.o.aisle;
    this.path = [];
    if (aisle && aisle.length) {
      const near = (q) => aisle.reduce((b, a, i) => (Math.hypot(a[0] - q[0], a[1] - q[1]) < Math.hypot(aisle[b][0] - q[0], aisle[b][1] - q[1]) ? i : b), 0);
      const i0 = near(from);
      const i1 = near(to);
      const step = i1 >= i0 ? 1 : -1;
      for (let i = i0; i !== i1 + step; i += step) this.path.push(aisle[i]);
    }
    this.path.push(to);
    this.station = station;
    this.task = 'walk';
  }

  update(t) {
    if (this.t === null) this.heading = this.fig.rotation.y;
    const dt = this.t === null ? 0 : Math.min(0.1, t - this.t);
    this.t = t;
    const fig = this.fig;
    const o = this.o;
    // ---- locomotion
    let moving = false;
    if (this.path.length) {
      const [tx, tz] = this.path[0];
      const dx = tx - fig.position.x;
      const dz = tz - fig.position.z;
      const d = Math.hypot(dx, dz);
      if (d < (this.path.length > 1 ? 0.45 : 0.08)) {
        this.path.shift();
        if (!this.path.length) this.arrive();
      } else {
        moving = true;
        const want = Math.atan2(dx, dz);
        let dh = ((want - this.heading + Math.PI * 3) % TAU) - Math.PI;
        const turnRate = 3.2;
        this.heading += clamp(dh, -turnRate * dt, turnRate * dt);
        dh = ((want - this.heading + Math.PI * 3) % TAU) - Math.PI;
        const cruise = this.gait.speed * (o.speedK ?? 1);
        const slow = this.path.length === 1 ? clamp(d / 1.2, 0.35, 1) : 1;
        const align = clamp(1 - Math.abs(dh) / 1.6, 0.25, 1);
        const want2 = cruise * slow * align;
        this.speed += clamp(want2 - this.speed, -4 * dt, 2.5 * dt);
      }
    }
    if (!moving) {
      this.speed = Math.max(0, this.speed - 4 * dt);
      if (this.station && this.station.face !== undefined && !this.path.length) {
        let dh = ((this.station.face - this.heading + Math.PI * 3) % TAU) - Math.PI;
        this.heading += clamp(dh, -2.5 * dt, 2.5 * dt);
      }
    }
    const step = this.speed * dt;
    fig.position.x += Math.sin(this.heading) * step;
    fig.position.z += Math.cos(this.heading) * step;
    fig.rotation.y = this.heading;
    // the gait phase advances with distance over the (speed-dependent) stride,
    // so planted feet move back exactly as fast as the body moves forward
    const g0 = this.gait;
    const k = fig.userData.body.scale.x;
    const ratio = clamp(this.speed / g0.speed, 0, 1.3);
    this.stride = g0.stride * (0.55 + 0.45 * Math.min(1, ratio));
    this.phase += step / (this.stride * k);
    // ---- decide
    if (!this.path.length && !moving && this.o.walker && t > this.until && this.speed < 0.05) this.next();
    // ---- pose
    const g = this.gait;
    const w = clamp(this.speed / (g.speed * 0.35), 0, 1);
    const out = fill({});
    if (w > 0.01) {
      locomotion(out, this.phase, g, this.stride || g.stride, this.ind);
      // arms that hold something keep holding it while walking
      if (this.carrying) { out.shL = [...POSE.carry.shL]; out.shR = [...POSE.carry.shR]; out.elL = POSE.carry.elL; out.elR = POSE.carry.elR; out.chestY *= 0.3; }
      if (this.task === 'walk' && this.prop && !this.carrying && this.propKind === 'tablet') { out.shL = [...POSE.tablet.shL]; out.elL = POSE.tablet.elL; out.wrL = POSE.tablet.wrL; }
      if (this.propKind === 'rifle') { out.shL = [...POSE.guard.shL]; out.elL = POSE.guard.elL; out.shR = [...POSE.guard.shR]; out.elR = POSE.guard.elR; }
      blendInto(out, fill(POSE.stand), out, w);
    } else {
      Object.assign(out, fill(this.target));
      this.idle(out, t);
    }
    // smooth toward the frame's target (time constant ~0.18 s) — except while
    // walking, where any lag would make the planted feet slide
    const kk = w > 0.3 ? 1 : 1 - Math.exp(-dt / 0.18);
    blendInto(this.pose, this.pose, out, dt === 0 ? 1 : kk);
    applyPose(fig, this.pose);
  }

  /** Small life on top of a static task pose. */
  idle(out, t) {
    const s = t + this.ph;
    const task = this.task;
    // breathing
    out.chestX += 0.012 * Math.sin(s * 1.5);
    // glances
    if (t > this.nextLook) {
      this.lookTarget = task === 'guard' ? this.r.range(-0.8, 0.8) : this.r.chance(0.5) ? 0 : this.r.range(-0.6, 0.6);
      this.nextLook = t + this.r.range(1.5, 5);
    }
    this.look += (this.lookTarget - this.look) * 0.04;
    out.neckY += this.look * (task === 'type' ? 0.4 : 0.8);
    if (task === 'stand' || task === 'guard' || task === 'attention' || task === 'inspect') {
      // weight shifts from one leg to the other every few seconds
      const shift = Math.sin(s * 0.33);
      out.hipDx += 0.022 * shift;
      out.hipZ += -0.035 * shift;
      out.knL += Math.max(0, shift) * 0.14;
      out.knR += Math.max(0, -shift) * 0.14;
      out.thL[0] -= Math.max(0, shift) * 0.06;
      out.thR[0] -= Math.max(0, -shift) * 0.06;
      out.hipY -= Math.abs(shift) * 0.012;
    }
    if (task === 'type') {
      // bursts of typing, a look up at the display now and then
      const burst = Math.sin(s * 0.7) > -0.3 ? 1 : 0;
      out.elL += 0.05 * Math.sin(s * 13) * burst;
      out.elR += 0.05 * Math.sin(s * 11 + 1) * burst;
      out.wrL += 0.08 * Math.sin(s * 17) * burst;
      out.wrR += 0.08 * Math.sin(s * 19 + 2) * burst;
      out.neckX -= Math.max(0, Math.sin(s * 0.45)) * 0.35;
    }
    if (task === 'tablet') {
      out.elR += 0.06 * Math.sin(s * 7) * (Math.sin(s * 0.9) > 0 ? 1 : 0);
      out.shR[0] += 0.04 * Math.sin(s * 3.1);
    }
    if (task === 'kneel' || task === 'tend') {
      out.shL[0] += 0.12 * Math.sin(s * 2.2);
      out.shR[0] += 0.12 * Math.sin(s * 2.5 + 1);
      out.elR += 0.15 * Math.sin(s * 3.1);
    }
    if (task === 'sitWall') {
      out.neckX += 0.08 * Math.sin(s * 0.25);
      out.chestX += 0.02 * Math.sin(s * 0.9);
    }
    if (task === 'dance') this.dance(out, t);
    if (task === 'chat') this.chat(out, t, s);
  }

  /**
   * Dancing to a shared beat (~118 bpm; each dancer a touch early or late):
   * a step-touch with a knee dip on every beat, hips swaying over the loaded
   * leg, loose arms, now and then a hand raised; some groove with bent elbows,
   * some sway with flowing arms. Every curve is smooth; nothing snaps.
   */
  dance(out, t) {
    const beat = (t * 118) / 60 + this.ind * 0.3;
    const b = beat * TAU;
    const style = this.style ?? (this.style = this.ind < 0.4 ? 0 : this.ind < 0.75 ? 1 : 2);
    const side = Math.sin(b / 2); // weight over the right (+) or left (-) leg, one step per beat
    const dip = (1 - Math.cos(b)) / 2; // down on the beat
    out.hipY = 0.955 - 0.03 * dip * (style === 1 ? 1.4 : 1);
    out.hipDx = (style === 2 ? 0.065 : 0.045) * side;
    out.hipZ = -(style === 2 ? 0.1 : 0.06) * side;
    out.hipTwist = 0.12 * Math.sin(b / 2 + 0.6);
    out.chestZ = 0.05 * side;
    out.chestY = -0.1 * Math.sin(b / 2 + 0.6);
    out.knL = 0.1 + 0.12 * dip + 0.22 * Math.max(0, side);
    out.knR = 0.1 + 0.12 * dip + 0.22 * Math.max(0, -side);
    out.thL = [-0.06 - 0.12 * Math.max(0, side), -0.06];
    out.thR = [-0.06 - 0.12 * Math.max(0, -side), 0.06];
    out.anL = 0.1 * Math.max(0, side);
    out.anR = 0.1 * Math.max(0, -side);
    out.neckX = 0.04 + 0.05 * Math.sin(b - 0.5);
    out.neckY = 0.25 * Math.sin(beat * 0.11 + this.ph);
    if (style === 0) {
      // loose arms, swinging a little against the hips
      out.shL = [-0.3 + 0.12 * side, 0.15, -0.18 - 0.05 * dip];
      out.shR = [-0.3 - 0.12 * side, -0.15, 0.18 + 0.05 * dip];
      out.elL = -1.0 - 0.15 * dip;
      out.elR = -1.0 - 0.15 * dip;
    } else if (style === 1) {
      // groove: elbows bent, shoulders rolling, forearms pumping on the beat
      out.shL = [-0.45 - 0.2 * side, 0.3, -0.25];
      out.shR = [-0.45 + 0.2 * side, -0.3, 0.25];
      out.elL = -1.5 + 0.25 * dip;
      out.elR = -1.5 + 0.25 * dip;
      out.chestX = 0.05 * dip;
    } else {
      // flowing arms: both drift to the side the hips go, wrists rolling
      const w = Math.sin(b / 2 - 0.4);
      out.shL = [-0.75, 0.25, -0.5 - 0.3 * w];
      out.shR = [-0.75, -0.25, 0.5 - 0.3 * w];
      out.elL = -0.8 - 0.3 * Math.max(0, -w);
      out.elR = -0.8 - 0.3 * Math.max(0, w);
      out.wrL = 0.3 * Math.sin(b + 1);
      out.wrR = 0.3 * Math.sin(b + 2);
    }
    // every sixteen beats or so, some raise a hand for a while
    const up = Math.max(0, Math.sin((beat / 16) * TAU + this.ph * 3)) ** 3 * (this.ind > 0.5 ? 1 : 0);
    if (up > 0.01) {
      out.shR = out.shR.map((v, i) => v + ([-2.6, 0, 0.1][i] - v) * up);
      out.elR += (-0.35 - out.elR) * up;
    }
  }

  /**
   * Conversation: a talker gestures in bursts with one or both hands; a
   * listener stands with hands behind the back or arms folded and nods; a
   * drinker holds a glass and sips now and then.
   */
  chat(out, t, s) {
    const kind = this.chatKind ?? (this.chatKind = this.propKind === 'glass' ? 'drink' : this.ind < 0.55 ? 'talk' : 'listen');
    const burst = Math.max(0, Math.sin(s * 0.42 + Math.sin(s * 0.17))) ** 2; // talking comes in bursts
    if (kind === 'talk') {
      const a = 0.6 + 0.4 * Math.sin(s * 1.9);
      out.shR = [-0.2 - 0.4 * burst * a, -0.25 * burst, 0.12 + 0.1 * burst];
      out.elR = -0.35 - 1.05 * burst;
      out.wrR = 0.25 * Math.sin(s * 2.6) * burst;
      const both = Math.max(0, Math.sin(s * 0.29 + 2)) ** 2 * burst;
      out.shL = [-0.1 - 0.35 * both, 0.25 * both, -0.1 - 0.08 * both];
      out.elL = -0.3 - 0.9 * both;
      out.neckX += 0.05 * Math.sin(s * 2.8) * burst;
      out.chestX += 0.04 * burst;
    } else if (kind === 'listen') {
      if (this.ind > 0.8) Object.assign(out, { shL: [...POSE.armsCross.shL], elL: POSE.armsCross.elL, shR: [...POSE.armsCross.shR], elR: POSE.armsCross.elR });
      else { out.shL = [0.28, -0.1, -0.12]; out.elL = -0.7; out.shR = [0.28, 0.1, 0.12]; out.elR = -0.7; }
      out.neckX += 0.09 * Math.max(0, Math.sin(s * 0.9)) ** 6; // nods
      out.neckY += 0.15 * Math.sin(s * 0.13);
    } else {
      const sip = Math.max(0, Math.sin(s * 0.55 + this.ph)) ** 10; // a sip every ~11 s
      out.shR = [-0.3 - 0.75 * sip, -0.2 + 0.1 * sip, 0.15];
      out.elR = -1.35 - 0.95 * sip;
      out.wrR = -0.1 - 0.2 * sip;
      out.neckX -= 0.25 * sip;
      out.shL = [0.02, 0, -0.1];
      out.elL = -0.25 - 0.2 * burst;
      out.shL[0] -= 0.25 * burst;
    }
  }

  arrive() {
    const st = this.station;
    this.task = st.task || 'stand';
    this.target = fill(POSE[this.task] || POSE.stand);
    this.until = this.t + this.r.range(...(this.o.dwell || [3, 8]));
    if (st.prop !== undefined) { this.hold(st.prop); this.propKind = st.prop; }
    if (this.carrying && st.drop) { this.carrying = false; this.hold(null); this.propKind = null; }
  }

  next() {
    const pool = this.o.walkOnly ? this.o.stations.filter((s) => s.walkOnly) : this.o.stations;
    const list = pool.filter((s) => s !== this.station && !s.busy);
    if (!list.length) { this.until = this.t + 2; return; }
    const st = this.r.pick(list);
    if (this.station) this.station.busy = false;
    st.busy = true;
    if (st.carry) { this.carrying = true; this.hold('crate'); this.propKind = 'crate'; }
    this.goTo(st);
  }
}

// ---------------------------------------------------------------- crowds

const ROLE_TASK = { technicians: 'type', guards: 'guard', nurses: 'tend', ambassadors: 'slumpChair', pilots: 'stand', wounded: 'sitWall',
  dancers: 'dance', natives: 'chat', guests: 'chat', men: 'chat', girls: 'chat', bar: 'bar', corpses: 'lie', crew: 'stand' };
const ROLE_PROP = { guards: 'rifle', nurses: 'kit' };

/**
 * People for a role. With `world` (stations, aisle...) they take stations
 * and some walk between them; without it the caller places them and they
 * stay, with idle life. Returns a Group with userData.update(t).
 * opts: { night, rim, material, world, walkers, gait }
 */
export function people(role, count, rnd, opts = {}) {
  const g = new THREE.Group();
  const agents = [];
  const world = opts.world;
  const walkers = world ? Math.min(count, opts.walkers ?? 0) : 0;
  const stations = world?.stations || [];
  for (let i = 0; i < count; i++) {
    const sex = role === 'girls' || role === 'dancers' && i % 2 === 0 || role === 'nurses' && i % 3 !== 2 || rnd.chance(role === 'guests' || role === 'natives' ? 0.5 : 0.3) ? 'f' : 'm';
    const fig = new THREE.Group();
    // a few individual touches: hats on the dock and the lawn, a drink in hand
    const extras = [];
    const r2 = rnd();
    if (role === 'men' && r2 < 0.5) extras.push('straw');
    if (role === 'guests' && sex === 'm' && r2 < 0.35) extras.push('panama');
    if (role === 'bar' && sex === 'm' && r2 < 0.3) extras.push('flatcap');
    const drink = (role === 'guests' && r2 > 0.6) || (role === 'bar' && r2 > 0.4);
    const bodyG = buildHuman({ sex, skin: rnd.pick(SKIN), hair: rnd.pick(HAIR), hairStyle: sex === 'f' ? rnd.pick(['long', 'bun', 'short']) : rnd.pick(['short', 'short', 'none']),
      outfit: role, material: opts.material, seed: rnd(), height: sex === 'f' ? rnd.range(1.6, 1.72) : rnd.range(1.7, 1.88), extras });
    fig.add(bodyG);
    // rig lives on the body; the agent moves the outer group
    fig.userData.rig = bodyG.userData.rig;
    fig.userData.body = bodyG;
    g.add(fig);
    const walker = i < walkers;
    const task = role === 'corpses' ? 'lie' : role === 'wounded' ? (rnd.chance(0.35) ? 'lie' : 'sitWall') : ROLE_TASK[role] || 'stand';
    let home = null;
    if (world && stations.length) {
      home = (walker && stations.find((s) => !s.busy && s.walkOnly))
        || stations.find((s) => !s.busy && !s.walkOnly && s.task === task)
        || stations.find((s) => !s.busy && !s.walkOnly)
        || stations[i % stations.length];
      home.busy = true;
      fig.position.set(home.pos[0], 0, home.pos[1]);
      fig.rotation.y = home.face ?? 0;
    }
    const prop = home?.prop ?? (drink && !opts.material ? 'glass' : ROLE_PROP[role]);
    const a = new Agent(fig, rnd, { task: home?.task || task, gait: opts.gait || world?.gait, stations, aisle: world?.aisle, walker, walkOnly: !!world?.walkOnly, dwell: world?.dwell, prop, home, speedK: rnd.range(0.9, 1.1) });
    a.propKind = prop;
    agents.push(a);
  }
  g.userData.agents = agents;
  // callers scatter free crowds at random: on the first frame, ease apart anyone
  // standing closer than arm's length (dancing and talking people keep a little room)
  let spaced = !!world;
  const space = () => {
    const free = agents.filter((a) => a.task === 'dance' || a.task === 'chat');
    const min = 0.72;
    for (let it = 0; it < 8; it++) {
      for (let i = 0; i < free.length; i++) {
        for (let j = i + 1; j < free.length; j++) {
          const p = free[i].fig.position;
          const q = free[j].fig.position;
          const dx = q.x - p.x;
          const dz = q.z - p.z;
          const d = Math.hypot(dx, dz) || 1e-3;
          if (d < min && Math.abs(p.y - q.y) < 0.3) {
            const k = (min - d) / 2 / d;
            p.x -= dx * k; p.z -= dz * k;
            q.x += dx * k; q.z += dz * k;
          }
        }
      }
    }
  };
  g.userData.update = (t) => {
    if (!spaced) { spaced = true; space(); }
    for (const a of agents) a.update(t);
  };
  return g;
}
