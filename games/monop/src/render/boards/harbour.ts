import {
  BackSide,
  BufferAttribute,
  Color,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  PMREMGenerator,
  RingGeometry,
  Scene,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type WebGLRenderer,
} from 'three';
import { createRng } from '@usr-games/kit';
import { LAYOUT } from '../../boards/layout';
import { BOARDS } from '../../boards/themes';
import { at, box, cylinder, mesh, paint, roundedBox, sphere } from '../world/kit3d';
import { BOARD_HALF, LOT_DEPTH, LOTS, ROAD_CENTRE, ROAD_WIDTH, SQUARE_LAYOUT } from '../world/lots';
import { lamps, people, traffic, trees } from '../world/scenery';
import { normalTexture, signTexture } from '../world/textures';
import { harbourBuilding, harbourLandmark, levelHeight } from './harbour-buildings';
import { ferry, sailboat } from './harbour-boats';
import { harbourPark } from './harbour-park';
import { fireworks } from '../world/fireworks';
import { harbourWeather } from '../world/weather';
import { tokenModel } from '../world/tokens';
import type { ArtContext, BoardArt, LotArt } from '../world/world';
import { constructionKit, ownerFlag, saleBoard } from './common';

/**
 * Harbour City: a coastal town on an island in a calm sea. By day (the light look) a bright
 * morning sun on glass and white sails; by night (the dark look) neon in the district colours,
 * lit windows and wet streets. Lots grow from a corner shop to a district landmark; ferries wait
 * at the four piers; the dice land in a glass tray in the park.
 */

const ISLAND = BOARD_HALF + 5;
const WATER_LEVEL = -0.75;

interface Palette {
  sky: [string, string, string];
  fog: string;
  ground: string;
  pavement: string;
  road: string;
  roadRoughness: number;
  marking: string;
  grass: string;
  water: string;
  seawall: string;
  sign: { paper: string; ink: string };
}

const DAY: Palette = {
  sky: ['#3f8fd6', '#9fd0ee', '#e9f4f7'],
  fog: '#d9ecf2',
  ground: '#e9e3d6',
  pavement: '#d9d4ca',
  road: '#4d535d',
  roadRoughness: 0.82,
  marking: '#f6f1e4',
  grass: '#8cbf63',
  water: '#23789c',
  seawall: '#b9b1a1',
  sign: { paper: '#fbf8f1', ink: '#1d2230' },
};

const NIGHT: Palette = {
  sky: ['#04060f', '#0d1430', '#2a1f4a'],
  fog: '#1a1736',
  ground: '#3a3e4c',
  pavement: '#444855',
  road: '#1a1c23',
  roadRoughness: 0.18,
  marking: '#9aa3b5',
  grass: '#26452f',
  water: '#0a1f33',
  seawall: '#4a4c57',
  sign: { paper: '#1c1f2b', ink: '#f3f0ff' },
};

