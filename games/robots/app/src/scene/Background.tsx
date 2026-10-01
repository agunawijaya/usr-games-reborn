// Deep space behind the platform, drawn by one shader on a quad that sits
// at the far end of the orthographic camera and always faces it:
//   - a navy-to-black gradient with teal and magenta nebula (fBm noise)
//   - three layers of stars that twinkle and drift a little with the camera
//   - a banded gas giant with a lit limb and an atmosphere rim
//   - the sun, upper right, where the key light comes from
//   - `warp`: stars stretch into hyperspace streaks between levels
//   - `sector`: every level is a new stretch of space (the jump lands you
//     somewhere else): nebula colours, the planet and its place change
// Replaces the original CSS/SVG starfield.

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, Mesh, OrthographicCamera, ShaderMaterial, Vector2, Vector3 } from 'three';
import { vclock } from '../fx/clock';
import { quality } from '../fx/store';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime, uWarp, uAspect, uSeed;
uniform vec2 uPan;
uniform vec3 uNebA, uNebB, uPlA, uPlB, uPlC, uPlanet;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < OCTAVES; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }

vec3 stars(vec2 p, float scale, float seed, float bright) {
  vec2 g = p * scale;
  vec2 id = floor(g), f = fract(g) - 0.5;
  float h = hash(id + seed);
  if (h < 0.86) return vec3(0.0);
  vec2 off = (vec2(hash(id + seed + 3.1), hash(id + seed + 7.7)) - 0.5) * 0.7;
  vec2 d = f - off;
  // hyperspace: stretch along the direction from the centre
  vec2 dir = normalize(p + 1e-4);
  float along = dot(d, dir), across = dot(d, vec2(-dir.y, dir.x));
  float stretch = 1.0 + uWarp * 40.0 * length(p);
  float r = length(vec2(along / stretch, across));
  float tw = 0.65 + 0.35 * sin(uTime * (1.5 + h * 3.0) + h * 40.0);
  float s = smoothstep(0.09, 0.0, r) * tw * bright * (0.5 + h);
  vec3 tint = mix(vec3(0.7, 0.85, 1.0), vec3(1.0, 0.85, 0.7), hash(id + seed + 1.3));
  return tint * s * (1.0 + uWarp * 2.0);
}

