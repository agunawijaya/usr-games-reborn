import {
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Shape,
  ShapeGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { createRng } from '@usr-games/kit';
import { at, box, cylinder, mesh, paint, roundedBox, sphere } from '../world/kit3d';
import { PARK_HALF } from '../world/lots';
import { lamps, trees } from '../world/scenery';
import { normalTexture } from '../world/textures';
import { diceTray } from './dice';

/**
 * Harbour City's park, inside the ring road: a plaza in the middle with the glass dice tray, a
 * pond with a footbridge and ducks, flower beds round the plaza, a bandstand, a playground and
 * clusters of trees, all joined by paths.
 */

export interface ParkPalette {
  grass: string;
  path: string;
  water: string;
  dark: boolean;
}

const INNER = PARK_HALF - 0.55;

function lawn(palette: ParkPalette): Mesh {
  const shape = new Shape();
  const r = 1.6;
  const h = INNER;
  shape.moveTo(-h + r, -h);
  shape.lineTo(h - r, -h);
  shape.quadraticCurveTo(h, -h, h, -h + r);
  shape.lineTo(h, h - r);
  shape.quadraticCurveTo(h, h, h - r, h);
  shape.lineTo(-h + r, h);
  shape.quadraticCurveTo(-h, h, -h, h - r);
  shape.lineTo(-h, -h + r);
  shape.quadraticCurveTo(-h, -h, -h + r, -h);
  const m = new Mesh(
    new ShapeGeometry(shape, 12),
    new MeshStandardMaterial({ color: palette.grass, roughness: 0.95 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.1;
  m.receiveShadow = true;
  return m;
}

/** A path as a flat ribbon along a curve through the given points. */
function path(points: [number, number][], width: number, material: MeshStandardMaterial): Mesh {
  const curve = new CatmullRomCurve3(points.map(([x, z]) => new Vector3(x, 0.13, z)));
  const tube = new TubeGeometry(curve, points.length * 12, width / 2, 4, false);
  const m = new Mesh(tube, material);
  m.scale.y = 0.04;
  m.position.y = 0.12;
  m.receiveShadow = true;
  return m;
}

function pond(palette: ParkPalette): Group {
  const group = new Group();
  const blob = new Shape();
  const points: Vector2[] = [];
  const rng = createRng('harbour-pond');
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r = 3.6 + rng.next() * 1.1;
    points.push(new Vector2(Math.cos(a) * r * 1.35, Math.sin(a) * r));
  }
  blob.moveTo(points[0]!.x, points[0]!.y);
  blob.splineThru([...points.slice(1), points[0]!]);
  const rim = new Mesh(
    new ShapeGeometry(blob, 24),
    paint(palette.dark ? '#5a5a62' : '#cfc6b2', { roughness: 0.95 }),
  );
  rim.rotation.x = -Math.PI / 2;
  rim.scale.set(1.08, 1.08, 1);
  rim.position.y = 0.12;
  rim.receiveShadow = true;
  group.add(rim);
  const normalMap = normalTexture('harbour-pond', { strength: 0.8, waves: 10 });
  normalMap.repeat.set(2, 2);
  const water = new Mesh(
    new ShapeGeometry(blob, 24),
    new MeshStandardMaterial({ color: palette.water, roughness: 0.08, metalness: 0.2, normalMap }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.15;
  group.add(water);
  // A wooden footbridge across the narrow end.
  const plank = paint(palette.dark ? '#5a4636' : '#a77d55', { roughness: 0.85 });
  const bridge = new Group();
  for (let i = -3; i <= 3; i++) {
    const t = i / 3;
    bridge.add(at(mesh(box(0.5, 0.08, 1.3), plank), i * 0.55, 0.42 - t * t * 0.3, 0));
  }
  for (const z of [-0.65, 0.65]) {
    const rail = mesh(new CylinderGeometry(0.035, 0.035, 3.8, 6), plank);
    rail.rotation.z = Math.PI / 2;
    bridge.add(at(rail, 0, 0.82, z));
  }
  bridge.position.set(0.4, 0, 0);
  bridge.rotation.y = 0.3;
  group.add(bridge);
  for (let i = 0; i < 4; i++) {
    const duck = new Group();
    duck.add(at(mesh(sphere(0.16, 10), paint(i === 0 ? '#f2d24a' : '#f7f5ef')), 0, 0.2, 0));
    duck.add(at(mesh(sphere(0.09, 8), paint(i === 0 ? '#f2d24a' : '#3f7d4a')), 0.14, 0.33, 0));
    duck.position.set(-2.6 + i * 0.7, 0.05, 1.4 + (i % 2) * 0.6);
    group.add(duck);
  }
  return group;
}

/** Flower beds: rings of small blooms in a few colours. */
function flowers(centres: Vector3[], dark: boolean): InstancedMesh {
  const rng = createRng('harbour-flowers');
  const count = centres.length * 26;
  const blooms = new InstancedMesh(
    sphere(0.11, 6),
    new MeshStandardMaterial({ roughness: 0.8 }),
    count,
  );
  const dummy = new Object3D();
  const colours = dark
    ? ['#7a4a6a', '#6a5a8a', '#8a7a4a']
    : ['#ff6b8b', '#ffd23f', '#ff8c42', '#c084fc', '#ffffff'];
  let i = 0;
  for (const centre of centres) {
    for (let k = 0; k < 26; k++) {
      const a = rng.next() * Math.PI * 2;
      const r = Math.sqrt(rng.next()) * 1.1;
      dummy.position.set(centre.x + Math.cos(a) * r, 0.22, centre.z + Math.sin(a) * r);
      dummy.updateMatrix();
      blooms.setMatrixAt(i, dummy.matrix);
      blooms.setColorAt(i, new Color(rng.pick(colours)));
      i++;
    }
  }
  blooms.castShadow = true;
  return blooms;
}

function bed(x: number, z: number, dark: boolean): Mesh {
  return at(
    mesh(
      new CylinderGeometry(1.3, 1.35, 0.2, 24),
      paint(dark ? '#3a2c24' : '#6b4a32', { roughness: 1 }),
    ),
    x,
    0.15,
    z,
  );
}

function bandstand(dark: boolean): Group {
  const group = new Group();
  const white = paint(dark ? '#c8c6d8' : '#fbf8f0', { roughness: 0.5 });
  group.add(at(mesh(new CylinderGeometry(2.0, 2.1, 0.45, 8), white), 0, 0.33, 0));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    group.add(
      at(mesh(cylinder(0.06, 0.06, 1.9, 8), white), Math.cos(a) * 1.75, 1.5, Math.sin(a) * 1.75),
    );
  }
  group.add(
    at(
      mesh(new CylinderGeometry(0.1, 2.3, 1.1, 8), paint('#d6457f', { roughness: 0.6 })),
      0,
      2.95,
      0,
    ),
  );
  group.add(
    at(
      mesh(
        sphere(0.16, 10),
        paint('#f2b21b', {
          metalness: 0.6,
          roughness: 0.3,
          emissive: new Color('#ffcf3f'),
          emissiveIntensity: dark ? 1.5 : 0,
        }),
      ),
      0,
      3.6,
      0,
    ),
  );
  return group;
}

function playground(dark: boolean): Group {
  const group = new Group();
  const red = paint('#e94f37', { roughness: 0.5 });
  const yellow = paint('#f4c430', { roughness: 0.5 });
  const blue = paint('#2e86de', { roughness: 0.5 });
  group.add(
    at(
      mesh(
        new CylinderGeometry(3.0, 3.0, 0.06, 32),
        paint(dark ? '#4a3a3a' : '#e8b38a', { roughness: 1 }),
      ),
      0,
      0.13,
      0,
    ),
  );
  // Slide: a tower and a ramp.
  group.add(at(mesh(roundedBox(1.0, 1.4, 1.0, 0.08), blue), -1.2, 0.85, 0));
  const ramp = mesh(roundedBox(0.6, 0.08, 2.2, 0.04), yellow);
  ramp.rotation.x = -0.55;
  group.add(at(ramp, -1.2, 0.85, 1.4));
  // Swings: a frame and two seats.
  for (const z of [-1, 1]) {
    const leg = mesh(cylinder(0.05, 0.05, 1.9, 6), red);
    group.add(at(leg, 1.4, 0.95, z * 0.9));
  }
  const bar = mesh(cylinder(0.05, 0.05, 1.9, 6), red);
  bar.rotation.x = Math.PI / 2;
  group.add(at(bar, 1.4, 1.9, 0));
  for (const z of [-0.45, 0.45]) {
    group.add(at(mesh(box(0.02, 1.2, 0.02), paint('#555')), 1.4, 1.3, z));
    group.add(at(mesh(roundedBox(0.4, 0.06, 0.25, 0.02), yellow), 1.4, 0.7, z));
  }
  return group;
}

function benches(spots: [number, number, number][], dark: boolean): Group {
  const group = new Group();
  const wood = paint(dark ? '#5a4636' : '#a77d55', { roughness: 0.8 });
  const iron = paint('#2f3440', { roughness: 0.5, metalness: 0.5 });
  for (const [x, z, yaw] of spots) {
    const bench = new Group();
    bench.add(at(mesh(box(1.1, 0.06, 0.36), wood), 0, 0.42, 0));
    bench.add(at(mesh(box(1.1, 0.3, 0.05), wood), 0, 0.62, 0.17));
    for (const bx of [-0.45, 0.45]) bench.add(at(mesh(box(0.06, 0.42, 0.36), iron), bx, 0.21, 0));
    bench.position.set(x, 0.12, z);
    bench.rotation.y = yaw;
    group.add(bench);
  }
  return group;
}

export function harbourPark(palette: ParkPalette): Group {
  const group = new Group();
  const { dark } = palette;
  group.add(lawn(palette));
  const stone = paint(palette.path, { roughness: 0.9 });
  const plaza = new Mesh(new CylinderGeometry(5.6, 5.6, 0.06, 48), stone);
  plaza.position.y = 0.14;
  plaza.receiveShadow = true;
  group.add(plaza);
  const reach = INNER - 0.4;
  group.add(
    path(
      [
        [0, 5],
        [0.8, 9],
        [-0.6, 12.5],
        [0, reach],
      ],
      1.5,
      stone,
    ),
  );
  group.add(
    path(
      [
        [0, -5],
        [-1.2, -9],
        [0.6, -12.5],
        [0, -reach],
      ],
      1.5,
      stone,
    ),
  );
  group.add(
    path(
      [
        [5, 0],
        [9, 1],
        [12.5, -0.8],
        [reach, 0],
      ],
      1.5,
      stone,
    ),
  );
  group.add(
    path(
      [
        [-5, 0],
        [-9, -0.8],
        [-12.5, 1],
        [-reach, 0],
      ],
      1.5,
      stone,
    ),
  );
  group.add(
    path(
      [
        [3.9, 3.9],
        [7, 7.5],
        [10.5, 9.5],
        [reach - 1, reach - 1],
      ],
      1.1,
      stone,
    ),
  );
  group.add(diceTray(dark));
  const pondGroup = pond(palette);
  pondGroup.position.set(-8.6, 0, -8.4);
  group.add(pondGroup);
  const stand = bandstand(dark);
  stand.position.set(8.8, 0, 7.6);
  group.add(stand);
  const play = playground(dark);
  play.position.set(9.4, 0, -8.6);
  group.add(play);
  const bedSpots = [
    new Vector3(6.4, 0, 2.6),
    new Vector3(-6.4, 0, -2.6),
    new Vector3(2.6, 0, -6.4),
    new Vector3(-2.6, 0, 6.4),
    new Vector3(-6.2, 0, 6.6),
  ];
  for (const s of bedSpots) group.add(bed(s.x, s.z, dark));
  group.add(flowers(bedSpots, dark));
  group.add(
    benches(
      [
        [2.2, 5.6, Math.PI],
        [-2.2, -5.6, 0],
        [5.6, -2.2, -Math.PI / 2],
        [-5.6, 2.2, Math.PI / 2],
        [6.0, 9.0, 2.4],
        [-11, -3.5, 1.2],
      ],
      dark,
    ),
  );
  const rng = createRng('harbour-park-trees');
  const round: Vector3[] = [];
  const blossom: Vector3[] = [];
  const clusters: [number, number][] = [
    [-9.5, 6.5],
    [-11.5, 11],
    [4, 11.5],
    [11.5, 2],
    [-3.5, -11.5],
    [11.5, 12],
    [-12, -12.5],
  ];
  for (const [cx, cz] of clusters) {
    for (let i = 0; i < 4; i++) {
      const p = new Vector3(cx + (rng.next() - 0.5) * 3.4, 0.1, cz + (rng.next() - 0.5) * 3.4);
      if (Math.abs(p.x) > reach - 0.6 || Math.abs(p.z) > reach - 0.6) continue;
      (rng.chance(0.25) ? blossom : round).push(p);
    }
  }
  group.add(
    trees(
      round,
      {
        trunk: '#6b4a2f',
        crowns: dark
          ? ['#1f4a33', '#24583a', '#2c4f2c']
          : ['#5aa846', '#7cc152', '#3f9150', '#94c95a'],
      },
      'harbour-park-round',
    ),
  );
  group.add(
    trees(
      blossom,
      {
        trunk: '#6b4a2f',
        crowns: dark ? ['#5a3a5a', '#6a4a6a'] : ['#f6a5c0', '#f9c2d6', '#f48fb1'],
      },
      'harbour-park-blossom',
    ),
  );
  const lampSpots = [
    [0, 8.5],
    [0, -8.5],
    [8.5, 0],
    [-8.5, 0],
    [4.6, 4.6],
    [-4.6, -4.6],
    [4.6, -4.6],
    [-4.6, 4.6],
  ].map(([x, z]) => new Vector3(x, 0.14, z));
  group.add(lamps(lampSpots, { post: '#2f3440', light: '#ffd27a', height: 1.7 }, dark));
  return group;
}
