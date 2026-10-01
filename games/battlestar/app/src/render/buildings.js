// Island structures in the modelled style (ADR-013), all procedural:
// thatched huts in three builds (a reed-walled round hut, a bamboo hut with
// a hipped roof, an open-sided fale), the vacation bungalow on stilts with
// its veranda, the ornate white cottage (carved bargeboards, bell tower,
// gingerbread porch, gas lamps), the seaplane dock and its thatched shelter,
// the clubhouse over the lagoon, the red barn and the old garage, the
// fountain, benches, buffet tables, tiki torches, the luau fire pit and
// outrigger canoes. Construction parts come from island-build.js.

import * as THREE from 'three';
import { mat, glowMat } from './materials.js';
import { mesh } from './geo.js';
import { particles, glowSprite } from './fx.js';
import { latheGeo, cushionGeo, tubeGeo, weldNormals, roundedBoxGeo } from './model.js';
import { merge } from './flora.js';
import {
  IM, cached, bake, beamGeo, assemble, postGeo, boardWall, deckGeo, insideBox, windowUnit, doorUnit,
  railingGeo, stepsGeo, thatchGeo, thatchSlabGeo, gableRoofGeo, gambrelGeo, gambrelTop, bargeboardGeo, finialGeo, bambooGeo,
} from './island-build.js';
import { pottedPlant, rockingChair, parkBench, gasLamp, bugLight, doorMat, buffetTable, wroughtChair, wroughtTable } from './island-furnish.js';

const THICK = 0.32; // thatch thickness (thatchGeo's underside)
/** The y at which a thatch of (R, H) sits so its underside rests on a wall top at radius rw. */
const roofSeat = (top, R, H, rw) => top - H * (1 - rw / R) + THICK - 0.06;

function topKnot(y, m) {
  const g = new THREE.Group();
  g.add(mesh(cached('knot', () => weldNormals(latheGeo([[0, 0], [0.24, 0], [0.26, 0.08], [0.15, 0.2], [0.19, 0.32], [0.07, 0.55], [0, 0.6]], 14))), m, { pos: [0, y, 0] }));
  g.add(mesh(cached('knotTie', () => new THREE.TorusGeometry(0.17, 0.028, 6, 16).rotateX(Math.PI / 2)), IM.rope(), { pos: [0, y + 0.19, 0] }));
  return g;
}

// ---------------------------------------------------------------- huts

/** Round hut: reed walls on a coral plinth, a coursed cone of thatch. */
function hutRound(r, night, low) {
  const g = new THREE.Group();
  const seg = low ? 32 : 56;
  const base = 0.26;
  const rw = 2.05;
  const wallH = 2.25;
  const top = base + wallH;
  g.add(mesh(cached('plinthR', () => latheGeo([[0, 0], [2.45, 0], [2.5, 0.08], [2.44, 0.2], [2.32, base], [0, base]], 28)), IM.coral()));
  const gap = 0.31;
  const doorH = 1.78;
  g.add(mesh(cached(`hutWall|${seg}`, () => new THREE.CylinderGeometry(rw, rw + 0.05, wallH, seg, 1, true, gap, Math.PI * 2 - 2 * gap)), IM.reed(), { pos: [0, base + wallH / 2, 0] }));
  g.add(mesh(cached('hutLintel', () => new THREE.CylinderGeometry(rw, rw + 0.01, wallH - doorH, 8, 1, true, -gap, 2 * gap)), IM.reed(), { pos: [0, top - (wallH - doorH) / 2, 0] }));
  const dz = rw * Math.cos(gap);
  const dw = rw * Math.sin(gap);
  g.add(assemble([
    [postGeo(doorH + 0.1, 0.13, 0.02), [-dw, base, dz + 0.02]],
    [postGeo(doorH + 0.1, 0.13, 0.02), [dw, base, dz + 0.02]],
    [beamGeo(dw * 2 + 0.36, 0.13, 0.15, 0.02), [0, base + doorH + 0.06, dz + 0.04]],
  ], IM.timber()));
  const ib = insideBox(dw * 2 - 0.04, doorH + 0.3, 1.8, night);
  ib.position.set(0, base, dz - 0.03);
  g.add(ib);
  if (!low) g.add(mesh(cached('rolledMat', () => new THREE.CapsuleGeometry(0.075, dw * 2 - 0.1, 4, 10).rotateZ(Math.PI / 2)), IM.weave(), { pos: [0, base + doorH - 0.1, dz + 0.1] }));
  g.add(mesh(cached('hutStep', () => roundedBoxGeo(1.3, 0.14, 0.55, 0.05, 2, 1)), IM.stone(), { pos: [0, 0.07, dz + 0.55] }));
  const R = r.range(2.7, 2.85);
  const H = r.range(2.9, 3.3);
  const y = roofSeat(top, R, H, rw);
  const roof = mesh(thatchGeo(R, H, { courses: 3, seed: r.int(1, 7), seg }), r.chance(0.35) ? IM.thatchOld() : IM.thatch(), { pos: [0, y, 0], rot: [0, r.range(0, 6.28), 0] });
  g.add(roof);
  g.add(topKnot(y + H - 0.08, IM.thatch()));
  return g;
}

/** Square bamboo hut with a hipped thatch, a propped window shutter each side. */
function hutSquare(r, night, low) {
  const g = new THREE.Group();
  const hw = 1.9;
  const base = 0.22;
  const wallH = 2.3;
  const top = base + wallH;
  g.add(mesh(cached('plinthS', () => roundedBoxGeo(hw * 2 + 0.4, base, hw * 2 + 0.4, 0.05, 2, 1).translate(0, base / 2, 0)), IM.stone()));
  // bamboo cladding, merged, openings left for the door (front) and a window on each side
  const doorW = 0.52;
  const doorH = 1.8;
  const win = { y0: 0.95, y1: 1.65, h: 0.45 };
  const poles = [];
  const pole = (len) => cached(`bpole|${len.toFixed(2)}`, () => new THREE.CylinderGeometry(0.046, 0.046, len, 6, 1, true));
  const step = low ? 0.16 : 0.094;
  for (let side = 0; side < 4; side++) {
    const rot = [0, -Math.PI / 2, Math.PI, Math.PI / 2][side];
    for (let t = -hw + 0.12; t < hw - 0.08; t += step) {
      const spans = [];
      if (side === 0 && Math.abs(t) < doorW) spans.push([doorH, wallH]);
      else if ((side === 1 || side === 3) && Math.abs(t) < win.h) spans.push([0, win.y0], [win.y1, wallH]);
      else spans.push([0, wallH]);
      for (const [a, b] of spans) {
        const len = b - a;
        const x = t;
        const z = hw;
        poles.push(bake(pole(len), [x * Math.cos(rot) + z * Math.sin(rot), base + a + len / 2, -x * Math.sin(rot) + z * Math.cos(rot)]));
      }
    }
  }
  g.add(mesh(merge(poles), IM.bamboo()));
  // corner posts, lashing rails, door and window frames
  const frame = [];
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) frame.push(bake(bambooGeo(wallH + 0.1, 0.085, { seg: 7 }), [x * hw, base, z * hw]));
  for (const y of [0.35, 2.05]) {
    for (let side = 0; side < 4; side++) {
      const rot = [0, -Math.PI / 2, Math.PI, Math.PI / 2][side];
      frame.push(bake(cached('rail', () => new THREE.CylinderGeometry(0.035, 0.035, hw * 2, 6).rotateZ(Math.PI / 2)), [Math.sin(rot) * (hw + 0.07), base + y, Math.cos(rot) * (hw + 0.07)], [0, rot, 0]));
    }
  }
  for (const s of [-1, 1]) frame.push(bake(bambooGeo(doorH + 0.05, 0.06, { seg: 6 }), [s * (doorW + 0.02), base, hw + 0.04]));
  frame.push(bake(cached('lint', () => new THREE.CylinderGeometry(0.06, 0.06, doorW * 2 + 0.3, 6).rotateZ(Math.PI / 2)), [0, base + doorH + 0.04, hw + 0.05]));
  g.add(mesh(merge(frame), IM.pole()));
  const ib = insideBox(hw * 2 - 0.1, wallH, hw * 2 - 0.1, night);
  ib.position.set(0, base, hw - 0.06);
  g.add(ib);
  // woven door leaf standing open inward; shutters propped on a stick
  const leafG = cached('wovenLeaf', () => roundedBoxGeo(doorW * 2 - 0.04, doorH - 0.04, 0.035, 0.012, 1, 1).translate(doorW - 0.02, (doorH - 0.04) / 2, 0));
  const leaf = mesh(leafG, IM.weaveDark(), { pos: [-doorW, base + 0.02, hw - 0.1], rot: [0, 1.2, 0] });
  g.add(leaf);
  const shutG = cached('shutter', () => roundedBoxGeo(win.h * 2 + 0.1, win.y1 - win.y0 + 0.1, 0.03, 0.01, 1, 1).translate(0, -(win.y1 - win.y0 + 0.1) / 2, 0));
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(s * (hw + 0.08), base + win.y1 + 0.05, 0);
    sh.rotation.y = s * Math.PI / 2;
    const leafS = mesh(shutG, IM.weave(), { rot: [-0.75, 0, 0] });
    sh.add(leafS);
    sh.add(mesh(cached('prop', () => new THREE.CylinderGeometry(0.015, 0.015, 0.62, 5)), IM.pole(), { pos: [0.2, -0.32, 0.22], rot: [0.75, 0, 0] }));
    g.add(sh);
  }
  const R = 2.65;
  const H = r.range(2.3, 2.7);
  const y = roofSeat(top, R, H, hw);
  g.add(mesh(thatchGeo(R, H, { square: true, courses: 3, seed: r.int(1, 7), seg: low ? 32 : 64 }), r.chance(0.4) ? IM.thatchOld() : IM.thatch(), { pos: [0, y, 0] }));
  g.add(topKnot(y + H - 0.08, IM.thatch()));
  g.add(mesh(finialGeo(0.55, 0.05), IM.timber(), { pos: [0, y + H + 0.35, 0] }));
  return g;
}

