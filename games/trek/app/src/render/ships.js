// trek/procedural-web — procedural ship designs.
//
// IP rule (see ../../AGENTS.md): every silhouette here is ORIGINAL. No
// saucer + nacelle-on-pylon cruiser, no bird-of-prey wings, no double-hull
// warbird, no official insignia. The engine's names ("Klingon
// Battlecruiser", "Romulan Warbird") are BSD-era generic terms kept for
// mechanical parity; what you see is our own fleet:
//
//   player         "Vanguard"  long armoured spear, swept shoulders, three
//                              integrated engines, cyan sensor band
//   warship        "Talon"     dagger body, forward twin prongs, one engine
//   battlecruiser  "Hammer"    heavy ribbed spine, transverse hammer prow
//   super          "Trident"   three spines, twin reactor cores, crown blades
//   warbird        "Stingray"  jade flying wing, tail spike, gill emitters
//
// Local frame: bow +X, starboard +Z, dorsal +Y. One world unit = one
// sector cell.

import * as THREE from 'three';
import { loft, loftPoint, plate, mirrorOutline, bell, PROFILE } from './geom.js';
import { hullMaterial, emissiveMaterial, engine, windowArray, runningLights, glowSprite } from './parts.js';
import { mulberry32, hashString } from './rng.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Scatter windows along a loft: rows at profile index j between f0..f1. */
function windowsOnLoft(geo, { f0, f1, rows, count, size, colors, rand, dropout = 0.2, offsetY = 0 }) {
  const spots = [];
  for (const j of rows) {
    for (let i = 0; i < count; i++) {
      if (rand() < dropout) continue;
      const f = f0 + (f1 - f0) * (i + 0.5) / count;
      const p = loftPoint(geo, f, j);
      p.position.y += offsetY;
      spots.push({ position: p.position, normal: p.normal, size, color: colors[Math.floor(rand() * colors.length)] });
    }
  }
  return spots;
}

export function hullBox(root) {
  const box = new THREE.Box3();
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const tmp = new THREE.Box3();
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || !o.material?.isMeshStandardMaterial) return;
    o.geometry.computeBoundingBox();
    tmp.copy(o.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    box.union(tmp);
  });
  return box;
}

class ShipModel {
  constructor(kind, root, body, parts) {
    this.kind = kind;
    this.root = root;          // world transform (position, heading)
    this.body = body;          // idle motion + destruction effects
    this.engines = parts.engines || [];
    this.lights = parts.lights || null;
    this.emitters = parts.emitters || [V(1, 0, 0)];
    // Phaser banks (player only): { pos, dir, glow } in ship space.
    this.banks = parts.banks || null;
    this.bankFired = this.banks ? this.banks.map(() => -99) : [];
    this.hullMaterials = parts.hullMaterials || [];
    this.pulse = parts.pulse || [];
    this.faction = parts.faction;
    this.phase = parts.phase ?? 0;
    this.throttle = 0.45;
    this.heat = 0;
    // Size from the lit hull only: plumes, glow billboards and windows would
    // inflate the box (a glow quad is 2×2 units before its shader scales it).
    const box = hullBox(body);
    this.halfLength = Math.max(Math.abs(box.max.x), Math.abs(box.min.x));
    this.halfSpan = Math.max(Math.abs(box.max.z), Math.abs(box.min.z));
    this.halfHeight = Math.max(Math.abs(box.max.y), Math.abs(box.min.y));
    /** Explosion / shield scale: rough "size" of the ship in cells. */
    this.size = Math.max(this.halfLength, this.halfSpan);
  }

  update(t, reduced = false) {
    if (!reduced) {
      const w = this.phase;
      this.body.position.y = Math.sin(t * 0.7 + w) * 0.025;
      this.body.rotation.x = Math.sin(t * 0.43 + w * 1.7) * 0.035;   // roll
      this.body.rotation.z = Math.sin(t * 0.31 + w * 0.9) * 0.018;   // pitch
    }
    for (const e of this.engines) e.update(t, this.throttle);
    this.lights?.update(t);
    for (const p of this.pulse) p(t);
    this.time = t;
    if (this.banks) {
      this.banks.forEach((b, i) => {
        const k = Math.max(0, 1 - (t - this.bankFired[i]) / 0.9);
        b.glow.material.uniforms.uIntensity.value = 0.35 + 6 * k * k;
      });
    }
  }

