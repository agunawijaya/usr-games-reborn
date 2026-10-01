// Island interiors in the modelled style (ADR-013): the bungalow's living
// room, kitchen and bedroom, the cottage's drawing room and study, the
// clubhouse bar, the stables and the old garage. Each room is built from
// its text: real walls with window openings (the sun comes in through them),
// the next room glimpsed through each doorway, mouldings, and furniture from
// furnish.js and island-furnish.js.

import * as THREE from 'three';
import { C } from '../engine/battlestar.js';
import { mat, glowMat } from './materials.js';
import { rng, mesh } from './geo.js';
import { crowd } from './people.js';
import { prop } from './props.js';
import { particles, lightShafts } from './fx.js';
import { latheGeo, tubeGeo, roundedBoxGeo, blobGeo } from './model.js';
import { merge } from './flora.js';
import { bed, nightstand, tableLamp, armchair, sofa, sideTable, sideboard, roomTrim, windowFrame, chandelier, vasePedestal } from './furnish.js';
import { IM, cached, bake, beamGeo, postGeo, deckGeo, boardWall, gableRoofGeo } from './island-build.js';
import * as F from './island-furnish.js';

const M = {
  plaster: (c1, c2 = 0x8a6a4a, dado = 0.95) => mat('plaster', { c1, c2, c3: 0xd8c8a8, p: [dado, 0, 0, 0] }),
  ceil: () => mat('plaster', { c1: 0xf6f0e4, c2: 0xf6f0e4, p: [0, 0, 0, 0] }),
  carpet: (c1, c2) => mat('carpet', { c1, c2, c3: 0xffffff, p: [110, 0.35, 0, 0] }),
  floorWood: () => mat('wood', { c1: 0x8a6440, c2: 0x5a3e24, p: [4, 0, 0, 0] }),
  dirt: () => mat('stone', { c1: 0x6a5840, c2: 0x3e3226, c3: 0x5a4a2a, p: [1.2, 0.05, 0.2, 0] }),
  concrete: () => mat('stone', { c1: 0x8a8680, c2: 0x5e5a54, c3: 0x4a4038, p: [0.6, 0.1, 0.15, 0] }),
};

// ---------------------------------------------------------------- the room's shell

/** A wall len × h (room side toward +z, inner face at z = 0), thickness toward -z, with rectangular holes. */
function wallGeo(len, h, thick, holes) {
  const xs = new Set([-len / 2, len / 2]);
  for (const o of holes) { xs.add(Math.max(-len / 2, o.x0)); xs.add(Math.min(len / 2, o.x1)); }
  const sorted = [...xs].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (b - a < 1e-3) continue;
    const mid = (a + b) / 2;
    const o = holes.find((q) => mid > q.x0 && mid < q.x1);
    const spans = o ? [[0, o.y0], [o.y1, h]] : [[0, h]];
    for (const [y0, y1] of spans) if (y1 - y0 > 0.005) parts.push(new THREE.BoxGeometry(b - a, y1 - y0, thick).translate(mid, (y0 + y1) / 2, -thick / 2));
  }
  return merge(parts);
}

const SIDES = {
  ahead: { rot: 0, pos: (W, D) => [0, 0, -D / 2], len: (W, D) => W },
  back: { rot: Math.PI, pos: (W, D) => [0, 0, D / 2], len: (W, D) => W },
  left: { rot: Math.PI / 2, pos: (W, D) => [-W / 2, 0, 0], len: (W, D) => D },
  right: { rot: -Math.PI / 2, pos: (W, D) => [W / 2, 0, 0], len: (W, D) => D },
};
/** World point of a wall-local (x, y, z) on a side. */
function onWall(side, W, D, x, y, z = 0) {
  const s = SIDES[side];
  const v = new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), s.rot);
  const p = s.pos(W, D);
  return v.add(new THREE.Vector3(p[0], p[1], p[2]));
}

/**
 * Walls, floor and ceiling of a W × D × H room: a doorway (doorW × 2.6,
 * matching roomTrim's architraves) on each side with an exit, windows
 * [{x, w, y0, y1}] per side, openings for roomTrim, and "beyond" boxes that
 * show the next room through each doorway.
 */
function roomShell({ W, D, H, exits, wallM, floorM, ceilM, doorW = 1.2, windows = {}, thick = 0.2, beyond = {}, planks = null, noCeil = false, wallFor = null }) {
  const group = new THREE.Group();
  const doorH = 2.6;
  const offs = -D * 0.12;
  const openings = {};
  for (const side of Object.keys(SIDES)) {
    const s = SIDES[side];
    const len = s.len(W, D);
    const holes = [];
    let doorX = null;
    if (exits[side]) {
      doorX = side === 'left' ? -offs : side === 'right' ? offs : 0;
      holes.push({ x0: doorX - doorW / 2, x1: doorX + doorW / 2, y0: -1, y1: doorH });
      const c = onWall(side, W, D, doorX, doorH / 2);
      openings[side] = c;
    }
    for (const w of windows[side] || []) holes.push({ x0: w.x - w.w / 2, x1: w.x + w.w / 2, y0: w.y0, y1: w.y1 });
    if (wallFor) {
      const custom = wallFor(side, len, holes);
      if (custom) {
        custom.position.set(...s.pos(W, D));
        custom.rotation.y = s.rot;
        group.add(custom);
        continue;
      }
    }
    const m = mesh(wallGeo(len, H, thick, holes), wallM);
    m.position.set(...s.pos(W, D));
    m.rotation.y = s.rot;
    group.add(m);
    if (doorX !== null && side !== 'back') {
      const bx = beyond[side] || {};
      const bw = doorW + 1.6;
      const bd = bx.depth ?? 3.2;
      const wallC = bx.wall ?? 0xe8dcc4;
      const mk = (c, rough = 0.85) => mat('matte', { c1: c, c2: c, p: [rough, 0, 0, 0], side: THREE.BackSide });
      const back = bx.outside ? glowMat(bx.outside, 1.0, { side: THREE.BackSide }) : mk(wallC);
      const box = mesh(new THREE.BoxGeometry(bw, doorH + 0.5, bd), [mk(wallC), mk(wallC), mk(bx.ceil ?? 0xf0eadc), mk(bx.floor ?? 0x6a4a2e, 0.7), mk(wallC), back], { shadow: false });
      const c = onWall(side, W, D, doorX, (doorH + 0.5) / 2, -thick - bd / 2 + 0.001);
      box.position.copy(c);
      box.rotation.y = s.rot;
      group.add(box);
    }
  }
  if (planks) {
    group.add(mesh(deckGeo(W, D, { plank: planks.w ?? 0.14, gap: 0.006, thick: 0.03, seed: 5 }), floorM, { pos: [0, 0, -D / 2], shadow: false }));
  } else {
    group.add(mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), floorM, { shadow: false }));
  }
  if (!noCeil) {
    const ceil = mesh(new THREE.PlaneGeometry(W + 0.4, D + 0.4).rotateX(Math.PI / 2), ceilM, { pos: [0, H, 0] });
    ceil.castShadow = true;
    group.add(ceil);
  }
  return { group, openings, doorH, offs };
}

/**
 * A window seen from inside, set in a wall hole of w × h: architrave, sill,
 * glazing bars, curtains on a brass rod, open louvred shutters (folded
 * back inside, the drawing room's "open shutters"), and the world outside.
 * Local XY, room toward +z, centred on the hole.
 */
