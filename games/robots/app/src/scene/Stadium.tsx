// The stadium round the arena (layout: stadiumLayout.ts):
//   stands    — solid stepped rows of concrete, seats painted on the treads,
//               yellow step edges; cut low on the two sides facing the
//               camera, full height behind, with a clean section at the cuts
//   boards    — the front wall is a ring of LED advertising that scrolls
//   facade    — the outside wall with rows of lit ports; the underside
//               tapers away beneath
//   towers    — three floodlight towers behind the tall stand, each with a
//               bank of lamps, a visible beam of light down onto the arena,
//               and a red aviation light on top (no real spot lights: on
//               the glass deck they only made a glare blob)
//   star      — from far away the whole thing is one bright star: a glare
//               with four spikes that fades in as you zoom out
// Everything is drawn in code (canvas textures, shaders): no image files.

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  AdditiveBlending, CanvasTexture, Color, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial,
  MeshLambertMaterial, MeshStandardMaterial, Object3D, OrthographicCamera, RepeatWrapping, ShaderMaterial, SRGBColorSpace, Vector3,
} from 'three';
import { vclock } from '../fx/clock';
import { quality } from '../fx/store';
import { buildStands, buildUnderside } from './standsGeometry';
import { AX, AZ, BACK_ROWS, BASE, CX, CZ, R0, rowInner } from './stadiumLayout';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}
const tex = (c: HTMLCanvasElement, wrapT = false) => {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = RepeatWrapping;
  if (wrapT) t.wrapT = RepeatWrapping;
  t.anisotropy = 8;
  return t;
};

// One seat pitch wide, one row deep: concrete, a yellow step edge at the
// front (v = 0 is the edge facing the arena), a blue seat towards the back.
function seatTexture() {
  const [c, g] = canvas(64, 64);
  g.fillStyle = '#29323f'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,0.04)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 64, Math.random() * 64, 2, 1);
  g.fillStyle = '#d9a91a'; g.fillRect(0, 0, 64, 3);
  g.fillStyle = '#1d3566'; g.fillRect(7, 26, 50, 30);
  g.fillStyle = '#2f55a0'; g.fillRect(7, 26, 50, 6);
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(7, 52, 50, 4);
  return tex(c);
}

// Hull plating with lit ports (the outside wall).
function facadeTextures() {
  const [c, g] = canvas(512, 128), [e, ge] = canvas(512, 128);
  let s = 11;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  g.fillStyle = '#16222e'; g.fillRect(0, 0, 512, 128);
  ge.fillStyle = 'rgb(20,36,44)'; ge.fillRect(0, 0, 512, 128);
  for (let x = 0; x < 512; x += 64) {
    const t = 18 + r() * 10;
    g.fillStyle = `rgb(${t | 0},${(t * 1.35) | 0},${(t * 1.7) | 0})`; g.fillRect(x + 1, 1, 62, 126);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, 0, 1, 128);
    for (let k = 0; k < 3; k++) {
      const px = x + 8 + k * 18, v = r();
      g.fillStyle = '#05090d'; g.fillRect(px, 56, 12, 7);
      ge.fillStyle = v > 0.22 ? (v > 0.9 ? 'rgb(255,190,110)' : 'rgb(170,230,255)') : '#000';
      ge.fillRect(px + 1, 57, 10, 5);
    }
  }
  ge.fillStyle = 'rgba(76,201,240,0.9)'; ge.fillRect(0, 2, 512, 2);
  return { map: tex(c, true), emissiveMap: tex(e, true) };
}

// An architect's section: light concrete with diagonal hatching.
function sectionTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#56606d'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(20,26,34,0.55)'; g.lineWidth = 2;
  for (let i = -128; i < 256; i += 12) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke(); }
  return tex(c, true);
}

// The LED boards: bright type on black, then a dot-matrix mask. The strip
// repeats round the stadium, so only whole messages go on it, spaced evenly
// so the join cannot be seen. Drawn again once the web fonts have loaded.
function boardTexture() {
  const [c, g] = canvas(2048, 96);
  const msgs: Array<[string, string]> = [
    ['ROBOTS ★ LIVE', '#4cc9f0'], ['1 HUMAN vs 40 ROBOTS', '#ffb703'], ['BSD GAMES', '#ffffff'],
    ['TELEPORT RESPONSIBLY', '#ff2a6d'], ['NO REFUNDS', '#7dff9a'], ['CHAIN REACTION TONIGHT', '#ffb347'],
  ];
  const draw = () => {
    g.fillStyle = '#020306'; g.fillRect(0, 0, 2048, 96);
    g.font = 'bold 52px "Orbitron", "Rajdhani", sans-serif';
    g.textBaseline = 'middle';
    const fit: Array<[string, string, number]> = [];
    let used = 0;
    for (const [m, col] of msgs) {
      const w = g.measureText(m).width;
      if (used + w + 60 * (fit.length + 1) > 2048) break;
      fit.push([m, col, w]);
      used += w;
    }
    const gap = (2048 - used) / fit.length;
    let x = gap / 2;
    for (const [m, col, w] of fit) {
      g.fillStyle = col;
      g.shadowColor = col; g.shadowBlur = 14;
      g.fillText(m, x, 50);
      x += w + gap;
    }
    g.shadowBlur = 0;
    // dot matrix: darken the gaps between LEDs
    g.fillStyle = 'rgba(0,0,0,0.55)';
    for (let y = 0; y < 96; y += 6) g.fillRect(0, y + 4, 2048, 2);
    for (let xx = 0; xx < 2048; xx += 6) g.fillRect(xx + 4, 0, 2, 96);
  };
  draw();
  const t = tex(c);
  document.fonts?.ready.then(() => { draw(); t.needsUpdate = true; }).catch(() => undefined);
  return t;
}