  /** World position and facing of phaser bank i. */
  bankWorld(i) {
    const b = this.banks[i];
    const pos = this.body.localToWorld(b.pos.clone());
    const dir = b.dir.clone().normalize().transformDirection(this.body.matrixWorld);
    return { pos, dir };
  }

  /** The free bank that faces `worldPoint` best (reuses banks only if all
   *  six are taken, which the engine's three-per-quadrant cap never needs). */
  bestBank(worldPoint, used) {
    let best = 0, bestScore = -Infinity;
    for (let pass = 0; pass < 2 && bestScore === -Infinity; pass++) {
      this.banks.forEach((b, i) => {
        if (pass === 0 && used.has(i)) return;
        const { pos, dir } = this.bankWorld(i);
        const to = worldPoint.clone().sub(pos).setY(0).normalize();
        const score = dir.setY(0).normalize().dot(to);
        if (score > bestScore) { bestScore = score; best = i; }
      });
    }
    return best;
  }

  /** Light up bank i's emitter (it fades over ~0.9 s). */
  fireBank(i) { this.bankFired[i] = this.time ?? 0; }

  /** 0..1 — hull glows hot before it breaks up. */
  setHeat(k) {
    this.heat = k;
    for (const m of this.hullMaterials) {
      if (k <= 0) {
        m.emissive.copy(m.userData.baseEmissive);
        m.emissiveIntensity = m.userData.baseEmissiveIntensity;
      } else {
        m.emissive.setRGB(1.0, 0.45, 0.15);
        m.emissiveIntensity = k * 3.5;
        if (!m.emissiveMap) m.emissiveIntensity = k * 1.2;
      }
    }
  }

  /** World-space emitter positions (weapon muzzles). */
  emitterWorld(i = 0, target = new THREE.Vector3()) {
    const e = this.emitters[i % this.emitters.length];
    return this.body.localToWorld(target.copy(e));
  }

  setHeading(angle) { this.root.rotation.y = angle; }

  dispose() {
    this.root.traverse(o => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      if (o.material && !o.material.userData?.shared) o.material.dispose?.();
    });
  }
}

// ---------------------------------------------------------------------------
// Player — "Vanguard"
// ---------------------------------------------------------------------------

