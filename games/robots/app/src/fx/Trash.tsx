// When you lose, the crowd boos and some of them throw their rubbish into
// the arena: drink cans, paper cups, bottles, balled-up programmes. The
// throwers are the same people the crowd shader winds up and swings
// (isThrower / throwDelay in stadiumLayout.ts), so each piece leaves a
// hand at the moment its arm comes over. Pieces arc toward where you fell,
// tumble, bounce, skid and stay until the next game.

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  BufferGeometry, Color, CylinderGeometry, IcosahedronGeometry, InstancedMesh, MeshStandardMaterial, Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fxBus, type TrashKind } from './bus';
import { vclock } from './clock';
import { quality } from './store';
import { GRID_HEIGHT, GRID_WIDTH } from '../game/state';
import { isThrower, seats, throwDelay } from '../scene/stadiumLayout';

const OX = -(GRID_WIDTH - 1) / 2, OZ = -(GRID_HEIGHT - 1) / 2;
const G = -9.8;
const KINDS: TrashKind[] = ['can', 'cup', 'bottle', 'paper'];
const CAP = 140;
// Real rubbish would be specks from here: everything is drawn at 2.4× so it
// reads as a can or a cup from the stands' distance.
const S = 2.4;

type Piece = {
  kind: number; t0: number; started: boolean; landed: boolean; resting: boolean;
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  rx: number; ry: number; rz: number; wx: number; wy: number; wz: number;
  r: number; // resting half-height
  slot: number;
};

function bottleGeometry(): BufferGeometry {
  const body = new CylinderGeometry(0.055 * S, 0.06 * S, 0.2 * S, 10);
  const neck = new CylinderGeometry(0.02 * S, 0.05 * S, 0.1 * S, 8); neck.translate(0, 0.15 * S, 0);
  return mergeGeometries([body.toNonIndexed(), neck.toNonIndexed()])!;
}

