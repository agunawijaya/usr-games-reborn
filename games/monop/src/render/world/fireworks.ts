import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LineBasicMaterial,
  LineSegments,
  NormalBlending,
  Points,
  PointsMaterial,
  Vector3,
} from 'three';
import { createRng } from '@usr-games/kit';
import { glowTexture } from './scenery';

/**
 * Fireworks over a lot when its first tower is finished: a few shells rise, burst into
 * spheres of sparks that trail, fall and fade. At night they glow (additive); by day they are
 * bright, opaque sparks so they still read against a pale sky.
 */

interface Shell {
  origin: Vector3;
  start: number;
  colour: Color;
}

const SPARKS = 140;
const TRAIL = 0.22;

export interface Fireworks {
  readonly group: Group;
  /** Moves the show to `seconds` after it began. */
  at(seconds: number): void;
}

export function fireworks(
  centre: Vector3,
  colours: readonly string[],
  dark: boolean,
  seed: string,
): Fireworks {
  const rng = createRng(seed);
  const group = new Group();
  const shells: Shell[] = Array.from({ length: 6 }, (_, i) => ({
    origin: new Vector3(
      centre.x + (rng.next() - 0.5) * 12,
      centre.y + 2 + rng.next() * 5,
      centre.z + (rng.next() - 0.5) * 8,
    ),
    start: i * 0.32 + rng.next() * 0.15,
    colour: new Color(rng.pick(colours)),
  }));
  const directions = Array.from({ length: SPARKS }, () => {
    const u = rng.next() * 2 - 1;
    const a = rng.next() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    return new Vector3(r * Math.cos(a), u, r * Math.sin(a)).multiplyScalar(0.8 + rng.next() * 0.35);
  });
  const layers = shells.map((shell) => {
    const points = new BufferGeometry();
    points.setAttribute('position', new BufferAttribute(new Float32Array(SPARKS * 3), 3));
    const pointMaterial = new PointsMaterial({
      size: dark ? 1.3 : 2.6,
      map: glowTexture(),
      color: shell.colour,
      transparent: true,
      depthWrite: false,
      blending: dark ? AdditiveBlending : NormalBlending,
    });
    const sparks = new Points(points, pointMaterial);
    const lines = new BufferGeometry();
    lines.setAttribute('position', new BufferAttribute(new Float32Array(SPARKS * 6), 3));
    const lineMaterial = new LineBasicMaterial({
      color: shell.colour,
      transparent: true,
      depthWrite: false,
      blending: dark ? AdditiveBlending : NormalBlending,
    });
    const trails = new LineSegments(lines, lineMaterial);
    sparks.frustumCulled = trails.frustumCulled = false;
    group.add(trails, sparks);
    return { shell, points, lines, pointMaterial, lineMaterial };
  });

  /** Where spark `d` of a shell is, `t` seconds after the shell left the ground. */
  const sparkAt = (shell: Shell, d: Vector3, t: number, out: Vector3) => {
    const burst = Math.max(0, t - 0.5);
    if (burst <= 0) {
      const rise = Math.min(1, Math.max(0, t) / 0.5);
      return out.set(shell.origin.x, centre.y + (shell.origin.y - centre.y) * rise, shell.origin.z);
    }
    const radius = 6.5 * (1 - Math.exp(-burst * 2.8));
    return out.set(
      shell.origin.x + d.x * radius,
      shell.origin.y + d.y * radius - 1.3 * burst * burst,
      shell.origin.z + d.z * radius,
    );
  };

  const now = new Vector3();
  const before = new Vector3();
  function at(seconds: number): void {
    for (const { shell, points, lines, pointMaterial, lineMaterial } of layers) {
      const t = seconds - shell.start;
      const burst = t - 0.5;
      const visible = t >= 0 && burst < 2.6;
      pointMaterial.opacity = lineMaterial.opacity = visible
        ? burst > 0
          ? Math.max(0, 1 - burst / 2.6)
          : 1
        : 0;
      if (!visible) continue;
      const position = points.attributes.position as BufferAttribute;
      const segment = lines.attributes.position as BufferAttribute;
      directions.forEach((d, i) => {
        sparkAt(shell, d, t, now);
        sparkAt(shell, d, t - TRAIL, before);
        position.setXYZ(i, now.x, now.y, now.z);
        segment.setXYZ(i * 2, now.x, now.y, now.z);
        segment.setXYZ(i * 2 + 1, before.x, before.y, before.z);
      });
      position.needsUpdate = segment.needsUpdate = true;
    }
  }
  at(0);
  return { group, at };
}
