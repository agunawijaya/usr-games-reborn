// The crowd: one instanced mesh, a person per occupied seat (a couple of
// thousand), animated in the vertex shader from a few mood uniforms
// (src/fx/crowd.ts) and a per-person seed:
//   idle      — seated, a slight sway
//   excited   — some stand, arms go up, they bounce; how strongly each one
//               reacts is their own
//   wave      — a Mexican wave running round the stands
//   celebrate — everyone up, arms up, bouncing
//   boo       — fists shaking; the throwers (the same rule as Trash.tsx)
//               wind up and hurl at their own moment
// Faces and hair are coloured per person in the fragment shader; shirts
// are the instance colour. Phone flashes pop now and then, more when
// celebrating.

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, IcosahedronGeometry, InstancedBufferAttribute,
  InstancedMesh, MeshLambertMaterial, MeshStandardMaterial, Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { vclock } from '../fx/clock';
import { crowd } from '../fx/crowd';
import { quality } from '../fx/store';
import { seats, THROW_SHARE, THROW_SPAN, type Seat } from './stadiumLayout';

// Shirt colours: the home end in cyan, the far end in magenta, a sprinkle
// of robot-yellow (they came for the robots), and everyday colours.
const SHIRTS = ['#4cc9f0', '#3aa6d8', '#ff3a95', '#e0306e', '#ffb703', '#f1f1f1', '#2b2d42', '#8d99ae', '#ef476f', '#06d6a0', '#118ab2', '#f78c6b'];

function personGeometry(detail: number): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const tag = (g: BufferGeometry, part: number) => {
    const ni = g.index ? g.toNonIndexed() : g;
    ni.deleteAttribute('uv');
    ni.setAttribute('part', new Float32BufferAttribute(new Array(ni.attributes.position.count).fill(part), 1));
    parts.push(ni);
  };
  const torso = new BoxGeometry(0.34, 0.42, 0.22); torso.translate(0, 0.47, 0); tag(torso, 0);
  const lap = new BoxGeometry(0.3, 0.14, 0.3); lap.translate(0, 0.2, 0.1); tag(lap, 4);
  const head = new IcosahedronGeometry(0.13, detail); head.translate(0, 0.82, 0); tag(head, 1);
  for (const [side, part] of [[-1, 2], [1, 3]]) {
    const arm = new BoxGeometry(0.085, 0.36, 0.085); arm.translate(side * 0.215, 0.46, 0); tag(arm, part);
  }
  return mergeGeometries(parts)!;
}

const VERT_COMMON = /* glsl */ `
attribute float part; attribute float aSeed; attribute float aAround;
uniform float uTime, uExcite, uCelebrate, uBoo, uWavePos, uWaveOn, uThrowT, uThrowShare, uThrowSpan;
varying float vPart; varying float vSeed; varying float vLocalY;
`;
const VERT_BEGIN = /* glsl */ `
vec3 transformed = vec3(position);
vPart = part; vSeed = aSeed; vLocalY = position.y;
float r1 = fract(aSeed * 91.7), r2 = fract(aSeed * 53.3), r3 = fract(aSeed * 17.9);
float ex = clamp(uExcite * (0.55 + r1 * 0.9) - 0.1, 0.0, 1.0);
float dw = fract(aAround - uWavePos + 0.5) - 0.5;
float wave = uWaveOn * exp(-dw * dw / 0.0012);
float cel = uCelebrate * (0.75 + 0.25 * r2);
float up = max(max(ex, wave), cel);
float bounce = max(0.0, sin(uTime * (6.5 + r2 * 3.0) + aSeed * 40.0));
float lift = smoothstep(0.05, 0.5, max(up, uBoo * 0.8)) * 0.16 + bounce * 0.13 * max(ex, cel) + wave * 0.12;
float arm = mix(0.12, 2.75, up) + sin(uTime * (8.0 + r3 * 4.0) + aSeed * 30.0) * 0.35 * up;
// booing: on their feet, fists pumping up and forward
arm = mix(arm, 2.2 + 0.55 * sin(uTime * (7.0 + r3 * 3.0) + aSeed * 20.0), uBoo * (1.0 - up));
float tt = uThrowT - fract(aSeed * 3.71) * uThrowSpan;
bool throwing = fract(aSeed * 7.13) < uThrowShare && tt > -0.35 && tt < 0.45;
if (part > 1.5 && part < 3.5) {
  float side = part < 2.5 ? -1.0 : 1.0;
  float a = arm * (side < 0.0 ? 1.0 : 0.93 + 0.07 * r1);
  if (throwing && side > 0.0) a = tt < 0.0 ? mix(1.4, 3.6, (tt + 0.35) / 0.35) : mix(3.6, 0.9, clamp(tt / 0.15, 0.0, 1.0));
  vec3 p = transformed - vec3(side * 0.215, 0.64, 0.0);
  float c = cos(a), s = sin(a);
  p = vec3(p.x, p.y * c + p.z * s, -p.y * s + p.z * c);
  transformed = p + vec3(side * 0.215, 0.64, 0.0);
}
transformed.x += sin(uTime * 1.1 + aSeed * 20.0) * 0.015 * (1.0 - up);
transformed.y += lift;
`;
const FRAG_COMMON = /* glsl */ `
varying float vPart; varying float vSeed; varying float vLocalY;
uniform float uTime, uFlash;
`;
const FRAG_COLOR = /* glsl */ `
if (vPart > 0.5 && vPart < 1.5) {
  vec3 skin = mix(vec3(0.87, 0.58, 0.40), vec3(0.14, 0.07, 0.035), fract(vSeed * 13.7));
  vec3 hair = mix(vec3(0.012, 0.008, 0.006), vec3(0.28, 0.13, 0.04), step(0.72, fract(vSeed * 29.3)));
  diffuseColor.rgb = vLocalY > 0.87 ? hair : skin;
} else if (vPart > 3.5) {
  diffuseColor.rgb = vec3(0.02, 0.025, 0.04);
}
`;
const FRAG_EMISSIVE = /* glsl */ `
float fl = step(1.0 - 0.0012 * uFlash, fract(sin((vSeed * 311.0 + floor(uTime * 9.0)) * 12.9898) * 43758.5453));
totalEmissiveRadiance += vec3(3.0) * fl * step(vPart, 0.5);
`;

