import {
  AdditiveBlending,
  type BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  DynamicDrawUsage,
  Euler,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  Shape,
  Vector3,
} from 'three';
import { createRng } from '@usr-games/kit';
import { cylinder, roundedBox, sphere } from './kit3d';
import type { BoardLayout } from './lots';

/**
 * The town's furniture, instanced so hundreds of pieces cost a handful of draw calls: trees,
 * street lamps with pools of light at night, cars (or rovers) on the ring road and people on the
 * pavements.
 */

const dummy = new Object3D();

export interface TreeStyle {
  trunk: string;
  crowns: readonly string[];
}

/** Round toy trees at the given points, each a little different in size and colour. */
export function trees(points: readonly Vector3[], style: TreeStyle, seed: string): Group {
  const group = new Group();
  const rng = createRng(seed);
  const trunkMesh = new InstancedMesh(
    cylinder(0.09, 0.13, 1, 8),
    new MeshStandardMaterial({ color: style.trunk, roughness: 0.9 }),
    points.length,
  );
  const crownMaterial = new MeshStandardMaterial({ roughness: 0.85, flatShading: true });
  const crownMesh = new InstancedMesh(
    new IcosahedronGeometry(0.62, 1),
    crownMaterial,
    points.length,
  );
  points.forEach((point, i) => {
    const size = 0.8 + rng.next() * 0.55;
    dummy.position.set(point.x, point.y + 0.5 * size, point.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(size, size, size);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.set(point.x, point.y + 1.35 * size, point.z);
    dummy.rotation.set(rng.next(), rng.next() * 6, rng.next());
    dummy.scale.set(size, size * (0.95 + rng.next() * 0.3), size);
    dummy.updateMatrix();
    crownMesh.setMatrixAt(i, dummy.matrix);
    crownMesh.setColorAt(i, new Color(rng.pick(style.crowns)));
  });
  for (const m of [trunkMesh, crownMesh]) {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  return group;
}

let poolTexture: CanvasTexture | null = null;

/** A soft round glow, for pools of lamplight on the ground. */
export function glowTexture(): CanvasTexture {
  if (poolTexture) return poolTexture;
  const element = document.createElement('canvas');
  element.width = element.height = 128;
  const ctx = element.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  poolTexture = new CanvasTexture(element);
  return poolTexture;
}

export interface LampStyle {
  post: string;
  light: string;
  height: number;
}

/** Street lamps; at night their heads glow and each throws a pool of light on the ground. */
export function lamps(points: readonly Vector3[], style: LampStyle, dark: boolean): Group {
  const group = new Group();
  const posts = new InstancedMesh(
    cylinder(0.05, 0.07, style.height, 8),
    new MeshStandardMaterial({ color: style.post, roughness: 0.5, metalness: 0.5 }),
    points.length,
  );
  const heads = new InstancedMesh(
    sphere(0.17, 12),
    new MeshStandardMaterial({
      color: dark ? style.light : '#e8ecef',
      emissive: new Color(style.light),
      emissiveIntensity: dark ? 2.4 : 0,
      roughness: 0.3,
    }),
    points.length,
  );
  points.forEach((point, i) => {
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.position.set(point.x, point.y + style.height / 2, point.z);
    dummy.updateMatrix();
    posts.setMatrixAt(i, dummy.matrix);
    dummy.position.set(point.x, point.y + style.height + 0.08, point.z);
    dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
  });
  posts.castShadow = true;
  group.add(posts, heads);
  if (dark) {
    const pools = new InstancedMesh(
      new PlaneGeometry(2.8, 2.8),
      new MeshBasicMaterial({
        map: glowTexture(),
        color: style.light,
        transparent: true,
        opacity: 0.4,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      points.length,
    );
    points.forEach((point, i) => {
      dummy.position.set(point.x, point.y + 0.03, point.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      pools.setMatrixAt(i, dummy.matrix);
    });
    pools.renderOrder = 2;
    group.add(pools);
  }
  return group;
}

export interface TrafficStyle {
  /** Saloon cars for a town; six-wheeled rovers under glass canopies for the colony. */
  vehicle: 'car' | 'rover';
  bodies: readonly string[];
  /** The glass. */
  cabin: string;
  wheel: string;
  /** Head and tail lights glow at night. */
  dark: boolean;
}

/** Both kinds of vehicle drive on roads laid this high. */
const ROAD_SURFACE = 0.07;

/** One piece of a vehicle, drawn for every vehicle at once; a wheel has a copy per corner. */
interface VehiclePart {
  geometry: BufferGeometry;
  material: MeshStandardMaterial;
  copies: readonly Matrix4[];
  /** Painted in each vehicle's own body colour. */
  tinted?: boolean;
  shadow?: boolean;
}

function placed(x: number, y: number, z: number, turn?: Euler, scale = 1): Matrix4 {
  dummy.position.set(x, y, z);
  dummy.rotation.copy(turn ?? new Euler());
  dummy.scale.setScalar(scale);
  dummy.updateMatrix();
  return dummy.matrix.clone();
}

const mirrored = (x: number, y: number, z: number, turn?: Euler, scale = 1) => [
  placed(x, y, z, turn, scale),
  placed(x, y, -z, turn, scale),
];

/** Wheels stand on their rims: the cylinder's axis turned to run across the car. */
const AXLE = new Euler(Math.PI / 2, 0, 0);

let cabinShape: BufferGeometry | null = null;

/**
 * A saloon's glasshouse in side view: a raked windscreen at the front, a shorter slope down the
 * back, pushed out across the car's width.
 */
function saloonCabin(): BufferGeometry {
  if (cabinShape) return cabinShape;
  const profile = new Shape();
  profile.moveTo(-0.42, 0);
  profile.lineTo(0.4, 0);
  profile.lineTo(0.16, 0.25);
  profile.lineTo(-0.3, 0.25);
  profile.closePath();
  cabinShape = new ExtrudeGeometry(profile, {
    depth: 0.56,
    bevelEnabled: true,
    bevelSize: 0.03,
    bevelThickness: 0.03,
    bevelSegments: 2,
  });
  cabinShape.translate(0, 0, -0.28);
  cabinShape.userData.shared = true;
  return cabinShape;
}

function lightMaterials(dark: boolean) {
  return {
    head: new MeshStandardMaterial({
      color: '#fff6d8',
      emissive: new Color('#fff2c4'),
      emissiveIntensity: dark ? 3 : 0.2,
    }),
    tail: new MeshStandardMaterial({
      color: '#c0262d',
      emissive: new Color('#ff2a2a'),
      emissiveIntensity: dark ? 2.4 : 0,
    }),
  };
}

/** A town car, nose along +x: a low body on four wheels, a glass cabin and a roof in its colour. */
function saloon(style: TrafficStyle): VehiclePart[] {
  const lights = lightMaterials(style.dark);
  return [
    {
      geometry: roundedBox(1.42, 0.3, 0.72, 0.12),
      material: new MeshStandardMaterial({ roughness: 0.35, metalness: 0.2 }),
      copies: [placed(0, 0.28, 0)],
      tinted: true,
      shadow: true,
    },
    {
      geometry: saloonCabin(),
      material: new MeshStandardMaterial({ color: style.cabin, roughness: 0.12, metalness: 0.5 }),
      copies: [placed(-0.06, 0.41, 0)],
      shadow: true,
    },
    {
      geometry: roundedBox(0.54, 0.06, 0.66, 0.03),
      material: new MeshStandardMaterial({ roughness: 0.35, metalness: 0.2 }),
      copies: [placed(-0.13, 0.69, 0)],
      tinted: true,
    },
    {
      geometry: cylinder(0.15, 0.15, 0.13, 14),
      material: new MeshStandardMaterial({ color: style.wheel, roughness: 0.8 }),
      copies: [...mirrored(0.44, 0.15, 0.31, AXLE), ...mirrored(-0.44, 0.15, 0.31, AXLE)],
    },
    {
      geometry: roundedBox(0.04, 0.08, 0.16, 0.02),
      material: lights.head,
      copies: mirrored(0.71, 0.33, 0.22),
    },
    {
      geometry: roundedBox(0.04, 0.08, 0.14, 0.02),
      material: lights.tail,
      copies: mirrored(-0.71, 0.35, 0.23),
    },
  ];
}

/** A colony rover: a long body on six fat wheels with a glass bubble up front. */
function rover(style: TrafficStyle): VehiclePart[] {
  const lights = lightMaterials(style.dark);
  return [
    {
      geometry: roundedBox(1.36, 0.3, 0.78, 0.1),
      material: new MeshStandardMaterial({ roughness: 0.35, metalness: 0.2 }),
      copies: [placed(0, 0.36, 0)],
      tinted: true,
      shadow: true,
    },
    {
      geometry: sphere(0.34, 18),
      material: new MeshStandardMaterial({ color: style.cabin, roughness: 0.08, metalness: 0.5 }),
      copies: [placed(0.16, 0.5, 0)],
      shadow: true,
    },
    {
      geometry: cylinder(0.17, 0.17, 0.16, 14),
      material: new MeshStandardMaterial({ color: style.wheel, roughness: 0.85 }),
      copies: [-0.46, 0, 0.46].flatMap((x) => mirrored(x, 0.17, 0.4, AXLE)),
    },
    {
      geometry: roundedBox(0.04, 0.08, 0.16, 0.02),
      material: lights.head,
      copies: mirrored(0.69, 0.4, 0.26),
    },
    {
      geometry: roundedBox(0.04, 0.08, 0.14, 0.02),
      material: lights.tail,
      copies: mirrored(-0.69, 0.42, 0.27),
    },
  ];
}

/** Vehicles round the ring in two lanes, the inner one with the play, the outer one against it. */
export function traffic(layout: BoardLayout, count: number, style: TrafficStyle, seed: string) {
  const rng = createRng(seed);
  const group = new Group();
  const parts = (style.vehicle === 'rover' ? rover : saloon)(style).map((part) => {
    const drawn = new InstancedMesh(part.geometry, part.material, count * part.copies.length);
    drawn.instanceMatrix.setUsage(DynamicDrawUsage);
    drawn.castShadow = part.shadow ?? false;
    group.add(drawn);
    return { ...part, drawn };
  });
  const vehicles = Array.from({ length: count }, (_, i) => {
    const inner = i % 2 === 0;
    const lane = inner ? -0.78 : 0.78;
    const colour = new Color(rng.pick(style.bodies));
    for (const part of parts) {
      if (!part.tinted) continue;
      part.copies.forEach((_, k) => part.drawn.setColorAt(i * part.copies.length + k, colour));
    }
    return {
      lane,
      direction: inner ? 1 : -1,
      s: (i / count) * layout.pathLength(lane) + rng.next() * 3,
      speed: 2.2 + rng.next() * 1.4,
    };
  });
  const matrix = new Matrix4();
  const piece = new Matrix4();
  const quaternion = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const unit = new Vector3(1, 1, 1);
  function update(seconds: number): void {
    vehicles.forEach((vehicle, i) => {
      vehicle.s += vehicle.speed * seconds * vehicle.direction;
      const { point, heading } = layout.path(vehicle.s, vehicle.lane);
      const facing = heading + (vehicle.direction < 0 ? Math.PI : 0);
      // A vehicle is modelled nose along +x; a turn of -heading about y points it along the road.
      quaternion.setFromAxisAngle(up, -facing);
      matrix.compose(point.setY(ROAD_SURFACE), quaternion, unit);
      for (const part of parts) {
        part.copies.forEach((local, k) => {
          part.drawn.setMatrixAt(i * part.copies.length + k, piece.multiplyMatrices(matrix, local));
        });
      }
    });
    for (const part of parts) part.drawn.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { group, update };
}

export interface PeopleStyle {
  clothes: readonly string[];
  skin: readonly string[];
}

/** People strolling round the pavements on both sides of the road. */
export function people(
  layout: BoardLayout,
  count: number,
  style: PeopleStyle,
  seed: string,
  offsets: readonly number[],
) {
  const rng = createRng(seed);
  const group = new Group();
  const bodies = new InstancedMesh(
    new CapsuleGeometry(0.13, 0.32, 4, 8),
    new MeshStandardMaterial({ roughness: 0.8 }),
    count,
  );
  const heads = new InstancedMesh(
    sphere(0.11, 10),
    new MeshStandardMaterial({ roughness: 0.7 }),
    count,
  );
  for (const m of [bodies, heads]) {
    m.instanceMatrix.setUsage(DynamicDrawUsage);
    m.castShadow = true;
    group.add(m);
  }
  const walkers = Array.from({ length: count }, (_, i) => {
    bodies.setColorAt(i, new Color(rng.pick(style.clothes)));
    heads.setColorAt(i, new Color(rng.pick(style.skin)));
    const offset = rng.pick(offsets) + (rng.next() - 0.5) * 0.4;
    return {
      offset,
      s: rng.next() * layout.pathLength(offset),
      speed: (0.45 + rng.next() * 0.35) * (rng.chance(0.5) ? 1 : -1),
      phase: rng.next() * 6,
    };
  });
  function update(seconds: number, elapsed: number): void {
    walkers.forEach((walker, i) => {
      walker.s += walker.speed * seconds;
      const { point } = layout.path(walker.s, walker.offset);
      const bob = Math.abs(Math.sin(elapsed * 7 + walker.phase)) * 0.05;
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.position.set(point.x, 0.32 + bob, point.z);
      dummy.updateMatrix();
      bodies.setMatrixAt(i, dummy.matrix);
      dummy.position.set(point.x, 0.68 + bob, point.z);
      dummy.updateMatrix();
      heads.setMatrixAt(i, dummy.matrix);
    });
    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
  }
  update(0, 0);
  return { group, update };
}
