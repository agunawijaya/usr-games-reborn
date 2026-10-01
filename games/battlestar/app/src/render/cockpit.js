// The dogfight (fly.c) as a 3D cockpit. The FlightSim owns the rules; this
// only draws them:
//  - the raider's grid cell (row, column) becomes a bearing off the nose
//    (about 1 degree per column and 2 per row: terminal cells are twice as
//    tall as wide), eased between the engine's one-second steps, banking;
//  - the player's drift (dr, dc) rotates the star field continuously, which
//    is what the keys really do in fly.c: they turn the ship;
//  - fly.c's blast (two lines converging from the bottom corners) becomes two
//    torpedoes with trails; the original stars (screen()) are placed where
//    the terminal drew them.

import * as THREE from 'three';
import { makeSpace } from './sky.js';
import { makeRaider } from './craft.js';
import { glowMat } from './materials.js';
import { buildCockpitFrame, paintGauges } from './viper-cockpit.js';
import { particles, glowSprite } from './fx.js';
import { MIDR, MIDC } from '../engine/flight.js';

const DEG_COL = THREE.MathUtils.degToRad(0.95);
const DEG_ROW = THREE.MathUtils.degToRad(1.35);
const RANGE = 70;

function bearing(row, col) {
  const yaw = (col - MIDC) * DEG_COL;
  const pitch = -(row - MIDR) * DEG_ROW;
  return new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
}

export class Cockpit {
  constructor(stage, sim, { reducedMotion = false } = {}) {
    this.stage = stage;
    this.sim = sim;
    this.reduced = reducedMotion;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, stage.camera.aspect, 0.02, 3000);
    this.scene.add(this.camera);
    this.scene.environment = stage.envs.get('cockpit');
    this.scene.environmentIntensity = 0.8;

