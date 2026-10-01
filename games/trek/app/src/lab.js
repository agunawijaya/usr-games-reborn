// trek/procedural-web — visual lab (art-direction bench, not part of the game).
//   lab.html?view=nebula&qx=3&qy=4[&q=low]
//   lab.html?view=ships[&qx..][&tilt=deg][&dist=n][&focus=kind]
//   lab.html?view=base
// Sets window.__ready once the first frames are on screen (scripts/snap.mjs).

import * as THREE from 'three';
import { createRenderer, fitRenderer } from './render/core.js';
import { Nebula } from './render/nebula.js';
import { Post } from './render/post.js';
import { buildShip } from './render/ships.js';
import { buildStarbase } from './render/starbase.js';

const qs = new URLSearchParams(location.search);
const view = qs.get('view') || 'nebula';
globalThis.__labHide = qs.get('hide') || '';
if (qs.get('info') === '0') document.getElementById('info').style.display = 'none';
const canvas = document.getElementById('gl');
const info = document.getElementById('info');
const { renderer, profile, gpu } = createRenderer(canvas, qs.get('q') || 'auto', { preserve: true });
const post = new Post(renderer, profile);
const nebula = new Nebula(renderer, profile);

const scene = new THREE.Scene();
scene.add(nebula.backgroundMesh);
const camera = new THREE.PerspectiveCamera(+(qs.get('fov') || 30), 1, 0.1, 500);

let W = 0, H = 0;
function resize() {
  const s = fitRenderer(renderer, profile, window.innerWidth, window.innerHeight);
  W = s.w; H = s.h;
  post.setSize(W, H);
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const qx = +(qs.get('qx') ?? 3), qy = +(qs.get('qy') ?? 4);
const t0 = performance.now();
const P = nebula.bake(qx, qy);
const bakeMs = performance.now() - t0;
info.textContent = `${view} · q ${qx + 1}-${qy + 1} · ${P.palette.name} · bake ${bakeMs.toFixed(0)} ms · ${profile.name} · ${gpu.name}`;
window.__info = { palette: P.palette.name, bakeMs: Math.round(bakeMs), exposure: +P.skyExposure.toFixed(2), profile: profile.name };

// Lighting as the tactical scene will set it up per quadrant.
function addLights() {
  if (nebula.envMap) scene.environment = nebula.envMap;
  const hemi = new THREE.HemisphereLight(new THREE.Color(P.palette.gas[2]).lerp(new THREE.Color(0xffffff), 0.5), new THREE.Color(P.palette.gas[0]), 0.9);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(new THREE.Color(P.keyColor), 2.6);
  key.position.copy(P.keyDir).multiplyScalar(10);
  scene.add(key);
  const rim = new THREE.DirectionalLight(new THREE.Color(0x88aaff), 0.6);
  rim.position.set(-P.keyDir.x * 10, 4, -P.keyDir.z * 10);
  scene.add(rim);
}

const updaters = [];
let target = new THREE.Vector3();
const tilt = THREE.MathUtils.degToRad(+(qs.get('tilt') ?? 24));
let dist = +(qs.get('dist') ?? 14);

if (view === 'ships') {
  addLights();
  const kinds = ['player', 'warship', 'battlecruiser', 'super', 'warbird'];
  const focus = qs.get('focus');
  const list = focus ? [focus] : kinds;
  list.forEach((k, i) => {
    const m = buildShip(k, { id: `${k}-lab`, anisotropy: profile.anisotropy });
    m.root.position.set((i - (list.length - 1) / 2) * 3.0, 0, 0);
    m.setHeading(+(qs.get('heading') ?? 0.35));
    scene.add(m.root);
    updaters.push((t) => m.update(t));
  });
  if (focus) dist = +(qs.get('dist') ?? 5);
} else if (view === 'base') {
  addLights();
  const b = buildStarbase({ anisotropy: profile.anisotropy });
  scene.add(b.root);
  updaters.push((t) => b.update(t));
  const p = buildShip('player', { anisotropy: profile.anisotropy });
  p.root.position.set(-1.2, 0.3, 3.4);
  p.setHeading(0.5);
  scene.add(p.root);
  updaters.push((t) => p.update(t));
  const k = buildShip('warship', { id: 'K-lab', anisotropy: profile.anisotropy });
  k.root.position.set(4.2, 0.2, -2.6);
  k.setHeading(2.6);
  scene.add(k.root);
  updaters.push((t) => k.update(t));
  dist = +(qs.get('dist') ?? 17);
}

if (view === 'boom') {
  // Explosion bench: a ship at the centre heats up at t=0.6 s and blows at
  // t=0.9 s; ?at=seconds after the blast chooses the captured moment.
  addLights();
  const { FX } = await import('./render/fx.js');
  const fx = new FX(scene, new THREE.Scene(), profile);
  const kind = qs.get('kind') || 'battlecruiser';
  const m = buildShip(kind, { id: 'boom', anisotropy: profile.anisotropy });
  m.setHeading(0.4);
  scene.add(m.root);
  const player = buildShip('player', { anisotropy: profile.anisotropy });
  player.root.position.set(-3.2, 0, 1.8);
  player.setHeading(0.5);
  scene.add(player.root);
  const scale = { warship: 1, warbird: 1.15, battlecruiser: 1.3, super: 1.75 }[kind] ?? 1;
  let fired = false;
  updaters.push((t) => {
    fx.update(t);
    m.update(t); player.update(t);
    if (t > 0.6 && !fired) m.setHeat(Math.min(1, (t - 0.6) / 0.3));
    if (t > 0.9 && !fired) { fired = true; fx.explosion(m.root.position.clone(), scale); scene.remove(m.root); }
  });
  dist = +(qs.get('dist') ?? 12);
}
camera.position.set(0, Math.cos(tilt) * dist, Math.sin(tilt) * dist);
camera.lookAt(target);

let frames = 0;
function frame(tms) {
  const t = tms / 1000;
  nebula.update(W, H, t, { x: Math.sin(t * 0.05) * 0.01, y: Math.cos(t * 0.04) * 0.008 }, view === 'nebula' ? 1 : 0.8);
  for (const u of updaters) u(t);
  renderer.setRenderTarget(post.sceneRT);
  renderer.setClearColor(0x000000, 1);
  renderer.clear();
  renderer.render(scene, camera);
  post.finish(t, false);
  if (++frames === 4) window.__ready = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