/** Open-sided fale on a coral platform: posts, rolled blinds, mats, a lantern. */
function hutFale(r, night, low) {
  const g = new THREE.Group();
  const seg = low ? 32 : 60;
  const base = 0.5;
  g.add(mesh(cached('plinthF', () => latheGeo([[0, 0], [3.25, 0], [3.3, 0.1], [3.2, 0.44], [3.08, base], [0, base]], 32)), IM.coral()));
  g.add(mesh(stepsGeo(1.5, 3, { rise: base / 3, going: 0.32 }), IM.coral(), { pos: [0, 0, 3.1 + 0.96] }));
  g.add(mesh(cached('faleMat', () => new THREE.CircleGeometry(2.5, 40).rotateX(-Math.PI / 2)), IM.weave(), { pos: [0, base + 0.006, 0], shadow: false }));
  const n = 10;
  const rp = 2.8;
  const postH = 2.15;
  const posts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / n;
    posts.push(bake(bambooGeo(postH, 0.1, { nodes: 0.5, seg: 8 }), [Math.sin(a) * rp, base, Math.cos(a) * rp]));
  }
  posts.push(bake(cached('ring', () => new THREE.TorusGeometry(rp, 0.09, 6, 40).rotateX(Math.PI / 2)), [0, base + postH, 0]));
  g.add(mesh(merge(posts), IM.pole()));
  if (!low) {
    const blinds = [];
    for (let i = 0; i < n; i++) {
      if (i === 0 || i === n - 1) continue; // keep the front open
      const a = ((i + 0.5) / n) * Math.PI * 2 + Math.PI / n;
      blinds.push(bake(cached('blind', () => new THREE.CapsuleGeometry(0.07, 1.45, 4, 8).rotateZ(Math.PI / 2)), [Math.sin(a) * (rp - 0.06), base + postH - 0.2, Math.cos(a) * (rp - 0.06)], [0, a + Math.PI / 2, 0]));
    }
    g.add(mesh(merge(blinds), IM.weave()));
  }
  // a low table, cushions and a hanging lantern
  g.add(mesh(cached('faleTable', () => roundedBoxGeo(1.1, 0.08, 0.7, 0.03, 2, 1).translate(0, 0.3, 0)), IM.timber(), { pos: [0.3, base, -0.4] }));
  g.add(assemble([[postGeo(0.28, 0.06, 0.01), [-0.15, 0, -0.65]], [postGeo(0.28, 0.06, 0.01), [0.75, 0, -0.65]], [postGeo(0.28, 0.06, 0.01), [-0.15, 0, -0.15]], [postGeo(0.28, 0.06, 0.01), [0.75, 0, -0.15]]], IM.timber(), { pos: [0, base, 0] }));
  const cush = mat('fabric', { c1: r.pick([0xc84a2a, 0x2a6a8a, 0xd8a030]), c2: 0x3a2014, c3: 0xf0e0c0, p: [1.0, 0.1, 0.5, 1] });
  for (const [x, z] of [[-1.0, 0.3], [1.3, 0.5], [-0.6, -1.5]]) g.add(mesh(cached('faleCush', () => cushionGeo(0.55, 0.1, 0.55, { r: 0.04, puff: 0.5 })), cush, { pos: [x, base + 0.06, z], rot: [0, r.range(0, 3), 0] }));
  const lantern = new THREE.Group();
  lantern.add(mesh(cached('lanternCord', () => new THREE.CylinderGeometry(0.006, 0.006, 0.9, 4)), IM.rope(), { pos: [0, -0.45, 0], shadow: false }));
  lantern.add(mesh(cached('lanternShade', () => weldNormals(latheGeo([[0, 0], [0.1, 0.02], [0.14, 0.14], [0.1, 0.28], [0.03, 0.3], [0, 0.3]], 12))), night ? glowMat(0xffb060, 1.6) : IM.weave(), { pos: [0, -1.2, 0], shadow: false }));
  lantern.position.set(0, base + postH + 0.6, 0);
  g.add(lantern);
  const R = 3.75;
  const H = r.range(2.3, 2.6);
  const y = roofSeat(base + postH, R, H, rp);
  g.add(mesh(thatchGeo(R, H, { courses: 4, seed: r.int(1, 7), seg }), IM.thatch(), { pos: [0, y, 0] }));
  g.add(topKnot(y + H - 0.08, IM.thatch()));
  return g;
}

/**
 * A thatched hut; light spills from the door at night. variant: 'round' |
 * 'square' | 'fale' (picked from r when omitted) — the village mixes them.
 */
export function hut(r, { night = false, scale = 1, quality = 'high', variant } = {}) {
  const v = variant || r.pick(['round', 'round', 'square', 'fale']);
  const low = quality === 'low';
  const g = v === 'square' ? hutSquare(r, night, low) : v === 'fale' ? hutFale(r, night, low) : hutRound(r, night, low);
  g.userData.variant = v;
  g.scale.setScalar(scale);
  return g;
}

// ---------------------------------------------------------------- the bungalow

/**
 * The vacation bungalow on stilts: weatherboard walls, a hipped thatch that
 * also covers the front veranda, turned railings, steps, the open front
 * door with the doormat, louvred shutters, a rocking chair and the bug
 * light (lit at night). Front (door) toward +z; the veranda deck's front
 * edge is at z = D/2 + VER. Returns a Group with userData { floorY, doorZ, deckZ, lightPos }.
 */
export function bungalow(r, { night = false, quality = 'high' } = {}) {
  const low = quality === 'low';
  const g = new THREE.Group();
  const W = 7.2;
  const D = 5.2;
  const VER = 2.3;
  const fy = 0.9;
  const wallH = 2.75;
  const top = fy + wallH;
  const board = low ? 0.4 : 0.19;
  const plank = IM.plank();
  const trim = IM.trim();
  // stilts on stone footings, the rim joists and the veranda deck
  const stilts = [];
  const footings = [];
  for (const x of [-W / 2 + 0.15, -1.2, 1.2, W / 2 - 0.15]) {
    for (const z of [-D / 2 + 0.15, 0, D / 2 - 0.1, D / 2 + VER - 0.15]) {
      stilts.push(bake(postGeo(fy, 0.18, 0.025), [x, 0, z]));
      footings.push(bake(cached('footing', () => latheGeo([[0, 0], [0.22, 0], [0.2, 0.18], [0.14, 0.22], [0, 0.22]], 8)), [x, -0.05, z]));
    }
  }
  stilts.push(bake(beamGeo(W + 0.2, 0.22, 0.12, 0.02), [0, fy - 0.12, D / 2 + VER - 0.08]));
  stilts.push(bake(beamGeo(W + 0.2, 0.22, 0.12, 0.02), [0, fy - 0.12, -D / 2 + 0.06]));
  for (const s of [-1, 1]) stilts.push(bake(beamGeo(D + VER, 0.22, 0.12, 0.02), [s * (W / 2 + 0.04), fy - 0.12, VER / 2], [0, Math.PI / 2, 0], [1, 1, 1]));
  g.add(mesh(merge(stilts), IM.timber()));
  g.add(mesh(merge(footings), IM.stone()));
  g.add(mesh(deckGeo(W + 0.1, D + VER, { seed: 3 }), plank, { pos: [0, fy, -D / 2] }));
  // walls: front with door and two windows, sides one window, back two
  const doorW = 1.0;
  const doorH = 2.12;
  const winW = 1.0;
  const winH = 1.25;
  const wy = 0.95;
  const holeW = (x) => ({ x0: x - winW / 2 - 0.06, x1: x + winW / 2 + 0.06, y0: wy - 0.05, y1: wy + winH + 0.06 });
  const walls = [
    { w: W, pos: [0, fy, D / 2], rot: 0, holes: [{ x0: -doorW / 2 - 0.02, x1: doorW / 2 + 0.02, y0: -1, y1: doorH + 0.02 }, holeW(-2.2), holeW(2.2)] },
    { w: W, pos: [0, fy, -D / 2], rot: Math.PI, holes: [holeW(-1.8), holeW(1.8)] },
    { w: D, pos: [W / 2, fy, 0], rot: Math.PI / 2, holes: [holeW(0)] },
    { w: D, pos: [-W / 2, fy, 0], rot: -Math.PI / 2, holes: [holeW(0)] },
  ];
  walls.forEach((wl, i) => {
    const m = boardWall(wl.w, wallH, IM.sage(), { holes: wl.holes, board, seed: i + 5 });
    m.position.set(...wl.pos);
    m.rotation.y = wl.rot;
    g.add(m);
    for (const h of wl.holes) {
      if (h.y0 < 0) continue;
      const wu = windowUnit({ w: winW, h: winH, night, low, bars: [1, 1], shutterM: IM.green(), open: 0.92 });
      const c = new THREE.Vector3((h.x0 + h.x1) / 2, wy + winH / 2, 0.01).applyAxisAngle(new THREE.Vector3(0, 1, 0), wl.rot);
      wu.position.set(wl.pos[0] + c.x, fy + c.y, wl.pos[2] + c.z);
      wu.rotation.y = wl.rot;
      g.add(wu);
    }
  });
  // corner boards and a frieze under the eaves
  const corners = [];
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) corners.push(bake(postGeo(wallH, 0.14, 0.012), [x * (W / 2 + 0.02), fy, z * (D / 2 + 0.02)]));
  corners.push(bake(beamGeo(W + 0.2, 0.2, 0.05), [0, top - 0.12, D / 2 + 0.05]), bake(beamGeo(W + 0.2, 0.2, 0.05), [0, top - 0.12, -D / 2 - 0.05]));
  for (const s of [-1, 1]) corners.push(bake(beamGeo(0.05, 0.2, D + 0.2), [s * (W / 2 + 0.05), top - 0.12, 0]));
  g.add(mesh(merge(corners), trim));
  // the front door stands open; doormat, bug light
  const door = doorUnit({ w: doorW, h: doorH, open: 0.62, night, glassTop: true, leafM: IM.green(), depth: 2.2 });
  door.position.set(0, fy, D / 2 + 0.01);
  g.add(door);
  const dm = doorMat();
  dm.position.set(0, fy, D / 2 + 0.5);
  g.add(dm);
  const bl = bugLight({ night });
  bl.position.set(doorW / 2 + 0.38, fy + 1.95, D / 2 + 0.04);
  g.add(bl);
  // veranda: posts, turned railing with a gap for the steps, steps down
  const vz = D / 2 + VER - 0.12;
  const vp = [];
  const pxs = [-(W - 0.2) / 2, -(W - 0.2) / 6, (W - 0.2) / 6, (W - 0.2) / 2];
  for (const x of pxs) vp.push(bake(postGeo(wallH, 0.15, 0.02), [x, fy, vz]));
  vp.push(bake(beamGeo(W + 0.1, 0.2, 0.16, 0.02), [0, top - 0.1, vz]));
  // brackets under the beam
  for (const x of pxs) for (const s of [-1, 1]) {
    if (Math.abs(x + s * 0.3) > W / 2) continue;
    vp.push(bake(beamGeo(0.42, 0.06, 0.07, 0.01), [x + s * 0.16, top - 0.34, vz], [0, 0, -s * 0.78]));
  }
  g.add(mesh(merge(vp), trim));
  const rail = railingGeo(W - 0.2, { h: 0.9, turned: !low, gap: [-0.9, 0.9] });
  g.add(mesh(rail, trim, { pos: [0, fy, vz] }));
  for (const s of [-1, 1]) g.add(mesh(railingGeo(VER - 0.1, { h: 0.9, turned: !low }), trim, { pos: [s * (W / 2 - 0.1), fy, D / 2 + VER / 2], rot: [0, Math.PI / 2, 0] }));
  const nSteps = 5;
  const rise = fy / nSteps;
  g.add(mesh(stepsGeo(1.7, nSteps, { rise, going: 0.3 }), plank, { pos: [0, 0, vz + 0.1 + nSteps * 0.3] }));
  for (const s of [-1, 1]) g.add(mesh(cached('stringer', () => beamGeo(0.07, 0.24, Math.hypot(nSteps * 0.3, fy) + 0.1, 0.02)), IM.timber(), { pos: [s * 0.88, fy / 2 - 0.02, vz + 0.1 + nSteps * 0.15], rot: [Math.atan2(fy, nSteps * 0.3), 0, 0] }));
  // porch furniture
  const rc = rockingChair();
  rc.position.set(-2.4, fy, D / 2 + 1.1);
  rc.rotation.y = 0.5;
  g.add(rc);
  for (const [x, z, k] of [[2.9, D / 2 + 0.45, 'palm'], [-3.1, D / 2 + VER - 0.5, 'fern'], [1.35, vz - 0.35, 'fern']]) {
    const p = pottedPlant({ kind: k, pot: 'terracotta', size: k === 'palm' ? 1.3 : 1.0, night, seed: Math.round(x * 10) });
    p.position.set(x, fy, z);
    g.add(p);
  }
  // roof: one hipped thatch over the house and the veranda
  const zc = VER / 2;
  const Rz = (D + VER) / 2 + 0.95;
  const Rx = W / 2 + 0.95;
  const H = 4.2;
  const y = roofSeat(top, Rz, H, Rz - 0.95);
  const roof = mesh(thatchGeo(Rz, H, { square: true, courses: 3, seed: 4, seg: low ? 40 : 72, fringe: 0.14 }), IM.thatch(), { pos: [0, y, zc], scale: [Rx / Rz, 1, 1] });
  g.add(roof);
  g.add(topKnot(y + H - 0.08, IM.thatch()));
  g.userData = { floorY: fy, doorZ: D / 2, deckZ: vz, lightPos: [bl.position.x, bl.position.y - 0.06, bl.position.z + 0.18] };
  return g;
}

// ---------------------------------------------------------------- the white cottage