// A bank of floodlight lamps: a grid of hot discs.
function lampTexture() {
  const [c, g] = canvas(256, 160);
  g.fillStyle = '#10151c'; g.fillRect(0, 0, 256, 160);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 5; x++) {
    const cx = 28 + x * 50, cy = 30 + y * 50;
    const gr = g.createRadialGradient(cx, cy, 2, cx, cy, 22);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#fff6dd'); gr.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 22, 0, Math.PI * 2); g.fill();
  }
  return tex(c);
}

const BEAM_VERT = /* glsl */ `
varying float vAlong; varying float vEdge;
void main(){
  vAlong = uv.y;
  vec3 n = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vEdge = abs(n.z); // orthographic camera: the view direction is fixed
  gl_Position = projectionMatrix * mv;
}`;
const BEAM_FRAG = /* glsl */ `
varying float vAlong; varying float vEdge; uniform float uAlpha; uniform vec3 uColor;
void main(){
  float along = smoothstep(0.0, 0.08, 1.0 - vAlong) * pow(vAlong, 0.7);
  float soft = pow(vEdge, 1.6);
  gl_FragColor = vec4(uColor * along * soft * uAlpha, 1.0);
}`;

const STAR_FRAG = /* glsl */ `
varying vec2 vUv; uniform float uAlpha, uTime;
void main(){
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  float core = exp(-r * r * 60.0) * 2.0 + exp(-r * 9.0) * 0.5;
  float spikes = exp(-abs(p.x) * 70.0) * exp(-abs(p.y) * 2.6) + exp(-abs(p.y) * 70.0) * exp(-abs(p.x) * 2.6);
  float tw = 0.85 + 0.15 * sin(uTime * 3.1) * sin(uTime * 1.7 + 1.0);
  vec3 col = vec3(1.0, 0.96, 0.88) * core + vec3(0.8, 0.9, 1.0) * spikes * 0.7;
  gl_FragColor = vec4(col * uAlpha * tw, 1.0);
}`;

type Tower = { x: number; z: number; face: Vector3 };

