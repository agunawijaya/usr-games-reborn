// Wreck, remastered: where robots crashed lies what is left of them — one
// chassis on its side, the other crumpled against it, a toppled head with a
// dying visor, a bent antenna, the cracked hover disc, loose panels, hot
// embers in the gaps — on a scorch mark that glows orange when the crash
// lands and cools. It drops in when the crash lands (not before), and
// smoulders: the effect layer (src/fx/Effects.tsx) keeps smoke rising.
// Reads as "wreck" at any zoom: dark, low, a burn mark round it.

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  AdditiveBlending, CanvasTexture, CylinderGeometry, Group, MeshBasicMaterial, MeshStandardMaterial,
  PlaneGeometry, SphereGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { vclock } from '../fx/clock';

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    let t = (state += 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function radial(stops: Array<[number, string]>, blotches = 0) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [k, col] of stops) grad.addColorStop(k, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const r = mulberry32(5);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < blotches; i++) {
    const a = r() * Math.PI * 2, d = 38 + r() * 26;
    g.globalAlpha = 0.35 + r() * 0.4;
    g.beginPath();
    g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 6 + r() * 12, 0, Math.PI * 2);
    g.fill();
  }
  return new CanvasTexture(c);
}

const GEO = {
  body: new RoundedBoxGeometry(0.46, 0.4, 0.38, 2, 0.06),
  head: new RoundedBoxGeometry(0.36, 0.27, 0.34, 2, 0.06),
  visor: new RoundedBoxGeometry(0.29, 0.07, 0.03, 2, 0.015),
  panel: new RoundedBoxGeometry(0.3, 0.05, 0.24, 2, 0.02),
  chunk: new RoundedBoxGeometry(0.15, 0.13, 0.15, 2, 0.03),
  disc: new CylinderGeometry(0.27, 0.31, 0.07, 18),
  rod: new CylinderGeometry(0.014, 0.014, 0.28, 5),
  tip: new SphereGeometry(0.04, 8, 6),
  ember: new SphereGeometry(1, 6, 4),
  mark: new PlaneGeometry(1.3, 1.3),
};

const MAT = {
  scorched: new MeshStandardMaterial({ color: '#7a5c18', metalness: 0.45, roughness: 0.7, envMapIntensity: 0.9 }),
  paint: new MeshStandardMaterial({ color: '#a8801c', metalness: 0.35, roughness: 0.55, envMapIntensity: 1.1 }),
  soot: new MeshStandardMaterial({ color: '#191c21', metalness: 0.7, roughness: 0.75 }),
  metal: new MeshStandardMaterial({ color: '#4a525c', metalness: 0.95, roughness: 0.4, envMapIntensity: 1.2 }),
  scorch: new MeshBasicMaterial({
    map: radial([[0, 'rgba(0,0,0,0.9)'], [0.45, 'rgba(8,5,3,0.75)'], [0.8, 'rgba(10,8,6,0.25)'], [1, 'rgba(0,0,0,0)']], 9),
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
  }),
};
const HEAT_MAP = radial([[0, 'rgba(255,150,60,1)'], [0.35, 'rgba(255,90,20,0.55)'], [1, 'rgba(255,40,0,0)']]);

type Props = Readonly<{
  position: [number, number, number];
  seed: number;
  /** Visual time (s) when the crash lands; hidden before. */
  bornAt?: number;
  mirror?: boolean;
}>;

