import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import { drawEmblem } from '../../boards/emblems';
import { at, box, cylinder, gold, mesh, paint, roundedBox } from '../world/kit3d';
import type { FlagHonour } from '../world/world';

/**
 * Pieces every board's lots share: a block of storeys with a window facade, the building site
 * that raises the next storey (floors, scaffold and a tower crane), an owner's flag and the
 * board that says a lot is still for sale.
 */

const WINDOW_SPACING = 0.9;
const TILE_WINDOWS = 4;

const walls = new Map<string, MeshStandardMaterial>();

function wallMaterial(
  map: CanvasTexture,
  glow: CanvasTexture,
  dark: boolean,
): MeshStandardMaterial {
  const key = `${map.uuid}:${dark}`;
  let material = walls.get(key);
  if (!material) {
    material = new MeshStandardMaterial({
      map,
      emissiveMap: glow,
      emissive: new Color('#ffffff'),
      emissiveIntensity: dark ? 1.7 : 0,
      roughness: 0.42,
      metalness: 0.15,
    });
    walls.set(key, material);
  }
  return material;
}

/** A box whose four walls show the facade, one window row per storey. */
function facadeBox(width: number, height: number, depth: number, storeys: number): BoxGeometry {
  const geometry = new BoxGeometry(width, height, depth);
  const uv = geometry.attributes.uv!;
  // BoxGeometry writes four uv pairs per face in the order +x, -x, +y, -y, +z, -z.
  for (let face = 0; face < 6; face++) {
    const across = face < 2 ? depth : width;
    const u = across / (WINDOW_SPACING * TILE_WINDOWS);
    const v = storeys / TILE_WINDOWS;
    for (let k = 0; k < 4; k++) {
      const i = face * 4 + k;
      uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
    }
  }
  return geometry;
}

export interface FloorsOptions {
  width: number;
  depth: number;
  floors: number;
  storey: number;
  map: CanvasTexture;
  glow: CanvasTexture;
  dark: boolean;
  roof: string;
}

/** A block of storeys standing on the ground at y = 0, with a roof slab and parapet. */
export function buildingFloors(options: FloorsOptions): Group {
  const { width, depth, floors, storey, map, glow, dark, roof } = options;
  const group = new Group();
  if (floors <= 0) return group;
  const height = floors * storey;
  const wall = wallMaterial(map, glow, dark);
  const roofMaterial = paint(roof, { roughness: 0.85 });
  const body = new Mesh(facadeBox(width, height, depth, floors), [
    wall,
    wall,
    roofMaterial,
    roofMaterial,
    wall,
    wall,
  ]);
  body.position.y = height / 2 + 0.12;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  group.add(at(mesh(box(width + 0.1, 0.16, depth + 0.1), roofMaterial), 0, height + 0.18, 0));
  return group;
}

export interface ConstructionOptions {
  width: number;
  depth: number;
  /** Height already standing, and the height being built to. */
  from: number;
  to: number;
  progress: number;
  dark: boolean;
  accent: string;
}

/**
 * A storey going up: the new floors appear slab by slab inside a scaffold, and a tower crane
 * beside the lot swings its jib. `progress` 0 is the empty frame, 1 the finished height.
 */