/**
 * The ornate white house: clapboard on a stone base, a steep front gable
 * with carved, pierced bargeboards and a king-post truss, a red tile roof,
 * a bell tower on the ridge, and a gingerbread veranda with turned posts,
 * brackets, a spindle frieze and ferns. Front toward +z; the porch floor's
 * front edge is at z = D/2 + PD. userData: { floorY, porchZ, towerTop, doorX }.
 */
export function cottage(r, { night = false, quality = 'high', porchSet = false, chairs = 2 } = {}) {
  const low = quality === 'low';
  const g = new THREE.Group();
  const W = 10;
  const D = 8;
  const fy = 0.75;
  const wallH = 3.5;
  const top = fy + wallH;
  const PD = 2.6;
  const white = IM.white();
  const trim = IM.trim();
  const board = low ? 0.4 : 0.18;
  const warm = 0xffc27a;
  g.add(mesh(cached('cottBase', () => roundedBoxGeo(W + 0.3, fy, D + 0.3, 0.04, 1, 1).translate(0, fy / 2, 0)), IM.stone()));
  // walls
  const winW = 1.0;
  const winH = 1.9;
  const wy = 0.8;
  const doorW = 1.1;
  const doorH = 2.5;
  const doorX = 0;
  const hole = (x) => ({ x0: x - winW / 2 - 0.05, x1: x + winW / 2 + 0.05, y0: wy - 0.05, y1: wy + winH + 0.05 });
  const walls = [
    { w: W, pos: [0, fy, D / 2], rot: 0, holes: [{ x0: doorX - doorW / 2 - 0.03, x1: doorX + doorW / 2 + 0.03, y0: -1, y1: doorH + 0.03 }, hole(-3.1), hole(-1.6), hole(1.6), hole(3.1)] },
    { w: W, pos: [0, fy, -D / 2], rot: Math.PI, holes: [hole(-2.5), hole(2.5)] },
    { w: D, pos: [W / 2, fy, 0], rot: Math.PI / 2, holes: [hole(-2.2), hole(0), hole(2.2)] },
    { w: D, pos: [-W / 2, fy, 0], rot: -Math.PI / 2, holes: [hole(-2.2), hole(0), hole(2.2)] },
  ];
  walls.forEach((wl, i) => {
    const m = boardWall(wl.w, wallH, white, { holes: wl.holes, board, seed: i + 11 });
    m.position.set(...wl.pos);
    m.rotation.y = wl.rot;
    g.add(m);
    for (const h of wl.holes) {
      if (h.y0 < 0) continue;
      const wu = windowUnit({ w: winW, h: winH, night, low, warm, bars: [1, 1], head: true, shutterM: IM.green(), open: 0.95 });
      const c = new THREE.Vector3((h.x0 + h.x1) / 2, wy + winH / 2, 0.01).applyAxisAngle(new THREE.Vector3(0, 1, 0), wl.rot);
      wu.position.set(wl.pos[0] + c.x, fy + c.y, wl.pos[2] + c.z);
      wu.rotation.y = wl.rot;
      g.add(wu);
    }
  });
  const tr = [];
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) tr.push(bake(postGeo(wallH, 0.16, 0.012), [x * (W / 2 + 0.03), fy, z * (D / 2 + 0.03)]));
  for (const s of [-1, 1]) tr.push(bake(beamGeo(0.06, 0.26, D + 0.2), [s * (W / 2 + 0.06), top - 0.16, 0]));
  tr.push(bake(beamGeo(W + 0.3, 0.1, 0.1), [0, fy + 0.02, D / 2 + 0.06]));
  g.add(mesh(merge(tr), trim));
  const door = doorUnit({ w: doorW, h: doorH, open: night ? 0.0 : 0.08, night, warm, glassTop: true, leafM: mat('wood', { c1: 0x7a4a26, c2: 0x5a3418, p: [6, 0, 0, 0] }), depth: 2.6 });
  door.position.set(doorX, fy, D / 2 + 0.01);
  g.add(door);
  // the front gable (ridge along z), its clapboard triangle, a round attic window
  const H = 3.8;
  const oh = 0.55;
  g.add(mesh(gableRoofGeo(W, D, H, { overhang: oh, t: 0.14 }), IM.redTile(), { pos: [0, top, 0] }));
  const gTop = (y) => (W / 2) * (1 - y / H);
  for (const s of [-1, 1]) {
    const tri = boardWall(W, H, white, { board, seed: 20 + s, top: gTop, holes: s > 0 ? [{ x0: -0.55, x1: 0.55, y0: 1.0, y1: 2.1 }] : [] });
    tri.position.set(0, top, s * (D / 2));
    tri.rotation.y = s > 0 ? 0 : Math.PI;
    g.add(tri);
  }
  const lun = new THREE.Group();
  lun.add(mesh(cached('lunette', () => new THREE.TorusGeometry(0.5, 0.07, 8, 32)), trim));
  lun.add(mesh(cached('lunGlass', () => new THREE.CircleGeometry(0.48, 32)), night ? glowMat(warm, 0.8) : new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.05, metalness: 0.6 }), { shadow: false }));
  lun.add(mesh(cached('lunBars', () => merge([beamGeo(0.96, 0.03, 0.03), beamGeo(0.03, 0.96, 0.03)])), trim, { pos: [0, 0, 0.02] }));
  lun.position.set(0, top + 1.55, D / 2 + 0.06);
  g.add(lun);
  // carved bargeboards, king-post truss, finial and pendant on both gables
  const pitch = Math.atan2(H, W / 2);
  const rake = Math.hypot(W / 2 + oh, H + oh * Math.tan(pitch));
  const bb = bargeboardGeo(rake, { w: 0.36, every: 0.55, pierce: !low });
  for (const s of [-1, 1]) {
    const zf = s * (D / 2 + oh - 0.02);
    for (const side of [-1, 1]) {
      const m = mesh(bb, trim);
      // from the peak down to the eave
      m.position.set(0, top + H + 0.04, zf + (s > 0 ? 0 : -0.04));
      m.rotation.set(0, 0, side > 0 ? -pitch : Math.PI + pitch);
      if (side < 0) m.scale.y = -1;
      g.add(m);
    }
    const truss = [
      [postGeo(1.6, 0.12, 0.015), [0, top + H - 1.6, zf - s * 0.02]],
      [beamGeo(2.6, 0.1, 0.1, 0.015), [0, top + H - 1.25, zf - s * 0.02]],
      [beamGeo(1.2, 0.08, 0.08, 0.012), [-0.55, top + H - 0.8, zf - s * 0.02], [0, 0, pitch]],
      [beamGeo(1.2, 0.08, 0.08, 0.012), [0.55, top + H - 0.8, zf - s * 0.02], [0, 0, -pitch]],
    ];
    if (s > 0) g.add(assemble(truss, trim));
    g.add(mesh(finialGeo(0.95, 0.08), trim, { pos: [0, top + H + 0.12, zf] }));
    g.add(mesh(finialGeo(0.55, 0.07), trim, { pos: [0, top + H - 1.62, zf], rot: [Math.PI, 0, 0] }));
  }
  // the bell tower on the ridge, toward the back
  const tz = -D * 0.18;
  const tw = 1.7;
  const tBase = top + H * (1 - (tw / 2) / (W / 2)) - 0.2;
  const tH = top + H + 1.3 - tBase;
  const tower = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const w = boardWall(tw, tH, white, { board, seed: 40 + i });
    const a = (i * Math.PI) / 2;
    w.position.set(Math.sin(a) * tw / 2, 0, Math.cos(a) * tw / 2);
    w.rotation.y = a;
    tower.add(w);
  }
  const bel = [];
  const bY = tH + 0.12;
  const bH = 1.35;
  bel.push(bake(beamGeo(tw + 0.3, 0.12, tw + 0.3, 0.03), [0, tH + 0.06, 0]));
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) bel.push(bake(postGeo(bH, 0.16, 0.02), [x * (tw / 2 - 0.04), bY, z * (tw / 2 - 0.04)]));
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const arch = new THREE.TorusGeometry(tw / 2 - 0.12, 0.06, 6, 16, Math.PI);
    bel.push(bake(arch, [Math.sin(a) * (tw / 2 - 0.04), bY + bH - (tw / 2 - 0.12) - 0.05, Math.cos(a) * (tw / 2 - 0.04)], [0, a, 0]));
    bel.push(bake(beamGeo(tw, 0.08, 0.1), [Math.sin(a) * (tw / 2 - 0.04), bY + 0.5, Math.cos(a) * (tw / 2 - 0.04)], [0, a, 0]));
  }
  bel.push(bake(beamGeo(tw + 0.24, 0.14, tw + 0.24, 0.03), [0, bY + bH + 0.07, 0]));
  tower.add(mesh(merge(bel), trim));
  const bell = mesh(cached('bell', () => weldNormals(latheGeo([[0, 0], [0.34, 0], [0.36, 0.04], [0.3, 0.1], [0.24, 0.3], [0.2, 0.5], [0.12, 0.58], [0, 0.6]], 24))), IM.bronze(), { pos: [0, bY + bH - 0.85, 0] });
  tower.add(bell);
  const cap = mesh(thatchGeo(1.35, 1.5, { square: true, courses: 1, eave: 0.08, fringe: 0, seed: 1, seg: 32, thick: 0.1 }), IM.redTile(), { pos: [0, bY + bH + 0.18, 0] });
  tower.add(cap);
  tower.add(mesh(finialGeo(0.8, 0.07), IM.bronze(), { pos: [0, bY + bH + 1.6, 0] }));
  tower.position.set(0, tBase, tz);
  g.add(tower);
  // the veranda: deck, turned posts with brackets, spindle frieze, railing, steps, porch roof
  const vz = D / 2 + PD - 0.12;
  g.add(mesh(deckGeo(W + 0.2, PD, { seed: 9 }), IM.plankGrey(), { pos: [0, fy, D / 2] }));
  g.add(mesh(cached('porchSkirt', () => roundedBoxGeo(W + 0.2, fy, 0.12, 0.02, 1, 1)), IM.stone(), { pos: [0, fy / 2 - 0.02, D / 2 + PD - 0.06] }));
  const col = cached('porchCol', () => weldNormals(latheGeo([[0, 0], [0.12, 0], [0.12, 0.12], [0.09, 0.18], [0.075, 0.3], [0.085, 0.5], [0.06, 0.8], [0.055, 2.0], [0.07, 2.2], [0.06, 2.4], [0.1, 2.55], [0.1, 2.75], [0, 2.75]], 12)));
  const porchH = 2.95;
  const cols = [];
  const pxs = [-W / 2 + 0.15, -2.9, -1.0, 1.0, 2.9, W / 2 - 0.15];
  for (const x of pxs) cols.push(bake(col, [x, fy, vz], [0, 0, 0], [1, porchH / 2.75, 1]));
  g.add(mesh(merge(cols), trim));
  const gb = [];
  gb.push(bake(beamGeo(W + 0.3, 0.24, 0.18, 0.02), [0, fy + porchH + 0.1, vz]));
  if (!low) {
    const spind = cached('spindle', () => weldNormals(latheGeo([[0, 0], [0.02, 0], [0.014, 0.04], [0.02, 0.1], [0.014, 0.16], [0.02, 0.2], [0, 0.2]], 6)));
    for (let x = -W / 2 + 0.3; x < W / 2 - 0.2; x += 0.1) if (!pxs.some((p) => Math.abs(p - x) < 0.12)) gb.push(bake(spind, [x, fy + porchH - 0.26, vz]));
    gb.push(bake(beamGeo(W, 0.05, 0.08, 0.01), [0, fy + porchH - 0.28, vz]));
    for (const x of pxs) for (const s of [-1, 1]) {
      if (Math.abs(x + s * 0.3) > W / 2) continue;
      const arc = [];
      for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI / 2; arc.push([x + s * (0.45 - Math.cos(a) * 0.45), fy + porchH - 0.02 - Math.sin(a) * 0.45 + 0.02, vz]); }
      gb.push(tubeGeo(arc, 0.025, 10));
    }
  }
  g.add(mesh(merge(gb), trim));
  g.add(mesh(railingGeo(W - 0.3, { h: 0.85, turned: !low, gap: [-0.95, 0.95] }), trim, { pos: [0, fy, vz] }));
  for (const s of [-1, 1]) g.add(mesh(railingGeo(PD - 0.2, { h: 0.85, turned: !low }), trim, { pos: [s * (W / 2 - 0.15), fy, D / 2 + PD / 2], rot: [0, Math.PI / 2, 0] }));
  const nSteps = 4;
  g.add(mesh(stepsGeo(1.8, nSteps, { rise: fy / nSteps, going: 0.32 }), IM.stone(), { pos: [0, 0, vz + 0.1 + nSteps * 0.32] }));
  // porch roof: a gently pitched tile slab from under the gable's eave to the porch beam
  const prZ0 = D / 2 + 0.05;
  const prZ1 = vz + 0.45;
  const prY0 = top + 0.35;
  const prY1 = fy + porchH + 0.24;
  const prLen = Math.hypot(prZ1 - prZ0, prY0 - prY1);
  const prA = Math.atan2(prY0 - prY1, prZ1 - prZ0);
  const pr = new THREE.Group();
  pr.add(mesh(cached(`porchRoof|${W}`, () => roundedBoxGeo(W + 0.5, 0.12, prLen, 0.02, 1, 1)), IM.redTile()));
  pr.add(mesh(cached(`porchFascia|${W}`, () => roundedBoxGeo(W + 0.54, 0.2, 0.05, 0.01, 1, 1)), trim, { pos: [0, -0.06, prLen / 2 + 0.02] }));
  pr.position.set(0, (prY0 + prY1) / 2 + 0.06, (prZ0 + prZ1) / 2);
  pr.rotation.x = prA;
  g.add(pr);
  g.add(mesh(cached(`porchCeil|${W}`, () => new THREE.PlaneGeometry(W + 0.2, prLen).rotateX(Math.PI / 2)), mat('wood', { c1: 0xdad6c8, c2: 0xb8b2a2, p: [3, 0, 0, 0] }), { pos: [0, (prY0 + prY1) / 2 - 0.04, (prZ0 + prZ1) / 2], rot: [prA, 0, 0], shadow: false }));
  // "fern rimmed porch": ferns in white planters along the rail
  for (const x of [-3.2, -2.2, 2.2, 3.4, 4.3]) {
    const p = pottedPlant({ kind: 'fern', pot: 'white', size: 1.25, night, seed: Math.round(x * 3) + 20 });
    p.position.set(x, fy, vz - 0.4);
    g.add(p);
  }
  if (porchSet) {
    const t = wroughtTable({ low });
    t.position.set(2.9, fy, D / 2 + 1.2);
    g.add(t);
    for (const [dx, a] of [[-0.75, Math.PI / 2 + 0.3], [0.75, -Math.PI / 2 - 0.2]].slice(0, chairs)) {
      const c = wroughtChair({ low });
      c.position.set(2.9 + dx, fy, D / 2 + 1.25);
      c.rotation.y = a;
      g.add(c);
    }
  }
  // gas lamps flanking the steps
  for (const s of [-1, 1]) {
    const l = gasLamp({ night, h: 2.5 });
    l.position.set(s * 1.7, 0, vz + 0.4 + nSteps * 0.32 + 0.9);
    g.add(l);
  }
  g.userData = { floorY: fy, porchZ: vz, towerTop: tBase + bY + bH, towerZ: tz, doorX, lampY: 2.4, lampZ: vz + 1.3 + nSteps * 0.32 };
  return g;
}