function interiorWindow(P, w, h, { night = false, thick = 0.2, vista = 'garden', shutters = false, curtain = null, low = false } = {}) {
  const g = new THREE.Group();
  g.add(windowFrame(P, w, h));
  g.add(mesh(new THREE.PlaneGeometry(w, h), cached(`inGlass|${night}`, () => new THREE.MeshStandardMaterial({ color: 0xc8d8e0, roughness: 0.03, metalness: 0.6, transparent: true, opacity: night ? 0.14 : 0.1, depthWrite: false })), { pos: [0, 0, -thick * 0.6], shadow: false }));
  // outside: sky over a band of land, sea or foliage
  const out = new THREE.Group();
  out.position.z = -thick - 1.4;
  const sky = night ? glowMat(0x1c2848, 0.9) : glowMat(0xc8e2f8, 1.25);
  const band = vista === 'sea'
    ? (night ? glowMat(0x0c1a2a, 1) : glowMat(0x3a9ab0, 1.05))
    : (night ? glowMat(0x0a120c, 1) : glowMat(0x5a8a3e, 0.95));
  out.add(mesh(new THREE.PlaneGeometry(w + 3, h + 3), sky, { shadow: false }));
  const bandG = new THREE.Shape();
  bandG.moveTo(-(w + 3) / 2, -(h + 3) / 2);
  for (let k = 0; k <= 16; k++) {
    const x = -(w + 3) / 2 + ((w + 3) * k) / 16;
    const y = vista === 'sea' ? -h * 0.1 : -h * 0.05 + Math.sin(k * 1.7) * 0.18 + Math.sin(k * 0.6) * 0.25;
    bandG.lineTo(x, y);
  }
  bandG.lineTo((w + 3) / 2, -(h + 3) / 2);
  out.add(mesh(new THREE.ShapeGeometry(bandG), band, { pos: [0, 0, 0.01], shadow: false }));
  g.add(out);
  if (curtain && !low) {
    const cw = Math.max(0.35, w * 0.32);
    const ch = h + 0.55;
    const cg = cached(`drape|${cw}|${ch}`, () => {
      const c = new THREE.PlaneGeometry(cw, ch, 14, 4);
      const p = c.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i) / cw + 0.5;
        const v = 1 - (p.getY(i) / ch + 0.5);
        p.setZ(i, Math.sin(u * Math.PI * 6) * (0.03 + 0.02 * v));
        p.setX(i, p.getX(i) * (1 - 0.25 * v * (1 - Math.abs(u - 0.5))));
      }
      c.computeVertexNormals();
      return c;
    });
    for (const s of [-1, 1]) g.add(mesh(cg, curtain, { pos: [s * (w / 2 + cw / 2 - 0.12), (h + 0.55) / 2 - h / 2 - 0.2, 0.12], shadow: false }));
    g.add(mesh(cached(`rod|${w}`, () => new THREE.CylinderGeometry(0.014, 0.014, w + 2 * cw + 0.2, 8).rotateZ(Math.PI / 2)), P.gold, { pos: [0, h / 2 + 0.36, 0.14], shadow: false }));
  }
  if (shutters) {
    const sw = w / 2;
    const leafG = cached(`inShutter|${sw}|${h}|${low}`, () => {
      const p = [bake(beamGeo(0.05, h, 0.03), [-sw / 2 + 0.025, 0, 0]), bake(beamGeo(0.05, h, 0.03), [sw / 2 - 0.025, 0, 0]),
        bake(beamGeo(sw, 0.06, 0.03), [0, h / 2 - 0.03, 0]), bake(beamGeo(sw, 0.06, 0.03), [0, -h / 2 + 0.03, 0]), bake(beamGeo(sw, 0.05, 0.03), [0, 0, 0])];
      if (!low) for (let y = -h / 2 + 0.08; y < h / 2 - 0.06; y += 0.06) if (Math.abs(y) > 0.04) p.push(bake(new THREE.BoxGeometry(sw - 0.08, 0.045, 0.01), [0, y, 0], [0.55, 0, 0]));
      return merge(p);
    });
    for (const s of [-1, 1]) {
      const hinge = new THREE.Group();
      hinge.position.set(s * (w / 2), 0, 0.02);
      hinge.rotation.y = -s * Math.PI * 0.55;
      hinge.add(mesh(leafG, mat('wood', { c1: 0xf2ece0, c2: 0xe0d8c8, p: [5, 0, 0, 0] }), { pos: [-s * sw / 2, 0, 0] }));
      g.add(hinge);
    }
  }
  return g;
}

/** Places a window group into a side's wall at hole centre x, sill y0. */
function putWindow(group, side, W, D, win, obj) {
  const c = onWall(side, W, D, win.x, (win.y0 + win.y1) / 2);
  obj.position.copy(c);
  obj.rotation.y = SIDES[side].rot;
  group.add(obj);
}

/** The ceiling fans turn. */
function fanTick(fans) {
  return (t) => { for (const f of fans) f.userData.spin.rotation.y = t * 2.6; };
}

// ---------------------------------------------------------------- rooms

function livingRoom(ctx, spec, r, out) {
  const { night, low } = out;
  const W = 6.6;
  const D = 6.6;
  const H = 3.0;
  const P = F.islandPalette('bungalow');
  const wins = { ahead: [{ x: -2.1, w: 1.1, y0: 1.0, y1: 2.45 }, { x: 2.1, w: 1.1, y0: 1.0, y1: 2.45 }] };
  const sh = roomShell({ W, D, H, exits: spec.exits, wallM: M.plaster(0xf2ead8, 0x7e5a3a), floorM: M.carpet(0xc8b48c, 0xa8946c), ceilM: M.ceil(), windows: wins,
    beyond: { right: { wall: 0xf0e2b0, floor: 0x9a9a8a }, left: { wall: 0xdfe6e8, floor: 0xb89a8a } } });
  const g = out.group;
  g.add(sh.group);
  g.add(roomTrim(P, { W: W + 0.1, D: D + 0.1, H, openings: sh.openings, doorW: 1.2, thick: 0.1 }));
  const curtain = mat('fabric', { c1: 0xe8dcc4, c2: 0xc8b898, c3: 0x2e7a74, p: [1.0, 0.1, 0.3, 1], side: THREE.DoubleSide });
  for (const w of wins.ahead) putWindow(g, 'ahead', W, D, w, interiorWindow(P, w.w, w.y1 - w.y0, { night, curtain, low }));
  // "a couch and two chairs converge with an end table"
  const so = sofa(P, 2.3);
  so.position.set(0, 0, -D / 2 + 0.55);
  g.add(so);
  for (const s of [-1, 1]) {
    const ch = armchair(P);
    ch.position.set(s * 1.75, 0, -D / 2 + 2.45);
    ch.rotation.y = -s * 1.05;
    g.add(ch);
  }
  const et = sideTable(P, { lamp: true });
  et.position.set(1.55, 0, -D / 2 + 0.45);
  g.add(et);
  const ct = F.coffeeTable(P, r);
  ct.position.set(0, 0, -D / 2 + 1.75);
  g.add(ct);
  const fv = F.flowerVase(r, { h: 0.26 });
  fv.position.set(-0.3, 0.44, -D / 2 + 1.75);
  g.add(fv);
  // "a decorative entry with fresh flowers"
  const con = F.consoleTable(P, r, { w: 1.0 });
  con.position.set(W / 2 - 0.22, 0, 1.1);
  con.rotation.y = -Math.PI / 2;
  g.add(con);
  const pic = F.framedPicture(P, 1.3, 0.78, { kind: 'sea' });
  pic.position.set(0, 1.95, -D / 2 + 0.03);
  g.add(pic);
  for (const [x, z, k, s] of [[-W / 2 + 0.55, -D / 2 + 0.55, 'palm', 1.5], [W / 2 - 0.5, -D / 2 + 0.5, 'broad', 1.3]]) {
    const pp = F.pottedPlant({ kind: k, pot: 'glazed', size: s, seed: 3 });
    pp.position.set(x, 0, z);
    g.add(pp);
  }
  const fan = F.ceilingFan(P, { night });
  fan.position.set(0, H, -0.6);
  g.add(fan);
  out.ticks.push(fanTick([fan]));
  out.points.push({ pos: [1.55, 1.15, -D / 2 + 0.55], color: 0xffc98a, intensity: night ? 7 : 3, distance: 0 });
  out.points.push({ pos: [0, 1.5, -D / 2 + 0.9], color: night ? 0x7a8ab8 : 0xfff2dc, intensity: night ? 2 : 9, distance: 0 });
  if (night) out.points.push({ pos: [0, H - 0.8, -0.6], color: 0xffd8a0, intensity: 10, distance: 0 });
  out.key = { dir: [0.3, 0.8, -1], color: 0xfff0d8, intensity: night ? 0.1 : low ? 0.6 : 2.4, shadow: true };
  out.camera = { pos: [-0.6, 1.62, D / 2 - 0.55], look: [0.45, 1.15, -D / 2 + 1.2], fov: 64 };
  out.dims = [W, D, H];
}