function buildPlayer(opts) {
  const an = opts.anisotropy;
  const rand = mulberry32(1701);
  const body = new THREE.Group();
  const hull = hullMaterial('federation', { anisotropy: an, envI: 1.0 });
  const hullDark = hullMaterial('federation', { tint: 0x7d8796, anisotropy: an, envI: 0.9 });
  const accent = hullMaterial('federation', { tint: 0x3d5a80, rough: 0.8, anisotropy: an, envI: 1.0 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.35, metalness: 0.9, envMapIntensity: 1.2 });

  const mainGeo = loft([
    { x: 1.24, w: 0.02, h: 0.014, y: -0.01 },
    { x: 1.1, w: 0.12, h: 0.065, y: -0.006 },
    { x: 0.86, w: 0.26, h: 0.13 },
    { x: 0.45, w: 0.4, h: 0.2 },
    { x: 0.0, w: 0.48, h: 0.24 },
    { x: -0.45, w: 0.5, h: 0.24 },
    { x: -0.86, w: 0.42, h: 0.2 },
    { x: -1.02, w: 0.34, h: 0.16 },
  ], PROFILE.chamfer(0.42), { tile: 0.55 });
  body.add(new THREE.Mesh(mainGeo, hull));

  // Dorsal armour spine and command tower.
  const spineGeo = loft([
    { x: 0.7, w: 0.04, h: 0.02, y: 0.1 },
    { x: 0.45, w: 0.16, h: 0.07, y: 0.12 },
    { x: -0.7, w: 0.2, h: 0.08, y: 0.125 },
    { x: -0.9, w: 0.12, h: 0.05, y: 0.11 },
  ], PROFILE.keel(), { tile: 0.4 });
  body.add(new THREE.Mesh(spineGeo, accent));
  const towerGeo = loft([
    { x: 0.1, w: 0.08, h: 0.02, y: 0.16 },
    { x: 0.02, w: 0.15, h: 0.08, y: 0.19 },
    { x: -0.28, w: 0.2, h: 0.1, y: 0.2 },
    { x: -0.38, w: 0.13, h: 0.05, y: 0.18 },
  ], PROFILE.chamfer(0.5), { tile: 0.3 });
  body.add(new THREE.Mesh(towerGeo, hull));

  // Swept shoulder wings carrying the engine blocks.
  const wing = [[0.3, 0.2], [-0.25, 0.63], [-0.96, 0.67], [-1.02, 0.55], [-0.75, 0.22]];
  const wingS = new THREE.Mesh(plate(wing, 0.05), hull);
  const wingP = new THREE.Mesh(plate(mirrorOutline(wing), 0.05), hull);
  wingS.position.y = wingP.position.y = -0.03;
  body.add(wingS, wingP);
  // Accent strakes along the wing leading edges.
  const strake = [[0.22, 0.24], [-0.25, 0.6], [-0.31, 0.6], [0.14, 0.24]];
  for (const o of [strake, mirrorOutline(strake)]) {
    const m = new THREE.Mesh(plate(o, 0.012, { bevel: 0.003 }), accent);
    m.position.y = 0.0;
    body.add(m);
  }
  // Double chevron marking on the dorsal hull (original faction mark).
  for (const dx of [0.62, 0.5]) {
    const chev = [[dx, 0], [dx - 0.1, 0.1], [dx - 0.13, 0.1], [dx - 0.04, 0], [dx - 0.13, -0.1], [dx - 0.1, -0.1]];
    const m = new THREE.Mesh(plate(chev, 0.01, { bevel: 0.002 }), accent);
    m.position.y = 0.092;
    body.add(m);
  }

  // Engine blocks.
  const bells = [];
  for (const z of [-0.56, 0.56]) {
    const blkGeo = loft([
      { x: -0.2, w: 0.08, h: 0.06, z },
      { x: -0.34, w: 0.17, h: 0.13, z },
      { x: -0.96, w: 0.18, h: 0.14, z },
      { x: -1.08, w: 0.15, h: 0.12, z },
    ], PROFILE.chamfer(0.4), { tile: 0.35 });
    body.add(new THREE.Mesh(blkGeo, hullDark));
    // Cyan intake grille on the inboard face.
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 0.006), emissiveMaterial(0x59e1ff, 3.2));
    grille.position.set(-0.45, 0.015, z - Math.sign(z) * 0.088);
    body.add(grille);
    bells.push({ pos: V(-1.08, 0, z), r: 0.062 });
  }
  bells.push({ pos: V(-1.02, 0.0, 0), r: 0.085 });

  // Sensor band near the bow — the ship's signature accent.
  const band = loft([
    { x: 0.86, w: 0.268, h: 0.136 },
    { x: 0.8, w: 0.3, h: 0.15 },
  ], PROFILE.chamfer(0.42), { capStart: false, capEnd: false });
  body.add(new THREE.Mesh(band, emissiveMaterial(0x7fe8ff, 2.6)));

  const engines = bells.map((b, i) => engine({
    pos: b.pos, radius: b.r, color: 0x8fc8ff, intensity: 7, plumeLength: 0.5 + b.r * 2,
    seed: i, bellMat: metal, bellGeo: bell(b.r, b.r * 1.3),
  }));
  for (const e of engines) body.add(e.group);

  // Windows: warm and cool, on the upper chamfer facets of the hull and tower.
  const colors = [0xfff1d0, 0xfff1d0, 0xcfe8ff, 0xffd9a0];
  const spots = [
    ...windowsOnLoft(mainGeo, { f0: 0.3, f1: 0.82, rows: [1.5, 3.5], count: 22, size: [0.022, 0.009], colors, rand }),
    ...windowsOnLoft(mainGeo, { f0: 0.35, f1: 0.78, rows: [0.7, 4.3], count: 16, size: [0.02, 0.008], colors, rand, dropout: 0.35 }),
    ...windowsOnLoft(towerGeo, { f0: 0.2, f1: 0.8, rows: [1.5, 3.5], count: 6, size: [0.018, 0.009], colors: [0x9fe4ff], rand, dropout: 0 }),
  ];
  body.add(windowArray(spots, 3.4));
  // Bridge viewport strip.
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.1), emissiveMaterial(0x9fe4ff, 3));
  bridge.position.set(0.035, 0.225, 0);
  body.add(bridge);

  const lights = runningLights([
    { pos: V(-0.97, 0.0, 0.69), color: 0x40ff70, size: 0.05, intensity: 3 },
    { pos: V(-0.97, 0.0, -0.69), color: 0xff3030, size: 0.05, intensity: 3 },
    { pos: V(-0.3, 0.26, 0), color: 0xffffff, size: 0.07, intensity: 5, period: 1.6, duty: 0.08 },
    { pos: V(1.2, 0.0, 0), color: 0xffffff, size: 0.04, intensity: 3, period: 1.6, duty: 0.08, phase: 0.8 },
  ]);
  body.add(lights.group);

  // Six phaser banks, as in BSD trek (NBANKS 6), placed round the hull so
  // every bearing is covered: bow, forward port/starboard, aft port/
  // starboard on the engine blocks, and a dorsal aft emitter on the tower.
  const banks = [
    { pos: V(1.2, 0.0, 0), dir: V(1, 0, 0) },
    { pos: V(0.42, 0.1, 0.17), dir: V(0.45, 0, 1) },
    { pos: V(0.42, 0.1, -0.17), dir: V(0.45, 0, -1) },
    { pos: V(-0.55, 0.08, 0.62), dir: V(-0.35, 0, 1) },
    { pos: V(-0.55, 0.08, -0.62), dir: V(-0.35, 0, -1) },
    { pos: V(-0.36, 0.25, 0), dir: V(-1, 0, 0) },
  ];
  for (const b of banks) {
    b.glow = glowSprite(0x7fe8ff, 0.07, 0.35, { core: 3, falloff: 7 });
    b.glow.position.copy(b.pos);
    body.add(b.glow);
  }

  return { body, parts: { engines, lights, banks, emitters: [V(1.18, 0, 0), V(0.3, 0.05, 0.3), V(0.3, 0.05, -0.3)], hullMaterials: [hull, hullDark, accent], faction: 'federation' } };
}

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------

