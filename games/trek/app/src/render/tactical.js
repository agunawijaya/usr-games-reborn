// trek/procedural-web — the tactical view: one quadrant, 10×10 sectors.
//
// World frame: sector (sx, sy) sits at x = sx − 4.5, z = sy − 4.5, y up.
// North (sy − 1) is −z, which the tilted camera shows as "up", so the
// clock-face bearings of the typed commands read exactly as in the painted
// port (0 = east/right, 3 = north/up).
//
// The engine is turn-based and mutates state instantly; this module turns
// each command's effect list into a short, choreographed shot (turn →
// fire → impact → explode, then the Klingons' return fire), keeping dying
// ships on screen until their explosion swallows them.

import * as THREE from 'three';
import { QUADRANT_SIZE, CELL } from '../galaxy.js';
import { buildShip } from './ships.js';
import { buildStarbase } from './starbase.js';
import { ShieldBubble } from './shield.js';
import { Star, spectralFor } from './star.js';
import { FX } from './fx.js';
import { hashInts } from './rng.js';

const HALF = (QUADRANT_SIZE - 1) / 2;   // 4.5
export const cellToWorld = (sx, sy, y = 0, out = new THREE.Vector3()) => out.set(sx - HALF, y, sy - HALF);

/** Heading angle (rotation.y) that points the bow (+X) along world (dx, dz). */
const headingFor = (dx, dz) => Math.atan2(-dz, dx);
/** Clock bearing (0=E, 3=N) → world direction. */
const bearingDir = (b) => {
  const a = (b / 12) * Math.PI * 2;
  return new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
};
const angleDiff = (a, b) => ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
const lerpAngle = (a, b, k) => a + angleDiff(a, b) * k;
const ease = (k) => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);

const ENEMY_SCALE = { warship: 1.0, battlecruiser: 1.0, super: 1.0, warbird: 1.0 };
const BOOM = { warship: 1.0, warbird: 1.15, battlecruiser: 1.3, super: 1.75 };
const DEBRIS_TINT = { warship: 0x5a524c, battlecruiser: 0x5a524c, super: 0x5a524c, warbird: 0x2f5a52 };

export class Tactical {
  constructor(renderer, profile, nebula, post) {
    this.renderer = renderer;
    this.profile = profile;
    this.nebula = nebula;
    this.post = post;
    this.scene = new THREE.Scene();
    this.scene.add(nebula.backgroundMesh);
    this.distortScene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 400);
    this.fx = new FX(this.scene, this.distortScene, profile);
    this.reduced = false;
    this.world = new THREE.Group();
    this.scene.add(this.world);