function kitchen(ctx, spec, r, out) {
  const { night, low } = out;
  const W = 5.6;
  const D = 5.4;
  const H = 2.9;
  const P = F.islandPalette('bungalow');
  const wins = { ahead: [{ x: 0.35, w: 1.0, y0: 1.15, y1: 2.1 }] };
  const sh = roomShell({ W, D, H, exits: spec.exits, wallM: mat('plaster', { c1: 0xf2e4b4, c2: 0xece8dc, c3: 0x4a8a8a, p: [1.25, 1.25, 0, 0] }),
    floorM: mat('tile', { c1: 0xece6d6, c2: 0xd6d0c0, c3: 0x8aa8a0, p: [0.3, 0.01, 0.45, 0] }), ceilM: M.ceil(), windows: wins,
    beyond: { left: { wall: 0xf2ead8, floor: 0xb8a482 } } });
  const g = out.group;
  g.add(sh.group);
  g.add(roomTrim({ ...P, style: 'a' }, { W: W + 0.1, D: D + 0.1, H, openings: sh.openings, doorW: 1.2, thick: 0.1 }));
  const curtain = mat('fabric', { c1: 0xf0e8d8, c2: 0xb83a3a, p: [0.18, 0, 0, 1], side: THREE.DoubleSide });
  for (const w of wins.ahead) putWindow(g, 'ahead', W, D, w, interiorWindow(P, w.w, w.y1 - w.y0, { night, curtain, low }));
  // "A small gas stove and a refrigerator are all the only appliances here."
  const stove = F.gasStove({ night });
  stove.position.set(-W / 2 + 0.56, 0, -D / 2 + 0.36);
  g.add(stove);
  const cr = F.counterRun(P, 3.3, { sink: 0.35 - 0.05 });
  cr.position.set(-0.05 + 0.05, 0, -D / 2 + 0.32);
  g.add(cr);
  const fr = F.fridge();
  fr.position.set(W / 2 - 0.4, 0, -D / 2 + 1.0);
  fr.rotation.y = -Math.PI / 2;
  g.add(fr);
  const shelf = F.crockeryShelf(P, r, { w: 1.1 });
  shelf.position.set(1.55, 1.55, -D / 2 + 0.13);
  g.add(shelf);
  const kt = F.kitchenTable(P, r);
  kt.position.set(0.9, 0, 0.55);
  kt.rotation.y = 0.12;
  g.add(kt);
  for (const [x, z, a] of [[0.9, -0.15, Math.PI], [0.2, 0.7, Math.PI / 2 + 0.2]]) {
    const ch = F.spindleChair(P);
    ch.position.set(x, 0, z);
    ch.rotation.y = a;
    g.add(ch);
  }
  // an enamel pendant over the table
  g.add(mesh(cached('pendCord', () => new THREE.CylinderGeometry(0.006, 0.006, 0.9, 4)), IM.blackIron(), { pos: [0.9, H - 0.45, 0.55], shadow: false }));
  g.add(mesh(cached('pendShade', () => latheGeo([[0.02, 0], [0.05, -0.02], [0.2, -0.16], [0.22, -0.18]], 24)), mat('matte', { c1: 0x2e6a5a, p: [0.3, 0, 0.1, 0], side: THREE.DoubleSide }), { pos: [0.9, H - 0.9, 0.55], shadow: false }));
  g.add(mesh(cached('pendBulb', () => new THREE.SphereGeometry(0.05, 12, 8)), night ? glowMat(0xffe0b0, 3) : mat('matte', { c1: 0xf4f0e0, p: [0.2, 0, 0, 0] }), { pos: [0.9, H - 1.02, 0.55], shadow: false }));
  // "The gas oven has been left on and the whole room is reeking with natural gas."
  const gas = particles('mist', 14, { quality: ctx.quality, seed: 4, pos: [0, 1.3, -0.8], spread: [4.5, 1.4, 4.5], size: 600, alpha: 0.05, color: 0xd0e0a8, color2: 0xa8c090 });
  g.add(gas);
  out.ticks.push(gas.userData.tick);
  out.points.push({ pos: [0.9, H - 1.1, 0.55], color: 0xffd8a0, intensity: night ? 8 : 2.5, distance: 0 });
  out.points.push({ pos: [0.35, 1.7, -D / 2 + 0.9], color: night ? 0x6a7aa8 : 0xfff2dc, intensity: night ? 1.5 : 10, distance: 0 });
  out.key = { dir: [-0.2, 0.9, -1], color: 0xfff0d8, intensity: night ? 0.1 : low ? 0.6 : 2.2, shadow: true };
  out.camera = { pos: [-0.9, 1.62, D / 2 - 0.7], look: [0.2, 1.1, -D / 2 + 0.8], fov: 66 };
  out.dims = [W, D, H];
}

