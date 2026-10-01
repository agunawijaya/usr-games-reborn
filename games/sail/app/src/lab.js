// Visual test bench (lab.html). Renders isolated scenes from URL parameters
// so each visual stage can be screenshotted and critiqued in isolation:
//   scene = sea | ships | broadside | damage
//   wind  = 0..7, dir = 1..8, mood = golden|gale|tropic|dusk|haze
//   cam   = low | high | top, t = seconds to advance before "ready"
import * as THREE from 'three';
import { createWorld } from './render/world.js';

const q = new URLSearchParams(location.search);
const wind = +(q.get('wind') ?? 3);
const dir = +(q.get('dir') ?? 2);
const mood = q.get('mood') || 'golden';
const camMode = q.get('cam') || 'low';
const quality = q.get('q') || 'high';
const advance = +(q.get('t') ?? 2);

const canvas = document.getElementById('c');
const world = createWorld(canvas, { quality });
world.atmo.setMood(mood);
world.setWind(wind, dir, true);

const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 20000);
const focus = new THREE.Vector3(0, 0, 0);
// face = sun | away | <degrees>: which way the camera looks.
function place() {
  const face = q.get('face') || 'sun';
  const sunAz = world.atmo.state.mood.azim;
  const az = THREE.MathUtils.degToRad(face === 'sun' ? sunAz - 25 : face === 'away' ? sunAz + 180 : +face);
  const look = new THREE.Vector3(Math.sin(az), 0, -Math.cos(az));
  const back = camMode === 'high' ? 260 : camMode === 'top' ? 1 : 130;
  const up = +(q.get('h') || (camMode === 'high' ? 75 : camMode === 'top' ? 900 : 9));
  camera.position.copy(focus).addScaledVector(look, -back).setY(up);
  camera.lookAt(focus.x, camMode === 'low' ? 4 : 0, focus.z);
}
function resize() {
  const { w, h } = world.resize();
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
if ((new URLSearchParams(location.search).get("scene") || "sea") === "sea") place();

// --- ships scene: real engine ships, hand-placed ----------------------------------
const sceneName = q.get('scene') || 'sea';
const ships = [];
let focusShip = null;
if (sceneName !== 'sea') {
  const E = await import('./engine/index.js');
  const { ShipVisual } = await import('./render/ship.js');
  const st = E.createGame({ scenarioId: +(q.get('sc') ?? 13), playerShip: 0, seed: 3 });
  st.winddir = dir;
  st.windspeed = wind;
  const layout = (q.get('pos') || '10,10,3;10,13,3').split(';').map((s) => s.split(',').map(Number));
  st.ships.forEach((sp, i) => {
    const p = layout[i] || [30 + i * 3, 30, 3];
    Object.assign(sp, { row: p[0], col: p[1], dir: p[2] });
  });
  if (q.get('full')) q.get('full').split(',').forEach((i) => { st.ships[+i].FS = 2; });
  if (q.get('dmg')) {
    // dmg=ship:hull:rig1:rig2:rig3
    for (const d of q.get('dmg').split(';')) {
      const [i, hull, r1, r2, r3] = d.split(':').map(Number);
      Object.assign(st.ships[i].specs, { hull, rig1: r1, rig2: r2, rig3: r3 });
    }
  }
  for (const sp of st.ships) {
    const v = new ShipVisual(sp, st);
    world.scene.add(v.root);
    ships.push(v);
  }
  focusShip = ships[+(q.get('focus') ?? 0)];
  world.__ships = ships;
  const f = focusShip.root.position;
  focus.set(f.x, 0, f.z);
  // camera: orbit angle (deg, relative to the focus ship's heading), distance, height
  const orb = THREE.MathUtils.degToRad(+(q.get('orbit') ?? 140));
  const dist = +(q.get('dist') ?? 120);
  const hgt = +(q.get('h') ?? 18);
  const yaw = focusShip.root.rotation.y;
  camera.position.set(f.x + Math.sin(yaw + orb) * dist, hgt, f.z + Math.cos(yaw + orb) * dist);
  camera.lookAt(f.x, +(q.get('ly') ?? 18), f.z);
}
const windVec = world.atmo.state.windVec;

let last = performance.now();
let frames = 0;
let acc = 0;
const info = document.getElementById('info');
// advance simulated time deterministically before declaring ready
function step(dt) {
  world.update(dt, camera, focus);
  for (const s of ships) s.update(dt, world.time, world, windVec, world.atmo.state.wind, 0);
  if (ships.length) {
    world.ocean.setWakes(ships.map((s) => ({
      x: s.root.position.x, z: s.root.position.z, heading: -s.root.rotation.y, speed: s.v.speed,
      halfLength: s.L * 0.5, halfBeam: s.B * 0.5,
    })));
  }
}
for (let i = 0; i < advance * 30; i++) step(1 / 30);
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);
  world.render(camera);
  frames++;
  acc += dt;
  if (acc > 1) {
    info.textContent = `wind ${wind} dir ${dir} ${mood} ${quality} — ${Math.round(frames / acc)} fps`;
    frames = 0;
    acc = 0;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__ready = true;
