// Effects: every one of them is triggered by an engine event (render/
// director.js). Additive particles (sparks, embers, shards, droplets),
// lit debris chunks, shockwave rings, flash sprites, respawn beams and a
// pool of dynamic point lights the floor/wall/actor shaders read.

import * as THREE from 'three';
import { NOISE, LIGHTS as LIGHTS_SRC, BEAM as BEAM_SRC } from './glsl.js';

const MAXP = 7000;

export class Particles {
  constructor() {
    const quad = new THREE.PlaneGeometry(1, 1);
    const ig = new THREE.InstancedBufferGeometry();
    ig.index = quad.index;
    ig.attributes.position = quad.attributes.position;
    ig.attributes.uv = quad.attributes.uv;
    this.pos = new Float32Array(MAXP * 3);
    this.vel = new Float32Array(MAXP * 3);
    this.life = new Float32Array(MAXP);
    this.max = new Float32Array(MAXP);
    this.size = new Float32Array(MAXP);
    this.col = new Float32Array(MAXP * 3);
    this.drag = new Float32Array(MAXP);
    this.grav = new Float32Array(MAXP);
    this.stretch = new Float32Array(MAXP);
    this.bounce = new Float32Array(MAXP);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(MAXP * 4), 4); // xyz, size
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(MAXP * 4), 4); // rgb, alpha
    this.aVel = new THREE.InstancedBufferAttribute(new Float32Array(MAXP * 4), 4); // velocity dir, stretch
    for (const a of [this.aPos, this.aCol, this.aVel]) a.setUsage(THREE.DynamicDrawUsage);
    ig.setAttribute('aPos', this.aPos);
    ig.setAttribute('aCol', this.aCol);
    ig.setAttribute('aVel', this.aVel);
    ig.instanceCount = 0;
    this.geo = ig;
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {},
      vertexShader: /* glsl */ `
        attribute vec4 aPos;
        attribute vec4 aCol;
        attribute vec4 aVel;
        varying vec2 vUv;
        varying vec4 vCol;
        void main() {
          vUv = uv;
          vCol = aCol;
          vec4 c = viewMatrix * vec4(aPos.xyz, 1.0);
          vec3 vv = (viewMatrix * vec4(aVel.xyz, 0.0)).xyz;
          vec2 dir = length(vv.xy) > 1e-4 ? normalize(vv.xy) : vec2(1.0, 0.0);
          vec2 perp = vec2(-dir.y, dir.x);
          float len = aPos.w * (1.0 + aVel.w * length(aVel.xyz));
          vec2 off = dir * position.x * len + perp * position.y * aPos.w;
          c.xy += off;
          gl_Position = projectionMatrix * c;
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying vec4 vCol;
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = dot(p, p);
          float g = exp(-r * 3.0) * (1.0 - smoothstep(0.7, 1.0, r));
          gl_FragColor = vec4(vCol.rgb * g * vCol.a, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
    this.n = 0;
    this.scale = 1;
  }

  emit(o) {
    if (this.scale < 1 && Math.random() > this.scale) return;
    let i = this.n;
    if (i >= MAXP) {
      i = Math.floor(Math.random() * MAXP); // recycle
    } else this.n++;
    this.pos[i * 3] = o.x; this.pos[i * 3 + 1] = o.y; this.pos[i * 3 + 2] = o.z;
    this.vel[i * 3] = o.vx || 0; this.vel[i * 3 + 1] = o.vy || 0; this.vel[i * 3 + 2] = o.vz || 0;
    this.life[i] = o.life;
    this.max[i] = o.life;
    this.size[i] = o.size;
    this.col[i * 3] = o.r; this.col[i * 3 + 1] = o.g; this.col[i * 3 + 2] = o.b;
    this.drag[i] = o.drag ?? 2;
    this.grav[i] = o.grav ?? 0;
    this.stretch[i] = o.stretch ?? 0;
    this.bounce[i] = o.bounce ?? 0;
  }

  // helpers
  burst(x, y, z, n, speed, col, { life = 0.6, size = 0.08, up = 1.5, grav = -6, stretch = 0.08, drag = 1.5, spread = 1 } = {}) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.9);
      this.emit({
        x, y, z,
        vx: Math.cos(a) * s * spread, vy: up * (0.3 + Math.random()) , vz: Math.sin(a) * s * spread,
        life: life * (0.6 + Math.random() * 0.7), size: size * (0.6 + Math.random() * 0.8),
        r: col.r, g: col.g, b: col.b, grav, stretch, drag, bounce: 0.35,
      });
    }
  }

  update(dt) {
    let j = 0;
    const P = this.aPos.array;
    const C = this.aCol.array;
    const Vv = this.aVel.array;
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) continue;
      // compact in place
      if (j !== i) {
        for (let k = 0; k < 3; k++) {
          this.pos[j * 3 + k] = this.pos[i * 3 + k];
          this.vel[j * 3 + k] = this.vel[i * 3 + k];
          this.col[j * 3 + k] = this.col[i * 3 + k];
        }
        this.life[j] = this.life[i]; this.max[j] = this.max[i]; this.size[j] = this.size[i];
        this.drag[j] = this.drag[i]; this.grav[j] = this.grav[i]; this.stretch[j] = this.stretch[i];
        this.bounce[j] = this.bounce[i];
      }
      const d = Math.exp(-this.drag[j] * dt);
      this.vel[j * 3] *= d;
      this.vel[j * 3 + 2] *= d;
      this.vel[j * 3 + 1] = this.vel[j * 3 + 1] * d + this.grav[j] * dt;
      this.pos[j * 3] += this.vel[j * 3] * dt;
      this.pos[j * 3 + 1] += this.vel[j * 3 + 1] * dt;
      this.pos[j * 3 + 2] += this.vel[j * 3 + 2] * dt;
      if (this.pos[j * 3 + 1] < 0.02) {
        this.pos[j * 3 + 1] = 0.02;
        this.vel[j * 3 + 1] = -this.vel[j * 3 + 1] * this.bounce[j];
      }
      const t = this.life[j] / this.max[j];
      const a = Math.min(1, t * 2.5) * (t > 0.85 ? (1 - t) / 0.15 : 1);
      P[j * 4] = this.pos[j * 3]; P[j * 4 + 1] = this.pos[j * 3 + 1]; P[j * 4 + 2] = this.pos[j * 3 + 2];
      P[j * 4 + 3] = this.size[j] * (0.5 + 0.5 * t);
      C[j * 4] = this.col[j * 3]; C[j * 4 + 1] = this.col[j * 3 + 1]; C[j * 4 + 2] = this.col[j * 3 + 2];
      C[j * 4 + 3] = a;
      Vv[j * 4] = this.vel[j * 3]; Vv[j * 4 + 1] = this.vel[j * 3 + 1]; Vv[j * 4 + 2] = this.vel[j * 3 + 2];
      Vv[j * 4 + 3] = this.stretch[j];
      j++;
    }
    this.n = j;
    this.geo.instanceCount = j;
    this.aPos.needsUpdate = true;
    this.aCol.needsUpdate = true;
    this.aVel.needsUpdate = true;
  }
}

// Lit debris: chunks of masonry that tumble, bounce and settle, then fade.
export class Debris {
  constructor(lightUniforms, shared, max = 420) {
    const geo = new THREE.BoxGeometry(0.1, 0.08, 0.09);
    this.heat = new THREE.InstancedBufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aHeat', this.heat);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { ...lightUniforms, ...shared, uCol: { value: new THREE.Color(0x4a4a52) } },
      vertexShader: /* glsl */ `
        attribute float aHeat;
        varying vec3 vW; varying vec3 vN; varying float vHeat;
        void main() {
          vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vW = w.xyz;
          vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
          vHeat = aHeat;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCol;
        varying vec3 vW; varying vec3 vN; varying float vHeat;
        ${LIGHTS_SRC}
        ${BEAM_SRC}
        void main() {
          vec3 n = normalize(vN);
          vec3 c = uCol * (beamLight(vW, n, 1.0) + pointLights(vW, n) + 0.12);
          c += vec3(1.0, 0.4, 0.12) * vHeat * vHeat * vHeat * 0.9;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.items = [];
    this.max = max;
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.s = new THREE.Vector3();
    this.p = new THREE.Vector3();
    void lightUniforms;
  }

  chunk(x, y, z, vx, vy, vz, size = 1) {
    if (this.items.length >= this.max) this.items.shift();
    this.items.push({ x, y, z, vx, vy, vz, rx: Math.random() * 6, ry: Math.random() * 6, wx: (Math.random() - 0.5) * 14, wy: (Math.random() - 0.5) * 14, life: 1.1 + Math.random() * 0.7, t: 0, size });
  }

  update(dt) {
    let n = 0;
    this.items = this.items.filter((d) => (d.life -= dt) > 0);
    for (const d of this.items) {
      d.vy -= 11 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      if (d.y < 0.06) { d.y = 0.06; d.vy *= -0.3; d.vx *= 0.6; d.vz *= 0.6; d.wx *= 0.6; d.wy *= 0.6; }
      d.rx += d.wx * dt; d.ry += d.wy * dt;
      d.t += dt;
      const sc = d.size * Math.min(1, d.life / 0.5);
      this.heat.array[n] = Math.max(0, 1 - d.t / 0.3);
      this.e.set(d.rx, d.ry, 0);
      this.q.setFromEuler(this.e);
      this.s.set(sc, sc, sc);
      this.p.set(d.x, d.y, d.z);
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(n++, this.m);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.heat.needsUpdate = true;
  }
}

// Expanding rings on the floor (blast shockwaves, landing, respawn).
export class Rings {
  constructor(max = 48) {
    this.pool = [];
    this.group = new THREE.Group();
    const geo = new THREE.PlaneGeometry(2, 2);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < max; i++) {
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uCol: { value: new THREE.Color() }, uK: { value: 0 }, uW: { value: 0.1 } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uCol; uniform float uK, uW; varying vec2 vUv;
          void main() {
            float r = length(vUv - 0.5) * 2.0;
            float q = (r - 0.92) / max(uW, 0.01);
            float ring = exp(-q * q);
            float fill = smoothstep(0.95, 0.2, r) * 0.12;
            gl_FragColor = vec4(uCol * (ring + fill) * (1.0 - uK), 1.0);
          }`,
      });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      m.renderOrder = 15;
      this.group.add(m);
      this.pool.push({ m, t0: 0, dur: 0, r: 0, y: 0 });
    }
    this.i = 0;
  }

  spawn(x, z, radius, color, time, dur = 0.5, width = 0.12, y = 0.05) {
    const r = this.pool[this.i++ % this.pool.length];
    r.m.visible = true;
    r.m.position.set(x, y, z);
    r.m.material.uniforms.uCol.value.set(color);
    r.m.material.uniforms.uW.value = width;
    r.t0 = time;
    r.dur = dur;
    r.r = radius;
  }

  update(time) {
    for (const r of this.pool) {
      if (!r.m.visible) continue;
      const k = (time - r.t0) / r.dur;
      if (k >= 1 || k < 0) { r.m.visible = k < 0; continue; }
      const e = 1 - Math.pow(1 - k, 2.5);
      r.m.scale.setScalar(Math.max(0.01, r.r * e));
      r.m.material.uniforms.uK.value = k;
    }
  }
}

// Big soft additive sprites: explosion cores, muzzle flashes, lava glow.
export class Flashes {
  constructor(max = 64) {
    this.pool = [];
    this.group = new THREE.Group();
    const geo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < max; i++) {
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
        uniforms: { uCol: { value: new THREE.Color() }, uA: { value: 0 } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; vec4 c = modelViewMatrix * vec4(0.0,0.0,0.0,1.0); c.xy += position.xy * vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz)); gl_Position = projectionMatrix * c; }`,
        fragmentShader: /* glsl */ `uniform vec3 uCol; uniform float uA; varying vec2 vUv;
          void main(){ float r = length(vUv-0.5)*2.0; float g = exp(-r*r*4.0) + exp(-r*r*40.0)*1.5; gl_FragColor = vec4(uCol*g*uA,1.0); }`,
      });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      m.renderOrder = 30;
      this.group.add(m);
      this.pool.push({ m, t0: 0, dur: 0, size: 1, a: 1 });
    }
    this.i = 0;
  }

  spawn(x, y, z, size, color, time, dur = 0.3, a = 1) {
    const f = this.pool[this.i++ % this.pool.length];
    f.m.visible = true;
    f.m.position.set(x, y, z);
    f.m.material.uniforms.uCol.value.set(color);
    f.t0 = time; f.dur = dur; f.size = size; f.a = a;
  }

  update(time) {
    for (const f of this.pool) {
      if (!f.m.visible) continue;
      const k = (time - f.t0) / f.dur;
      if (k >= 1 || k < 0) { f.m.visible = k < 0; continue; }
      f.m.scale.setScalar(f.size * (0.6 + 0.6 * Math.sqrt(k)));
      f.m.material.uniforms.uA.value = f.a * Math.pow(1 - k, 1.6);
    }
  }
}

