// Camera director: a free orbit camera the player drives between turns,
// scripted cinematic shots during a turn's playback, and an orthographic
// top-down tactical camera. Shots blend with critically damped springs.

import * as THREE from 'three';

const tmp = new THREE.Vector3();

export class Director {
  constructor(aspect) {
    this.persp = new THREE.PerspectiveCamera(42, aspect, 0.5, 30000);
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 6000);
    this.mode = 'orbit'; // orbit | cinematic | tactical
    this.orbit = { target: new THREE.Vector3(), yaw: 0.8, pitch: 0.28, dist: 220 };
    this.goal = { pos: new THREE.Vector3(0, 60, 200), look: new THREE.Vector3(), fov: 42 };
    this.pos = new THREE.Vector3(0, 60, 200);
    this.look = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.lookVel = new THREE.Vector3();
    this.fov = 42;
    this.shot = null;
    this.shake = 0;
    this.tactical = { center: new THREE.Vector3(), halfH: 400 };
    this.reduced = false;
    this.follow = null; // () => Vector3 : orbit target follows this
  }

  get camera() { return this.mode === 'tactical' ? this.ortho : this.persp; }

  resize(w, h) {
    this.aspect = w / h;
    this.persp.aspect = this.aspect;
    this.persp.updateProjectionMatrix();
    this.updateOrtho();
  }

  updateOrtho() {
    const hh = this.tactical.halfH;
    this.ortho.left = -hh * this.aspect;
    this.ortho.right = hh * this.aspect;
    this.ortho.top = hh;
    this.ortho.bottom = -hh;
    this.ortho.updateProjectionMatrix();
  }

  // --- player orbit -------------------------------------------------------------
  orbitBy(dYaw, dPitch, dZoom) {
    const o = this.orbit;
    o.yaw += dYaw;
    o.pitch = THREE.MathUtils.clamp(o.pitch + dPitch, 0.03, 1.35);
    o.dist = THREE.MathUtils.clamp(o.dist * dZoom, 45, 2600);
  }

  panTactical(dx, dz, zoom = 1) {
    this.tactical.center.x += dx;
    this.tactical.center.z += dz;
    this.tactical.halfH = THREE.MathUtils.clamp(this.tactical.halfH * zoom, 120, 2400);
    this.updateOrtho();
  }

  orbitGoal() {
    const o = this.orbit;
    const t = this.follow ? this.follow() : o.target;
    o.target.copy(t);
    this.goal.look.copy(t).setY(t.y + 14);
    this.goal.pos.set(
      t.x + Math.sin(o.yaw) * Math.cos(o.pitch) * o.dist,
      Math.max(4, t.y + Math.sin(o.pitch) * o.dist),
      t.z + Math.cos(o.yaw) * Math.cos(o.pitch) * o.dist,
    );
    this.goal.fov = 42;
  }

  // --- cinematic shots -------------------------------------------------------------
  // shot: { pos: fn|Vector3, look: fn|Vector3, fov, dur, cut }
  play(shot) {
    this.shot = { ...shot, t: 0 };
    if (shot.cut && !this.reduced) {
      this.pos.copy(resolve(shot.pos));
      this.look.copy(resolve(shot.look));
      this.vel.set(0, 0, 0);
      this.lookVel.set(0, 0, 0);
    }
  }

  // Broadside: over the firing ship's shoulder — from above her far quarter,
  // looking across her deck and smoke at the target taking the hits.
  broadsideShot(fromV, toV, side, dur) {
    return {
      pos: () => {
        const f = fromV.root.position;
        const toT = toV.root.position.clone().sub(f).setY(0);
        const d = Math.max(1, toT.length());
        toT.multiplyScalar(1 / d);
        const across = new THREE.Vector3(-toT.z, 0, toT.x);
        return f.clone().addScaledVector(toT, -(fromV.L * 1.25 + 18)).addScaledVector(across, fromV.L * 0.55).setY(fromV.dim.F + 22);
      },
      look: () => toV.root.position.clone().lerp(fromV.root.position, 0.3).setY(8),
      fov: 40, dur, cut: true,
    };
  }

  // Rake: from beyond the target's stern (or bow), down its length at the shooter.
  rakeShot(fromV, toV, dur) {
    return {
      pos: () => {
        const t = toV.root.position;
        const dirToShooter = fromV.root.position.clone().sub(t).setY(0).normalize();
        const side = new THREE.Vector3(-dirToShooter.z, 0, dirToShooter.x);
        return t.clone().addScaledVector(dirToShooter, -toV.L * 0.9).addScaledVector(side, 6).setY(9);
      },
      look: () => fromV.root.position.clone().setY(8),
      fov: 34, dur, cut: true,
    };
  }

  establishShot(center, radius, dur, yaw = 0.7) {
    const d = Math.max(160, radius * 2.1);
    return {
      pos: () => center.clone().add(new THREE.Vector3(Math.sin(yaw) * d, d * 0.42, Math.cos(yaw) * d)),
      look: () => center.clone().setY(10),
      fov: 42, dur,
    };
  }

  followShot(v, dur) {
    return {
      pos: () => {
        const p = v.root.position;
        const yaw = v.root.rotation.y;
        return p.clone().add(new THREE.Vector3(Math.sin(yaw) * v.L * 2.3 + Math.cos(yaw) * v.L * 1.2, v.L * 0.55, Math.cos(yaw) * v.L * 2.3 - Math.sin(yaw) * v.L * 1.2));
      },
      look: () => v.root.position.clone().setY(16),
      fov: 44, dur,
    };
  }

  impactShot(toV, dur) {
    return {
      pos: () => {
        const p = toV.root.position;
        const yaw = toV.root.rotation.y + 2.2;
        return p.clone().add(new THREE.Vector3(Math.sin(yaw) * toV.L * 1.4, 12, Math.cos(yaw) * toV.L * 1.4));
      },
      look: () => toV.root.position.clone().setY(10),
      fov: 40, dur,
    };
  }

  addShake(a) { if (!this.reduced) this.shake = Math.min(1.2, this.shake + a); }

  update(dt) {
    if (this.mode === 'tactical') {
      const c = this.tactical.center;
      this.ortho.position.set(c.x, 2000, c.z + 0.001);
      this.ortho.up.set(0, 0, -1);
      this.ortho.lookAt(c.x, 0, c.z);
      return;
    }
    if (this.mode === 'cinematic' && this.shot) {
      this.shot.t += dt;
      this.goal.pos.copy(resolve(this.shot.pos));
      this.goal.look.copy(resolve(this.shot.look));
      this.goal.fov = this.shot.fov || 42;
    } else {
      this.orbitGoal();
    }
    // critically damped spring toward the goal
    const k = this.mode === 'cinematic' ? (this.reduced ? 2.2 : 3.2) : 7;
    spring(this.pos, this.vel, this.goal.pos, k, dt);
    spring(this.look, this.lookVel, this.goal.look, k * 1.3, dt);
    this.fov += (this.goal.fov - this.fov) * Math.min(1, dt * 2);
    const cam = this.persp;
    cam.position.copy(this.pos);
    if (this.shake > 0) {
      const s = this.shake * 0.6;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    cam.position.y = Math.max(cam.position.y, 2.5);
    cam.fov = this.fov;
    cam.updateProjectionMatrix();
    cam.lookAt(this.look);
  }
}

function resolve(v) { return typeof v === 'function' ? v() : v; }

function spring(x, v, goal, k, dt) {
  // x'' = -2k x' - k^2 (x - goal)  (critically damped)
  const ax = -2 * k * v.x - k * k * (x.x - goal.x);
  const ay = -2 * k * v.y - k * k * (x.y - goal.y);
  const az = -2 * k * v.z - k * k * (x.z - goal.z);
  v.x += ax * dt; v.y += ay * dt; v.z += az * dt;
  x.x += v.x * dt; x.y += v.y * dt; x.z += v.z * dt;
}
