// The arena: the deck you and the robots stand on, inside the stadium
// (Stadium.tsx builds the stands round it).
//   floor    — one glassy panel surface (was 1,380 box meshes): dark panels,
//              glowing seams, a pulse that runs along the seams from you
//              every turn, red danger squares, a soft glow on your square.
//              It is slightly see-through: the mirrored scene under it
//              (Game.tsx) reads as a reflection.
//   lip      — a metal rim round the deck.
//   barrier  — a thin energy field on the rim between the arena and the
//              crowd (bright from afar, faint up close).

import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import {
  AdditiveBlending, CanvasTexture, Color, DataTexture, DoubleSide, MeshStandardMaterial,
  RedFormat, ShaderMaterial, SRGBColorSpace, UnsignedByteType,
} from 'three';
import { GRID_HEIGHT, GRID_WIDTH } from '../game/state';
import { vclock } from '../fx/clock';

const W = GRID_WIDTH, H = GRID_HEIGHT;
const RIM = 1.3;
const DEPTH = 3.2;
export const CYAN = new Color('#4cc9f0');

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Panel colour + seam emissive, painted at load (no image files).
function floorTextures(px: number) {
  const cw = W * px, ch = H * px;
  const a = document.createElement('canvas'); a.width = cw; a.height = ch;
  const e = document.createElement('canvas'); e.width = cw; e.height = ch;
  const g = a.getContext('2d')!, ge = e.getContext('2d')!;
  const r = rng(7);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, cw, ch);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const x0 = x * px, y0 = y * px;
      const t = r();
      const base = 44 + Math.floor(t * 10);
      g.fillStyle = `rgb(${base * 0.34 | 0},${base * 1.22 | 0},${base * 1.62 | 0})`;
      g.fillRect(x0, y0, px, px);
      // brushed streaks
      g.globalAlpha = 0.08;
      for (let k = 0; k < 6; k++) { g.fillStyle = r() > 0.5 ? '#9fdcf5' : '#000'; g.fillRect(x0 + 2, y0 + r() * px, px - 4, 1); }
      g.globalAlpha = 1;
      // bevel: light top-left, dark bottom-right
      g.fillStyle = 'rgba(160,220,255,0.22)'; g.fillRect(x0 + 2, y0 + 2, px - 4, 2); g.fillRect(x0 + 2, y0 + 2, 2, px - 4);
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x0 + 2, y0 + px - 4, px - 4, 2); g.fillRect(x0 + px - 4, y0 + 2, 2, px - 4);
      // seam
      g.fillStyle = '#02070c'; g.fillRect(x0, y0, px, 2); g.fillRect(x0, y0, 2, px);
      // emissive seam and corner studs
      ge.fillStyle = 'rgba(76,201,240,0.55)'; ge.fillRect(x0, y0, px, 1); ge.fillRect(x0, y0, 1, px);
      // a faint glow inside each panel so the floor itself reads as lit glass
      ge.fillStyle = 'rgba(40,120,160,0.10)'; ge.fillRect(x0 + 2, y0 + 2, px - 4, px - 4);
      ge.fillStyle = 'rgba(160,235,255,0.9)'; ge.fillRect(x0 - 1, y0 - 1, 3, 3);
      if (t > 0.93) { ge.fillStyle = 'rgba(76,201,240,0.18)'; ge.fillRect(x0 + px * 0.3, y0 + px * 0.46, px * 0.4, 2); }
    }
  }
  const map = new CanvasTexture(a); map.colorSpace = SRGBColorSpace; map.anisotropy = 8;
  const emissiveMap = new CanvasTexture(e); emissiveMap.colorSpace = SRGBColorSpace; emissiveMap.anisotropy = 8;
  return { map, emissiveMap };
}

export type FloorUniforms = {
  uPlayer: { value: [number, number] };
  uPulse: { value: number };
  uTime: { value: number };
  uDanger: { value: DataTexture };
  uDangerOn: { value: number };
  uGlow: { value: number };
};

export function makeDangerTexture(): DataTexture {
  const t = new DataTexture(new Uint8Array(W * H), W, H, RedFormat, UnsignedByteType);
  t.needsUpdate = true;
  return t;
}

