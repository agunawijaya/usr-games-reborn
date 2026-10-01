// Fireworks for a cleared level. While the celebration runs (crowd.fireworks)
// shells go up from the rim of the tall stand, trailing
// sparks, and burst over the arena: peonies, two-colour peonies, rings and
// gold willows that droop; now and then a salvo. Each burst flashes its
// colour across the arena for a moment. It stops launching the moment you
// jump to the next level (the sparks in the air still finish).

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, OrthographicCamera, PointLight } from 'three';
import { fxBus } from './bus';
import { vclock } from './clock';
import { crowd } from './crowd';
import { PointPool } from './Effects';
import { quality } from './store';
import { at, backStations, BACK_ROWS, rowInner, rowTop } from '../scene/stadiumLayout';

const PALETTE = ['#ff3b5c', '#ffb703', '#4cc9f0', '#7dff9a', '#c77dff', '#ffffff', '#ff7b00', '#ff5fa2'];
type Shell = { x: number; y: number; z: number; vx: number; vy: number; vz: number; fuse: number; age: number; kind: number; c1: Color; c2: Color; big: number };

const G = -9;

export function Fireworks() {
  const { camera, gl } = useThree();
  const pool = useMemo(() => new PointPool(quality.low ? 1400 : 4200, true), []);
  const shells = useRef<Shell[]>([]);
  const next = useRef(0);
  const last = useRef(vclock.t);
  const light = useMemo(() => new PointLight('#ffffff', 0, 0, 0), []);
  // launch sites along the top of the tall stand
  const sites = useMemo(() => {
    const out: Array<[number, number, number]> = [];
    const path = backStations();
    const d = rowInner(BACK_ROWS) - 0.4, y = rowTop(BACK_ROWS - 1) + 0.3;
    for (let k = 0; k < path.length; k += 2) {
      const [x, z] = at(path[k], d);
      out.push([x, y, z]);
    }
    return out;
  }, []);

  const launch = () => {
    const [sx, sy, sz] = sites[Math.floor(Math.random() * sites.length)];
    // burst somewhere over the arena, high enough to clear the stands
    // bursts high over the arena and the tall stand, against the sky
    const tx = (Math.random() - 0.5) * 66, tz = (Math.random() - 0.5) * 28 - 3, ty = 16 + Math.random() * 12;
    const fuse = 1.2 + Math.random() * 0.5;
    const vx = (tx - sx) / fuse, vz = (tz - sz) / fuse, vy = (ty - sy) / fuse - 0.5 * G * fuse;
    const c1 = new Color(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
    const c2 = new Color(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
    shells.current.push({ x: sx, y: sy, z: sz, vx, vy, vz, fuse, age: 0, kind: Math.floor(Math.random() * 4), c1, c2, big: 0.8 + Math.random() * 0.5 });
    fxBus.emit({ type: 'firework', phase: 'launch', size: 1, distance: Math.hypot(sx, sz) });
  };

  const burst = (s: Shell) => {
    const lowK = quality.low ? 0.4 : 1;
    const n = Math.round((s.kind === 2 ? 120 : 200) * s.big * lowK);
    const gold = new Color('#ffcc66');
    pool.add({ x: s.x, y: s.y, z: s.z, vx: 0, vy: 0, vz: 0, life: 0.22, s0: 10 * s.big, s1: 14 * s.big, a: 2.2, c: s.kind === 3 ? gold : s.c1, g: 0, drag: 0 });
    // ring bursts: a random tilt
    const tilt = Math.random() * Math.PI, spin = Math.random() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      let dx: number, dy: number, dz: number;
      if (s.kind === 2) {
        const a = (i / n) * Math.PI * 2;
        const cx = Math.cos(a), cy = Math.sin(a);
        dx = cx * Math.cos(spin) - cy * Math.cos(tilt) * Math.sin(spin);
        dy = cy * Math.sin(tilt);
        dz = cx * Math.sin(spin) + cy * Math.cos(tilt) * Math.cos(spin);
      } else {
        const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
        dx = r * Math.cos(a); dy = u; dz = r * Math.sin(a);
      }
      const willow = s.kind === 3;
      const sp = (willow ? 8.5 : 14) * s.big * (s.kind === 2 ? 1 : 0.8 + Math.random() * 0.3);
      const col = willow ? gold : s.kind === 1 && i % 2 ? s.c2 : s.c1;
      pool.add({
        x: s.x, y: s.y, z: s.z, vx: dx * sp, vy: dy * sp, vz: dz * sp,
        life: willow ? 3 + Math.random() * 0.8 : 1.6 + Math.random() * 0.8,
        s0: willow ? 0.5 : 0.7, s1: 0.08, a: 1.9, c: col, g: willow ? -2.8 : -2, drag: willow ? 1.5 : 1.05,
      });
    }
    light.color.copy(s.kind === 3 ? gold : s.c1);
    light.position.set(s.x, s.y, s.z);
    light.intensity = quality.low ? 0 : 7 * s.big;
    fxBus.emit({ type: 'firework', phase: 'burst', size: s.big, distance: Math.hypot(s.x, s.z) });
  };

  useEffect(() => fxBus.on((e) => {
    if (e.type === 'levelStart') { shells.current = []; next.current = 0; }
  }), []);

  useFrame(() => {
    const t = vclock.t;
    const dt = Math.max(0, Math.min(0.05, t - last.current));
    last.current = t;
    if (camera instanceof OrthographicCamera) pool.mat.uniforms.uScale.value = camera.zoom * gl.getPixelRatio();
    if (crowd.fireworks && t >= next.current) {
      const salvo = Math.random() < 0.25 ? 3 + Math.floor(Math.random() * 4) : 1;
      for (let i = 0; i < salvo; i++) launch();
      next.current = t + (salvo > 1 ? 1.1 : 0.22 + Math.random() * 0.4);
    }
    const trail = new Color('#ffd9a0');
    shells.current = shells.current.filter((s) => {
      s.age += dt;
      s.vy += G * dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      pool.add({ x: s.x, y: s.y, z: s.z, vx: (Math.random() - 0.5) * 0.5, vy: -0.6, vz: (Math.random() - 0.5) * 0.5, life: 0.55, s0: 0.32, s1: 0.04, a: 1.4, c: trail, g: -1, drag: 1 });
      if (s.age >= s.fuse) { burst(s); return false; }
      return true;
    });
    light.intensity *= Math.exp(-dt * 7);
    pool.update(dt);
  });

  return (
    <>
      <primitive object={pool.obj} />
      <primitive object={light} />
    </>
  );
}
