// Fleet: the ShipVisuals for a battle, plus the cinematic that plays one
// turn's engine events as timed beats. The engine has already decided
// everything; this file only decides WHEN and HOW each consequence is shown.

import * as THREE from 'three';
import { ShipVisual, poseToWorld } from './ship.js';
import { lowerPortsClosed } from '../engine/index.js';
import { CELL } from './world.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

export class Fleet {
  constructor(world, fx, audio) {
    this.world = world;
    this.fx = fx;
    this.audio = audio;
    this.visuals = [];
    this.display = null; // the state as currently SHOWN (lags the engine during a cinematic)
    this.queue = []; // pending timed actions
    this.fxq = []; // cosmetic effects on the cinematic clock (dropped on skip)
    this.fxClock = 0;
    this.clock = 0;
    this.playing = false;
    this.onBeat = null; // (beat) => camera director hook
    this.onDone = null;
  }

  load(st) {
    for (const v of this.visuals) this.world.scene.remove(v.root);
    this.visuals = st.ships.map((sp) => {
      const v = new ShipVisual(sp, st);
      this.world.scene.add(v.root);
      return v;
    });
    this.display = clone(st);
    this.syncAll(true);
  }

  syncAll(instant = false) {
    const st = this.display;
    this.visuals.forEach((v, i) => {
      v.sync(st.ships[i], st, instant);
      v.setLowerPortsClosed(lowerPortsClosed(st.ships[i].specs.class, st.windspeed));
      const sp = st.ships[i];
      this.fx.setFire(i, () => v.firePoint(), sp.explode === 1 && sp.dir !== 0 ? 1 : 0);
    });
  }

  at(t, fn, beat = null) {
    this.queue.push({ t, fn, beat });
  }

  // Build the timeline for one turn. Returns total duration (s).
  play(events, finalState, { reduced = false, speed = 1 } = {}) {
    const disp = this.display;
    const q = [];
    let t = 0.25;
    const k = reduced ? 0.6 : 1;
    const fires = { player: [], driver: [] };
    let moveEv = null;
    for (const e of events) {
      if (e.t === 'fire') (e.phase === 'player' ? fires.player : fires.driver).push(e);
      if (e.t === 'move') moveEv = e;
    }
    // --- 1. the humans' broadsides (fired at pre-move positions) -------------
    t = this.scheduleFires(fires.player, t, k, 'player');
    // --- 2. burning / sinking hulks finish their fate ------------------------
    for (const e of events.filter((x) => x.t === 'sink' || x.t === 'explode')) {
      const v = this.visuals[e.ship];
      this.at(t, () => {
        if (e.t === 'sink') {
          v.startPlunge();
          this.fx.founder(v.root.position);
          this.audio?.founder(v.root.position);
        } else {
          const p = v.worldAnchor(4);
          this.fx.explosion(p, v.L / 50);
          this.audio?.explosion(p);
          v.explodeNow();
        }
        disp.ships[e.ship].dir = 0;
        this.fx.setFire(e.ship, null, 0);
      }, { kind: e.t, ship: e.ship });
      t += e.t === 'sink' ? 4.5 * k : 3.2 * k;
    }
    for (const e of events.filter((x) => x.t === 'blast')) {
      this.at(t - 2.5 * k, () => this.applyDamage(e.to, e.damage, null));
    }
    // --- 3. weather ------------------------------------------------------------
    for (const e of events.filter((x) => x.t === 'wind')) {
      this.at(t, () => {
        disp.winddir = e.dir;
        disp.windspeed = e.speed;
        this.world.setWind(e.speed, e.dir);
        this.visuals.forEach((v, i) => v.setLowerPortsClosed(lowerPortsClosed(disp.ships[i].specs.class, e.speed)));
      }, { kind: 'wind', e });
      t += 1.4 * k;
    }
    // --- 4. sail changes and movement --------------------------------------------
    for (const e of events.filter((x) => x.t === 'sails' && x.phase !== 'end')) {
      this.at(t, () => { disp.ships[e.ship].FS = e.full ? 2 : 0; this.visuals[e.ship].sync(disp.ships[e.ship], disp); });
    }
    if (moveEv) {
      const paths = moveEv.paths;
      const maxSteps = Math.max(1, ...Object.values(paths).map((p) => p.length - 1));
      const dur = Math.min(5.5, 1.6 + maxSteps * 0.8) * k;
      this.at(t, () => {
        for (const [i, poses] of Object.entries(paths)) {
          this.visuals[+i].followPath(poses, dur);
          const last = poses[poses.length - 1];
          Object.assign(disp.ships[+i], { row: last.row, col: last.col, dir: last.dir });
        }
        this.audio?.creak();
      }, { kind: 'move', dur, ships: Object.keys(paths).map(Number) });
      for (const e of events.filter((x) => x.t === 'collision' || x.t === 'foul')) {
        this.at(t + dur * 0.8, () => this.audio?.creak(true), { kind: e.t, a: e.a, b: e.b });
      }
      t += dur + 0.2;
    }
    // --- 5. grapples and boarders ---------------------------------------------------
    const boardish = events.filter((x) => ['grapple', 'ungrapple', 'unfoul', 'board', 'repel'].includes(x.t));
    if (boardish.length) {
      this.at(t, () => {}, { kind: 'grapple', e: boardish[0] });
      t += 1.2 * k;
    }
    // --- 6. the computer's broadsides (after moving) ----------------------------------
    t = this.scheduleFires(fires.driver, t, k, 'driver');
    // --- 7. melee and captures ---------------------------------------------------------
    for (const e of events.filter((x) => x.t === 'melee')) {
      this.at(t, () => {
        const a = this.visuals[e.a];
        const b = this.visuals[e.b];
        const mid = a.root.position.clone().lerp(b.root.position, 0.5).setY(8);
        for (let i = 0; i < 6; i++) this.later(() => this.fx.muzzle(mid.clone().add(new THREE.Vector3((Math.random() - 0.5) * 20, 0, (Math.random() - 0.5) * 20)), new THREE.Vector3(Math.random() - 0.5, 0.3, Math.random() - 0.5), { big: 0.25 }), i * 180);
        this.audio?.melee(mid);
      }, { kind: 'melee', e });
      t += 1.6 * k;
    }
    for (const e of events.filter((x) => x.t === 'capture' || x.t === 'overthrown')) {
      this.at(t, () => {
        const sp = finalState.ships[e.ship];
        Object.assign(disp.ships[e.ship], { captured: sp.captured, pcrew: sp.pcrew });
        this.visuals[e.ship].sync(disp.ships[e.ship], disp);
      }, { kind: e.t, e });
      t += 1.5 * k;
    }
    // --- 8. settle into the final state ---------------------------------------------------
    this.at(t + 0.1, () => {
      this.display = clone(finalState);
      this.syncAll(false);
    });
    this.total = t + 0.4;
    this.clock = 0;
    this.playing = true;
    this.speed = speed;
    return this.total;
  }

