import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  PMREMGenerator,
  Points,
  PointsMaterial,
  RepeatWrapping,
  RingGeometry,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  type WebGLRenderer,
} from 'three';
import { createRng } from '@usr-games/kit';
import { colonyWeather } from '../world/weather';
import { LAYOUT } from '../../boards/layout';
import { BOARDS } from '../../boards/themes';
import { at, box, cylinder, mesh, paint, roundedBox, sphere } from '../world/kit3d';
import { LOT_DEPTH } from '../world/lots';
import { RING_INNER, RING_LAYOUT, RING_ROAD } from '../world/ring';
import { glowTexture, lamps, people, traffic, trees } from '../world/scenery';
import { noiseTexture, signTexture } from '../world/textures';
import { tokenModel } from '../world/tokens';
import type { ArtContext, BoardArt, LotArt } from '../world/world';
import {
  colonyGlow,
  colonyHull,
  colonyLandmark,
  habitat,
  habitatHeight,
  shuttle,
} from './colony-buildings';
import { constructionKit, ownerFlag, saleBoard } from './common';
import { diceTray } from './dice';

/**
 * Ring Colony: a settlement round a ring road on the flat top of an asteroid, a glass dome over
 * the park in the middle, a ringed gas giant hanging in the sky. The light look is the sunlit
 * side, under a blue haze of reflected planet light; the dark look is the night side, where the
 * domes glow and an aurora curtains the horizon.
 */

const DECK = RING_ROAD + LOT_DEPTH + 4.4;
/** The glass dome over the plaza in the middle of the park. */
const PLAZA_DOME = 6.4;

interface Palette {
  sky: [string, string, string];
  fog: string;
  deck: string;
  road: string;
  rock: string;
  rockDark: string;
  pad: string;
  sign: { paper: string; ink: string };
  grass: string;
}

const SUNLIT: Palette = {
  sky: ['#03061a', '#0c1a46', '#27407a'],
  fog: '#1a2a5a',
  deck: '#d7dce6',
  road: '#4a5266',
  rock: '#a07a5a',
  rockDark: '#6a4e3a',
  pad: '#c3cad8',
  sign: { paper: '#f4f7ff', ink: '#161c3a' },
  grass: '#7ccf6a',
};

const NIGHT: Palette = {
  sky: ['#010208', '#060a22', '#1a1440'],
  fog: '#0e0c2a',
  deck: '#3c4258',
  road: '#1a1d2a',
  rock: '#4a3e46',
  rockDark: '#2a2128',
  pad: '#4a5168',
  sign: { paper: '#141a34', ink: '#eef1ff' },
  grass: '#2a5a3a',
};

export function createColonyArt(): BoardArt {
  let movers: ((seconds: number, elapsed: number) => void)[] = [];
  const spinners: Object3D[] = [];
  const art: BoardArt = {
    theme: BOARDS.colony,
    layout: RING_LAYOUT,
    // On the lawn beyond the dome, behind the dice as the table's camera sees them.
    statueSpot: new Vector3(0, 0.12, -8.6),
    landmarkShot: { height: 8, distance: 64, elevation: 0.28 },
    followShot: { distance: 44, elevation: 0.74, outward: 3 },
    weather: () => colonyWeather(),

    look(dark) {
      return dark
        ? {
            tiltShift: { focus: 0.5, band: 0.11, ramp: 0.3, maxBlur: 9 },
            grade: { saturation: 1.15, contrast: 1.08, vignette: 0.36, tint: [0.98, 0.98, 1.06] },
            bloom: 0.75,
            exposure: 1.45,
          }
        : {
            tiltShift: { focus: 0.48, band: 0.12, ramp: 0.3, maxBlur: 8 },
            grade: { saturation: 1.12, contrast: 1.06, vignette: 0.26, tint: [1.0, 1.0, 1.02] },
            bloom: 0.35,
            exposure: 1.05,
          };
    },

    setup(context) {
      movers = [];
      spinners.length = 0;
      const { scenery, stage, dark } = context;
      const palette = dark ? NIGHT : SUNLIT;
      const scene = stage.scene;
      scene.background = new Color(palette.sky[0]);
      scene.fog = null;
      scene.environment = environment(stage.renderer, palette, dark);
      scenery.add(sky(palette), stars(dark), planet(dark), sunGlow(dark));
      if (dark) scenery.add(aurora(movers));
      lights(scenery, dark);
      scenery.add(asteroid(palette), boulders(palette));
      deck(scenery, palette, dark);
      park(scenery, palette, dark);
      const rovers = traffic(
        RING_LAYOUT,
        16,
        {
          vehicle: 'rover',
          bodies: ['#f4f6fa', '#e94f37', '#ffd23f', '#2fb3d6'],
          cabin: dark ? '#0b0f18' : '#2a3f6a',
          wheel: '#1d1f24',
          dark,
        },
        'colony-rovers',
      );
      scenery.add(rovers.group);
      movers.push((s) => rovers.update(s));
      const crew = people(
        RING_LAYOUT,
        50,
        {
          clothes: ['#f4f6fa', '#ffd23f', '#e94f37', '#2fb3d6', '#9a7bd8'],
          skin: ['#f1c7a3', '#d79f78', '#a8704f', '#6e4630'],
        },
        'colony-crew',
        [2.25, -2.2],
      );
      scenery.add(crew.group);
      movers.push((s, e) => crew.update(s, e));
      movers.push((s) => {
        for (const spinner of spinners) spinner.rotation.y += s * 0.4;
      });
    },

    lot(context, lot) {
      const object = colonyLot(context, lot);
      object.traverse((child) => {
        if (child.name === 'spin') spinners.push(child);
      });
      return object;
    },

    token(_context, id, colour) {
      return tokenModel(id, colour);
    },

    animate(_context, seconds, elapsed) {
      for (const move of movers) move(seconds, elapsed);
    },

    signature(context, lot, seconds) {
      return domeLights(context.dark, lot.centre, lot.yaw, seconds);
    },
  };
  return art;
}

