// Holographic next-step arrows: a thin red chevron on the floor for every
// robot, pointing where it steps next if you stay put. Fainter the farther
// the robot is from you, so forty robots do not paper the floor.

import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, Color, InstancedMesh, MeshBasicMaterial, Object3D, Shape, ShapeGeometry } from 'three';
import { GRID_HEIGHT, GRID_WIDTH, type GameState } from '../game/state';
import { nextSteps } from '../fx/turnDiff';
import { vclock } from '../fx/clock';

const OX = -(GRID_WIDTH - 1) / 2, OZ = -(GRID_HEIGHT - 1) / 2;

function chevron() {
  const s = new Shape();
  s.moveTo(-0.2, -0.12); s.lineTo(0, 0.1); s.lineTo(0.2, -0.12); s.lineTo(0.2, -0.02); s.lineTo(0, 0.2); s.lineTo(-0.2, -0.02);
  s.closePath();
  const g = new ShapeGeometry(s);
  g.rotateX(-Math.PI / 2); // lie flat, point toward -z
  return g;
}

export function Preview({ state, visible }: Readonly<{ state: GameState; visible: boolean }>) {
  const ref = useRef<InstancedMesh>(null);
  const mat = useMemo(() => new MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false }), []);
  const geo = useMemo(() => chevron(), []);
  const o = useMemo(() => new Object3D(), []);
  const c = useMemo(() => new Color(), []);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const steps = visible && state.status === 'playing' ? nextSteps(state) : [];
    m.count = steps.length;
    steps.forEach((s, i) => {
      const dx = s.to.x - s.from.x, dy = s.to.y - s.from.y;
      o.position.set(s.from.x + OX + dx * 0.62, 0.14, s.from.y + OZ + dy * 0.62);
      o.rotation.set(0, Math.atan2(-dx, -dy), 0);
      o.scale.setScalar(Math.hypot(dx, dy) > 1.2 ? 1.1 : 1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      const d = Math.max(Math.abs(s.to.x - state.player.x), Math.abs(s.to.y - state.player.y));
      const f = Math.max(0.15, Math.min(1, (14 - d) / 10));
      m.setColorAt(i, c.setRGB(1 * f, 0.12 * f, 0.3 * f));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [state, visible, o, c]);

  useFrame(() => { mat.opacity = 0.55 + Math.sin(vclock.t * 4) * 0.25; });

  return <instancedMesh ref={ref} args={[geo, mat, 40]} frustumCulled={false} renderOrder={4} />;
}