  // Broadsides of one phase: ripple each ship's guns, then the impacts.
  scheduleFires(list, t, k, phase) {
    if (!list.length) return t;
    // group by firing ship; computer ships fire in a quick staccato
    const byShip = new Map();
    for (const e of list) {
      if (!byShip.has(e.from)) byShip.set(e.from, []);
      byShip.get(e.from).push(e);
    }
    const groups = [...byShip.values()];
    for (const g of groups) {
      for (const e of g) {
        const flight = Math.min(1.2, 0.25 + e.range * CELL / 480);
        const ripple = 1.3 * k;
        this.at(t, () => this.fireRipple(e, ripple), { kind: e.rake ? 'rake' : 'broadside', e, phase, dur: ripple + flight + 0.8 });
        this.at(t + ripple * 0.35 + flight, () => this.impact(e), null);
        this.at(t + ripple * 0.5 + flight + 0.3, () => this.applyDamage(e.to, e.damage, e), null);
        t += (phase === 'driver' && groups.length > 2 ? 1.1 : ripple + flight + 0.9) * k;
      }
    }
    return t + 0.4 * k;
  }

  fireRipple(e, dur) {
    const v = this.visuals[e.from];
    const muzzles = v.muzzles(e.side);
    // guns fire from bow to stern along each deck in a rolling broadside
    muzzles.sort((a, b) => b.u - a.u || a.deck - b.deck);
    const n = muzzles.length;
    const shots = Math.max(1, Math.min(n, Math.round((e.guns + e.car) / 2 + 2)));
    const step = Math.max(1, Math.floor(n / shots));
    let fired = 0;
    for (let i = 0; i < n; i += step) {
      const m = muzzles[i];
      const delay = (i / n) * dur * 1000;
      this.later(() => {
        const pos = v.muzzles(e.side)[Math.min(i, n - 1)]?.pos || m.pos;
        this.fx.muzzle(pos, m.dir, { big: e.load === 4 ? 1.25 : 1 });
        if (fired++ % 3 === 0) this.fx.flashLight(pos, 1);
        this.audio?.cannon(pos, e.load);
      }, delay);
    }
  }