function floorMaterial(uniforms: FloorUniforms, lowQuality: boolean) {
  const { map, emissiveMap } = floorTextures(lowQuality ? 24 : 40);
  const m = new MeshStandardMaterial({
    map, emissiveMap, emissive: CYAN, emissiveIntensity: 1, roughness: 0.22, metalness: 0.4,
    transparent: !lowQuality, opacity: lowQuality ? 1 : 0.8, envMapIntensity: 0.6,
    // glass: it shows the reflection under it and must not cut through the
    // particles and rings drawn over it
    depthWrite: lowQuality,
  });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec2 uPlayer; uniform float uPulse, uTime, uDangerOn, uGlow; uniform sampler2D uDanger;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  vec2 cell = vec2(vMapUv.x * ${W}.0, (1.0 - vMapUv.y) * ${H}.0);
  vec2 ci = floor(cell), cf = fract(cell);
  float seam = 1.0 - smoothstep(0.0, 0.06, min(min(cf.x, cf.y), min(1.0 - cf.x, 1.0 - cf.y)));
  totalEmissiveRadiance *= uGlow;
  // the turn pulse: a ring running out from you along the seams
  float d = length(cell - (uPlayer + 0.5));
  float R = uPulse * 22.0;
  float ring = exp(-pow((d - R) / 1.1, 2.0)) * clamp(1.0 - uPulse / 1.3, 0.0, 1.0);
  totalEmissiveRadiance += vec3(0.3, 0.8, 1.0) * ring * (0.12 + seam * 1.6);
  // your square
  float me = exp(-pow(d / 1.3, 2.0));
  totalEmissiveRadiance += vec3(0.25, 0.7, 0.95) * me * 0.35;
  // danger: red squares with a scanline sweep and a bright border
  float dg = texture2D(uDanger, vec2((ci.x + 0.5) / ${W}.0, (ci.y + 0.5) / ${H}.0)).r * uDangerOn;
  if (dg > 0.01) {
    float edge = 1.0 - smoothstep(0.0, 0.12, min(min(cf.x, cf.y), min(1.0 - cf.x, 1.0 - cf.y)));
    float scan = 0.5 + 0.5 * sin((cf.y + uTime * 0.8) * 18.0);
    vec3 red = vec3(1.0, 0.08, 0.2);
    float isPile = step(0.6, dg);
    totalEmissiveRadiance += red * (0.08 + 0.05 * scan + edge * 0.5) * mix(1.0, 0.6, isPile);
  }
}`);
  };
  return m;
}

// ------------------------------------------------------------------ barrier

const BARRIER_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const BARRIER_FRAG = /* glsl */ `
varying vec2 vUv; uniform float uTime, uStrength;
float h(float x){ return fract(sin(x * 91.7) * 43758.5); }
void main(){
  float y = vUv.y;
  float fade = pow(1.0 - y, 2.2);
  float lines = smoothstep(0.92, 1.0, fract(vUv.x * 180.0 + uTime * 0.6)) * 0.5;
  float flow = 0.6 + 0.4 * sin(vUv.x * 40.0 - uTime * 2.5);
  float spark = step(0.995, h(floor(vUv.x * 900.0) + floor(uTime * 8.0))) * (1.0 - y);
  vec3 c = vec3(0.3, 0.85, 1.0) * (fade * flow * 0.9 + lines * fade + spark * 2.0);
  c += vec3(0.8, 0.97, 1.0) * smoothstep(0.08, 0.0, y) * 1.5;
  gl_FragColor = vec4(c * uStrength, 1.0);
}`;

export function Platform({ zoom, uniforms, lowQuality }: Readonly<{ zoom: number; uniforms: FloorUniforms; lowQuality: boolean }>) {
  const floor = useMemo(() => floorMaterial(uniforms, lowQuality), [uniforms, lowQuality]);
  const barrier = useMemo(
    () => new ShaderMaterial({
      vertexShader: BARRIER_VERT, fragmentShader: BARRIER_FRAG,
      uniforms: { uTime: { value: 0 }, uStrength: { value: 1 } },
      transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false,
    }),
    [],
  );
  const far = Math.max(0, Math.min(1, (26 - zoom) / 16)); // 1 when zoomed out, 0 up close

  useFrame(() => {
    const t = vclock.t;
    barrier.uniforms.uTime.value = t;
    barrier.uniforms.uStrength.value = 0.35 + far * 0.9;
    uniforms.uTime.value = t;
    uniforms.uGlow.value = 0.8 + far * 0.9;
  });

  const ow = W + RIM * 2, oh = H + RIM * 2;
  return (
    <group>
      {/* the floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow material={floor} renderOrder={2}>
        <planeGeometry args={[W, H]} />
      </mesh>
      {/* inside of the hull, under the glass */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -DEPTH + 0.2, 0]}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial color="#03070d" roughness={0.9} />
      </mesh>
      {/* lip round the floor */}
      {[
        [ow, RIM, 0, -(H / 2 + RIM / 2)], [ow, RIM, 0, H / 2 + RIM / 2],
        [RIM, H, -(W / 2 + RIM / 2), 0], [RIM, H, W / 2 + RIM / 2, 0],
      ].map(([w, d, x, z], i) => (
        <mesh key={`lip${i}`} position={[x, 0.02, z]} castShadow receiveShadow>
          <boxGeometry args={[w, 0.18, d]} />
          <meshStandardMaterial color="#1b2a38" metalness={0.8} roughness={0.35} envMapIntensity={1.2} />
        </mesh>
      ))}
      {/* energy barrier on the lip */}
      {[
        [ow - 0.2, 0, -oh / 2 + 0.1, 0], [ow - 0.2, 0, oh / 2 - 0.1, 0],
        [oh - 0.2, -ow / 2 + 0.1, 0, Math.PI / 2], [oh - 0.2, ow / 2 - 0.1, 0, Math.PI / 2],
      ].map(([len, x, z, ry], i) => (
        <mesh key={`bar${i}`} position={[x, 0.45, z]} rotation={[0, ry, 0]} material={barrier}>
          <planeGeometry args={[len, 0.8]} />
        </mesh>
      ))}
    </group>
  );
}