export function constructionKit(options: ConstructionOptions): Group {
  const { width, depth, from, to, progress, dark, accent } = options;
  const group = new Group();
  const built = from + (to - from) * Math.min(1, Math.max(0, progress));
  const concrete = paint(dark ? '#5b5f6a' : '#cfc9bd', { roughness: 0.9 });
  const steel = paint('#f2b21b', { roughness: 0.5, metalness: 0.3 });
  // The rising frame: slabs every storey up to the built height, columns at the corners.
  for (let y = from + 1.15; y <= built + 0.01; y += 1.15) {
    group.add(at(mesh(box(width * 0.96, 0.14, depth * 0.96), concrete), 0, y + 0.12, 0));
  }
  if (built > from) {
    for (const [x, z] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      group.add(
        at(
          mesh(box(0.16, built - from, 0.16), concrete),
          (x * width) / 2.1,
          from + (built - from) / 2 + 0.12,
          (z * depth) / 2.1,
        ),
      );
    }
  }
  // Scaffold poles and boards round the whole height to come.
  const pole = paint(dark ? '#8a8f9a' : '#9aa0aa', { metalness: 0.6, roughness: 0.4 });
  const top = to + 0.6;
  for (const x of [-1, 0, 1]) {
    for (const z of [-1, 1]) {
      group.add(
        at(
          mesh(cylinder(0.035, 0.035, top, 6), pole),
          (x * (width + 0.4)) / 2,
          top / 2,
          (z * (depth + 0.4)) / 2,
        ),
      );
    }
  }
  for (let y = 1.15; y < top; y += 1.15) {
    for (const z of [-1, 1]) {
      group.add(
        at(
          mesh(
            box(width + 0.5, 0.05, 0.3),
            paint(dark ? '#6a5a44' : '#c89a5a', { roughness: 0.9 }),
          ),
          0,
          y,
          (z * (depth + 0.4)) / 2,
        ),
      );
    }
  }
  // Safety mesh in the district's colour on the side facing the road.
  const netting = new Mesh(
    new PlaneGeometry(width + 0.5, Math.max(0.6, to - built)),
    new MeshStandardMaterial({
      color: accent,
      transparent: true,
      opacity: 0.45,
      side: DoubleSide,
      roughness: 0.9,
    }),
  );
  netting.position.set(0, built + (to - built) / 2 + 0.2, -(depth + 0.5) / 2);
  group.add(netting);
  group.add(towerCrane(to + 4.5, width, depth, steel));
  return group;
}

let lattice: CanvasTexture | null = null;

/** The see-through steel lattice of a crane's mast and jib: bars and a diagonal per bay. */
function latticeTexture(): CanvasTexture {
  if (lattice) return lattice;
  const element = document.createElement('canvas');
  element.width = element.height = 64;
  const ctx = element.getContext('2d')!;
  ctx.strokeStyle = '#f2b21b';
  ctx.lineWidth = 7;
  ctx.strokeRect(3.5, 3.5, 57, 57);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(4, 60);
  ctx.lineTo(60, 4);
  ctx.stroke();
  lattice = new CanvasTexture(element);
  lattice.colorSpace = SRGBColorSpace;
  lattice.wrapS = lattice.wrapT = RepeatWrapping;
  return lattice;
}

function latticeBox(length: number, thickness: number, along: 'x' | 'y'): Mesh {
  const map = latticeTexture().clone();
  map.needsUpdate = true;
  map.repeat.set(along === 'x' ? length / thickness : 1, along === 'y' ? length / thickness : 1);
  const geometry =
    along === 'x'
      ? new BoxGeometry(length, thickness, thickness)
      : new BoxGeometry(thickness, length, thickness);
  const material = new MeshStandardMaterial({
    map,
    alphaTest: 0.5,
    side: DoubleSide,
    roughness: 0.5,
    metalness: 0.3,
  });
  const result = new Mesh(geometry, material);
  result.castShadow = true;
  return result;
}

function towerCrane(
  height: number,
  width: number,
  depth: number,
  steel: MeshStandardMaterial,
): Group {
  const crane = new Group();
  crane.position.set(width / 2 + 0.6, 0, depth / 2 + 0.2);
  crane.add(at(latticeBox(height, 0.46, 'y'), 0, height / 2, 0));
  const jib = new Group();
  jib.name = 'crane-jib';
  jib.position.y = height;
  jib.add(at(latticeBox(width + 6, 0.36, 'x'), -(width + 6) / 2 + 2.2, 0.16, 0));
  jib.add(at(mesh(box(width + 6, 0.06, 0.06), steel), -(width + 6) / 2 + 2.2, 0.36, 0));
  jib.add(at(mesh(roundedBox(1.0, 0.6, 0.6, 0.1), paint('#3b3f4a')), 1.9, 0.0, 0));
  jib.add(at(mesh(box(0.7, 0.7, 0.7), paint('#d8d2c4')), 0, 0.5, 0));
  const hookX = -width - 1.2;
  jib.add(at(mesh(cylinder(0.02, 0.02, 3.2, 4), paint('#1d1f24')), hookX, -1.6, 0));
  jib.add(at(mesh(roundedBox(0.9, 0.35, 0.6, 0.06), paint('#c89a5a')), hookX, -3.3, 0));
  jib.rotation.y = 0.6;
  crane.add(jib);
  return crane;
}

