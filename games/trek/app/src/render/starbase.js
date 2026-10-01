// trek/procedural-web — capital-class starbase ("Bastion" ring station).
//
// About 5.6 sector cells across, so it visibly dwarfs any warship (the
// painted port renders its station 6 cells wide for the same reason).
// Original design: a stepped hub spindle with a dorsal sensor crown, a
// segmented habitat ring and a counter-rotating module ring on a dark
// truss, spokes with light strips, docking gantries with berthed tenders,
// solar wings, greebles, thousands of lit windows, chaser beacons and
// shuttle traffic. It lies in the ecliptic so the tactical camera sees
// its face.

import * as THREE from 'three';
import { hullMaterial, emissiveMaterial, windowArray, runningLights, glowSprite } from './parts.js';
import { solarSkin } from './hulltex.js';
import { mulberry32 } from './rng.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const warm = [0xfff1d0, 0xfff1d0, 0xffe0a8, 0xffd490, 0xcfe8ff];

/** Instanced greebles (small boxes) scattered on a set of surface points. */
function greebles(points, mat, rand) {
  const g = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(g, mat, points.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  points.forEach((p, i) => {
    q.setFromAxisAngle(V(0, 1, 0), p.yaw);
    m.compose(p.pos, q, V(p.s[0], p.s[1], p.s[2]));
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  void rand;
  return mesh;
}

export function buildStarbase({ anisotropy = 4, seed = 7 } = {}) {
  const rand = mulberry32(seed * 977 + 13);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  root.name = 'starbase';

  const hull = hullMaterial('federation', { anisotropy, envI: 1.0, flat: false });
  const hullFlat = hullMaterial('federation', { anisotropy, envI: 1.0 });
  const hullDim = hullMaterial('federation', { tint: 0x9aa3b0, anisotropy, envI: 0.9 });
  const accent = hullMaterial('federation', { tint: 0x3d5a80, rough: 0.8, anisotropy, envI: 1.0 });
  const bronze = hullMaterial('federation', { tint: 0xb89a70, rough: 0.9, anisotropy, envI: 0.9 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.45, metalness: 0.9, envMapIntensity: 1.0 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.6, metalness: 0.7, envMapIntensity: 0.8 });

  // --- Hub spindle: stepped decks + dorsal sensor crown -------------------
  const hubPts = [[0, -0.48], [0.14, -0.46], [0.3, -0.34], [0.5, -0.2], [0.6, -0.06], [0.6, 0.06], [0.5, 0.14], [0.5, 0.2], [0.4, 0.26], [0.4, 0.32], [0.26, 0.42], [0.1, 0.46], [0, 0.46]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const hub = new THREE.Mesh(new THREE.LatheGeometry(hubPts, 48), hull);
  body.add(hub);
  for (const [r, y, t, mat] of [[0.62, 0.0, 0.035, accent], [0.46, 0.24, 0.02, dark], [0.31, 0.37, 0.018, accent]]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 64), mat);
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    body.add(band);
  }
  const dockLights = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.01, 6, 96), emissiveMaterial(0x9fe4ff, 3.2));
  dockLights.rotation.x = Math.PI / 2;
  dockLights.position.y = 0.035;
  body.add(dockLights);
  // Docking bay doors around the rim: dark slots with lit thresholds.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.16), dark);
    door.position.set(Math.cos(a) * 0.6, -0.02, Math.sin(a) * 0.6);
    door.rotation.y = -a;
    body.add(door);
  }
  const crown = new THREE.Group();
  crown.position.y = 0.46;
  crown.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.36, 8).translate(0, 0.18, 0), metal));
  for (let i = 0; i < 3; i++) {
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), hullDim);
    dish.position.set(Math.cos(i * 2.09) * 0.14, 0.06, Math.sin(i * 2.09) * 0.14);
    dish.rotation.set(0.6, i * 2.09, 0);
    crown.add(dish);
  }
  body.add(crown);
  const hubSpots = [];
  for (const [r, y, n] of [[0.2, 0.44, 16], [0.34, 0.36, 24], [0.44, 0.28, 30], [0.55, 0.12, 40]]) {
    for (let i = 0; i < n; i++) {
      if (rand() < 0.28) continue;
      const a = (i / n) * Math.PI * 2;
      const nrm = V(Math.cos(a) * 0.6, 1, Math.sin(a) * 0.6).normalize();
      hubSpots.push({ position: V(Math.cos(a) * r, y, Math.sin(a) * r), normal: nrm, size: [0.03, 0.013], color: warm[Math.floor(rand() * warm.length)] });
    }
  }
  body.add(windowArray(hubSpots, 3.6));

  // --- Inner habitat ring (rotates) ---------------------------------------
  const inner = new THREE.Group();
  body.add(inner);
  const innerR = 1.28;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(innerR, 0.11, 14, 128), hull);
  ring.rotation.x = Math.PI / 2;
  inner.add(ring);
  // Segment bands break the smooth torus into habitat sections.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.018, 6, 20), i % 4 === 0 ? accent : dark);
    band.position.set(Math.cos(a) * innerR, 0, Math.sin(a) * innerR);
    band.rotation.y = -a;
    inner.add(band);
  }
  const innerSpots = [];
  for (let i = 0; i < 220; i++) {
    const a = (i / 220) * Math.PI * 2;
    for (const [lift, rad] of [[0.085, innerR + 0.05], [0.05, innerR + 0.095], [0.085, innerR - 0.05]]) {
      if (rand() < 0.38) continue;
      const p = V(Math.cos(a) * rad, lift, Math.sin(a) * rad);
      const outward = V(Math.cos(a), 0, Math.sin(a));
      const n = V(0, 1, 0).addScaledVector(outward, (rad - innerR) * 9).normalize();
      innerSpots.push({ position: p, normal: n, size: [0.024, 0.011], color: warm[Math.floor(rand() * warm.length)] });
    }
  }
  inner.add(windowArray(innerSpots, 3.4));
  const outerR = 2.2;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const len = outerR - 0.6;
    const mid = (0.6 + outerR) / 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.09), hullDim);
    spoke.position.set(Math.cos(a) * mid, 0, Math.sin(a) * mid);
    spoke.rotation.y = -a;
    inner.add(spoke);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 0.03), dark);
    rail.position.copy(spoke.position).setY(0.045);
    rail.rotation.y = -a;
    inner.add(rail);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(len - 0.3, 0.01, 0.012), emissiveMaterial(0xfff1d0, 1.8));
    strip.position.copy(spoke.position).setY(0.064);
    strip.rotation.y = -a;
    inner.add(strip);
  }
  // Solar wings between the rings.
  const solar = new THREE.MeshStandardMaterial({ map: solarSkin(anisotropy), roughness: 0.55, metalness: 0.3, envMapIntensity: 0.6, color: 0x9ab0d0 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const g = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.01, 0.26), solar);
    panel.position.x = 1.75;
    const uv = panel.geometry.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 2.2, uv.getY(k) * 1.3);
    const boom = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.018, 0.018), metal);
    boom.position.x = 1.44;
    g.add(panel, boom);
    g.rotation.y = -a;
    g.position.y = -0.1;
    inner.add(g);
  }

  // --- Outer module ring (counter-rotates) --------------------------------
  const outer = new THREE.Group();
  body.add(outer);
  const truss = new THREE.Mesh(new THREE.TorusGeometry(outerR, 0.045, 8, 180), metal);
  truss.rotation.x = Math.PI / 2;
  outer.add(truss);
  const truss2 = new THREE.Mesh(new THREE.TorusGeometry(outerR, 0.02, 6, 180), dark);
  truss2.rotation.x = Math.PI / 2;
  truss2.position.y = 0.07;
  outer.add(truss2);
  const moduleSpots = [];
  const greeblePts = [];
  const N = 22;
  const mats = [hullFlat, hullFlat, hullDim, accent, bronze];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const kind = i % 4;
    const len = kind === 0 ? 0.4 : 0.28;
    const w = kind === 0 ? 0.26 : 0.2;
    const h = kind === 0 ? 0.17 : 0.12;
    const geo = kind === 2 ? new THREE.CylinderGeometry(w * 0.5, w * 0.5, len, 12).rotateX(Math.PI / 2) : new THREE.BoxGeometry(w, h, len);
    const m = new THREE.Mesh(geo, mats[Math.floor(rand() * mats.length)]);
    m.position.set(Math.cos(a) * outerR, 0, Math.sin(a) * outerR);
    m.rotation.y = -a;
    outer.add(m);
    const tan = V(-Math.sin(a), 0, Math.cos(a));
    const rad = V(Math.cos(a), 0, Math.sin(a));
    for (let k = 0; k < 4; k++) {
      if (rand() < 0.3) continue;
      const along = (k / 3 - 0.5) * (len - 0.08);
      for (const side of [-1, 1]) {
        const p = V(Math.cos(a) * outerR, h * 0.5 + 0.003, Math.sin(a) * outerR).addScaledVector(tan, along).addScaledVector(rad, side * w * 0.26);
        moduleSpots.push({ position: p, normal: V(0, 1, 0), size: [0.028, 0.012], color: warm[Math.floor(rand() * warm.length)] });
      }
    }
    for (let k = 0; k < 3; k++) {
      greeblePts.push({
        pos: V(Math.cos(a) * outerR, h * 0.5 + 0.015, Math.sin(a) * outerR).addScaledVector(tan, (rand() - 0.5) * len * 0.8).addScaledVector(rad, (rand() - 0.5) * w * 0.6),
        yaw: -a, s: [0.03 + rand() * 0.04, 0.02 + rand() * 0.02, 0.03 + rand() * 0.05],
      });
    }
  }
  outer.add(windowArray(moduleSpots, 3.4));
  outer.add(greebles(greeblePts, dark, rand));
  // Docking gantries with berthed tenders.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    const dir = V(Math.cos(a), 0, Math.sin(a));
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.045, 0.07), metal);
    arm.position.copy(dir.clone().multiplyScalar(outerR + 0.26));
    arm.rotation.y = -a;
    outer.add(arm);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.22), hullDim);
    pad.position.copy(dir.clone().multiplyScalar(outerR + 0.5));
    pad.rotation.y = -a;
    outer.add(pad);
    if (i < 2) {
      // A small tender moored alongside.
      const tender = new THREE.Group();
      const tb = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.09), hullFlat);
      const tc = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.13), accent);
      tc.position.x = -0.09;
      const te = glowSprite(0x8fc8ff, 0.05, 2.5, { core: 3, falloff: 7 });
      te.position.x = -0.14;
      tender.add(tb, tc, te);
      tender.position.copy(dir.clone().multiplyScalar(outerR + 0.34)).addScaledVector(V(-Math.sin(a), 0, Math.cos(a)), 0.12);
      tender.position.y = 0.02;
      tender.rotation.y = -a;
      outer.add(tender);
    }
    const tipLight = glowSprite(0x9fe4ff, 0.05, 4, { core: 3, falloff: 8 });
    tipLight.position.copy(dir.clone().multiplyScalar(outerR + 0.56)).setY(0.05);
    outer.add(tipLight);
  }

  // --- Beacons -------------------------------------------------------------
  const beaconSpecs = [];
  const nb = 14;
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * Math.PI * 2;
    beaconSpecs.push({
      pos: V(Math.cos(a) * (outerR + 0.08), 0.09, Math.sin(a) * (outerR + 0.08)),
      color: i % 2 ? 0xff3a2a : 0x40ff80, size: 0.05, intensity: 4,
      period: 3.2, duty: 0.1, phase: (i / nb) * 3.2,
    });
  }
  const beacons = runningLights(beaconSpecs);
  outer.add(beacons.group);
  const strobe = runningLights([{ pos: V(0, 0.86, 0), color: 0xffffff, size: 0.1, intensity: 7, period: 1.4, duty: 0.07 }]);
  body.add(strobe.group);

  // --- Shuttle traffic ------------------------------------------------------
  const traffic = [];
  for (let i = 0; i < 7; i++) {
    const s = glowSprite(i % 3 === 0 ? 0xffd9a0 : 0xcfe8ff, 0.03, 5, { core: 4, falloff: 10 });
    body.add(s);
    traffic.push({ s, r: 0.75 + rand() * 1.4, speed: (0.08 + rand() * 0.18) * (rand() < 0.5 ? 1 : -1), phase: rand() * 6.28, y: 0.15 + rand() * 0.2, wobble: rand() * 0.2 });
  }

  const model = {
    kind: 'starbase', root, body,
    size: outerR + 0.6, halfLength: outerR + 0.6, halfSpan: outerR + 0.6, halfHeight: 0.6,
    hullMaterials: [hull, hullFlat, hullDim, accent, bronze],
    update(t, reduced = false) {
      const k = reduced ? 0.3 : 1;
      inner.rotation.y = t * 0.035 * k;
      outer.rotation.y = -t * 0.018 * k;
      crown.rotation.y = t * 0.2 * k;
      beacons.update(t);
      strobe.update(t);
      for (const tr of traffic) {
        const a = tr.phase + t * tr.speed * k;
        const r = tr.r + Math.sin(t * 0.3 + tr.phase) * tr.wobble;
        tr.s.position.set(Math.cos(a) * r, tr.y, Math.sin(a) * r);
      }
    },
    setHeat(v) {
      for (const m of this.hullMaterials) {
        m.emissive.setRGB(1, 0.45, 0.15);
        m.emissiveIntensity = v * 1.5;
      }
    },
    dispose() {
      root.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); o.material?.dispose?.(); });
    },
  };
  root.userData.model = model;
  return model;
}