export function Stadium({ zoom }: Readonly<{ zoom: number }>) {
  const { camera } = useThree();
  const geo = useMemo(() => buildStands(AX, AZ), []);
  const under = useMemo(() => buildUnderside(), []);
  const board = useMemo(() => boardTexture(), []);
  // software renderers pay per pixel and the stands fill the screen: plain
  // Lambert there instead of the physically based material
  const Mat = quality.low ? MeshLambertMaterial : MeshStandardMaterial;
  const mats = useMemo(() => {
    const facade = facadeTextures();
    return [
      new Mat({ map: seatTexture() }),
      new Mat({ color: '#2b3441' }),
      new Mat({ ...facade, emissive: '#ffffff', emissiveIntensity: 1 }),
      new Mat({ map: sectionTexture() }),
      new Mat({ color: '#000000', emissive: '#ffffff', emissiveMap: board, emissiveIntensity: 1.4, toneMapped: false }),
    ];
  }, [board, Mat]);
  const walkMat = useMemo(() => new Mat({ color: '#1a232e' }), [Mat]);
  const underMat = useMemo(() => new Mat({ color: '#0f1821' }), [Mat]);
  useMemo(() => {
    if (quality.low) return;
    const std = [...mats, walkMat, underMat] as MeshStandardMaterial[];
    const pbr: Array<[number, number]> = [[0.85, 0.05], [0.9, 0.1], [0.5, 0.6], [0.95, 0], [0.4, 0], [0.7, 0.4], [0.6, 0.7]];
    std.forEach((m, i) => { m.roughness = pbr[i][0]; m.metalness = pbr[i][1]; });
  }, [mats, walkMat, underMat]);

  // three floodlight towers behind the tall stand
  const towers = useMemo<Tower[]>(() => {
    // against the outside wall of the tall stand: at both cuts and at the back corner
    const out = rowInner(BACK_ROWS) + 0.7;
    const a = (5 * Math.PI) / 4;
    const pts: Array<[number, number]> = [
      [-CX - R0 - out, CZ - 0.7],
      [-CX + Math.cos(a) * (R0 + out), -CZ + Math.sin(a) * (R0 + out)],
      [CX - 0.7, -CZ - R0 - out],
    ];
    return pts.map(([x, z]) => ({ x, z, face: new Vector3(-x, 0, -z).normalize() }));
  }, []);
  const TOWER_H = 19;
  const lamp = useMemo(() => new MeshBasicMaterial({ map: lampTexture(), toneMapped: false, color: new Color(2.2, 2.1, 1.9) }), []);
  const beamMat = useMemo(() => new ShaderMaterial({
    vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
    uniforms: { uAlpha: { value: 0.1 }, uColor: { value: new Color('#fff4de') } },
    transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, toneMapped: false,
  }), []);
  const beams = useMemo(() => towers.map((t) => {
    const from = new Vector3(t.x, TOWER_H + 1, t.z);
    const to = new Vector3(t.x * 0.15, 0, t.z * 0.15);
    const len = from.distanceTo(to);
    const g = new CylinderGeometry(1.4, 10, len, 32, 1, true);
    g.translate(0, -len / 2, 0); // top at the lamp
    const o = new Object3D();
    o.position.copy(from);
    o.lookAt(to);
    o.rotateX(-Math.PI / 2); // cylinder axis (−y after translate) → toward the target
    return { g, pos: o.position.clone(), quat: o.quaternion.clone(), from, to };
  }), [towers]);
  const aviation = useMemo(() => new MeshStandardMaterial({ color: '#ff2a2a', emissive: '#ff2a2a', emissiveIntensity: 3, toneMapped: false }), []);
  const star = useMemo(() => new ShaderMaterial({
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: STAR_FRAG, uniforms: { uAlpha: { value: 0 }, uTime: { value: 0 } },
    transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending, toneMapped: false,
  }), []);
  const starRef = useRef<Mesh>(null);
  const beamGroup = useRef<Group>(null);

  useFrame(() => {
    const t = vclock.t;
    board.offset.x = -t * 0.035;
    aviation.emissiveIntensity = Math.sin(t * 2.2) > 0.6 ? 5 : 0.2;
    // the star: a fixed size on screen, fading in as the stadium shrinks away
    const z = camera instanceof OrthographicCamera ? camera.zoom : zoom;
    const k = Math.max(0, Math.min(1, (6 - z) / 4));
    star.uniforms.uAlpha.value = k * 1.6;
    star.uniforms.uTime.value = t;
    if (starRef.current) {
      starRef.current.visible = k > 0.001;
      starRef.current.quaternion.copy(camera.quaternion);
      starRef.current.scale.setScalar(260 / Math.max(0.3, z));
    }
    beamMat.uniforms.uAlpha.value = 0.07 + 0.08 * Math.max(0, Math.min(1, (22 - z) / 14));
  });

  return (
    <group>
      <mesh geometry={geo.stands} material={mats} receiveShadow />
      <mesh geometry={geo.walk} material={walkMat} receiveShadow />
      <mesh geometry={under} material={underMat} />
      {towers.map((tw, i) => (
        <group key={`tower${i}`} position={[tw.x, 0, tw.z]}>
          <mesh position={[0, (TOWER_H + BASE) / 2, 0]}>
            <boxGeometry args={[0.9, TOWER_H - BASE, 0.9]} />
            <meshStandardMaterial color="#27313d" metalness={0.8} roughness={0.45} />
          </mesh>
          <group position={[0, TOWER_H + 1, 0]} rotation={[0, Math.atan2(tw.face.x, tw.face.z), 0]}>
            <group rotation={[0.55, 0, 0]}>
              <mesh position={[0, 0, -0.2]}>
                <boxGeometry args={[5.4, 3.4, 0.4]} />
                <meshStandardMaterial color="#1b222c" metalness={0.7} roughness={0.5} />
              </mesh>
              <mesh position={[0, 0, 0.01]} material={lamp}>
                <planeGeometry args={[5, 3.1]} />
              </mesh>
            </group>
            <mesh position={[0, 2.2, -0.3]} material={aviation}>
              <sphereGeometry args={[0.2, 10, 8]} />
            </mesh>
          </group>
        </group>
      ))}
      <group ref={beamGroup} visible={!quality.low}>
        {beams.map((b, i) => (
          <mesh key={`beam${i}`} geometry={b.g} material={beamMat} position={b.pos} quaternion={b.quat} renderOrder={12} frustumCulled={false} />
        ))}
      </group>
      <mesh ref={starRef} material={star} position={[0, 3, 0]} renderOrder={30} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
      </mesh>
    </group>
  );
}