// ---------------------------------------------------------------- dock

/** The seaplane dock: plank deck on round piles into the water, a thatched shelter at the shore end. */
export function dock(r, { length = 16, night = false, quality = 'high', shelter = true } = {}) {
  const low = quality === 'low';
  const g = new THREE.Group();
  const w = 3.0;
  const dy = 0.75;
  g.add(mesh(deckGeo(w, length, { plank: 0.16, gap: 0.018, seed: 7 }), IM.plankGrey(), { pos: [0, dy, -length] }));
  const piles = [];
  const pile = cached('pile', () => weldNormals(latheGeo([[0, 0], [0.15, 0], [0.16, 1.2], [0.15, 2.4], [0.14, 2.7], [0.1, 2.76], [0, 2.78]], 9)));
  for (let z = 0; z <= length + 0.01; z += 2.4) {
    for (const s of [-1, 1]) piles.push(bake(pile, [s * (w / 2 + 0.05), -2.2, -z], [0, r.range(0, 3), r.range(-0.02, 0.02)]));
    piles.push(bake(beamGeo(w + 0.4, 0.18, 0.14, 0.02), [0, dy - 0.14, -z]));
    if (!low && z > 0) for (const s of [-1, 1]) piles.push(bake(beamGeo(Math.hypot(w, 1.2), 0.12, 0.08, 0.015), [0, dy - 0.85, -z + s * 0.07], [0, 0, s * Math.atan2(1.2, w)]));
  }
  for (const s of [-1, 1]) piles.push(bake(beamGeo(length + 0.4, 0.2, 0.14, 0.02), [s * (w / 2 - 0.2), dy - 0.14, -length / 2], [0, Math.PI / 2, 0]));
  g.add(mesh(merge(piles), IM.pole()));
  // cleats, a coil of rope, a ladder down at the end, a lamp post
  const cleat = cached('cleat', () => merge([bake(beamGeo(0.3, 0.05, 0.07, 0.02), [0, 0.07, 0]), bake(beamGeo(0.06, 0.07, 0.06, 0.01), [-0.07, 0.035, 0]), bake(beamGeo(0.06, 0.07, 0.06, 0.01), [0.07, 0.035, 0])]));
  const iron = [];
  for (let z = 3; z < length; z += 4.5) for (const s of [-1, 1]) iron.push(bake(cleat, [s * (w / 2 - 0.12), dy, -z], [0, Math.PI / 2, 0]));
  g.add(mesh(merge(iron), IM.blackIron()));
  const coil = [];
  for (let k = 0; k <= 80; k++) { const t = k / 80; const a = t * Math.PI * 8; const rr = 0.12 + t * 0.14; coil.push([Math.cos(a) * rr, 0.03 + (k % 20 < 10 ? 0 : 0.02), Math.sin(a) * rr]); }
  g.add(mesh(cached('coil', () => tubeGeo(coil, 0.022, 160)), IM.rope(), { pos: [w / 2 - 0.5, dy, -length * 0.55] }));
  const lad = [];
  for (const s of [-1, 1]) lad.push(bake(postGeo(2.0, 0.07, 0.01), [s * 0.28, dy - 1.8, -length - 0.08]));
  for (let k = 0; k < 5; k++) lad.push(bake(beamGeo(0.6, 0.05, 0.07, 0.01), [0, dy - 0.3 - k * 0.32, -length - 0.08]));
  g.add(mesh(merge(lad), IM.timber()));
  const lp = gasLamp({ night, h: 2.2 });
  lp.position.set(-(w / 2 - 0.2), dy, -length + 0.3);
  g.add(lp);
  if (shelter) {
    const sh = new THREE.Group();
    const sp = [];
    const z0 = -1.2;
    const z1 = -6.2;
    for (const z of [z0, (z0 + z1) / 2, z1]) for (const s of [-1, 1]) sp.push(bake(bambooGeo(2.6, 0.09, { nodes: 0.45, seg: 8 }), [s * (w / 2 - 0.05), dy, z]));
    for (const s of [-1, 1]) sp.push(bake(cached('shRail', () => new THREE.CylinderGeometry(0.08, 0.08, 5.4, 7).rotateX(Math.PI / 2)), [s * (w / 2 - 0.05), dy + 2.58, (z0 + z1) / 2]));
    for (const z of [z0, z1]) sp.push(bake(cached('shTie', () => new THREE.CylinderGeometry(0.07, 0.07, w + 0.2, 7).rotateZ(Math.PI / 2)), [0, dy + 2.6, z]));
    // a bench along one side
    sp.push(bake(beamGeo(4.2, 0.06, 0.4, 0.015), [w / 2 - 0.3, dy + 0.45, (z0 + z1) / 2], [0, Math.PI / 2, 0]));
    for (const z of [z0 + 0.4, z1 - 0.4]) sp.push(bake(postGeo(0.42, 0.08, 0.01), [w / 2 - 0.3, dy, z]));
    sh.add(mesh(merge(sp), IM.pole()));
    // a steep thatched A-frame along the dock, open at the gable ends
    const Ls = Math.abs(z1 - z0) + 1.4;
    const Hs = 2.0;
    const px = w / 2 - 0.05;
    const ov = 0.65;
    const pitch = Math.atan2(Hs, px);
    const slopeLen = (px + ov) / Math.cos(pitch);
    const slab = thatchSlabGeo(Ls, slopeLen, { t: 0.3, fringe: 0.16, seed: 3 });
    const rafters = cached(`rafters|${Ls}|${slopeLen}`, () => {
      const p = [];
      for (let k = 0; k < 5; k++) p.push(bake(new THREE.CylinderGeometry(0.045, 0.05, slopeLen, 6).rotateX(Math.PI / 2), [-Ls / 2 + 0.5 + k * ((Ls - 1) / 4), -0.36, slopeLen / 2]));
      return merge(p);
    });
    for (const s of [-1, 1]) {
      const o = new THREE.Group();
      o.position.set(0, dy + 2.6 + Hs, (z0 + z1) / 2);
      o.rotation.y = s * Math.PI / 2;
      const tilt = new THREE.Group();
      tilt.rotation.x = pitch;
      tilt.add(mesh(slab, IM.thatch()), mesh(rafters, IM.pole()));
      o.add(tilt);
      sh.add(o);
    }
    sh.add(mesh(cached(`ridgeRoll|${Ls}`, () => new THREE.CapsuleGeometry(0.2, Ls - 0.2, 4, 10).rotateX(Math.PI / 2)), IM.thatchOld(), { pos: [0, dy + 2.6 + Hs + 0.02, (z0 + z1) / 2] }));
    const collars = [];
    for (const z of [z0, z1]) collars.push(bake(new THREE.CylinderGeometry(0.05, 0.05, px * 1.1, 6).rotateZ(Math.PI / 2), [0, dy + 2.6 + Hs * 0.45, z]));
    sh.add(mesh(merge(collars), IM.pole()));
    // flower garlands (leis) hung along the tie beams
    if (!low) {
      const lei = [];
      for (const z of [z0, z1]) {
        const pts = [];
        for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push([-w / 2 + t * w, dy + 2.45 - Math.sin(t * Math.PI) * 0.35, z + 0.05]); }
        lei.push(tubeGeo(pts, 0.05, 36));
      }
      sh.add(mesh(merge(lei), mat('fabric', { c1: 0xff7a9a, c2: 0xfff0a0, c3: 0xffffff, p: [0.2, 0.2, 0.8, 1] })));
    }
    g.add(sh);
  }
  g.userData = { deckY: dy, lampPos: [lp.position.x, dy + (lp.userData.lightY || 2), lp.position.z] };
  return g;
}

// ---------------------------------------------------------------- the fountain

/**
 * A small tiered fountain: moulded stone basin with water, a turned
 * pedestal and two bowls whose rims pour thin sheets of water; spray from
 * the top. At night green and yellow bulbs ring the basin (the text).
 */