// Respawn beam: a column of light that lands, then fades.
export class Beams {
  constructor(max = 12) {
    this.pool = [];
    this.group = new THREE.Group();
    const geo = new THREE.CylinderGeometry(0.16, 0.3, 3.4, 24, 1, true);
    geo.translate(0, 1.7, 0);
    for (let i = 0; i < max; i++) {
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uCol: { value: new THREE.Color() }, uK: { value: 0 }, uTime: { value: 0 } },
        vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vP; void main(){ vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `uniform vec3 uCol; uniform float uK, uTime; varying vec2 vUv; varying vec3 vP;
          ${NOISE}
          void main(){
            float drop = smoothstep(0.0, 0.3, uK);
            float front = 3.4 * (1.0 - drop);
            float body = smoothstep(front, front + 0.3, vP.y) * exp(-vP.y * 1.1);
            float streaks = 0.35 + 0.65 * vnoise(vec2(vUv.x * 30.0, vP.y * 1.5 - uTime * 6.0));
            float edge = pow(clamp(abs(vUv.x - 0.5) * 2.0, 0.0, 1.0), 0.5);
            float a = body * streaks * (1.0 - smoothstep(0.45, 1.0, uK)) * (0.3 + 0.7 * edge);
            gl_FragColor = vec4(uCol * a * 0.4, 1.0);
          }`,
      });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      m.renderOrder = 25;
      this.group.add(m);
      this.pool.push({ m, t0: 0, dur: 1 });
    }
    this.i = 0;
  }

  spawn(x, z, color, time, dur = 1.0) {
    const b = this.pool[this.i++ % this.pool.length];
    b.m.visible = true;
    b.m.position.set(x, 0, z);
    b.m.material.uniforms.uCol.value.set(color);
    b.t0 = time; b.dur = dur;
  }

  update(time) {
    for (const b of this.pool) {
      if (!b.m.visible) continue;
      const k = (time - b.t0) / b.dur;
      if (k >= 1 || k < 0) { b.m.visible = k < 0; continue; }
      b.m.material.uniforms.uK.value = k;
      b.m.material.uniforms.uTime.value = time;
    }
  }
}

