import { Vector3 } from 'three';
import {
  AmbientLight,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  RepeatWrapping,
  Shape,
  ShapeGeometry,
  SpotLight,
  SRGBColorSpace,
  TorusGeometry,
} from 'three';
import { createRng } from '@usr-games/kit';
import { LAYOUT } from '../../boards/layout';
import { BOARDS } from '../../boards/themes';
import { at, box, cylinder, mesh, paint, roundedBox, sphere } from '../world/kit3d';
import { BOARD_HALF, LOT_DEPTH, LOTS, SQUARE_LAYOUT } from '../world/lots';
import { tokenModel } from '../world/tokens';
import type { ArtContext, BoardArt, LotArt } from '../world/world';
import { ownerFlag } from './common';
import { diceTray } from './dice';
import {
  cutout,
  facadeTile,
  type FacadeStyle,
  labelTexture,
  PAPER,
  paperTexture,
  printedBoard,
  roofTile,
} from './popup-paper';

/**
 * Pop-up 1904: an old picture book open on a desk, the board printed across its spread and the
 * town folding up out of the paper. Every building is a few sheets of printed card hinged at
 * the page, so a storey going up is a sheet half folded. By day the book lies in window light;
 * by night a reading lamp leaves long, warm shadows. It honours Lizzie Magie's board of 1904.
 */

const SPREAD_HALF_X = 33;
const SPREAD_HALF_Z = 33;
const STOREY = 1.55;

const STYLES: readonly FacadeStyle[] = [
  { wall: '#c27a5a', trim: '#5a3a24', kind: 0 },
  { wall: '#e6c27a', trim: '#7a2a24', kind: 1 },
  { wall: '#a9c79a', trim: '#2f5a3a', kind: 2 },
  { wall: '#e6a6b4', trim: '#6a2a44', kind: 2 },
  { wall: '#9fb4d6', trim: '#23345a', kind: 0 },
  { wall: '#c9a9d8', trim: '#4a2a5a', kind: 1 },
  { wall: '#9fd0c6', trim: '#1f4a46', kind: 3 },
  { wall: '#b9b2c2', trim: '#2a2433', kind: 0 },
];

const ROOFS = [
  '#7a3a2c',
  '#6a4a3a',
  '#3a4a5a',
  '#5a3a4a',
  '#2f3a5a',
  '#4a3a5a',
  '#2f4a4a',
  '#3a3442',
];

const paperMaterials = new Map<string, MeshStandardMaterial>();
function card(map: CanvasTexture, key: string, dark: boolean): MeshStandardMaterial {
  const id = `${key}:${dark}`;
  let material = paperMaterials.get(id);
  if (!material) {
    material = new MeshStandardMaterial({
      map,
      side: DoubleSide,
      roughness: 0.92,
      metalness: 0,
      emissiveMap: dark ? map : null,
      emissive: new Color(dark ? '#3a2410' : '#000000'),
      emissiveIntensity: dark ? 0.12 : 0,
    });
    paperMaterials.set(id, material);
  }
  return material;
}

const tiles = new Map<string, CanvasTexture>();
function tile(key: string, make: () => CanvasTexture): CanvasTexture {
  let texture = tiles.get(key);
  if (!texture) {
    texture = make();
    tiles.set(key, texture);
  }
  return texture;
}

export function createPopupArt(): BoardArt {
  let movers: ((seconds: number, elapsed: number) => void)[] = [];
  const art: BoardArt = {
    theme: BOARDS.popup,
    layout: SQUARE_LAYOUT,
    // Behind the dice tray as the table's camera sees it, so it never hides the dice.
    statueSpot: new Vector3(0, 0.12, -5.2),
    // From higher up, so the fold is seen against the page rather than the dark room.
    landmarkShot: { height: 5, distance: 54, elevation: 0.5 },

    look(dark) {
      return dark
        ? {
            tiltShift: { focus: 0.5, band: 0.11, ramp: 0.32, maxBlur: 10 },
            grade: { saturation: 1.05, contrast: 1.1, vignette: 0.55, tint: [1.06, 0.98, 0.9] },
            bloom: 0.35,
            exposure: 1.25,
          }
        : {
            tiltShift: { focus: 0.48, band: 0.12, ramp: 0.3, maxBlur: 8 },
            grade: { saturation: 1.05, contrast: 1.04, vignette: 0.24, tint: [1.03, 1.0, 0.95] },
            bloom: 0,
            exposure: 1.05,
          };
    },

    setup(context) {
      movers = [];
      const { scenery, stage, dark } = context;
      const scene = stage.scene;
      scene.background = new Color(dark ? '#120c08' : '#e9dcc4');
      scene.fog = null;
      scene.environment = null;
      lights(scenery, dark);
      desk(scenery, dark);
      book(scenery, dark);
      parkPieces(scenery, dark);
      passersBy(scenery, dark, movers);
    },

    lot(context, lot) {
      return popupLot(context, lot);
    },

    token(_context, id, colour) {
      return tokenModel(id, colour);
    },

    animate(_context, seconds, elapsed) {
      for (const move of movers) move(seconds, elapsed);
    },

    signature(context, lot, seconds) {
      void context;
      return foldUp(lot.centre, lot.yaw, seconds);
    },
  };
  return art;
}

