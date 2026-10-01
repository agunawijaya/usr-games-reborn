// Player, remastered: the same voxel human (magenta shirt, denim, dark
// hair), with a walk that plants its feet.
//
// fancy-web swung each leg as one rigid stick on a sine, so the feet slid.
// Here each leg has a thigh, a shin and a knee solved with two-bone IK, and
// a move is walked, not strided: a square is a long way for legs this
// short, so one move is a few short steps (two plants for a straight move,
// three on a diagonal) and a closing step that brings the feet together.
// Each foot stays planted on the floor until it is its turn to swing; the
// body speeds up and slows down over the move; the pelvis drops only as
// far as the legs need to reach both feet; the trailing heel lifts before
// it swings; the arms swing against the legs. A soft cyan ring and a rim of
// light keep you findable among forty robots. On death the body topples.

import { useFrame } from '@react-three/fiber';
import { useContext, useMemo, useRef } from 'react';
import {
  AdditiveBlending, CanvasTexture, Group, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry,
} from 'three';
import { StepAnimationContext } from './AnimatedGroup';
import { clamp01, footPlan, smooth } from './gait';
import { vclock } from '../fx/clock';

const C = { shirt: '#ff3a95', skin: '#f5cba8', hair: '#4a2f1c', pants: '#3d4a5e', shoes: '#1a2540', eye: '#0a0a10' };
const HIP_Y = 0.56, HIP_X = 0.09, THIGH = 0.26, SHIN = 0.25, ANKLE = 0.05;
const REACH = (THIGH + SHIN) * 0.99;
const TOE = 0.16; // ankle to toe

const mat = (color: string, emissive = 0, rough = 0.5) =>
  new MeshStandardMaterial({ color, roughness: rough, metalness: 0.05, emissive: emissive ? color : '#000', emissiveIntensity: emissive });
const M = {
  shirt: mat(C.shirt, 0.25, 0.4), skin: mat(C.skin, 0.12, 0.45), hair: mat(C.hair, 0, 0.75),
  pants: mat(C.pants, 0, 0.6), shoes: mat(C.shoes, 0, 0.55), eye: mat(C.eye, 0, 0.3),
};

function ringTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 20, 64, 64, 62);
  grad.addColorStop(0, 'rgba(120,220,255,0)');
  grad.addColorStop(0.55, 'rgba(120,220,255,0.9)');
  grad.addColorStop(0.7, 'rgba(120,220,255,0.35)');
  grad.addColorStop(1, 'rgba(120,220,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

// Two-bone IK in the leg's sagittal plane (local y up, z forward).
// Returns [thigh pitch, knee bend] as rotation.x values for the groups.
function solveLeg(dz: number, dy: number): [number, number] {
  const d = Math.min(THIGH + SHIN - 1e-3, Math.max(0.05, Math.hypot(dz, dy)));
  const line = Math.atan2(dz, -dy); // angle of hip→foot from straight down, + forward
  const b = Math.acos(Math.min(1, Math.max(-1, (THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d))));
  const k = Math.acos(Math.min(1, Math.max(-1, (THIGH * THIGH + SHIN * SHIN - d * d) / (2 * THIGH * SHIN))));
  // rotation.x > 0 swings a hanging limb backward, so forward is negative
  return [-(line + b), Math.PI - k];
}

export function PlayerMesh({ mirror = false, dead = false }: Readonly<{ mirror?: boolean; dead?: boolean }>) {
  const stepRef = useContext(StepAnimationContext);
  const root = useRef<Group>(null);
  const pelvis = useRef<Group>(null);
  const legs = [useRef<Group>(null), useRef<Group>(null)];
  const knees = [useRef<Group>(null), useRef<Group>(null)];
  const feet = [useRef<Group>(null), useRef<Group>(null)];
  const arms = [useRef<Group>(null), useRef<Group>(null)];
  const ring = useMemo(() => new MeshBasicMaterial({ map: ringTexture(), transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0.8 }), []);
  const ringGeo = useMemo(() => new PlaneGeometry(1.2, 1.2), []);
  const deadAt = useRef(-1);

  useFrame(() => {
    const s = stepRef.current;
    const p = s.isMoving ? s.progress : 1;
    const L = s.length || 1;
    const lead = s.stepIndex % 2; // which foot swings first this move
    // the body eases along the move (the group itself moves linearly)
    const body = L * smooth(p);
    if (pelvis.current) pelvis.current.position.z = s.isMoving ? body - L * p : 0;
    const { pos, lift } = footPlan(L, p, lead);
    const dz = [pos[0] - body, pos[1] - body];
    // a planted foot well behind the body rolls onto its toe
    const heel = [0, 1].map((i) => (lift[i] > 0.001 ? 0 : Math.min(0.06, Math.max(0, (-dz[i] - 0.1) * 0.45))));
    const footY = [0, 1].map((i) => ANKLE + lift[i] + heel[i]);
    // the pelvis drops just enough for both legs to reach their feet
    let hip = HIP_Y;
    for (let i = 0; i < 2; i++) hip = Math.min(hip, footY[i] + Math.sqrt(Math.max(0, REACH * REACH - dz[i] * dz[i])));
    const dip = HIP_Y - hip;
    if (pelvis.current) pelvis.current.position.y = -dip;
    for (let i = 0; i < 2; i++) {
      const leg = legs[i].current, knee = knees[i].current, foot = feet[i].current;
      if (!leg || !knee || !foot) continue;
      const [th, kn] = solveLeg(dz[i], footY[i] - hip);
      leg.rotation.x = th;
      knee.rotation.x = kn;
      // sole flat on the floor; toe up while swinging; heel up on toe-off
      foot.rotation.x = -(th + kn) + (lift[i] > 0.01 ? -0.3 * Math.min(1, lift[i] / 0.06) : Math.asin(heel[i] / TOE));
    }
    // arms swing against the legs: a foot ahead sends its arm back
    for (let i = 0; i < 2; i++) {
      const a = arms[i].current;
      if (a) a.rotation.x = Math.max(-0.6, Math.min(0.6, (dz[i] - dz[1 - i]) * 1.2));
    }
    // breathing when still
    if (pelvis.current && !s.isMoving) pelvis.current.position.y = Math.sin(vclock.t * 2) * 0.006;
    // death: topple backward
    if (root.current) {
      if (dead && deadAt.current < 0) deadAt.current = vclock.t;
      if (!dead) deadAt.current = -1;
      const k = deadAt.current < 0 ? 0 : clamp01((vclock.t - deadAt.current) / 0.55);
      root.current.rotation.x = -(k * k) * 1.45;
      root.current.position.y = k * 0.12;
    }
    ring.opacity = dead ? 0 : 0.55 + Math.sin(vclock.t * 3) * 0.15;
  });

  const leg = (i: number) => (
    <group ref={legs[i]} position={[i === 0 ? -HIP_X : HIP_X, HIP_Y, 0]}>
      <mesh position={[0, -THIGH / 2, 0]} material={M.pants} castShadow={!mirror}>
        <cylinderGeometry args={[0.075, 0.068, THIGH, 10]} />
      </mesh>
      <group ref={knees[i]} position={[0, -THIGH, 0]}>
        <mesh position={[0, -SHIN / 2, 0]} material={M.pants} castShadow={!mirror}>
          <cylinderGeometry args={[0.066, 0.058, SHIN, 10]} />
        </mesh>
        <group ref={feet[i]} position={[0, -SHIN, 0]}>
          <mesh position={[0, -0.02, 0.04]} material={M.shoes} castShadow={!mirror}>
            <boxGeometry args={[0.13, 0.07, 0.24]} />
          </mesh>
        </group>
      </group>
    </group>
  );
  const arm = (i: number) => (
    <group ref={arms[i]} position={[i === 0 ? -0.22 : 0.22, 0.93, 0]}>
      <mesh position={[0, -0.2, 0]} material={M.shirt} castShadow={!mirror}>
        <cylinderGeometry args={[0.056, 0.05, 0.4, 10]} />
      </mesh>
      <mesh position={[0, -0.42, 0.01]} material={M.skin}>
        <sphereGeometry args={[0.055, 12, 10]} />
      </mesh>
    </group>
  );
  return (
    <group>
      {!mirror && (
        <mesh geometry={ringGeo} material={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0]} renderOrder={3} />
      )}
      <group ref={root}>
        <group ref={pelvis}>
          {leg(0)}
          {leg(1)}
          <mesh position={[0, 0.76, 0]} material={M.shirt} castShadow={!mirror}>
            <boxGeometry args={[0.34, 0.4, 0.24]} />
          </mesh>
          {arm(0)}
          {arm(1)}
          <mesh position={[0, 1.0, 0]} material={M.skin}>
            <cylinderGeometry args={[0.05, 0.06, 0.08, 10]} />
          </mesh>
          <mesh position={[0, 1.13, 0]} material={M.skin} castShadow={!mirror}>
            <sphereGeometry args={[0.16, 20, 16]} />
          </mesh>
          <mesh position={[0, 1.19, -0.005]} scale={[1.05, 0.55, 1.1]} material={M.hair}>
            <sphereGeometry args={[0.16, 20, 12]} />
          </mesh>
          <mesh position={[-0.055, 1.14, 0.145]} material={M.eye}>
            <sphereGeometry args={[0.018, 8, 6]} />
          </mesh>
          <mesh position={[0.055, 1.14, 0.145]} material={M.eye}>
            <sphereGeometry args={[0.018, 8, 6]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