  impact(e) {
    const from = this.visuals[e.from];
    const to = this.visuals[e.to];
    const src = from.root.position;
    if (e.miss || !e.damage) {
      // shot falls short or goes over: a line of splashes near the target
      for (let i = 0; i < 6; i++) {
        this.later(() => {
          const p = to.root.position.clone().lerp(src, 0.08 + Math.random() * 0.25);
          p.x += (Math.random() - 0.5) * 30;
          p.z += (Math.random() - 0.5) * 30;
          this.fx.splash(p, 0.9 + Math.random() * 0.5);
          this.audio?.splash(p);
        }, i * 90);
      }
      return;
    }
    const d = e.damage;
    const hullHit = d.before.hull - d.after.hull + (d.before.gunL + d.before.gunR - d.after.gunL - d.after.gunR);
    const rigHit = d.before.rig.reduce((a, b) => a + Math.max(0, b), 0) - d.after.rig.reduce((a, b) => a + Math.max(0, b), 0);
    const nHull = Math.min(6, 1 + hullHit);
    for (let i = 0; i < nHull; i++) {
      this.later(() => {
        const hp = to.hitPoint(src);
        const nrm = hp.world.clone().sub(to.root.position).setY(0).normalize();
        this.fx.impact(hp.world, nrm, 0.8 + hullHit * 0.1);
        if (e.aim === 'hull' || hullHit > 0) to.addHit(hp.local, 0.9 + Math.random() * 0.8);
        this.audio?.impact(hp.world);
      }, i * 110);
    }
    if (rigHit > 0 || e.load === 2) {
      for (const m of to.rig.masts) {
        const p = to.worldAnchor(m.H * 0.6);
        p.add(new THREE.Vector3(0, 0, 0));
        this.fx.shreds(p, e.load === 2 ? 1.4 : 0.6);
      }
    }
    // a few overs splash beyond
    for (let i = 0; i < 3; i++) {
      const p = to.root.position.clone().add(to.root.position.clone().sub(src).setY(0).normalize().multiplyScalar(20 + Math.random() * 40));
      p.x += (Math.random() - 0.5) * 25;
      p.z += (Math.random() - 0.5) * 25;
      this.later(() => this.fx.splash(p, 0.8), 150 + i * 120);
    }
  }

  applyDamage(index, damage, e) {
    if (!damage) return;
    const disp = this.display;
    const sp = disp.ships[index];
    const a = damage.after;
    Object.assign(sp.specs, {
      hull: a.hull, crew1: a.crew[0], crew2: a.crew[1], crew3: a.crew[2],
      rig1: a.rig[0], rig2: a.rig[1], rig3: a.rig[2], rig4: a.rig[3],
      gunL: a.gunL, gunR: a.gunR, carL: a.carL, carR: a.carR,
    });
    if (damage.struck) {
      sp.struck = 1;
      if (damage.struck === 'sink') sp.sink = 1;
      if (damage.struck === 'fire') sp.explode = 1;
      this.audio?.bell();
    }
    const v = this.visuals[index];
    v.sync(sp, disp);
    this.fx.setFire(index, () => v.firePoint(), sp.explode === 1 ? 1 : 0);
  }

  // Skip the rest of the cinematic: run every pending action now.
  // Run fn after ms of cinematic time (so skipping cancels it and the
  // reduced-motion speed-up applies), instead of wall-clock setTimeout.
  later(fn, ms) {
    this.fxq.push({ t: this.fxClock + ms / 1000, fn });
  }

  finish() {
    this.fxq = [];
    this.queue.sort((x, y) => x.t - y.t);
    for (const a of this.queue) a.fn();
    this.queue = [];
    for (const v of this.visuals) {
      if (v.path) v.path.t = v.path.dur;
    }
    this.playing = false;
    if (this.onDone) this.onDone();
  }

  update(dt, time, windVec, windSpeed, stormGlow) {
    this.fxClock = (this.fxClock || 0) + dt * (this.speed || 1);
    for (let i = this.fxq.length - 1; i >= 0; i--) {
      if (this.fxq[i].t <= this.fxClock) {
        const f = this.fxq[i].fn;
        this.fxq.splice(i, 1);
        f();
      }
    }
    if (this.playing) {
      this.clock += dt * (this.speed || 1);
      this.queue.sort((x, y) => x.t - y.t);
      while (this.queue.length && this.queue[0].t <= this.clock) {
        const a = this.queue.shift();
        a.fn();
        if (a.beat && this.onBeat) this.onBeat(a.beat);
      }
      if (!this.queue.length && this.clock >= this.total) {
        this.playing = false;
        if (this.onDone) this.onDone();
      }
    }
    const wakes = [];
    for (const v of this.visuals) {
      v.update(dt, time, this.world, windVec, windSpeed, stormGlow);
      if (!v.v.hidden) {
        wakes.push({
          x: v.root.position.x, z: v.root.position.z, heading: -v.root.rotation.y, speed: v.v.speed,
          halfLength: v.L * 0.5, halfBeam: v.B * 0.5, fire: v.v.burn, sinking: v.v.plunge >= 0 ? 1 : v.v.sink,
        });
      }
    }
    this.world.ocean.setWakes(wakes);
  }

  // Centre of all active ships (for establishing shots).
  centroid() {
    const c = new THREE.Vector3();
    let n = 0;
    for (const v of this.visuals) {
      if (v.v.hidden) continue;
      c.add(v.root.position);
      n++;
    }
    return n ? c.multiplyScalar(1 / n) : c;
  }

  extent() {
    const c = this.centroid();
    let r = 60;
    for (const v of this.visuals) if (!v.v.hidden) r = Math.max(r, v.root.position.distanceTo(c) + v.L);
    return { center: c, radius: r };
  }
}

export { poseToWorld };