export function fountain(r, { night = false, quality = 'high' } = {}) {
  const g = new THREE.Group();
  const stone = IM.stone();
  const seg = quality === 'low' ? 32 : 56;
  g.add(mesh(cached(`fBasin|${seg}`, () => weldNormals(latheGeo([[0, 0], [2.25, 0], [2.32, 0.05], [2.32, 0.12], [2.24, 0.16], [2.18, 0.48], [2.28, 0.52], [2.34, 0.58], [2.32, 0.64], [2.2, 0.68], [2.06, 0.66], [2.0, 0.24], [0, 0.24]], seg))), stone));
  const waterM = new THREE.MeshStandardMaterial({ color: night ? 0x1a4a3a : 0x2a6a78, roughness: 0.04, metalness: 0.35, emissive: night ? 0x1a4a22 : 0x000000, emissiveIntensity: night ? 0.35 : 0 });
  g.add(mesh(cached('fWater', () => new THREE.CircleGeometry(2.02, 40).rotateX(-Math.PI / 2)), waterM, { pos: [0, 0.55, 0], shadow: false }));
  g.add(mesh(cached('fPed', () => weldNormals(latheGeo([[0, 0], [0.42, 0], [0.42, 0.1], [0.32, 0.18], [0.26, 0.4], [0.2, 0.9], [0.24, 1.0], [0.18, 1.08], [0.22, 1.2], [0, 1.2]], 24))), stone, { pos: [0, 0.24, 0] }));
  const bowl = (R) => weldNormals(latheGeo([[0, 0], [R * 0.25, 0], [R * 0.6, 0.08], [R * 0.92, 0.2], [R, 0.26], [R * 1.02, 0.3], [R * 0.98, 0.32], [R * 0.9, 0.26], [0, 0.18]], 32));
  g.add(mesh(cached('fBowl1', () => bowl(1.0)), stone, { pos: [0, 1.4, 0] }));
  g.add(mesh(cached('fStem2', () => weldNormals(latheGeo([[0, 0], [0.16, 0], [0.12, 0.2], [0.1, 0.55], [0.16, 0.62], [0, 0.62]], 18))), stone, { pos: [0, 1.58, 0] }));
  g.add(mesh(cached('fBowl2', () => bowl(0.5)), stone, { pos: [0, 2.18, 0] }));
  g.add(mesh(cached('fTop', () => weldNormals(latheGeo([[0, 0], [0.1, 0], [0.13, 0.08], [0.06, 0.2], [0.09, 0.3], [0.03, 0.4], [0, 0.42]], 14))), stone, { pos: [0, 2.35, 0] }));
  for (const [y, R] of [[1.64, 0.9], [2.43, 0.44]]) g.add(mesh(cached(`fw${R}`, () => new THREE.CircleGeometry(R, 32).rotateX(-Math.PI / 2)), waterM, { pos: [0, y, 0], shadow: false }));
  // sheets of water falling from the bowls' rims
  const sheetM = new THREE.MeshStandardMaterial({ color: 0xcfe8f0, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, emissive: night ? 0x2a6a38 : 0x203038, emissiveIntensity: night ? 0.45 : 0.3 });
  const sheet1 = mesh(cached('sheet1', () => latheGeo([[1.03, 0], [1.07, -0.12], [1.1, -0.5], [1.12, -1.05]], 40)), sheetM, { pos: [0, 1.7, 0], shadow: false });
  const sheet2 = mesh(cached('sheet2', () => latheGeo([[0.52, 0], [0.545, -0.12], [0.56, -0.45], [0.57, -0.78]], 32)), sheetM, { pos: [0, 2.48, 0], shadow: false });
  g.add(sheet1, sheet2);
  const spray = particles('bubbles', quality === 'low' ? 30 : 60, { quality, seed: 3, pos: [0, 2.8, 0], spread: [0.15, 0.1, 0.15], vel: [0, 1.3, 0], gravity: 2.2, color: night ? 0xc8ffb0 : 0xe0f4ff, size: 5, life: 1.0 });
  g.add(spray);
  const ripples = particles('bubbles', quality === 'low' ? 16 : 36, { quality, seed: 4, pos: [0, 0.6, 0], spread: [1.5, 0.02, 1.5], vel: [0, 0.1, 0], color: 0xffffff, size: 3, life: 0.8, alpha: 0.5 });
  g.add(ripples);
  if (night) {
    const bulbs = [];
    const bulbs2 = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      (i % 2 ? bulbs : bulbs2).push(bake(cached('bulb', () => new THREE.SphereGeometry(0.06, 10, 8)), [Math.cos(a) * 2.26, 0.72, Math.sin(a) * 2.26]));
    }
    g.add(mesh(merge(bulbs), glowMat(0x5aff6a, 2.6), { shadow: false }), mesh(merge(bulbs2), glowMat(0xffd23a, 2.6), { shadow: false }));
    const gs = glowSprite(0x9aff7a, 4, 0.14);
    gs.position.y = 1.2;
    g.add(gs);
  }
  g.userData.tick = (t) => {
    spray.userData.tick(t);
    ripples.userData.tick(t);
    const k = 1 + Math.sin(t * 7.1) * 0.006;
    sheet1.scale.set(k, 1, k);
    sheet2.scale.set(1 / k, 1, 1 / k);
  };
  return g;
}

/** A park bench (cast-iron ends, teak slats). */
export function bench() {
  return parkBench();
}

/** A buffet table on the lawn, heaped with hors d'oeuvres and drinks. */
export function partyTable(r, { night = false, quality = 'high', bare = false } = {}) {
  return buffetTable(r, { night, bare, low: quality === 'low', seed: r.int(1, 9) });
}

// ---------------------------------------------------------------- torches and the luau fire

/** A tiki torch: a bamboo pole with lashings and a woven fuel cup; returns { object, light }. */
export function torch(r, { quality = 'high', seed = 1 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(bambooGeo(2.25, 0.038, { nodes: 0.32, seg: 7 }), IM.bamboo()));
  g.add(mesh(cached('torchCup', () => weldNormals(latheGeo([[0, 0], [0.05, 0], [0.1, 0.08], [0.12, 0.2], [0.13, 0.26], [0.1, 0.27], [0.1, 0.24], [0, 0.24]], 12))), IM.weave(), { pos: [0, 2.12, 0] }));
  g.add(mesh(cached('torchTie', () => new THREE.TorusGeometry(0.045, 0.012, 5, 12).rotateX(Math.PI / 2)), IM.rope(), { pos: [0, 2.05, 0] }));
  g.add(mesh(cached('wick', () => new THREE.CylinderGeometry(0.02, 0.025, 0.12, 6)), IM.dark(), { pos: [0, 2.42, 0] }));
  const flame = particles('embers', quality === 'low' ? 18 : 30, { quality, seed, pos: [0, 2.5, 0], spread: [0.08, 0.05, 0.08], vel: [0, 0.8, 0], size: 14, life: 0.7, color: 0xffd080, color2: 0xff4010 });
  g.add(flame);
  const glow = glowSprite(0xff8a30, 1.6, 0.9);
  glow.position.y = 2.55;
  g.add(glow);
  g.userData.tick = flame.userData.tick;
  return { object: g, light: { color: 0xff8a30, intensity: 6, distance: 12, flicker: 0.7, pos: [0, 2.5, 0] } };
}

function logGeo(len, r0, seed) {
  return cached(`log|${len}|${r0}|${seed}`, () => {
    const pts = [[0, 0]];
    for (let k = 0; k <= 6; k++) pts.push([r0 * (0.85 + 0.2 * Math.sin(k * 2.1 + seed)), (k / 6) * len]);
    pts.push([0, len]);
    return latheGeo(pts, 8);
  });
}

/** The luau fire pit: a ring of stones, burning logs on a bed of coals; returns { object, light }. */
export function campfire(r, { quality = 'high', seed = 1 } = {}) {
  const g = new THREE.Group();
  const logs = [];
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9 + r.range(-0.2, 0.2);
    logs.push(bake(logGeo(1.15, 0.075, i % 3), [Math.cos(a) * 0.45, 0.05, Math.sin(a) * 0.45], [0, -a, Math.PI / 2 + 0.55]));
  }
  g.add(mesh(merge(logs), mat('bark', { c1: 0x3a2618, c2: 0x140a06, p: [4, 5, 0, 0] })));
  const stones = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const s = r.range(0.16, 0.24);
    stones.push(bake(cached('fstone', () => new THREE.DodecahedronGeometry(1, 1)), [Math.cos(a) * 1.0, s * 0.45, Math.sin(a) * 1.0], [r.range(0, 3), r.range(0, 3), 0], [s * 1.3, s, s * 1.1]));
  }
  g.add(mesh(merge(stones), mat('stone', { c1: 0x6a625a, c2: 0x2e2a26, c3: 0x1a1210, p: [3, 0.1, 0.4, 0] })));
  g.add(mesh(cached('coals', () => new THREE.CircleGeometry(0.85, 24).rotateX(-Math.PI / 2)), mat('stone', { c1: 0x2a1208, c2: 0x0a0604, p: [6, 0, 0, 0.8], q: [0, 0, 0, 0] }), { pos: [0, 0.03, 0], shadow: false }));
  g.add(mesh(cached('embersBed', () => new THREE.CircleGeometry(0.6, 20).rotateX(-Math.PI / 2)), glowMat(0xff5a10, 1.6, { transparent: true, opacity: 0.8 }), { pos: [0, 0.045, 0], shadow: false }));
  const fire = particles('embers', quality === 'low' ? 50 : 90, { quality, seed, pos: [0, 0.3, 0], spread: [0.55, 0.1, 0.55], vel: [0, 1.4, 0], size: 22, life: 1.1, color: 0xffd080, color2: 0xff3a08 });
  const sparks = particles('sparks', 30, { quality, seed: seed + 1, pos: [0, 0.6, 0], spread: [0.4, 0.2, 0.4], vel: [0, 2.2, 0], size: 5, gravity: 0.4, life: 2 });
  const glow = glowSprite(0xff7a20, 4, 1.0);
  glow.position.y = 0.7;
  const smoke = particles('smoke', 25, { quality, seed: seed + 2, pos: [0, 2.2, 0], spread: [0.8, 0.5, 0.8], vel: [0.1, 1.1, 0], size: 300, alpha: 0.25 });
  g.add(fire, sparks, glow, smoke);
  g.userData.tick = (t) => { fire.userData.tick(t); sparks.userData.tick(t); smoke.userData.tick(t); };
  return { object: g, light: { color: 0xff7a20, intensity: 30, distance: 22, flicker: 0.8, pos: [0, 1, 0] } };
}

/**
 * The luau's imu: a suckling pig wrapped in ti leaves on a bed of coals,
 * and a spread of ti leaves with bowls of poi and tropical fruit.
 */