function bedroom(ctx, spec, r, out) {
  const { night, low } = out;
  const W = 6.6;
  const D = 6.6;
  const H = 3.0;
  const P = F.islandPalette('bedroom');
  const wins = { left: [{ x: 1.85, w: 1.0, y0: 1.0, y1: 2.45 }, { x: -1.15, w: 1.0, y0: 1.0, y1: 2.45 }] };
  const sh = roomShell({ W, D, H, exits: spec.exits, wallM: M.plaster(0xe4ebe8, 0xf4f0e6), floorM: M.carpet(0xc8ac98, 0xa88c78), ceilM: M.ceil(), windows: wins,
    beyond: { right: { wall: 0xf2ead8, floor: 0xb8a482 } } });
  const g = out.group;
  g.add(sh.group);
  g.add(roomTrim(P, { W: W + 0.1, D: D + 0.1, H, openings: sh.openings, doorW: 1.2, thick: 0.1 }));
  const curtain = mat('fabric', { c1: 0xf4efe4, c2: 0xd8d0c0, p: [1.4, 0.05, 0, 1], side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  for (const w of wins.left) putWindow(g, 'left', W, D, w, interiorWindow(P, w.w, w.y1 - w.y0, { night, curtain, low }));
  // "A soft feather comforter on top of layers of blankets"
  const { group: b, width: bw } = bed(P, spec.seed % 97);
  const bz = -D / 2 + 0.1 + 2.3 / 2 + 0.2;
  b.position.set(0.3, 0, bz);
  g.add(b);
  const lamps = [];
  for (const s of [-1, 1]) {
    const ns = nightstand(P);
    ns.position.set(0.3 + s * (bw / 2 + 0.36), 0, -D / 2 + 0.4);
    g.add(ns);
    const { group: lamp, lightY } = tableLamp(P);
    lamp.position.set(ns.position.x, 0.675, ns.position.z - 0.02);
    g.add(lamp);
    lamps.push([lamp.position.x, lamp.position.y + lightY, lamp.position.z]);
  }
  // "some end tables and a dresser"
  const dr = F.dresser(P);
  dr.position.set(-W / 2 + 0.36, 0, 0.35);
  dr.rotation.y = Math.PI / 2;
  g.add(dr);
  const pic = F.framedPicture(P, 1.1, 0.7, { kind: 'land', frame: P.woodDark });
  pic.position.set(0.3, 2.05, -D / 2 + 0.03);
  g.add(pic);
  const rug = mesh(blobGeo(1.1, 0.75, { t: 0.015, wobble: 0.05, seed: 3 }), mat('fabric', { c1: 0xd0b27a, c2: 0x9a7a48, p: [0.14, 0, 0, 1] }), { pos: [0.3, 0.004, bz + 1.55], shadow: false });
  g.add(rug);
  const pp = F.pottedPlant({ kind: 'palm', pot: 'white', size: 1.4, seed: 4 });
  pp.position.set(W / 2 - 0.55, 0, -D / 2 + 0.6);
  g.add(pp);
  const fan = F.ceilingFan(P, { night });
  fan.position.set(0.3, H, 0.4);
  g.add(fan);
  out.ticks.push(fanTick([fan]));
  for (const l of lamps.slice(0, 1)) out.points.push({ pos: l, color: 0xffc98a, intensity: night ? 6 : 2.5, distance: 0 });
  out.points.push({ pos: [lamps[1][0], lamps[1][1], lamps[1][2]], color: 0xffc98a, intensity: night ? 6 : 2.5, distance: 0 });
  out.points.push({ pos: [-W / 2 + 0.9, 1.8, 0.4], color: night ? 0x7a8ab8 : 0xfff2dc, intensity: night ? 1.5 : 12, distance: 0 });
  out.key = { dir: [-1, 0.75, 0.25], color: 0xfff0d8, intensity: night ? 0.1 : low ? 0.6 : 2.2, shadow: true };
  out.camera = { pos: [0.9, 1.62, D / 2 - 0.8], look: [-0.2, 1.05, -D / 2 + 1.3], fov: 64 };
  out.dims = [W, D, H];
}

function drawingRoom(ctx, spec, r, out) {
  const { night, low } = out;
  const W = 9.4;
  const D = 8.4;
  const H = 3.7;
  const P = F.islandPalette('parlor');
  const panel = mat('paneling', { c1: 0x7a4422, c2: 0x3e1e0c, c3: 0xd8b060, p: [0.9, 1.1, 0.08, 0.95] });
  const aw = 2.6;
  const ah = 2.7;
  const wins = { right: [{ x: -2.2, w: 1.3, y0: 0.55, y1: 2.85 }, { x: 1.6, w: 1.3, y0: 0.55, y1: 2.85 }] };
  // the far wall opens through an arch into the study
  const archWall = (side, len) => {
    if (side !== 'ahead') return null;
    const s = new THREE.Shape([new THREE.Vector2(-len / 2, 0), new THREE.Vector2(len / 2, 0), new THREE.Vector2(len / 2, H), new THREE.Vector2(-len / 2, H)]);
    const hole = new THREE.Path();
    hole.moveTo(-aw / 2, 0.001);
    hole.lineTo(aw / 2, 0.001);
    hole.lineTo(aw / 2, ah - aw / 2);
    hole.absarc(0, ah - aw / 2, aw / 2, 0, Math.PI, false);
    hole.lineTo(-aw / 2, 0.001);
    s.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.24, bevelEnabled: false, curveSegments: 16 });
    geo.translate(0, 0, -0.24);
    const gg = new THREE.Group();
    gg.add(mesh(geo, panel));
    const arc = [];
    for (let k = 0; k <= 24; k++) { const a = Math.PI - (k / 24) * Math.PI; arc.push([Math.cos(a) * (aw / 2 + 0.06), ah - aw / 2 + Math.sin(a) * (aw / 2 + 0.06), 0.02]); }
    const trimPts = [[-aw / 2 - 0.06, 0, 0.02], [-aw / 2 - 0.06, ah - aw / 2, 0.02], ...arc.slice(1, -1), [aw / 2 + 0.06, ah - aw / 2, 0.02], [aw / 2 + 0.06, 0, 0.02]];
    gg.add(mesh(tubeGeo(trimPts, 0.05, 64), mat('matte', { c1: 0xefe4cf, p: [0.4, 0, 0, 0] })));
    gg.add(mesh(latheGeo([[0, 0], [0.1, 0], [0.1, 0.06], [0.07, 0.1], [0.08, 0.2], [0, 0.2]], 12), mat('matte', { c1: 0xefe4cf, p: [0.4, 0, 0, 0] }), { pos: [0, ah + 0.04, 0.04], rot: [Math.PI / 2, 0, 0], scale: [1.2, 0.5, 1.2] }));
    return gg;
  };
  const sh = roomShell({ W, D, H, exits: spec.exits, wallM: panel, floorM: mat('wood', { c1: 0x7a5230, c2: 0x4a2e18, p: [4, 0, 0, 0] }), ceilM: M.ceil(), windows: wins, planks: { w: 0.12 }, wallFor: archWall });
  const g = out.group;
  g.add(sh.group);
  // mouldings broken at the arch (the arch has its own trim, so drop roomTrim's rectangular architraves)
  const trim = roomTrim(P, { W: W + 0.1, D: D + 0.1, H, openings: { ...sh.openings, ahead: new THREE.Vector3(0, 1.3, -D / 2) }, doorW: aw + 0.2, thick: 0.1 });
  for (const c of [...trim.children]) if (c.isGroup) trim.remove(c);
  g.add(trim);
  const curtain = mat('fabric', { c1: 0x6a1a22, c2: 0x3a0a12, c3: 0xc8a050, p: [1.1, 0.8, 0.2, 0.6], side: THREE.DoubleSide });
  for (const w of wins.right) putWindow(g, 'right', W, D, w, interiorWindow(P, w.w, w.y1 - w.y0, { night, curtain, shutters: true, low, thick: 0.2 }));
  // the study beyond the arch: the oaken desk and its telephone, bookcases, a banker's lamp
  const study = new THREE.Group();
  study.position.set(0, 0, -D / 2 - 0.24);
  const sd = 3.4;
  const sw = 5.2;
  const studyWall = mat('paneling', { c1: 0x5a2e14, c2: 0x2e1406, c3: 0xc8a050, p: [0.8, 1.0, 0.07, 0.95], side: THREE.BackSide });
  const studyCeil = mat('plaster', { c1: 0xf0e6d4, c2: 0xf0e6d4, p: [0, 0, 0, 0], side: THREE.BackSide });
  const studyFloor = mat('wood', { c1: 0x6a4428, c2: 0x3a2412, p: [4, 0, 0, 0], side: THREE.BackSide });
  study.add(mesh(new THREE.BoxGeometry(sw, H - 0.2, sd), [studyWall, studyWall, studyCeil, studyFloor, studyWall, studyWall], { pos: [0, (H - 0.2) / 2, -sd / 2], shadow: false }));
  const desk = F.oakDesk(P);
  desk.position.set(0, 0, -1.3);
  study.add(desk);
  const phone = F.candlestickPhone();
  phone.position.set(-0.5, 0.81, -1.25);
  phone.rotation.y = 0.4;
  study.add(phone);
  const bl = F.bankerLamp({ lit: night });
  bl.position.set(0.55, 0.81, -1.45);
  study.add(bl);
  const sc = F.studyChair(P);
  sc.position.set(0, 0, -2.1);
  study.add(sc);
  for (const x of [-1.5, 0, 1.5]) {
    const bc = F.bookcase(P, r, { w: 1.3, h: 2.4 });
    bc.position.set(x, 0, -sd + 0.2);
    study.add(bc);
  }
  g.add(study);
  // "plants and antique furniture of superb craftsmanship"
  const so = sofa(P, 2.3);
  so.position.set(-1.2, 0, -0.2);
  so.rotation.y = Math.PI / 2 - 0.05;
  g.add(so);
  for (const [x, z, a] of [[1.4, -1.0, -2.2], [1.6, 0.9, -1.1]]) {
    const ch = armchair(P);
    ch.position.set(x, 0, z);
    ch.rotation.y = a;
    g.add(ch);
  }
  const ct = F.coffeeTable(P, r, { w: 1.2, d: 0.65 });
  ct.position.set(0.2, 0, -0.1);
  ct.rotation.y = Math.PI / 2;
  g.add(ct);
  const sb = sideboard(P);
  sb.position.set(-W / 2 + 0.3, 0, 1.4);
  sb.rotation.y = Math.PI / 2;
  g.add(sb);
  for (const x of [-1.9, 1.9]) {
    const v = vasePedestal(P);
    v.position.set(x, 0, -D / 2 + 0.5);
    g.add(v);
  }
  const st = sideTable(P, { lamp: true });
  st.position.set(-1.3, 0, -1.75);
  g.add(st);
  for (const [x, z, k, s] of [[-W / 2 + 0.6, -D / 2 + 0.6, 'palm', 2.0], [W / 2 - 0.55, -D / 2 + 0.55, 'palm', 1.8], [W / 2 - 0.5, 3.1, 'fern', 1.3], [-W / 2 + 0.5, -1.2, 'fern', 1.3], [W / 2 - 0.5, -0.3, 'broad', 1.2]]) {
    const pp = F.pottedPlant({ kind: k, pot: k === 'palm' ? 'glazed' : 'white', size: s, seed: Math.round(x * 7 + z) });
    pp.position.set(x, k === 'fern' ? 0.62 : 0, z);
    g.add(pp);
    if (k === 'fern') g.add(mesh(cached('fernStand', () => weldNormalsSafe(latheGeo([[0, 0], [0.18, 0], [0.16, 0.05], [0.06, 0.1], [0.05, 0.55], [0.14, 0.6], [0.16, 0.62], [0, 0.62]], 16))), P.woodDark, { pos: [x, 0, z] }));
  }
  for (const [z, kind] of [[-1.9, 'land'], [2.1, 'sea']]) {
    const pic = F.framedPicture(P, 1.2, 0.85, { kind });
    pic.position.set(-W / 2 + 0.03, 2.05, z);
    pic.rotation.y = Math.PI / 2;
    g.add(pic);
  }
  const rugM = mat('carpet', { c1: 0x7a1a1a, c2: 0x2a1a3a, c3: 0xd8b060, p: [120, 1.4, 0, 0] });
  g.add(mesh(cached('parlorRug', () => roundedBoxGeo(4.2, 0.012, 3.0, 0.005, 1, 1)), rugM, { pos: [0.1, 0.006, -0.1], shadow: false }));
  g.add(mesh(cached('rugBorder', () => { const p = []; for (const s of [-1, 1]) { p.push(bake(roundedBoxGeo(4.2, 0.014, 0.12, 0.005, 1, 1), [0, 0, s * 1.44])); p.push(bake(roundedBoxGeo(0.12, 0.014, 3.0, 0.005, 1, 1), [s * 2.04, 0, 0])); } return merge(p); }), mat('carpet', { c1: 0xc8a050, c2: 0x8a6a2a, c3: 0xc8a050, p: [120, 2, 0, 0] }), { pos: [0.1, 0.007, -0.1], shadow: false }));
  const chan = chandelier(P, { drop: 1.2 });
  chan.position.set(0.1, H, -0.1);
  g.add(chan);
  // "The tropical sun is streaming in through open shutters"
  if (!night) {
    const shafts = lightShafts(0xfff0c0, { count: 5, len: 6, width: 1.1, spread: 2.2, alpha: 0.045, seed: 3 });
    shafts.position.set(W / 2 - 1.2, 0.3, -0.3);
    shafts.rotation.set(0, Math.PI / 2, -0.7);
    g.add(shafts);
    out.ticks.push(shafts.userData.tick);
    const motes = particles('motes', 40, { quality: ctx.quality, seed: 8, pos: [W / 2 - 1.8, 1.4, -0.3], spread: [1.6, 1.2, 3.2], size: 3, alpha: 0.4 });
    g.add(motes);
    out.ticks.push(motes.userData.tick);
  }
  out.points.push({ pos: [0.1, H - 1.1, -0.1], color: 0xffd6a0, intensity: night ? 14 : 3, distance: 0, flicker: 0.03 });
  out.points.push({ pos: [0, 1.4, -D / 2 - 1.5], color: 0xffc98a, intensity: night ? 4 : 2.5, distance: 0 });
  out.points.push({ pos: [W / 2 - 0.8, 2.0, -0.3], color: night ? 0x6a7ab8 : 0xfff0d0, intensity: night ? 2.5 : 16, distance: 0 });
  out.key = { dir: [1, 0.72, 0.15], color: 0xffe8c0, intensity: night ? 0.12 : low ? 0.7 : 3.2, shadow: true };
  out.camera = { pos: [-0.6, 1.62, D / 2 - 0.8], look: [0.5, 1.25, -D / 2 - 0.5], fov: 66 };
  out.dims = [W, D, H];
}
const weldNormalsSafe = (g) => { g.computeVertexNormals(); return g; };