// —— space ——

function sky(palette: Palette): Mesh {
  const geometry = new SphereGeometry(460, 32, 16);
  const [top, middle, horizon] = palette.sky.map((c) => new Color(c));
  const colours: number[] = [];
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i) / 460;
    const c =
      y > 0.1
        ? middle!.clone().lerp(top!, Math.min(1, (y - 0.1) / 0.6))
        : horizon!.clone().lerp(middle!, Math.max(0, (y + 0.3) / 0.4));
    colours.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colours), 3));
  return new Mesh(
    geometry,
    new MeshBasicMaterial({ vertexColors: true, side: BackSide, depthWrite: false }),
  );
}

function stars(dark: boolean): Points {
  const rng = createRng('colony-stars');
  const count = 2600;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = rng.next() * 2 - 1;
    const a = rng.next() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    const y = Math.abs(u) * 0.9 + 0.05;
    positions.set([r * Math.cos(a) * 420, y * 420 - 40, r * Math.sin(a) * 420], i * 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  return new Points(
    geometry,
    new PointsMaterial({
      color: '#ffffff',
      size: dark ? 1.8 : 1.5,
      map: glowTexture(),
      transparent: true,
      opacity: dark ? 0.9 : 0.7,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
}

/** The sun, low over the horizon by day; a far, faint star by night. */
function sunGlow(dark: boolean): Mesh {
  const glow = new Mesh(
    new PlaneGeometry(90, 90),
    new MeshBasicMaterial({
      map: glowTexture(),
      color: dark ? '#8fa6ff' : '#fff2d6',
      transparent: true,
      opacity: dark ? 0.25 : 0.9,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  glow.position.set(260, 120, 180);
  glow.lookAt(0, 0, 0);
  return glow;
}

function bandTexture(): CanvasTexture {
  const element = document.createElement('canvas');
  element.width = 16;
  element.height = 512;
  const ctx = element.getContext('2d')!;
  const bands = [
    '#e8c39a',
    '#d89a6a',
    '#f2dcc0',
    '#c97a52',
    '#e9b98c',
    '#b8673f',
    '#f4e2c8',
    '#d9a275',
    '#c88a5c',
  ];
  const rng = createRng('colony-planet');
  let y = 0;
  while (y < 512) {
    const h = 14 + rng.next() * 46;
    ctx.fillStyle = rng.pick(bands);
    ctx.fillRect(0, y, 16, h);
    y += h;
  }
  const map = new CanvasTexture(element);
  map.colorSpace = SRGBColorSpace;
  return map;
}

function planet(dark: boolean): Group {
  const group = new Group();
  const body = new Mesh(
    new SphereGeometry(95, 48, 32),
    new MeshStandardMaterial({
      map: bandTexture(),
      roughness: 0.9,
      emissive: new Color(dark ? '#3a2a40' : '#000000'),
      emissiveIntensity: dark ? 0.25 : 0,
    }),
  );
  group.add(body);
  const ringMap = (() => {
    const element = document.createElement('canvas');
    element.width = 256;
    element.height = 4;
    const ctx = element.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 256, 0);
    gradient.addColorStop(0, 'rgba(240,220,190,0)');
    gradient.addColorStop(0.2, 'rgba(240,220,190,0.75)');
    gradient.addColorStop(0.45, 'rgba(200,170,140,0.35)');
    gradient.addColorStop(0.6, 'rgba(240,220,190,0.8)');
    gradient.addColorStop(1, 'rgba(240,220,190,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 4);
    const map = new CanvasTexture(element);
    map.colorSpace = SRGBColorSpace;
    return map;
  })();
  const ringGeometry = new RingGeometry(120, 190, 96, 1);
  // Map the ring texture across the band, inner to outer edge.
  const pos = ringGeometry.attributes.position!;
  const uv = ringGeometry.attributes.uv!;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    uv.setXY(i, (r - 120) / 70, 0.5);
  }
  const ring = new Mesh(
    ringGeometry,
    new MeshBasicMaterial({
      map: ringMap,
      transparent: true,
      side: DoubleSide,
      depthWrite: false,
      opacity: dark ? 0.55 : 0.85,
    }),
  );
  ring.rotation.x = -Math.PI / 2 + 0.35;
  group.add(ring);
  group.position.set(-205, -8, -205);
  group.rotation.z = 0.25;
  return group;
}

function aurora(movers: ((s: number, e: number) => void)[]): Group {
  const group = new Group();
  const element = document.createElement('canvas');
  element.width = 8;
  element.height = 128;
  const ctx = element.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 0, 128);
  gradient.addColorStop(0, 'rgba(120,80,255,0)');
  gradient.addColorStop(0.45, 'rgba(90,255,190,0.65)');
  gradient.addColorStop(1, 'rgba(60,200,160,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 8, 128);
  const map = new CanvasTexture(element);
  const curtains: Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const geometry = new PlaneGeometry(360, 60, 48, 1);
    const position = geometry.attributes.position!;
    for (let k = 0; k < position.count; k++) {
      const x = position.getX(k);
      position.setZ(k, Math.sin(x / 40 + i) * 18);
    }
    const curtain = new Mesh(
      geometry,
      new MeshBasicMaterial({
        map,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        opacity: 0.55 - i * 0.12,
      }),
    );
    curtain.position.set(i * 30 - 30, 40 + i * 8, -180 - i * 20);
    group.add(curtain);
    curtains.push(curtain);
  }
  movers.push((_s, e) =>
    curtains.forEach((c, i) => (c.position.x = Math.sin(e * 0.05 + i) * 20 + i * 30 - 30)),
  );
  return group;
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
    w = 80,
    h = 40,
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
    panel('#5affc0', 1.2, 0, 60, -200, 200, 40);
    panel('#8f6bff', 1.0, -180, 40, 60);
  } else {
    panel('#fff6e6', 7, 160, 120, 80, 50, 50);
    panel('#e8b08a', 1.5, -150, 70, -330, 120, 120);
  }
  const pmrem = new PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.03);
  pmrem.dispose();
  return target.texture;
}

function lights(scenery: Group, dark: boolean): void {
  const sun = new DirectionalLight(dark ? '#9fb2ff' : '#fff3e0', dark ? 0.7 : 3.0);
  sun.position.set(60, 55, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const camera = sun.shadow.camera;
  camera.left = camera.bottom = -42;
  camera.right = camera.top = 42;
  camera.near = 10;
  camera.far = 220;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scenery.add(sun, sun.target);
  scenery.add(
    new HemisphereLight(
      dark ? '#5a62c8' : '#9fc4ff',
      dark ? '#2a2030' : '#8a6a52',
      dark ? 1.4 : 0.9,
    ),
  );
}

// —— the asteroid and the deck ——

function asteroid(palette: Palette): Mesh {
  const geometry = new IcosahedronGeometry(1, 5);
  const position = geometry.attributes.position!;
  const rng = createRng('colony-rock');
  const bumps = Array.from({ length: 18 }, () => ({
    dir: new Vector3(rng.next() * 2 - 1, rng.next() * 2 - 1, rng.next() * 2 - 1).normalize(),
    size: 0.2 + rng.next() * 0.35,
    depth: 0.04 + rng.next() * 0.08,
  }));
  const v = new Vector3();
  const radius = 58;
  const centreY = -45;
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i).normalize();
    let r = 1 + Math.sin(v.x * 5.1) * 0.03 + Math.sin(v.z * 4.3 + v.y * 2) * 0.04;
    for (const bump of bumps) {
      const d = v.distanceTo(bump.dir);
      if (d < bump.size) r -= bump.depth * Math.cos((d / bump.size) * (Math.PI / 2));
    }
    v.multiplyScalar(r * radius);
    v.x *= 1.25;
    v.z *= 1.15;
    v.y += centreY;
    // The colony's plateau: everything above it is cut flat.
    if (v.y > -1.2) v.y = -1.2 - Math.abs(Math.sin(v.x * 0.3) * 0.2);
    position.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  const rock = new Mesh(
    geometry,
    new MeshStandardMaterial({
      color: palette.rock,
      roughness: 0.95,
      flatShading: true,
      map: noiseTexture('colony-rock', { scale: 12, contrast: 1.4 }),
    }),
  );
  rock.receiveShadow = true;
  rock.castShadow = false;
  return rock;
}

/** Rocks and pebbles strewn round the deck, and a few craters' rims. */
function boulders(palette: Palette): Group {
  const group = new Group();
  const rng = createRng('colony-boulders');
  for (let i = 0; i < 60; i++) {
    const a = rng.next() * Math.PI * 2;
    const r = DECK + 1.2 + rng.next() * 7;
    const size = 0.5 + rng.next() * rng.next() * 3.2;
    const rock = mesh(
      new IcosahedronGeometry(size, 0),
      paint(rng.chance(0.5) ? palette.rock : palette.rockDark, { flatShading: true, roughness: 1 }),
    );
    rock.position.set(Math.cos(a) * r, -1.2 + size * 0.3, Math.sin(a) * r);
    rock.rotation.set(rng.next() * 3, rng.next() * 3, rng.next() * 3);
    group.add(rock);
  }
  return group;
}

function ringMesh(
  inner: number,
  outer: number,
  material: MeshStandardMaterial | MeshBasicMaterial,
  y: number,
): Mesh {
  const m = new Mesh(new RingGeometry(inner, outer, 160, 1), material);
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.receiveShadow = true;
  return m;
}

function plateTexture(dark: boolean): CanvasTexture {
  const element = document.createElement('canvas');
  element.width = element.height = 256;
  const ctx = element.getContext('2d')!;
  ctx.fillStyle = dark ? '#3c4258' : '#d7dce6';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = dark ? 'rgba(10,12,30,0.6)' : 'rgba(80,90,110,0.35)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 256; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }
  ctx.fillStyle = dark ? 'rgba(120,140,200,0.25)' : 'rgba(255,255,255,0.4)';
  for (let x = 8; x < 256; x += 64) for (let y = 8; y < 256; y += 64) ctx.fillRect(x, y, 4, 4);
  const map = new CanvasTexture(element);
  map.colorSpace = SRGBColorSpace;
  map.wrapS = map.wrapT = RepeatWrapping;
  map.repeat.set(14, 14);
  return map;
}

function deck(scenery: Group, palette: Palette, dark: boolean): void {
  const plates = new MeshStandardMaterial({
    color: '#ffffff',
    map: plateTexture(dark),
    roughness: 0.55,
    metalness: 0.35,
  });
  const side = new MeshStandardMaterial({ color: palette.pad, metalness: 0.5, roughness: 0.4 });
  const disc = new Mesh(new CylinderGeometry(DECK, DECK + 0.6, 1.1, 96), [side, plates, plates]);
  disc.receiveShadow = true;
  scenery.add(at(disc, 0, -0.5, 0));
  // The rim: a lit edge all the way round.
  scenery.add(ringMesh(DECK - 0.5, DECK - 0.1, colonyGlow('#5fd3ff', dark, 2.4), 0.06));
  const asphalt = new MeshStandardMaterial({
    color: palette.road,
    roughness: dark ? 0.25 : 0.6,
    metalness: 0.5,
  });
  scenery.add(ringMesh(RING_ROAD - 1.7, RING_ROAD + 1.7, asphalt, 0.07));
  const guide = colonyGlow('#5fd3ff', dark, 2.6);
  scenery.add(
    ringMesh(RING_ROAD + 1.55, RING_ROAD + 1.72, guide, 0.09),
    ringMesh(RING_ROAD - 1.72, RING_ROAD - 1.55, guide, 0.09),
  );
  // Dashes down the middle of the ring road.
  const dash = colonyGlow('#e8ecff', dark, 1.2);
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    const piece = mesh(box(0.1, 0.02, 0.8), dash, { cast: false });
    piece.position.set(Math.cos(a) * RING_ROAD, 0.09, Math.sin(a) * RING_ROAD);
    piece.rotation.y = -a;
    scenery.add(piece);
  }
  // Lamps along the outer kerb.
  const lampSpots = Array.from({ length: 40 }, (_, i) => {
    const a = Math.PI / 4 + ((i + 0.5) / 40) * Math.PI * 2;
    return new Vector3(Math.cos(a) * (RING_ROAD + 1.95), 0.05, Math.sin(a) * (RING_ROAD + 1.95));
  });
  scenery.add(lamps(lampSpots, { post: '#9aa3b8', light: '#9fe8ff', height: 1.5 }, dark));
}

// —— the park under the dome ——

function park(scenery: Group, palette: Palette, dark: boolean): void {
  const lawn = new Mesh(
    new CylinderGeometry(RING_INNER - 0.25, RING_INNER - 0.25, 0.2, 96),
    new MeshStandardMaterial({ color: palette.grass, roughness: 0.95 }),
  );
  lawn.position.y = 0.0;
  lawn.receiveShadow = true;
  scenery.add(lawn);
  scenery.add(ringMesh(RING_INNER - 0.3, RING_INNER, paint(dark ? '#5a6278' : '#c9d0dc'), 0.12));
  // Paths in a star from the plaza.
  const path = paint(dark ? '#4a5168' : '#eef1f6', { roughness: 0.8 });
  for (let i = 0; i < 4; i++) {
    const strip = mesh(box(RING_INNER * 2 - 1, 0.04, 1.3), path, { cast: false });
    strip.rotation.y = (i * Math.PI) / 4;
    scenery.add(at(strip, 0, 0.12, 0));
  }
  scenery.add(at(mesh(cylinder(5.2, 5.2, 0.06, 48), path), 0, 0.13, 0));
  scenery.add(diceTray(dark));
  const rng = createRng('colony-park');
  const spots: Vector3[] = [];
  while (spots.length < 34) {
    const a = rng.next() * Math.PI * 2;
    const r = 6.5 + rng.next() * (RING_INNER - 8.5);
    const p = new Vector3(Math.cos(a) * r, 0.1, Math.sin(a) * r);
    if ((((a + Math.PI / 8) % (Math.PI / 4)) + Math.PI / 4) % (Math.PI / 4) < 0.18) continue;
    spots.push(p);
  }
  scenery.add(
    trees(
      spots,
      {
        trunk: '#6b4a2f',
        crowns: dark
          ? ['#1f5a3a', '#2a6a4a', '#3a4a7a']
          : ['#5ac46a', '#8fd85a', '#3fb07a', '#c0e86a'],
      },
      'colony-trees',
    ),
  );
  // A small glass dome over the plaza, the dice tray inside it.
  const glassDome = new Mesh(
    new SphereGeometry(PLAZA_DOME, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2),
    new MeshStandardMaterial({
      color: '#d8f2ff',
      transparent: true,
      opacity: dark ? 0.1 : 0.14,
      roughness: 0.02,
      metalness: 0.25,
      side: DoubleSide,
      depthWrite: false,
      envMapIntensity: 2.2,
    }),
  );
  glassDome.scale.y = 0.62;
  scenery.add(glassDome);
  const rib = paint(dark ? '#c9d2ff' : '#f4f7ff', {
    metalness: 0.7,
    roughness: 0.25,
    emissive: new Color('#7f9cff'),
    emissiveIntensity: dark ? 0.5 : 0,
  });
  for (let i = 0; i < 6; i++) {
    const arc = mesh(new TorusGeometry(PLAZA_DOME, 0.06, 6, 40, Math.PI), rib, { cast: false });
    arc.scale.set(1, 0.62, 1);
    arc.rotation.y = (i / 6) * Math.PI;
    scenery.add(arc);
  }
  const foot = mesh(new TorusGeometry(PLAZA_DOME, 0.14, 8, 64), colonyGlow('#5fd3ff', dark, 2.2), {
    cast: false,
  });
  foot.rotation.x = Math.PI / 2;
  foot.position.y = 0.16;
  scenery.add(foot);
  // Lamps in the garden, so the park glows under the dome at night.
  scenery.add(
    lamps(
      [5.6, -5.6]
        .flatMap((x) => [5.6, -5.6].map((z) => new Vector3(x, 0.1, z)))
        .concat([
          new Vector3(0, 0.1, 10),
          new Vector3(0, 0.1, -10),
          new Vector3(10, 0.1, 0),
          new Vector3(-10, 0.1, 0),
        ]),
      { post: '#9aa3b8', light: '#ffe7a8', height: 1.4 },
      dark,
    ),
  );
}

// —— a lot ——

function colonyLot(context: ArtContext, lot: LotArt): Object3D {
  const { dark, theme } = context;
  const palette = dark ? NIGHT : SUNLIT;
  const group = new Group();
  const slot = LAYOUT[lot.frame.index]!;
  const { width, depth } = lot.frame;
  const accent = lot.group !== null ? theme.groups[lot.group]!.colour : '#5fd3ff';
  const wash =
    lot.group !== null
      ? new Color(palette.pad).lerp(new Color(accent), dark ? 0.2 : 0.28).getStyle()
      : palette.pad;
  group.add(
    at(
      mesh(
        roundedBox(width - 0.25, 0.18, depth - 0.3, 0.12),
        paint(wash, { roughness: 0.45, metalness: 0.4 }),
      ),
      0,
      0.09,
      0.05,
    ),
  );
  group.add(
    at(
      mesh(box(width - 0.4, 0.05, 0.14), colonyGlow(accent, dark, 2.2), { cast: false }),
      0,
      0.2,
      -depth / 2 + 0.25,
    ),
  );
  const sign = signBoard(
    theme.spaces[lot.frame.index]!,
    accent,
    palette,
    theme.displayFont,
    dark,
    slot.kind,
  );
  sign.position.set(0, 0, -depth / 2 + 0.85);
  group.add(sign);
  const front = -depth / 2;
  if (slot.kind === 'street') {
    if (lot.owner === null) {
      group.add(at(saleBoard(dark), width / 2 - 0.8, 0, 0.3, -0.3));
      group.add(crates(width, depth, dark, lot.frame.index));
    } else {
      group.add(
        at(
          ownerFlag(lot.ownerColour!, lot.ownerToken ?? 'rover', dark, lot.honour),
          -width / 2 + 0.5,
          0,
          front + 1.6,
        ),
      );
      const building = colonyBuilding(lot, dark, accent);
      if (building) group.add(building);
    }
  } else {
    group.add(colonySpecial(lot, slot.kind, dark, accent));
    if (lot.owner !== null && lot.ownerColour)
      group.add(
        at(
          ownerFlag(lot.ownerColour, lot.ownerToken ?? 'rover', dark, lot.honour),
          -width / 2 + 0.5,
          0,
          front + 1.6,
        ),
      );
  }
  return group;
}

/** Cargo crates waiting on a vacant lot. */
function crates(width: number, depth: number, dark: boolean, index: number): Group {
  const group = new Group();
  const rng = createRng(`colony-crates-${index}`);
  const colours = dark
    ? ['#4a5a7a', '#6a5a4a', '#3a4a5a']
    : ['#e9b04a', '#5aa0d8', '#e06b4a', '#c9d0dc'];
  for (let i = 0; i < 3; i++) {
    const size = 0.6 + rng.next() * 0.5;
    const crate = mesh(
      roundedBox(size, size * 0.8, size, 0.06),
      paint(rng.pick(colours), { roughness: 0.6 }),
    );
    group.add(
      at(
        crate,
        (rng.next() - 0.5) * (width - 1.8),
        size * 0.4 + 0.18,
        0.4 + rng.next() * (depth - 3.4),
        rng.next() * 3,
      ),
    );
  }
  return group;
}

function colonyBuilding(lot: LotArt, dark: boolean, accent: string): Group | null {
  if (lot.level === 0) return null;
  const group = new Group();
  group.position.z = 0.9;
  const finished = lot.progress >= 1 ? lot.level : lot.level - 1;
  const options = {
    group: lot.group ?? 0,
    level: finished,
    width: lot.frame.width - 0.6,
    depth: lot.frame.depth - 2.4,
    dark,
    accent,
    seed: `colony-lot-${lot.frame.index}`,
  };
  if (finished >= 5) group.add(colonyLandmark(options));
  else if (finished >= 1) group.add(habitat(options));
  if (lot.progress < 1)
    group.add(
      constructionKit({
        width: options.width,
        depth: options.depth,
        from: habitatHeight(finished),
        to: habitatHeight(lot.level),
        progress: lot.progress,
        dark,
        accent,
      }),
    );
  return group;
}

function colonySpecial(lot: LotArt, kind: string, dark: boolean, accent: string): Group {
  const group = new Group();
  switch (kind) {
    case 'transit': {
      group.add(
        at(
          mesh(
            cylinder(2.1, 2.2, 0.3, 32),
            paint(dark ? '#4a5168' : '#e3e7ef', { metalness: 0.4 }),
          ),
          0,
          0.3,
          0.9,
        ),
      );
      const ring = mesh(new TorusGeometry(1.8, 0.07, 6, 40), colonyGlow('#ffd23f', dark, 2.4));
      ring.rotation.x = Math.PI / 2;
      group.add(at(ring, 0, 0.48, 0.9));
      const craft = shuttle(dark);
      craft.rotation.y = 0.6;
      group.add(at(craft, 0, 0.45, 0.9));
      break;
    }
    case 'utility': {
      if (lot.frame.index === 12) {
        for (let i = 0; i < 4; i++) {
          const panel = mesh(
            box(1.4, 0.05, 0.9),
            paint('#26408a', { roughness: 0.2, metalness: 0.7 }),
          );
          panel.rotation.x = -0.55;
          group.add(at(panel, -0.75 + (i % 2) * 1.5, 0.9, 0.2 + Math.floor(i / 2) * 1.6));
          group.add(
            at(
              mesh(cylinder(0.04, 0.04, 0.8, 6), colonyHull(dark)),
              -0.75 + (i % 2) * 1.5,
              0.45,
              0.2 + Math.floor(i / 2) * 1.6,
            ),
          );
        }
      } else {
        group.add(at(mesh(cylinder(1.0, 1.1, 2.6, 20), colonyHull(dark)), 0, 1.3, 1.0));
        group.add(
          at(
            mesh(
              new IcosahedronGeometry(0.9, 0),
              new MeshStandardMaterial({
                color: '#bfefff',
                transparent: true,
                opacity: 0.8,
                roughness: 0.05,
                emissive: new Color('#7fd8ff'),
                emissiveIntensity: dark ? 1.2 : 0.1,
              }),
            ),
            0,
            3.1,
            1.0,
          ),
        );
      }
      break;
    }
    case 'card': {
      const dish = mesh(
        new SphereGeometry(0.9, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.4),
        paint('#eef1f6', { side: DoubleSide, metalness: 0.4 }),
      );
      dish.rotation.x = -2.2;
      group.add(at(dish, 0, 2.0, 0.8));
      group.add(at(mesh(cylinder(0.08, 0.12, 1.8, 8), colonyHull(dark)), 0, 0.9, 0.8));
      group.add(at(mesh(sphere(0.12, 10), colonyGlow(accent, dark, 3)), 0, 2.1, 0.5));
      break;
    }
    case 'tax': {
      group.add(at(mesh(roundedBox(1.6, 1.8, 1.4, 0.2), colonyHull(dark)), 0, 0.9, 0.9));
      group.add(at(mesh(cylinder(0.35, 0.35, 1.8, 14), paint('#e94f37')), 1.2, 0.9, 0.9));
      break;
    }
    case 'start': {
      const arch = mesh(new TorusGeometry(2.2, 0.22, 10, 32, Math.PI), colonyHull(dark));
      group.add(at(arch, 0, 0.2, 0.6));
      const coin = at(
        mesh(cylinder(0.7, 0.7, 0.1, 24), colonyGlow('#ffd23f', dark, 2.6)),
        0,
        2.5,
        0.6,
      );
      coin.rotation.x = Math.PI / 2;
      coin.name = 'spin';
      group.add(coin);
      break;
    }
    case 'lockup': {
      group.add(
        at(mesh(roundedBox(3.4, 2.2, 3.0, 0.4), paint(dark ? '#4a3a2a' : '#f2e2c8')), 0, 1.1, 1.0),
      );
      for (let i = 0; i < 4; i++)
        group.add(
          at(
            mesh(box(3.45, 0.2, 0.05), paint(i % 2 ? '#1d1f24' : '#ffb000')),
            0,
            0.5 + i * 0.4,
            -0.52,
          ),
        );
      group.add(at(mesh(sphere(0.25, 12), colonyGlow('#ffb000', dark, 3)), 0, 2.4, 1.0));
      break;
    }
    case 'rest': {
      for (let i = 0; i < 5; i++) {
        const ball = mesh(
          sphere(0.35 + (i % 3) * 0.12, 16),
          paint(['#ff6b4a', '#ffd23f', '#2fb3d6', '#e06bb2', '#46b95f'][i]!, { roughness: 0.4 }),
        );
        group.add(at(ball, -1.4 + i * 0.7, 1.4 + Math.sin(i * 1.7) * 0.9, 0.6 + (i % 2) * 1.2));
      }
      group.add(
        at(mesh(cylinder(2.2, 2.2, 0.1, 32), paint('#7ccf6a', { roughness: 0.9 })), 0, 0.25, 1),
      );
      break;
    }
    default: {
      group.add(at(mesh(roundedBox(3.2, 3.0, 1.2, 0.3), colonyHull(dark)), 0, 1.5, 1.2));
      group.add(at(mesh(roundedBox(2.0, 2.2, 1.24, 0.2), paint('#2b2f3a')), 0, 1.3, 1.2));
      group.add(at(mesh(sphere(0.25, 12), colonyGlow('#ff3a3a', dark, 3)), 0, 3.2, 1.2));
    }
  }
  return group;
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
  const labels: Record<string, string> = {
    transit: 'SHUTTLE PAD',
    utility: 'UTILITY',
    card: 'DRAW A CARD',
    tax: 'PAY',
    start: 'COLLECT PAY',
    lockup: 'QUARANTINE',
    toLockup: 'TO QUARANTINE',
    rest: 'REST',
  };
  const map = signTexture(name, {
    font,
    band,
    paper: palette.sign.paper,
    ink: palette.sign.ink,
    bandText: kind === 'street' ? undefined : labels[kind],
  });
  const frame = colonyHull(dark);
  const face = new Mesh(box(2.4, 0.9, 0.07), [
    frame,
    frame,
    frame,
    frame,
    new MeshStandardMaterial({
      map,
      roughness: 0.5,
      emissiveMap: map,
      emissive: new Color(dark ? '#ffffff' : '#000000'),
      emissiveIntensity: dark ? 0.5 : 0,
    }),
    frame,
  ]);
  face.position.set(0, 1.35, 0);
  face.castShadow = true;
  group.add(face);
  group.add(at(mesh(cylinder(0.05, 0.05, 0.95), frame), 0, 0.47, 0));
  group.name = 'sign';
  return group;
}

// —— the signature: a landmark's dome lights up and a shuttle lands beside it ——

function domeLights(dark: boolean, centre: Vector3, yaw: number, seconds: number): Group {
  const group = new Group();
  group.position.copy(centre);
  group.rotation.y = yaw;
  const t = Math.min(1, seconds / 2.0);
  const glow = (colour: string, opacity: number) =>
    new MeshBasicMaterial({
      color: colour,
      transparent: true,
      opacity,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    });
  // The landmark lights up: a pulse of light swelling over it and a beam to the sky.
  const pulse = new Mesh(
    new SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    glow('#9fe8ff', (dark ? 0.12 : 0.2) * (1 - t * 0.6)),
  );
  pulse.scale.set(3 + t * 4, (3 + t * 4) * 0.9, 3 + t * 4);
  pulse.position.set(0, 0.2, 0.9);
  group.add(pulse);
  const beam = new Mesh(
    new CylinderGeometry(0.6, 1.4, 38, 24, 1, true),
    glow('#bfefff', dark ? 0.1 : 0.16),
  );
  beam.position.set(0, 19, 0.9);
  group.add(beam);
  const halo = new Mesh(
    new RingGeometry(2.2, 8.5, 64),
    new MeshBasicMaterial({
      map: glowTexture(),
      color: '#9fe8ff',
      transparent: true,
      opacity: dark ? 0.3 : 0.55,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.set(0, 0.32, 0.9);
  group.add(halo);
  // The shuttle coming in to land beside it, thrusters bright, landing beam on the pad.
  const craft = shuttle(dark, '#ffd23f');
  const height = 1.2 + Math.max(0, 1 - t) * 11;
  craft.scale.setScalar(1.25);
  craft.position.set(-5.6, height, -1.5);
  craft.rotation.set(0, 0.25, 0.06);
  group.add(craft);
  const flame = new Mesh(new CylinderGeometry(0.15, 1.1, 3.2, 16, 1, true), glow('#ffb04a', 0.75));
  flame.position.set(-5.6, height - 1.1, -1.5);
  group.add(flame);
  const landing = new Mesh(
    new CylinderGeometry(0.6, 2.6, height, 24, 1, true),
    glow('#bfe8ff', dark ? 0.08 : 0.12),
  );
  landing.position.set(-5.6, height / 2, -1.5);
  group.add(landing);
  // Motes of light rising round the landmark.
  const rng = createRng('colony-sparkle');
  for (let i = 0; i < 40; i++) {
    const a = rng.next() * Math.PI * 2;
    const r = 2.5 + rng.next() * 3.5;
    const mote = mesh(
      sphere(0.12 + rng.next() * 0.12, 6),
      paint('#ffffff', {
        emissive: new Color(rng.pick(['#9fe8ff', '#ffd23f', '#ff8fc4'])),
        emissiveIntensity: dark ? 1.6 : 3,
      }),
      { cast: false },
    );
    mote.position.set(Math.cos(a) * r, 1 + rng.next() * 12 * t, 0.9 + Math.sin(a) * r);
    group.add(mote);
  }
  return group;
}
