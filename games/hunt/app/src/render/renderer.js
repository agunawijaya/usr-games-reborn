// The 3D arena. Engine state drives every visual: once per engine step the
// renderer syncs terrain, fields, actors and shots from the match, and
// schedules each event's effect at the moment it happens inside the step
// (a boom when the shot's head reaches the wall, a spark when it passes the
// mirror). Between steps everything interpolates at display rate.

import * as THREE from 'three';
import * as K from '../engine/constants.js';
import * as H from '../engine/hunt.js';
import { Fields } from './fields.js';
import { makeFloor } from './floor.js';
import { Walls } from './walls.js';
import { Mirrors, Doors } from './mirrors.js';
import { Actor, Ghost, faceAngle } from './actors.js';
import { Projectiles, SHOT_Y } from './projectiles.js';
import { Particles, Debris, Rings, Flashes, Beams, LightPool, Puffs } from './fx.js';
import { Items } from './items.js';
import { Coach } from './coach.js';
import { Post } from './post.js';
import { Shaft } from './shaft.js';
import { COL } from './palette.js';
import { ghosts as viewGhosts, items as viewItems } from '../view.js';

const W = K.WIDTH;
const Hh = K.HEIGHT;
const wx = (x) => x - 25;
const wz = (y) => y - 11;

