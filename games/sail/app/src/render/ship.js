// ShipVisual: one procedurally built ship, kept in sync with an engine ship.
//
// Everything visible is driven by engine state: position/heading from the
// grid, masts from rig1..rig4 (a mast topples when its counter reaches 0),
// sails from FS (battle vs. full), hull wear from hull points, list from
// hull/sinking state, flag from struck/captured, fire from explode == 1.

import * as THREE from 'three';
import { buildHull, setPorts, MAX_HITS } from './hull.js';
import { buildRig, trimSails } from './rig.js';
import { flagMaterial } from './flags.js';
import { CELL, dirYaw } from './world.js';

const DR = [0, 1, 1, 0, -1, -1, -1, 0, 1];
const DC = [0, 0, -1, -1, -1, 0, 1, 1, 1];
const ease = (t) => t * t * (3 - 2 * t);

// Bow position of an engine pose, in world metres.
export function bowWorld(row, col) {
  return new THREE.Vector2(col * CELL, row * CELL);
}
// The model origin sits midway between the bow and stern squares.
export function poseToWorld(row, col, dir) {
  const x = (col + DC[dir] * 0.5) * CELL;
  const z = (row + DR[dir] * 0.5) * CELL;
  return { x, z, yaw: dirYaw(dir) };
}

