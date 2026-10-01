// Spacecraft, all original designs (ADR-009):
//  - the player's "Viper": a forward-swept, twin-engine single-seater with a
//    V-tail, wingtip pods and a bubble canopy;
//  - the enemy "Cylon raider": an asymmetric three-blade hull around a violet
//    core (deliberately not a saucer, and no scanning red eye);
//  - the "Battlestar": a ring-and-spine carrier.
// Names are the game's; the silhouettes are this port's own.

import * as THREE from 'three';
import { mat, glowMat } from './materials.js';

const hull = () => mat('panel', { c1: 0xd9d6cc, c2: 0x3a3a3a, c3: 0xffb060, p: [0.9, 0, 0, 0.05], q: [0.25, 0.85, 0, 0], seed: 3 });
const trim = () => mat('metal', { c1: 0xe0662a, c2: 0x552211, p: [0.4, 0.2, 0, 0] });
const dark = () => mat('metal', { c1: 0x23272d, c2: 0x0a0b0d, p: [0.5, 0.3, 0, 0] });

function wing(span, root, tip, sweep, thick = 0.08) {
  const s = new THREE.Shape();
  s.moveTo(0, -root / 2);
  s.lineTo(span, -tip / 2 + sweep);
  s.lineTo(span, tip / 2 + sweep);
  s.lineTo(0, root / 2);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.03, bevelSegments: 1 });
  g.rotateX(Math.PI / 2);
  g.translate(0, thick / 2, 0);
  return g;
}

/** The player's fighter. Length ~8 m, nose toward -Z. */
export function makeViper({ damaged = false } = {}) {
  const g = new THREE.Group();
  // fuselage: a lathed teardrop
  const prof = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const r = Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.5) * (1 - t * 0.35) * 0.62 + 0.02;
    prof.push(new THREE.Vector2(r, t * 8 - 4));
  }
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), hull());
  body.rotation.x = -Math.PI / 2;
  body.scale.set(1, 1, 0.72);
  g.add(body);
  // canopy blister
  const can = new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x0b1a26, roughness: 0.05, metalness: 0.4, emissive: 0x06202e }));
  can.scale.set(0.8, 0.7, 1.9);
  can.position.set(0, 0.34, -1.1);
  g.add(can);
  // forward-swept wings with wingtip pods
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(wing(3.2, 2.8, 1.1, -1.2), hull());
    w.scale.x = side;
    w.position.set(side * 0.35, -0.15, 1.0);
    g.add(w);
    const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 1.4, 4, 10), trim());
    pod.rotation.x = Math.PI / 2;
    pod.position.set(side * 3.5, -0.08, 0.1);
    g.add(pod);
    // twin engines side by side
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 2.2, 16), dark());
    eng.rotation.x = Math.PI / 2;
    eng.position.set(side * 0.55, -0.05, 3.1);
    g.add(eng);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.27, 16), glowMat(0xff7a2a, damaged ? 0.6 : 6));
    glow.position.set(side * 0.55, -0.05, 4.21);
    g.add(glow);
    glow.name = 'engineGlow';
    // V-tail fins canted outward
    const fin = new THREE.Mesh(wing(1.5, 1.6, 0.6, 0.7, 0.06), trim());
    fin.rotation.z = side * (Math.PI / 2 - 0.55);
    fin.position.set(side * 0.3, 0.3, 3.0);
    g.add(fin);
    // ventral intake
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 1.6), dark());
    intake.position.set(side * 0.42, -0.42, 0.6);
    g.add(intake);
  }
  // orange nose band
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.25, 20), trim());
  band.rotation.x = Math.PI / 2;
  band.scale.set(1, 1, 0.75);
  band.position.set(0, 0, -2.4);
  g.add(band);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** The enemy raider: three uneven blades around a violet core. ~9 m across. */
export function makeRaider() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), mat('metal', { c1: 0x3b2a1e, c2: 0x120b07, p: [0.35, 0.4, 0, 0] }));
  core.scale.set(1, 0.72, 1.25);
  g.add(core);
  const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 2), glowMat(0xb46cff, 5));
  eye.position.z = -0.72;
  eye.scale.set(1, 0.7, 0.5);
  eye.name = 'core';
  g.add(eye);
  const bladeMat = mat('panel', { c1: 0x5a4636, c2: 0x1a120c, c3: 0xb46cff, p: [0.7, 0.04, 0.0, 0.1], q: [0.4, 0, 0, 0], seed: 11 });
  const blades = [[0, 4.2], [2.05, 3.1], [4.1, 3.7]];
  for (const [a, len] of blades) {
    const s = new THREE.Shape();
    s.moveTo(0, -0.5);
    s.quadraticCurveTo(len * 0.55, -0.9, len, -0.1);
    s.quadraticCurveTo(len * 0.6, 0.35, 0, 0.5);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1, curveSegments: 10 });
    geo.translate(0.6, 0, -0.09);
    const b = new THREE.Mesh(geo, bladeMat);
    b.rotation.z = a;
    b.rotation.y = 0.18;
    g.add(b);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), glowMat(0xb46cff, 3));
    tip.position.set(Math.cos(a) * (len + 0.55), Math.sin(a) * (len + 0.55), 0);
    g.add(tip);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** The battlestar: a long spine threaded through a segmented ring. ~600 m. */
export function makeCarrier() {
  const g = new THREE.Group();
  const plate = mat('panel', { c1: 0x6b7280, c2: 0x1e2229, c3: 0xffd08a, p: [6, 0, 0, 0.35], q: [0.6, 0, 0, 0], seed: 21 });
  const spine = new THREE.Mesh(new THREE.BoxGeometry(46, 38, 560), plate);
  g.add(spine);
  const prow = new THREE.Mesh(new THREE.ConeGeometry(34, 120, 4), plate);
  prow.rotation.x = -Math.PI / 2;
  prow.rotation.y = Math.PI / 4;
  prow.position.z = -340;
  prow.scale.set(1.2, 1, 0.8);
  g.add(prow);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(150, 16, 12, 48), plate);
  ring.position.z = 40;
  g.add(ring);
  for (let i = 0; i < 6; i++) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(10, 140, 12), plate);
    strut.rotation.z = (i / 6) * Math.PI * 2;
    strut.position.z = 40;
    strut.geometry.translate(0, 70, 0);
    g.add(strut);
  }
  const block = new THREE.Mesh(new THREE.BoxGeometry(90, 60, 90), plate);
  block.position.z = 300;
  g.add(block);
  for (const x of [-26, 0, 26]) {
    const n = new THREE.Mesh(new THREE.CircleGeometry(14, 20), glowMat(0x7ab8ff, 4));
    n.position.set(x, 0, 346);
    g.add(n);
  }
  // running lights along the spine
  const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(1.6, 6, 4), glowMat(0xffd08a, 6), 60);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 60; i++) {
    m4.makeTranslation((i % 2 ? 1 : -1) * 23.5, 19.5 * (i % 4 < 2 ? 1 : -1), -270 + i * 9);
    lights.setMatrixAt(i, m4);
  }
  g.add(lights);
  return g;
}