export function PileMesh({ position, seed, bornAt = -1, mirror = false }: Props) {
  const ref = useRef<Group>(null);
  const ember = useMemo(() => new MeshStandardMaterial({ color: '#ff6a1a', emissive: '#ff5a10', emissiveIntensity: 3, toneMapped: false }), []);
  const visor = useMemo(() => new MeshStandardMaterial({ color: '#ff1f4b', emissive: '#ff1f4b', emissiveIntensity: 1.5, toneMapped: false }), []);
  const heat = useMemo(() => new MeshBasicMaterial({ map: HEAT_MAP, transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false }), []);
  const L = useMemo(() => {
    const r = mulberry32(seed);
    const j = (s: number) => (r() - 0.5) * s;
    return {
      yaw: r() * Math.PI * 2,
      disc: { p: [j(0.2), 0.05, j(0.2)], r: [j(0.5), 0, j(0.5)] },
      bodyA: { p: [-0.08 + j(0.06), 0.21, 0.04 + j(0.06)], r: [0.15 + j(0.2), j(0.6), Math.PI / 2 - 0.25 + j(0.2)], soot: false },
      bodyB: { p: [0.16 + j(0.06), 0.2, -0.1 + j(0.06)], r: [0.55 + j(0.3), j(1.2), -0.35 + j(0.3)], soot: r() > 0.5 },
      head: { p: [0.02 + j(0.1), 0.47, 0.12 + j(0.08)], r: [0.5 + j(0.4), j(1.5), 0.3 + j(0.4)] },
      rod: { p: [0.2 + j(0.06), 0.46, -0.12], r: [j(0.9), 0, 0.5 + j(0.4)] },
      panels: Array.from({ length: 3 }, (_, i) => {
        const a = (i / 3) * Math.PI * 2 + r();
        return { p: [Math.cos(a) * 0.36, 0.04 + r() * 0.05, Math.sin(a) * 0.36], r: [j(0.7), r() * 3, j(0.7)], soot: r() > 0.5 };
      }),
      chunks: Array.from({ length: 3 }, () => ({ p: [j(0.7), 0.06, j(0.7)], r: [j(1), r() * 3, j(1)] })),
      embers: Array.from({ length: 7 }, () => ({ p: [j(0.5), 0.05 + r() * 0.3, j(0.5)], s: 0.018 + r() * 0.02 })),
    };
  }, [seed]);

  useFrame(() => {
    const t = vclock.t;
    if (ref.current) {
      const k = bornAt < 0 ? 1 : Math.max(0, Math.min(1, (t - bornAt) / 0.18));
      ref.current.visible = k > 0;
      ref.current.scale.setScalar(0.4 + 0.6 * k);
      ref.current.position.y = position[1] + (1 - k) * 0.5;
    }
    ember.emissiveIntensity = 2.2 + Math.sin(t * 7 + seed) * 1.2 + Math.sin(t * 13.3 + seed * 2) * 0.6;
    // the visor gutters out
    visor.emissiveIntensity = Math.random() > 0.93 ? 2.5 : 0.25;
    // the scorch mark glows when the crash lands, then cools to a faint heat
    const age = bornAt < 0 ? 99 : t - bornAt;
    heat.opacity = age < 0 ? 0 : 0.14 + 0.95 * Math.exp(-age / 1.2) + 0.04 * Math.sin(t * 5 + seed);
  });

  const v3 = (a: number[]) => a as [number, number, number];
  return (
    <group ref={ref} position={position}>
      {!mirror && (
        <>
          <mesh geometry={GEO.mark} material={MAT.scorch} rotation={[-Math.PI / 2, 0, L.yaw]} position={[0, 0.006, 0]} renderOrder={3} />
          <mesh geometry={GEO.mark} material={heat} rotation={[-Math.PI / 2, 0, L.yaw]} position={[0, 0.012, 0]} scale={0.8} renderOrder={4} />
        </>
      )}
      <group rotation={[0, L.yaw, 0]}>
        <mesh geometry={GEO.disc} material={MAT.metal} position={v3(L.disc.p)} rotation={v3(L.disc.r)} castShadow={!mirror} />
        <mesh geometry={GEO.body} material={MAT.scorched} position={v3(L.bodyA.p)} rotation={v3(L.bodyA.r)} castShadow={!mirror} />
        <mesh geometry={GEO.body} material={L.bodyB.soot ? MAT.soot : MAT.paint} position={v3(L.bodyB.p)} rotation={v3(L.bodyB.r)} scale={0.9} castShadow={!mirror} />
        <mesh geometry={GEO.head} material={MAT.scorched} position={v3(L.head.p)} rotation={v3(L.head.r)} castShadow={!mirror}>
          <mesh geometry={GEO.visor} material={visor} position={[0, 0.01, 0.172]} />
        </mesh>
        <group position={v3(L.rod.p)} rotation={v3(L.rod.r)}>
          <mesh geometry={GEO.rod} material={MAT.metal} position={[0, 0.14, 0]} />
          <mesh geometry={GEO.tip} material={visor} position={[0, 0.29, 0]} />
        </group>
        {L.panels.map((p, i) => (
          <mesh key={`p${i}`} geometry={GEO.panel} material={p.soot ? MAT.soot : MAT.scorched} position={v3(p.p)} rotation={v3(p.r)} castShadow={!mirror} />
        ))}
        {L.chunks.map((c, i) => (
          <mesh key={`c${i}`} geometry={GEO.chunk} material={i % 2 ? MAT.metal : MAT.soot} position={v3(c.p)} rotation={v3(c.r)} castShadow={!mirror} />
        ))}
        {!mirror && L.embers.map((e, i) => (
          <mesh key={`e${i}`} geometry={GEO.ember} material={ember} position={v3(e.p)} scale={e.s} />
        ))}
      </group>
    </group>
  );
}