export function Crowd() {
  const list = useMemo<Seat[]>(() => seats(quality.low ? 0.3 : 1), []);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uExcite: { value: 0 }, uCelebrate: { value: 0 }, uBoo: { value: 0 }, uWavePos: { value: 0 },
    uWaveOn: { value: 0 }, uThrowT: { value: -1e9 }, uThrowShare: { value: THROW_SHARE }, uThrowSpan: { value: THROW_SPAN },
    uFlash: { value: 0.3 },
  }), []);
  const mesh = useMemo(() => {
    const geo = personGeometry(quality.low ? 0 : 1);
    geo.setAttribute('aSeed', new InstancedBufferAttribute(new Float32Array(list.map((s) => s.seed)), 1));
    geo.setAttribute('aAround', new InstancedBufferAttribute(new Float32Array(list.map((s) => s.around)), 1));
    const mat = quality.low ? new MeshLambertMaterial() : new MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\n${VERT_COMMON}`)
        .replace('#include <begin_vertex>', VERT_BEGIN);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\n${FRAG_COMMON}`)
        .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAG_COLOR}`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${FRAG_EMISSIVE}`);
    };
    mat.customProgramCacheKey = () => 'crowd-v1';
    const m = new InstancedMesh(geo, mat, list.length);
    const o = new Object3D(), c = new Color();
    list.forEach((s, i) => {
      o.position.set(s.x, s.y, s.z);
      o.rotation.set(0, s.yaw, 0);
      o.scale.setScalar(0.94 + ((s.seed * 37.1) % 1) * 0.14);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      // sections: cyan fans at the +x end, magenta at the −x end
      const r = (s.seed * 11.3) % 1;
      const home = s.x > 20 ? 0 : s.x < -20 ? 2 : -1;
      const pick = home >= 0 && r < 0.55 ? SHIRTS[home + (r < 0.3 ? 0 : 1)] : SHIRTS[Math.floor(((s.seed * 57.7) % 1) * SHIRTS.length)];
      m.setColorAt(i, c.set(pick));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.frustumCulled = false;
    return m;
  }, [list, uniforms]);

  const last = useRef(vclock.t);
  useFrame(() => {
    const t = vclock.t, dt = Math.max(0, Math.min(0.1, t - last.current));
    last.current = t;
    crowd.excite *= Math.exp(-dt * 0.55);
    const u = uniforms;
    u.uTime.value = t;
    const ease = (cur: number, to: number, k: number) => cur + (to - cur) * Math.min(1, dt * k);
    u.uExcite.value = ease(u.uExcite.value, crowd.excite, 10);
    u.uCelebrate.value = ease(u.uCelebrate.value, crowd.celebrate, 4);
    u.uBoo.value = ease(u.uBoo.value, crowd.boo, 3);
    const waving = t < crowd.waveUntil;
    u.uWaveOn.value = ease(u.uWaveOn.value, waving ? 1 : 0, 3);
    u.uWavePos.value = ((t - crowd.waveT0) * 0.22) % 1;
    u.uThrowT.value = t - crowd.throwT0;
    u.uFlash.value = 0.25 + crowd.excite * 1.2 + crowd.celebrate * 2.5;
  });

  return <primitive object={mesh} />;
}