export function luauSpread(r, { night = true } = {}) {
  const g = new THREE.Group();
  const ti = mat('fabric', { c1: 0x2e6a2a, c2: 0x4a8a34, c3: 0x8ab85a, p: [0.25, 0.1, 0.4, 1] });
  // the imu: coals and hot stones, the leaf-wrapped bundle
  const pit = new THREE.Group();
  pit.add(mesh(cached('imuBed', () => new THREE.CircleGeometry(0.9, 24).rotateX(-Math.PI / 2)), glowMat(0xff4a10, 1.1), { pos: [0, 0.03, 0], shadow: false }));
  const st = [];
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; st.push(bake(cached('fstone', () => new THREE.DodecahedronGeometry(1, 1)), [Math.cos(a) * 0.95, 0.08, Math.sin(a) * 0.7], [i, i * 2, 0], [0.18, 0.13, 0.16])); }
  pit.add(mesh(merge(st), mat('stone', { c1: 0x5a524a, c2: 0x2a2622, c3: 0x1a1210, p: [3, 0.1, 0.4, 0] })));
  const bundle = cached('bundle', () => {
    const b = new THREE.SphereGeometry(0.34, 20, 12);
    b.scale(1.7, 0.62, 0.95);
    const p = b.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setY(i, p.getY(i) * (1 + 0.1 * Math.sin(x * 20))); }
    b.computeVertexNormals();
    return b;
  });
  pit.add(mesh(bundle, ti, { pos: [0, 0.22, 0] }));
  const ties = [];
  for (const x of [-0.3, 0, 0.3]) ties.push(bake(cached('tie', () => new THREE.TorusGeometry(0.29, 0.012, 5, 18)), [x, 0.22, 0], [0, Math.PI / 2, 0], [1, 0.72, 1.12]));
  pit.add(mesh(merge(ties), IM.rope()));
  g.add(pit);
  // the spread: overlapping ti leaves on the ground, bowls of poi, fruit
  const leaves = [];
  for (let i = 0; i < 16; i++) {
    const L = new THREE.SphereGeometry(0.5, 10, 4, 0, Math.PI * 2, 0, 0.35);
    L.scale(0.35, 0.12, 1.1);
    leaves.push(bake(L, [r.range(-1.4, 1.4), -0.03, 1.8 + r.range(-0.4, 0.4)], [0, r.range(0, 3.14), 0]));
  }
  g.add(mesh(merge(leaves), ti, { shadow: false }));
  const bowls = [];
  const poi = [];
  const fruit = new Map();
  const addF = (c, geo) => { if (!fruit.has(c)) fruit.set(c, []); fruit.get(c).push(geo); };
  for (let i = 0; i < 4; i++) {
    const x = -1.1 + i * 0.75;
    bowls.push(bake(cached('coconutBowl', () => weldNormals(latheGeo([[0, 0], [0.06, 0], [0.13, 0.05], [0.16, 0.11], [0.15, 0.12], [0.12, 0.07], [0, 0.04]], 16))), [x, 0, 1.6]));
    poi.push(bake(cached('poi', () => new THREE.CircleGeometry(0.13, 16).rotateX(-Math.PI / 2)), [x, 0.1, 1.6]));
  }
  for (let i = 0; i < 3; i++) {
    const x = -0.9 + i * 0.9;
    addF(0xc88a2a, bake(cached('pineapple', () => weldNormals(latheGeo([[0, 0], [0.07, 0.01], [0.1, 0.08], [0.1, 0.18], [0.07, 0.26], [0, 0.28]], 12))), [x, 0, 2.15]));
    addF(0x3a7a2a, bake(cached('crown', () => new THREE.ConeGeometry(0.06, 0.18, 6)), [x, 0.35, 2.15]));
    for (let k = 0; k < 3; k++) addF(0xf0c030, bake(cached('banana', () => tubeGeo([[0, 0, 0], [0.06, 0.03, 0], [0.14, 0.04, 0], [0.2, 0.02, 0]], 0.022, 10)), [x + 0.2, 0.03 + k * 0.02, 1.95 + k * 0.05], [0, 0.4 + k * 0.2, 0]));
    for (let k = 0; k < 3; k++) addF(r.pick([0xff8a2a, 0xe0402a, 0x9ac040]), bake(cached('fruit', () => new THREE.SphereGeometry(0.05, 10, 8)), [x - 0.25 + k * 0.08, 0.05, 2.3], [0, 0, 0], [1.1, 1, 1]));
  }
  g.add(mesh(merge(bowls), mat('wood', { c1: 0x5a3a20, c2: 0x2a1a0c, p: [8, 0, 0, 0] })));
  g.add(mesh(merge(poi), mat('matte', { c1: 0x8a6a9a, p: [0.6, 0, 0, 0] }), { shadow: false }));
  for (const [c, list] of fruit) g.add(mesh(merge(list), mat('matte', { c1: c, p: [0.5, 0, 0, 0] })));
  // two wooden drums
  const drum = cached('drum', () => weldNormals(latheGeo([[0, 0], [0.2, 0], [0.16, 0.1], [0.15, 0.4], [0.2, 0.5], [0.22, 0.85], [0.2, 0.9], [0, 0.9]], 18)));
  const skin = mat('matte', { c1: 0xd8c098, p: [0.6, 0, 0, 0] });
  for (const [x, z, s] of [[2.3, 0.4, 1], [2.7, 0.9, 0.8]]) {
    g.add(mesh(drum, mat('wood', { c1: 0x6a3a1e, c2: 0x2a140a, p: [5, 0, 0, 0] }), { pos: [x, 0, z], scale: [s, s, s] }));
    g.add(mesh(cached('drumSkin', () => new THREE.CircleGeometry(0.2, 18).rotateX(-Math.PI / 2)), skin, { pos: [x, 0.905 * s, z], scale: [s, 1, s], shadow: false }));
  }
  return g;
}

// ---------------------------------------------------------------- canoes

/** An outrigger canoe: a lofted koa hull, a float (ama) on two curved booms, a paddle. Length along z. */
export function canoe(r) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.rotation.y = Math.PI / 2; // built along x (the wood grain), laid along z
  const hullGeo = cached('hull', () => {
    const L = 5.2;
    const nx = 36;
    const nr = 12;
    const pos = [];
    const idx = [];
    for (let i = 0; i <= nx; i++) {
      const t = i / nx;
      const x = -L / 2 + L * t;
      const e = 1 - Math.pow(Math.abs(2 * t - 1), 2.2);
      const hw = 0.3 * Math.pow(e, 0.55) + 0.004;
      const dep = 0.34 * Math.pow(e, 0.35) + 0.01;
      const sheer = 0.08 * Math.pow(Math.abs(2 * t - 1), 3) * 3;
      for (let k = 0; k <= nr; k++) {
        const a = (k / nr) * Math.PI; // 0..π: one gunwale round the keel to the other
        pos.push(x, sheer - Math.sin(a) * dep, Math.cos(a) * hw);
      }
    }
    for (let i = 0; i < nx; i++) for (let k = 0; k < nr; k++) {
      const a = i * (nr + 1) + k;
      const b = a + nr + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g2.setIndex(idx);
    g2.computeVertexNormals();
    return g2;
  });
  const koa = mat('wood', { c1: 0x6a3a1c, c2: 0x2e160a, p: [2.2, 0, 0, 0], side: THREE.DoubleSide });
  inner.add(mesh(hullGeo, koa, { pos: [0, 0.34, 0] }));
  const rim = [];
  for (const s of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const e = 1 - Math.pow(Math.abs(2 * t - 1), 2.2);
      pts.push([-2.6 + 5.2 * t, 0.34 + 0.24 * Math.pow(Math.abs(2 * t - 1), 3) + 0.01, s * (0.3 * Math.pow(e, 0.55) + 0.01)]);
    }
    rim.push(tubeGeo(pts, 0.022, 40));
  }
  for (const x of [-1.2, 0.3, 1.5]) rim.push(bake(beamGeo(0.1, 0.03, 0.58, 0.01), [x, 0.28, 0]));
  inner.add(mesh(merge(rim), IM.timber()));
  // the ama and the iako booms
  const ama = cached('ama', () => {
    const p = [[0, 0]];
    for (let k = 1; k < 10; k++) { const t = k / 10; p.push([0.1 * Math.pow(Math.sin(t * Math.PI), 0.5), t * 3.2]); }
    p.push([0, 3.2]);
    return latheGeo(p, 10).rotateZ(-Math.PI / 2).translate(-1.6, 0, 0);
  });
  inner.add(mesh(ama, koa, { pos: [0.1, 0.08, 1.55] }));
  const booms = [];
  for (const x of [-0.9, 0.9]) {
    booms.push(tubeGeo([[x, 0.36, -0.2], [x, 0.44, 0.5], [x, 0.36, 1.2], [x, 0.2, 1.55]], 0.03, 16));
    booms.push(bake(beamGeo(0.04, 0.16, 0.04, 0.01), [x, 0.14, 1.55]));
  }
  inner.add(mesh(merge(booms), IM.pole()));
  const pad = cached('paddle', () => merge([bake(new THREE.CylinderGeometry(0.018, 0.018, 1.1, 6).rotateZ(Math.PI / 2), [0.1, 0, 0]),
    bake(latheGeo([[0, 0], [0.09, 0.05], [0.11, 0.25], [0.06, 0.4], [0, 0.42]], 8), [-0.45, 0, 0], [0, 0, Math.PI / 2], [1, 1, 0.22])]));
  inner.add(mesh(pad, IM.teak(), { pos: [0.4, 0.4, -0.05], rot: [0, 0.2, 0.05] }));
  g.add(inner);
  return g;
}

// ---------------------------------------------------------------- the estate: clubhouse, barn, garage

/**
 * The clubhouse over the lagoon's inland end: a long weatherboard hall on
 * piles, a veranda all round under a great hipped thatch, lit windows at
 * night, and the short wooden bridge to its door (toward +z).
 */
export function estate(r, { night = false, quality = 'high' } = {}) {
  const low = quality === 'low';
  const g = new THREE.Group();
  const W = 16;
  const D = 11;
  const fy = 1.3;
  const wallH = 3.4;
  const top = fy + wallH;
  const V = 2.0;
  const warm = 0xffc070;
  const piles = [];
  const pile = cached('cpile', () => weldNormals(latheGeo([[0, 0], [0.16, 0], [0.17, 1.5], [0.15, fy + 1.9], [0, fy + 1.9]], 8)));
  for (let x = -W / 2 - V + 0.2; x <= W / 2 + V; x += 2.6) for (const z of [-D / 2 - V + 0.2, -D / 2, 0, D / 2, D / 2 + V - 0.2]) piles.push(bake(pile, [x, -2.0, z]));
  g.add(mesh(merge(piles), IM.pole()));
  g.add(mesh(deckGeo(W + 2 * V, D + 2 * V, { plank: 0.17, seed: 12 }), IM.plank(), { pos: [0, fy, -D / 2 - V] }));
  const winW = 1.3;
  const winH = 1.6;
  const wy = 0.8;
  const n = 5;
  const xs = Array.from({ length: n }, (_, i) => -W / 2 + (W / (n + 1)) * (i + 1));
  const hole = (x) => ({ x0: x - winW / 2 - 0.05, x1: x + winW / 2 + 0.05, y0: wy - 0.05, y1: wy + winH + 0.05 });
  const front = xs.filter((x) => Math.abs(x) > 1.5).map(hole);
  front.push({ x0: -1.25, x1: 1.25, y0: -1, y1: 2.55 });
  const walls = [
    { w: W, pos: [0, fy, D / 2], rot: 0, holes: front },
    { w: W, pos: [0, fy, -D / 2], rot: Math.PI, holes: xs.map(hole) },
    { w: D, pos: [W / 2, fy, 0], rot: Math.PI / 2, holes: [hole(-2.5), hole(0), hole(2.5)] },
    { w: D, pos: [-W / 2, fy, 0], rot: -Math.PI / 2, holes: [hole(-2.5), hole(0), hole(2.5)] },
  ];
  walls.forEach((wl, i) => {
    const m = boardWall(wl.w, wallH, IM.teak(), { holes: wl.holes, board: low ? 0.4 : 0.22, seed: 30 + i });
    m.position.set(...wl.pos);
    m.rotation.y = wl.rot;
    g.add(m);
    for (const h of wl.holes) {
      if (h.y0 < 0) continue;
      const wu = windowUnit({ w: winW, h: winH, night, low, warm, bars: [2, 1], shutters: false, frame: IM.trim() });
      const c = new THREE.Vector3((h.x0 + h.x1) / 2, wy + winH / 2, 0.01).applyAxisAngle(new THREE.Vector3(0, 1, 0), wl.rot);
      wu.position.set(wl.pos[0] + c.x, fy + c.y, wl.pos[2] + c.z);
      wu.rotation.y = wl.rot;
      g.add(wu);
    }
  });
  // double doors, open wide
  for (const s of [-1, 1]) {
    const d = doorUnit({ w: 1.2, h: 2.5, open: 0.75, night, warm, glassTop: true, leafM: IM.timber(), inside: false });
    d.position.set(s * 0.6, fy, D / 2 + 0.01);
    if (s > 0) d.scale.x = -1;
    g.add(d);
  }
  const hall = insideBox(3.4, 2.9, 3.2, night, warm);
  hall.position.set(0, fy, D / 2 - 0.02);
  g.add(hall);
  const posts = [];
  for (let x = -W / 2 - V + 0.15; x <= W / 2 + V; x += (W + 2 * V - 0.3) / 7) for (const z of [-1, 1]) posts.push(bake(postGeo(wallH + 0.1, 0.18, 0.03), [x, fy, z * (D / 2 + V - 0.15)]));
  for (const x of [-1, 1]) for (let z = -D / 2 - V + 0.15; z <= D / 2 + V; z += (D + 2 * V - 0.3) / 4) posts.push(bake(postGeo(wallH + 0.1, 0.18, 0.03), [x * (W / 2 + V - 0.15), fy, z]));
  g.add(mesh(merge(posts), IM.timber()));
  g.add(mesh(railingGeo(W + 2 * V - 0.3, { h: 0.9, turned: false, gap: [-1.4, 1.4] }), IM.timber(), { pos: [0, fy, D / 2 + V - 0.15] }));
  g.add(mesh(railingGeo(W + 2 * V - 0.3, { h: 0.9, turned: false }), IM.timber(), { pos: [0, fy, -D / 2 - V + 0.15] }));
  for (const s of [-1, 1]) g.add(mesh(railingGeo(D + 2 * V - 0.3, { h: 0.9, turned: false }), IM.timber(), { pos: [s * (W / 2 + V - 0.15), fy, 0], rot: [0, Math.PI / 2, 0] }));
  // the short wooden bridge and steps to the door
  const bl = 5;
  g.add(mesh(deckGeo(2.6, bl, { seed: 13 }), IM.plankGrey(), { pos: [0, fy - 0.05, D / 2 + V] }));
  for (const s of [-1, 1]) g.add(mesh(railingGeo(bl, { h: 0.95, turned: false, spacing: 0.9 }), IM.timber(), { pos: [s * 1.3, fy - 0.05, D / 2 + V + bl / 2], rot: [0, Math.PI / 2, 0] }));
  g.add(mesh(stepsGeo(2.6, 5, { rise: (fy - 0.1) / 5, going: 0.34 }), IM.stone(), { pos: [0, 0, D / 2 + V + bl + 5 * 0.34] }));
  // strings of lamps along the veranda eaves at night
  if (night) {
    const bulbs = [];
    for (let x = -W / 2 - V; x <= W / 2 + V; x += 0.6) bulbs.push(bake(cached('bulbS', () => new THREE.SphereGeometry(0.05, 8, 6)), [x, top - 0.05 - Math.abs(Math.sin(x * 1.2)) * 0.2, D / 2 + V - 0.05]));
    g.add(mesh(merge(bulbs), glowMat(0xffd08a, 3), { shadow: false }));
  }
  // the great hipped thatch over hall and veranda
  const Rx = W / 2 + V + 0.9;
  const Rz = D / 2 + V + 0.9;
  const H = 5.2;
  const y = roofSeat(top, Rz, H, Rz - 0.9);
  g.add(mesh(thatchGeo(Rz, H, { square: true, courses: 4, seed: 9, seg: low ? 40 : 80, fringe: 0.18 }), IM.thatch(), { pos: [0, y, 0], scale: [Rx / Rz, 1, 1] }));
  g.add(topKnot(y + H - 0.1, IM.thatch()));
  g.userData = { floorY: fy, frontZ: D / 2 + V + bl + 5 * 0.34 };
  return g;
}

