// Biome 3 — the tropical coast: beaches, dunes, tide pools, cliffs, the
// lagoon and the seaplane dock, the village (a luau at night), groves,
// orchards and fields, gardens, the cottage and the estate. Houses use
// interiors.js. Everything is placed from the room's text and neighbours.

import * as THREE from 'three';
import { mat, glowMat } from '../materials.js';
import { mesh } from '../geo.js';
import { outdoorBase, sector, addLight } from '../outdoor.js';
import { palms, broadleaf, groundCover, kiwiRows, scatterPoints, flowers } from '../flora.js';
import { hut, bungalow, cottage, dock, fountain, bench, partyTable, torch, campfire, luauSpread, canoe, estate, barn, stoneWalk, footbridge, goldfishPond, beerCans } from '../buildings.js';
import { pathLamp } from '../island-furnish.js';
import { crowd } from '../people.js';
import { particles } from '../fx.js';
import { buildInterior } from '../interiors.js';
import { DIRS } from '../terrain.js';

const rockMat = () => mat('stone', { c1: 0x3a3632, c2: 0x1e1c1a, c3: 0x4a5a3a, p: [0.9, 0.5, 0.2, 0] });
const lavaMat = () => mat('stone', { c1: 0x252220, c2: 0x0e0d0c, c3: 0x3a2a20, p: [1.3, 0.6, 0.05, 0], flat: true });
const INTERIOR = new Set(['house', 'clubhouse', 'stables', 'garage']);
const BEACH = new Set(['beach', 'beach-wide', 'beach-rocky', 'beach-palms', 'dunes', 'tidepools']);

function placeAlong(view, side, dist, lateral = 0) {
  const [dx, dz] = DIRS[side];
  const x = dx * dist - dz * lateral;
  const z = dz * dist + dx * lateral;
  return [x, view.groundAt(x, z), z];
}

function rotFacing(side) {
  return { ahead: 0, right: -Math.PI / 2, back: Math.PI, left: Math.PI / 2 }[side];
}