function clubhouse(ctx, spec, r, out) {
  const { night, low } = out;
  const W = 16;
  const D = 14;
  const H = 4.6;
  const P = F.islandPalette('bungalow');
  const wins = { right: [-4.5, -0.5, 3.5].map((x) => ({ x, w: 1.6, y0: 1.0, y1: 2.6 })) };
  const sh = roomShell({ W, D, H, exits: spec.exits, wallM: mat('fabric', { c1: 0xc8a46a, c2: 0x8a6a3e, p: [0.1, 0, 0, 1] }), floorM: mat('wood', { c1: 0x9a7048, c2: 0x6a4a2c, p: [5, 0, 0, 0] }),
    ceilM: IM.thatch(), windows: wins, planks: { w: 0.16 } });
  const g = out.group;
  g.add(sh.group);
  const curtain = null;
  for (const w of wins.right) putWindow(g, 'right', W, D, w, interiorWindow(P, w.w, w.y1 - w.y0, { night, curtain, vista: 'sea', shutters: true, low }));
  // exposed beams and a ridge under the thatch
  const beams = [];
  for (let z = -D / 2 + 1; z < D / 2; z += 2.6) beams.push(bake(beamGeo(W, 0.26, 0.2, 0.03), [0, H - 0.2, z]));
  beams.push(bake(beamGeo(0.28, 0.3, D, 0.03), [0, H - 0.05, 0]));
  for (let z = -D / 2 + 1; z < D / 2; z += 2.6) for (const s of [-1, 1]) beams.push(bake(beamGeo(0.9, 0.12, 0.12, 0.02), [s * (W / 2 - 0.5), H - 0.6, z], [0, 0, s * 0.8]));
  g.add(mesh(merge(beams), IM.timber()));
  // along one wall, the bar
  const bar = F.barCounter(P, 8);
  bar.position.set(-W / 2 + 2.1, 0, -1.2);
  bar.rotation.y = Math.PI / 2;
  g.add(bar);
  const bb = F.backBar(P, r, 7.2, { night });
  bb.position.set(-W / 2 + 0.3, 0, -1.2);
  bb.rotation.y = Math.PI / 2;
  g.add(bb);
  const stools = [];
  for (let k = 0; k < 8; k++) {
    const s = F.barStool();
    const z = -4.6 + k * 0.95;
    s.position.set(-W / 2 + 2.95, 0, z);
    g.add(s);
    stools.push(z);
  }
  // the dance floor and the band's stage
  const df = F.danceFloor(6.4, 5.2, { night });
  df.position.set(1.4, 0, -1.9);
  g.add(df);
  const stage = F.bandStage(r, 7.4, { night });
  stage.position.set(1.4, 0, -D / 2 + 1.7);
  g.add(stage);
  // the restaurant along the lagoon windows
  const tables = low ? [[6.2, -3.5], [6.2, 0.5], [6.2, 4.2]] : [[6.2, -4.5], [6.2, -1.5], [6.4, 1.5], [6.2, 4.4], [4.4, 3.3]];
  for (const [x, z] of tables) {
    const t = F.bistroTable(r, { night });
    t.position.set(x, 0, z);
    g.add(t);
    for (const a of [0.6, 0.6 + Math.PI]) {
      const c = F.bistroChair();
      c.position.set(x + Math.cos(a) * 0.72, 0, z + Math.sin(a) * 0.72);
      c.rotation.y = -a - Math.PI / 2;
      g.add(c);
    }
  }
  // "closed off with a 2 inch nylon rope" (day)
  if (!night) {
    const posts = [[-3.2, 2.2], [0.3, 2.2], [3.6, 2.2], [-3.2, -0.8], [-3.2, -3.4], [-3.2, -5.9]];
    for (const [x, z] of posts) { const s = F.stanchion(); s.position.set(x, 0, z); g.add(s); }
    const links = [[0, 1], [1, 2], [0, 3], [3, 4], [4, 5]];
    for (const [a, b] of links) g.add(F.rope([posts[a][0], 0.95, posts[a][1]], [posts[b][0], 0.95, posts[b][1]]));
  }
  const fans = [];
  if (!night) for (const [x, z] of [[1.4, -1.5], [-3.5, 3.5]]) { const f = F.ceilingFan(P, { drop: 0.9 }); f.position.set(x, H - 0.3, z); g.add(f); fans.push(f); }
  if (fans.length) out.ticks.push(fanTick(fans));
  for (const [x, z] of [[-4.6, -3.5], [-4.6, 1.2], [5.2, 0]]) { const l = F.lantern({ night }); l.position.set(x, H - 1.35, z); g.add(l); }
  // people: a few at the bar by day; at night it is packed, the floor is full, the band plays
  const nBar = night ? (low ? 5 : 7) : 3;
  const patrons = crowd('bar', nBar, r, { night });
  patrons.children.forEach((f, i) => { const z = stools[night ? i : [1, 3, 6][i]]; f.position.set(-W / 2 + 2.95, 0, z); f.rotation.y = -Math.PI / 2; });
  g.add(patrons);
  out.ticks.push(patrons.userData.update);
  if (night) {
    const cr = crowd('dancers', low ? 6 : 10, r, { night: true });
    cr.children.forEach((f) => { f.position.set(1.4 + r.range(-2.6, 2.6), 0.06, -1.9 + r.range(-2.0, 2.0)); f.rotation.y = r.range(-Math.PI, Math.PI); });
    g.add(cr);
    out.ticks.push(cr.userData.update);
    const band = crowd('guests', 4, r, { night: true, rim: 0xff60c0 });
    band.children.forEach((f, i) => { f.position.set(1.4 - 2.4 + i * 1.6, 0.45, -D / 2 + 1.7 + (i === 1 ? -0.6 : 0.5)); });
    g.add(band);
    out.ticks.push(band.userData.update);
    const diners = crowd('guests', low ? 3 : 6, r, { night: true });
    diners.children.forEach((f, i) => { const [x, z] = tables[i % tables.length]; const a = 0.6 + (i >= tables.length ? Math.PI : 0) + 0.4; f.position.set(x + Math.cos(a) * 0.9, 0, z + Math.sin(a) * 0.9); f.rotation.y = Math.atan2(x - f.position.x, z - f.position.z); });
    g.add(diners);
    out.ticks.push(diners.userData.update);
    const beams2 = lightShafts(0xff60c0, { count: 4, len: 5, width: 0.8, spread: 2.6, alpha: 0.06, seed: 11 });
    beams2.position.set(1.4, 0, -1.5);
    g.add(beams2);
    out.ticks.push(beams2.userData.tick);
    out.points.push({ pos: [-2, H - 0.6, -1.5], color: 0xff3aa0, intensity: 40, distance: 0, strobe: 1.6 });
    out.points.push({ pos: [4.5, H - 0.6, -2.5], color: 0x3ac8ff, intensity: 40, distance: 0, strobe: 2.6 });
    out.points.push({ pos: [-W / 2 + 2.2, 2.6, -1.2], color: 0xffb070, intensity: 18, distance: 0, flicker: 0.1 });
  } else {
    out.points.push({ pos: [-W / 2 + 2.4, 2.6, -1.2], color: 0xffc080, intensity: 10, distance: 0 });
    out.points.push({ pos: [W / 2 - 1.2, 2.2, 0], color: 0xfff2dc, intensity: 45, distance: 0 });
  }
  out.key = { dir: [1, 0.8, 0.3], color: 0xfff0d8, intensity: night ? 0.1 : low ? 0.6 : 2.4, shadow: true };
  out.camera = { pos: [0.6, 1.66, D / 2 - 0.9], look: [-0.6, 1.3, -D / 2 + 1.5], fov: 66 };
  out.peopleSpots = [[-W / 2 + 3.8, 0, 1.0]];
  out.dims = [W, D, H];
}

