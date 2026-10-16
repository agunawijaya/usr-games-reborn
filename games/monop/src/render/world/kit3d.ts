import type { BufferGeometry, Object3D } from 'three';
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  type Material,
  Mesh,
  MeshStandardMaterial,
  type MeshStandardMaterialParameters,
  SphereGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Small helpers for building a toy town out of primitives: bevelled boxes (every edge of a model
 * catches a little light), shared materials, and meshes that cast and take shadows.
 */

const geometries = new Map<string, BufferGeometry>();

/** A box with rounded edges; shared between every mesh of the same size. */
export function roundedBox(
  width: number,
  height: number,
  depth: number,
  radius = 0.12,
): BufferGeometry {
  const key = `rb:${width.toFixed(3)}:${height.toFixed(3)}:${depth.toFixed(3)}:${radius}`;
  let geometry = geometries.get(key);
  if (!geometry) {
    const r = Math.min(radius, width / 2.01, height / 2.01, depth / 2.01);
    geometry = new RoundedBoxGeometry(width, height, depth, 2, r);
    geometry.userData.shared = true;
    geometries.set(key, geometry);
  }
  return geometry;
}

export function box(width: number, height: number, depth: number): BufferGeometry {
  const key = `b:${width.toFixed(3)}:${height.toFixed(3)}:${depth.toFixed(3)}`;
  let geometry = geometries.get(key);
  if (!geometry) {
    geometry = new BoxGeometry(width, height, depth);
    geometry.userData.shared = true;
    geometries.set(key, geometry);
  }
  return geometry;
}

export function cylinder(
  top: number,
  bottom: number,
  height: number,
  segments = 16,
): BufferGeometry {
  const key = `c:${top}:${bottom}:${height}:${segments}`;
  let geometry = geometries.get(key);
  if (!geometry) {
    geometry = new CylinderGeometry(top, bottom, height, segments);
    geometry.userData.shared = true;
    geometries.set(key, geometry);
  }
  return geometry;
}

export function sphere(radius: number, segments = 16): BufferGeometry {
  const key = `s:${radius}:${segments}`;
  let geometry = geometries.get(key);
  if (!geometry) {
    geometry = new SphereGeometry(radius, segments, Math.max(8, Math.round(segments * 0.75)));
    geometry.userData.shared = true;
    geometries.set(key, geometry);
  }
  return geometry;
}

const materials = new Map<string, MeshStandardMaterial>();

/** A plain painted material: toy plastic or matte paint, cached by its settings. */
export function paint(
  colour: string,
  options: MeshStandardMaterialParameters = {},
): MeshStandardMaterial {
  const key = `${colour}:${JSON.stringify(options)}`;
  let material = materials.get(key);
  if (!material) {
    material = new MeshStandardMaterial({
      color: new Color(colour),
      roughness: 0.72,
      metalness: 0,
      ...options,
    });
    material.userData.shared = true;
    materials.set(key, material);
  }
  return material;
}

/** Polished gold, for the career's touches: pennants, gilding, a golden base. */
export function gold(): MeshStandardMaterial {
  return paint('#d9a93a', { metalness: 0.85, roughness: 0.28 });
}

export function mesh(
  geometry: BufferGeometry,
  material: Material,
  { cast = true, receive = true } = {},
): Mesh {
  const result = new Mesh(geometry, material);
  result.castShadow = cast;
  result.receiveShadow = receive;
  return result;
}

/** Places an object and returns it, so a scene reads as a list of things where they stand. */
export function at<T extends Object3D>(object: T, x: number, y: number, z: number, yaw = 0): T {
  object.position.set(x, y, z);
  object.rotation.y = yaw;
  return object;
}

/**
 * Frees the GPU memory an object no longer on screen holds: its own geometries and materials,
 * never the shared ones from the caches above (they are marked), and never textures, which are
 * painted once and kept.
 */
export function release(object: Object3D): void {
  object.traverse((child) => {
    const drawn = child as Mesh;
    if (drawn.geometry && !drawn.geometry.userData.shared) drawn.geometry.dispose();
    const materials = Array.isArray(drawn.material)
      ? drawn.material
      : drawn.material
        ? [drawn.material]
        : [];
    for (const material of materials) if (!material.userData.shared) material.dispose();
  });
}