/**
 * The red barn and stable (default) or the old garage "of similar
 * construct" with a sagging roof (kind 'garage'). Doors toward +z.
 */
export function barn(r, { kind = 'barn', night = false, quality = 'high' } = {}) {
  const low = quality === 'low';
  const garage = kind === 'garage';
  const g = new THREE.Group();
  const W = garage ? 7.5 : 9;
  const L = garage ? 8.5 : 12;
  const wallH = garage ? 3.1 : 4.0;
  const boards = garage ? IM.barnOld() : IM.barnRed();
  const trim = garage ? IM.plankGrey() : IM.trim();
  const base = 0.3;
  const board = low ? 0.5 : 0.24;
  g.add(mesh(cached(`barnBase|${W}|${L}`, () => roundedBoxGeo(W + 0.2, base, L + 0.2, 0.03, 1, 1).translate(0, base / 2, 0)), IM.stone()));
  const doorW = garage ? 5.2 : 3.6;
  const doorH = garage ? 2.6 : 3.3;
  const winW = 0.9;
  const hole = (x) => ({ x0: x - winW / 2, x1: x + winW / 2, y0: 1.4, y1: 2.3 });
  const h1 = garage ? 0 : 2.0;
  const h2 = garage ? 2.2 : 3.9;
  const endTop = garage ? (ax) => wallH + h2 * (1 - ax / (W / 2)) : (ax) => wallH + gambrelTop(W, h1, h2)(ax);
  const loft = { x0: -0.7, x1: 0.7, y0: wallH + 0.5, y1: wallH + 1.9 };
  const walls = [
    { w: W, rot: 0, pos: [0, base, L / 2], holes: [{ x0: -doorW / 2, x1: doorW / 2, y0: -1, y1: doorH }].concat(garage ? [] : [loft]), top: endTop },
    { w: W, rot: Math.PI, pos: [0, base, -L / 2], holes: [], top: endTop },
    { w: L, rot: Math.PI / 2, pos: [W / 2, base, 0], holes: (garage ? [-2, 2] : [-3.8, 0, 3.8]).map(hole) },
    { w: L, rot: -Math.PI / 2, pos: [-W / 2, base, 0], holes: (garage ? [0] : [-3.8, 0, 3.8]).map(hole) },
  ];
  walls.forEach((wl, i) => {
    const m = boardWall(wl.w, wl.top ? wallH + h2 : wallH, boards, { vertical: true, board, holes: wl.holes, seed: 50 + i, top: wl.top });
    m.position.set(...wl.pos);
    m.rotation.y = wl.rot;
    g.add(m);
    for (const h of wl.holes) {
      if (h.y0 < 0.5 || h === loft) continue;
      const wu = windowUnit({ w: winW - 0.2, h: 0.8, night: false, low, bars: [1, 1], shutters: false, frame: trim });
      const c = new THREE.Vector3((h.x0 + h.x1) / 2, (h.y0 + h.y1) / 2, 0.02).applyAxisAngle(new THREE.Vector3(0, 1, 0), wl.rot);
      wu.position.set(wl.pos[0] + c.x, base + c.y, wl.pos[2] + c.z);
      wu.rotation.y = wl.rot;
      g.add(wu);
    }
  });
  // corner trim
  const tr = [];
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) tr.push(bake(postGeo(wallH, 0.16, 0.015), [x * (W / 2 + 0.03), base, z * (L / 2 + 0.03)]));
  g.add(mesh(merge(tr), trim));
  // big doors: barn — two leaves with white X-bracing slid open on a track; garage — two leaves hung open, one askew
  const ib = insideBox(doorW + 0.6, doorH + 0.5, garage ? 5 : 7, false);
  ib.position.set(0, base, L / 2 - 0.02);
  g.add(ib);
  const leafW = doorW / 2;
  const leafGeo = cached(`leaf|${leafW}|${doorH}|${garage}`, () => {
    const p = [];
    for (let x = -leafW / 2 + 0.1; x < leafW / 2; x += 0.2) p.push(bake(beamGeo(doorH - 0.04, 0.19, 0.04, 0.006), [x, doorH / 2, 0], [0, 0, Math.PI / 2]));
    return merge(p);
  });
  const braceGeo = cached(`brace|${leafW}|${doorH}`, () => {
    const d = Math.hypot(leafW - 0.2, doorH - 0.2);
    const a = Math.atan2(doorH - 0.2, leafW - 0.2);
    return merge([
      bake(beamGeo(leafW, 0.14, 0.035), [0, 0.1, 0.03]), bake(beamGeo(leafW, 0.14, 0.035), [0, doorH - 0.1, 0.03]), bake(beamGeo(leafW, 0.12, 0.035), [0, doorH / 2, 0.03]),
      bake(beamGeo(0.14, doorH, 0.035), [-leafW / 2 + 0.07, doorH / 2, 0.03]), bake(beamGeo(0.14, doorH, 0.035), [leafW / 2 - 0.07, doorH / 2, 0.03]),
      bake(beamGeo(d, 0.12, 0.03), [0, doorH / 2, 0.035], [0, 0, a]), bake(beamGeo(d, 0.12, 0.03), [0, doorH / 2, 0.035], [0, 0, -a]),
    ]);
  });
  for (const s of [-1, 1]) {
    const leaf = new THREE.Group();
    leaf.add(mesh(leafGeo, boards));
    leaf.add(mesh(braceGeo, trim));
    if (garage) {
      leaf.position.set(s * doorW / 2, base, L / 2 + 0.05);
      const hingeOff = new THREE.Group();
      hingeOff.add(leaf);
      leaf.position.set(-s * leafW / 2, 0, 0);
      hingeOff.position.set(s * doorW / 2, base + (s > 0 ? -0.04 : 0), L / 2 + 0.05);
      hingeOff.rotation.y = s * (s > 0 ? 1.9 : 1.35);
      if (s > 0) hingeOff.rotation.z = 0.035;
      g.add(hingeOff);
    } else {
      leaf.position.set(s * (doorW / 2 + leafW / 2 - 0.3), base, L / 2 + 0.12);
      g.add(leaf);
    }
  }
  if (!garage) {
    g.add(mesh(cached(`track|${W}`, () => beamGeo(doorW * 2 + 0.6, 0.1, 0.08, 0.01)), IM.blackIron(), { pos: [0, base + doorH + 0.12, L / 2 + 0.13] }));
    // hayloft door, hay hood and pulley
    const lw = loft.x1 - loft.x0;
    const lh = loft.y1 - loft.y0;
    g.add(mesh(cached('loftDoor', () => merge([bake(beamGeo(lw, lh, 0.04), [0, 0, 0]), bake(beamGeo(lw, 0.12, 0.03), [0, lh / 2 - 0.06, 0.03]), bake(beamGeo(lw, 0.12, 0.03), [0, -lh / 2 + 0.06, 0.03]), bake(beamGeo(Math.hypot(lw, lh) - 0.15, 0.12, 0.03), [0, 0, 0.035], [0, 0, Math.atan2(lh, lw)])])), trim, { pos: [0, base + (loft.y0 + loft.y1) / 2, L / 2 + 0.05] }));
    g.add(mesh(cached('hood', () => beamGeo(0.2, 0.2, 1.4, 0.02)), boards, { pos: [0, base + wallH + h2 - 0.15, L / 2 + 0.6] }));
    g.add(mesh(cached('pulley', () => new THREE.TorusGeometry(0.12, 0.03, 6, 14)), IM.blackIron(), { pos: [0, base + wallH + h2 - 0.4, L / 2 + 1.1] }));
    g.add(mesh(cached('hoist', () => new THREE.CylinderGeometry(0.012, 0.012, 2.4, 4)), IM.rope(), { pos: [0, base + wallH + h2 - 1.6, L / 2 + 1.2], shadow: false }));
    g.add(mesh(gambrelGeo(W, h1, h2, L, { overhang: 0.4 }), IM.shingle(), { pos: [0, base + wallH, 0] }));
    // cupola with louvres and a weathervane
    const cup = new THREE.Group();
    const cw = 1.3;
    cup.add(mesh(cached('cupBox', () => roundedBoxGeo(cw, 1.0, cw, 0.02, 1, 1).translate(0, 0.5, 0)), trim));
    const louv = [];
    for (let i = 0; i < 4; i++) for (let k = 0; k < 6; k++) {
      const a = (i * Math.PI) / 2;
      louv.push(bake(beamGeo(cw - 0.3, 0.05, 0.02, 0.005), [Math.sin(a) * (cw / 2 + 0.01), 0.25 + k * 0.1, Math.cos(a) * (cw / 2 + 0.01)], [-0.6, a, 0]));
    }
    cup.add(mesh(merge(louv), boards));
    cup.add(mesh(thatchGeo(1.05, 0.8, { square: true, courses: 1, eave: 0.06, fringe: 0, seg: 32, thick: 0.08 }), IM.shingle(), { pos: [0, 1.08, 0] }));
    const vane = [bake(new THREE.CylinderGeometry(0.015, 0.015, 1.0, 5), [0, 2.2, 0]), bake(beamGeo(0.7, 0.03, 0.01, 0.004), [0, 2.45, 0])];
    vane.push(bake(new THREE.ConeGeometry(0.06, 0.16, 4), [0.4, 2.45, 0], [0, 0, -Math.PI / 2]));
    vane.push(bake(beamGeo(0.18, 0.16, 0.01, 0.004), [-0.33, 2.45, 0]));
    cup.add(mesh(merge(vane), IM.blackIron()));
    cup.position.set(0, base + wallH + h2 - 0.25, 0);
    g.add(cup);
  } else {
    g.add(mesh(gableRoofGeo(W, L, h2, { overhang: 0.45, t: 0.12, sag: 0.28, ridge: true }), IM.shingle(), { pos: [0, base + wallH, 0], rot: [0, 0, 0] }));
  }
  // a lamp over the doors
  const lamp = bugLight({ night });
  lamp.scale.setScalar(2.2);
  lamp.position.set(0, base + doorH + 0.45, L / 2 + 0.05);
  g.add(lamp);
  return g;
}