/** Board walls with slits of daylight between the boards, a gable roof above. */
function barnShell(spec, { W, D, H, wallH, sag = 0, night, low, exitSide, floorM }) {
  const group = new THREE.Group();
  const doorW = 3.0;
  const doorH = 3.0;
  const outside = night ? glowMat(0x0a1224, 1) : glowMat(0xfff0cc, 1.5);
  const gh = H - wallH;
  for (const side of Object.keys(SIDES)) {
    const s = SIDES[side];
    const len = s.len(W, D);
    const holes = [];
    const exit = !!spec.exits[side];
    if (exit) holes.push({ x0: -doorW / 2, x1: doorW / 2, y0: -1, y1: doorH });
    // the gable ends (ahead, back) run up under the ridge
    const gable = side === 'ahead' || side === 'back';
    const top = gable ? (ax) => wallH + gh * Math.max(0, 1 - ax / (len / 2)) : null;
    const w = boardWall(len, gable ? H : wallH, IM.barnOld(), { vertical: true, board: low ? 0.4 : 0.24, holes, seed: 80 + len, battens: false, gap: 0.022, top });
    const wg = new THREE.Group();
    // boards face into the room: the wall's +z is the room side; daylight shows between them
    wg.add(w);
    const sh = new THREE.Shape([new THREE.Vector2(-len / 2 - 0.5, -0.2), new THREE.Vector2(len / 2 + 0.5, -0.2), new THREE.Vector2(len / 2 + 0.5, (gable ? H : wallH) + 0.4), new THREE.Vector2(-len / 2 - 0.5, (gable ? H : wallH) + 0.4)]);
    if (exit) sh.holes.push(new THREE.Path([new THREE.Vector2(-doorW / 2, -0.1), new THREE.Vector2(-doorW / 2, doorH), new THREE.Vector2(doorW / 2, doorH), new THREE.Vector2(doorW / 2, -0.1)]));
    wg.add(mesh(new THREE.ShapeGeometry(sh), outside, { pos: [0, 0, -0.3], shadow: false }));
    wg.position.set(...s.pos(W, D));
    wg.rotation.y = s.rot;
    group.add(wg);
    if (exit && side !== 'back') {
      // the yard through the big door: sky over sunlit grass
      // an open box of sky over sunlit grass, big enough for every angle through the door
      const sky = night ? glowMat(0x18223c, 1, { side: THREE.BackSide }) : glowMat(0xc8def0, 1.05, { side: THREE.BackSide });
      const grass = night ? glowMat(0x0a100a, 1, { side: THREE.BackSide }) : glowMat(0x6a8a44, 0.8, { side: THREE.BackSide });
      const yard = mesh(new THREE.BoxGeometry(D * 1.4, 7, 6), [sky, sky, sky, grass, sky, sky], { shadow: false });
      yard.position.copy(onWall(side, W, D, 0, 3.5 - 0.02, -0.4 - 3));
      yard.rotation.y = s.rot;
      group.add(yard);
      group.add(mesh(new THREE.PlaneGeometry(doorW + 0.2, 2.2).rotateX(-Math.PI / 2), M.dirt(), { pos: onWall(side, W, D, 0, 0.004, -1.1).toArray(), rot: [0, s.rot, 0], shadow: false }));
    }
  }
  group.add(mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), floorM, { shadow: false }));
  // the roof from inside: boards, rafters and tie beams (sagging in the garage)
  const roof = mesh(gableRoofGeo(W + 0.2, D + 0.2, H - wallH, { overhang: 0.3, t: 0.08, sag, ridge: false }), IM.barnOld(), { pos: [0, wallH, 0] });
  roof.material = mat('wood', { c1: 0x6a5a4a, c2: 0x3a3028, p: [4, 0, 0, 0], side: THREE.DoubleSide });
  roof.castShadow = true;
  group.add(roof);
  const tr = [];
  const pitch = Math.atan2(H - wallH, W / 2);
  const rl = Math.hypot(W / 2, H - wallH);
  for (let z = -D / 2 + 1.2; z < D / 2 - 0.5; z += 2.4) {
    const k = sag ? 1 - (z / (D / 2)) ** 2 : 0;
    tr.push(bake(beamGeo(W, 0.22, 0.16, 0.02), [0, wallH - 0.1 - sag * 0.4 * k, z], [0, 0, 0]));
    for (const s of [-1, 1]) tr.push(bake(beamGeo(rl, 0.18, 0.12, 0.02), [s * W / 4, wallH + (H - wallH) / 2 - 0.12 - sag * 0.8 * k, z], [0, 0, -s * pitch]));
    tr.push(bake(postGeo(H - wallH - 0.2, 0.14, 0.02), [0, wallH - sag * 0.6 * k, z]));
  }
  tr.push(bake(beamGeo(0.2, 0.24, D, 0.02), [0, H - 0.2, 0]));
  group.add(mesh(merge(tr), IM.timber()));
  return group;
}