// —— light ——

function lights(scenery: Group, dark: boolean): void {
  if (dark) {
    scenery.add(new AmbientLight('#6a4a34', 1.5));
    const moon = new DirectionalLight('#7f8fc8', 0.55);
    moon.position.set(50, 40, 40);
    scenery.add(moon, moon.target);
    const lamp = new SpotLight('#ffb36b', 2600, 160, 0.62, 0.65, 1.6);
    lamp.position.set(-38, 46, -18);
    lamp.target.position.set(4, 0, 6);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(2048, 2048);
    lamp.shadow.bias = -0.0003;
    lamp.shadow.normalBias = 0.02;
    scenery.add(lamp, lamp.target);
  } else {
    scenery.add(new HemisphereLight('#fff6e6', '#b89a78', 1.1));
    const window = new DirectionalLight('#fff1dc', 2.4);
    window.position.set(-50, 60, 30);
    window.castShadow = true;
    window.shadow.mapSize.set(2048, 2048);
    const camera = window.shadow.camera;
    camera.left = camera.bottom = -48;
    camera.right = camera.top = 48;
    camera.near = 10;
    camera.far = 220;
    window.shadow.bias = -0.0004;
    window.shadow.normalBias = 0.02;
    window.shadow.radius = 4;
    scenery.add(window, window.target);
  }
}

// —— the desk, the book and the things lying about ——

function woodTexture(dark: boolean): CanvasTexture {
  const element = document.createElement('canvas');
  element.width = element.height = 1024;
  const ctx = element.getContext('2d')!;
  const rng = createRng('popup-wood');
  ctx.fillStyle = dark ? '#3a2416' : '#8a5a34';
  ctx.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 160; i++) {
    const y = rng.next() * 1024;
    ctx.strokeStyle = rng.chance(0.5) ? 'rgba(40,20,10,0.25)' : 'rgba(255,220,170,0.12)';
    ctx.lineWidth = 1 + rng.next() * 4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 1024; x += 32) ctx.lineTo(x, y + Math.sin(x / 90 + i) * 6);
    ctx.stroke();
  }
  const map = new CanvasTexture(element);
  map.colorSpace = SRGBColorSpace;
  map.wrapS = map.wrapT = RepeatWrapping;
  map.repeat.set(3, 3);
  return map;
}