    // Lights — fixed count (no shader recompiles when quadrants change).
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x101018, 0.8);
    this.key = new THREE.DirectionalLight(0xffffff, 2.4);
    this.rim = new THREE.DirectionalLight(0x88aaff, 0.55);
    this.scene.add(this.hemi, this.key, this.key.target, this.rim, this.rim.target);
    this.starLights = [0, 1, 2].map(() => {
      const l = new THREE.PointLight(0xffffff, 0, 8, 1.3);
      this.scene.add(l);
      return l;
    });

    this.applyProfile(profile);
    this.grid = this._makeGrid();
    this.scene.add(this.grid);

    this.player = null;        // { model, shield, sx, sy, heading, glide }
    this.klingons = new Map(); // id → { model, shield, sx, sy, type, doomed }
    this.starbase = null;      // { model, sx, sy, doomed }
    this.stars = [];           // { star, sx, sy, light }
    this.quadKey = null;
    this.warp = null;
    this.drift = new THREE.Vector2();
    this.view = { W: 1, H: 1, cssW: 1, cssH: 1 };
    this.camBase = new THREE.Vector3();
    this.camTarget = new THREE.Vector3();
    this.time = 0;
    this.lastFlares = [];
  }

  /** Point lights cost per pixel on every lit hull; Lite drops them (the
   *  light count changes, so materials recompile once, on switch). */
  applyProfile(profile) {
    this.profile = profile;
    const on = profile.pointLights !== false;
    for (const l of this.starLights) l.visible = on;
    for (const L of this.fx?.lights ?? []) L.l.visible = on;
  }

  // -------------------------------------------------------------------------
  // Camera: fit the grid to the same screen rectangle the painted port uses.
  // -------------------------------------------------------------------------

  /** @param W,H drawing-buffer px; cssW, cssH layout px */
  resize(W, H, cssW, cssH) {
    this.view = { W, H, cssW, cssH };
    const cam = this.camera;
    cam.aspect = cssW / cssH;
    cam.clearViewOffset();
    // Target rect (CSS px) — identical formula to fancy-web's renderCombat().
    const cell = Math.min(cssW - 200, cssH - 400) / QUADRANT_SIZE;
    const gridPx = cell * QUADRANT_SIZE;
    const cy = cssH / 2 - 40;
    const tilt = THREE.MathUtils.degToRad(this.showcase ? 42 : 20);
    let dist = 30;
    for (let i = 0; i < 6; i++) {
      cam.position.set(0, Math.cos(tilt) * dist, Math.sin(tilt) * dist);
      cam.lookAt(0, 0, 0);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
      const top = new THREE.Vector3(0, 0, -HALF - 0.5).project(cam);
      const bot = new THREE.Vector3(0, 0, HALF + 0.5).project(cam);
      const hPx = (top.y - bot.y) * 0.5 * cssH;
      dist *= hPx / gridPx;
    }
    if (this.showcase) dist *= 0.62;
    cam.position.set(0, Math.cos(tilt) * dist, Math.sin(tilt) * dist);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    const top = new THREE.Vector3(0, 0, -HALF - 0.5).project(cam);
    const bot = new THREE.Vector3(0, 0, HALF + 0.5).project(cam);
    const midY = ((1 - (top.y + bot.y) / 2) / 2) * cssH;   // current centre (CSS px from top)
    const offY = this.showcase ? 0 : midY - cy;
    cam.setViewOffset(cssW, cssH, 0, offY, cssW, cssH);
    cam.updateProjectionMatrix();
    this.camBase.copy(cam.position);
    this.cellPx = cell;
  }

  _makeGrid() {
    const pts = [];
    const e = HALF + 0.5;
    for (let i = 0; i <= QUADRANT_SIZE; i++) {
      const v = i - e;
      pts.push(v, 0, -e, v, 0, e, -e, 0, v, e, 0, v);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const m = new THREE.ShaderMaterial({
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uAlpha; varying vec3 vP;
        void main(){ float edge = max(abs(vP.x), abs(vP.z)); float border = step(${(e - 0.01).toFixed(2)}, edge);
          gl_FragColor = vec4(vec3(0.35,0.75,1.0) * uAlpha * (0.45 + border * 1.1), 1.0); }`,
      uniforms: { uAlpha: { value: 0.045 } },
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    });
    const lines = new THREE.LineSegments(g, m);
    lines.position.y = -0.3;
    lines.renderOrder = -10;
    return lines;
  }

  // -------------------------------------------------------------------------
  // Building the quadrant
  // -------------------------------------------------------------------------

  _clearQuadrant() {
    for (const k of this.klingons.values()) { this.world.remove(k.model.root); k.model.dispose(); k.shield.dispose(); }
    this.klingons.clear();
    if (this.starbase) { this.world.remove(this.starbase.model.root); this.starbase.model.dispose(); this.starbase = null; }
    for (const s of this.stars) { this.world.remove(s.star.group); s.star.dispose(); }
    this.stars = [];
    for (const l of this.starLights) l.intensity = 0;
  }

  /** Rebuild everything for the snapshot's quadrant (warp arrival, new game). */
  enterQuadrant(snap) {
    const { qx, qy, contents } = snap.quadrant;
    this._clearQuadrant();
    this.fx.clear();
    this.quadKey = `${qx},${qy}`;
    const P = this.nebula.bake(qx, qy);
    this._setLights(P);
    if (this.nebula.envMap) this.scene.environment = this.nebula.envMap;
    else this.scene.environment = null;

    // Stars.
    contents.stars.forEach((s, i) => {
      const spec = spectralFor(qx, qy, s.sx, s.sy);
      const star = new Star(spec, hashInts(qx, qy, s.sx, s.sy) % 997, 0.2 + (hashInts(s.sx, s.sy, 3) % 100) / 1000);
      cellToWorld(s.sx, s.sy, 0, star.group.position);
      this.world.add(star.group);
      const light = this.starLights[i] ?? null;
      if (light) {
        light.color.setRGB(...spec.color);
        light.intensity = 7;
        cellToWorld(s.sx, s.sy, 0.6, light.position);
      }
      this.stars.push({ star, sx: s.sx, sy: s.sy, light, spec });
    });

    // Starbase.
    if (contents.starbase) {
      const model = buildStarbase({ anisotropy: this.profile.anisotropy, seed: hashInts(qx, qy) % 1000 });
      cellToWorld(contents.starbase.sx, contents.starbase.sy, -0.3, model.root.position);
      model.root.rotation.y = (hashInts(qx, qy, 5) % 628) / 100;
      this.world.add(model.root);
      this.starbase = { model, sx: contents.starbase.sx, sy: contents.starbase.sy, doomed: false };
    }

    // Player.
    if (!this.player) {
      const model = buildShip('player', { id: 'enterprise', anisotropy: this.profile.anisotropy });
      const shield = new ShieldBubble(new THREE.Vector3(model.halfLength * 1.12, model.halfHeight * 2.0 + 0.12, model.halfSpan * 1.3), 0x7cc4ff);
      model.body.add(shield.mesh);
      this.world.add(model.root);
      this.player = { model, shield, sx: 0, sy: 0, heading: 0, targetHeading: 0, turn: null, glide: null, offset: new THREE.Vector3(), stretch: 1 };
    }
    const pl = this.player;
    pl.sx = snap.ship.sx; pl.sy = snap.ship.sy;
    pl.glide = null;
    cellToWorld(pl.sx, pl.sy, 0, pl.model.root.position);
    pl.offset.set(0, 0, 0);
    pl.shield.setUp(snap.ship.shieldsUp);
    this.syncKlingons(snap);
    this.sync(snap);
  }

  _setLights(P) {
    const pal = P.palette;
    this.hemi.color.set(pal.gas[2]).lerp(new THREE.Color(0xffffff), 0.55);
    this.hemi.groundColor.set(pal.gas[0]);
    this.hemi.intensity = 0.95;
    this.key.color.set(P.keyColor);
    this.key.intensity = 3.2;
    this.key.position.copy(P.keyDir).multiplyScalar(20);
    this.rim.color.set(pal.gas[2]).lerp(new THREE.Color(0xaaccff), 0.6);
    this.rim.intensity = 1.3;
    this.rim.position.set(-P.keyDir.x * 20, 5, -P.keyDir.z * 20);
  }

  _newKlingon(k) {
    const type = k.type || 'warship';
    const model = buildShip(type, { id: k.id, anisotropy: this.profile.anisotropy });
    model.root.scale.setScalar(ENEMY_SCALE[type] ?? 1);
    const tint = type === 'warbird' ? 0x40ffc8 : 0xff7040;
    const shield = new ShieldBubble(new THREE.Vector3(model.halfLength * 1.12, model.halfHeight * 2.2 + 0.12, model.halfSpan * 1.22), tint, { hexScale: 5 });
    shield.setUp(true, 0.035);
    model.body.add(shield.mesh);
    cellToWorld(k.sx, k.sy, 0, model.root.position);
    this.world.add(model.root);
    const ent = { model, shield, sx: k.sx, sy: k.sy, type, doomed: false, id: k.id };
    this.klingons.set(k.id, ent);
    return ent;
  }

  /** Add Klingons that appeared, drop ones that vanished without a scene. */
  syncKlingons(snap) {
    const live = new Set();
    for (const k of snap.quadrant.contents.klingons) {
      if (k.destroyed) continue;
      live.add(k.id);
      if (!this.klingons.has(k.id)) this._newKlingon(k);
    }
    for (const [id, ent] of this.klingons) {
      if (!live.has(id) && !ent.doomed) this._removeKlingon(id);
    }
  }

  _removeKlingon(id) {
    const ent = this.klingons.get(id);
    if (!ent) return;
    this.world.remove(ent.model.root);
    ent.model.dispose();
    ent.shield.dispose();
    this.klingons.delete(id);
  }

  /** Light-weight per-command sync (shields, override tint). */
  sync(snap) {
    if (!this.player) return;
    const inv = snap.overrides?.invulnerable;
    this.player.shield.setGold(inv ? 1 : 0);
    this.player.shield.setUp(snap.ship.shieldsUp || inv, inv && !snap.ship.shieldsUp ? 0.16 : 0.22);
    this.hullPct = snap.ship.hull;
    if (`${snap.quadrant.qx},${snap.quadrant.qy}` === this.quadKey && !this.warp) this.syncKlingons(snap);
    if (!snap.quadrant.contents.starbase && this.starbase && !this.starbase.doomed) {
      this.world.remove(this.starbase.model.root);
      this.starbase.model.dispose();
      this.starbase = null;
    }
  }

  // -------------------------------------------------------------------------
  // Choreography
  // -------------------------------------------------------------------------

  /**
   * @param effects   engine effect list
   * @param ctx       { prev: {sx, sy, qx, qy}, getSnap(), audio }
   * @returns seconds until the shot has played out
   */
  play(effects, ctx) {
    this.audio = ctx.audio;
    let end = 0;
    const fire = [];
    for (const e of effects) {
      switch (e.type) {
        case 'phaser': end = Math.max(end, this._phaser(e)); break;
        case 'torpedo': end = Math.max(end, this._torpedo(e)); break;
        case 'impulseMove': end = Math.max(end, this._impulse(ctx.prev, ctx.getSnap())); break;
        case 'warpMove': end = Math.max(end, this._warp(e, ctx)); break;
        case 'dock': end = Math.max(end, this._dock()); break;
        case 'shield': this.audio?.play('shield', { up: e.up }); break;
        case 'lrscan': this._scan(); break;
        case 'srscan': this._srscan(); break;
        case 'resupply': this._resupply(); break;
        case 'klingonFire': fire.push(e); break;
        default: break;
      }
    }
    fire.forEach((e, i) => this.fx.after(end + 0.12 + i * 0.24, () => this._enemyFire(e)));
    return end + fire.length * 0.24 + (fire.length ? 0.5 : 0);
  }

  _playerPos(out = new THREE.Vector3()) {
    return this.player.model.root.getWorldPosition(out);
  }

  /**
   * Start turning the Enterprise onto `heading`. Returns the seconds until
   * the bow is on target: every manoeuvre finishes before the ship fires or
   * moves (about 0.22 s + 0.7 s per 180 degrees, eased in and out).
   */
  _turnTo(heading) {
    const pl = this.player;
    const delta = Math.abs(angleDiff(pl.heading, heading));
    pl.targetHeading = heading;
    if (delta < 0.03) { pl.turn = null; pl.heading = heading; return 0; }
    const dur = this._turnDuration(delta);
    pl.turn = { from: pl.heading, to: heading, t0: this.fx.time, dur, sign: Math.sign(angleDiff(pl.heading, heading)) };
    return dur;
  }

  _turnDuration(delta) {
    return delta < 0.03 ? 0 : (0.22 + (delta / Math.PI) * 0.7) * (this.reduced ? 0.6 : 1);
  }

  _turnPlayerTo(worldPoint) {
    const d = worldPoint.clone().sub(this._playerPos());
    return d.lengthSq() > 1e-6 ? this._turnTo(headingFor(d.x, d.z)) : 0;
  }

  /**
   * Phasers, as in BSD trek's automatic mode (phaser.c): up to six banks
   * fire simultaneously, one bank per Klingon, nearest Klingon first. Each
   * target gets the bank that faces it best, so there is no turn — the
   * whole volley leaves the hull at once, just as every Klingon answers
   * with its own gun in the same turn.
   */
  _phaser(e) {
    if (!e.damages.length) return 0;
    const model = this.player.model;
    const origin = this._playerPos();
    const order = e.damages.slice().sort((a, b) =>
      cellToWorld(a.sx, a.sy).distanceTo(origin) - cellToWorld(b.sx, b.sy).distanceTo(origin));
    const fireAt = 0.12;              // emitters charge for a moment
    const used = new Set();
    this.fx.after(fireAt, () => this.audio?.play('phaser'));
    for (const d of order) {
      const ent = this.klingons.get(d.target);
      const tgt = cellToWorld(d.sx, d.sy, 0.02);
      if (ent && d.destroyed) ent.doomed = true;
      const bi = model.bestBank(tgt, used);
      used.add(bi);
      model.fireBank(bi);
      this.fx.after(fireAt, () => {
        const from = model.bankWorld(bi).pos;
        // Beam lands on the target's shield surface facing the player.
        const dir = from.clone().sub(tgt).setY(0).normalize();
        const r = ent ? Math.min(ent.model.halfLength, ent.model.halfSpan) * 0.9 : 0.4;
        const hitPoint = tgt.clone().addScaledVector(dir, r);
        this.fx.phaser(from, hitPoint, {
          dur: 0.8,
          // The beam stays attached to its bank while the hull bobs.
          source: () => model.bankWorld(bi).pos,
          onImpact: () => ent?.shield.hit(hitPoint.clone().addScaledVector(dir, 1), d.destroyed ? 1.5 : 1.0),
        });
      });
      if (ent && d.destroyed) this._destroy(ent, fireAt + 0.48);
    }
    return fireAt + 0.96;
  }

  _destroy(ent, at) {
    const model = ent.model;
    const start = this.fx.time + at - 0.3;
    this.fx.items.push({
      update: (t) => { const k = (t - start) / 0.3; if (k > 0) model.setHeat(Math.min(1, k)); return k < 1; },
      dispose: () => {},
    });
    this.fx.after(at, () => {
      const p = model.root.getWorldPosition(new THREE.Vector3());
      const s = BOOM[ent.type] ?? 1;
      this.fx.explosion(p, s, { tint: DEBRIS_TINT[ent.type] });
      this.audio?.play('explosion', { size: s });
      this._removeKlingon(ent.id);
    });
  }

  _torpedo(e) {
    const dir = bearingDir(e.bearing);
    const p0 = this._playerPos();
    const launchAt = this._turnTo(headingFor(dir.x, dir.z)) + 0.05;
    const pts = [];
    // Mark the victim now: sync() runs right after play() and would
    // otherwise remove a destroyed Klingon before the torpedo reaches it.
    const ent = e.destroyedKlingon ? [...this.klingons.values()].find(k => k.sx === e.destroyedKlingon.sx && k.sy === e.destroyedKlingon.sy) : null;
    if (ent) ent.doomed = true;
    if (e.hit && e.hit.cell === CELL.STARBASE && this.starbase) this.starbase.doomed = true;
    const launch = () => {
      pts.push(this.player.model.emitterWorld(0).setY(0.05));
      for (const q of e.trail) pts.push(new THREE.Vector3(q.x - 0.5 - HALF, 0.05, q.y - 0.5 - HALF));
      if (e.hit) pts.push(cellToWorld(e.hit.sx, e.hit.sy, 0.05));
      else pts.push(pts[pts.length - 1].clone().addScaledVector(dir, 0.8));
      this.audio?.play('torpedo');
      this.fx.torpedo(pts, {
        onArrive: (p) => {
          if (ent) {
            ent.shield.hit(p0.clone(), 1.5);
            this._destroy(ent, 0.06);
          } else if (e.hit && e.hit.cell === CELL.STAR) {
            const s = this.stars.find(st => st.sx === e.hit.sx && st.sy === e.hit.sy);
            s?.star.kick(1.2);
            this.fx.smallBlast(p, 0.5);
            this.audio?.play('impact');
          } else if (e.hit && e.hit.cell === CELL.STARBASE && this.starbase) {
            this.starbase.doomed = true;
            const sb = this.starbase;
            sb.model.setHeat(0.6);
            this.fx.after(0.2, () => {
              this.fx.explosion(sb.model.root.getWorldPosition(new THREE.Vector3()), 3.0, { tint: 0x9aa4b0 });
              this.audio?.play('explosion', { size: 3 });
              this.world.remove(sb.model.root);
              sb.model.dispose();
              if (this.starbase === sb) this.starbase = null;
            });
          } else {
            this.fx.smallBlast(p, 0.25);
          }
        },
      });
    };
    this.fx.after(launchAt, launch);
    const length = (e.trail.length * 0.5 + 1);
    return launchAt + length / 7.5 + (e.destroyedKlingon ? 0.4 : 0.1);
  }

  _impulse(prev, snap) {
    const pl = this.player;
    const from = cellToWorld(prev.sx, prev.sy);
    const to = cellToWorld(snap.ship.sx, snap.ship.sy);
    const dist = from.distanceTo(to);
    pl.sx = snap.ship.sx; pl.sy = snap.ship.sy;
    if (dist < 1e-3) return 0.2;
    const dur = 0.45 + dist * 0.12;
    // Point the bow along the course, then glide: no sliding sideways.
    const turnDur = this._turnTo(headingFor(to.x - from.x, to.z - from.z));
    pl.glide = { from, to, t0: this.fx.time + turnDur, dur };
    this.fx.after(turnDur, () => this.audio?.play('impulse'));
    return turnDur + dur;
  }

  _warp(e, ctx) {
    const snap = ctx.getSnap();
    const prev = ctx.prev;
    const dx = snap.quadrant.qx - prev.qx, dy = snap.quadrant.qy - prev.qy;
    const dir = new THREE.Vector3(dx, 0, dy).normalize();
    if (!Number.isFinite(dir.x)) dir.set(1, 0, 0);
    const dur = this.reduced ? 0.7 : (e.instant ? 1.3 : 1.8);
    // Come about onto the course before going to warp.
    const turnDur = this._turnTo(headingFor(dir.x, dir.z));
    this.warp = { t0: this.fx.time + turnDur, dur, dir, swapped: false, getSnap: ctx.getSnap, instant: !!e.instant };
    this.fx.after(turnDur, () => this.audio?.play('warp'));
    return turnDur + dur;
  }

  _dock() {
    if (!this.starbase) return 0.4;
    const from = this.starbase.model.root.getWorldPosition(new THREE.Vector3()).setY(0.3);
    const to = this._playerPos();
    this.fx.phaser(from, to, { dur: 1.3 });   // tractor/resupply beam
    this.fx.ping(to, 1.4, [0.9, 0.8, 0.4], 1.0, 1.4);
    this.player.shield.setUp(true);
    this.audio?.play('dock');
    return 1.3;
  }

  _scan() {
    const p = this._playerPos();
    this.fx.ping(p, 9, [0.25, 0.8, 1.2], 1.6, 1.4);
    this.fx.after(0.25, () => this.fx.ping(p, 9, [0.2, 0.6, 1.0], 1.6, 0.7));
    this.audio?.play('scan');
  }

  _srscan() {
    const p = this._playerPos();
    this.fx.ping(p, 6.5, [0.4, 1.0, 0.9], 1.0, 1.0);
    this.audio?.play('scan');
  }

  _resupply() {
    const p = this._playerPos();
    this.fx.ping(p, 1.6, [1.4, 1.1, 0.4], 0.9, 2.0);
    this.fx.after(0.2, () => this.fx.ping(p, 2.2, [1.2, 0.9, 0.3], 1.0, 1.2));
    this.player.shield.setUp(true);
    this.audio?.play('resupply');
  }

  _enemyFire(e) {
    const ent = [...this.klingons.values()].find(k => k.sx === e.from[0] && k.sy === e.from[1] && !k.doomed)
      || [...this.klingons.values()].find(k => k.sx === e.from[0] && k.sy === e.from[1]);
    const src = ent ? ent.model : null;
    const target = this._playerPos();
    const shieldHit = e.invulnerable || e.hullDamage < e.damage;
    const hull = e.hullDamage > 0;
    this.audio?.play('disruptor');
    for (let b = 0; b < 2; b++) {
      this.fx.after(b * 0.08, () => {
        const from = src ? src.emitterWorld(b) : cellToWorld(e.from[0], e.from[1]);
        const dir = from.clone().sub(target).setY(0).normalize();
        const r = shieldHit ? this.player.model.halfSpan * 1.2 : this.player.model.halfSpan * 0.4;
        const hitPoint = target.clone().addScaledVector(dir, r).setY(0.05);
        this.fx.bolt(from, hitPoint, {
          color: ent?.type === 'warbird' ? [0.2, 1.0, 0.7] : [1.0, 0.35, 0.12],
          onImpact: () => {
            if (shieldHit) {
              this.player.shield.hit(hitPoint.clone().addScaledVector(dir, 1), e.invulnerable ? 1.2 : 1.0);
              this.audio?.play('shieldHit');
            }
            if (hull && b === 1) {
              this.fx.hullSparks(target.clone().addScaledVector(dir, 0.25).setY(0.12), dir, Math.min(2, 0.6 + e.hullDamage / 40));
              this.fx.shake(0.08 + Math.min(0.2, e.hullDamage / 200));
              this.audio?.play('hullHit');
            }
          },
        });
      });
    }
  }

  // -------------------------------------------------------------------------
  // Per-frame
  // -------------------------------------------------------------------------

  update(t, dt) {
    this.time = t;
    this.fx.reduced = this.reduced;
    this.fx.update(t);
    const pl = this.player;
    if (pl) {
      // Warp sequence.
      let stretch = 1, throttle = 0.45;
      pl.offset.set(0, 0, 0);
      if (this.warp) {
        const w = this.warp;
        const k = (t - w.t0) / w.dur;
        if (!w.swapped && k >= 0.5) {
          w.swapped = true;
          this.enterQuadrant(w.getSnap());
          this.player.turn = null;
          this.player.targetHeading = this.player.heading = headingFor(w.dir.x, w.dir.z);
        }
        if (!this.reduced) {
          if (k < 0.5) {
            const a = ease(Math.max(0, (k - 0.12) / 0.38));
            pl.offset.copy(w.dir).multiplyScalar(a * a * 9);
            stretch = 1 + a * 2.2;
            throttle = 0.45 + ease(k / 0.2) * 0.55;
          } else {
            const a = 1 - ease(Math.min(1, (k - 0.5) / 0.42));
            pl.offset.copy(w.dir).multiplyScalar(-a * a * 9);
            stretch = 1 + a * 2.2;
            throttle = 0.45 + a * 0.55;
          }
        }
        if (k >= 1) this.warp = null;
      }
      // Impulse glide.
      if (pl.glide) {
        const g = pl.glide;
        const k = (t - g.t0) / g.dur;
        pl.model.root.position.lerpVectors(g.from, g.to, ease(k));
        throttle = 0.45 + Math.sin(Math.min(1, Math.max(0, k)) * Math.PI) * 0.5;
        if (k >= 1) pl.glide = null;
      } else {
        // Recompute from the cell every frame (the warp offset is added on
        // top; it used to accumulate frame after frame before the swap).
        cellToWorld(pl.sx, pl.sy, 0, pl.model.root.position);
      }
      pl.model.root.position.add(pl.offset);
      // Turn: constant rate, eased; manoeuvring thrusters puff while it runs.
      if (pl.turn) {
        const tr = pl.turn;
        const k = Math.min(1, Math.max(0, (t - tr.t0) / tr.dur));
        pl.heading = lerpAngle(tr.from, tr.to, ease(k));
        if (!this.reduced && k < 0.85) this._rcsPuff(pl, tr.sign);
        if (k >= 1) pl.turn = null;
      } else {
        pl.heading = pl.targetHeading;
      }
      pl.model.setHeading(pl.heading);
      pl.model.body.scale.set(stretch, 1, 1 / Math.sqrt(stretch));
      pl.model.throttle = throttle;
      for (const e of pl.model.engines) e.setBoost(this.warp ? 0.6 : 0);
      pl.model.update(t, this.reduced);
      pl.shield.update(t, dt);
      // Damaged hull: occasional sparks and smoke wisps.
      if (this.hullPct !== undefined && this.hullPct < 50 && !this.reduced) {
        const rate = (50 - this.hullPct) / 50;
        if (Math.random() < rate * 0.25) {
          const p = this._playerPos().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.12, (Math.random() - 0.5) * 0.4));
          this.fx.smoke.spawn({ pos: p, vel: new THREE.Vector3(0, 0.05, 0.05), life: 1.6, size: [0.06, 0.35], color: [0.06, 0.055, 0.06], drag: 0.5 });
          if (Math.random() < 0.3) this.fx.spark.spawn({ pos: p, vel: new THREE.Vector3((Math.random() - 0.5) * 2, 0.4, (Math.random() - 0.5) * 2), life: 0.35, size: [0.01, 0.003], stretch: 0.06, color: [4, 2.4, 1], color1: [1, 0.2, 0], drag: 2 });
        }
      }
    }
    // Enemies face the Enterprise.
    const pp = pl ? this._playerPos() : new THREE.Vector3();
    for (const k of this.klingons.values()) {
      const p = k.model.root.position;
      const want = headingFor(pp.x - p.x, pp.z - p.z);
      k.model.root.rotation.y = lerpAngle(k.model.root.rotation.y, want, 1 - Math.exp(-dt * 3));
      k.model.update(t, this.reduced);
      k.shield.update(t, dt);
    }
    this.starbase?.model.update(t, this.reduced);
    for (const s of this.stars) s.star.update(t, dt);

    // Camera drift + shake.
    const cam = this.camera;
    const sway = this.reduced ? 0 : 1;
    cam.position.copy(this.camBase);
    cam.position.x += Math.sin(t * 0.07) * 0.35 * sway;
    cam.position.z += Math.cos(t * 0.05) * 0.25 * sway;
    const sh = this.fx.shakeAmp;
    if (sh > 0.001) {
      cam.position.x += (Math.sin(t * 91) + Math.sin(t * 57)) * sh * 0.25;
      cam.position.z += (Math.cos(t * 83) + Math.sin(t * 43)) * sh * 0.25;
    }
    cam.lookAt(this.camTarget.set(cam.position.x - this.camBase.x, 0, cam.position.z - this.camBase.z));
    this.drift.set(Math.sin(t * 0.021) * 0.012 * sway, Math.cos(t * 0.017) * 0.009 * sway);
  }

  /** Small cold-gas puffs from the bow and stern quarters during a turn. */
  _rcsPuff(pl, sign) {
    if (Math.random() > 0.55) return;
    const body = pl.model.body;
    const side = sign || 1;
    for (const [x, zs] of [[0.95, -side], [-0.85, side]]) {
      const p = body.localToWorld(new THREE.Vector3(x, 0.02, zs * 0.16));
      const out = body.localToWorld(new THREE.Vector3(x, 0.02, zs * 1.2)).sub(p).normalize();
      this.fx.glow.spawn({ pos: p, vel: out.multiplyScalar(0.7 + Math.random() * 0.4), life: 0.3, size: [0.05, 0.015], color: [0.9, 1.0, 1.15], color1: [0.1, 0.12, 0.15], drag: 4 });
    }
  }

  /** Warp-tunnel envelope + vanishing point for the post pass. */
  warpState() {
    if (!this.warp || this.reduced) return { amount: 0, fade: this.warp ? this._fade() : 0 };
    const w = this.warp;
    const k = (this.time - w.t0) / w.dur;
    const amount = k < 0.5 ? ease((k - 0.1) / 0.35) : 1 - ease((k - 0.5) / 0.4);
    const ahead = this._playerPos().addScaledVector(w.dir, 4).project(this.camera);
    return {
      amount: Math.max(0, Math.min(1, amount)),
      center: [Math.min(0.9, Math.max(0.1, ahead.x * 0.5 + 0.5)), Math.min(0.9, Math.max(0.1, ahead.y * 0.5 + 0.5))],
      speed: 0.6 + amount * 1.6,
      fade: 0,
    };
  }

  _fade() {
    const w = this.warp;
    const k = (this.time - w.t0) / w.dur;
    return k < 0.5 ? ease(k / 0.5) : 1 - ease((k - 0.5) / 0.5);
  }

  /** Screen-space lens flares for the stars in view. */
  flares() {
    const out = [];
    for (const s of this.stars) {
      const p = s.star.group.getWorldPosition(new THREE.Vector3()).project(this.camera);
      if (Math.abs(p.x) > 1.1 || Math.abs(p.y) > 1.1) continue;
      out.push({ x: p.x * 0.5 + 0.5, y: p.y * 0.5 + 0.5, intensity: 0.9 + s.star.flare, size: 1.0, color: s.spec.corona });
    }
    return out.slice(0, 6);
  }

  get busy() { return this.fx.busy || !!this.warp || !!this.player?.glide; }
}