function stables(ctx, spec, r, out) {
  const { night, low } = out;
  const W = 11;
  const D = 19;
  const H = 6.2;
  const wallH = 3.6;
  const g = out.group;
  g.add(barnShell(spec, { W, D, H, wallH, night, low, floorM: M.dirt() }));
  // stalls on both sides of the aisle
  const sw = 3.2;
  const sd = 3.3;
  const n = 5;
  const boards = [];
  const acrossZ = [];
  const bars = [];
  const hay = HAYM();
  const hayParts = [];
  const horses = [];
  const coats = [0x6a3a1c, 0x2a1a12, 0x8a5a2e, 0x4a2a18];
  for (const s of [-1, 1]) {
    const doorSide = (s < 0 && spec.exits.left) || (s > 0 && spec.exits.right);
    for (let k = 0; k <= n; k++) {
      const z = -D / 2 + 1.2 + k * sw;
      const zc0 = z + sw / 2;
      if (doorSide && Math.abs(zc0) < sw / 2 + 0.2) continue;
      const geo = k < n ? stallGeo(sw, sd, true) : stallGeo(sw, sd, false);
      const rot = s < 0 ? Math.PI / 2 : -Math.PI / 2;
      const x = s * (W / 2 - sd);
      const zc = z + sw / 2;
      // the stall's own frame: aisle at local z = 0 toward -z; its left partition at local x = -w/2
      boards.push(bake(geo.boards, [x, 0, zc], [0, rot, 0]));
      if (geo.across) acrossZ.push(bake(geo.across, [x, 0, zc], [0, rot, 0]));
      bars.push(bake(geo.bars, [x, 0, zc], [0, rot, 0]));
      if (k === n) continue;
      // hay rack in the back corner, straw on the floor
      hayParts.push(bake(F.hayBaleGeo(), [s * (W / 2 - 0.4), 1.4, zc - 0.6], [0, Math.PI / 2, 0], [0.9, 0.9, 0.9]));
      if (k < (low ? 2 : 4) && (k + (s > 0 ? 1 : 0)) % 2 === 0) horses.push({ x: s * (W / 2 - 1.75), z: zc + 0.1, face: s < 0 ? 0 : Math.PI, coat: coats[(k + (s > 0 ? 2 : 0)) % coats.length] });
    }
  }
  g.add(mesh(merge(boards), IM.barnOld()));
  // stall fronts run along z: built turned a quarter so the wood's grain follows the boards
  g.add(mesh(merge(acrossZ).applyMatrix4(new THREE.Matrix4().makeRotationY(-Math.PI / 2)), IM.barnOld(), { rot: [0, Math.PI / 2, 0] }));
  g.add(mesh(merge(bars), IM.blackIron()));
  g.add(mesh(merge(hayParts), hay, { shadow: false }));
  // loose straw over the floor
  const tuft = cached('strawTuft', () => {
    const p = [];
    for (let i = 0; i < 9; i++) { const b = F.bladeGeo(0.45, 0.025, 1.4, 3, 0, 0.02); b.rotateY((i / 9) * Math.PI * 2 + i); b.translate(Math.sin(i * 3.1) * 0.12, 0.01, Math.cos(i * 2.3) * 0.12); p.push(b); }
    return merge(p);
  });
  const spots = [];
  for (let i = 0; i < (low ? 60 : 160); i++) spots.push([r.range(-W / 2 + 0.3, W / 2 - 0.3), r.range(-D / 2 + 0.5, D / 2 - 1)]);
  const straw = new THREE.InstancedMesh(tuft, mat('leaf', { c1: 0xc8a860, c2: 0xa88a48, c3: 0xe0c88a, p: [0.9, 0, 0.03, 0], side: THREE.DoubleSide, alphaTest: 0.4 }), spots.length);
  const m4 = new THREE.Matrix4();
  spots.forEach(([x, z], i) => { m4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r.range(0, 6.28), 0)), new THREE.Vector3(1, 1, 1)); straw.setMatrixAt(i, m4); });
  straw.receiveShadow = true;
  g.add(straw);
  // "Neighing horses snacking on hay and oats fill the stalls on both sides of the barn."
  horses.forEach((h, i) => {
    const { object, update } = prop(C.HORSE, { night, quality: ctx.quality, seed: spec.seed + 200 + i });
    const coat = mat('fabric', { c1: h.coat, c2: h.coat, p: [3, 0.45, 0, 0.5] });
    const mane = mat('fabric', { c1: 0x1a120c, c2: 0x0e0a06, p: [4, 0.5, 0, 1] });
    object.traverse((o) => {
      if (!o.isMesh || !o.material?.userData?.u) return;
      const c1 = o.material.userData.u.uC1.value.getHex();
      if (c1 === 0xf4f1ea) o.material = coat;
      else if (c1 === 0xeee8dc) o.material = mane;
    });
    object.position.set(h.x, 0, h.z);
    object.rotation.y = h.face;
    object.scale.setScalar(0.94);
    g.add(object);
    if (update) out.ticks.push(update);
  });
  // bales stacked at the far end, a barrow, a fork, buckets, lanterns
  const bales = [];
  for (let k = 0; k < 7; k++) bales.push(bake(F.hayBaleGeo(), [-1.6 + (k % 4) * 0.95 - (k >= 4 ? -0.45 : 0), (k >= 4 ? 0.42 : 0), -D / 2 + 0.6 + (k % 2) * 0.05], [0, 0, 0]));
  g.add(mesh(merge(bales), hay));
  const twine = [];
  for (let k = 0; k < 7; k++) for (const dx of [-0.22, 0.22]) twine.push(bake(new THREE.TorusGeometry(0.235, 0.008, 4, 12).scale(1, 0.95, 1.05), [-1.6 + (k % 4) * 0.95 - (k >= 4 ? -0.45 : 0) + dx, (k >= 4 ? 0.42 : 0) + 0.21, -D / 2 + 0.6 + (k % 2) * 0.05], [0, Math.PI / 2, 0]));
  g.add(mesh(merge(twine), IM.rope(), { shadow: false }));
  const wb = F.wheelbarrow();
  wb.position.set(1.6, 0, -D / 2 + 2.6);
  wb.rotation.y = -0.6;
  g.add(wb);
  const fork = mesh(F.toolGeo('fork'), IM.timber(), { pos: [-2.2, 0, -D / 2 + 3.4], rot: [0.25, 0.5, 0.05] });
  g.add(fork);
  const buckets = [];
  for (const [x, z] of [[-W / 2 + 3.4, -2], [W / 2 - 3.4, 1.4], [-W / 2 + 3.4, 4.3]]) buckets.push(bake(cached('bucket', () => weldNormals2(latheGeo([[0, 0], [0.13, 0], [0.16, 0.3], [0.165, 0.31], [0.15, 0.31], [0.12, 0.02], [0, 0.02]], 16))), [x, 0, z]));
  g.add(mesh(merge(buckets), mat('metal', { c1: 0xb8bcc0, c2: 0x7a7a6a, p: [0.4, 0.5, 0, 0] })));
  const lamps = [];
  for (const z of [-3.5, 3.0]) { const l = F.lantern({ night }); l.position.set(0, wallH - 0.9, z); g.add(l); lamps.push(z); }
  // "The old boards of the barn part just enough to let in dust laden shafts of light."
  const shafts = lightShafts(0xffe6b0, { count: 8, len: 9, width: 0.5, spread: 6, alpha: night ? 0.012 : 0.07, seed: 5 });
  shafts.position.set(0, 0, 2);
  g.add(shafts);
  out.ticks.push(shafts.userData.tick);
  const motes = particles('motes', low ? 40 : 90, { quality: ctx.quality, seed: 7, pos: [0, 2.2, 0], spread: [4, 2, 8], size: 3, alpha: 0.5 });
  g.add(motes);
  out.ticks.push(motes.userData.tick);
  if (!night) {
    // "Flies swarm overhead and strafe the ground for dung."
    const flies = particles('motes', 50, { quality: ctx.quality, seed: 6, pos: [0, 1.6, -D * 0.1], spread: [3, 1.6, 6], size: 2.5, alpha: 0.8, swirl: 2.2, color: 0x1a1a1a, color2: 0x2a2a2a });
    g.add(flies);
    out.ticks.push(flies.userData.tick);
  }
  out.points.push({ pos: [0, wallH - 1.0, lamps[0]], color: 0xffb070, intensity: night ? 14 : 4, distance: 0, flicker: 0.15 });
  out.points.push({ pos: [0, wallH - 1.0, lamps[1]], color: 0xffb070, intensity: night ? 14 : 4, distance: 0, flicker: 0.15 });
  if (!night) out.points.push({ pos: [0, 3.2, -D / 2 + 3], color: 0xffe8c0, intensity: 30, distance: 0 });
  out.key = { dir: [0.5, 1, 0.25], color: 0xffe6c0, intensity: night ? 0.05 : low ? 0.5 : 2.2, shadow: true };
  out.camera = { pos: [0.4, 1.66, D / 2 - 1.2], look: [-0.2, 1.25, -D / 2 + 2], fov: 64 };
  out.largeSpots = [[0.3, 0, 1.2]];
  out.fog = { color: night ? 0x0e0a08 : 0x3a2e1e, density: 0.028 };
  out.dims = [W, D, H];
}
const HAYM = () => mat('bark', { c1: 0xd8b86a, c2: 0x9a7a3a, p: [220, 8, 0, 0], side: THREE.DoubleSide });
const stallGeo = (w, d, door) => F.stallGeo(w, d, { door });
const weldNormals2 = (g) => { g.computeVertexNormals(); return g; };