export function buildCoast(spec, ctx) {
  if (INTERIOR.has(spec.place)) return buildInterior(spec, ctx);
  const place = spec.place;
  const beach = BEACH.has(place);
  const opts = {
    sandAll: beach, rockMat: rockMat(), noGrass: beach || place === 'drowning',
    surf: place === 'beach-rocky' || place === 'shore-cliff' ? 1.6 : place === 'tidepools' ? 1.2 : 1,
    height: {},
  };
  if (place === 'cliff-lookout' || place === 'shore-cliff') opts.height = { base: 10, shore: 10, flatRadius: 9 };
  // lagoons and the dock: a basin of calm water in view, between the paths
  if ((place === 'lagoon' || place === 'lagoon-mouth' || place === 'dock' || place === 'drowning') &&
      !Object.values(spec.around).some((a) => a.marks.includes('lagoon') || a.marks.includes('water') || a.marks.includes('sea'))) {
    const ex = spec.around;
    const open = ['ahead', 'left', 'right'].filter((k) => !ex[k].exit);
    const dir = open[0] === 'left' ? [-1, -1] : open[0] === 'right' ? [1, -1] : [(spec.seed % 2 ? 1 : -1) * 0.6, -1];
    opts.height.basin = { x: dir[0] * 16, z: dir[1] * 20 - 4, r: place === 'drowning' ? 40 : 18, depth: 2.5 };
    opts.water = true;
  }
  // water where the text needs it: the pier at 122 stands in the lagoon, the
  // bridges of 172/176 cross a finger of it, the clubhouse stands over its inland end
  if (spec.room === 122) opts.height.basin = { x: 0, z: 8, r: 16, depth: 2.5 };
  if (spec.room === 172 || spec.room === 176) { opts.height.basin = { x: 0, z: spec.room === 176 ? -11 : -3, r: 9.5, depth: 2.0 }; opts.water = true; }
  if (place === 'estate') {
    opts.height.basin = { x: 0, z: -30, r: 15, depth: 2.2 };
    opts.water = true;
    opts.waterOpts = { deep: 0x0a3a40, shallow: 0x2a9a8a, calm: 0.25, foam: 0.4 };
  }
  if (place === 'dunes') opts.height = { base: 1.5, rough: 4 };
  if (place === 'drowning') opts.water = true;
  const view = outdoorBase(spec, ctx, opts);
  const { group, ticks, groundAt, r, sides: sd } = view;
  const night = spec.night;
  const feat = new Set(spec.features);
  const landSide = Object.keys(sd).find((k) => sd[k].kind !== 'sea' && sd[k].kind !== 'lagoon' && sd[k].exit) || 'ahead';
  const seaSide = Object.keys(sd).find((k) => sd[k].kind === 'sea' || sd[k].kind === 'lagoon');
  // a bridge along the path ahead, spanning the water carved for it
  let bridgeAt = null;
  if (place === 'lagoon' && (feat.has('bridge') || spec.room === 172 || spec.room === 176)) {
    const bz = spec.room === 176 ? -11 : -3;
    let z0 = bz;
    let z1 = bz;
    while (z1 < bz + 20 && groundAt(0, z1) < 0.15) z1 += 0.25;
    while (z0 > bz - 20 && groundAt(0, z0) < 0.15) z0 -= 0.25;
    const len = Math.round(z1 - z0 + 3);
    bridgeAt = { z: (z0 + z1) / 2, len, y: Math.max(groundAt(0, (z0 + z1) / 2 - len / 2), groundAt(0, (z0 + z1) / 2 + len / 2)) + 0.12 };
  }

  // ---- beaches
  if (beach || place === 'shore-cliff' || place === 'cliff-lookout') {
    if (place !== 'beach-rocky' && place !== 'shore-cliff' && place !== 'cliff-lookout') {
      const pts = scatterPoints(place === 'beach-palms' ? 16 : 7, r, (rr) => sector(landSide, rr, 7, 34, 1.1), groundAt, (x, z, y) => y > 0.8 && view.pathDist(x, z) > 2);
      group.add(palms(pts.map((p) => ({ ...p, variant: r.int(0, 2), tiltX: r.range(-0.2, 0.2), tiltZ: r.range(-0.25, 0.25) })), r, { night }));
    }
    if (place === 'beach-rocky' || place === 'tidepools' || feat.has('rocks') || feat.has('lava')) {
      const rocks = scatterPoints(place === 'tidepools' ? 26 : 16, r, (rr) => [rr.range(-24, 24), rr.range(-40, 4)], groundAt, (x, z) => Math.hypot(x, z - 6) > 3);
      const rm = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 1), lavaMat(), rocks.length);
      const m4 = new THREE.Matrix4();
      rocks.forEach((p, i) => { const s = r.range(0.5, 2.2); m4.compose(new THREE.Vector3(p.x, p.y - s * 0.3, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r.range(0, 3), r.range(0, 3), 0)), new THREE.Vector3(s * 1.4, s, s * 1.2)); rm.setMatrixAt(i, m4); });
      rm.castShadow = true;
      group.add(rm);
    }
    if (place === 'tidepools') {
      for (let i = 0; i < 6; i++) {
        const [x, , z] = [r.range(-8, 8), 0, r.range(-12, 2)];
        const y = groundAt(x, z);
        group.add(mesh(new THREE.CircleGeometry(r.range(0.6, 1.4), 16), new THREE.MeshStandardMaterial({ color: 0x1a4a4a, roughness: 0.03, metalness: 0.3 }), { pos: [x, y + 0.05, z], rot: [-Math.PI / 2, 0, 0], shadow: false }));
        for (let k = 0; k < 5; k++) group.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), glowMat([0xff6a8a, 0xffa040, 0x9a6aff][k % 3], 0.6), { pos: [x + r.range(-0.5, 0.5), y + 0.08, z + r.range(-0.5, 0.5)] }));
      }
    }
    if (feat.has('shells') || place === 'beach') {
      const shells = scatterPoints(40, r, (rr) => [rr.range(-8, 8), rr.range(-14, 5)], groundAt, (x, z, y) => y > 0.1);
      group.add(flowers(shells.map((p) => ({ ...p, y: p.y + 0.02 })), r, [0xfff0c8, 0xff9a6a, 0xffd23a, 0x8a4a2a]));
    }
    if (place === 'cliff-lookout' || place === 'shore-cliff') {
      // the sea far below: move the camera to the cliff edge and look out
      view.camera.pos = [0, groundAt(0, 6) + 1.65, 6];
      view.camera.look = seaSide ? [DIRS[seaSide][0] * 40, 0, DIRS[seaSide][1] * 40] : [0, 0, -40];
      const spray = particles('mist', 16, { quality: ctx.quality, seed: 5, pos: [DIRS[seaSide || 'ahead'][0] * 16, 1, DIRS[seaSide || 'ahead'][1] * 16], spread: [30, 2, 8], size: 700, alpha: 0.07, color: 0xffffff });
      group.add(spray);
      ticks.push(spray.userData.tick);
    }
    if (place === 'beach-rocky' || feat.has('surf')) {
      const spray = particles('steam', 40, { quality: ctx.quality, seed: 7, pos: seaSide ? [DIRS[seaSide][0] * 18, 0.3, DIRS[seaSide][1] * 18] : [0, 0.3, -18], spread: [20, 0.5, 4], vel: [0, 1.6, 0], size: 160, alpha: 0.3, color: 0xffffff, color2: 0xd8e8f0 });
      group.add(spray);
      ticks.push(spray.userData.tick);
    }
  }
  if (place === 'dunes') {
    const tufts = scatterPoints(60, r, (rr) => [rr.range(-30, 30), rr.range(-40, 5)], groundAt, () => true);
    group.add(groundCover('sedge', tufts, r, { night }));
  }
  if (place === 'drowning') {
    view.camera.pos = [0, 0.35, 6];
    view.camera.look = [0, 0.2, -20];
    view.sway = 3;
  }

  // ---- lagoon and dock
  if (place === 'lagoon' || place === 'lagoon-mouth') {
    const reeds = scatterPoints(70, r, (rr) => [rr.range(-25, 25), rr.range(-30, 6)], groundAt, (x, z, y) => y > -0.2 && y < 0.8);
    if (reeds.length) group.add(groundCover('sedge', reeds, r, { night }));
    const pts = scatterPoints(9, r, (rr) => sector(landSide, rr, 8, 30, 1.2), groundAt, (x, z, y) => y > 0.6);
    group.add(palms(pts, r, { night }));
    if (feat.has('canoes')) {
      // drawn up on the shore, bows to the water
      const spots = scatterPoints(3, r, (rr) => [rr.range(-12, 12), rr.range(-16, 0)], groundAt, (x, z, y) => y > 0.2 && y < 0.9 && view.pathDist(x, z) > 2.5);
      for (const p of spots) {
        const c = canoe(r);
        c.position.set(p.x, p.y, p.z);
        c.rotation.y = r.range(-0.8, 0.8);
        group.add(c);
      }
    }
    if (bridgeAt) {
      const b = footbridge(r, { len: bridgeAt.len, covered: night && spec.room === 172, old: night, quality: ctx.quality });
      b.position.set(0, bridgeAt.y, bridgeAt.z);
      group.add(b);
      if (night) {
        const mist = particles('mist', 18, { quality: ctx.quality, seed: 9, pos: [0, 0.6, bridgeAt.z], spread: [14, 1.2, 10], size: 700, alpha: 0.12, color: 0xc8d8e0 });
        group.add(mist);
        ticks.push(mist.userData.tick);
      }
      if (spec.room === 172) {
        // standing at the bridge's mouth, looking across
        view.camera.pos = [0, bridgeAt.y + 1.65, bridgeAt.z + bridgeAt.len / 2 + 1.2];
        view.camera.look = [0, bridgeAt.y + 1.3, bridgeAt.z - bridgeAt.len];
      }
    }
  }
  if (place === 'dock') {
    const q = ctx.quality;
    if (spec.room === 122) {
      // on the pier: the thatched shelter just ahead, the clearing beyond it, the lagoon all round
      const land = -9;
      const deckY = Math.max(groundAt(0, land) + 0.12, 0.8);
      const d = dock(r, { length: 24, night, quality: q });
      d.position.set(0, deckY - 0.75, land);
      d.rotation.y = Math.PI;
      group.add(d);
      view.camera.pos = [0, deckY + 1.62, 1.2];
      view.camera.look = [0, deckY + 1.25, -14];
      view.propAnchor = { x: 0, y: deckY - groundAt(0, -2), z: -1.2, spread: 1.0, radius: 1.0 };
      if (!night) {
        const men = crowd('men', 3, r);
        men.children.forEach((f, i) => { f.position.set(-0.8 + i * 0.8, deckY, -4.2 - (i % 2) * 1.1); f.rotation.y = r.range(-0.3, 0.3); });
        group.add(men);
        ticks.push(men.userData.update);
      } else {
        addLight(view, { color: 0xffd9a0, intensity: 5, distance: 14, flicker: 0.05, pos: [0.9, deckY + 2.0, 13] });
      }
    } else {
      // the dock runs from the clearing out into the lagoon
      const side = seaSide || 'ahead';
      const [dx, dz] = DIRS[side];
      let shore = 6;
      for (let t = 2; t < 40; t += 0.5) if (groundAt(dx * t, dz * t) < 0.5) { shore = t; break; }
      const start = Math.max(-2, shore - 6);
      const deckY = Math.max(groundAt(dx * start, dz * start) + 0.12, 0.8);
      const d = dock(r, { length: 20, night, quality: q, shelter: false });
      d.position.set(dx * start, deckY - 0.75, dz * start);
      d.rotation.y = rotFacing(side);
      group.add(d);
      // the clearing's party tables, set up to the west (left)
      for (let i = 0; i < 2; i++) {
        const t = partyTable(r, { night, quality: q, bare: night });
        const x = -9 - i * 0.6;
        const z = -3 - i * 3.6;
        t.position.set(x, groundAt(x, z), z);
        t.rotation.y = Math.PI / 2 + r.range(-0.15, 0.15);
        group.add(t);
      }
      if (!night) {
        // girls with leis lining the dockside, the musicians by the tables
        const girls = crowd('girls', q === 'low' ? 4 : 6, r);
        girls.children.forEach((f, i) => {
          const k = (i >> 1) * 1.6 + 1.2;
          const s = i % 2 ? 1 : -1;
          const x = dx * (start + k) - dz * s * 2.2;
          const z = dz * (start + k) + dx * s * 2.2;
          f.position.set(x, Math.max(groundAt(x, z), deckY - 0.1), z);
          f.rotation.y = rotFacing(side) + Math.PI + s * 0.9;
        });
        group.add(girls);
        ticks.push(girls.userData.update);
        const band = crowd('men', 3, r);
        band.children.forEach((f, i) => { const x = -5.5 + i * 0.9; const z = -1.5 - i * 0.4; f.position.set(x, groundAt(x, z), z); f.rotation.y = 0.6; });
        group.add(band);
        ticks.push(band.userData.update);
      } else {
        addLight(view, { color: 0xffd9a0, intensity: 5, distance: 14, flicker: 0.05, pos: [dx * (start + 19.5), deckY + 2.0, dz * (start + 19.5)] });
      }
    }
  }

  // ---- village and houses
  if (place === 'village') {
    const q = ctx.quality;
    // the open bungalow at the head of the street (north), huts along it, canoes drawn up
    const bz = -19;
    const bg = bungalow(r, { night, quality: q });
    bg.position.set(0, groundAt(0, bz + 4) - 0.1, bz);
    group.add(bg);
    const huts = [
      ['round', -9.5, -8, 0.4], ['square', 10.5, -9, -0.5], ['fale', -14, -19, 0.9],
      ['round', 14.5, -20, -1.0], ['round', -9, -31, 0.2], ['square', 10, -32, -0.3], ['fale', 19, -8, -1.4],
    ].slice(0, q === 'low' ? 5 : 7);
    for (const [variant, x, z, rot] of huts) {
      const h = hut(r, { night, quality: q, variant, scale: r.range(0.92, 1.05) });
      h.position.set(x, groundAt(x, z) - 0.05, z);
      // doors toward the street
      h.rotation.y = Math.atan2(-x, -z * 0.15) + rot * 0.2;
      group.add(h);
    }
    for (const [x, z, a] of [[-5.2, -5.5, 0.7], [6.2, -4.2, -0.4], [-4.8, -14.5, 1.3]]) {
      const c = canoe(r);
      c.position.set(x, groundAt(x, z), z);
      c.rotation.y = a;
      group.add(c);
    }
    const pts = scatterPoints(12, r, (rr) => [rr.range(-32, 32), rr.range(-48, -4)], groundAt, (x, z) => Math.abs(x) > 6 && huts.every(([, hx, hz]) => Math.hypot(x - hx, z - hz) > 5) && Math.hypot(x, z - bz) > 8);
    group.add(palms(pts, r, { night }));
    if (night) {
      // the luau: fire, torches, dancers, drums, the imu and the spread
      const fx = 0.5;
      const fz = -4;
      const fy = groundAt(fx, fz);
      const fire = campfire(r, { quality: q, seed: 5 });
      fire.object.position.set(fx, fy, fz);
      group.add(fire.object);
      ticks.push(fire.object.userData.tick);
      addLight(view, { ...fire.light, pos: [fx, fy + 1.2, fz] });
      const spread = luauSpread(r, { night });
      spread.position.set(fx + 3.4, groundAt(fx + 3.4, fz - 1), fz - 1.5);
      spread.rotation.y = -0.5;
      group.add(spread);
      for (let i = 0; i < 6; i++) {
        const t = torch(r, { quality: q, seed: 10 + i });
        const a = (i / 6) * Math.PI * 2 + 0.3;
        const x = fx + Math.cos(a) * 6.5;
        const z = fz + Math.sin(a) * 5.5;
        t.object.position.set(x, groundAt(x, z), z);
        group.add(t.object);
        ticks.push(t.object.userData.tick);
        if (i < 2) addLight(view, { ...t.light, pos: [x, groundAt(x, z) + 2.6, z] });
      }
      const dancers = crowd('dancers', q === 'low' ? 6 : 8, r, { night: true });
      dancers.children.forEach((f, i) => { const a = (i / dancers.children.length) * Math.PI * 2 + 0.2; const x = fx + Math.cos(a) * 3.3; const z = fz + Math.sin(a) * 3.0; f.position.set(x, groundAt(x, z), z); f.rotation.y = -a + Math.PI / 2; });
      group.add(dancers);
      ticks.push(dancers.userData.update);
      // "Several natives have come over to you"
      const hosts = crowd('natives', 3, r, { night: true });
      hosts.children.forEach((f, i) => { const x = [-4.2, 4.0, -5.4][i]; const z = [1.9, 1.5, -0.2][i]; f.position.set(x, groundAt(x, z), z); f.rotation.y = Math.atan2(-x, 6 - z) * 0.8; });
      group.add(hosts);
      ticks.push(hosts.userData.update);
      view.camera.look = [0, groundAt(0, -8) + 1.2, -12];
    } else {
      const folk = crowd('natives', q === 'low' ? 4 : 6, r);
      const groups = [[-5.5, -9], [5.5, -12], [-2.5, -16]];
      folk.children.forEach((f, i) => {
        const [gx, gz] = groups[i % groups.length];
        const a = (i / folk.children.length) * Math.PI * 2;
        const x = gx + Math.cos(a) * 0.8;
        const z = gz + Math.sin(a) * 0.8;
        f.position.set(x, groundAt(x, z), z);
        f.rotation.y = Math.atan2(gx - x, gz - z);
      });
      group.add(folk);
      ticks.push(folk.userData.update);
    }
  }
  if (place === 'porch') {
    const q = ctx.quality;
    if (spec.room === 134) {
      // on the cottage's veranda: the door ahead, the wrought-iron set to the right
      const c = cottage(r, { night, quality: q, porchSet: true, chairs: night ? 1 : 2 });
      const cz = -9;
      const gy = groundAt(0, cz + 7);
      c.position.set(0, gy, cz);
      group.add(c);
      const u = c.userData;
      const py = gy + u.floorY;
      view.camera.pos = [-0.35, py + 1.62, cz + u.porchZ + 0.75];
      view.camera.look = [1.3, py + 1.05, cz + 4.2];
      view.camera.fov = 66;
      view.propAnchor = { x: -0.8, y: py - groundAt(0, cz + u.porchZ - 2), z: cz + u.porchZ - 1.5, spread: 1.0, radius: 0.8 };
      view.peopleSpots = [[0.6, py - groundAt(0.6, cz + u.porchZ - 1.4), cz + u.porchZ - 1.4]];
      if (night) {
        addLight(view, { color: 0xffc27a, intensity: 10, distance: 12, flicker: 0.03, pos: [0.5, py + 2.2, cz + 5.2] });
        addLight(view, { color: 0xffd9a0, intensity: 6, distance: 12, flicker: 0.05, pos: [-1.4, gy + u.lampY, cz + u.lampZ] });
      }
    } else {
      // at the foot of the bungalow's steps on the stone walk: steps, veranda, the open door
      const b = bungalow(r, { night, quality: q });
      const bz = -10;
      const gy = groundAt(0, bz + 6);
      b.position.set(0, gy, bz);
      group.add(b);
      const u = b.userData;
      const front = bz + u.deckZ + 0.1 + 5 * 0.3;
      group.add(stoneWalk(r, [[0, front + 0.3], [0.3, front + 4], [-0.2, front + 8], [0, front + 14]], groundAt));
      view.camera.pos = [0.35, groundAt(0.3, front + 3.2) + 1.66, front + 3.2];
      view.camera.look = [0, gy + u.floorY + 1.2, bz + u.doorZ];
      view.propAnchor = { x: 0.8, y: gy + u.floorY - groundAt(0, bz + u.deckZ - 1.2), z: bz + u.deckZ - 0.8, spread: 1.0, radius: 0.6 };
      view.peopleSpots = [[-1.2, gy + u.floorY - groundAt(-1.2, bz + u.deckZ - 1.0), bz + u.deckZ - 1.0]];
      if (night) {
        // the small yellow bug light; torches along the walk to the luau
        const lp = u.lightPos;
        addLight(view, { color: 0xffc830, intensity: 4, distance: 9, flicker: 0.02, pos: [lp[0], gy + lp[1], bz + lp[2]] });
        for (let i = 0; i < 4; i++) {
          const t = torch(r, { quality: q, seed: 30 + i });
          const s = i % 2 ? 1 : -1;
          const z = front + 1.2 + Math.floor(i / 2) * 4.5;
          t.object.position.set(s * 1.5, groundAt(s * 1.5, z), z);
          group.add(t.object);
          ticks.push(t.object.userData.tick);
          if (i < 2) addLight(view, { ...t.light, pos: [s * 1.5, groundAt(s * 1.5, z) + 2.5, z] });
        }
      }
    }
  }
  if (place === 'lawn-fountain') {
    const q = ctx.quality;
    const f = fountain(r, { night, quality: q });
    f.scale.setScalar(1.15);
    const fx = 5.2;
    const fz = -3.0;
    f.position.set(fx, groundAt(fx, fz), fz);
    group.add(f);
    ticks.push(f.userData.tick);
    const side = Object.keys(sd).find((k) => sd[k].kind === 'building') || 'ahead';
    const c = cottage(r, { night, quality: q });
    const [x, y, z] = placeAlong(view, side, 18);
    c.position.set(x, y, z);
    c.rotation.y = rotFacing(side);
    group.add(c);
    const beds = scatterPoints(40, r, (rr) => [fx + rr.range(-3.5, 3.5), fz + rr.range(-3.5, 3.5)], groundAt, (bx, bz) => { const d = Math.hypot(bx - fx, bz - fz); return d > 3.1 && d < 3.8; });
    group.add(flowers(beds.map((p) => ({ ...p, y: p.y + 0.25 })), r, [0xff4a7a, 0xffffff, 0xffd23a]));
    if (night) {
      addLight(view, { color: 0x9aff7a, intensity: 5, distance: 10, flicker: 0.04, pos: [fx, groundAt(fx, fz) + 1.4, fz + 1.2] });
      const u = c.userData;
      const tw = new THREE.Vector3(0, u.towerTop + 1.0, u.towerZ + 2.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), c.rotation.y).add(c.position);
      addLight(view, { color: 0x9ab8ff, intensity: 60, distance: 30, pos: tw.toArray() });
      const lamp = new THREE.Vector3(0, u.lampY, u.lampZ).applyAxisAngle(new THREE.Vector3(0, 1, 0), c.rotation.y).add(c.position);
      addLight(view, { color: 0xffd9a0, intensity: 12, distance: 18, flicker: 0.05, pos: lamp.toArray() });
    }
  }
  if (place === 'party-lawn') {
    const q = ctx.quality;
    const spots = [[-3.8, 0.2, 0.25], [3.9, -0.6, -0.3], [-4.4, -6.2, -0.1], [4.6, -7.0, 0.2]];
    for (const [x, z, a] of spots) {
      const t = partyTable(r, { night, quality: q, bare: night });
      t.position.set(x, groundAt(x, z), z);
      t.rotation.y = a + (night ? r.range(-0.3, 0.3) : 0);
      group.add(t);
    }
    if (!night) {
      // guests in knots around the tables, drinks in hand
      const guests = crowd('guests', q === 'low' ? 6 : 10, r, { night });
      const knots = [[-1.9, -2.4], [2.2, -3.6], [-0.3, -9.5], [-6.3, -2.2]];
      guests.children.forEach((g, i) => {
        const [kx, kz] = knots[i % knots.length];
        const a = (Math.floor(i / knots.length) / 3) * Math.PI * 2 + i;
        const x = kx + Math.cos(a) * 0.75;
        const z = kz + Math.sin(a) * 0.75;
        g.position.set(x, groundAt(x, z), z);
        g.rotation.y = Math.atan2(kx - x, kz - z);
      });
      group.add(guests);
      ticks.push(guests.userData.update);
    }
    const pts = scatterPoints(6, r, (rr) => [rr.range(-20, 20), rr.range(-30, -10)], groundAt, (x) => Math.abs(x) > 9);
    group.add(palms(pts, r, { night }));
  }
  if (place === 'bushes') {
    const pts = scatterPoints(22, r, (rr) => [rr.range(-8, 8), rr.range(-10, 4)], groundAt, (x, z) => Math.hypot(x, z - 6) > 1.5);
    group.add(broadleaf(pts, r, { kind: 'bush', night, quality: ctx.quality }));
    const cans = scatterPoints(9, r, (rr) => [rr.range(-3, 3), rr.range(-2, 4)], groundAt, () => true);
    group.add(beerCans(r, cans));
    view.camera.pos = [0, groundAt(0, 6) + 1.4, 6];
  }
  if (place === 'gardens') {
    const q = ctx.quality;
    const nb = spec.room === 140 ? 4 : 2;
    for (let i = 0; i < nb; i++) {
      const b = bench();
      const s = i % 2 ? 1 : -1;
      const z = -4 - Math.floor(i / 2) * 6;
      const x = s * 3.2;
      b.position.set(x, groundAt(x, z), z);
      b.rotation.y = -s * Math.PI / 2;
      group.add(b);
    }
    const blooms = scatterPoints(160, r, (rr) => [rr.range(-14, 14), rr.range(-24, 2)], groundAt, (x, z) => view.pathDist(x, z) > 1.5 && Math.abs(x) > 2);
    group.add(flowers(blooms.map((p) => ({ ...p, y: p.y + r.range(0.2, 0.6) })), r));
    const bushes = scatterPoints(10, r, (rr) => [rr.range(-14, 14), rr.range(-24, 2)], groundAt, (x, z) => view.pathDist(x, z) > 2 && Math.abs(x) > 4);
    group.add(broadleaf(bushes, r, { kind: 'bush', night, quality: q }));
    const pts = scatterPoints(8, r, (rr) => [rr.range(-30, 30), rr.range(-40, -10)], groundAt, (x) => Math.abs(x) > 8);
    group.add(palms(pts, r, { night }));
    if (spec.room === 197 || spec.room === 140) group.add(stoneWalk(r, [[0, 4], [0.2, -4], [-0.3, -12], [0.2, -22]], groundAt));
    if (night && (spec.room === 140 || spec.room === 195)) {
      // "a lighted path" / "tiny lamps beside the path"
      for (let i = 0; i < 6; i++) {
        const s = i % 2 ? 1 : -1;
        const z = 2 - i * 3;
        const x = s * 1.4;
        const l = pathLamp({ night });
        l.position.set(x, groundAt(x, z), z);
        group.add(l);
      }
      addLight(view, { color: 0xffe0a8, intensity: 6, distance: 10, pos: [0, groundAt(0, -3) + 0.6, -3] });
    }
    if (feat.has('pond')) {
      const pz = -2.2;
      const py = groundAt(0, pz);
      const pond = goldfishPond(r, { night, quality: q });
      pond.position.set(0.8, py, pz);
      pond.scale.setScalar(1.25);
      group.add(pond);
      ticks.push(pond.userData.tick);
      if (night) addLight(view, { color: 0x9ae0ff, intensity: 8, distance: 10, pos: [0.5, py + 0.8, pz] });
    }
  }
  if (place === 'estate') {
    const q = ctx.quality;
    // the clubhouse on piles over the lagoon's inland end, the barn right, the garage left
    const e = estate(r, { night, quality: q });
    e.position.set(0, groundAt(0, -12), -30);
    group.add(e);
    const b = barn(r, { night, quality: q });
    const [x, y, z] = placeAlong(view, 'right', 14, -9);
    b.position.set(x, y, z);
    b.rotation.y = rotFacing('right');
    group.add(b);
    const g2 = barn(r, { kind: 'garage', night, quality: q });
    const [x2, y2, z2] = placeAlong(view, 'left', 13, 6);
    g2.position.set(x2, y2, z2);
    g2.rotation.y = rotFacing('left');
    group.add(g2);
    // bananas and frangipani along the grassy shore
    const shore = scatterPoints(8, r, (rr) => [rr.range(-16, 16), rr.range(-24, -16)], groundAt, (px, pz, py) => py > 0.4 && Math.abs(px) > 3);
    group.add(broadleaf(shore, r, { kind: 'bush', night, quality: q }));
    if (night) addLight(view, { color: 0xffc070, intensity: 40, distance: 30, flicker: 0.03, pos: [0, groundAt(0, -12) + 3, -18] });
  }

  // ---- plantations
  if (place === 'grove' || (place === 'road' && feat.has('palms'))) {
    const pts = [];
    const cols = 7;
    const rot = r.range(-0.2, 0.2);
    for (let i = 0; i < cols; i++) for (let k = 0; k < 7; k++) {
      let x = (i - cols / 2) * 7.5 + r.range(-0.6, 0.6);
      let z = 2 - k * 7.5 + r.range(-0.6, 0.6);
      [x, z] = [x * Math.cos(rot) - z * Math.sin(rot), x * Math.sin(rot) + z * Math.cos(rot)];
      if (view.pathDist(x, z) < 2.5 || Math.hypot(x, z - 6) < 3) continue;
      pts.push({ x, y: groundAt(x, z), z, s: r.range(1.0, 1.3), tiltX: r.range(-0.05, 0.05), tiltZ: r.range(-0.05, 0.05), variant: 0 });
    }
    group.add(palms(pts, r, { night }));
  }
  if (place === 'orchard') {
    const kind = spec.room === 109 ? 'papaya' : spec.room === 149 ? 'mango' : 'breadfruit';
    const pts = scatterPoints(kind === 'papaya' ? 30 : 16, r, (rr) => [rr.range(-24, 24), rr.range(-36, 3)], groundAt, (x, z, y) => view.pathDist(x, z) > 2.5 && Math.hypot(x, z - 6) > 3);
    group.add(broadleaf(pts, r, { kind, night, quality: ctx.quality }));
    if (kind === 'papaya') {
      // papaya: slender trunks with umbrella leaves: add big leaf crowns at the top
      group.add(broadleaf(pts.map((p) => ({ ...p, y: p.y + 0.1 })), r, { kind: 'papaya', night, quality: ctx.quality }));
    }
  }
  if (place === 'field') {
    const kind = spec.room === 89 ? 'cane' : spec.room === 111 ? 'kiwi' : 'pineapple';
    if (kind === 'kiwi') group.add(kiwiRows(-10, 0, 7, 30, r, { night }));
    else {
      const pts = [];
      for (let i = -12; i <= 12; i++) for (let k = 0; k < 30; k++) {
        const x = i * (kind === 'cane' ? 1.1 : 1.6) + r.range(-0.2, 0.2);
        const z = 3 - k * (kind === 'cane' ? 1.0 : 1.4) + r.range(-0.2, 0.2);
        if (view.pathDist(x, z) < 1.5 || Math.hypot(x, z - 6) < 2) continue;
        pts.push({ x, y: groundAt(x, z), z, s: r.range(0.85, 1.15) });
      }
      group.add(groundCover(kind, pts, r, { night }));
    }
    if (spec.room === 154) {
      // "An irrigation ditch separates the two fields here."
      group.add(mesh(new THREE.PlaneGeometry(1.2, 60), new THREE.MeshStandardMaterial({ color: 0x2a4a4a, roughness: 0.05, metalness: 0.3 }), { pos: [0.5, groundAt(0.5, -10) + 0.03, -20], rot: [-Math.PI / 2, 0, 0], shadow: false }));
    }
  }
  if (place === 'fern-field') {
    const pts = scatterPoints(140, r, (rr) => [rr.range(-24, 24), rr.range(-34, 4)], groundAt, (x, z) => view.pathDist(x, z) > 1.5 && Math.hypot(x, z - 6) > 1.5);
    group.add(groundCover('fern', pts, r, { night }));
    if (spec.room === 137) {
      const sap = scatterPoints(24, r, (rr) => [rr.range(-20, 20), rr.range(-30, 0)], groundAt, (x, z) => view.pathDist(x, z) > 2);
      group.add(broadleaf(sap.map((p) => ({ ...p, s: 0.35 })), r, { kind: 'conifer', night, quality: ctx.quality }));
    }
  }
  if (place === 'coast-road' || place === 'road') {
    const pts = scatterPoints(12, r, (rr) => [rr.range(-26, 26), rr.range(-40, 4)], groundAt, (x, z, y) => y > 0.8 && view.pathDist(x, z) > 3 && Math.abs(x) > 4);
    group.add(palms(pts, r, { night }));
    const bushes = scatterPoints(12, r, (rr) => [rr.range(-16, 16), rr.range(-24, 4)], groundAt, (x, z, y) => y > 0.6 && view.pathDist(x, z) > 2.5);
    group.add(broadleaf(bushes, r, { kind: 'bush', night, quality: ctx.quality }));
  }
  // a light in the bungalow seen from the village street at night
  if (night && feat.has('torches') && place !== 'village') {
    const t = torch(r, { quality: ctx.quality, seed: 21 });
    t.object.position.set(3, groundAt(3, -4), -4);
    group.add(t.object);
    ticks.push(t.object.userData.tick);
    addLight(view, { ...t.light, pos: [3, 2.5 + groundAt(3, -4), -4] });
  }
  return view;
}