// Dynamic point lights for the custom shaders (render/glsl.js LIGHTS).
export class LightPool {
  constructor(n = 16) {
    this.pos = Array.from({ length: n }, () => new THREE.Vector4(0, 0, 0, 0));
    this.col = Array.from({ length: n }, () => new THREE.Vector3());
    this.items = [];
    this.uniforms = { uLightPos: { value: this.pos }, uLightCol: { value: this.col } };
  }

  add(x, y, z, radius, color, power, time, dur, persistent = false) {
    const c = new THREE.Color(color);
    this.items.push({ x, y, z, radius, r: c.r * power, g: c.g * power, b: c.b * power, t0: time, dur, persistent });
    if (this.items.length > 64) this.items.shift();
  }

  update(time) {
    this.items = this.items.filter((l) => l.persistent || time - l.t0 < l.dur);
    const ranked = this.items
      .map((l) => ({ l, k: l.persistent ? 1 : Math.max(0, 1 - (time - l.t0) / l.dur) }))
      .filter((o) => time >= o.l.t0)
      .sort((a, b) => b.k * b.l.radius - a.k * a.l.radius)
      .slice(0, this.pos.length);
    for (let i = 0; i < this.pos.length; i++) {
      const o = ranked[i];
      if (!o) { this.pos[i].w = 0; continue; }
      const k = o.k * o.k;
      this.pos[i].set(o.l.x, o.l.y, o.l.z, o.l.radius);
      this.col[i].set(o.l.r * k, o.l.g * k, o.l.b * k);
    }
  }
}

