import {
  CanvasTexture,
  Color,
  Euler,
  Group,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { at, box, mesh, paint, roundedBox } from '../world/kit3d';

/**
 * The dice and the glass tray they land in, in the middle of the park. A die's faces follow
 * the usual layout, opposite faces adding to seven; `restingOn` turns a die so a value faces up.
 */

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [
    [0.27, 0.27],
    [0.73, 0.73],
  ],
  3: [
    [0.25, 0.25],
    [0.5, 0.5],
    [0.75, 0.75],
  ],
  4: [
    [0.27, 0.27],
    [0.73, 0.27],
    [0.27, 0.73],
    [0.73, 0.73],
  ],
  5: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.5, 0.5],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  6: [
    [0.27, 0.22],
    [0.73, 0.22],
    [0.27, 0.5],
    [0.73, 0.5],
    [0.27, 0.78],
    [0.73, 0.78],
  ],
};

/** Box faces in three.js order (+x, -x, +y, -y, +z, -z) and the value printed on each. */
const FACE_VALUES = [3, 4, 1, 6, 2, 5] as const;

const faces = new Map<string, MeshStandardMaterial[]>();

function faceMaterials(body: string, pip: string): MeshStandardMaterial[] {
  const key = `${body}:${pip}`;
  let list = faces.get(key);
  if (!list) {
    list = FACE_VALUES.map((value) => {
      const element = document.createElement('canvas');
      element.width = element.height = 128;
      const ctx = element.getContext('2d')!;
      ctx.fillStyle = body;
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = value === 1 ? '#d8312b' : pip;
      for (const [x, y] of PIPS[value]!) {
        ctx.beginPath();
        ctx.arc(x * 128, y * 128, value === 1 ? 17 : 12, 0, Math.PI * 2);
        ctx.fill();
      }
      const map = new CanvasTexture(element);
      map.colorSpace = SRGBColorSpace;
      return new MeshStandardMaterial({ map, roughness: 0.3, metalness: 0 });
    });
    faces.set(key, list);
  }
  return list;
}

let dieGeometry: RoundedBoxGeometry | null = null;

export function die(body = '#fbf8f1', pip = '#1d2230'): Mesh {
  dieGeometry ??= new RoundedBoxGeometry(0.9, 0.9, 0.9, 3, 0.14);
  const result = new Mesh(dieGeometry, faceMaterials(body, pip));
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

/**
 * The turn that brings `value` to the top, then a spin about the vertical. Order YXZ applies the
 * tip first and the spin last, so the spin never tips the die off its face.
 */
export function restingOn(value: number, spin = 0): Euler {
  switch (value) {
    case 1:
      return new Euler(0, spin, 0, 'YXZ');
    case 6:
      return new Euler(Math.PI, spin, 0, 'YXZ');
    case 3:
      return new Euler(0, spin, Math.PI / 2, 'YXZ');
    case 4:
      return new Euler(0, spin, -Math.PI / 2, 'YXZ');
    case 2:
      return new Euler(-Math.PI / 2, spin, 0, 'YXZ');
    default:
      return new Euler(Math.PI / 2, spin, 0, 'YXZ');
  }
}

/** The glass-walled tray on its plinth, with the last throw resting in it. */
export function diceTray(dark: boolean, values: readonly [number, number] = [3, 4]): Group {
  const group = new Group();
  group.name = 'dice-tray';
  group.add(
    at(
      mesh(
        roundedBox(6.4, 0.55, 4.6, 0.2),
        paint(dark ? '#4a4d58' : '#d8d0c0', { roughness: 0.7 }),
      ),
      0,
      0.42,
      0,
    ),
  );
  const wood = paint(dark ? '#4a3626' : '#8a5a34', { roughness: 0.6 });
  group.add(at(mesh(roundedBox(6.0, 0.24, 4.2, 0.08), wood), 0, 0.8, 0));
  group.add(
    at(
      mesh(box(5.6, 0.04, 3.8), paint(dark ? '#16352c' : '#1f6a52', { roughness: 1 })),
      0,
      0.93,
      0,
    ),
  );
  const glass = new MeshStandardMaterial({
    color: '#d8f2ff',
    transparent: true,
    opacity: 0.2,
    roughness: 0.04,
    metalness: 0.1,
    envMapIntensity: 2,
  });
  for (const [x, z, w, d] of [
    [0, 2.0, 5.9, 0.08],
    [0, -2.0, 5.9, 0.08],
    [2.95, 0, 0.08, 4.0],
    [-2.95, 0, 0.08, 4.0],
  ] as const) {
    const wall = new Mesh(box(w, 1.0, d), glass);
    wall.position.set(x, 1.42, z);
    group.add(wall);
    group.add(
      at(
        mesh(
          box(w + 0.02, 0.06, d + 0.02),
          paint('#f2b21b', {
            metalness: 0.7,
            roughness: 0.3,
            emissive: new Color('#ffcf3f'),
            emissiveIntensity: dark ? 0.6 : 0,
          }),
        ),
        x,
        1.93,
        z,
      ),
    );
  }
  values.forEach((value, i) => {
    const d = die();
    d.rotation.copy(restingOn(value, 0.4 + i * 0.9));
    d.position.set(-0.8 + i * 1.5, 1.4, -0.2 + i * 0.5);
    d.name = `die-${i}`;
    group.add(d);
  });
  return group;
}