export function Trash() {
  const meshes = useMemo(() => {
    const defs: Array<[BufferGeometry, MeshStandardMaterial]> = [
      [new CylinderGeometry(0.05 * S, 0.05 * S, 0.14 * S, 12), new MeshStandardMaterial({ color: '#ffffff', metalness: 0.85, roughness: 0.3 })], // can
      [new CylinderGeometry(0.07 * S, 0.05 * S, 0.16 * S, 12, 1, true), new MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 })], // cup
      [bottleGeometry(), new MeshStandardMaterial({ color: '#ffffff', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.9 })], // bottle
      [new IcosahedronGeometry(0.075 * S, 0), new MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, flatShading: true })], // paper
    ];
    defs[1][1].side = 2; // cups are open: both faces
    const tints = [
      ['#e63946', '#e8ecf0', '#2f5fe0', '#1f9d52', '#ffb703'], // cans
      ['#f4f1ea', '#e63946', '#f4f1ea', '#ffb703'], // cups
      ['#3f8f5a', '#7a4a1e', '#8fd3ff'], // bottles
      ['#f1ede4', '#fff7c2', '#d8e8ff'], // paper
    ];
    return defs.map(([g, m], k) => {
      const im = new InstancedMesh(g, m, CAP);
      for (let i = 0; i < CAP; i++) im.setColorAt(i, new Color(tints[k][i % tints[k].length]));
      im.count = 0;
      im.frustumCulled = false;
      im.castShadow = true;
      return im;
    });
  }, []);
  const pieces = useRef<Piece[]>([]);
  const counts = useRef([0, 0, 0, 0]);
  const last = useRef(vclock.t);
  const throwers = useMemo(() => seats(quality.low ? 0.3 : 1).filter((s) => isThrower(s.seed)), []);
  const tmp = useMemo(() => new Object3D(), []);

  useEffect(() => fxBus.on((e) => {
    if (e.type === 'levelStart') {
      pieces.current = [];
      counts.current = [0, 0, 0, 0];
      for (const m of meshes) m.count = 0;
    } else if (e.type === 'death') {
      const t0 = vclock.t + 0.9; // matches crowd.throwT0
      const fx = e.at.x + OX, fz = e.at.y + OZ;
      for (const s of throwers) {
        const kind = Math.floor(((s.seed * 23.9) % 1) * KINDS.length);
        if (counts.current[kind] >= CAP) continue;
        const slot = counts.current[kind]++;
        // aim near where you fell, a little scattered; keep it in the arena
        const a = ((s.seed * 5.3) % 1) * Math.PI * 2, rr = 1 + ((s.seed * 9.1) % 1) * 6;
        const tx = Math.max(-29.4, Math.min(29.4, fx + Math.cos(a) * rr));
        const tz = Math.max(-11, Math.min(11, fz + Math.sin(a) * rr));
        // the hand, over the head and a little forward
        const hx = s.x + Math.sin(s.yaw) * 0.25, hz = s.z + Math.cos(s.yaw) * 0.25, hy = s.y + 1.35;
        const T = 0.9 + Math.hypot(tx - hx, tz - hz) * 0.022;
        const r = (kind === 3 ? 0.07 : 0.05) * S;
        pieces.current.push({
          kind, t0: t0 + throwDelay(s.seed) + 0.05, started: false, landed: false, resting: false,
          x: hx, y: hy, z: hz, vx: (tx - hx) / T, vz: (tz - hz) / T, vy: (r - hy) / T - 0.5 * G * T,
          rx: 0, ry: 0, rz: 0, wx: (Math.random() - 0.5) * 18, wy: (Math.random() - 0.5) * 18, wz: (Math.random() - 0.5) * 18,
          r, slot,
        });
      }
      counts.current.forEach((n, i) => { meshes[i].count = n; });
      // hide everything until thrown
      for (const p of pieces.current) {
        tmp.position.set(0, -50, 0); tmp.scale.setScalar(0.0001); tmp.updateMatrix();
        meshes[p.kind].setMatrixAt(p.slot, tmp.matrix);
      }
      for (const m of meshes) m.instanceMatrix.needsUpdate = true;
    }
  }), [meshes, throwers, tmp]);

  useFrame(() => {
    const t = vclock.t, dt = Math.max(0, Math.min(0.05, t - last.current));
    last.current = t;
    if (!pieces.current.length) return;
    const dirty = [false, false, false, false];
    for (const p of pieces.current) {
      if (p.resting || t < p.t0) continue;
      p.started = true;
      p.vy += G * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rx += p.wx * dt; p.ry += p.wy * dt; p.rz += p.wz * dt;
      if (p.y <= p.r && p.vy < 0) {
        const speed = Math.hypot(p.vx, p.vy, p.vz);
        if (!p.landed) fxBus.emit({ type: 'trash', kind: KINDS[p.kind], speed });
        p.landed = true;
        p.y = p.r;
        p.vy = -p.vy * (p.kind === 3 ? 0.2 : 0.35);
        p.vx *= 0.55; p.vz *= 0.55;
        p.wx *= 0.5; p.wy *= 0.5; p.wz *= 0.5;
        if (Math.abs(p.vy) < 0.6 && Math.hypot(p.vx, p.vz) < 0.3) {
          p.resting = true;
          // lie down: cans, cups and bottles on their sides
          p.rx = p.kind === 3 ? p.rx : Math.PI / 2;
          p.rz = 0;
        }
      }
      tmp.position.set(p.x, p.y, p.z);
      tmp.rotation.set(p.rx, p.ry, p.rz);
      tmp.scale.setScalar(1);
      tmp.updateMatrix();
      meshes[p.kind].setMatrixAt(p.slot, tmp.matrix);
      dirty[p.kind] = true;
    }
    dirty.forEach((d, i) => {
      if (!d) return;
      meshes[i].instanceMatrix.needsUpdate = true;
    });
  });

  return <>{meshes.map((m, i) => <primitive key={i} object={m} />)}</>;
}