function raiderMats(an) {
  return {
    hull: hullMaterial('raider', { anisotropy: an, glow: 1.6, glowColor: 0xff5a24, envI: 0.8 }),
    dark: hullMaterial('raider', { tint: 0x6a625c, anisotropy: an, glow: 1.2, envI: 0.7 }),
    bronze: hullMaterial('raider', { tint: 0xc9955e, rough: 0.8, anisotropy: an, envI: 1.0 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x2c2826, roughness: 0.4, metalness: 0.9, envMapIntensity: 1.0 }),
  };
}

function buildWarship(opts) {
  const rand = mulberry32(opts.seed);
  const M = raiderMats(opts.anisotropy);
  const body = new THREE.Group();
  const coreGeo = loft([
    { x: 0.62, w: 0.04, h: 0.03 },
    { x: 0.36, w: 0.22, h: 0.12 },
    { x: 0.0, w: 0.36, h: 0.18 },
    { x: -0.42, w: 0.42, h: 0.2 },
    { x: -0.7, w: 0.3, h: 0.16 },
    { x: -0.8, w: 0.22, h: 0.12 },
  ], PROFILE.keel(1, 0.4), { tile: 0.45 });
  body.add(new THREE.Mesh(coreGeo, M.hull));
  const prong = [[0.98, 0.2], [0.86, 0.265], [0.12, 0.31], [0.02, 0.17], [0.6, 0.14]];
  for (const o of [prong, mirrorOutline(prong)]) body.add(new THREE.Mesh(plate(o, 0.06), M.bronze));
  const blade = [[0.02, 0.17], [-0.55, 0.64], [-0.74, 0.62], [-0.56, 0.2]];
  for (const [o, s] of [[blade, 1], [mirrorOutline(blade), -1]]) {
    const m = new THREE.Mesh(plate(o, 0.04), M.dark);
    m.rotation.x = s * 0.22;          // anhedral
    m.position.y = -0.02;
    body.add(m);
  }
  const eng = engine({ pos: V(-0.8, 0, 0), radius: 0.095, color: 0xff6a2a, intensity: 6.5, plumeLength: 0.55, seed: opts.seed % 97, bellMat: M.metal, bellGeo: bell(0.095, 0.12) });
  body.add(eng.group);
  const spots = windowsOnLoft(coreGeo, { f0: 0.25, f1: 0.8, rows: [1.4, 4.6], count: 10, size: [0.03, 0.006], colors: [0xff5020, 0xff8040], rand, dropout: 0.3 });
  body.add(windowArray(spots, 3.5));
  const tips = [V(0.95, 0.0, 0.215), V(0.95, 0.0, -0.215)];
  const lights = runningLights(tips.map((p, i) => ({ pos: p, color: 0xff3a1a, size: 0.07, intensity: 4, period: 2.2, duty: 0.5, phase: i * 1.1 })));
  body.add(lights.group);
  return { body, parts: { engines: [eng], lights, emitters: tips, hullMaterials: [M.hull, M.dark, M.bronze], faction: 'raider' } };
}