export function createHarbourArt(): BoardArt {
  let water: MeshStandardMaterial | null = null;
  let movers: ((seconds: number, elapsed: number) => void)[] = [];
  const art: BoardArt = {
    theme: BOARDS.harbour,
    layout: SQUARE_LAYOUT,
    // Behind the dice tray as the table's camera sees it, so it never hides the dice.
    statueSpot: new Vector3(0, 0.12, -5.2),
    weather: (dark) => harbourWeather(dark),

    look(dark) {
      return dark
        ? {
            tiltShift: { focus: 0.5, band: 0.11, ramp: 0.3, maxBlur: 9 },
            grade: { saturation: 1.18, contrast: 1.08, vignette: 0.32, tint: [0.96, 0.98, 1.06] },
            bloom: 0.6,
            exposure: 1.45,
          }
        : {
            tiltShift: { focus: 0.48, band: 0.12, ramp: 0.3, maxBlur: 8 },
            grade: { saturation: 1.2, contrast: 1.06, vignette: 0.18, tint: [1.02, 1.0, 0.97] },
            bloom: 0,
            exposure: 1.0,
          };
    },

    setup(context) {
      movers = [];
      const { scenery, stage, dark } = context;
      const palette = dark ? NIGHT : DAY;
      const scene = stage.scene;
      scene.background = new Color(palette.fog);
      scene.fog = new Fog(palette.fog, 120, 330);
      scene.environment = environment(stage.renderer, palette, dark);
      scenery.add(sky(palette));
      lights(scenery, dark);
      water = sea(scenery, palette);
      island(scenery, palette);
      road(scenery, palette, dark);
      scenery.add(
        harbourPark({
          grass: palette.grass,
          path: dark ? '#4a4c56' : '#ece3cf',
          water: palette.water,
          dark,
        }),
      );
      promenade(scenery, palette, dark);
      boats(scenery, dark, movers);
      lighthouse(scenery, dark, movers);
      const cars = traffic(
        SQUARE_LAYOUT,
        22,
        {
          vehicle: 'car',
          bodies: ['#e94f37', '#f6f7f2', '#2e86de', '#f4c430', '#2f3a4a', '#4fb286'],
          cabin: dark ? '#0b0f18' : '#2a3a4c',
          wheel: '#1d1f24',
          dark,
        },
        'harbour-cars',
      );
      scenery.add(cars.group);
      movers.push((s) => cars.update(s));
      const crowd = people(
        SQUARE_LAYOUT,
        70,
        {
          clothes: ['#e94f37', '#2e86de', '#f4c430', '#ffffff', '#4fb286', '#8e6cc9', '#2f3a4a'],
          skin: ['#f1c7a3', '#d79f78', '#a8704f', '#6e4630'],
        },
        'harbour-people',
        [ROAD_WIDTH / 2 + 0.55, -ROAD_WIDTH / 2 - 0.5],
      );
      scenery.add(crowd.group);
      movers.push((s, e) => crowd.update(s, e));
    },

    lot(context, lot) {
      return harbourLot(context, lot);
    },

    token(_context, id, colour) {
      return tokenModel(id, colour);
    },

    signature(context, lot, seconds) {
      const top = lot.centre.clone().setY(16);
      const show = fireworks(
        top,
        ['#ff4a2e', '#ffc61a', '#1fb8ff', '#ff3d9a', '#4fe36b', '#a66bff'],
        context.dark,
        'harbour-fireworks',
      );
      show.at(seconds);
      return show.group;
    },

    animate(_context, seconds, elapsed) {
      if (water?.normalMap) {
        water.normalMap.offset.set(elapsed * 0.006, elapsed * 0.004);
      }
      for (const move of movers) move(seconds, elapsed);
    },
  };
  return art;
}

// —— sky, light and environment ——

function sky(palette: Palette): Mesh {
  const geometry = new SphereGeometry(420, 32, 16);
  const [top, middle, horizon] = palette.sky.map((c) => new Color(c));
  const colours: number[] = [];
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i) / 420;
    const c =
      y > 0.25
        ? middle!.clone().lerp(top!, Math.min(1, (y - 0.25) / 0.6))
        : horizon!.clone().lerp(middle!, Math.max(0, (y + 0.05) / 0.3));
    colours.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colours), 3));
  return new Mesh(
    geometry,
    new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false }),
  );
}

function environment(renderer: WebGLRenderer, palette: Palette, dark: boolean) {
  const scene = new Scene();
  scene.add(sky(palette));
  const panel = (
    colour: string,
    intensity: number,
    x: number,
    y: number,
    z: number,
    w = 60,
    h = 30,
  ) => {
    const m = new Mesh(
      new PlaneGeometry(w, h),
      new MeshBasicMaterial({
        color: new Color(colour).multiplyScalar(intensity),
        side: DoubleSide,
      }),
    );
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  if (dark) {
    panel('#ff3fa4', 1.6, -160, 30, 80);
    panel('#29d8ff', 1.6, 150, 26, -60);
    panel('#ffb347', 1.2, 40, 20, 170, 80, 20);
  } else {
    panel('#fff3d6', 6, -120, 140, 90, 70, 70);
    panel('#ffffff', 1.4, 160, 60, -40);
  }
  const pmrem = new PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.03);
  pmrem.dispose();
  return target.texture;
}