function desk(scenery: Group, dark: boolean): void {
  const top = new Mesh(
    new PlaneGeometry(320, 320),
    new MeshStandardMaterial({ map: woodTexture(dark), roughness: 0.6, metalness: 0 }),
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = -2.4;
  top.receiveShadow = true;
  scenery.add(top);
  // A pencil, an ink pot and a teacup, toy-sized beside the book.
  const pencil = new Group();
  pencil.add(at(mesh(cylinder(0.55, 0.55, 22, 6), paint('#e3b11f', { roughness: 0.5 })), 0, 0, 0));
  pencil.add(
    at(mesh(cylinder(0.0, 0.55, 2.2, 6), paint('#e9c9a0', { roughness: 0.8 })), 0, 12.1, 0),
  );
  pencil.add(at(mesh(cylinder(0.0, 0.18, 0.7, 6), paint('#2b2b2b')), 0, 12.9, 0));
  pencil.add(
    at(mesh(cylinder(0.58, 0.58, 1.2, 12), paint('#c9ced6', { metalness: 0.7 })), 0, -11.4, 0),
  );
  pencil.add(at(mesh(cylinder(0.55, 0.55, 1.4, 12), paint('#e48a9a')), 0, -12.6, 0));
  pencil.rotation.set(Math.PI / 2, 0, 1.15);
  pencil.position.set(44, -1.85, 18);
  scenery.add(pencil);
  const pot = new Group();
  pot.add(
    at(
      mesh(cylinder(3.4, 3.8, 4.6, 24), paint('#1d2a3a', { roughness: 0.15, metalness: 0.1 })),
      0,
      2.3,
      0,
    ),
  );
  pot.add(at(mesh(cylinder(1.6, 1.6, 1.2, 20), paint('#2a2a2e', { roughness: 0.4 })), 0, 5.2, 0));
  pot.position.set(-44, -2.4, -16);
  scenery.add(pot);
  const cup = new Group();
  cup.add(at(mesh(cylinder(6.5, 6.8, 0.5, 32), paint('#f4f1ea', { roughness: 0.3 })), 0, 0.25, 0));
  cup.add(at(mesh(cylinder(3.6, 2.8, 4.2, 32), paint('#f4f1ea', { roughness: 0.3 })), 0, 2.5, 0));
  cup.add(at(mesh(cylinder(3.3, 3.3, 0.2, 32), paint('#7a4a24', { roughness: 0.1 })), 0, 4.3, 0));
  const handle = mesh(new TorusGeometry(1.3, 0.4, 8, 20), paint('#f4f1ea', { roughness: 0.3 }));
  handle.rotation.y = Math.PI / 2;
  cup.add(at(handle, 3.8, 2.8, 0));
  cup.position.set(40, -2.4, -24);
  scenery.add(cup);
  // The reading lamp's brass foot and green shade, at the top left of the desk.
  const lamp = new Group();
  lamp.add(
    at(
      mesh(cylinder(5, 5.6, 1.2, 32), paint('#b8862e', { metalness: 0.8, roughness: 0.3 })),
      0,
      0.6,
      0,
    ),
  );
  lamp.add(
    at(
      mesh(cylinder(0.5, 0.5, 30, 12), paint('#b8862e', { metalness: 0.8, roughness: 0.3 })),
      0,
      15,
      0,
    ),
  );
  const shade = mesh(
    new CylinderGeometry(3.2, 7, 5, 32, 1, true),
    paint('#2f6a4a', {
      side: DoubleSide,
      roughness: 0.2,
      metalness: 0.2,
      emissive: new Color(dark ? '#ffcf8a' : '#000000'),
      emissiveIntensity: dark ? 0.15 : 0,
    }),
  );
  lamp.add(at(shade, 6, 29, 4));
  if (dark)
    lamp.add(
      at(
        mesh(
          sphere(2.2, 16),
          paint('#fff2cf', { emissive: new Color('#ffcf8a'), emissiveIntensity: 3 }),
        ),
        6,
        27.6,
        4,
      ),
    );
  lamp.position.set(-52, -2.4, -34);
  scenery.add(lamp);
}

/** The gutter's dip: the pages curve down into the spine. */
function gutter(x: number): number {
  return -0.45 * Math.exp(-((x / 2.2) ** 2));
}

function book(scenery: Group, dark: boolean): void {
  // Cloth-bound boards under the pages, and the page block's edge.
  const cloth = paint(dark ? '#4a1a1a' : '#7a2a24', { roughness: 0.85 });
  scenery.add(
    at(
      mesh(roundedBox(SPREAD_HALF_X * 2 + 3, 0.6, SPREAD_HALF_Z * 2 + 3, 0.25), cloth),
      0,
      -2.1,
      0,
    ),
  );
  const edge = paper(dark, 'popup-edge');
  scenery.add(at(mesh(box(SPREAD_HALF_X * 2, 1.8, SPREAD_HALF_Z * 2), edge), 0, -0.95, 0));
  // The spread itself, printed with the board, dipping into the gutter.
  const geometry = new PlaneGeometry(SPREAD_HALF_X * 2, SPREAD_HALF_Z * 2, 96, 1);
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) position.setZ(i, gutter(position.getX(i)));
  geometry.computeVertexNormals();
  const plots = LOTS.map((lot) => {
    const half = lot.width / 2;
    const corners = [
      [-half, -lot.depth / 2],
      [half, -lot.depth / 2],
      [half, lot.depth / 2],
      [-half, lot.depth / 2],
    ].map(([ax, az]) => {
      const x = lot.centre.x + lot.along.x * ax! + lot.out.x * az!;
      const z = lot.centre.z + lot.along.z * ax! + lot.out.z * az!;
      return [x, z] as [number, number];
    });
    const group = LAYOUT[lot.index]!.group;
    return { corners, colour: group === undefined ? null : BOARDS.popup.groups[group]!.colour };
  });
  const toPixel = (x: number, z: number): [number, number] => [
    ((x + SPREAD_HALF_X) / (SPREAD_HALF_X * 2)) * 2048,
    ((z + SPREAD_HALF_Z) / (SPREAD_HALF_Z * 2)) * 2048,
  ];
  const road = (offset: number) =>
    Array.from({ length: 160 }, (_, i) => {
      const { point } = SQUARE_LAYOUT.path((i / 160) * SQUARE_LAYOUT.pathLength(offset), offset);
      return [point.x, point.z] as [number, number];
    });
  const map = printedBoard(plots, toPixel, road, dark);
  const spread = new Mesh(geometry, new MeshStandardMaterial({ map, roughness: 0.95 }));
  spread.rotation.x = -Math.PI / 2;
  spread.position.y = 0.0;
  spread.receiveShadow = true;
  scenery.add(spread);
  // A soft shadow down the gutter.
  const shade = new Mesh(
    new PlaneGeometry(6, SPREAD_HALF_Z * 2),
    new MeshStandardMaterial({
      color: '#3a2410',
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
  );
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = -0.38;
  scenery.add(shade);
}

function paper(dark: boolean, seed: string): MeshStandardMaterial {
  return card(
    tile(`paper:${seed}`, () => paperTexture(seed)),
    `paper:${seed}`,
    dark,
  );
}

// —— paper things standing up from the page ——

/** A cut-out on a fold-back tab, two crossed sheets so it reads from every side. */
function standee(
  texture: CanvasTexture,
  width: number,
  height: number,
  key: string,
  dark: boolean,
  crossed = true,
): Group {
  const group = new Group();
  const material = card(texture, key, dark);
  material.alphaTest = 0.5;
  material.transparent = false;
  const sheet = new Mesh(new PlaneGeometry(width, height), material);
  sheet.position.y = height / 2;
  sheet.castShadow = true;
  group.add(sheet);
  if (crossed) {
    const other = sheet.clone();
    other.rotation.y = Math.PI / 2;
    group.add(other);
  }
  group.add(at(mesh(box(width * 0.5, 0.04, 0.5), paper(dark, 'popup-tab')), 0, 0.02, 0));
  return group;
}

function parkPieces(scenery: Group, dark: boolean): void {
  scenery.add(diceTray(dark));
  const rng = createRng('popup-park');
  const inner = BOARD_HALF - LOT_DEPTH - 4;
  for (let i = 0; i < 26; i++) {
    let x: number;
    let z: number;
    do {
      x = (rng.next() * 2 - 1) * (inner - 1);
      z = (rng.next() * 2 - 1) * (inner - 1);
    } while (
      Math.hypot(x, z) < 8 ||
      Math.abs(x) < 1.8 ||
      Math.abs(z) < 1.8 ||
      Math.abs(Math.abs(x) - Math.abs(z)) < 1.4
    );
    const kind = rng.chance(0.3) ? 'poplar' : 'tree';
    const colour = rng.pick(['#7fae5a', '#5f9a4c', '#8fbf6a', '#a8c86a']);
    const tree = standee(
      tile(`${kind}:${colour}`, () => cutout(kind, colour, `${kind}-${colour}`)),
      3.2,
      4,
      `${kind}:${colour}`,
      dark,
    );
    tree.position.set(x, gutter(x) + 0.02, z);
    tree.rotation.y = rng.next() * Math.PI;
    tree.scale.setScalar(0.8 + rng.next() * 0.5);
    scenery.add(tree);
  }
  // A fold-up bandstand in the park.
  const stand = new Group();
  const white = paper(dark, 'popup-stand');
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    stand.add(at(mesh(box(0.12, 2.4, 0.12), white), Math.cos(a) * 1.8, 1.2, Math.sin(a) * 1.8));
  }
  const roof = mesh(
    new CylinderGeometry(0.1, 2.5, 1.4, 6, 1, true),
    card(
      tile('roof:stand', () => roofTile('#a8473a', 'stand')),
      'roof:stand',
      dark,
    ),
  );
  stand.add(at(roof, 0, 3.1, 0));
  stand.add(at(mesh(cylinder(2.2, 2.2, 0.3, 6), white), 0, 0.15, 0));
  stand.position.set(9, 0, 8);
  scenery.add(stand);
}

/** People and carriages on their tabs, going round the lane. */
function passersBy(
  scenery: Group,
  dark: boolean,
  movers: ((s: number, e: number) => void)[],
): void {
  const rng = createRng('popup-traffic');
  const walkers: { sheet: Group; offset: number; s: number; speed: number }[] = [];
  for (let i = 0; i < 26; i++) {
    const kind = i % 4 === 0 ? 'carriage' : i % 4 === 1 ? 'cart' : 'person';
    const colour = rng.pick(['#a8473a', '#2f5585', '#6c4a80', '#5f8a4c', '#c4952b']);
    const size = kind === 'person' ? [0.9, 1.4] : [2.2, 1.8];
    const sheet = standee(
      tile(`${kind}:${colour}`, () => cutout(kind, colour, `${kind}-${colour}-${i}`)),
      size[0]!,
      size[1]!,
      `${kind}:${colour}`,
      dark,
      false,
    );
    const offset = kind === 'person' ? rng.pick([2.3, -2.25]) : rng.pick([0.8, -0.8]);
    walkers.push({
      sheet,
      offset,
      s: rng.next() * SQUARE_LAYOUT.pathLength(offset),
      speed: (kind === 'person' ? 0.5 : 1.6) * (rng.chance(0.5) ? 1 : -1),
    });
    scenery.add(sheet);
  }
  const place = (seconds: number) => {
    for (const w of walkers) {
      w.s += w.speed * seconds;
      const { point, heading } = SQUARE_LAYOUT.path(w.s, w.offset);
      w.sheet.position.set(point.x, gutter(point.x) + 0.02, point.z);
      w.sheet.rotation.y = -heading;
    }
  };
  place(0);
  movers.push((s) => place(s));
}

// —— a lot ——

function popupLot(context: ArtContext, lot: LotArt): Object3D {
  const { dark, theme } = context;
  const group = new Group();
  const slot = LAYOUT[lot.frame.index]!;
  const { width, depth } = lot.frame;
  const band = lot.group !== null ? theme.groups[lot.group]!.colour : '#5e4b38';
  const notes: Record<string, string> = {
    transit: 'Railway halt',
    utility: 'Utility',
    card: 'Draw a card',
    tax: 'Pay',
    start: 'Collect pay',
    lockup: 'Lock-up',
    toLockup: 'To the lock-up',
    rest: 'Rest',
  };
  const label = tentCard(
    theme.spaces[lot.frame.index]!,
    band,
    slot.kind === 'street' ? null : (notes[slot.kind] ?? null),
    dark,
  );
  label.position.set(0, 0, -depth / 2 + 0.9);
  group.add(label);
  const front = -depth / 2;
  if (slot.kind === 'street') {
    if (lot.owner === null) group.add(at(toLet(dark), width / 2 - 0.9, 0, 0.6));
    else {
      group.add(
        at(
          ownerFlag(lot.ownerColour!, lot.ownerToken ?? 'teapot', dark, lot.honour),
          -width / 2 + 0.5,
          0,
          front + 1.7,
        ),
      );
      const building = streetBuilding(lot, dark);
      if (building) group.add(building);
    }
  } else {
    group.add(special(lot, slot.kind, dark));
    if (lot.owner !== null && lot.ownerColour)
      group.add(
        at(
          ownerFlag(lot.ownerColour, lot.ownerToken ?? 'teapot', dark, lot.honour),
          -width / 2 + 0.5,
          0,
          front + 1.7,
        ),
      );
  }
  return group;
}

/** A folded card standing in front of the lot with its name: the board's sign. */
function tentCard(name: string, band: string, note: string | null, dark: boolean): Group {
  const group = new Group();
  const texture = labelTexture(name, band, note);
  const face = new MeshStandardMaterial({
    map: texture,
    roughness: 0.9,
    side: DoubleSide,
    emissiveMap: dark ? texture : null,
    emissive: new Color(dark ? '#5a3a1a' : '#000000'),
    emissiveIntensity: dark ? 0.3 : 0,
  });
  const front = new Mesh(new PlaneGeometry(2.6, 1.0), face);
  front.position.set(0, 0.48, 0.18);
  front.rotation.x = -0.36;
  front.castShadow = true;
  const back = new Mesh(new PlaneGeometry(2.6, 1.0), paper(dark, 'popup-card'));
  back.position.set(0, 0.48, -0.18);
  back.rotation.x = 0.36;
  group.add(front, back);
  group.name = 'sign';
  return group;
}

function toLet(dark: boolean): Group {
  const group = new Group();
  group.add(at(mesh(cylinder(0.04, 0.04, 1.0, 6), paint('#6a4a2a')), 0, 0.5, 0));
  group.add(
    at(
      mesh(
        box(1.0, 0.55, 0.03),
        card(
          tile('to-let', () => labelTexture('To Let', '#a8473a', null)),
          'to-let',
          dark,
        ),
      ),
      0,
      1.05,
      0,
    ),
  );
  return group;
}

/**
 * One storey of paper: front, back and side sheets with the facade printed on them. `fold`
 * below 1 is a storey still coming up out of the page: the front and back sheets lean out on
 * their hinges and the sides are only part way up.
 */
function storey(
  width: number,
  depth: number,
  district: number,
  ground: boolean,
  dark: boolean,
  index: number,
  fold = 1,
): Group {
  const group = new Group();
  const style = STYLES[district]!;
  const key = `facade:${district}:${ground}:${dark}:${index % 3}`;
  const front = card(
    tile(key, () => facadeTile(style, ground, key, dark)),
    key,
    dark,
  );
  const sideKey = `facade:${district}:false:${dark}:${(index + 1) % 3}`;
  const side = card(
    tile(sideKey, () => facadeTile(style, false, sideKey, dark)),
    sideKey,
    dark,
  );
  const add = (
    w: number,
    material: MeshStandardMaterial,
    x: number,
    z: number,
    yaw: number,
    lean: number,
  ) => {
    const hinge = new Group();
    hinge.position.set(x, 0, z);
    hinge.rotation.y = yaw;
    const sheet = new Mesh(new PlaneGeometry(w, STOREY), material);
    sheet.position.y = STOREY / 2;
    sheet.castShadow = true;
    sheet.receiveShadow = true;
    hinge.add(sheet);
    hinge.rotation.x = lean;
    if (lean === 0 && fold < 1) hinge.scale.y = Math.max(0.05, fold);
    group.add(hinge);
  };
  const lean = (1 - fold) * 1.15;
  add(width, front, 0, -depth / 2, Math.PI, fold < 1 ? lean : 0);
  add(width, side, 0, depth / 2, 0, fold < 1 ? lean : 0);
  add(depth, side, -width / 2, 0, -Math.PI / 2, 0);
  add(depth, side, width / 2, 0, Math.PI / 2, 0);
  return group;
}

/** A gable roof of two printed sheets and two triangular ends. */
function gableRoof(width: number, depth: number, district: number, dark: boolean): Group {
  const group = new Group();
  const key = `roof:${district}`;
  const material = card(
    tile(key, () => roofTile(ROOFS[district]!, key)),
    key,
    dark,
  );
  const pitch = 0.62;
  const slope = depth / 2 / Math.cos(pitch);
  for (const sign of [-1, 1]) {
    const sheet = new Mesh(new PlaneGeometry(width + 0.3, slope + 0.15), material);
    sheet.rotation.x = sign > 0 ? -(Math.PI / 2 - pitch) : Math.PI / 2 - pitch;
    sheet.position.set(0, (Math.tan(pitch) * depth) / 4, (sign * depth) / 4);
    sheet.castShadow = true;
    group.add(sheet);
  }
  const end = new Shape();
  end.moveTo(-depth / 2, 0);
  end.lineTo(depth / 2, 0);
  end.lineTo(0, (Math.tan(pitch) * depth) / 2);
  end.closePath();
  const endMaterial = paper(dark, `popup-wall-${district}`);
  for (const x of [-width / 2, width / 2]) {
    const sheet = new Mesh(new ShapeGeometry(end), endMaterial);
    sheet.rotation.y = Math.PI / 2;
    sheet.position.x = x;
    group.add(sheet);
  }
  return group;
}

/**
 * A street lot's building: one storey per level up to four, a gable roof, and the district's
 * landmark at five. A storey being built is its sheets half folded up from the page.
 */
function streetBuilding(lot: LotArt, dark: boolean): Group | null {
  if (lot.level === 0) return null;
  const district = lot.group ?? 0;
  const width = lot.frame.width - 0.9;
  const depth = lot.frame.depth - 3.0;
  const group = new Group();
  group.position.z = 0.9;
  if (lot.level >= 5) {
    // The landmark rises as one: it folds up from the page about its front edge.
    const hinge = new Group();
    const tower = landmark(district, width, depth, dark);
    tower.position.z = depth / 2;
    hinge.position.z = -depth / 2;
    hinge.add(tower);
    if (lot.progress < 1) hinge.rotation.x = (1 - lot.progress) * 1.25;
    group.add(hinge);
    return group;
  }
  const storeys = Math.min(4, lot.level);
  for (let i = 0; i < storeys; i++) {
    const rising = i === storeys - 1 && lot.progress < 1;
    const s = storey(
      width,
      depth,
      district,
      i === 0,
      dark,
      lot.frame.index + i,
      rising ? lot.progress : 1,
    );
    s.position.y = i * STOREY;
    group.add(s);
  }
  const roof = gableRoof(width, depth, district, dark);
  roof.position.y = lot.progress < 1 ? (storeys - 1) * STOREY + STOREY * 1.25 : storeys * STOREY;
  if (lot.progress < 1) roof.rotation.z = (1 - lot.progress) * 0.5;
  group.add(roof);
  return group;
}

/** Each district's landmark, folded up to its full height. */
function landmark(district: number, width: number, depth: number, dark: boolean): Group {
  const group = new Group();
  const stack = (count: number, w: number, d: number, y: number) => {
    for (let i = 0; i < count; i++) {
      const s = storey(w, d, district, i === 0 && y === 0, dark, i + district);
      s.position.y = y + i * STOREY;
      group.add(s);
    }
    return y + count * STOREY;
  };
  const top = stack(3, width, depth, 0);
  const trim = paint(STYLES[district]!.trim, { roughness: 0.9 });
  switch (district % 4) {
    case 0: {
      // A tower with a clock and a spire.
      const towerTop = stack(3, width * 0.5, depth * 0.5, top);
      const face = mesh(cylinder(0.65, 0.65, 0.05, 24), paper(dark, 'popup-clock'));
      face.rotation.x = Math.PI / 2;
      group.add(at(face, 0, towerTop - 1.0, -depth * 0.26));
      const spire = mesh(
        new CylinderGeometry(0.02, width * 0.38, 3.2, 4, 1, true),
        card(
          tile(`roof:${district}`, () => roofTile(ROOFS[district]!, `roof:${district}`)),
          `roof:${district}`,
          dark,
        ),
      );
      spire.rotation.y = Math.PI / 4;
      group.add(at(spire, 0, towerTop + 1.6, 0));
      break;
    }
    case 1: {
      // A dome on a drum.
      const drumTop = stack(1, width * 0.7, depth * 0.7, top);
      const dome = mesh(
        sphere(width * 0.36, 20),
        card(
          tile(`roof:${district}`, () => roofTile(ROOFS[district]!, `roof:${district}`)),
          `roof:${district}`,
          dark,
        ),
      );
      dome.scale.y = 0.85;
      group.add(at(dome, 0, drumTop, 0));
      group.add(at(mesh(cylinder(0.03, 0.03, 1.4, 6), trim), 0, drumTop + width * 0.32 + 0.7, 0));
      break;
    }
    case 2: {
      // Twin turrets with pointed caps.
      for (const x of [-width * 0.3, width * 0.3]) {
        group.add(
          at(
            mesh(
              new CylinderGeometry(0.75, 0.75, 4.2, 12, 1, true),
              paper(dark, `popup-wall-${district}`),
            ),
            x,
            top + 2.1,
            -depth * 0.2,
          ),
        );
        group.add(
          at(
            mesh(
              new CylinderGeometry(0.02, 0.95, 2.2, 12, 1, true),
              card(
                tile(`roof:${district}`, () => roofTile(ROOFS[district]!, `roof:${district}`)),
                `roof:${district}`,
                dark,
              ),
            ),
            x,
            top + 5.3,
            -depth * 0.2,
          ),
        );
      }
      const roof = gableRoof(width, depth, district, dark);
      roof.position.y = top;
      group.add(roof);
      break;
    }
    default: {
      // A tall house with a belvedere.
      const houseTop = stack(2, width * 0.8, depth * 0.8, top);
      const roof = gableRoof(width * 0.8, depth * 0.8, district, dark);
      roof.position.y = houseTop;
      group.add(roof);
      const flag = mesh(box(0.8, 0.5, 0.02), paint('#a8473a', { side: DoubleSide }));
      group.add(at(flag, 0.4, houseTop + 2.6, 0));
      group.add(at(mesh(cylinder(0.03, 0.03, 1.6, 6), trim), 0, houseTop + 2.2, 0));
    }
  }
  return group;
}

function special(lot: LotArt, kind: string, dark: boolean): Group {
  const group = new Group();
  const white = paper(dark, 'popup-white');
  switch (kind) {
    case 'transit': {
      // A paper locomotive on its pull-tab, at the halt.
      const engine = new Group();
      const boiler = at(
        mesh(cylinder(0.75, 0.75, 3.0, 16), paint('#2b3a2a', { roughness: 0.6 })),
        0,
        1.25,
        0,
      );
      boiler.rotation.z = Math.PI / 2;
      engine.add(boiler);
      engine.add(at(mesh(box(1.4, 1.8, 1.5), paint('#2b3a2a', { roughness: 0.6 })), -1.7, 1.4, 0));
      engine.add(at(mesh(cylinder(0.25, 0.35, 1.0, 12), paint('#1d1d1d')), 1.0, 2.4, 0));
      for (const x of [-1.6, -0.4, 0.8]) {
        for (const z of [-0.8, 0.8]) {
          const wheel = mesh(cylinder(0.45, 0.45, 0.1, 18), paint('#a8473a'));
          wheel.rotation.x = Math.PI / 2;
          engine.add(at(wheel, x, 0.45, z));
        }
      }
      engine.position.set(0, 0, 1.4);
      engine.rotation.y = Math.PI / 2;
      group.add(engine);
      group.add(at(mesh(box(4.2, 0.05, 1.2), paper(dark, 'popup-tab')), 0, 0.03, 1.4));
      break;
    }
    case 'utility': {
      if (lot.frame.index === 12) {
        group.add(at(mesh(new CylinderGeometry(1.8, 1.8, 2.6, 24, 1, true), white), 0, 1.3, 1.2));
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          group.add(
            at(
              mesh(box(0.12, 3.4, 0.12), paint('#3a3442')),
              Math.cos(a) * 2.0,
              1.7,
              1.2 + Math.sin(a) * 2.0,
            ),
          );
        }
      } else {
        const s = storey(lot.frame.width - 1.2, 2.8, 4, true, dark, 3);
        group.add(at(s, 0, 0, 1.2));
        for (const x of [-1.4, 1.4])
          group.add(at(mesh(cylinder(0.06, 0.06, 4.2, 6), paint('#5a3a24')), x, 2.1, -1.2));
      }
      break;
    }
    case 'card': {
      group.add(
        at(
          mesh(cylinder(0.42, 0.45, 1.6, 16), paint('#b8322a', { roughness: 0.6 })),
          0.6,
          0.8,
          0.8,
        ),
      );
      group.add(at(mesh(sphere(0.43, 14), paint('#b8322a', { roughness: 0.6 })), 0.6, 1.6, 0.8));
      group.add(
        at(
          standee(
            tile('crier', () => cutout('person', '#6c4a80', 'crier')),
            1.1,
            1.7,
            'crier',
            dark,
            false,
          ),
          -0.8,
          0,
          0.8,
        ),
      );
      break;
    }
    case 'tax': {
      const s = storey(lot.frame.width - 1.4, 2.6, 7, false, dark, 1);
      group.add(at(s, 0, 0, 1.4));
      break;
    }
    case 'start': {
      group.add(at(storey(5.0, 3.0, 1, true, dark, 0), 0, 0, 1.4));
      group.add(
        at(
          mesh(
            box(5.4, 0.9, 0.05),
            card(
              tile('pay-day', () => labelTexture('Pay Day', '#c4952b', null)),
              'pay-day',
              dark,
            ),
          ),
          0,
          2.2,
          -0.15,
        ),
      );
      break;
    }
    case 'lockup': {
      group.add(at(storey(4.4, 3.2, 4, false, dark, 2), 0, 0, 1.4));
      group.add(
        at(
          mesh(
            sphere(0.3, 12),
            paint('#4a7aff', { emissive: new Color('#4a7aff'), emissiveIntensity: dark ? 2 : 0 }),
          ),
          0,
          1.9,
          1.4,
        ),
      );
      break;
    }
    case 'rest': {
      for (let i = 0; i < 4; i++) {
        const tree = standee(
          tile('tree:#7fae5a', () => cutout('tree', '#7fae5a', 'tree-park')),
          2.6,
          3.2,
          'tree:#7fae5a',
          dark,
        );
        group.add(at(tree, -1.8 + (i % 2) * 3.6, 0, 0.2 + Math.floor(i / 2) * 2.4));
      }
      break;
    }
    default: {
      group.add(at(storey(2.0, 2.0, 7, false, dark, 4), 0, 0, 1.4));
      const roof = mesh(
        new CylinderGeometry(0.02, 1.6, 1.4, 4, 1, true),
        paint('#3a3442', { side: DoubleSide }),
      );
      roof.rotation.y = Math.PI / 4;
      group.add(at(roof, 0, STOREY + 0.7, 1.4));
    }
  }
  return group;
}

