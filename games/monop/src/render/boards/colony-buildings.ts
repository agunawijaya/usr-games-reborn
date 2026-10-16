import {
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { createRng } from '@usr-games/kit';
import { at, box, cylinder, mesh, paint, roundedBox, sphere } from '../world/kit3d';

/**
 * Ring Colony's habitats. A lot grows from a single pod (1) to two pods and a tube (2), a
 * three-tier tower (3), a tall tower with a ring deck (4), and the district's landmark (5): a
 * mining derrick, a greenhouse spire, a spinning dorm wheel, a market dome, an observatory, a
 * reactor, a cluster of garden domes, the captain's needle. Every module wears its district's
 * colour as a band of light.
 */

export interface HabitatOptions {
  group: number;
  level: number;
  width: number;
  depth: number;
  dark: boolean;
  accent: string;
  seed: string;
}

const hull = (dark: boolean) =>
  paint(dark ? '#9aa3b8' : '#eef1f6', { roughness: 0.35, metalness: 0.45 });
const panel = (dark: boolean) =>
  paint(dark ? '#5a6278' : '#c9d0dc', { roughness: 0.5, metalness: 0.5 });
const glow = (colour: string, dark: boolean, intensity = 1.8) =>
  paint(colour, {
    roughness: 0.3,
    emissive: new Color(colour),
    emissiveIntensity: dark ? intensity : intensity * 0.18,
  });

const glassCache = new Map<string, MeshStandardMaterial>();
function glass(tint: string, dark: boolean): MeshStandardMaterial {
  const key = `${tint}:${dark}`;
  let m = glassCache.get(key);
  if (!m) {
    m = new MeshStandardMaterial({
      color: tint,
      transparent: true,
      opacity: dark ? 0.5 : 0.35,
      roughness: 0.05,
      metalness: 0.2,
      emissive: new Color(tint),
      emissiveIntensity: dark ? 0.9 : 0,
      envMapIntensity: 1.5,
    });
    glassCache.set(key, m);
  }
  return m;
}

/** A dome on a ring: glass cap over a lit floor, with a district band at its foot. */
function dome(radius: number, accent: string, dark: boolean, inner = '#7fd89a'): Group {
  const group = new Group();
  group.add(at(mesh(cylinder(radius * 1.04, radius * 1.08, 0.3, 32), panel(dark)), 0, 0.15, 0));
  torusRing(group, radius * 1.02, 0.32, glow(accent, dark, 2.2), 0.08);
  group.add(
    at(
      mesh(
        cylinder(radius * 0.9, radius * 0.9, 0.12, 24),
        paint(inner, {
          roughness: 0.9,
          emissive: new Color(inner),
          emissiveIntensity: dark ? 0.6 : 0,
        }),
      ),
      0,
      0.34,
      0,
    ),
  );
  const cap = new Mesh(
    new SphereGeometry(radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    glass('#bfe8ff', dark),
  );
  cap.position.y = 0.3;
  group.add(cap);
  const ribs = new Mesh(
    new SphereGeometry(radius * 1.005, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    new MeshStandardMaterial({
      color: '#dfe6f0',
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    }),
  );
  ribs.position.y = 0.3;
  group.add(ribs);
  return group;
}

function torusRing(
  group: Group,
  radius: number,
  y: number,
  material: MeshStandardMaterial,
  tube = 0.1,
): void {
  const ring = mesh(new TorusGeometry(radius, tube, 8, 40), material);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = y;
  group.add(ring);
}

/** A stacked cylindrical tower: tiers of hull with a lit window ring each. */
function tower(tiers: number, radius: number, accent: string, dark: boolean): Group {
  const group = new Group();
  let y = 0;
  for (let i = 0; i < tiers; i++) {
    const r = radius * (1 - i * 0.07);
    group.add(at(mesh(cylinder(r, r * 1.02, 1.6, 24), hull(dark)), 0, y + 0.8, 0));
    group.add(
      at(mesh(cylinder(r * 1.01, r * 1.01, 0.32, 24), glow('#ffe7a8', dark, 0.85)), 0, y + 1.0, 0),
    );
    torusRing(group, r * 1.03, y + 1.6, glow(accent, dark, 2), 0.06);
    y += 1.6;
  }
  group.add(
    at(
      mesh(new SphereGeometry(radius * 0.8, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), hull(dark)),
      0,
      y,
      0,
    ),
  );
  group.userData.top = y + radius * 0.8;
  return group;
}

function pod(accent: string, dark: boolean): Group {
  const group = new Group();
  const body = mesh(cylinder(0.75, 0.75, 1.9, 20), hull(dark));
  body.rotation.z = Math.PI / 2;
  group.add(at(body, 0, 0.95, 0));
  for (const x of [-0.95, 0.95]) group.add(at(mesh(sphere(0.75, 18), hull(dark)), x, 0.95, 0));
  group.add(at(mesh(roundedBox(1.6, 0.26, 1.56, 0.08), glow('#ffe7a8', dark, 1.2)), 0, 1.0, 0));
  group.add(at(mesh(roundedBox(2.9, 0.12, 0.3, 0.05), glow(accent, dark, 2)), 0, 0.42, -0.62));
  return group;
}

function solarPanel(dark: boolean): Group {
  const group = new Group();
  group.add(at(mesh(cylinder(0.05, 0.05, 1.1, 6), panel(dark)), 0, 0.55, 0));
  const face = mesh(box(1.3, 0.04, 0.8), paint('#26408a', { roughness: 0.2, metalness: 0.7 }));
  face.rotation.x = -0.5;
  group.add(at(face, 0, 1.15, 0));
  return group;
}

function antenna(dark: boolean, height: number): Group {
  const group = new Group();
  group.add(at(mesh(cylinder(0.04, 0.06, height, 6), panel(dark)), 0, height / 2, 0));
  group.add(
    at(
      mesh(
        sphere(0.12, 10),
        paint('#ff3a3a', { emissive: new Color('#ff3a3a'), emissiveIntensity: dark ? 3 : 0.6 }),
      ),
      0,
      height,
      0,
    ),
  );
  return group;
}

/** A stack of glass-banded spheres joined by tubes. */
function cluster(count: number, accent: string, dark: boolean): Group {
  const group = new Group();
  let y = 0.9;
  for (let i = 0; i < count; i++) {
    const r = 1.05 - i * 0.12;
    group.add(at(mesh(sphere(r, 24), hull(dark)), (i % 2) * 0.4 - 0.2, y, 0));
    torusRing(group, r * 1.01, y, glow('#ffe7a8', dark, 0.9), 0.1);
    if (i < count - 1)
      group.add(at(mesh(cylinder(0.28, 0.28, 0.9, 12), panel(dark)), 0, y + r * 0.9, 0));
    y += r * 1.8;
  }
  torusRing(group, 1.15, 0.5, glow(accent, dark, 2), 0.07);
  group.userData.top = y;
  return group;
}

/** Boxy modules stepped up on each other, with solar wings. */
function blocks(count: number, accent: string, dark: boolean): Group {
  const group = new Group();
  let y = 0;
  for (let i = 0; i < count; i++) {
    const w = 2.3 - i * 0.25;
    const h = 1.3;
    group.add(at(mesh(roundedBox(w, h, w * 0.8, 0.22), hull(dark)), (i % 2) * 0.25, y + h / 2, 0));
    group.add(
      at(
        mesh(roundedBox(w * 0.84, 0.24, w * 0.82, 0.05), glow('#ffe7a8', dark, 0.85)),
        (i % 2) * 0.25,
        y + h * 0.55,
        0,
      ),
    );
    group.add(
      at(
        mesh(box(w + 0.04, 0.08, 0.16), glow(accent, dark, 2)),
        (i % 2) * 0.25,
        y + h - 0.1,
        -w * 0.38,
      ),
    );
    y += h;
  }
  for (const x of [-1.9, 1.9]) {
    const wing = mesh(box(1.4, 0.04, 0.9), paint('#26408a', { roughness: 0.2, metalness: 0.7 }));
    wing.rotation.z = x > 0 ? -0.3 : 0.3;
    group.add(at(wing, x, y - 0.4, 0));
  }
  group.userData.top = y;
  return group;
}

/** A finished habitat of level 1–4, in one of three families so districts differ in shape. */
export function habitat(options: HabitatOptions): Group {
  const { level, width, depth, dark, accent, seed } = options;
  const family = options.group % 3;
  const group = new Group();
  const rng = createRng(seed);
  if (level === 1) {
    if (family === 0) group.add(pod(accent, dark));
    else if (family === 1) group.add(dome(1.2, accent, dark));
    else group.add(blocks(1, accent, dark));
    group.add(at(solarPanel(dark), width * 0.3, 0, depth * 0.25));
  } else if (level === 2) {
    if (family === 1) {
      group.add(at(dome(1.1, accent, dark), -width * 0.15, 0, -depth * 0.1));
      group.add(at(dome(0.9, accent, dark), width * 0.2, 0, depth * 0.25));
    } else {
      group.add(
        at(family === 0 ? pod(accent, dark) : blocks(1, accent, dark), 0, 0, -depth * 0.12),
      );
      const second = family === 0 ? pod(accent, dark) : blocks(2, accent, dark);
      second.rotation.y = Math.PI / 2;
      group.add(at(second, width * 0.18, 0, depth * 0.25));
    }
    const tube = at(mesh(cylinder(0.3, 0.3, 1.2, 12), panel(dark)), width * 0.1, 0.9, depth * 0.06);
    tube.rotation.x = Math.PI / 2;
    group.add(tube);
  } else {
    const tall = level >= 4;
    const body =
      family === 0
        ? tower(tall ? 5 : 3, tall ? 1.35 : 1.25, accent, dark)
        : family === 1
          ? cluster(tall ? 4 : 2, accent, dark)
          : blocks(tall ? 6 : 3, accent, dark);
    group.add(body);
    if (tall) {
      if (family === 0) torusRing(group, 2.0, 5.6, hull(dark), 0.22);
      group.add(at(antenna(dark, 2.2), 0, (body.userData.top as number) - 0.1, 0));
      group.add(at(solarPanel(dark), -width * 0.32, 0, depth * 0.3));
    } else {
      group.add(at(dome(1.0, accent, dark), width * 0.25, 0, depth * 0.3));
    }
  }
  group.rotation.y = (rng.next() - 0.5) * 0.4;
  return group;
}

/** Height of a level's habitat, for the construction kit. */
export function habitatHeight(level: number): number {
  return [0, 1.9, 2.2, 5.6, 9.4, 15][Math.min(5, Math.max(0, level))]!;
}

/** Each district's landmark. */
export function colonyLandmark(options: HabitatOptions): Group {
  const { group: district, width, depth, dark, accent } = options;
  const group = new Group();
  const lit = (i = 2) => glow(accent, dark, i);
  switch (district) {
    case 0: {
      // A mining derrick: a lattice tower over a drill, with ore buckets.
      for (const [x, z] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const) {
        const leg = mesh(
          cylinder(0.09, 0.12, 11, 6),
          paint('#c98a3a', { metalness: 0.5, roughness: 0.4 }),
        );
        leg.rotation.z = -x * 0.1;
        leg.rotation.x = z * 0.1;
        group.add(at(leg, x * 0.9, 5.5, z * 0.9));
      }
      for (let y = 1.5; y < 11; y += 1.6)
        group.add(
          at(
            mesh(box(2.0 - y * 0.06, 0.1, 2.0 - y * 0.06), paint('#c98a3a', { metalness: 0.5 })),
            0,
            y,
            0,
          ),
        );
      group.add(at(mesh(cylinder(0.25, 0.25, 9, 10), panel(dark)), 0, 4.5, 0));
      group.add(at(mesh(cylinder(0.6, 0.2, 1.2, 12), lit(2.4)), 0, 11.2, 0));
      group.add(
        at(mesh(roundedBox(2.2, 1.4, 1.8, 0.2), hull(dark)), width * 0.25, 0.7, depth * 0.25),
      );
      break;
    }
    case 1: {
      // A greenhouse spire: stacked glass drums glowing green.
      for (let i = 0; i < 6; i++) {
        const r = 1.5 - i * 0.18;
        group.add(
          at(
            new Mesh(new CylinderGeometry(r * 0.92, r, 2.0, 24), glass('#8affb0', dark)),
            0,
            1.0 + i * 2.0,
            0,
          ),
        );
        group.add(
          at(
            mesh(
              cylinder(r * 0.7, r * 0.7, 1.6, 12),
              paint('#4fbf6a', {
                roughness: 0.9,
                emissive: new Color('#5aff8a'),
                emissiveIntensity: dark ? 0.8 : 0,
              }),
            ),
            0,
            1.0 + i * 2.0,
            0,
          ),
        );
        torusRing(group, r, 2.0 + i * 2.0, hull(dark), 0.07);
      }
      group.add(at(antenna(dark, 2.5), 0, 12, 0));
      break;
    }
    case 2: {
      // A dorm wheel: a habitat torus on a mast, slowly turning.
      group.add(at(mesh(cylinder(0.35, 0.5, 9, 12), hull(dark)), 0, 4.5, 0));
      const wheel = new Group();
      const ring = mesh(new TorusGeometry(3.2, 0.55, 12, 40), hull(dark));
      wheel.add(ring);
      const windows = mesh(
        new TorusGeometry(3.2, 0.57, 4, 40, Math.PI * 2),
        glow('#ffe7a8', dark, 1.2),
      );
      windows.scale.set(1, 1, 0.3);
      wheel.add(windows);
      for (let i = 0; i < 4; i++) {
        const spoke = mesh(cylinder(0.08, 0.08, 6.4, 6), panel(dark));
        spoke.rotation.z = (i / 4) * Math.PI;
        wheel.add(spoke);
      }
      wheel.position.y = 8;
      wheel.name = 'spin';
      group.add(wheel);
      torusRing(group, 0.7, 8, lit(2.6), 0.14);
      break;
    }
    case 3: {
      // The market dome with coloured awnings round its rim.
      group.add(dome(2.6, accent, dark, '#ffb84a'));
      const colours = ['#ff6b4a', '#ffd23f', '#2fb3d6', '#e06bb2'];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const awning = mesh(
          roundedBox(1.0, 0.08, 0.6, 0.03),
          paint(colours[i % 4]!, { roughness: 0.7 }),
        );
        awning.rotation.y = -a;
        awning.rotation.x = 0.4;
        group.add(at(awning, Math.cos(a) * 2.9, 1.0, Math.sin(a) * 2.9));
      }
      const sign = new Group();
      sign.add(mesh(new TorusGeometry(1.1, 0.12, 8, 30), lit(2.6)));
      sign.position.y = 4.4;
      sign.name = 'spin';
      group.add(sign);
      group.add(at(mesh(cylinder(0.06, 0.06, 1.6, 6), panel(dark)), 0, 3.4, 0));
      break;
    }
    case 4: {
      // The observatory: a white dome with its slit open and the telescope peering out.
      group.add(at(mesh(cylinder(1.9, 2.0, 4.0, 28), hull(dark)), 0, 2.0, 0));
      const cap = mesh(
        new SphereGeometry(2.0, 28, 14, 0.3, Math.PI * 2 - 0.6, 0, Math.PI / 2),
        hull(dark),
      );
      cap.rotation.y = 0.9;
      group.add(at(cap, 0, 4.0, 0));
      const scope = mesh(cylinder(0.32, 0.42, 3.2, 16), paint('#2b2f3a', { metalness: 0.6 }));
      scope.rotation.x = -0.9;
      scope.rotation.y = 0.9;
      group.add(at(scope, 0.6, 5.2, -0.6));
      torusRing(group, 2.02, 4.0, lit(2.2), 0.08);
      break;
    }
    case 5: {
      // The reactor: a stack with glowing core rings.
      group.add(at(mesh(cylinder(1.6, 2.0, 7.0, 24), hull(dark)), 0, 3.5, 0));
      for (let i = 0; i < 4; i++)
        torusRing(group, 1.75 - i * 0.04, 1.6 + i * 1.6, glow('#ff6a3a', dark, 3), 0.14);
      group.add(at(mesh(cylinder(1.2, 1.6, 1.2, 24), panel(dark)), 0, 7.6, 0));
      group.add(at(mesh(sphere(0.7, 18), glow('#ffb04a', dark, 3.2)), 0, 8.5, 0));
      break;
    }
    case 6: {
      // Garden domes: three domes with flowering trees inside.
      group.add(at(dome(2.1, accent, dark, '#8ad86a'), 0, 0, 0));
      group.add(at(dome(1.3, accent, dark, '#8ad86a'), width * 0.3, 0, depth * 0.3));
      group.add(at(dome(1.1, accent, dark, '#8ad86a'), -width * 0.3, 0, depth * 0.28));
      for (const [x, z, c] of [
        [0, 0, '#ff8fc4'],
        [0.6, 0.5, '#ffd23f'],
        [-0.6, -0.4, '#ff8fc4'],
      ] as const) {
        group.add(at(mesh(cylinder(0.06, 0.08, 1.1, 6), paint('#6b4a2f')), x, 0.9, z));
        group.add(
          at(
            mesh(
              sphere(0.55, 10),
              paint(c, {
                flatShading: true,
                emissive: new Color(c),
                emissiveIntensity: dark ? 0.5 : 0,
              }),
            ),
            x,
            1.6,
            z,
          ),
        );
      }
      break;
    }
    default: {
      // The captain's needle: the tallest spire, a halo ring and a beacon.
      group.add(at(mesh(cylinder(0.2, 1.4, 15, 20), hull(dark)), 0, 7.5, 0));
      for (let i = 0; i < 5; i++) torusRing(group, 1.25 - i * 0.2, 2 + i * 2.6, lit(2.2), 0.07);
      torusRing(group, 2.4, 11, glass('#bfe8ff', dark), 0.16);
      group.add(at(mesh(sphere(0.3, 14), glow('#ffffff', dark, 4)), 0, 15.2, 0));
    }
  }
  return group;
}

/** A shuttle: a white lifting body with a cockpit, delta wings, a tail fin and two engines. */
export function shuttle(dark: boolean, colour = '#e94f37'): Group {
  const group = new Group();
  const white = hull(dark);
  group.add(at(mesh(roundedBox(3.6, 0.8, 1.2, 0.36), white), 0, 1.0, 0));
  const nose = mesh(cylinder(0.0, 0.58, 1.1, 20), white);
  nose.rotation.z = -Math.PI / 2;
  nose.scale.set(1, 1, 0.7);
  group.add(at(nose, 2.3, 1.0, 0));
  group.add(
    at(
      mesh(
        roundedBox(0.9, 0.34, 0.86, 0.14),
        paint('#1d2a44', {
          roughness: 0.1,
          metalness: 0.6,
          emissive: new Color('#5fd3ff'),
          emissiveIntensity: dark ? 1 : 0.15,
        }),
      ),
      1.5,
      1.42,
      0,
    ),
  );
  for (const side of [-1, 1]) {
    const wing = new Mesh(
      new CylinderGeometry(0.0, 1.0, 0.08, 3),
      paint(colour, { roughness: 0.4 }),
    );
    wing.scale.set(1.4, 1, 1.9);
    wing.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    group.add(at(wing, -0.6, 0.8, side * 1.05));
  }
  const fin = new Mesh(new CylinderGeometry(0.0, 0.7, 0.07, 3), paint(colour, { roughness: 0.4 }));
  fin.rotation.x = Math.PI / 2;
  fin.scale.set(1.2, 1, 1.4);
  group.add(at(fin, -1.4, 1.65, 0));
  for (const z of [-0.3, 0.3]) {
    const bell = mesh(
      cylinder(0.26, 0.18, 0.4, 14),
      paint('#5a6278', { metalness: 0.7, roughness: 0.3 }),
    );
    bell.rotation.z = Math.PI / 2;
    group.add(at(bell, -2.0, 1.0, z));
    const fire = mesh(cylinder(0.22, 0.16, 0.12, 14), glow('#7fd0ff', dark, 2.8));
    fire.rotation.z = Math.PI / 2;
    group.add(at(fire, -2.22, 1.0, z));
  }
  for (const z of [-0.45, 0.45])
    group.add(at(mesh(cylinder(0.04, 0.04, 0.6, 6), panel(dark)), 0.4, 0.35, z));
  return group;
}

export { dome, glass, glow as colonyGlow, hull as colonyHull };
