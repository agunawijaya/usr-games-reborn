import {
  BoxGeometry,
  ExtrudeGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import { createRng } from '@usr-games/kit';
import { at, box, cylinder, mesh, paint, roundedBox, sphere } from '../world/kit3d';
import { stripeTexture, windowTexture, type WindowStyle } from './facades';

/**
 * Harbour City's buildings, one look per district so a street reads as part of its group at a
 * glance: brick warehouses at the Old Docks, blue-shuttered stucco round the Fish Market,
 * ochre gabled houses on the canal, murals in the Arts District, white and navy on Lighthouse
 * Hill, glass and balconies at the Marina, gold-crowned towers by Skyline Park and dark glass
 * with roof gardens up on Harbour Heights. Each lot grows: a corner shop (1), a house with a
 * flat above (2), a block (3), a tall block (4), and the district's landmark (5).
 */

interface DistrictStyle {
  windows: WindowStyle;
  roof: 'flat' | 'pitched' | 'garden';
  balconies: boolean;
  /** The colour painted on blank side walls in the Arts District. */
  mural?: readonly string[];
  awning: string;
}

const STYLES: readonly DistrictStyle[] = [
  {
    windows: { wall: '#a9533a', trim: '#e9dcc6', glass: '#3b4c5c', shape: 'arched', brick: true },
    roof: 'pitched',
    balconies: false,
    awning: '#6b5ca5',
  },
  {
    windows: { wall: '#f1eee6', trim: '#2f6fa8', glass: '#4a6f8c', shape: 'shuttered' },
    roof: 'flat',
    balconies: false,
    awning: '#14a39b',
  },
  {
    windows: { wall: '#e6b85c', trim: '#fbf4e2', glass: '#46617a', shape: 'punched' },
    roof: 'pitched',
    balconies: false,
    awning: '#7fb534',
  },
  {
    windows: { wall: '#f08a8a', trim: '#fff3ea', glass: '#3e5168', shape: 'punched' },
    roof: 'flat',
    balconies: true,
    mural: ['#ffcf3f', '#2fb3a8', '#5a3fa0', '#ff6b4a'],
    awning: '#d6457f',
  },
  {
    windows: { wall: '#f7f7f2', trim: '#1f3a6b', glass: '#4b6a8a', shape: 'shuttered' },
    roof: 'flat',
    balconies: false,
    awning: '#ef8a22',
  },
  {
    windows: { wall: '#bcd8e8', trim: '#ffffff', glass: '#5f9cc4', shape: 'curtain' },
    roof: 'flat',
    balconies: true,
    awning: '#3a8fe0',
  },
  {
    windows: { wall: '#cfd9e0', trim: '#c9a227', glass: '#6ca7cf', shape: 'curtain' },
    roof: 'flat',
    balconies: false,
    awning: '#e3b11f',
  },
  {
    windows: { wall: '#3c4a5e', trim: '#9fb4c8', glass: '#5d86ad', shape: 'curtain' },
    roof: 'garden',
    balconies: true,
    awning: '#283c8c',
  },
];

const STOREY = 1.15;

export const STOREYS_BY_LEVEL = [0, 2, 3, 5, 8] as const;

export interface BuildOptions {
  group: number;
  level: number;
  width: number;
  depth: number;
  dark: boolean;
  seed: string;
  accent: string;
  /** The next storey is going up: leave the roof off. */
  roofless?: boolean;
}

const textures = new Map<string, { map: CanvasTexture; glow: CanvasTexture }>();

function facadeFor(group: number, dark: boolean) {
  const key = `${group}:${dark}`;
  let pair = textures.get(key);
  if (!pair) {
    pair = windowTexture(STYLES[group]!.windows, dark, `harbour-${group}`);
    textures.set(key, pair);
  }
  return pair;
}

function wallMaterial(group: number, dark: boolean): MeshStandardMaterial {
  const { map, glow } = facadeFor(group, dark);
  return new MeshStandardMaterial({
    map,
    emissiveMap: glow,
    emissive: new Color('#ffffff'),
    emissiveIntensity: dark ? 1.05 : 0,
    roughness: STYLES[group]!.windows.shape === 'curtain' ? 0.25 : 0.6,
    metalness: STYLES[group]!.windows.shape === 'curtain' ? 0.35 : 0.02,
  });
}

const wallMaterials = new Map<string, MeshStandardMaterial>();
function walls(group: number, dark: boolean): MeshStandardMaterial {
  const key = `${group}:${dark}`;
  let material = wallMaterials.get(key);
  if (!material) {
    material = wallMaterial(group, dark);
    wallMaterials.set(key, material);
  }
  return material;
}

/** A block of storeys whose facade repeats one window per 0.9 across and one row per storey. */
function block(width: number, depth: number, storeys: number, group: number, dark: boolean): Mesh {
  const geometry = new BoxGeometry(width, storeys * STOREY, depth);
  const uv = geometry.attributes.uv!;
  for (let face = 0; face < 6; face++) {
    const across = face < 2 ? depth : width;
    for (let k = 0; k < 4; k++) {
      const i = face * 4 + k;
      uv.setXY(i, (uv.getX(i) * across) / 3.6, (uv.getY(i) * storeys) / 4);
    }
  }
  const style = STYLES[group]!;
  const roof = paint(dark ? '#2a2d36' : style.roof === 'garden' ? '#6a8a5a' : '#cfc7b8', {
    roughness: 0.9,
  });
  const wall = walls(group, dark);
  const result = new Mesh(geometry, [wall, wall, roof, roof, wall, wall]);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

/** The ground floor: shop windows, a door and a striped awning in the district's colour. */
function shopfront(width: number, depth: number, style: DistrictStyle, dark: boolean): Group {
  const group = new Group();
  const glass = paint(dark ? '#ffe2a8' : '#2c3e50', {
    roughness: 0.15,
    metalness: 0.3,
    emissive: new Color('#ffd27a'),
    emissiveIntensity: dark ? 1.1 : 0,
  });
  group.add(at(mesh(box(width * 0.86, 0.72, 0.06), glass), 0, 0.62, -depth / 2 - 0.01));
  group.add(
    at(
      mesh(box(width * 0.2, 0.86, 0.07), paint(style.windows.trim)),
      -width * 0.28,
      0.55,
      -depth / 2 - 0.02,
    ),
  );
  const awning = new Mesh(
    new PlaneGeometry(width * 0.95, 0.8),
    new MeshStandardMaterial({
      map: stripeTexture(style.awning),
      side: DoubleSide,
      roughness: 0.8,
    }),
  );
  awning.rotation.x = Math.PI / 2 - 0.55;
  awning.position.set(0, 1.18, -depth / 2 - 0.32);
  awning.castShadow = true;
  group.add(awning);
  return group;
}

/** A gable roof: a triangle across the depth, run along the width; its base sits at y = 0. */
function pitchedRoof(width: number, depth: number, colour: string): Mesh {
  const gable = new Shape();
  gable.moveTo(-depth / 2, 0);
  gable.lineTo(depth / 2, 0);
  gable.lineTo(0, depth * 0.42);
  gable.closePath();
  const geometry = new ExtrudeGeometry(gable, { depth: width, bevelEnabled: false });
  geometry.translate(0, 0, -width / 2);
  geometry.rotateY(Math.PI / 2);
  return mesh(geometry, paint(colour, { roughness: 0.8 }));
}

/** Things on a flat roof: plant boxes, a water tank on legs, an aerial, a small garden. */
function rooftop(
  width: number,
  depth: number,
  style: DistrictStyle,
  dark: boolean,
  seed: string,
): Group {
  const group = new Group();
  const rng = createRng(seed);
  const grey = paint(dark ? '#4a4e58' : '#d9dde1', { roughness: 0.6, metalness: 0.3 });
  if (style.roof === 'garden') {
    group.add(
      at(
        mesh(box(width * 0.8, 0.12, depth * 0.7), paint('#5c8a4a', { roughness: 0.95 })),
        0,
        0.06,
        0,
      ),
    );
    for (let i = 0; i < 5; i++) {
      group.add(
        at(
          mesh(
            sphere(0.25 + rng.next() * 0.15, 8),
            paint(rng.pick(['#4f9a4a', '#6cb04f', '#3f8a5a']), { flatShading: true }),
          ),
          (rng.next() - 0.5) * width * 0.7,
          0.3,
          (rng.next() - 0.5) * depth * 0.6,
        ),
      );
    }
    return group;
  }
  const units = 1 + Math.floor(rng.next() * 3);
  for (let i = 0; i < units; i++) {
    group.add(
      at(
        mesh(roundedBox(0.6, 0.38, 0.5, 0.06), grey),
        (rng.next() - 0.5) * width * 0.6,
        0.2,
        (rng.next() - 0.5) * depth * 0.5,
      ),
    );
  }
  if (rng.chance(0.55)) {
    const tank = new Group();
    tank.add(
      at(
        mesh(
          cylinder(0.32, 0.32, 0.6, 12),
          paint(dark ? '#5a4a3a' : '#a0764e', { roughness: 0.9 }),
        ),
        0,
        0.85,
        0,
      ),
    );
    tank.add(at(mesh(cylinder(0.05, 0.36, 0.25, 12), paint('#5a4a3a')), 0, 1.27, 0));
    for (const [x, z] of [
      [-0.2, -0.2],
      [0.2, -0.2],
      [-0.2, 0.2],
      [0.2, 0.2],
    ] as const)
      tank.add(at(mesh(box(0.05, 0.6, 0.05), grey), x, 0.3, z));
    group.add(at(tank, width * 0.25, 0, depth * 0.15));
  }
  if (rng.chance(0.4))
    group.add(at(mesh(cylinder(0.02, 0.03, 1.4, 6), grey), -width * 0.3, 0.7, -depth * 0.2));
  return group;
}

/** Balcony slabs with glass rails on the road side, every storey above the shops. */
function balconies(width: number, depth: number, storeys: number, dark: boolean): Group {
  const group = new Group();
  const slab = paint(dark ? '#8a93a3' : '#f4f4f0');
  const rail = new MeshStandardMaterial({
    color: '#cfe8f5',
    transparent: true,
    opacity: 0.35,
    roughness: 0.1,
  });
  for (let s = 2; s < storeys; s++) {
    const y = s * STOREY + 0.12;
    group.add(at(mesh(box(width * 0.8, 0.07, 0.42), slab), 0, y, -depth / 2 - 0.2));
    group.add(at(new Mesh(box(width * 0.8, 0.32, 0.03), rail), 0, y + 0.2, -depth / 2 - 0.4));
  }
  return group;
}

/** A band round the top of the walls in the district's trim colour, open over the roof. */
function cornice(width: number, depth: number, y: number, colour: string): Group {
  const group = new Group();
  const trim = paint(colour, { roughness: 0.6 });
  for (const z of [-1, 1])
    group.add(at(mesh(box(width + 0.14, 0.2, 0.14), trim), 0, y, (z * (depth + 0.0)) / 2));
  for (const x of [-1, 1])
    group.add(at(mesh(box(0.14, 0.2, depth + 0.14), trim), (x * (width + 0.0)) / 2, y, 0));
  return group;
}

/** A painted mural over one side wall: big shapes in the district's colours. */
function mural(height: number, depth: number, colours: readonly string[], x: number): Mesh {
  const element = document.createElement('canvas');
  element.width = 256;
  element.height = 512;
  const ctx = element.getContext('2d')!;
  ctx.fillStyle = colours[1]!;
  ctx.fillRect(0, 0, 256, 512);
  ctx.fillStyle = colours[0]!;
  ctx.beginPath();
  ctx.arc(180, 120, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colours[2]!;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 300 + i * 50);
    for (let x = 0; x <= 256; x += 16) ctx.lineTo(x, 300 + i * 50 + Math.sin(x / 26 + i) * 18);
    ctx.lineTo(256, 512);
    ctx.lineTo(0, 512);
    ctx.globalAlpha = 0.55;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = colours[3]!;
  ctx.fillRect(30, 60, 24, 220);
  const map = new CanvasTexture(element);
  map.colorSpace = SRGBColorSpace;
  const plane = new Mesh(
    new PlaneGeometry(depth * 0.9, height * 0.85),
    new MeshStandardMaterial({ map, roughness: 0.8 }),
  );
  plane.rotation.y = Math.PI / 2;
  plane.position.set(x + 0.02, height * 0.5 + 0.2, 0);
  plane.receiveShadow = true;
  return plane;
}

/** A finished building of the given level (1–4) on a lot `width` wide and `depth` deep. */
export function harbourBuilding(options: BuildOptions): Group {
  const { group: district, level, width, depth, dark, seed } = options;
  const style = STYLES[district]!;
  const storeys = STOREYS_BY_LEVEL[Math.min(level, 4)]!;
  const result = new Group();
  const rng = createRng(seed);
  const narrow = level <= 2 ? width * (0.82 + rng.next() * 0.1) : width;
  const d = level <= 2 ? depth * 0.72 : depth;
  const body = block(narrow, d, storeys, district, dark);
  body.position.set(0, (storeys * STOREY) / 2 + 0.12, 0);
  result.add(body);
  result.add(shopfront(narrow, d, style, dark));
  const top = storeys * STOREY + 0.12;
  result.add(cornice(narrow, d, top, style.windows.trim));
  if (options.roofless) {
    // The roof comes off while the next storeys go up.
  } else if (style.roof === 'pitched' && level <= 3) {
    const roof = pitchedRoof(narrow + 0.1, d + 0.1, dark ? '#3a2e2a' : '#8a3b2c');
    roof.position.set(0, top + 0.08, 0);
    result.add(roof);
  } else {
    result.add(at(rooftop(narrow, d, style, dark, `${seed}-roof`), 0, top + 0.08, 0));
  }
  if (style.balconies && storeys >= 3) result.add(balconies(narrow, d, storeys, dark));
  if (style.mural && storeys >= 3)
    result.add(mural(storeys * STOREY, d, style.mural, narrow / 2 + 0.02));
  if (level >= 3) result.add(neonSign(options.accent, dark, narrow, d, storeys));
  if (level === 2) {
    // A low annex at the side: the lot fills out as it grows.
    const annex = block(width * 0.3, depth * 0.4, 1, district, dark);
    annex.position.set(narrow / 2 - width * 0.12, STOREY / 2 + 0.12, depth * 0.3);
    result.add(annex);
  }
  return result;
}

/** Height of a level's building, for the crane and the scaffold. */
export function levelHeight(level: number): number {
  return level >= 5 ? 16 * STOREY : STOREYS_BY_LEVEL[Math.max(0, level)]! * STOREY;
}

/**
 * The district's landmark: what a lot becomes at the top level, its own silhouette per
 * district and lit in the district's colour at night.
 */
export function harbourLandmark(options: BuildOptions): Group {
  const { group: district, width, depth, dark, seed, accent } = options;
  const style = STYLES[district]!;
  const result = new Group();
  const lit = (intensity: number) =>
    paint(accent, {
      emissive: new Color(accent),
      emissiveIntensity: dark ? intensity : 0.06,
      roughness: 0.35,
    });
  const trim = paint(style.windows.trim, { roughness: 0.5 });
  const place = (m: Mesh | Group, x: number, y: number, z: number) => {
    m.position.set(x, y, z);
    result.add(m);
    return m;
  };
  const shaft = (w: number, d: number, storeys: number, y: number, x = 0) => {
    const b = block(w, d, storeys, district, dark);
    return place(b, x, y + (storeys * STOREY) / 2, 0);
  };
  // Every landmark stands on a two-storey podium with shops.
  shaft(width, depth, 2, 0.12);
  result.add(shopfront(width, depth, style, dark));
  const base = 2 * STOREY + 0.12;
  switch (district) {
    case 0: {
      shaft(width * 0.62, depth * 0.55, 10, base);
      const top = base + 10 * STOREY;
      place(mesh(box(width * 0.7, 0.2, depth * 0.62), trim), 0, top + 0.1, 0);
      for (const z of [-1, 1]) {
        const face = mesh(
          cylinder(0.62, 0.62, 0.08, 28),
          paint('#fbf6ea', { emissive: new Color('#ffe9b0'), emissiveIntensity: dark ? 1.4 : 0 }),
        );
        face.rotation.x = Math.PI / 2;
        place(face, 0, top - 1.2, z * (depth * 0.28 + 0.04));
      }
      const spire = mesh(
        cylinder(0.01, width * 0.48, 2.4, 4),
        paint(dark ? '#2f3a3a' : '#4a6a5a', { roughness: 0.7 }),
      );
      spire.rotation.y = Math.PI / 4;
      place(spire, 0, top + 1.4, 0);
      break;
    }
    case 1: {
      const hall = mesh(
        new CylinderGeometry(depth * 0.36, depth * 0.36, width * 0.95, 20, 1, false, 0, Math.PI),
        new MeshStandardMaterial({
          color: '#cfe8f5',
          transparent: true,
          opacity: 0.55,
          roughness: 0.1,
          metalness: 0.3,
          emissive: new Color('#ffd27a'),
          emissiveIntensity: dark ? 0.8 : 0,
        }),
      );
      hall.rotation.z = Math.PI / 2;
      place(hall, 0, base, 0);
      shaft(width * 0.32, width * 0.32, 9, base, width * 0.3);
      place(
        mesh(cylinder(0.01, width * 0.24, 1.6, 4), paint('#2f6fa8')),
        width * 0.3,
        base + 9 * STOREY + 0.8,
        0,
      );
      place(
        mesh(roundedBox(0.7, 0.3, 0.08, 0.06), lit(2)),
        width * 0.3,
        base + 9 * STOREY + 2.0,
        0,
      );
      break;
    }
    case 2: {
      let y = base;
      [
        [0.95, 6],
        [0.75, 5],
        [0.55, 4],
      ].forEach(([scale, storeys]) => {
        shaft(width * scale!, depth * scale!, storeys!, y);
        y += storeys! * STOREY;
        place(mesh(box(width * scale! + 0.12, 0.16, depth * scale! + 0.12), trim), 0, y, 0);
      });
      const roof = pitchedRoof(width * 0.56, depth * 0.56, dark ? '#3a2e2a' : '#8a3b2c');
      place(roof, 0, y + 0.08, 0);
      break;
    }
    case 3: {
      let y = base;
      const colours = style.mural ?? [accent];
      for (let i = 0; i < 7; i++) {
        const piece = mesh(
          roundedBox(width * 0.8, 1.6, depth * 0.45, 0.12),
          paint(colours[i % colours.length]!, {
            roughness: 0.55,
            emissive: new Color(colours[i % colours.length]!),
            emissiveIntensity: dark ? 0.35 : 0,
          }),
        );
        piece.rotation.y = (i % 2 ? 1 : -1) * 0.35 + i * 0.12;
        place(piece, i % 2 ? 0.3 : -0.3, y + 0.8, 0);
        y += 1.6;
      }
      break;
    }
    case 4: {
      // A red and white lighthouse with a gallery and a glowing lamp room.
      const bands = 5;
      for (let i = 0; i < bands; i++) {
        const bottom = 1.05 - i * 0.07;
        place(
          mesh(
            cylinder(bottom - 0.07, bottom, 2.0, 28),
            paint(i % 2 ? '#d8312b' : '#f7f7f2', { roughness: 0.45 }),
          ),
          0,
          base + 1.0 + i * 2.0,
          0,
        );
      }
      const gallery = base + bands * 2.0;
      place(
        mesh(cylinder(1.0, 0.85, 0.22, 28), paint('#2b2f3a', { roughness: 0.5 })),
        0,
        gallery + 0.1,
        0,
      );
      const rail = mesh(new TorusGeometry(0.95, 0.03, 6, 32), paint('#2b2f3a', { metalness: 0.5 }));
      rail.rotation.x = Math.PI / 2;
      place(rail, 0, gallery + 0.55, 0);
      place(
        mesh(
          cylinder(0.58, 0.58, 1.0, 16),
          paint('#fff4c4', {
            emissive: new Color('#ffe08a'),
            emissiveIntensity: dark ? 3.5 : 0.35,
            roughness: 0.1,
          }),
        ),
        0,
        gallery + 0.75,
        0,
      );
      place(
        mesh(
          new SphereGeometry(0.66, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
          paint('#d8312b', { roughness: 0.45 }),
        ),
        0,
        gallery + 1.25,
        0,
      );
      place(mesh(sphere(0.12, 10), paint('#f2b21b', { metalness: 0.7 })), 0, gallery + 1.98, 0);
      break;
    }
    case 5: {
      // A slim glass tower with a white sail standing in front of it.
      shaft(width * 0.46, depth * 0.42, 12, base, width * 0.08);
      const height = 13 * STOREY;
      const outline = new Shape();
      outline.moveTo(0, 0);
      outline.quadraticCurveTo(width * 0.95, height * 0.45, 0, height);
      outline.lineTo(0, 0);
      const fin = mesh(
        new ExtrudeGeometry(outline, { depth: 0.14, bevelEnabled: false, curveSegments: 24 }),
        paint(dark ? '#d9e4ff' : '#fbfbf7', {
          roughness: 0.35,
          emissive: new Color('#9fd0ff'),
          emissiveIntensity: dark ? 0.35 : 0,
          side: DoubleSide,
        }),
      );
      fin.rotation.y = Math.PI / 2;
      place(fin, -width * 0.18, base, depth * 0.2);
      place(
        mesh(box(0.06, height, 0.06), lit(2)),
        -width * 0.18,
        base + height / 2,
        depth * 0.2 - 0.05,
      );
      break;
    }
    case 6: {
      shaft(width * 0.7, depth * 0.6, 12, base);
      shaft(width * 0.5, depth * 0.42, 3, base + 12 * STOREY);
      const crown = base + 15 * STOREY;
      place(
        mesh(
          cylinder(width * 0.18, width * 0.34, 1.2, 4),
          paint('#c9a227', {
            metalness: 0.8,
            roughness: 0.25,
            emissive: new Color('#ffcf3f'),
            emissiveIntensity: dark ? 1.4 : 0,
          }),
        ),
        0,
        crown + 0.6,
        0,
      ).rotation.y = Math.PI / 4;
      place(
        mesh(cylinder(0.04, 0.07, 2.8, 6), paint('#e8eaee', { metalness: 0.7 })),
        0,
        crown + 2.6,
        0,
      );
      place(
        mesh(
          sphere(0.12, 10),
          paint('#ff3030', { emissive: new Color('#ff3030'), emissiveIntensity: dark ? 3 : 0.5 }),
        ),
        0,
        crown + 4.05,
        0,
      );
      break;
    }
    default: {
      shaft(width * 0.4, depth * 0.55, 13, base, -width * 0.27);
      shaft(width * 0.4, depth * 0.55, 11, base, width * 0.27);
      place(mesh(box(width * 0.24, 0.9, depth * 0.35), lit(1.6)), 0, base + 9 * STOREY, 0);
      place(
        rooftop(width * 0.4, depth * 0.55, style, dark, `${seed}-a`),
        -width * 0.27,
        base + 13 * STOREY + 0.1,
        0,
      );
      place(
        rooftop(width * 0.4, depth * 0.55, style, dark, `${seed}-b`),
        width * 0.27,
        base + 11 * STOREY + 0.1,
        0,
      );
    }
  }
  return result;
}

/** A vertical sign in the district's colour on the corner: lit neon at night. */
function neonSign(
  accent: string,
  dark: boolean,
  width: number,
  depth: number,
  storeys: number,
): Mesh {
  const sign = mesh(
    roundedBox(0.16, Math.min(3.2, storeys * STOREY * 0.5), 0.5, 0.06),
    paint(accent, {
      emissive: new Color(accent),
      emissiveIntensity: dark ? 2.6 : 0.08,
      roughness: 0.3,
    }),
  );
  sign.position.set(width / 2 + 0.1, storeys * STOREY * 0.62, -depth / 2 + 0.4);
  return sign;
}

export { STYLES as HARBOUR_STYLES, STOREY };