function lights(scenery: Group, dark: boolean): void {
  if (dark) {
    scenery.add(new HemisphereLight('#6a78d0', '#2a2834', 1.6));
    const moon = new DirectionalLight('#b4c2ff', 0.95);
    moon.position.set(45, 70, -30);
    shadowed(moon);
    scenery.add(moon, moon.target);
  } else {
    scenery.add(new HemisphereLight('#d7ecff', '#9c8c70', 1.05));
    const sun = new DirectionalLight('#fff0d4', 2.7);
    sun.position.set(-55, 62, 38);
    shadowed(sun);
    scenery.add(sun, sun.target);
  }
}

function shadowed(light: DirectionalLight): void {
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  const camera = light.shadow.camera;
  camera.left = camera.bottom = -44;
  camera.right = camera.top = 44;
  camera.near = 10;
  camera.far = 220;
  light.shadow.bias = -0.0004;
  light.shadow.normalBias = 0.02;
  light.shadow.radius = 3;
}

// —— the sea and the island ——

function sea(scenery: Group, palette: Palette): MeshStandardMaterial {
  const normalMap = normalTexture('harbour-sea', { strength: 0.9, waves: 18 });
  normalMap.repeat.set(36, 36);
  const material = new MeshStandardMaterial({
    color: palette.water,
    roughness: 0.12,
    metalness: 0.1,
    normalMap,
    envMapIntensity: 1.1,
  });
  material.normalScale.set(0.45, 0.45);
  const plane = new Mesh(new PlaneGeometry(900, 900), material);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = WATER_LEVEL;
  plane.receiveShadow = true;
  scenery.add(plane);
  return material;
}

function island(scenery: Group, palette: Palette): void {
  const slab = mesh(
    roundedBox(ISLAND * 2, 2.2, ISLAND * 2, 1.2),
    paint(palette.seawall, { roughness: 0.92 }),
  );
  scenery.add(at(slab, 0, -1.1, 0));
  const top = mesh(
    box(ISLAND * 2 - 1.6, 0.1, ISLAND * 2 - 1.6),
    paint(palette.ground, { roughness: 0.9 }),
    { cast: false },
  );
  scenery.add(at(top, 0, 0.0, 0));
  // A pale line of surf where the sea meets the wall.
  const foam = new Mesh(
    new RingGeometry(ISLAND * 1.415, ISLAND * 1.47, 4, 1),
    new MeshBasicMaterial({
      color: palette === NIGHT ? '#6a7ab0' : '#ffffff',
      transparent: true,
      opacity: palette === NIGHT ? 0.12 : 0.28,
    }),
  );
  foam.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
  foam.position.y = WATER_LEVEL + 0.02;
  scenery.add(foam);
}

function ringShape(outer: number, inner: number, corner = 2.2): Shape {
  const shape = roundedSquare(outer, corner + (outer - ROAD_CENTRE));
  shape.holes.push(roundedSquare(inner, Math.max(0.2, corner + (inner - ROAD_CENTRE))));
  return shape;
}

function roundedSquare(half: number, radius: number): Shape {
  const r = Math.max(0.05, Math.min(radius, half));
  const s = new Shape();
  s.moveTo(-half + r, -half);
  s.lineTo(half - r, -half);
  s.quadraticCurveTo(half, -half, half, -half + r);
  s.lineTo(half, half - r);
  s.quadraticCurveTo(half, half, half - r, half);
  s.lineTo(-half + r, half);
  s.quadraticCurveTo(-half, half, -half, half - r);
  s.lineTo(-half, -half + r);
  s.quadraticCurveTo(-half, -half, -half + r, -half);
  return s;
}

function flat(shape: Shape, material: MeshStandardMaterial, y: number): Mesh {
  const m = new Mesh(new ShapeGeometry(shape, 24), material);
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.receiveShadow = true;
  return m;
}