function buildBattlecruiser(opts) {
  const rand = mulberry32(opts.seed);
  const M = raiderMats(opts.anisotropy);
  const body = new THREE.Group();
  const spineGeo = loft([
    { x: 0.62, w: 0.2, h: 0.12 },
    { x: 0.2, w: 0.26, h: 0.16 },
    { x: -0.6, w: 0.28, h: 0.18 },
    { x: -1.02, w: 0.34, h: 0.2 },
    { x: -1.16, w: 0.28, h: 0.15 },
  ], PROFILE.chamfer(0.45), { tile: 0.45 });
  body.add(new THREE.Mesh(spineGeo, M.hull));
  const hammer = [[0.98, 0.12], [0.93, 0.6], [0.74, 0.66], [0.55, 0.3], [0.55, -0.3], [0.74, -0.66], [0.93, -0.6], [0.98, -0.12]];
  body.add(new THREE.Mesh(plate(hammer, 0.12, { bevel: 0.02 }), M.dark));
  const crest = loft([
    { x: 0.96, w: 0.05, h: 0.03, y: 0.07 },
    { x: 0.86, w: 0.3, h: 0.08, y: 0.08 },
    { x: 0.6, w: 0.34, h: 0.1, y: 0.08 },
    { x: 0.5, w: 0.2, h: 0.05, y: 0.07 },
  ], PROFILE.keel(), { tile: 0.3 });
  body.add(new THREE.Mesh(crest, M.bronze));
  for (const x of [0.25, -0.15, -0.55]) {
    const rib = loft([
      { x: x + 0.07, w: 0.27, h: 0.17 },
      { x: x + 0.03, w: 0.46, h: 0.26 },
      { x: x - 0.06, w: 0.46, h: 0.26 },
      { x: x - 0.1, w: 0.27, h: 0.17 },
    ], PROFILE.chamfer(0.5), { tile: 0.3 });
    body.add(new THREE.Mesh(rib, M.bronze));
  }
  const aft = [[-0.8, 0.12], [-0.86, 0.38], [-1.16, 0.4], [-1.22, 0.14]];
  for (const o of [aft, mirrorOutline(aft)]) body.add(new THREE.Mesh(plate(o, 0.14, { bevel: 0.02 }), M.dark));
  const engines = [];
  [[V(-1.22, 0, 0.27), 0.085], [V(-1.22, 0, -0.27), 0.085], [V(-1.16, 0, 0), 0.07]].forEach(([p, r], i) => {
    const e = engine({ pos: p, radius: r, color: 0xff6a2a, intensity: 6.5, plumeLength: 0.6, seed: (opts.seed + i) % 97, bellMat: M.metal, bellGeo: bell(r, r * 1.3) });
    engines.push(e);
    body.add(e.group);
  });
  const spots = windowsOnLoft(spineGeo, { f0: 0.15, f1: 0.85, rows: [1.5, 3.5], count: 18, size: [0.026, 0.006], colors: [0xff5020, 0xff7a38], rand, dropout: 0.35 });
  body.add(windowArray(spots, 3.5));
  const tips = [V(0.84, 0.0, 0.63), V(0.84, 0.0, -0.63)];
  const lights = runningLights(tips.map((p, i) => ({ pos: p, color: 0xff3a1a, size: 0.08, intensity: 4, period: 2.6, duty: 0.5, phase: i * 1.3 })));
  body.add(lights.group);
  return { body, parts: { engines, lights, emitters: tips, hullMaterials: [M.hull, M.dark, M.bronze], faction: 'raider' } };
}