    // world that turns with the drift
    this.world = new THREE.Group();
    this.scene.add(this.world);
    const seed = (sim.stars.length * 7 + (sim.firstRow || 0) * 13) % 97;
    this.space = makeSpace(seed / 7, seed % 3);
    this.world.add(this.space);
    // the original's stars, where screen() put them (rnd(LINES-3)+1, rnd(COLS))
    const pos = [];
    for (const [r, c] of sim.stars) {
      const d = bearing(r, c).multiplyScalar(500);
      pos.push(d.x, d.y, d.z);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.world.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdde8ff, size: 2.6, sizeAttenuation: false, toneMapped: false })));
    // a distant planet gives the turning a reference
    const pl = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.MeshStandardMaterial({ color: 0x2a6a8a, roughness: 0.8, emissive: 0x06141c }));
    pl.position.set(-260, -120, -520);
    this.world.add(pl);

    // light
    this.scene.add(new THREE.HemisphereLight(0x8aa0ff, 0x100808, 0.6));
    const sun = new THREE.DirectionalLight(0xfff0dd, 2.4);
    sun.position.set(3, 2, 1);
    this.scene.add(sun);

    // the raider
    this.raider = makeRaider();
    this.raider.scale.setScalar(1.2);
    this.scene.add(this.raider);
    this.raiderLight = new THREE.PointLight(0xb46cff, 40, 30, 2);
    this.raider.add(this.raiderLight);
    this.engine = particles('embers', 40, { quality: stage.quality, seed: 3, spread: [0.6, 0.6, 0.6], vel: [0, 0, 3], color: 0xd0a0ff, color2: 0x6030ff, size: 8 });
    this.raider.add(this.engine);

    // cockpit frame attached to the camera
    const f = buildCockpitFrame(stage.quality);
    this.frame = f.group;
    this.gauges = f.gauges;
    this.camera.add(this.frame);
    this.frame.add(new THREE.PointLight(0x7fd6ff, 0.6, 2, 2));

    // reticle (fly.c: "-------   +   -------" with | above and below, toggled by '+')
    this.reticle = new THREE.Group();
    const rm = glowMat(0x7fffb0, 2.4, { transparent: true, opacity: 0.85 });
    const bar = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), rm); m.position.set(x, y, 0); this.reticle.add(m); };
    const k = 0.01;
    bar(7 * k, 0.12 * k, -7 * k, 0); bar(7 * k, 0.12 * k, 7 * k, 0);
    bar(0.12 * k, 3.2 * k, 0, 5.2 * k); bar(0.12 * k, 3.2 * k, 0, -5.2 * k);
    this.reticle.position.set(0, 0, -1);
    this.camera.add(this.reticle);
    this.pip = new THREE.Mesh(new THREE.RingGeometry(0.004, 0.0055, 20), rm);
    this.pip.position.set(0, 0, -1);
    this.camera.add(this.pip);

    // target bracket that follows the raider (projected each frame)
    this.bracket = new THREE.Group();
    const bm = glowMat(0xff9a70, 2, { transparent: true, opacity: 0.9 });
    for (const [x, y, rz] of [[-1, 1, 0], [1, 1, -Math.PI / 2], [1, -1, Math.PI], [-1, -1, Math.PI / 2]]) {
      const c = new THREE.Group();
      c.add(new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.002), bm).translateX(0.006));
      c.add(new THREE.Mesh(new THREE.PlaneGeometry(0.002, 0.012), bm).translateY(-0.006));
      c.position.set(x * 0.018, y * 0.018, 0);
      c.rotation.z = rz;
      this.bracket.add(c);
    }
    this.camera.add(this.bracket);
    this.torpedoes = [];
    this.bolts = [];
    this.boom = null;
    this.tickAt = performance.now() / 1000;
    this.lastTicks = sim.ticks;
    this.lastShots = sim.shots;
    this.raiderPos = bearing(sim.row, sim.column).multiplyScalar(RANGE);
    this.raider.position.copy(this.raiderPos);
    this.outcome = null;
    this.outcomeAt = 0;
    this.paint();
  }

  paint(extra = {}) {
    const v = this.sim.view();
    paintGauges(this.gauges, { torps: v.torps, fuel: v.fuel, clock: v.clock, heading: 'COMBAT MODE', ...extra });
  }

  /** Called by the UI after every key and tick. */
  onChange(v, key) {
    if (v.ticks !== this.lastTicks) {
      this.lastTicks = v.ticks;
      this.tickAt = performance.now() / 1000;
    }
    if (v.shots !== this.lastShots) {
      this.lastShots = v.shots;
      this.fire(v.hitAt === v.ticks && v.outcome === 'destroyed');
    }
    if (v.done && !this.outcome) {
      this.outcome = v.outcome;
      this.outcomeAt = performance.now() / 1000;
      if (v.outcome === 'destroyed') this.explode();
      if (v.outcome === 'quit') this.strafe();
    }
    const low = v.clock <= 20 || v.fuel <= 40;
    this.paint({ alert: low || v.messages.length > 0, msg: v.messages.at(-1)?.text?.replace(/\*/g, '').trim() || (v.clock <= 20 ? 'TIME LOW' : v.fuel <= 40 ? 'FUEL LOW' : '') });
  }

  fire(hit) {
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), glowMat(0xffc070, 10));
      const trail = particles('embers', 30, { quality: this.stage.quality, seed: s + 5, spread: [0.05, 0.05, 0.05], vel: [0, 0, 0.6], size: 5, life: 0.5 });
      m.add(trail);
      m.position.set(s * 0.9, -0.6, -1);
      this.camera.add(m);
      this.torpedoes.push({ m, trail, s, t0: performance.now() / 1000, hit });
    }
    this.stage.fx('flash', { amount: 0.12, color: [1, 0.8, 0.5] });
  }

  explode() {
    const g = new THREE.Group();
    g.position.copy(this.raider.position);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), glowMat(0xffa040, 8, { transparent: true, opacity: 1 }));
    g.add(ball);
    const burst = particles('sparks', 160, { quality: this.stage.quality, seed: 9, spread: [1, 1, 1], vel: [0, 0, 0], swirl: 12, size: 12, life: 1.6, gravity: 0 });
    g.add(burst);
    const glow = glowSprite(0xff8030, 40, 1.4);
    g.add(glow);
    this.scene.add(g);
    this.boom = { g, ball, burst, glow, t0: performance.now() / 1000 };
    this.stage.fx('flash', { amount: 0.8, color: [1, 0.75, 0.45] });
    this.stage.fx('shake', { amount: 0.6 });
  }

  strafe() {
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 6, 6), glowMat(0xff3020, 8));
      b.rotation.x = Math.PI / 2;
      this.scene.add(b);
      this.bolts.push({ b, t0: performance.now() / 1000 + i * 0.12, from: this.raider.position.clone(), to: new THREE.Vector3((i % 2 ? 1 : -1) * 1.5, (i % 3 - 1) * 0.8, 2) });
    }
  }

  update(t, dt) {
    const now = performance.now() / 1000;
    this.camera.aspect = this.stage.camera.aspect;
    this.camera.updateProjectionMatrix();
    const v = this.sim.view();
    // the ship turns: the whole sky drifts at the rate the raider drifts
    if (v.fuel > 0 && !this.outcome) {
      this.world.rotation.y -= v.dc * DEG_COL * dt;
      this.world.rotation.x -= v.dr * DEG_ROW * dt;
    }
    this.space.material.uniforms.uTime.value = t;
    // raider: ease from the previous cell to the current one within the second
    const k = Math.min(1, (now - this.tickAt) / 0.65);
    const e = k * k * (3 - 2 * k);
    const a = bearing(v.prevRow, v.prevColumn);
    const b = bearing(v.row, v.column);
    const dir = a.lerp(b, e).normalize();
    if (!this.outcome || this.outcome === 'timeout') {
      this.raider.position.copy(dir.multiplyScalar(RANGE));
      this.raider.lookAt(0, 0, 0);
      this.raider.rotateZ(-(v.column - v.prevColumn) * 0.18 * (1 - e) + Math.sin(t * 1.7) * 0.15);
      this.raider.rotateY(Math.PI);
    } else if (this.outcome === 'quit') {
      const q = now - this.outcomeAt;
      this.raider.position.addScaledVector(new THREE.Vector3(0.6, 0.35, -0.4), dt * 60 * Math.min(1, q));
      this.raider.rotateZ(dt * 6);
    } else if (this.outcome === 'destroyed') {
      this.raider.visible = now - this.outcomeAt < 0.08;
    }
    this.raider.children.forEach((c) => { if (c.name === 'core') c.scale.setScalar(1 + Math.sin(t * 6) * 0.08); });
    this.engine.userData.tick(t);
    // bracket around the raider (screen-projected, drawn at 1 m)
    const p = this.raider.position.clone().applyMatrix4(this.camera.matrixWorldInverse);
    this.bracket.visible = !this.outcome && p.z < 0;
    if (p.z < 0) this.bracket.position.set(p.x / -p.z, p.y / -p.z, -1);
    // reticle
    this.reticle.visible = !!v.cross;
    const onTarget = v.row === MIDR && Math.abs(v.column - MIDC) < 2;
    this.pip.material.color.setRGB(onTarget ? 4 : 0.5, onTarget ? 0.6 : 2.4, onTarget ? 0.4 : 1.2);
    // torpedoes converge on the centre, then fly on toward the target
    this.torpedoes = this.torpedoes.filter((p) => {
      const q = (now - p.t0) / 0.55;
      if (q > 1.6) { this.camera.remove(p.m); return false; }
      const z = -1 - q * 20;
      p.m.position.set(p.s * 0.9 * Math.max(0, 1 - q), -0.6 * Math.max(0, 1 - q), z);
      p.trail.userData.tick(t);
      return true;
    });
    for (const bo of this.bolts) {
      const q = (now - bo.t0) / 0.4;
      bo.b.visible = q > 0 && q < 1;
      if (q > 0 && q < 1) {
        bo.b.position.copy(bo.from).lerp(bo.to, q);
        bo.b.lookAt(bo.to);
        bo.b.rotateX(Math.PI / 2);
        if (!bo.hitDone && q > 0.9) { bo.hitDone = true; this.stage.fx('flash', { amount: 0.35, color: [0.9, 0.1, 0.05] }); this.stage.fx('shake', { amount: 0.7 }); }
      }
    }
    if (this.boom) {
      const q = now - this.boom.t0;
      this.boom.ball.scale.setScalar(1 + q * 14);
      this.boom.ball.material.opacity = Math.max(0, 1 - q * 1.2);
      this.boom.burst.userData.tick(q);
      this.boom.glow.material.uniforms.uI.value = Math.max(0, 1.4 - q);
    }
    // cockpit vibration
    if (!this.reduced) this.frame.position.y = Math.sin(t * 30) * 0.0015;
  }

  dispose() {
    this.scene.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
  }
}