// Fireballs (additive, turbulent, cooling from white-yellow to deep red)
// and smoke (normal blending, dark, rising and spreading) for explosions,
// crumbling masonry and lava. Billboards with noise; no textures.
const FIRE_FRAG = /* glsl */ `
  float edge = 0.45 + 0.5 * uK;
  float body = smoothstep(edge, edge - 0.45, r + (n - 0.5) * 0.7);
  vec3 hot = mix(vec3(1.0, 0.8, 0.48), vec3(1.0, 0.36, 0.06), smoothstep(0.0, 0.6, r + uK * 0.7));
  hot = mix(hot, vec3(0.45, 0.06, 0.02), smoothstep(0.35, 1.0, uK));
  float a = body * (1.0 - smoothstep(0.55, 1.0, uK));
  gl_FragColor = vec4(hot * a * uI * 2.2, 1.0);`;
const SMOKE_FRAG = /* glsl */ `
  float body = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.8);
  float a = body * smoothstep(0.0, 0.15, uK) * (1.0 - smoothstep(0.4, 1.0, uK)) * 0.55 * uI;
  vec3 c = uCol * (0.6 + 0.8 * n);
  gl_FragColor = vec4(c, a);`;

export class Puffs {
  constructor(kind, max = 64) {
    this.kind = kind;
    this.pool = [];
    this.group = new THREE.Group();
    const geo = new THREE.PlaneGeometry(1, 1);
    const fire = kind === 'fire';
    for (let i = 0; i < max; i++) {
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: fire ? THREE.AdditiveBlending : THREE.NormalBlending,
        uniforms: { uK: { value: 0 }, uSeed: { value: Math.random() * 50 }, uI: { value: 1 }, uCol: { value: new THREE.Color() } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; vec4 c = modelViewMatrix * vec4(0.0,0.0,0.0,1.0);
          c.xy += position.xy * vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz)); gl_Position = projectionMatrix * c; }`,
        fragmentShader: /* glsl */ `
          uniform float uK, uSeed, uI; uniform vec3 uCol; varying vec2 vUv;
          ${NOISE}
          void main(){
            vec2 p = vUv * 2.0 - 1.0;
            float r = length(p);
            float n = fbm(p * 2.6 + vec2(uSeed, uSeed * 0.7) + uK * 1.7);
            ${fire ? FIRE_FRAG : SMOKE_FRAG}
          }`,
      });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      m.renderOrder = fire ? 29 : 19;
      this.group.add(m);
      this.pool.push({ m, t0: 0, dur: 1, size: 1, grow: 1, vx: 0, vy: 0, vz: 0 });
    }
    this.i = 0;
  }

  spawn(x, y, z, size, time, { dur = 0.6, grow = 1.6, vx = 0, vy = 0.4, vz = 0, color = 0x1a1a20, intensity = 1 } = {}) {
    // keep puffs inside the arena (a blast by the border must not smoke the void)
    x = Math.max(-24.3, Math.min(24.3, x));
    z = Math.max(-10.3, Math.min(10.3, z));
    const p = this.pool[this.i++ % this.pool.length];
    p.m.visible = true;
    p.m.position.set(x, y, z);
    p.t0 = time; p.dur = dur; p.size = size; p.grow = grow;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.m.material.uniforms.uCol.value.set(color);
    p.m.material.uniforms.uI.value = intensity;
    p.m.material.uniforms.uSeed.value = Math.random() * 50;
  }

  update(time, dt) {
    for (const p of this.pool) {
      if (!p.m.visible) continue;
      const k = (time - p.t0) / p.dur;
      if (k >= 1 || k < 0) {
        p.m.visible = k < 0;
        if (k < 0) p.m.scale.setScalar(0.0001);
        continue;
      }
      p.m.position.x += p.vx * dt;
      p.m.position.y += p.vy * dt;
      p.m.position.z += p.vz * dt;
      p.m.scale.setScalar(p.size * (1 + (p.grow - 1) * Math.sqrt(k)));
      p.m.material.uniforms.uK.value = k;
    }
  }
}