export class Renderer {
  constructor(canvas, { high = true, profile = null, reduced = false } = {}) {
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
    this.gl.autoClear = false;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COL.void);
    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 300);
    this.time = 0;
    this.reduced = reduced;
    this.lights = new LightPool(16);
    this.shared = {
      uEye: { value: new THREE.Vector3() },
      uFace: { value: new THREE.Vector2(1, 0) },
      uBeamOn: { value: 1 },
      uAmb: { value: 0 },
    };

    this.fields = new Fields();
    const lu = this.lights.uniforms;
    this.floor = makeFloor(this.fields, lu);
    this.walls = new Walls(this.fields, lu);
    this.mirrors = new Mirrors(this.fields, lu);
    this.doors = new Doors(this.fields);
    this.items = new Items();
    this.shots = new Projectiles(this.fields);
    this.shots.litAt = ([x, z]) => (this.seeAll ? 1 : this.fields.litAt(Math.round(x + 25), Math.round(z + 11)));
    this.particles = new Particles();
    this.debris = new Debris(lu, this.shared);
    this.rings = new Rings();
    this.flashes = new Flashes();
    this.beams = new Beams();
    this.fire = new Puffs('fire', 72);
    this.smoke = new Puffs('smoke', 96);
    this.coach = new Coach();
    this.shaft = new Shaft(this.fields);
    for (const m of [this.floor, this.walls.mesh, this.mirrors.mesh, this.doors.mesh, this.items.mesh,
      this.shots.group, this.particles.mesh, this.debris.mesh, this.rings.group, this.flashes.group, this.beams.group, this.coach.mesh,
      this.fire.group, this.smoke.group, this.shaft.mesh]) {
      this.scene.add(m);
    }
    // debris uses a standard material: a dim fill so chunks read in the dark
    this.scene.add(new THREE.HemisphereLight(0x8899bb, 0x110d0a, 0.35));
    const key = new THREE.DirectionalLight(0xfff1dd, 0.6);
    key.position.set(-10, 20, 12);
    this.scene.add(key);
    // shared viewer uniforms go into every lit material
    for (const m of [this.floor.material, this.walls.mat, this.mirrors.mat]) {
      m.uniforms.uEye = this.shared.uEye;
      m.uniforms.uFace = this.shared.uFace;
      m.uniforms.uBeamOn = this.shared.uBeamOn;
      m.uniforms.uAmb = this.shared.uAmb;
    }
    this.post = new Post(this.gl);
    this.actors = new Map(); // id -> { actor, from, to, ... }
    this.ghostPool = [];
    this.ghostGroup = new THREE.Group();
    this.scene.add(this.ghostGroup);
    this.distGroup = new THREE.Group();
    this.post.distScene.add(this.distGroup);
    this.queue = [];
    this.fx = { ca: 0, flash: 0, bloom: 0.62, shake: 0 };
    this.camMode = 'overview';
    this.camPos = new THREE.Vector3();
    this.camTarget = new THREE.Vector3();
    this.followTarget = new THREE.Vector3();
    this.seeAll = false;
    this.setQuality(profile || (high ? 'high' : 'low'));
    this.stepDur = 0.1;
    this.lastStepT = 0;
    this.listeners = {};
  }

  // Compile every program before play: a cold D3D11 compile can freeze the
  // first frames for a second or more (owner's no-GPU notes).
  async warmUp() {
    const probe = new Actor(this.lights.uniforms, 0xffffff, false);
    probe.bindShared(this.shared.uEye, this.shared.uFace, this.shared.uBeamOn, this.shared.uAmb);
    const hollow = new Actor(this.lights.uniforms, 0xffffff, true);
    const gh = new Ghost(0xffffff);
    const dist = makeDistortion();
    this.scene.add(probe.group, hollow.group, gh.mesh);
    this.post.distScene.add(dist);
    for (const o of [...this.fire.pool, ...this.smoke.pool, ...this.flashes.pool, ...this.rings.pool, ...this.beams.pool]) o.m.visible = true;
    this.coach.mesh.visible = true;
    try {
      if (this.gl.compileAsync) await this.gl.compileAsync(this.scene, this.camera);
      await this.gl.compileAsync?.(this.post.distScene, this.camera);
      // one real frame through the post chain compiles its passes
      this.post.render(this.scene, this.camera, 0, this.fx);
    } catch (e) { console.warn('warm-up', e); }
    for (const o of [...this.fire.pool, ...this.smoke.pool, ...this.flashes.pool, ...this.rings.pool, ...this.beams.pool]) o.m.visible = false;
    this.coach.mesh.visible = false;
    this.scene.remove(probe.group, hollow.group, gh.mesh);
    this.post.distScene.remove(dist);
  }

  on(name, fn) { (this.listeners[name] ||= []).push(fn); }
  emit(name, ...a) { for (const f of this.listeners[name] || []) f(...a); }

  // 'high' | 'low' | 'lite' (true/false = high/low)
  setQuality(profile) {
    if (profile === true) profile = 'high';
    if (profile === false) profile = 'low';
    this.profile = profile;
    this.high = profile === 'high';
    const lite = profile === 'lite';
    this.post.setQuality(profile);
    this.particles.scale = this.high ? 1 : lite ? 0.25 : 0.5;
    this.floor.material.uniforms.uHigh.value = this.high ? 1 : 0;
    this.floor.material.uniforms.uLite.value = lite ? 1 : 0;
    this.walls.mat.uniforms.uLite.value = lite ? 1 : 0;
    const dpr = window.devicePixelRatio || 1;
    this.pr = this.high ? Math.min(dpr, 2) : lite ? 0.5 : Math.min(dpr, 1);
    if (this.w) this.resize(this.w, this.h);
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    this.gl.setPixelRatio(this.pr);
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.post.resize(w, h, this.pr);
    this.fitOverview();
  }

  // Find the camera distance that fits the whole maze (with HUD margins).
  fitOverview() {
    const pitch = THREE.MathUtils.degToRad(this.camMode === 'follow' ? 52 : 62);
    this.pitch = pitch;
    const corners = [];
    for (const [x, z] of [[-26, -12], [26, -12], [26, 12], [-26, 12]]) {
      corners.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, 1.5, z));
    }
    const cam = this.camera;
    const target = new THREE.Vector3(0, 0, 0.6);
    let lo = 10;
    let hi = 200;
    for (let it = 0; it < 30; it++) {
      const d = (lo + hi) / 2;
      cam.position.set(0, Math.sin(pitch) * d, Math.cos(pitch) * d).add(target);
      cam.lookAt(target);
      cam.updateMatrixWorld();
      let ok = true;
      for (const c of corners) {
        const p = c.clone().project(cam);
        if (Math.abs(p.x) > 0.965 || p.y > 0.83 || p.y < -0.9) { ok = false; break; }
      }
      if (ok) hi = d; else lo = d;
    }
    this.overviewDist = hi;
    this.overviewTarget = target;
  }

  setCameraMode(mode) {
    this.camMode = mode;
    this.fitOverview();
  }

  // ------------------------------------------------------------- per step

  // A new engine step has been computed. `me` = the human's slot or null.
  onStep(g, events, me, vs, ctx) {
    const t0 = this.time;
    this.lastStepT = t0;
    this.stepDur = ctx.stepDur;
    this.g = g;
    this.me = me;
    this.seeAll = !!ctx.seeAll;
    this.revealMines = !!ctx.revealMines;
    this.colorOf = ctx.colorOf;
    this.fields.setView(vs, ctx.instant);
    this.fields.setGoo(g);
    this.fields.setTerrain(vs.terrain);
    this.walls.update(vs.terrain, t0);
    this.mirrors.sync(vs.terrain, t0);
    this.doors.sync(vs.terrain);
    const colorOfShot = (t) => {
      const b = g.bullets.find((bb) => bb.id === t.id);
      const owner = b && b.owner >= 0 ? g.slots[b.owner] : null;
      const c = owner ? this.colorOf(owner) : { hex: 0xffffff };
      return new THREE.Color(c.hex).lerp(new THREE.Color(1, 1, 1), 0.45);
    };
    this.shots.step(g.trails, colorOfShot, t0, this.stepDur);
    // actors: remember where each player was and is
    const now = new Map();
    for (let i = 0; i < g.np; i++) {
      const p = g.slots[i];
      now.set(p.id, { x: p.x, y: p.y, face: p.face, flying: p.flying, cloak: p.cloak, hurt: Math.min(1, p.damage / Math.max(1, p.damcap)), slot: p, name: H.nameOf(g, p) });
    }
    for (const [id, a] of this.actors) {
      if (!now.has(id)) {
        this.scene.remove(a.actor.group);
        this.distGroup.remove(a.dist);
        this.actors.delete(id);
      }
    }
    for (const [id, s] of now) {
      let a = this.actors.get(id);
      const col = this.colorOf(s.slot);
      if (!a) {
        const actor = new Actor(this.lights.uniforms, col.hex, H.ident(g, s.slot).team === 50);
        actor.bindShared(this.shared.uEye, this.shared.uFace, this.shared.uBeamOn, this.shared.uAmb);
        this.scene.add(actor.group);
        const dist = makeDistortion();
        this.distGroup.add(dist);
        a = { actor, from: { ...s }, to: { ...s }, dist, slimed: 0, born: t0 };
        actor.angle = faceAngle(s.face === K.FLYER ? K.RIGHT : s.face);
        this.actors.set(id, a);
      } else {
        a.from = { ...a.to };
        a.to = { ...s };
      }
      a.t0 = t0;
    }
    // memory ghosts and items
    this.ghostList = me && !this.seeAll ? viewGhosts(g, me, vs) : [];
    this.itemList = viewItems(g, me, vs, this.revealMines || this.seeAll);
    this.vs = vs;
    // flying boots
    this.bootFlights = events.filter((e) => e.t === 'bootFly');
    this.direct(events, t0);
  }

  // Map events to effects, timed inside the step.
  direct(events, t0) {
    const dur = this.stepDur;
    const g = this.g;
    const at = (frac) => t0 + Math.max(0, Math.min(1, frac)) * dur;
    const trail = new Map(g.trails.map((t) => [t.id, t]));
    const fracOf = (id, x, y) => {
      const t = trail.get(id);
      if (!t) return 0.5;
      let k = t.path.findIndex(([px, py]) => px === x && py === y);
      if (k < 0) k = t.path.length - 1;
      return k / Math.max(1, t.path.length - 1);
    };
    let anchor = 0.05;
    let oozeN = 0;
    const oozeTotal = events.filter((e) => e.t === 'ooze').length || 1;
    for (const e of events) {
      switch (e.t) {
        case 'fire': this.later(at(0), () => this.onFire(e)); break;
        case 'bounce': this.later(at(fracOf(e.id, e.x, e.y)), () => this.onBounce(e)); break;
        case 'scatter': this.later(at(fracOf(e.id, e.x, e.y)), () => this.onScatter(e)); break;
        case 'boom': anchor = trail.has(e.id) ? fracOf(e.id, e.x, e.y) : 0.1; this.later(at(anchor), () => this.onBoom(e)); break;
        case 'wallGone': this.later(at(anchor), () => this.onWallGone(e)); break;
        case 'wallBack': this.later(at(anchor + 0.05), () => this.onWallBack(e)); break;
        case 'hurt': this.later(at(anchor), () => this.onHurt(e)); break;
        case 'death': this.later(at(Math.max(anchor, 0.2)), () => this.onDeath(e)); break;
        case 'enter': this.later(at(0.6), () => this.onEnter(e)); break;
        case 'absorb': this.later(at(fracOf(e.id, e.x, e.y)), () => this.onAbsorb(e)); break;
        case 'zing': this.later(at(fracOf(e.id, e.x, e.y)), () => this.emit('sfx', 'zing', e.x, e.y)); break;
        case 'splat': this.later(at(anchor), () => this.onSplat(e)); break;
        case 'ooze': { const k = oozeN++ / oozeTotal; this.later(at(0.1 + k * 0.85), () => this.onOoze(e)); break; }
        case 'slimed': this.later(at(0.5), () => this.onSlimed(e)); break;
        case 'thrown': this.later(at(anchor), () => this.onThrown(e)); break;
        case 'land': this.later(at(1), () => this.onLand(e)); break;
        case 'volcano': this.later(at(0.9), () => this.onVolcano(e)); break;
        case 'intercept': this.later(at(0.5), () => this.particles.burst(wx(e.x), SHOT_Y, wz(e.y), 14, 4, new THREE.Color(1, 0.9, 0.6), { life: 0.3 })); break;
        case 'move': case 'turn': case 'bump': case 'bell': case 'hot': case 'scan': case 'cloak':
        case 'trip': case 'defuse': case 'boots': case 'stab': case 'mineChain':
          this.later(at(0), () => this.emit('sfx', e.t, e.x ?? null, e.y ?? null, e));
          if (e.t === 'stab') this.later(at(0), () => this.onStab(e));
          break;
        default: break;
      }
    }
  }

  later(t, fn) { this.queue.push({ t, fn }); }

  isLit(x, y) { return this.seeAll || (this.vs && this.vs.lit[y * W + x] === 1); }
  isMe(id) { return this.me && this.me.id === id; }

  onFire(e) {
    // fire() flashes the shot on every screen: global muzzle flash
    const c = new THREE.Color(this.colorForId(e.id));
    const x = wx(e.x) + K.DX[e.face] * 0.45;
    const z = wz(e.y) + K.DY[e.face] * 0.45;
    const big = e.type === K.SHOT ? 1 : 1.6;
    this.flashes.spawn(x, SHOT_Y, z, 0.9 * big, c.clone().lerp(new THREE.Color(1, 1, 1), 0.5), this.time, 0.12);
    this.lights.add(x, 0.6, z, 3.2 * big, c, 2.2, this.time, 0.12);
    this.emit('sfx', 'fire', e.x, e.y, e);
    this.emit('radar', { kind: 'fire', x: e.x, y: e.y, id: e.id });
  }

  onBounce(e) {
    this.mirrors.hit(e.x, e.y, this.time, e.from, e.n);
    this.emit('sfx', 'ricochet', e.x, e.y, e);
    if (!this.isLit(e.x, e.y)) return;
    const x = wx(e.x);
    const z = wz(e.y);
    const dir = new THREE.Vector3(K.DX[e.to], 0, K.DY[e.to]);
    const hot = new THREE.Color(1, 0.92, 0.6);
    for (let k = 0; k < 22; k++) {
      const s = 3 + Math.random() * 6;
      const sp = (Math.random() - 0.5) * 1.3;
      this.particles.emit({
        x, y: SHOT_Y, z,
        vx: (dir.x + (dir.z ? sp : 0)) * s, vy: Math.random() * 2.5, vz: (dir.z + (dir.x ? sp : 0)) * s,
        life: 0.25 + Math.random() * 0.25, size: 0.045, r: hot.r, g: hot.g, b: hot.b, grav: -9, stretch: 0.09, drag: 2.5, bounce: 0.4,
      });
    }
    this.flashes.spawn(x, SHOT_Y, z, 0.8, new THREE.Color(0.75, 0.95, 1), this.time, 0.14);
    this.lights.add(x, 0.5, z, 2.6, new THREE.Color(COL.mirror), 2.5, this.time, 0.18);
  }

  onScatter(e) {
    this.doors.scatter(e.x, e.y, this.time);
    this.emit('sfx', 'scatter', e.x, e.y, e);
    if (!this.isLit(e.x, e.y)) return;
    this.particles.burst(wx(e.x), 0.4, wz(e.y), 18, 3, new THREE.Color(COL.door), { life: 0.4, up: 1, grav: 0 });
  }

  onBoom(e) {
    const x = wx(e.x);
    const z = wz(e.y);
    const size = Math.max(1, e.size);
    const half = size - 0.5;
    const warm = new THREE.Color(COL.blast);
    this.fields.blastSquare(e.x, e.y, size);
    // anatomy of a blast: a hot core, turbulent fireballs, a shockwave, smoke
    this.flashes.spawn(x, 0.6, z, 0.5 + half * 0.55, new THREE.Color(1, 0.85, 0.6), this.time, 0.08, 0.7);
    this.fire.spawn(x, 0.55, z, 0.8 + half * 0.9, this.time, { dur: 0.42 + size * 0.05, grow: 1.5, vy: 0.3, intensity: 0.75 });
    if (size >= 2) {
      const k = Math.min(9, size + 2);
      for (let i = 0; i < k; i++) {
        const a = (i / k) * Math.PI * 2 + Math.random();
        const r = half * (0.35 + Math.random() * 0.55);
        this.fire.spawn(x + Math.cos(a) * r, 0.45, z + Math.sin(a) * r, 0.6 + half * 0.45, this.time + Math.random() * 0.06,
          { dur: 0.35 + Math.random() * 0.25, grow: 1.4, vy: 0.4, intensity: 0.5 });
      }
    }
    for (let i = 0; i < Math.min(12, 2 + size * 2); i++) {
      const a = Math.random() * Math.PI * 2;
      const r = half * Math.random() * 0.8;
      this.smoke.spawn(x + Math.cos(a) * r, 0.6, z + Math.sin(a) * r, 0.9 + half * 0.7, this.time + 0.08 + Math.random() * 0.15,
        { dur: 1.4 + Math.random() * 1.2, grow: 2.0, vx: Math.cos(a) * 0.3, vy: 0.5 + Math.random() * 0.4, vz: Math.sin(a) * 0.3, color: 0x221f22 });
    }
    this.rings.spawn(x, z, half * 1.25 + 0.6, warm, this.time, 0.32 + size * 0.05, 0.1);
    if (size > 1) this.rings.spawn(x, z, half * 1.7 + 1, new THREE.Color(1, 0.8, 0.55), this.time + 0.04, 0.45 + size * 0.06, 0.05);
    this.lights.add(x, 1.0, z, 3 + half * 2.2, warm, 1.6 + size * 0.35, this.time, 0.3 + size * 0.08);
    const n = Math.min(400, 16 + size * size * 10);
    this.particles.burst(x, 0.3, z, n, 3 + size * 1.6, new THREE.Color(1, 0.62, 0.25), { life: 0.7 + size * 0.06, size: 0.07, up: 2.5 + size * 0.3, grav: -5 });
    this.particles.burst(x, 0.3, z, Math.floor(n / 3), 1.5 + size, new THREE.Color(1, 0.9, 0.7), { life: 0.3, size: 0.05, up: 1 });
    // embers drift up in the big ones
    if (size >= 3) {
      for (let k = 0; k < size * 12; k++) {
        this.particles.emit({
          x: x + (Math.random() - 0.5) * half * 2, y: 0.2, z: z + (Math.random() - 0.5) * half * 2,
          vx: (Math.random() - 0.5) * 0.6, vy: 0.8 + Math.random() * 1.5, vz: (Math.random() - 0.5) * 0.6,
          life: 1.2 + Math.random(), size: 0.05, r: 1, g: 0.45, b: 0.15, grav: 0.3, drag: 0.6,
        });
      }
    }
    const d = this.me ? Math.hypot(e.x - this.me.x, e.y - this.me.y) : 30;
    const near = Math.max(0, 1 - d / 30);
    if (!this.reduced) {
      this.fx.shake = Math.min(1.2, this.fx.shake + 0.08 * size * (0.4 + near));
      if (size >= 4) this.fx.ca = Math.min(1.2, this.fx.ca + 0.12 * size * (0.5 + near));
      if (size >= 5) this.fx.flash = Math.min(0.35, this.fx.flash + 0.03 * size * near);
    }
    this.emit('sfx', 'boom', e.x, e.y, e);
    this.emit('radar', { kind: 'boom', x: e.x, y: e.y, size });
  }

  onWallGone(e) {
    this.walls.crumble(e.x, e.y, this.time);
    const x = wx(e.x);
    const z = wz(e.y);
    for (let k = 0; k < 9; k++) {
      this.debris.chunk(x + (Math.random() - 0.5) * 0.7, 0.2 + Math.random() * 0.8, z + (Math.random() - 0.5) * 0.7,
        (Math.random() - 0.5) * 6, 2 + Math.random() * 4, (Math.random() - 0.5) * 6, 0.6 + Math.random() * 0.9);
    }
    this.smoke.spawn(x, 0.4, z, 1.1, this.time + 0.05, { dur: 1.6, grow: 1.8, vy: 0.25, color: 0x3a3a40 });
    this.emit('sfx', 'crumble', e.x, e.y, e);
  }

  onWallBack(e) {
    if (!this.isLit(e.x, e.y) && !(this.vs && this.vs.known[e.y * W + e.x])) return;
    this.walls.regrow(e.x, e.y, this.time);
    this.fields.regrow(e.x, e.y);
    this.emit('sfx', 'regrow', e.x, e.y, e);
  }

  onHurt(e) {
    if (e.amt <= 0 && !e.blocked) return;
    const a = this.actors.get(e.who);
    if (this.isLit(e.x, e.y) || this.isMe(e.who)) {
      const c = e.blocked ? new THREE.Color(0.5, 1, 1) : new THREE.Color(1, 0.5, 0.25);
      this.particles.burst(wx(e.x), 0.5, wz(e.y), 18, 3.5, c, { life: 0.35, size: 0.05 });
      if (a) a.flash = this.time;
    }
    if (this.isMe(e.who) && !this.reduced && !e.blocked) {
      this.fx.ca = Math.min(1.4, this.fx.ca + 0.5);
      this.fx.shake = Math.min(1.2, this.fx.shake + 0.25);
    }
    this.emit('hurt', e);
  }

  onDeath(e) {
    const x = wx(e.x);
    const z = wz(e.y);
    const a = this.actors.get(e.id);
    const col = a ? a.actor.color.clone() : new THREE.Color(1, 1, 1);
    const seen = this.isLit(e.x, e.y) || this.isMe(e.id);
    if (seen) {
      // a burst of light shards in the player's colour
      for (let k = 0; k < 110; k++) {
        const ang = Math.random() * Math.PI * 2;
        const s = 2.5 + Math.random() * 6;
        const c = col.clone().multiplyScalar(1.6).lerp(new THREE.Color(1, 1, 1), Math.random() * 0.25);
        this.particles.emit({ x, y: 0.45, z, vx: Math.cos(ang) * s, vy: 1.5 + Math.random() * 4, vz: Math.sin(ang) * s, life: 1.0 + Math.random() * 0.9, size: 0.085, r: c.r, g: c.g, b: c.b, grav: -6, stretch: 0.22, drag: 1.3, bounce: 0.35 });
      }
      this.flashes.spawn(x, 0.5, z, 1.4, col.clone().lerp(new THREE.Color(1, 1, 1), 0.3), this.time, 0.22, 0.7);
      this.rings.spawn(x, z, 2.4, col, this.time, 0.5, 0.06);
      this.lights.add(x, 0.8, z, 5, col, 3, this.time, 0.4);
    }
    this.emit('sfx', 'death', e.x, e.y, e);
    this.emit('death', e);
  }

  onEnter(e) {
    const seen = this.seeAll || this.isMe(e.id) || this.isLit(e.x, e.y) || e.status === K.Q_FLY;
    if (!seen) return;
    const a = this.actors.get(e.id);
    const col = a ? a.actor.color : new THREE.Color(1, 1, 1);
    this.beams.spawn(wx(e.x), wz(e.y), col, this.time, 1.1);
    this.rings.spawn(wx(e.x), wz(e.y), 1.6, col, this.time + 0.2, 0.6, 0.08);
    this.lights.add(wx(e.x), 1.2, wz(e.y), 4, col, 2.5, this.time, 0.8);
    if (a) a.born = this.time;
    this.emit('sfx', 'enter', e.x, e.y, e);
  }

  onAbsorb(e) {
    const a = this.actors.get(e.who);
    if (a) a.shield = this.time;
    if (this.isLit(e.x, e.y)) this.flashes.spawn(wx(e.x), 0.5, wz(e.y), 1.4, new THREE.Color(0.5, 0.9, 1), this.time, 0.3);
    this.emit('sfx', 'absorb', e.x, e.y, e);
  }

  onSplat(e) {
    const lava = e.type === K.LAVA;
    const c = new THREE.Color(lava ? COL.lava : COL.slime);
    this.emit('sfx', 'splat', e.x, e.y, e);
    if (!this.isLit(e.x, e.y)) return;
    this.particles.burst(wx(e.x), 0.35, wz(e.y), 40, 4, c, { life: 0.6, size: 0.07, up: 2.2, grav: -9, stretch: 0.05 });
  }

  onOoze(e) {
    const lava = e.type === K.LAVA;
    this.fields.oozeAt(e.x, e.y, lava);
    if (this.isLit(e.x, e.y) && Math.random() < 0.5) {
      const c = new THREE.Color(lava ? COL.lavaHot : COL.slime);
      this.particles.burst(wx(e.x), 0.15, wz(e.y), 3, 1.2, c, { life: 0.5, size: 0.05, up: 1.2, grav: -8, stretch: 0.02 });
    }
    if (lava) this.lights.add(wx(e.x), 0.4, wz(e.y), 2.2, new THREE.Color(COL.lava), 1.1, this.time, 0.5);
  }

  onSlimed(e) {
    const a = this.actors.get(e.who);
    if (a) a.slimed = this.time;
  }

  onThrown(e) {
    // a wall grew back under this player: it throws them (expl.c:196-214)
    const x = wx(e.x);
    const z = wz(e.y);
    this.rings.spawn(x, z, 1.8, new THREE.Color(COL.door), this.time, 0.5, 0.1);
    this.particles.burst(x, 0.3, z, 40, 3, new THREE.Color(COL.door), { life: 0.6, up: 3, grav: -3 });
    this.emit('sfx', 'whoosh', e.x, e.y, e);
  }

  onLand(e) {
    const x = wx(e.x);
    const z = wz(e.y);
    this.rings.spawn(x, z, 1.2, new THREE.Color(0.8, 0.85, 1), this.time, 0.35, 0.08);
    this.particles.burst(x, 0.1, z, 16, 2, new THREE.Color(0.6, 0.65, 0.75), { life: 0.5, size: 0.1, up: 0.8, stretch: 0 });
    this.emit('sfx', 'land', e.x, e.y, e);
  }

  onVolcano(e) {
    const x = wx(e.x);
    const z = wz(e.y);
    this.flashes.spawn(x, 0.8, z, 7, new THREE.Color(COL.lava), this.time, 0.8, 1.5);
    this.rings.spawn(x, z, 7, new THREE.Color(COL.lavaHot), this.time, 1.0, 0.1);
    this.particles.burst(x, 0.3, z, 240, 7, new THREE.Color(COL.lavaHot), { life: 1.4, size: 0.09, up: 6, grav: -6 });
    this.lights.add(x, 1.5, z, 12, new THREE.Color(COL.lava), 4, this.time, 1.6);
    if (!this.reduced) this.fx.shake = Math.min(1.5, this.fx.shake + 0.8);
    this.emit('sfx', 'volcano', e.x, e.y, e);
  }

  onStab(e) {
    if (!this.isLit(e.x, e.y)) return;
    this.particles.burst(wx(e.x), 0.45, wz(e.y), 10, 2.5, new THREE.Color(1, 1, 1), { life: 0.2, size: 0.04 });
  }

  colorForId(id) {
    const a = this.actors.get(id);
    return a ? a.actor.color.getHex() : 0xffffff;
  }

  // ------------------------------------------------------------ per frame

  frame(dt, { coachPlan = null } = {}) {
    this.time += dt;
    const time = this.time;
    // due effects
    if (this.queue.length) {
      const due = this.queue.filter((q) => q.t <= time);
      this.queue = this.queue.filter((q) => q.t > time);
      for (const q of due) q.fn();
    }
    this.fields.update(dt, this.reduced);
    this.lights.update(time);
    this.mirrors.frame(time);
    this.shots.frame(time);
    this.particles.update(dt);
    this.debris.update(dt);
    this.rings.update(time);
    this.flashes.update(time);
    this.beams.update(time);
    this.fire.update(time, dt);
    this.smoke.update(time, dt);
    this.coach.show(coachPlan, time);
    // actors
    let meWorld = null;
    for (const [id, a] of this.actors) {
      const k = Math.min(1, Math.max(0, (time - a.t0) / Math.max(1e-3, this.stepDur)));
      const e = k * k * (3 - 2 * k);
      const f = a.from;
      const t = a.to;
      const jump = Math.abs(t.x - f.x) + Math.abs(t.y - f.y);
      const flying = t.flying >= 0 || f.flying >= 0;
      let x;
      let z;
      let h = 0;
      if (flying) {
        x = wx(f.x) + (wx(t.x) - wx(f.x)) * k;
        z = wz(f.y) + (wz(t.y) - wz(f.y)) * k;
        h = 0.6 + Math.sin(k * Math.PI) * (0.4 + jump * 0.25);
      } else if (jump > 1) {
        x = wx(t.x); z = wz(t.y);
      } else {
        x = wx(f.x) + (wx(t.x) - wx(f.x)) * e;
        z = wz(f.y) + (wz(t.y) - wz(f.y)) * e;
      }
      const me = this.isMe(id);
      const litHere = Math.max(this.fields.litAt(t.x, t.y), this.fields.litAt(f.x, f.y));
      const visible = this.seeAll || me || flying ? 1 : litHere;
      const cloak = t.cloak >= 0 ? 1 : 0;
      const born = Math.min(1, (time - (a.born ?? -10)) / 0.6);
      const angle = t.face === K.FLYER ? a.actor.angle + dt * 14 : faceAngle(t.face);
      const moving = jump > 0 && k < 1;
      a.actor.pose(x, z, h, angle, time, t.hurt > 0.55 && !this.reduced ? (t.hurt - 0.55) / 0.45 : 0, cloak * (me ? 0.6 : 1), Math.min(visible, born), me ? 1 : litHere, moving);
      a.actor.group.visible = visible > 0.02;
      a.dist.position.set(x, 0.4 + h, z);
      a.dist.visible = cloak > 0 && visible > 0.02 && this.high;
      a.dist.material.uniforms.uTime.value = time;
      // sparks from a badly hurt hull; goo drips from a slimed one
      if (a.actor.group.visible && t.hurt > 0.7 && Math.random() < dt * 8) {
        this.particles.burst(x, 0.45 + h, z, 3, 1.5, new THREE.Color(1, 0.6, 0.2), { life: 0.3, size: 0.035 });
      }
      if (a.actor.group.visible && time - (a.slimed ?? -99) < 5 && Math.random() < dt * 6) {
        this.particles.emit({ x: x + (Math.random() - 0.5) * 0.4, y: 0.35 + h, z: z + (Math.random() - 0.5) * 0.4, vx: 0, vy: -0.2, vz: 0, life: 0.6, size: 0.05, r: 0.45, g: 1, b: 0.3, grav: -6 });
        if (moving) this.fields.slimeRes[t.y * W + t.x] = Math.max(this.fields.slimeRes[t.y * W + t.x], 0.5);
      }
      if (me) meWorld = { x, z, angle };
    }
    // ghosts (memory)
    const gl = this.ghostList || [];
    while (this.ghostPool.length < gl.length) {
      const gh = new Ghost(0x6f9dff);
      this.ghostPool.push(gh);
      this.ghostGroup.add(gh.mesh);
    }
    for (let i = 0; i < this.ghostPool.length; i++) {
      const gh = this.ghostPool[i];
      const it = gl[i];
      gh.mesh.visible = !!it;
      if (it) gh.pose(wx(it.x), wz(it.y), faceAngle(it.face), time, 1);
    }
    // items
    const flying = (this.bootFlights || []).map((b) => {
      const k = Math.min(1, (time - this.lastStepT) / this.stepDur);
      return { x: wx(b.fx) + (wx(b.x) - wx(b.fx)) * k, z: wz(b.fy) + (wz(b.y) - wz(b.fy)) * k };
    });
    this.items.sync(this.itemList || [], flying);
    // viewer light
    const sh = this.shared;
    if (meWorld && !this.seeAll) {
      sh.uEye.value.set(meWorld.x, 0.5, meWorld.z);
      sh.uFace.value.set(Math.cos(meWorld.angle), -Math.sin(meWorld.angle));
      sh.uBeamOn.value = 1;
      this.shaft.pose(meWorld.x, meWorld.z, meWorld.angle, 1, time);
    } else {
      this.shaft.pose(0, 0, 0, 0, time);
      sh.uBeamOn.value = 0;
    }
    sh.uAmb.value = this.seeAll ? 1 : 0;
    for (const m of [this.floor.material, this.walls.mat, this.mirrors.mat, this.doors.mat]) {
      m.uniforms.uTime.value = time;
      m.uniforms.uSeeAll.value = this.seeAll ? 1 : 0;
    }
    this.items.mat.uniforms.uTime.value = time;
    this.shots.mat.uniforms.uSeeAll.value = this.seeAll ? 1 : 0;
    this.updateCamera(dt, meWorld);
    // decay screen effects
    this.fx.ca *= Math.exp(-dt * 5);
    this.fx.flash *= Math.exp(-dt * 7);
    this.fx.shake *= Math.exp(-dt * 6);
    this.post.render(this.scene, this.camera, time, this.fx);
  }

  markStep() { this.lastStepT = this.time; }

  updateCamera(dt, me) {
    const cam = this.camera;
    let target;
    let dist;
    if (this.focus) {
      target = new THREE.Vector3(this.focus.x - 25, 0, this.focus.y - 11);
      dist = this.focus.dist;
    } else if (this.camMode === 'follow' && me) {
      this.followTarget.lerp(new THREE.Vector3(me.x + Math.cos(me.angle) * 2.2, 0, me.z - Math.sin(me.angle) * 2.2), 1 - Math.exp(-dt * 4));
      target = this.followTarget;
      dist = Math.min(this.overviewDist * 0.5, 30);
    } else {
      target = this.overviewTarget;
      dist = this.overviewDist;
    }
    const p = this.pitch;
    const want = new THREE.Vector3(target.x, Math.sin(p) * dist, target.z + Math.cos(p) * dist);
    this.camPos.lerp(want, this.camPos.lengthSq() ? 1 - Math.exp(-dt * 5) : 1);
    this.camTarget.lerp(target, this.camTarget.lengthSq() ? 1 - Math.exp(-dt * 5) : 1);
    cam.position.copy(this.camPos);
    const s = this.fx.shake;
    if (s > 0.002) {
      const t = this.time * 45;
      cam.position.x += (Math.sin(t) + Math.sin(t * 1.7)) * 0.08 * s;
      cam.position.y += Math.sin(t * 1.3) * 0.06 * s;
      cam.position.z += (Math.cos(t * 1.1) + Math.sin(t * 2.3)) * 0.08 * s;
    }
    cam.lookAt(this.camTarget);
  }

  // spectator camera: look at a maze cell from a given distance (null = off)
  setFocus(f) {
    this.focus = f;
    if (f) {
      const p = this.pitch;
      const t = new THREE.Vector3(f.x - 25, 0, f.y - 11);
      this.camTarget.copy(t);
      this.camPos.set(t.x, Math.sin(p) * f.dist, t.z + Math.cos(p) * f.dist);
    }
  }

  // world position of a maze cell on screen (pixels), for HUD overlays
  project(x, y) {
    const v = new THREE.Vector3(wx(x), 0.5, wz(y)).project(this.camera);
    return [(v.x * 0.5 + 0.5) * this.w, (-v.y * 0.5 + 0.5) * this.h];
  }
}

// Cloak shimmer: writes screen-space offsets around the player into the
// distortion target (render/post.js), so the scene behind them refracts.
function makeDistortion() {
  const geo = new THREE.PlaneGeometry(1.15, 1.15);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv;
      float n(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(n(i), n(i+vec2(1,0)), f.x), mix(n(i+vec2(0,1)), n(i+vec2(1,1)), f.x), f.y); }
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float m = smoothstep(1.0, 0.35, r);
        vec2 o = vec2(vn(vUv * 14.0 + uTime * 3.1), vn(vUv * 14.0 - uTime * 2.7 + 7.0)) - 0.5;
        gl_FragColor = vec4(0.5 + o * 0.9, 0.0, m);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.visible = false;
  return m;
}