export class ShipVisual {
  constructor(ship, st) {
    this.index = ship.index;
    this.name = ship.name;
    this.nation = ship.nationality;
    this.spec = ship.max;
    this.root = new THREE.Group(); // grid position + heading
    this.body = new THREE.Group(); // heave, pitch, roll, list
    this.root.add(this.body);
    this.hull = buildHull(ship.max, ship.nationality);
    this.body.add(this.hull.group);
    this.rig = buildRig(this.hull);
    for (const m of this.rig.masts) this.body.add(m.pivot);
    this.body.add(this.rig.bow, this.rig.head, this.rig.stays, ...this.rig.jibs);
    this.dim = this.hull.dim;
    this.L = this.dim.L;
    this.B = this.dim.B;

    // ensign on a staff over the taffrail; pennant at the main truck
    const f = this.hull.form;
    this.flagStaff = new THREE.Group();
    this.flagStaff.position.set(0, f.top(0), f.zOf(0) + 0.6);
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 7, 6), new THREE.MeshStandardMaterial({ color: '#3a2a1a' }));
    staff.position.y = 3.5;
    this.flagStaff.add(staff);
    this.body.add(this.flagStaff);
    this.flagSize = Math.max(4, this.L * 0.11);
    this.flag = this.makeFlag(ship.nationality, this.flagSize);
    this.flagStaff.add(this.flag);
    this.flagHeight = 6.7; // top of staff
    this.flag.position.y = this.flagHeight;
    const main = this.rig.masts[Math.min(1, this.rig.masts.length - 1)];
    this.pennant = this.makeFlag(ship.nationality, 1.0, 12);
    this.pennant.position.y = main.H * 1.03;
    main.body.add(this.pennant);

    // visual state (targets set by sync(), animated in update())
    this.v = {
      bow: bowWorld(ship.row, ship.col),
      yaw: dirYaw(ship.dir),
      heave: 0, pitch: 0, roll: 0,
      heaveV: 0, pitchV: 0, rollV: 0,
      list: 0, listTarget: 0,
      heel: 0,
      sink: 0, // 0..1 settling of a foundering hulk
      plunge: -1, // >= 0 while going down for good
      speed: 0,
      full: ship.FS ? 1 : 0, fullTarget: ship.FS ? 1 : 0,
      soot: 0, burn: 0, burnTarget: 0,
      flagY: this.flagHeight, flagTarget: this.flagHeight, flagNation: ship.nationality,
      hidden: false,
      exploded: false,
    };
    this.path = null; // { poses: [...], t, dur }
    this.hits = [];
    this.rigState = [ship.specs.rig1, ship.specs.rig2, ship.specs.rig3, ship.specs.rig4];
    this.lowerClosed = false;
    setPorts(this.hull, new Set());
    this.placeRoot();
    this.sync(ship, st, true);
    this.root.traverse((o) => { if (o.isMesh) o.userData.shipIndex = this.index; });
  }

  makeFlag(nation, size, fly = 0) {
    const w = fly || size * 1.5;
    const h = fly ? size : size;
    const g = new THREE.PlaneGeometry(w, h, 12, 4);
    g.translate(w / 2, -h / 2, 0);
    const m = new THREE.Mesh(g, flagMaterial(nation));
    m.castShadow = true;
    return m;
  }

  setFlagNation(nation) {
    if (this.v.flagNation === nation) return;
    this.v.flagNation = nation;
    const old = this.flag;
    this.flag = this.makeFlag(nation, this.flagSize);
    this.flag.position.copy(old.position);
    this.flagStaff.remove(old);
    this.flagStaff.add(this.flag);
  }

  // Engine state -> visual targets. `instant` skips animation (load/scrub).
  sync(ship, st, instant = false) {
    const v = this.v;
    const hullFrac = ship.specs.hull / Math.max(1, ship.max.hull);
    v.soot = Math.max(v.soot, (1 - hullFrac) * 0.8);
    v.fullTarget = ship.FS && !ship.struck ? 1 : 0;
    if (instant) v.full = v.fullTarget;
    // list: battered hulls take water; a foundering hulk lists hard
    v.listTarget = (1 - hullFrac) > 0.55 ? (1 - hullFrac - 0.55) * 0.28 : 0;
    if (ship.sink === 1) v.listTarget = 0.22;
    v.burnTarget = ship.explode === 1 ? 1 : 0;
    if (instant) v.burn = v.burnTarget;
    // colours: struck -> hauled down; captured -> captor's ensign hoisted
    const captor = ship.captured >= 0 ? st.ships[ship.captured].nationality : ship.nationality;
    if (ship.struck && ship.captured < 0) {
      v.flagTarget = 0.4;
    } else {
      if (captor !== v.flagNation) {
        if (instant) this.setFlagNation(captor);
        else {
          v.pendingNation = captor;
          v.flagTarget = 0.4; // lower the old flag first, then hoist the new
        }
      } else v.flagTarget = this.flagHeight;
    }
    if (instant) v.flagY = v.flagTarget;
    // masts
    const rig = [ship.specs.rig1, ship.specs.rig2, ship.specs.rig3, ship.specs.rig4];
    this.rig.masts.forEach((m, i) => {
      const r = rig[i];
      const max = [ship.max.rig1, ship.max.rig2, ship.max.rig3, ship.max.rig4][i];
      const tear = max > 0 ? Math.max(0, 1 - r / max) : 0;
      m.mat.userData.u.uTear.value = r > 0 ? tear * 0.8 : 0;
      if (r <= 0 && !m.fallen) this.fell(m, instant);
      if (r > 0 && m.fallen) this.jury(m);
    });
    this.rigState = rig;
    // heading/position (only when not animating a path)
    if (!this.path) {
      v.bow = bowWorld(ship.row, ship.col);
      v.yaw = dirYaw(ship.dir || 1);
    }
    if (ship.dir === 0 && instant) {
      v.hidden = true;
      this.root.visible = false;
    }
    this.ship = ship;
  }

  // A mast goes by the board. dir: +1 falls to starboard, -1 to port.
  fell(m, instant = false, dir = 0) {
    m.fallen = true;
    m.fall = instant ? 1 : 0;
    m.fallDir = dir || (Math.random() < 0.5 ? 1 : -1);
    m.fallAxis = Math.random() < 0.35 ? 'x' : 'z';
    if (this.rig.masts.indexOf(m) === 0) this.rig.jibs.forEach((j) => { j.visible = false; });
    this.rig.stays.visible = false; // the stays part with the mast
    if (!m.stump) {
      const h = 2.5 + Math.random() * 4;
      const g = new THREE.CylinderGeometry(m.r0 * 0.8, m.r0, h, 8);
      g.translate(0, h / 2, 0);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        if (pos.getY(i) > h - 0.01) pos.setY(i, h + (Math.random() - 0.5) * 1.4); // splintered top
      }
      m.stump = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#5a412a', roughness: 0.9 }));
      m.stump.castShadow = true;
      m.pivot.parent.add(m.stump);
      m.stump.position.copy(m.pivot.position);
    }
    m.stump.visible = true;
    if (instant) m.body.visible = false;
  }

  // Repairs brought a toppled mast back above 0: a short jury mast.
  jury(m) {
    m.fallen = false;
    m.jury = true;
    m.fall = 0;
    m.body.visible = true;
    m.body.rotation.set(0, 0, 0);
    m.body.scale.setScalar(0.45);
    m.body.position.set(0, 0, 0);
  }

  placeRoot() {
    const v = this.v;
    // bow stays put while the stern swings (rule 1 of the spec)
    const half = this.dimOffset();
    const fx = -Math.sin(v.yaw); // model forward (-z) rotated by yaw
    const fz = -Math.cos(v.yaw);
    this.root.position.set(v.bow.x - fx * half, 0, v.bow.y - fz * half);
    this.root.rotation.y = v.yaw;
  }

  // Distance from the bow square's centre to the model origin: half a cell,
  // or half a diagonal.
  dimOffset() {
    // 1 on the orthogonals, sqrt 2 on the diagonals, smooth in between turns
    return (1 + (Math.SQRT2 - 1) * Math.abs(Math.sin(2 * this.v.yaw))) * CELL * 0.5;
  }

  // Animate along the engine's step poses (from a 'move' event).
  followPath(poses, dur) {
    if (!poses || poses.length < 2) return;
    this.path = { poses, t: 0, dur: Math.max(0.2, dur) };
  }

  addHit(localPoint, radius) {
    this.hits.push(new THREE.Vector4(localPoint.x, localPoint.y, localPoint.z, radius));
    if (this.hits.length > MAX_HITS) this.hits.shift();
    const arr = this.hull.hullMat.userData.u.uHits.value;
    for (let i = 0; i < MAX_HITS; i++) {
      const h = this.hits[i];
      if (h) arr[i].copy(h);
      else arr[i].set(0, -999, 0, 0);
    }
  }

  // Muzzles on one side, in world space: [{ pos, dir, deck, u }]
  muzzles(side) {
    const out = [];
    this.body.updateMatrixWorld(true);
    const m = this.body.matrixWorld;
    const out1 = new THREE.Vector3(side === 'R' ? 1 : -1, 0, 0).transformDirection(m);
    for (const mz of this.hull.muzzles) {
      if (mz.side !== side) continue;
      if (this.lowerClosed && mz.deck === 0 && this.dim.decks > 1) continue;
      out.push({ pos: mz.pos.clone().applyMatrix4(m), dir: out1.clone(), deck: mz.deck, u: mz.u });
    }
    return out;
  }

  // World point on this ship's side facing `from` (for hit effects).
  hitPoint(fromWorld, rng = Math.random) {
    this.body.updateMatrixWorld(true);
    const inv = this.body.matrixWorld.clone().invert();
    const local = fromWorld.clone().applyMatrix4(inv);
    const side = local.x >= 0 ? 1 : -1;
    const u = 0.1 + rng() * 0.8;
    const f = this.hull.form;
    const y = 0.8 + rng() * (f.top(u) - 1.5);
    const b = f.bottom(u);
    const s = f.section(u, (y - b) / (f.top(u) - b));
    const lp = new THREE.Vector3(side * s.x, y, f.zOf(u));
    return { local: lp, world: lp.clone().applyMatrix4(this.body.matrixWorld) };
  }

  // A random point on the burning deck (flames rise from hatches and waist).
  firePoint() {
    const u = 0.18 + Math.random() * 0.64;
    const f = this.hull.form;
    const x = (Math.random() - 0.5) * this.hull.deckX(u) * 1.4;
    this.body.updateMatrixWorld(true);
    return new THREE.Vector3(x, this.hull.deckY(u) + 1.2, f.zOf(u)).applyMatrix4(this.body.matrixWorld);
  }

  worldAnchor(yOffset = 0) {
    this.body.updateMatrixWorld(true);
    return new THREE.Vector3(0, yOffset, 0).applyMatrix4(this.body.matrixWorld);
  }

  update(dt, time, world, windVec, windSpeed, stormGlow) {
    const v = this.v;
    if (v.hidden) return;
    // --- movement along the path ----------------------------------------------
    let moving = 0;
    if (this.path) {
      const p = this.path;
      p.t += dt;
      const n = p.poses.length - 1;
      const x = Math.min(1, p.t / p.dur) * n;
      const i = Math.min(n - 1, Math.floor(x));
      const f = ease(x - i);
      const a = p.poses[i];
      const b = p.poses[i + 1];
      const ba = bowWorld(a.row, a.col);
      const bb = bowWorld(b.row, b.col);
      v.bow.set(ba.x + (bb.x - ba.x) * f, ba.y + (bb.y - ba.y) * f);
      const ya = dirYaw(a.dir);
      let yb = dirYaw(b.dir);
      while (yb - ya > Math.PI) yb -= Math.PI * 2;
      while (yb - ya < -Math.PI) yb += Math.PI * 2;
      v.yaw = ya + (yb - ya) * f;
      moving = ba.distanceTo(bb) > 0 ? 1 : 0.3;
      if (p.t >= p.dur) {
        const last = p.poses[n];
        v.bow = bowWorld(last.row, last.col);
        v.yaw = dirYaw(last.dir);
        this.path = null;
      }
    }
    v.speed += ((moving ? 0.35 + 0.1 * windSpeed : 0.08 + 0.02 * windSpeed) - v.speed) * Math.min(1, dt * 1.2);
    this.placeRoot();

    // --- sails: battle <-> full ---------------------------------------------------
    v.full += (v.fullTarget - v.full) * Math.min(1, dt * 0.9);
    for (const m of this.rig.masts) {
      for (const s of m.sails) {
        const want = s.when === 'battle' ? 1 : v.full;
        const shown = Math.max(0.02, want);
        s.mesh.scale.y = shown;
        s.mesh.visible = shown > 0.03 && !(this.ship && this.ship.struck && s.when === 'full');
        if (s.bundle) s.bundle.visible = shown < 0.6;
      }
    }

    // --- wind on the rig -----------------------------------------------------------
    const fwd = new THREE.Vector2(-Math.sin(v.yaw), -Math.cos(v.yaw));
    const stb = new THREE.Vector2(Math.cos(v.yaw), -Math.sin(v.yaw));
    const rel = Math.atan2(windVec.dot(stb), windVec.dot(fwd));
    trimSails(this.rig, rel, windSpeed, time, { glow: stormGlow });
    const sailFactor = 0.45 + 0.55 * v.full;
    const heelTarget = windSpeed > 0 ? -Math.sign(rel) * Math.min(0.17, windSpeed * 0.022 * sailFactor * Math.abs(Math.sin(rel)) + 0.01) : 0;
    v.heel += (heelTarget - v.heel) * Math.min(1, dt * 0.5);
    for (const fl of [this.flag, this.pennant]) {
      fl.material.userData.u && (fl.material.userData.u.uTime.value = time + this.index);
      fl.material.userData.u && (fl.material.userData.u.uWave.value = Math.min(1.5, windSpeed / 4));
    }
    // flags stream downwind: turn the flag's +x (its fly) onto the wind's
    // travel direction expressed in ship-local axes
    const windLocal = Math.atan2(windVec.dot(fwd), windVec.dot(stb));
    this.flagStaff.rotation.y = windLocal;
    this.pennant.rotation.y = windLocal;

    // --- colours up/down --------------------------------------------------------------
    v.flagY += Math.sign(v.flagTarget - v.flagY) * Math.min(Math.abs(v.flagTarget - v.flagY), dt * 2.2);
    if (v.pendingNation !== undefined && Math.abs(v.flagY - v.flagTarget) < 0.01) {
      this.setFlagNation(v.pendingNation);
      v.pendingNation = undefined;
      v.flagTarget = this.flagHeight;
    }
    this.flag.position.y = v.flagY;
    this.flag.visible = v.flagY > 0.5 || v.pendingNation !== undefined;

    // --- masts going by the board -------------------------------------------------------
    for (const m of this.rig.masts) {
      if (!m.fallen || !m.body.visible) continue;
      if (m.fall < 1) {
        m.fall = Math.min(1, m.fall + dt * 0.42);
        const k = m.fall * m.fall; // accelerate like a falling tree
        if (m.fallAxis === 'x') m.body.rotation.x = k * 1.5 * m.fallDir;
        else m.body.rotation.z = -k * 1.45 * m.fallDir;
        m.body.position.y = -k * 1.5;
      } else {
        m.drift = (m.drift || 0) + dt;
        m.body.position.y -= dt * 0.8; // wreckage settling alongside
        if (m.drift > 9) m.body.visible = false; // cut away
      }
    }

    // --- buoyancy ---------------------------------------------------------------------------
    const cx = this.root.position.x;
    const cz = this.root.position.z;
    const hl = this.L * 0.38;
    const hb = this.B * 0.45;
    const hBow = world.waterHeight(cx + fwd.x * hl, cz + fwd.y * hl);
    const hStern = world.waterHeight(cx - fwd.x * hl, cz - fwd.y * hl);
    const hStb = world.waterHeight(cx + stb.x * hb, cz + stb.y * hb);
    const hPort = world.waterHeight(cx - stb.x * hb, cz - stb.y * hb);
    const hMid = world.waterHeight(cx, cz);
    const heave = (hBow + hStern + hStb + hPort + hMid * 2) / 6;
    const pitch = Math.atan2(hBow - hStern, hl * 2) * 0.85;
    const roll = Math.atan2(hPort - hStb, hb * 2) * 0.7;
    // a heavy hull responds like a damped spring
    const k = 7;
    const c = 3.2;
    v.heaveV += ((heave - v.heave) * k - v.heaveV * c) * dt;
    v.heave += v.heaveV * dt;
    v.pitchV += ((pitch - v.pitch) * k - v.pitchV * c) * dt;
    v.pitch += v.pitchV * dt;
    v.rollV += ((roll - v.roll) * k * 0.8 - v.rollV * c * 0.8) * dt;
    v.roll += v.rollV * dt;
    v.list += (v.listTarget - v.list) * Math.min(1, dt * 0.25);
    // a foundering hulk settles
    if (this.ship && this.ship.sink === 1) v.sink = Math.min(1, v.sink + dt * 0.03);
    let sinkY = -v.sink * 2.2;
    let plungePitch = 0;
    if (v.plunge >= 0) {
      v.plunge += dt / 9;
      const p = Math.min(1, v.plunge);
      sinkY -= p * p * (this.dim.F + this.dim.D + 25);
      plungePitch = p * 0.45 * (this.index % 2 ? 1 : -1);
      if (v.plunge >= 1) {
        v.hidden = true;
        this.root.visible = false;
      }
    }
    this.body.position.y = v.heave + sinkY;
    // +x rotation lifts the bow (-z); +z rotation lifts the starboard side
    this.body.rotation.set(v.pitch + plungePitch, 0, -v.roll + v.heel + v.list * (this.index % 2 ? 1 : -1), 'YXZ');

    // --- hull wear and fire ----------------------------------------------------------------
    v.burn += (v.burnTarget - v.burn) * Math.min(1, dt * 0.5);
    const hu = this.hull.hullMat.userData.u;
    hu.uSoot.value = v.soot + v.burn * 0.4;
    hu.uBurn.value = v.burn;
    hu.uTime.value = time;
    for (const m of this.rig.masts) m.mat.userData.u.uSoot.value = v.soot * 0.5 + v.burn * 0.5;
  }

  setLowerPortsClosed(closed) {
    if (this.lowerClosed === closed) return;
    this.lowerClosed = closed;
    // two- and three-deckers shut the lowest tier in heavy seas
    setPorts(this.hull, closed && this.dim.decks > 1 ? new Set([0]) : new Set());
  }

  startPlunge() { if (this.v.plunge < 0) this.v.plunge = 0; }

  explodeNow() {
    this.v.exploded = true;
    this.v.hidden = true;
    this.root.visible = false;
  }
}