function road(scenery: Group, palette: Palette, dark: boolean): void {
  const asphalt = new MeshStandardMaterial({
    color: palette.road,
    roughness: palette.roadRoughness,
    metalness: dark ? 0.25 : 0,
  });
  scenery.add(
    flat(ringShape(ROAD_CENTRE + ROAD_WIDTH / 2, ROAD_CENTRE - ROAD_WIDTH / 2), asphalt, 0.06),
  );
  const kerb = paint(palette.pavement, { roughness: 0.85 });
  // Kerbs either side of the road, a hand's height above it.
  for (const offset of [ROAD_WIDTH / 2 + 0.18, -ROAD_WIDTH / 2 - 0.18]) {
    const ring = new Mesh(
      new ShapeGeometry(ringShape(ROAD_CENTRE + offset + 0.18, ROAD_CENTRE + offset - 0.18), 24),
      kerb,
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.14;
    ring.receiveShadow = true;
    scenery.add(ring);
  }
  // The dashed centre line.
  const dash = paint(palette.marking, {
    roughness: 0.6,
    emissive: new Color(dark ? '#3a4050' : '#000000'),
  });
  const length = SQUARE_LAYOUT.pathLength(0);
  for (let s = 0; s < length; s += 1.6) {
    const { point, heading } = SQUARE_LAYOUT.path(s, 0);
    const piece = mesh(box(0.8, 0.02, 0.1), dash, { cast: false });
    piece.position.set(point.x, 0.075, point.z);
    piece.rotation.y = -heading;
    scenery.add(piece);
  }
}

// —— the promenade round the edge ——

function promenade(scenery: Group, palette: Palette, dark: boolean): void {
  const rim = BOARD_HALF + 2.4;
  const spots: Vector3[] = [];
  const lampSpots: Vector3[] = [];
  for (let i = -11; i <= 11; i++) {
    const t = (i / 11) * (BOARD_HALF - 1);
    for (const [x, z] of [
      [t, rim],
      [t, -rim],
      [rim, t],
      [-rim, t],
    ] as const) {
      if (i % 2 === 0) spots.push(new Vector3(x, 0.05, z));
      else lampSpots.push(new Vector3(x, 0.05, z));
    }
  }
  scenery.add(
    trees(
      spots,
      {
        trunk: '#6b4a2f',
        crowns: dark ? ['#1f4a33', '#24583a'] : ['#5aa846', '#7cc152', '#3f9150'],
      },
      'harbour-promenade',
    ),
  );
  scenery.add(lamps(lampSpots, { post: '#2f3440', light: '#ffc46b', height: 2.1 }, dark));
  // Railings along the sea wall.
  const rail = paint(dark ? '#5b6170' : '#f3f1ea', { roughness: 0.4, metalness: 0.3 });
  for (const [x, z, w, d] of [
    [0, ISLAND - 0.9, ISLAND * 2 - 2.5, 0.08],
    [0, -ISLAND + 0.9, ISLAND * 2 - 2.5, 0.08],
    [ISLAND - 0.9, 0, 0.08, ISLAND * 2 - 2.5],
    [-ISLAND + 0.9, 0, 0.08, ISLAND * 2 - 2.5],
  ] as const) {
    scenery.add(at(mesh(box(w, 0.08, d), rail, { cast: false }), x, 0.6, z));
  }
  void palette;
}

// —— boats, ferries and the lighthouse ——

function boats(scenery: Group, dark: boolean, movers: ((s: number, e: number) => void)[]): void {
  const rng = createRng('harbour-boats');
  const floating: { boat: Group; phase: number; drift: number; base: Vector3 }[] = [];
  for (let i = 0; i < 16; i++) {
    const angle = rng.next() * Math.PI * 2;
    const radius = ISLAND + 9 + rng.next() * 40;
    const boat = sailboat(dark, rng);
    const base = new Vector3(Math.cos(angle) * radius, WATER_LEVEL, Math.sin(angle) * radius);
    boat.position.copy(base);
    boat.rotation.y = rng.next() * Math.PI * 2;
    scenery.add(boat);
    floating.push({ boat, phase: rng.next() * 6, drift: 0.3 + rng.next() * 0.4, base });
  }
  // A ferry at each of the four piers.
  for (const index of [5, 15, 25, 35]) {
    const lot = LOTS[index]!;
    const boat = ferry(dark);
    const base = lot.centre
      .clone()
      .addScaledVector(lot.out, LOT_DEPTH / 2 + 9.5)
      .addScaledVector(lot.along, 3.2);
    base.y = WATER_LEVEL;
    boat.position.copy(base);
    boat.rotation.y = lot.yaw + Math.PI / 2;
    scenery.add(boat);
    floating.push({ boat, phase: index, drift: 0, base });
  }
  movers.push((_s, elapsed) => {
    for (const f of floating) {
      f.boat.position.y = f.base.y + Math.sin(elapsed * 1.3 + f.phase) * 0.08;
      f.boat.rotation.z = Math.sin(elapsed * 1.1 + f.phase) * 0.04;
      if (f.drift) f.boat.position.x = f.base.x + Math.sin(elapsed * 0.05 * f.drift + f.phase) * 4;
    }
  });
}

function lighthouse(
  scenery: Group,
  dark: boolean,
  movers: ((s: number, e: number) => void)[],
): void {
  // The breakwater's harbour light: a short green beacon, so the Lighthouse Hill landmark stays
  // the only lighthouse in town.
  const group = new Group();
  group.add(
    at(
      mesh(roundedBox(18, 1.6, 2.4, 0.4), paint(dark ? '#3a3c45' : '#b9b1a1', { roughness: 0.95 })),
      -6,
      -0.2,
      0,
    ),
  );
  group.add(
    at(mesh(cylinder(0.45, 0.6, 2.6, 16), paint('#2f8a4a', { roughness: 0.5 })), 2, 1.9, 0),
  );
  const lamp = paint('#bfffd0', {
    emissive: new Color('#5aff8a'),
    emissiveIntensity: dark ? 3 : 0.3,
  });
  const light = at(mesh(cylinder(0.35, 0.35, 0.5, 12), lamp), 2, 3.45, 0);
  group.add(light);
  group.add(at(mesh(cylinder(0.05, 0.45, 0.35, 12), paint('#2f8a4a')), 2, 3.88, 0));
  if (dark) movers.push((_s, e) => (lamp.emissiveIntensity = Math.sin(e * 2.2) > 0.2 ? 3 : 0.4));
  group.position.set(-ISLAND - 12, WATER_LEVEL + 0.2, -ISLAND - 8);
  group.rotation.y = 0.5;
  scenery.add(group);
}

// —— one lot ——

function harbourLot(context: ArtContext, lot: LotArt): Object3D {
  const { dark, theme } = context;
  const palette = dark ? NIGHT : DAY;
  const group = new Group();
  const slot = LAYOUT[lot.frame.index]!;
  const width = lot.frame.width;
  const depth = lot.frame.depth;
  // The lot's ground: paving in front, the plot behind.
  group.add(
    at(
      mesh(box(width - 0.12, 0.12, depth - 0.1), paint(palette.pavement, { roughness: 0.9 }), {
        cast: false,
      }),
      0,
      0.06,
      0,
    ),
  );
  const front = -depth / 2;
  const signColour =
    lot.group !== null ? theme.groups[lot.group]!.colour : specialColour(slot.kind);
  const sign = signBoard(
    theme.spaces[lot.frame.index]!,
    signColour,
    palette,
    theme.displayFont,
    dark,
    slot.kind,
  );
  sign.position.set(0, 0, front + 0.75);
  group.add(sign);

  if (slot.kind === 'street') {
    const vacant = lot.level === 0 && lot.owner === null;
    const plot = paint(vacant ? (dark ? '#3a3a34' : '#d6c7a4') : palette.pavement, {
      roughness: 0.95,
    });
    group.add(at(mesh(box(width - 0.7, 0.14, depth - 2.2), plot, { cast: false }), 0, 0.1, 0.7));
    if (lot.owner === null) {
      group.add(at(saleBoard(dark), width / 2 - 0.9, 0, 0.4, -0.3));
      group.add(shrubs(width, depth, dark, lot.frame.index));
    } else {
      group.add(
        at(
          ownerFlag(lot.ownerColour!, lot.ownerToken ?? 'buoy', dark, lot.honour),
          -width / 2 + 0.55,
          0,
          front + 1.5,
        ),
      );
      const building = streetBuilding(lot, dark, signColour);
      if (building) group.add(building);
    }
  } else {
    group.add(specialLot(context, lot, slot.kind, dark, signColour));
    if (lot.owner !== null && lot.ownerColour) {
      group.add(
        at(
          ownerFlag(lot.ownerColour, lot.ownerToken ?? 'buoy', dark, lot.honour),
          -width / 2 + 0.55,
          0,
          front + 1.5,
        ),
      );
    }
  }
  return group;
}

function specialColour(kind: string): string {
  switch (kind) {
    case 'transit':
      return '#1f6fb2';
    case 'utility':
      return '#4b5563';
    case 'card':
      return '#c0392b';
    case 'tax':
      return '#5b4a3a';
    default:
      return '#2b2f3a';
  }
}

function signBoard(
  name: string,
  band: string,
  palette: Palette,
  font: string,
  dark: boolean,
  kind: string,
): Group {
  const group = new Group();
  const map = signTexture(name, {
    font,
    band,
    paper: palette.sign.paper,
    ink: palette.sign.ink,
    bandText: kind === 'street' ? undefined : labelFor(kind),
  });
  const frame = paint('#3a3f4a', { metalness: 0.4, roughness: 0.5 });
  const face = new Mesh(box(2.4, 0.9, 0.07), [
    frame,
    frame,
    frame,
    frame,
    new MeshStandardMaterial({
      map,
      roughness: 0.6,
      emissiveMap: map,
      emissive: new Color(dark ? '#ffffff' : '#000000'),
      emissiveIntensity: dark ? 0.45 : 0,
    }),
    frame,
  ]);
  face.position.set(0, 1.35, 0);
  face.castShadow = true;
  group.add(face);
  group.add(at(mesh(cylinder(0.05, 0.05, 0.95), frame), 0, 0.47, 0));
  // The world turns every sign towards the camera, so a name is always readable.
  group.name = 'sign';
  return group;
}

function labelFor(kind: string): string {
  switch (kind) {
    case 'transit':
      return 'FERRY';
    case 'utility':
      return 'UTILITY';
    case 'card':
      return 'DRAW A CARD';
    case 'tax':
      return 'PAY';
    case 'start':
      return 'COLLECT PAY';
    case 'lockup':
      return 'LOCK-UP';
    case 'toLockup':
      return 'TO THE LOCK-UP';
    default:
      return 'REST';
  }
}

/** A few low bushes on a vacant lot. */
function shrubs(width: number, depth: number, dark: boolean, index: number): Group {
  const group = new Group();
  const rng = createRng(`harbour-shrubs-${index}`);
  for (let i = 0; i < 4; i++) {
    const bush = mesh(
      sphere(0.3 + rng.next() * 0.25, 7),
      paint(dark ? '#2c4a34' : rng.pick(['#7cae4f', '#6a9e46', '#8cbf5a']), {
        flatShading: true,
        roughness: 0.9,
      }),
    );
    bush.scale.y = 0.7;
    group.add(at(bush, (rng.next() - 0.5) * (width - 1.4), 0.25, 0.2 + rng.next() * (depth - 3.2)));
  }
  return group;
}

// —— buildings ——

/** What stands on a street lot: the finished building of its level, or one storey going up. */
function streetBuilding(lot: LotArt, dark: boolean, accent: string): Group | null {
  if (lot.level === 0) return null;
  const width = lot.frame.width - 0.6;
  const depth = lot.frame.depth - 2.3;
  const group = new Group();
  group.position.z = 0.75;
  const finished = lot.progress >= 1 ? lot.level : lot.level - 1;
  const options = {
    group: lot.group ?? 0,
    level: finished,
    width,
    depth,
    dark,
    seed: `harbour-lot-${lot.frame.index}`,
    accent,
  };
  if (finished >= 5) group.add(harbourLandmark(options));
  else if (finished >= 1) group.add(harbourBuilding({ ...options, roofless: lot.progress < 1 }));
  if (lot.progress < 1) {
    group.add(
      constructionKit({
        width,
        depth,
        from: levelHeight(finished),
        to: levelHeight(lot.level),
        progress: lot.progress,
        dark,
        accent,
      }),
    );
  }
  return group;
}

// —— corners, ferries, utilities, cards and taxes ——

function specialLot(
  context: ArtContext,
  lot: LotArt,
  kind: string,
  dark: boolean,
  accent: string,
): Group {
  const group = new Group();
  const { width, depth } = lot.frame;
  const lit = (colour: string, i = 1.6) =>
    paint(colour, { emissive: new Color(colour), emissiveIntensity: dark ? i : 0, roughness: 0.4 });
  switch (kind) {
    case 'start': {
      group.add(at(mesh(roundedBox(0.5, 4, 0.5, 0.1), paint('#f7f5ef')), -2, 2, 0.6));
      group.add(at(mesh(roundedBox(0.5, 4, 0.5, 0.1), paint('#f7f5ef')), 2, 2, 0.6));
      group.add(at(mesh(roundedBox(5, 0.9, 0.4, 0.15), lit('#f4c430', 1.2)), 0, 4.2, 0.6));
      group.add(at(mesh(cylinder(0.55, 0.55, 0.12, 24), lit('#ffd27a', 1.8)), 0, 4.2, 0.36));
      break;
    }
    case 'lockup': {
      group.add(
        at(mesh(roundedBox(4.2, 2.6, 3.4, 0.12), paint(dark ? '#3a4560' : '#d7dfe8')), 0, 1.4, 1.2),
      );
      group.add(at(mesh(roundedBox(4.4, 0.3, 3.6, 0.1), paint('#2a3a6a')), 0, 2.85, 1.2));
      group.add(at(mesh(sphere(0.28, 16), lit('#4aa3ff', 3)), 0, 3.25, 1.2));
      break;
    }
    case 'rest': {
      group.add(ferrisWheel(dark));
      break;
    }
    case 'toLockup': {
      group.add(
        at(mesh(cylinder(0.6, 0.8, 5.2, 12), paint(dark ? '#3a3c45' : '#e6e1d6')), 0, 2.6, 1.2),
      );
      group.add(at(mesh(roundedBox(2.2, 1.0, 2.2, 0.15), paint('#2a3a6a')), 0, 5.6, 1.2));
      group.add(at(mesh(sphere(0.3, 16), lit('#ff4a4a', 3)), 0, 6.4, 1.2));
      break;
    }
    case 'transit': {
      const terminal = new Group();
      terminal.add(
        at(
          mesh(
            roundedBox(width - 0.9, 1.8, 2.6, 0.12),
            paint(dark ? '#273248' : '#dfe8ee', { roughness: 0.3, metalness: 0.2 }),
          ),
          0,
          0.95,
          0.6,
        ),
      );
      const roof = mesh(new TorusGeometry(1.6, 0.16, 8, 24, Math.PI), paint(accent));
      roof.rotation.y = Math.PI / 2;
      terminal.add(at(roof, 0, 1.8, 0.6));
      terminal.add(at(mesh(box(width - 1.0, 0.5, 2.64), lit('#9fdcff', 1)), 0, 1.15, 0.6));
      group.add(terminal);
      // The pier, out over the water to the ferry.
      group.add(
        at(
          mesh(box(2.0, 0.25, 14), paint(dark ? '#4a4038' : '#a77d55', { roughness: 0.9 })),
          1.6,
          -0.05,
          depth / 2 + 6.5,
        ),
      );
      break;
    }
    case 'utility': {
      if (lot.frame.index === 12) {
        group.add(
          at(
            mesh(roundedBox(width - 1, 2.4, 2.8, 0.1), paint(dark ? '#3b3f4a' : '#c7bfae')),
            0,
            1.3,
            1.2,
          ),
        );
        const wheel = mesh(new TorusGeometry(1.2, 0.16, 8, 20), paint('#8a6a45'));
        wheel.rotation.y = Math.PI / 2;
        group.add(at(wheel, width / 2 - 0.4, 1.4, 1.2));
        group.add(at(mesh(box(0.3, 1.2, 1.2), lit('#9fdcff', 1.2)), 0, 1.6, -0.25));
      } else {
        for (const x of [-1.1, 0.9]) group.add(turbine(dark, x));
      }
      break;
    }
    case 'card': {
      const post = lot.frame.index % 2 === 0 || [17, 33].includes(lot.frame.index);
      if (post) {
        group.add(
          at(
            mesh(cylinder(0.32, 0.34, 1.3, 16), paint('#d8312b', { roughness: 0.35 })),
            0.6,
            0.75,
            0.6,
          ),
        );
        group.add(at(mesh(sphere(0.33, 16), paint('#d8312b', { roughness: 0.35 })), 0.6, 1.4, 0.6));
        group.add(
          at(
            mesh(roundedBox(1.6, 1.8, 1.4, 0.1), paint(dark ? '#334' : '#f2efe6')),
            -0.8,
            0.95,
            1.2,
          ),
        );
      } else {
        group.add(
          at(
            mesh(roundedBox(2.4, 1.6, 0.18, 0.05), paint('#b07a4a', { roughness: 0.9 })),
            0,
            1.4,
            0.4,
          ),
        );
        group.add(at(mesh(box(2.1, 1.3, 0.04), lit('#f2e6c9', 0.4)), 0, 1.4, 0.3));
      }
      break;
    }
    case 'tax': {
      group.add(
        at(mesh(roundedBox(1.4, 1.6, 1.4, 0.12), paint(dark ? '#3b3f4a' : '#e8e2d5')), 1, 0.9, 0.8),
      );
      const barrier = mesh(box(2.4, 0.12, 0.12), paint('#d8312b'));
      group.add(at(barrier, -0.6, 1.0, -0.4));
      break;
    }
  }
  void context;
  return group;
}

function ferrisWheel(dark: boolean): Group {
  const group = new Group();
  const frame = paint(dark ? '#cfd6e6' : '#f7f5ef', { roughness: 0.4, metalness: 0.3 });
  const rim = mesh(
    new TorusGeometry(2.6, 0.08, 8, 48),
    dark ? paint('#ff4fa2', { emissive: new Color('#ff4fa2'), emissiveIntensity: 2 }) : frame,
  );
  const wheel = new Group();
  wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const spoke = mesh(box(0.05, 5.2, 0.05), frame);
    spoke.rotation.z = (i / 8) * Math.PI;
    wheel.add(spoke);
    const a = (i / 8) * Math.PI * 2;
    wheel.add(
      at(
        mesh(
          roundedBox(0.5, 0.45, 0.45, 0.1),
          paint(['#e94f37', '#2e86de', '#f4c430', '#4fb286'][i % 4]!),
        ),
        Math.cos(a) * 2.6,
        Math.sin(a) * 2.6,
        0,
      ),
    );
  }
  wheel.position.set(0, 3.6, 1.6);
  wheel.rotation.y = Math.PI / 2;
  group.add(wheel);
  for (const z of [0.9, 2.3]) {
    for (const x of [-1, 1]) {
      const leg = mesh(box(0.1, 3.8, 0.1), frame);
      leg.rotation.x = x * 0.25;
      group.add(at(leg, 0, 1.8, z + x * 0.1));
    }
  }
  wheel.name = 'ferris';
  return group;
}

function turbine(dark: boolean, x: number): Group {
  const group = new Group();
  group.add(at(mesh(cylinder(0.08, 0.14, 4.6, 10), paint('#f2f4f6')), x, 2.3, 1.2));
  const blades = new Group();
  for (let i = 0; i < 3; i++) {
    const blade = mesh(roundedBox(0.16, 1.7, 0.05, 0.03), paint('#f2f4f6'));
    blade.position.y = 0.85;
    const arm = new Group();
    arm.rotation.z = (i / 3) * Math.PI * 2;
    arm.add(blade);
    blades.add(arm);
  }
  blades.position.set(x, 4.6, 0.95);
  blades.name = 'blades';
  group.add(blades);
  group.add(
    at(
      mesh(
        sphere(0.12, 10),
        paint(dark ? '#ff4a4a' : '#f2f4f6', {
          emissive: new Color('#ff3030'),
          emissiveIntensity: dark ? 2 : 0,
        }),
      ),
      x,
      4.6,
      1.1,
    ),
  );
  return group;
}
