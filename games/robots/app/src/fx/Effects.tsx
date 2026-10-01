// Every transient effect in the scene, driven by fxBus events:
//   impact    — flash, sparks, tumbling debris, a shockwave on the floor,
//               a puff of smoke; bigger along a chain, duller into scrap
//   teleport  — a column of light where you left and where you land, a
//               streak of light arcing from one to the other, a hologram
//               ghost fading at the old square, rising motes
//   spawn     — a thin red beam as each new robot is beamed down
//   death     — a big magenta flash, sparks and smoke on your square
//   wrecks    — every heap keeps smouldering: smoke and the odd ember
// Particles are GPU points with a tiny shader (sizes in world units for the
// orthographic camera); debris is instanced; rings, beams and ghosts come
// from small reusable pools.

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CapsuleGeometry, Color, CylinderGeometry, DoubleSide,
  Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, NormalBlending,
  Object3D, OrthographicCamera, Points, RingGeometry, ShaderMaterial,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { fxBus, type FxEvent } from './bus';
import { vclock } from './clock';
import { quality } from './store';
import { GRID_HEIGHT, GRID_WIDTH, type Position } from '../game/state';

const OX = -(GRID_WIDTH - 1) / 2, OZ = -(GRID_HEIGHT - 1) / 2, FLOOR = 0.125;
const wx = (p: Position) => p.x + OX, wz = (p: Position) => p.y + OZ;

// ------------------------------------------------------------------ points

const PT_VERT = /* glsl */ `
attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
uniform float uScale;
varying float vAlpha; varying vec3 vColor;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // pull the sprite toward the camera by its radius so the floor does not
  // slice a flat edge through it (orthographic: depth only, no shift)
  mv.z += aSize * 0.6;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale;
  vAlpha = aAlpha; vColor = aColor;
}`;
const PT_FRAG_ADD = /* glsl */ `
varying float vAlpha; varying vec3 vColor;
void main(){
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.0, r);
  a = a * a;
  if (a * vAlpha < 0.004) discard;
  gl_FragColor = vec4(vColor * a * vAlpha, 1.0);
}`;
const PT_FRAG_SMOKE = /* glsl */ `
varying float vAlpha; varying vec3 vColor;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9, 78.2))) * 43758.5); }
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  float n = h(floor(gl_PointCoord * 6.0));
  float a = smoothstep(1.0, 0.25, r) * (0.75 + 0.25 * n);
  if (a * vAlpha < 0.004) discard;
  gl_FragColor = vec4(vColor, a * vAlpha);
}`;

export type P = { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; s0: number; s1: number; a: number; c: Color; g: number; drag: number };

export class PointPool {
  pts: P[] = [];
  geo: BufferGeometry;
  obj: Points;
  mat: ShaderMaterial;
  constructor(public cap: number, additive: boolean) {
    this.geo = new BufferGeometry();
    this.geo.setAttribute('position', new BufferAttribute(new Float32Array(cap * 3), 3));
    this.geo.setAttribute('aSize', new BufferAttribute(new Float32Array(cap), 1));
    this.geo.setAttribute('aAlpha', new BufferAttribute(new Float32Array(cap), 1));
    this.geo.setAttribute('aColor', new BufferAttribute(new Float32Array(cap * 3), 3));
    this.mat = new ShaderMaterial({
      vertexShader: PT_VERT, fragmentShader: additive ? PT_FRAG_ADD : PT_FRAG_SMOKE,
      uniforms: { uScale: { value: 30 } }, transparent: true, depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending, toneMapped: false,
    });
    this.obj = new Points(this.geo, this.mat);
    this.obj.frustumCulled = false;
    this.obj.renderOrder = additive ? 20 : 19;
  }
  /** `delay` (s) holds the particle back, invisible and still, before it starts. */
  add(p: Omit<P, 'age'>, delay = 0) { if (this.pts.length < this.cap) this.pts.push({ ...p, age: -delay }); }
  update(dt: number) {
    const pos = this.geo.attributes.position as BufferAttribute, size = this.geo.attributes.aSize as BufferAttribute;
    const al = this.geo.attributes.aAlpha as BufferAttribute, col = this.geo.attributes.aColor as BufferAttribute;
    let w = 0;
    for (const p of this.pts) {
      p.age += dt;
      if (p.age >= p.life) continue;
      if (p.age < 0) { this.pts[w++] = p; continue; }
      p.vy += p.g * dt;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vz *= k; if (p.drag > 0) p.vy *= k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < FLOOR && p.g < 0) { p.y = FLOOR; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }
      this.pts[w++] = p;
    }
    this.pts.length = w;
    for (let i = 0; i < this.cap; i++) {
      if (i < w) {
        const p = this.pts[i], t = Math.max(0, p.age) / p.life;
        pos.setXYZ(i, p.x, p.y, p.z);
        size.setX(i, p.s0 + (p.s1 - p.s0) * t);
        al.setX(i, p.age < 0 ? 0 : p.a * (1 - t) * Math.min(1, p.age * 20));
        col.setXYZ(i, p.c.r, p.c.g, p.c.b);
      } else al.setX(i, 0);
    }
    pos.needsUpdate = size.needsUpdate = al.needsUpdate = col.needsUpdate = true;
    this.geo.setDrawRange(0, Math.max(w, 1));
  }
}