// —— the signature: the landmark folds up out of the page with a flick of paper confetti ——

function foldUp(centre: Vector3, yaw: number, seconds: number): Group {
  const group = new Group();
  group.position.copy(centre);
  group.rotation.y = yaw;
  const t = Math.min(1, seconds / 1.6);
  const rng = createRng('popup-confetti');
  const colours = ['#a8473a', '#c4952b', '#5f8a4c', '#2f5585', '#bf6a80', '#6c4a80', PAPER];
  for (let i = 0; i < 90; i++) {
    const piece = new Mesh(
      new PlaneGeometry(0.62, 0.4),
      paint(rng.pick(colours), { side: DoubleSide, roughness: 0.9 }),
    );
    const a = rng.next() * Math.PI * 2;
    const reach = 2 + rng.next() * 7;
    const lift = 4 + rng.next() * 9;
    const arc = Math.sin(Math.min(1, t * 1.1) * Math.PI * 0.85);
    piece.position.set(Math.cos(a) * reach * t, 1 + lift * arc, 0.9 + Math.sin(a) * reach * t);
    piece.rotation.set(rng.next() * 6 + t * 5, rng.next() * 6, rng.next() * 6 + t * 3);
    piece.castShadow = true;
    group.add(piece);
  }
  return group;
}