const flags = new Map<string, CanvasTexture>();

function flagTexture(colour: string, token: string): CanvasTexture {
  const key = `${colour}:${token}`;
  let texture = flags.get(key);
  if (!texture) {
    const element = document.createElement('canvas');
    element.width = 192;
    element.height = 128;
    const ctx = element.getContext('2d')!;
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, 192, 128);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, 0, 192, 18);
    ctx.translate(48, 16);
    drawEmblem(ctx, token, 96, '#ffffff', 5);
    texture = new CanvasTexture(element);
    texture.colorSpace = SRGBColorSpace;
    flags.set(key, texture);
  }
  return texture;
}

let pennant: BufferGeometry | null = null;

/** A long thin triangle of cloth, flying from the top of a flagpole. */
function pennantGeometry(): BufferGeometry {
  if (pennant) return pennant;
  pennant = new BufferGeometry();
  pennant.setAttribute(
    'position',
    new Float32BufferAttribute([0, 0.16, 0, 0, -0.16, 0, 0.95, 0.02, 0], 3),
  );
  pennant.computeVertexNormals();
  pennant.userData.shared = true;
  return pennant;
}

/**
 * A flag in the owner's colour with their token's emblem, on a pole at the front of the lot. A
 * career's touches add a gold pennant above it, or a gilded pole.
 */
export function ownerFlag(
  colour: string,
  token: string,
  dark: boolean,
  honour?: FlagHonour,
): Group {
  const group = new Group();
  group.add(
    at(
      mesh(
        cylinder(0.04, 0.05, 2.8, 8),
        honour?.gilded
          ? gold()
          : paint(dark ? '#c9ced6' : '#f2f4f6', { metalness: 0.6, roughness: 0.3 }),
      ),
      0,
      1.4,
      0,
    ),
  );
  if (honour?.pennant) {
    const pennant = new Mesh(
      pennantGeometry(),
      paint('#e8b830', { metalness: 0.5, roughness: 0.35, side: DoubleSide }),
    );
    pennant.position.set(0.04, 3.02, 0);
    pennant.rotation.y = Math.PI / 2;
    pennant.castShadow = true;
    group.add(pennant);
  }
  group.add(
    at(mesh(cylinder(0.08, 0.08, 0.08, 10), paint('#f2b21b', { metalness: 0.6 })), 0, 2.84, 0),
  );
  const map = flagTexture(colour, token);
  const cloth = new Mesh(
    new PlaneGeometry(1.2, 0.8, 6, 1),
    new MeshStandardMaterial({
      map,
      side: DoubleSide,
      roughness: 0.8,
      emissive: new Color(colour),
      emissiveIntensity: dark ? 0.35 : 0,
    }),
  );
  // A little wave along the cloth.
  const position = cloth.geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    position.setZ(i, Math.sin((x + 0.6) * 4.2) * 0.07);
  }
  cloth.geometry.computeVertexNormals();
  cloth.position.set(0.64, 2.36, 0);
  cloth.rotation.y = Math.PI / 2;
  cloth.castShadow = true;
  group.add(cloth);
  return group;
}

/** A small board on a stake: this lot has no owner yet. */
export function saleBoard(dark: boolean): Object3D {
  const group = new Group();
  group.add(at(mesh(cylinder(0.04, 0.04, 1.0, 6), paint('#8a6a45')), 0, 0.5, 0));
  group.add(
    at(mesh(roundedBox(0.9, 0.5, 0.05, 0.03), paint(dark ? '#d9d4e8' : '#ffffff')), 0, 1.0, 0),
  );
  group.add(at(mesh(box(0.9, 0.12, 0.06), paint('#e94f37')), 0, 1.19, 0));
  return group;
}