// ---------------------------------------------------------------- paths, bridges, ponds, litter

function blobStone(seed) {
  const shape = new THREE.Shape();
  const n = 9;
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2;
    const rr = 0.3 * (1 + 0.18 * Math.sin(a * 3 + seed * 1.7) + 0.1 * Math.cos(a * 5 + seed));
    if (k) shape.lineTo(Math.cos(a) * rr * 1.2, Math.sin(a) * rr); else shape.moveTo(Math.cos(a) * rr * 1.2, Math.sin(a) * rr);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.025, bevelSegments: 1, curveSegments: 2 });
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

/** Irregular flagstones along a polyline [[x, z], ...] (the stone walk), set into the ground. */
export function stoneWalk(r, pts, groundAt, { width = 1.1 } = {}) {
  const parts = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    for (let d = 0.3; d < len; d += r.range(0.55, 0.75)) {
      const t = d / len;
      const x = ax + (bx - ax) * t + r.range(-0.12, 0.12) + (r.chance(0.5) ? -1 : 1) * r.range(0, width * 0.22);
      const z = az + (bz - az) * t;
      const k = Math.floor(d * 7) % 4;
      parts.push(bake(cached(`flag|${k}`, () => blobStone(k)), [x, groundAt(x, z) + 0.01, z], [0, r.range(0, 3.14), 0], [r.range(0.8, 1.15), 1, r.range(0.8, 1.15)]));
    }
  }
  return mesh(merge(parts), IM.walk(), { shadow: false });
}

/**
 * A timber footbridge of length len along z (centred), deck at y = 0: plank
 * deck on stringers and trestles, railings. covered: the enclosed bridge of
 * the night text (board walls, a gable roof, cobwebs); old: weathered, with
 * gaps and missing boards.
 */
export function footbridge(r, { len = 12, covered = false, old = false, quality = 'high' } = {}) {
  const low = quality === 'low';
  const g = new THREE.Group();
  const w = 2.8;
  const wood = old ? IM.plankGrey() : IM.plank();
  g.add(mesh(deckGeo(w, len, { plank: 0.18, gap: old ? 0.03 : 0.015, seed: 21 }), wood, { pos: [0, 0, -len / 2] }));
  const frame = [];
  for (const s of [-1, 1]) frame.push(bake(beamGeo(len, 0.3, 0.16, 0.02), [s * (w / 2 - 0.25), -0.2, 0], [0, Math.PI / 2, 0]));
  const piers = Math.max(2, Math.round(len / 4));
  for (let i = 0; i <= piers; i++) {
    const z = -len / 2 + (i * len) / piers;
    frame.push(bake(beamGeo(w + 0.3, 0.2, 0.2, 0.02), [0, -0.45, z]));
    for (const s of [-1, 1]) frame.push(bake(postGeo(3.2, 0.2, 0.03), [s * (w / 2 - 0.1), -3.5, z], [0, 0, s * 0.08]));
  }
  g.add(mesh(merge(frame), IM.timber()));
  if (!covered) {
    for (const s of [-1, 1]) {
      const rail = railingGeo(len, { h: 1.0, turned: false, spacing: 1.1, post: 0.12 });
      g.add(mesh(rail, IM.timber(), { pos: [s * (w / 2), 0, 0], rot: [0, Math.PI / 2, 0] }));
    }
    return g;
  }
  // the enclosed bridge: board walls with gaps, portals, a gable roof, cobwebs
  const wallH = 2.6;
  for (const s of [-1, 1]) {
    const holes = [];
    if (old) for (let k = 0; k < 4; k++) { const x = r.range(-len / 2 + 1, len / 2 - 1); holes.push({ x0: x, x1: x + 0.18, y0: r.range(0.2, 1.2), y1: r.range(1.6, 2.4) }); }
    const wl = boardWall(len, wallH, IM.barnOld(), { vertical: true, board: low ? 0.5 : 0.26, holes, seed: 60 + s, battens: false });
    wl.position.set(s * (w / 2 + 0.05), 0, 0);
    wl.rotation.y = s * Math.PI / 2;
    g.add(wl);
  }
  g.add(mesh(gableRoofGeo(w + 0.1, len, 1.3, { overhang: 0.4, t: 0.1, sag: old ? 0.18 : 0 }), IM.shingle(), { pos: [0, wallH, 0] }));
  const gTop = (y) => ((w + 0.1) / 2) * (1 - y / 1.3);
  for (const s of [-1, 1]) {
    const tri = boardWall(w + 0.1, 1.3, IM.barnOld(), { board: 0.26, seed: 70 + s, top: gTop });
    tri.position.set(0, wallH, s * len / 2);
    tri.rotation.y = s > 0 ? 0 : Math.PI;
    g.add(tri);
    g.add(assemble([[postGeo(wallH, 0.2, 0.02), [-w / 2 - 0.05, 0, s * len / 2]], [postGeo(wallH, 0.2, 0.02), [w / 2 + 0.05, 0, s * len / 2]], [beamGeo(w + 0.4, 0.24, 0.22, 0.02), [0, wallH - 0.12, s * len / 2]]], IM.timber()));
  }
  // cobwebs in the portal's upper corners: radial threads and sagging rings
  const web = [];
  for (const [sx, z] of [[-1, len / 2 - 0.1], [1, len / 2 - 0.1], [1, -len / 2 + 0.1]]) {
    const cx = sx * (w / 2 - 0.05);
    const cy = wallH - 0.25;
    const ang = (k, n) => Math.PI + (sx > 0 ? 0 : 0) - (k / n) * (Math.PI / 2);
    for (let k = 0; k <= 4; k++) {
      const a = ang(k, 4);
      web.push(tubeGeo([[cx, cy, z], [cx - sx * Math.abs(Math.cos(a)) * 0.5, cy - Math.abs(Math.sin(a)) * 0.5, z]], 0.0015, 2));
    }
    for (let ring = 1; ring <= 3; ring++) {
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const a = ang(k, 8);
        const rr = 0.15 * ring;
        pts.push([cx - sx * Math.abs(Math.cos(a)) * rr, cy - Math.abs(Math.sin(a)) * rr - 0.02 * Math.sin((k / 8) * Math.PI), z]);
      }
      web.push(tubeGeo(pts, 0.0012, 12));
    }
  }
  g.add(mesh(merge(web), glowMat(0xb8c0c8, 0.35, { transparent: true, opacity: 0.3 }), { shadow: false }));
  return g;
}

/** A goldfish pond: a stone kerb, dark water, lily pads, goldfish circling (lit at night). */
export function goldfishPond(r, { night = false, quality = 'high' } = {}) {
  const g = new THREE.Group();
  g.add(mesh(cached('pondKerb', () => weldNormals(latheGeo([[2.3, -0.05], [2.45, 0.02], [2.5, 0.14], [2.42, 0.22], [2.2, 0.22], [2.12, 0.1], [2.1, -0.2]], 40))), IM.stone()));
  const water = new THREE.MeshStandardMaterial({ color: night ? 0x0e3a44 : 0x1a4a4a, roughness: 0.03, metalness: 0.35, emissive: night ? 0x0e4a5a : 0x000000, emissiveIntensity: night ? 0.7 : 0 });
  g.add(mesh(cached('pondWater', () => new THREE.CircleGeometry(2.14, 40).rotateX(-Math.PI / 2)), water, { pos: [0, 0.1, 0], shadow: false }));
  const pads = [];
  for (let i = 0; i < 9; i++) {
    const a = r.range(0, 6.28);
    const d = r.range(0.6, 1.8);
    const pad = new THREE.CircleGeometry(r.range(0.12, 0.22), 14, 0.3, Math.PI * 2 - 0.3).rotateX(-Math.PI / 2);
    pads.push(bake(pad, [Math.cos(a) * d, 0.115, Math.sin(a) * d], [0, r.range(0, 6), 0]));
  }
  g.add(mesh(merge(pads), mat('matte', { c1: 0x2e6a2a, c2: 0x4a8a34, p: [0.6, 0, 0, 0], side: THREE.DoubleSide }), { shadow: false }));
  for (let i = 0; i < 3; i++) g.add(mesh(cached('lotus', () => new THREE.SphereGeometry(0.06, 8, 6)), mat('matte', { c1: 0xf8c8d8, p: [0.5, 0, 0, 0] }), { pos: [r.range(-1.5, 1.5), 0.15, r.range(-1.5, 1.5)], scale: [1, 0.7, 1] }));
  const fishGeo = cached('fish', () => {
    const b = new THREE.SphereGeometry(0.05, 10, 6);
    b.scale(2.6, 0.7, 1);
    const tail = new THREE.ConeGeometry(0.04, 0.08, 6).rotateZ(Math.PI / 2).translate(-0.16, 0, 0);
    tail.scale(1, 1, 0.3);
    return merge([b, tail]);
  });
  const fishM = night ? glowMat(0xff8a2a, 0.9) : mat('matte', { c1: 0xff7a1a, c2: 0xffb04a, p: [0.35, 0, 0, 0] });
  const fish = [];
  for (let i = 0; i < (quality === 'low' ? 4 : 7); i++) {
    const f = mesh(fishGeo, fishM, { shadow: false });
    g.add(f);
    fish.push({ f, ph: r.range(0, 6.28), rad: r.range(0.6, 1.7), sp: r.range(0.25, 0.5) * (r.chance(0.5) ? 1 : -1), y: r.range(0.02, 0.07) });
  }
  g.userData.tick = (t) => {
    for (const o of fish) {
      const a = t * o.sp + o.ph;
      o.f.position.set(Math.cos(a) * o.rad, o.y, Math.sin(a) * o.rad);
      o.f.rotation.y = -a - Math.sign(o.sp) * Math.PI / 2;
    }
  };
  return g;
}

/** Old beer cans in the bushes, at places [{x, y, z}]: some lying, some crushed. */
export function beerCans(r, places) {
  const can = cached('can', () => weldNormals(latheGeo([[0, 0], [0.028, 0], [0.033, 0.01], [0.033, 0.105], [0.027, 0.118], [0.026, 0.122], [0, 0.12]], 14)));
  const cans = [];
  for (const p of places) {
    const lying = r.chance(0.7);
    const crushed = r.chance(0.3) ? 0.6 : 1;
    cans.push(bake(can, [p.x, p.y + (lying ? 0.033 * crushed : 0), p.z], lying ? [Math.PI / 2, r.range(0, 6), 0] : [0, r.range(0, 6), 0], [1, crushed, lying ? 1 : crushed]));
  }
  const g = new THREE.Group();
  const half = Math.ceil(cans.length / 2);
  g.add(mesh(merge(cans.slice(0, half)), mat('metal', { c1: 0xc8c8c0, c2: 0x7a2a22, p: [0.3, 0.7, 0, 0] })));
  if (cans.length > half) g.add(mesh(merge(cans.slice(half)), mat('metal', { c1: 0xd8b860, c2: 0x5a4a2a, p: [0.3, 0.7, 0, 0] })));
  return g;
}