function buildSuper(opts) {
  const rand = mulberry32(opts.seed);
  const M = raiderMats(opts.anisotropy);
  const body = new THREE.Group();
  const centreGeo = loft([
    { x: 1.32, w: 0.03, h: 0.02 },
    { x: 1.02, w: 0.22, h: 0.14 },
    { x: 0.2, w: 0.34, h: 0.22 },
    { x: -0.9, w: 0.38, h: 0.24 },
    { x: -1.22, w: 0.3, h: 0.18 },
  ], PROFILE.keel(1, 0.45), { tile: 0.5 });
  body.add(new THREE.Mesh(centreGeo, M.hull));
  const outerGeos = [];
  for (const z of [-0.52, 0.52]) {
    const g = loft([
      { x: 0.98, w: 0.02, h: 0.015, z },
      { x: 0.72, w: 0.16, h: 0.1, z },
      { x: -0.8, w: 0.22, h: 0.15, z },
      { x: -1.06, w: 0.16, h: 0.12, z },
    ], PROFILE.chamfer(0.45), { tile: 0.45 });
    outerGeos.push(g);
    body.add(new THREE.Mesh(g, M.dark));
  }
  for (const [x0, x1] of [[0.32, 0.08], [-0.52, -0.78]]) {
    const br = [[x0, -0.56], [x0, 0.56], [x1, 0.56], [x1, -0.56]];
    const m = new THREE.Mesh(plate(br, 0.06), M.bronze);
    m.position.y = -0.01;
    body.add(m);
  }
  // Crown: forward-raked blades fanning from the prow.
  for (const [s, a, len] of [[1, 0.0, 1], [1, 0.34, 0.8], [-1, 0.34, 0.8]]) {
    // Outline relative to the blade root so it rotates about the prow.
    const b = [[0.5 * len, 0], [0.12, 0.05], [-0.02, 0.02], [0.12, -0.03]];
    const m = new THREE.Mesh(plate(b, 0.03), M.bronze);
    m.position.set(0.86, 0.09, 0);
    m.rotation.y = s * a;
    body.add(m);
  }
  // Twin reactor cores between the spines, pulsing.
  const coreMat = emissiveMaterial(0xff5a20, 4);
  const pulse = [];
  for (const z of [-0.27, 0.27]) {
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), coreMat);
    core.position.set(-0.22, 0.02, z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.022, 8, 28), M.metal);
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(core.position);
    const g = glowSprite(0xff5a20, 0.42, 1.6, { core: 1.2, falloff: 4 });
    g.position.copy(core.position);
    body.add(core, ring, g);
    pulse.push((t) => {
      const k = 0.75 + 0.25 * Math.sin(t * 2.4 + z * 5);
      coreMat.color.setRGB(1.0, 0.36, 0.13).multiplyScalar(4 * k);
      g.material.uniforms.uIntensity.value = 1.6 * k;
    });
  }
  const engines = [];
  [[V(-1.22, 0, 0), 0.12], [V(-1.06, 0, 0.52), 0.08], [V(-1.06, 0, -0.52), 0.08]].forEach(([p, r], i) => {
    const e = engine({ pos: p, radius: r, color: 0xff6a2a, intensity: 7, plumeLength: 0.7, seed: (opts.seed + i) % 97, bellMat: M.metal, bellGeo: bell(r, r * 1.3) });
    engines.push(e);
    body.add(e.group);
  });
  const spots = [
    ...windowsOnLoft(centreGeo, { f0: 0.2, f1: 0.85, rows: [1.4, 4.6], count: 20, size: [0.028, 0.006], colors: [0xff5020, 0xff8040], rand, dropout: 0.3 }),
    ...outerGeos.flatMap(g => windowsOnLoft(g, { f0: 0.3, f1: 0.8, rows: [1.5, 3.5], count: 8, size: [0.024, 0.006], colors: [0xff5020], rand, dropout: 0.4 })),
  ];
  body.add(windowArray(spots, 3.6));
  const tips = [V(1.3, 0.02, 0), V(0.96, 0.0, 0.52), V(0.96, 0.0, -0.52)];
  const lights = runningLights(tips.map((p, i) => ({ pos: p, color: 0xff3a1a, size: 0.08, intensity: 4, period: 1.8, duty: 0.5, phase: i * 0.6 })));
  body.add(lights.group);
  return { body, parts: { engines, lights, emitters: tips, hullMaterials: [M.hull, M.dark, M.bronze], faction: 'raider', pulse } };
}