function garage(ctx, spec, r, out) {
  const { night, low } = out;
  const W = 10;
  const D = 12;
  const H = 5.4;
  const wallH = 3.4;
  const g = out.group;
  g.add(barnShell(spec, { W, D, H, wallH, sag: 0.35, night, low, floorM: M.concrete() }));
  // an oil stain under the car
  g.add(mesh(blobGeo(1.1, 0.7, { t: 0.004, wobble: 0.3, seed: 2 }), mat('matte', { c1: 0x1a1612, p: [0.25, 0, 0.1, 0], transparent: true, opacity: 0.7 }), { pos: [0.2, 0.002, -D * 0.15 + 0.6], shadow: false }));
  // "Beneath a sagging roof stand gardening tools and greasy rags."
  const wbch = F.workbench(r, { w: 2.6 });
  wbch.position.set(-W / 2 + 0.42, 0, -0.6);
  wbch.rotation.y = Math.PI / 2;
  g.add(wbch);
  const tools = [];
  ['rake', 'shovel', 'hoe', 'fork', 'spade', 'rake', 'shovel'].forEach((k, i) => tools.push(bake(F.toolGeo(k), [-3.4 + i * 0.5, 0, -D / 2 + 0.24], [-0.2 + (i % 2) * 0.05, 0, (i % 3 - 1) * 0.06])));
  g.add(mesh(merge(tools), IM.timber()));
  g.add(mesh(cached('toolBoard', () => roundedBoxGeo(3.8, 0.2, 0.04, 0.01, 1, 1)), IM.barnOld(), { pos: [-1.9, 1.45, -D / 2 + 0.06] }));
  const drum = mesh(F.oilDrumGeo(), mat('metal', { c1: 0x2a4a7a, c2: 0x6a3a1a, p: [0.5, 0.8, 0, 0] }), { pos: [W / 2 - 0.7, 0, -D / 2 + 0.8] });
  g.add(drum);
  const drum2 = mesh(F.oilDrumGeo(), mat('metal', { c1: 0x8a2a1a, c2: 0x5a3a1a, p: [0.5, 0.9, 0, 0] }), { pos: [W / 2 - 1.4, 0, -D / 2 + 0.7], rot: [0, 1, 0] });
  g.add(drum2);
  const rag = mat('cloth', { c1: 0x6a6258, c2: 0x2a2418, p: [9, 0, 0, 0], side: THREE.DoubleSide });
  g.add(mesh(cached('drumRag', () => F.bladeGeo(0.4, 0.3, 1.2, 6, 0.4, 0.05)), rag, { pos: [W / 2 - 0.7, 0.88, -D / 2 + 0.8], rot: [0, 0.7, 0], shadow: false }));
  const wb = F.wheelbarrow();
  wb.position.set(-W / 2 + 1.4, 0, 2.8);
  wb.rotation.y = 0.9;
  g.add(wb);
  // a bare bulb on a flex
  g.add(mesh(cached('flex', () => new THREE.CylinderGeometry(0.006, 0.006, 1.4, 4)), IM.blackIron(), { pos: [0, wallH - 0.4 - 0.7, -0.8], shadow: false }));
  g.add(mesh(cached('bulb', () => new THREE.SphereGeometry(0.05, 12, 8)), night ? glowMat(0xffe0a0, 3) : mat('matte', { c1: 0xf4f0e0, p: [0.2, 0, 0, 0] }), { pos: [0, wallH - 1.85, -0.8], scale: [1, 1.3, 1], shadow: false }));
  const shafts = lightShafts(0xfff0c0, { count: 5, len: 7, width: 0.5, spread: 3, alpha: night ? 0.01 : 0.06, seed: 8 });
  shafts.position.set(1, 0, 0);
  g.add(shafts);
  out.ticks.push(shafts.userData.tick);
  out.points.push({ pos: [0, wallH - 2.0, -0.8], color: 0xffd8a0, intensity: night ? 16 : 5, distance: 0 });
  if (!night) out.points.push({ pos: [W / 2 - 1.5, 2.2, -1.2], color: 0xfff0d8, intensity: 26, distance: 0 });
  out.key = { dir: [0.6, 1, 0.3], color: 0xffe6c0, intensity: night ? 0.05 : low ? 0.5 : 2.0, shadow: true };
  out.camera = { pos: [2.6, 1.66, D / 2 - 1.0], look: [-1.4, 1.0, -D / 2 + 1.5], fov: 64 };
  out.largeSpots = [[0.2, 0, -D * 0.15]];
  out.fog = { color: night ? 0x0c0a08 : 0x2e2820, density: 0.022 };
  out.dims = [W, D, H];
}

// ---------------------------------------------------------------- dispatch

const ROOMS = { 165: livingRoom, 217: kitchen, 218: bedroom, 190: drawingRoom, 235: clubhouse, 236: stables, 237: garage };

export function buildInterior(spec, ctx) {
  const r = rng(spec.seed);
  const night = spec.night;
  const low = ctx.quality === 'low';
  const out = { group: new THREE.Group(), ticks: [], points: [], night, low };
  const build = ROOMS[spec.room] || (spec.place === 'stables' ? stables : spec.place === 'garage' ? garage : spec.place === 'clubhouse' ? clubhouse : livingRoom);
  build(ctx, spec, r, out);
  const [W, D] = out.dims;
  const warm = night ? 0xffb070 : 0xfff0d8;
  return {
    group: out.group,
    ticks: out.ticks,
    camera: out.camera,
    lights: {
      hemi: { sky: night ? 0x5a6488 : 0xfff0d8, ground: 0x3a2a1a, intensity: night ? 0.3 : 0.5 },
      key: out.key || { dir: [0.4, 1, 0.3], color: warm, intensity: 0.5, shadow: true },
      points: out.points.slice(0, 4),
    },
    fog: out.fog || { color: 0x0c0a08, density: 0.01 },
    background: 0x050403,
    sky: null,
    env: 'ship-lux',
    envIntensity: night ? 0.35 : 0.55,
    grade: { exposure: night ? 1.05 : 1.0, saturation: 1.02, contrast: 1.05, tint: night ? [1.03, 0.98, 0.95] : [1.03, 1.0, 0.95], vignette: 0.4, bloom: 0.4, threshold: 1.35 },
    propAnchor: { x: 0, y: 0, z: D / 2 - 2.8, spread: 1.2, radius: 1.2 },
    largeSpots: out.largeSpots || [[0, 0, -D * 0.15], [2, 0, -2], [-2, 0, -2]],
    peopleSpots: out.peopleSpots || [[0.8, 0, D / 2 - 3.4], [-1.2, 0, D / 2 - 3.8]],
  };
}
