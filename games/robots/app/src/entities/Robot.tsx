// Hover-bot, remastered. Same idea as fancy-web's (yellow chassis, red
// visor, hover disc, antenna) with the cues that make it read as a machine
// that hovers and hunts:
//   - rounded, clear-coated yellow paint, chrome trim, dark vents
//   - the head turns to watch you; the visor burns brighter the closer it is
//   - a thruster ring and a faint beam under it, and a red pool of light on
//     the floor (it hovers: its shadow is detached from it)
//   - an idle bob and a blinking antenna
// Geometry and most materials are shared by every robot.

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  AdditiveBlending, CanvasTexture, CylinderGeometry, Group, Mesh, MeshBasicMaterial,
  MeshPhysicalMaterial, MeshStandardMaterial, PlaneGeometry, SphereGeometry, TorusGeometry, Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { vclock } from '../fx/clock';
import { playerWorld } from '../fx/store';

const GEO = {
  base: new CylinderGeometry(0.3, 0.35, 0.08, 20),
  ring: new TorusGeometry(0.29, 0.026, 8, 28),
  beam: new CylinderGeometry(0.05, 0.3, 0.14, 20, 1, true),
  body: new RoundedBoxGeometry(0.5, 0.46, 0.42, 3, 0.06),
  grille: new RoundedBoxGeometry(0.3, 0.13, 0.03, 2, 0.01),
  chest: new SphereGeometry(0.045, 10, 8),
  shoulder: new RoundedBoxGeometry(0.14, 0.17, 0.38, 2, 0.04),
  neck: new CylinderGeometry(0.06, 0.07, 0.09, 10),
  head: new RoundedBoxGeometry(0.4, 0.3, 0.38, 3, 0.07),
  visor: new RoundedBoxGeometry(0.33, 0.085, 0.03, 2, 0.02),
  rod: new CylinderGeometry(0.016, 0.016, 0.24, 6),
  tip: new SphereGeometry(0.05, 10, 8),
  pool: new PlaneGeometry(1.4, 1.4),
};

function poolTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,60,110,1)');
  grad.addColorStop(0.35, 'rgba(255,30,80,0.45)');
  grad.addColorStop(1, 'rgba(255,0,60,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

const MAT = {
  paint: new MeshPhysicalMaterial({ color: '#ffb703', metalness: 0.3, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.3 }),
  dark: new MeshStandardMaterial({ color: '#232b36', metalness: 0.85, roughness: 0.35, envMapIntensity: 1.2 }),
  chrome: new MeshStandardMaterial({ color: '#c6d0da', metalness: 1, roughness: 0.18, envMapIntensity: 1.5 }),
  ring: new MeshStandardMaterial({ color: '#ff2a6d', emissive: '#ff2a6d', emissiveIntensity: 3, toneMapped: false }),
  beam: new MeshBasicMaterial({ color: '#ff3b77', transparent: true, opacity: 0.22, blending: AdditiveBlending, depthWrite: false }),
  pool: new MeshBasicMaterial({ map: poolTexture(), transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false }),
};

export type RobotProps = Readonly<{
  id: number;
  /** 0 far away … 1 about to reach you */
  threat?: number;
  /** A reflection under the glass floor: no shadows, no floor light. */
  mirror?: boolean;
  /** Visual time (s) at which the robot beams in; hidden before. */
  spawnAt?: number;
  /** Elite or special tint (unused by the classic rules). */
  alarm?: boolean;
}>;

const tmp = new Vector3();

export function RobotMesh({ id, threat = 0, mirror = false, spawnAt = -1, alarm = false }: RobotProps) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const head = useRef<Group>(null);
  const eye = useMemo(() => new MeshStandardMaterial({ color: '#ff1f4b', emissive: '#ff1f4b', emissiveIntensity: 3, toneMapped: false }), []);
  const tip = useMemo(() => new MeshStandardMaterial({ color: '#ff1f4b', emissive: '#ff1f4b', emissiveIntensity: 2, toneMapped: false }), []);
  const pool = useMemo(() => MAT.pool.clone(), []);
  const phase = (id * 0.618) % 1;
  const yaw = useRef(0);

  useFrame(() => {
    const t = vclock.t;
    if (root.current) {
      const s = spawnAt < 0 ? 1 : Math.max(0, Math.min(1, (t - spawnAt) / 0.35));
      root.current.visible = s > 0;
      root.current.scale.setScalar(s < 1 ? 0.2 + 0.8 * s * s : 1);
    }
    if (body.current) body.current.position.y = Math.sin(t * 2.3 + phase * 6.28) * 0.035;
    // the head turns toward you (in the robot's own frame)
    if (head.current && root.current) {
      root.current.getWorldPosition(tmp);
      const parentYaw = root.current.parent ? root.current.parent.rotation.y : 0;
      const want = Math.atan2(playerWorld.x - tmp.x, playerWorld.z - tmp.z) - parentYaw;
      let d = want - yaw.current;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      yaw.current += d * 0.12;
      head.current.rotation.y = Math.max(-1.3, Math.min(1.3, yaw.current));
    }
    const burn = 2.2 + threat * 6 + (alarm ? Math.sin(t * 30) * 3 : 0);
    eye.emissiveIntensity = burn;
    tip.emissiveIntensity = Math.sin(t * 5 + phase * 20) > 0.6 ? 5 : 0.4;
    pool.opacity = 0.3 + threat * 0.45;
  });

  const cast = !mirror;
  return (
    <group ref={root}>
      {!mirror && (
        <mesh geometry={GEO.pool} material={pool} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} renderOrder={3} />
      )}
      <group ref={body}>
        <mesh geometry={GEO.beam} material={MAT.beam} position={[0, 0.07, 0]} />
        <mesh geometry={GEO.base} material={MAT.dark} position={[0, 0.17, 0]} castShadow={cast} />
        <mesh geometry={GEO.ring} material={MAT.ring} position={[0, 0.13, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={GEO.body} material={MAT.paint} position={[0, 0.48, 0]} castShadow={cast} />
        <mesh geometry={GEO.grille} material={MAT.dark} position={[0, 0.45, 0.21]} />
        <mesh geometry={GEO.chest} material={eye} position={[0, 0.6, 0.2]} />
        <mesh geometry={GEO.shoulder} material={MAT.paint} position={[0.3, 0.63, 0]} castShadow={cast} />
        <mesh geometry={GEO.shoulder} material={MAT.paint} position={[-0.3, 0.63, 0]} castShadow={cast} />
        <mesh geometry={GEO.neck} material={MAT.chrome} position={[0, 0.76, 0]} />
        <group ref={head} position={[0, 0.93, 0]}>
          <mesh geometry={GEO.head} material={MAT.paint} castShadow={cast} />
          <mesh geometry={GEO.visor} material={eye} position={[0, 0.01, 0.19]} />
          <mesh geometry={GEO.rod} material={MAT.chrome} position={[0.12, 0.25, 0]} />
          <mesh geometry={GEO.tip} material={tip} position={[0.12, 0.39, 0]} />
        </group>
      </group>
    </group>
  );
}

export const ROBOT_MATERIALS = MAT;
export type { Mesh };