function buildWarbird(opts) {
  const rand = mulberry32(opts.seed);
  const an = opts.anisotropy;
  const hull = hullMaterial('jade', { anisotropy: an, glow: 1.4, glowColor: 0x3cffc8, envI: 1.1 });
  const dark = hullMaterial('jade', { tint: 0x6e8e88, anisotropy: an, envI: 0.9 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x1c2a28, roughness: 0.35, metalness: 0.9, envMapIntensity: 1.0 });
  const body = new THREE.Group();
  const wingGeo = loft([
    { x: 0.86, w: 0.05, h: 0.02 },
    { x: 0.6, w: 0.5, h: 0.085 },
    { x: 0.3, w: 1.08, h: 0.11 },
    { x: 0.0, w: 1.66, h: 0.12 },
    { x: -0.28, w: 2.16, h: 0.1 },
    { x: -0.34, w: 2.22, h: 0.05 },
    { x: -0.4, w: 0.92, h: 0.09 },
    { x: -0.55, w: 0.46, h: 0.09 },
    { x: -0.98, w: 0.04, h: 0.02 },
  ], PROFILE.lens(14, 1), { tile: 0.35 });
  body.add(new THREE.Mesh(wingGeo, hull));
  const ridgeGeo = loft([
    { x: 0.72, w: 0.04, h: 0.02, y: 0.03 },
    { x: 0.45, w: 0.2, h: 0.1, y: 0.06 },
    { x: -0.4, w: 0.28, h: 0.13, y: 0.06 },
    { x: -0.72, w: 0.1, h: 0.05, y: 0.04 },
  ], PROFILE.keel(), { tile: 0.3 });
  body.add(new THREE.Mesh(ridgeGeo, dark));
  // Gill emitters: angled teal slits on the wing roots.
  const gillMat = emissiveMaterial(0x3cffc8, 2.8);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.01, 0.018), gillMat);
      g.position.set(0.05 - i * 0.12, 0.052, s * (0.28 + i * 0.1));
      g.rotation.y = s * 0.7;
      body.add(g);
    }
  }
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.06), emissiveMaterial(0x7fffe0, 2.2));
  canopy.position.set(0.42, 0.115, 0);
  body.add(canopy);
  // Slit drive across the trailing edge + two small nozzles.
  const slit = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.028, 0.56), emissiveMaterial(0x3cffc8, 5));
  slit.position.set(-0.5, 0.0, 0);
  body.add(slit);
  const engines = [];
  for (const [z, i] of [[0.2, 0], [-0.2, 1], [0, 2]]) {
    const e = engine({ pos: V(-0.52, 0, z), radius: i === 2 ? 0.05 : 0.06, color: 0x3cffc8, intensity: 6, plumeLength: 0.5, seed: (opts.seed + i) % 97, bellMat: i === 2 ? null : metal, bellGeo: i === 2 ? null : bell(0.06, 0.08) });
    engines.push(e);
    body.add(e.group);
  }
  const spots = windowsOnLoft(wingGeo, { f0: 0.3, f1: 0.62, rows: [3, 11], count: 10, size: [0.02, 0.006], colors: [0x7fffe0, 0x3cffc8], rand, dropout: 0.4 });
  body.add(windowArray(spots, 3));
  const tips = [V(-0.3, 0.0, 1.1), V(-0.3, 0.0, -1.1)];
  const lights = runningLights([
    ...tips.map((p, i) => ({ pos: p, color: 0x3cffc8, size: 0.08, intensity: 4, period: 2.4, duty: 0.5, phase: i * 1.2 })),
    { pos: V(0.84, 0.0, 0), color: 0x3cffc8, size: 0.05, intensity: 3 },
  ]);
  body.add(lights.group);
  return { body, parts: { engines, lights, emitters: [V(0.84, 0, 0), ...tips], hullMaterials: [hull, dark], faction: 'jade' } };
}

const BUILDERS = {
  player: buildPlayer,
  warship: buildWarship,
  battlecruiser: buildBattlecruiser,
  super: buildSuper,
  warbird: buildWarbird,
};

/**
 * Build a ship model.
 * @param kind  'player' | 'warship' | 'battlecruiser' | 'super' | 'warbird'
 * @param opts  { id, anisotropy }
 */
export function buildShip(kind, { id = kind, anisotropy = 4 } = {}) {
  const seed = hashString(id);
  const builder = BUILDERS[kind] || BUILDERS.warship;
  const { body, parts } = builder({ seed, anisotropy });
  const root = new THREE.Group();
  root.add(body);
  root.name = `ship:${id}`;
  const model = new ShipModel(kind, root, body, { ...parts, phase: (seed % 1000) / 159 });
  root.userData.model = model;
  return model;
}

export const SHIP_KINDS = Object.keys(BUILDERS);