void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  vec2 q = p + uPan;
  // base
  vec3 col = mix(vec3(0.006, 0.012, 0.03), vec3(0.02, 0.05, 0.1), smoothstep(1.1, 0.0, length(p - vec2(0.0, -0.1))));
  // nebula
  float n = fbm(q * 1.7 + vec2(uSeed, uTime * 0.006));
  float n2 = fbm(q * 3.1 - vec2(uTime * 0.004, 0.0) + 7.3 + uSeed);
  float n3 = fbm(q * 0.8 + 3.7 - uSeed);
  col += uNebA * smoothstep(0.42, 0.95, n) * 0.85;
  col += uNebB * smoothstep(0.5, 1.0, n2) * smoothstep(0.3, 0.8, n3) * 0.65;
  col *= 0.75 + 0.5 * n3;
  // stars, three depths
  col += stars(q * 1.0, 26.0, 1.0, 0.9);
  col += stars(q * 1.0 + uPan * 0.6, 48.0, 5.0, 0.6);
  col += stars(q * 1.0 + uPan * 1.2, 90.0, 9.0, 0.35);
  // the sun (upper right) and its glow
  vec2 sp = vec2(0.62 * uAspect / 1.78, 0.34);
  float sd = length(p - sp);
  col += vec3(1.0, 0.86, 0.66) * (smoothstep(0.035, 0.0, sd) * 3.0 + 0.06 / (sd * 8.0 + 0.3));
  // gas giant (lower left), lit from the sun's side
  vec2 pc = vec2(uPlanet.x * uAspect / 1.78, uPlanet.y);
  float pr = uPlanet.z;
  vec2 d = (p - pc) / pr;
  float r2 = dot(d, d);
  if (r2 < 1.0) {
    vec3 nrm = vec3(d, sqrt(1.0 - r2));
    vec3 L = normalize(vec3(sp - pc, 0.55));
    float lit = clamp(dot(nrm, L), 0.0, 1.0);
    float band = fbm(vec2(d.y * 6.0 + fbm(d * 3.0 + uSeed) * 1.2, d.x * 0.6 + uTime * 0.01));
    vec3 surf = mix(uPlA, uPlB, band);
    surf = mix(surf, uPlC, smoothstep(0.55, 0.8, band) * 0.5);
    vec3 planet = surf * (0.03 + lit * 1.1);
    float rim = pow(1.0 - nrm.z, 3.0);
    planet += vec3(0.25, 0.6, 1.0) * rim * (0.2 + lit) * 0.9;
    col = mix(col, planet, smoothstep(1.0, 0.985, r2));
  }
  // thin atmosphere halo outside the limb
  float halo = smoothstep(1.25, 1.0, sqrt(r2)) * step(1.0, r2);
  col += mix(vec3(0.2, 0.5, 1.0), uPlC, 0.4) * halo * 0.35;
  // warp flash
  col += vec3(0.2, 0.5, 0.9) * uWarp * 0.25 * smoothstep(1.0, 0.0, length(p));
  gl_FragColor = vec4(col, 1.0);
}`;

// One look per sector; levels cycle through them. Planet: x, y (screen,
// centre 0, height 1) and radius. Kept clear of the HUD and the deck's middle.
const SECTORS: Array<{ nebA: string; nebB: string; pl: [string, string, string]; at: [number, number, number] }> = [
  { nebA: '#05333f', nebB: '#520a38', pl: ['#1f3361', '#8c6b85', '#338c9e'], at: [-0.66, -0.36, 0.3] },
  { nebA: '#3a1c05', nebB: '#5a0f14', pl: ['#5c2a12', '#c98a4a', '#e0b070'], at: [0.7, -0.34, 0.22] },
  { nebA: '#053a2a', nebB: '#123a5a', pl: ['#2a4a52', '#bcd8dc', '#7fe0d0'], at: [-0.74, 0.02, 0.24] },
  { nebA: '#2a0a4a', nebB: '#5a0a3a', pl: ['#4a1a4a', '#d67aa8', '#ff9ac8'], at: [0.62, -0.42, 0.36] },
  { nebA: '#061a4a', nebB: '#1a2a6a', pl: ['#101830', '#4a5a8a', '#9ab0ff'], at: [-0.6, -0.44, 0.18] },
];

export function Background({ warp, sector = 1 }: Readonly<{ warp: { current: number }; sector?: number }>) {
  const ref = useRef<Mesh>(null);
  const { camera, size } = useThree();
  const mat = useMemo(
    () => new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 }, uWarp: { value: 0 }, uAspect: { value: 1.78 }, uPan: { value: new Vector2() }, uSeed: { value: 0 },
        uNebA: { value: new Color() }, uNebB: { value: new Color() }, uPlA: { value: new Color() }, uPlB: { value: new Color() },
        uPlC: { value: new Color() }, uPlanet: { value: new Vector3() },
      },
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      // software renderers pay per pixel: fewer noise octaves there
      defines: { OCTAVES: quality.low ? 3 : 6 },
    }),
    [],
  );
  const dir = useMemo(() => new Vector3(), []);
  useMemo(() => {
    const k = (Math.max(1, sector) - 1) % SECTORS.length;
    const sc = SECTORS[k], u = mat.uniforms;
    // colours are used as linear light in the shader: read the hex values raw
    const raw = (c: Color, hex: string) => c.setHex(parseInt(hex.slice(1), 16), 'srgb-linear');
    raw(u.uNebA.value, sc.nebA); raw(u.uNebB.value, sc.nebB);
    raw(u.uPlA.value, sc.pl[0]); raw(u.uPlB.value, sc.pl[1]); raw(u.uPlC.value, sc.pl[2]);
    u.uPlanet.value.set(...sc.at);
    u.uSeed.value = (Math.max(1, sector) - 1) * 3.17;
  }, [sector, mat]);
  useFrame(() => {
    const m = ref.current;
    if (!m || !(camera instanceof OrthographicCamera)) return;
    camera.getWorldDirection(dir);
    m.position.copy(camera.position).addScaledVector(dir, 380);
    m.quaternion.copy(camera.quaternion);
    const w = size.width / camera.zoom, h = size.height / camera.zoom;
    m.scale.set(w * 1.02, h * 1.02, 1);
    mat.uniforms.uTime.value = vclock.t;
    mat.uniforms.uWarp.value = warp.current;
    mat.uniforms.uAspect.value = size.width / size.height;
    // a hint of parallax when the camera follows the player
    mat.uniforms.uPan.value.set(camera.position.x - camera.position.z, camera.position.y - 40).multiplyScalar(0.0015);
  });
  return (
    <mesh ref={ref} renderOrder={-1000} frustumCulled={false} material={mat}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