// ------------------------------------------------------------------ beams, rings, ghosts

const BEAM_FRAG = /* glsl */ `
varying vec2 vUv; uniform float uTime, uAlpha; uniform vec3 uColor;
void main(){
  float fade = pow(1.0 - vUv.y, 1.6);
  float bands = 0.65 + 0.35 * sin(vUv.y * 40.0 - uTime * 12.0);
  float edge = 0.5 + 0.5 * cos((vUv.x - 0.5) * 6.2831);
  gl_FragColor = vec4(uColor * fade * bands * (0.4 + edge) * uAlpha, 1.0);
}`;
const GHOST_FRAG = /* glsl */ `
varying vec2 vUv; varying vec3 vN; uniform float uTime, uAlpha;
void main(){
  float fres = pow(1.0 - abs(vN.z), 1.5);
  float scan = 0.6 + 0.4 * step(0.5, fract(vUv.y * 30.0 - uTime * 3.0));
  gl_FragColor = vec4(vec3(0.35, 0.85, 1.0) * (0.25 + fres) * scan * uAlpha, 1.0);
}`;
const VERT_UV = /* glsl */ `varying vec2 vUv; varying vec3 vN; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

type Timed = { mesh: Mesh; t0: number; dur: number; kind: string; delay: number; scaleTo?: number };

const tmpM = new Matrix4();
const tmpO = new Object3D();

export function Effects({ piles }: Readonly<{ piles: ReadonlyArray<{ x: number; y: number; bornAt: number }> }>) {
  const { camera, size, gl } = useThree();
  const add = useMemo(() => new PointPool(1400, true), []);
  const smoke = useMemo(() => new PointPool(700, false), []);
  const debris = useMemo(() => {
    const m = new InstancedMesh(new RoundedBoxGeometry(0.11, 0.07, 0.09, 1, 0.02), new MeshStandardMaterial({ color: '#b08a1e', metalness: 0.6, roughness: 0.45 }), 160);
    m.count = 0; m.frustumCulled = false; m.castShadow = true;
    return m;
  }, []);
  const chunks = useRef<Array<{ x: number; y: number; z: number; vx: number; vy: number; vz: number; rx: number; ry: number; wx: number; wy: number; age: number; life: number }>>([]);
  const group = useRef<Group>(null);
  const timed = useRef<Timed[]>([]);
  const last = useRef(vclock.t);
  const pools = useMemo(() => {
    const ringGeo = new RingGeometry(0.85, 1, 64);
    const beamGeo = new CylinderGeometry(0.42, 0.42, 7, 28, 1, true);
    beamGeo.translate(0, 3.5, 0);
    const ghostGeo = new CapsuleGeometry(0.22, 0.75, 6, 16);
    const mk = (n: number, fn: () => Mesh) => Array.from({ length: n }, fn);
    return {
      rings: mk(14, () => new Mesh(ringGeo, new MeshBasicMaterial({ color: '#ffb35c', transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false }))),
      beams: mk(20, () => new Mesh(beamGeo, new ShaderMaterial({ vertexShader: VERT_UV, fragmentShader: BEAM_FRAG, uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 }, uColor: { value: new Color('#6fe3ff') } }, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false }))),
      ghosts: mk(3, () => new Mesh(ghostGeo, new ShaderMaterial({ vertexShader: VERT_UV, fragmentShader: GHOST_FRAG, uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 } }, transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false }))),
    };
  }, []);

  useEffect(() => {
    const g = group.current;
    if (!g) return;
    g.add(add.obj, smoke.obj, debris);
    for (const list of [pools.rings, pools.beams, pools.ghosts]) for (const m of list) { m.visible = false; m.frustumCulled = false; m.renderOrder = 10; g.add(m); }
    return () => { g.clear(); };
  }, [add, smoke, debris, pools]);

  const take = (list: Mesh[]) => list.find((m) => !m.visible) ?? list[0];
  const start = (list: Mesh[], kind: string, x: number, y: number, z: number, dur: number, delay = 0, scaleTo = 1, color?: string) => {
    const m = take(list);
    m.position.set(x, y, z);
    m.visible = true;
    if (kind === 'ring') m.rotation.set(-Math.PI / 2, 0, 0);
    const mat = m.material as MeshBasicMaterial & ShaderMaterial;
    if (color) { if (mat.color) mat.color.set(color); if (mat.uniforms?.uColor) mat.uniforms.uColor.value.set(color); }
    timed.current = timed.current.filter((t) => t.mesh !== m);
    timed.current.push({ mesh: m, t0: vclock.t, dur, kind, delay, scaleTo });
  };

  const col = (hex: string) => new Color(hex);
  const burst = (x: number, y: number, z: number, n: number, speed: number, color: string, s0 = 0.14, life = 0.7, g = -11) => {
    const c = col(color);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, up = 0.2 + Math.random() * 0.9, v = speed * (0.4 + Math.random() * 0.8);
      add.add({ x, y, z, vx: Math.cos(a) * v * (1 - up * 0.5), vy: v * up, vz: Math.sin(a) * v * (1 - up * 0.5), life: life * (0.5 + Math.random()), s0, s1: s0 * 0.3, a: 1.4, c, g, drag: 0.8 });
    }
  };
  const puff = (x: number, y: number, z: number, n: number, color = '#3a3f47', s = 0.9, life = 1.8, alpha = 0.55) => {
    const c = col(color);
    for (let i = 0; i < n; i++) {
      smoke.add({ x: x + (Math.random() - 0.5) * 0.4, y: y + Math.random() * 0.2, z: z + (Math.random() - 0.5) * 0.4, vx: (Math.random() - 0.5) * 0.6, vy: 0.4 + Math.random() * 0.5, vz: (Math.random() - 0.5) * 0.6, life: life * (0.7 + Math.random() * 0.6), s0: s * 0.5, s1: s * 1.8, a: alpha, c, g: 0, drag: 0.9 });
    }
  };

  useEffect(() => fxBus.on((e: FxEvent) => {
    const lowK = quality.low ? 0.45 : 1;
    if (e.type === 'impact') {
      const x = wx(e.at), z = wz(e.at), y = FLOOR + 0.55;
      const big = Math.min(3, e.count + e.chain * 0.15);
      add.add({ x, y, z, vx: 0, vy: 0, vz: 0, life: 0.24, s0: 2.6 + big, s1: 4 + big, a: 2.2, c: col(e.onPile ? '#ffb070' : '#fff1c9'), g: 0, drag: 0 });
      burst(x, y, z, Math.round((e.onPile ? 14 : 26) * big * lowK), 6.5, '#ffb347');
      burst(x, y, z, Math.round(8 * big * lowK), 4, '#ff5a1f', 0.1, 0.9);
      const n = Math.round((e.onPile ? 3 : 7) * e.count * lowK);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 3.5;
        chunks.current.push({ x, y, z, vx: Math.cos(a) * v, vy: 3 + Math.random() * 4, vz: Math.sin(a) * v, rx: 0, ry: 0, wx: (Math.random() - 0.5) * 20, wy: (Math.random() - 0.5) * 20, age: 0, life: 1.6 + Math.random() });
      }
      start(pools.rings, 'ring', x, FLOOR + 0.03, z, e.onPile ? 0.5 : 0.65, 0, e.onPile ? 1.8 : 2.8 + big * 0.5, e.onPile ? '#ff8a3d' : '#ffc46b');
      puff(x, FLOOR + 0.3, z, Math.round((e.onPile ? 9 : 6) * lowK), e.onPile ? '#4a4540' : '#353a42', 1.1);
    } else if (e.type === 'teleport') {
      const fx = wx(e.from), fz = wz(e.from), tx = wx(e.to), tz = wz(e.to);
      start(pools.beams, 'beam', fx, FLOOR, fz, 0.7, 0, 1, '#6fe3ff');
      start(pools.beams, 'beam', tx, FLOOR, tz, 0.9, 0.2, 1, '#b9f3ff');
      start(pools.ghosts, 'ghost', fx, FLOOR + 0.62, fz, 1.4);
      start(pools.rings, 'ring', fx, FLOOR + 0.03, fz, 0.5, 0, 1.6, '#6fe3ff');
      start(pools.rings, 'ring', tx, FLOOR + 0.03, tz, 0.7, 0.2, 2.6, '#b9f3ff');
      const c = col('#9fefff'), core = col('#e8fbff');
      // flashes: out, then in
      add.add({ x: fx, y: FLOOR + 0.6, z: fz, vx: 0, vy: 0, vz: 0, life: 0.3, s0: 2.4, s1: 0.6, a: 2, c: core, g: 0, drag: 0 });
      add.add({ x: tx, y: FLOOR + 0.6, z: tz, vx: 0, vy: 0, vz: 0, life: 0.35, s0: 0.8, s1: 3, a: 2, c: core, g: 0, drag: 0 }, 0.2);
      // the streak: a string of light arcing from where you were to where you land
      const dist = Math.hypot(tx - fx, tz - fz), hArc = 1.2 + dist * 0.18, N = Math.round((40 + dist * 5) * lowK);
      for (let i = 0; i <= N; i++) {
        const k = i / N, y = FLOOR + 0.6 + Math.sin(Math.PI * k) * hArc;
        add.add({ x: fx + (tx - fx) * k, y, z: fz + (tz - fz) * k, vx: 0, vy: 0, vz: 0, life: 0.5, s0: 0.7, s1: 0.1, a: 2.2, c: k > 0.9 ? core : c, g: 0, drag: 0 }, k * 0.2);
        // a few sparks shed along the way
        if (i % 4 === 0) add.add({ x: fx + (tx - fx) * k, y, z: fz + (tz - fz) * k, vx: (Math.random() - 0.5) * 1.5, vy: -0.5 - Math.random(), vz: (Math.random() - 0.5) * 1.5, life: 0.6, s0: 0.12, s1: 0.03, a: 1.6, c, g: -3, drag: 0.5 }, k * 0.2);
      }
      for (const [x, z, d] of [[fx, fz, 0], [tx, tz, 0.2]]) {
        for (let i = 0; i < 26 * lowK; i++) add.add({ x: x + (Math.random() - 0.5) * 0.7, y: FLOOR + Math.random() * 0.4, z: z + (Math.random() - 0.5) * 0.7, vx: 0, vy: 1.5 + Math.random() * 2.5, vz: 0, life: 0.6 + Math.random() * 0.5, s0: 0.09, s1: 0.03, a: 1.3, c, g: 0, drag: 0.5 }, d);
      }
    } else if (e.type === 'spawn') {
      start(pools.beams, 'spawn', wx(e.at), FLOOR, wz(e.at), 0.45, e.delay, 1, '#ff4d7e');
    } else if (e.type === 'death') {
      const x = wx(e.at), z = wz(e.at), y = FLOOR + 0.6;
      add.add({ x, y, z, vx: 0, vy: 0, vz: 0, life: 0.4, s0: 5, s1: 8, a: 2.5, c: col('#ff3d8b'), g: 0, drag: 0 });
      burst(x, y, z, Math.round(46 * lowK), 7, '#ff5fa2');
      burst(x, y, z, Math.round(20 * lowK), 5, '#ffd28a', 0.1, 1);
      start(pools.rings, 'ring', x, FLOOR + 0.03, z, 0.9, 0, 4.5, '#ff3d8b');
      puff(x, FLOOR + 0.4, z, Math.round(12 * lowK), '#2d2f36', 1.4, 2.4);
    }
  }), [add, smoke, pools]);

  useFrame(() => {
    const t = vclock.t;
    const dt = Math.max(0, Math.min(0.05, t - last.current));
    last.current = t;
    if (camera instanceof OrthographicCamera) {
      const s = camera.zoom * gl.getPixelRatio();
      add.mat.uniforms.uScale.value = s;
      smoke.mat.uniforms.uScale.value = s;
    }
    // wrecks smoulder
    const rate = quality.low ? 0.8 : 2.2;
    for (const p of piles) {
      if (p.bornAt > t) continue;
      if (Math.random() < rate * dt) puff(p.x + OX, FLOOR + 0.5, p.y + OZ, 1, '#2f3238', 0.8, 2.6, 0.38);
      if (Math.random() < rate * 0.5 * dt) {
        const c = col('#ff7a2a');
        add.add({ x: p.x + OX + (Math.random() - 0.5) * 0.3, y: FLOOR + 0.35, z: p.y + OZ + (Math.random() - 0.5) * 0.3, vx: (Math.random() - 0.5) * 0.3, vy: 0.8 + Math.random(), vz: (Math.random() - 0.5) * 0.3, life: 0.9, s0: 0.07, s1: 0.02, a: 1.4, c, g: 0.2, drag: 0.2 });
      }
    }
    add.update(dt);
    smoke.update(dt);
    // debris
    const list = chunks.current;
    let w = 0;
    for (const c of list) {
      c.age += dt;
      if (c.age >= c.life) continue;
      c.vy -= 13 * dt;
      c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      c.rx += c.wx * dt; c.ry += c.wy * dt;
      if (c.y < FLOOR + 0.035) { c.y = FLOOR + 0.035; c.vy *= -0.3; c.vx *= 0.55; c.vz *= 0.55; c.wx *= 0.5; c.wy *= 0.5; }
      list[w++] = c;
    }
    list.length = w;
    debris.count = Math.min(w, 160);
    for (let i = 0; i < debris.count; i++) {
      const c = list[i];
      const k = Math.min(1, (c.life - c.age) * 3);
      tmpO.position.set(c.x, c.y, c.z);
      tmpO.rotation.set(c.rx, c.ry, 0);
      tmpO.scale.setScalar(k);
      tmpO.updateMatrix();
      debris.setMatrixAt(i, tmpO.matrix);
    }
    debris.instanceMatrix.needsUpdate = true;
    // rings, beams, ghosts
    timed.current = timed.current.filter((it) => {
      const m = it.mesh;
      const k = (t - it.t0 - it.delay) / it.dur;
      if (k < 0) { m.visible = false; return true; }
      if (k >= 1) { m.visible = false; return false; }
      m.visible = true;
      const mat = m.material as MeshBasicMaterial & ShaderMaterial;
      if (it.kind === 'ring') {
        m.scale.setScalar(0.2 + (it.scaleTo ?? 1) * Math.sqrt(k));
        mat.opacity = (1 - k) * 0.9;
      } else if (it.kind === 'beam' || it.kind === 'spawn') {
        const grow = Math.min(1, k * 5);
        m.scale.set(it.kind === 'spawn' ? 0.6 : 1 - k * 0.5, grow * (it.kind === 'spawn' ? 0.6 : 1), it.kind === 'spawn' ? 0.6 : 1 - k * 0.5);
        mat.uniforms.uAlpha.value = (1 - k) * (it.kind === 'spawn' ? 1.6 : 2.6);
        mat.uniforms.uTime.value = t;
      } else if (it.kind === 'ghost') {
        mat.uniforms.uAlpha.value = (1 - k) * 1.2;
        mat.uniforms.uTime.value = t;
        m.position.y += 0.002;
      }
      return true;
    });
    void size; void tmpM;
  });

  return <group ref={group} />;
}
