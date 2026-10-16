import {
  BufferGeometry,
  CapsuleGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
} from 'three';
import type { createRng } from '@usr-games/kit';
import { type HullSpec, deckHeight, hullGeometry } from '../world/hulls';
import { at, box, cylinder, mesh, paint, roundedBox, sphere } from '../world/kit3d';

/**
 * The harbour's boats: yachts out on the water and a ferry at each pier. Each is built to read
 * as what it is from the far side of the board: a yacht by its pointed white hull and two
 * triangular sails, a ferry by its stepped white decks, a funnel and lifeboats. Bows point +x.
 */

const hullPaint = () => paint('#ffffff', { roughness: 0.42, vertexColors: true });

/**
 * A sail: a triangle with a little belly, fanned from a point pushed off to one side so it
 * catches the light like filled cloth rather than a flat sign.
 */
function sailGeometry(corners: readonly [number, number][], belly: number): BufferGeometry {
  const cx = corners.reduce((sum, [x]) => sum + x, 0) / 3;
  const cy = corners.reduce((sum, [, y]) => sum + y, 0) / 3;
  const positions: number[] = [];
  corners.forEach(([ax, ay], i) => {
    const [bx, by] = corners[(i + 1) % 3]!;
    positions.push(cx, cy, belly, ax, ay, 0, bx, by, 0);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

const YACHT_STRIPES = ['#2e86de', '#e94f37', '#f4c430', '#14a39b'] as const;

function yachtHull(stripe: string): HullSpec {
  return {
    length: 3.0,
    beam: 1.0,
    freeboard: 0.36,
    draught: 0.3,
    sheer: 0.18,
    shoulder: 0.46,
    transom: 0.55,
    bands: [
      { colour: '#2b3440', to: 0.02 },
      { colour: '#f7f5ef', belowDeck: 0.1 },
      { colour: stripe },
    ],
    deck: '#c9a678',
  };
}

export function sailboat(dark: boolean, rng: ReturnType<typeof createRng>): Group {
  const stripe = rng.pick(YACHT_STRIPES);
  const spec = yachtHull(stripe);
  const boat = new Group();
  boat.add(mesh(hullGeometry(spec), hullPaint()));
  const mastX = 0.3;
  const deck = deckHeight(spec, mastX);
  boat.add(at(mesh(roundedBox(0.95, 0.2, 0.6, 0.07), paint('#f7f5ef')), -0.3, deck + 0.06, 0));
  boat.add(
    at(
      mesh(roundedBox(0.7, 0.07, 0.61, 0.02), paint('#24364a', { roughness: 0.2 })),
      -0.3,
      deck + 0.09,
      0,
    ),
  );
  const spar = paint('#d9dde3', { metalness: 0.5, roughness: 0.3 });
  boat.add(at(mesh(cylinder(0.035, 0.045, 3.6, 8), spar), mastX, deck + 1.8, 0));

  // The rig swings off the centreline as if sailing across the wind.
  const rig = new Group();
  rig.position.set(mastX, deck, 0);
  rig.rotation.y = 0.32 * (rng.chance(0.5) ? 1 : -1);
  const boom = mesh(cylinder(0.03, 0.03, 1.55, 8), spar);
  boom.rotation.z = Math.PI / 2;
  rig.add(at(boom, -0.78, 0.42, 0));
  const cloth = (colour: string) => paint(colour, { side: DoubleSide, roughness: 0.8 });
  const white = dark ? '#9aa4c0' : '#fffdf5';
  const main = new Mesh(
    sailGeometry(
      [
        [-0.05, 0.46],
        [-0.05, 3.5],
        [-1.5, 0.48],
      ],
      0.16,
    ),
    cloth(white),
  );
  const jibColour = rng.chance(0.4) ? stripe : white;
  const jib = new Mesh(
    sailGeometry(
      [
        [0.05, 3.05],
        [1.12, 0.12],
        [-0.25, 0.3],
      ],
      0.2,
    ),
    cloth(jibColour),
  );
  for (const sail of [main, jib]) {
    sail.castShadow = true;
    rig.add(sail);
  }
  boat.add(rig);
  return boat;
}

const FERRY_HULL: HullSpec = {
  length: 6.0,
  beam: 1.8,
  freeboard: 0.62,
  draught: 0.4,
  sheer: 0.3,
  shoulder: 0.56,
  transom: 0.8,
  bands: [{ colour: '#1b2638', to: 0.06 }, { colour: '#1f6fb2', to: 0.34 }, { colour: '#f4f2ea' }],
  deck: '#8d99a6',
};

const lifeboatGeometry = new CapsuleGeometry(0.1, 0.36, 4, 10);
lifeboatGeometry.userData.shared = true;

export function ferry(dark: boolean): Group {
  const boat = new Group();
  boat.add(mesh(hullGeometry(FERRY_HULL), hullPaint()));
  const white = paint('#ffffff', { roughness: 0.4 });
  const windows = paint('#1d2a3a', {
    roughness: 0.2,
    emissive: new Color('#ffd27a'),
    emissiveIntensity: dark ? 1.05 : 0,
  });
  const deck = FERRY_HULL.freeboard;

  // Two passenger decks, each set back from the one below, with a band of windows round each.
  boat.add(at(mesh(roundedBox(4.2, 0.5, 1.5, 0.1), white), -0.45, deck + 0.25, 0));
  boat.add(at(mesh(box(4.0, 0.17, 1.52), windows), -0.45, deck + 0.28, 0));
  boat.add(at(mesh(roundedBox(2.9, 0.42, 1.3, 0.1), white), -0.3, deck + 0.71, 0));
  boat.add(at(mesh(box(2.7, 0.15, 1.32), windows), -0.3, deck + 0.74, 0));

  // The bridge up front, wider than the deck below it so its wings stand out.
  boat.add(at(mesh(roundedBox(0.8, 0.36, 1.72, 0.08), white), 0.85, deck + 1.1, 0));
  boat.add(at(mesh(box(0.82, 0.13, 1.74), windows), 0.85, deck + 1.13, 0));
  boat.add(at(mesh(roundedBox(0.9, 0.05, 1.78, 0.02), paint('#d7dbe0')), 0.85, deck + 1.3, 0));
  boat.add(at(mesh(cylinder(0.025, 0.025, 0.7, 6), white), 0.75, deck + 1.65, 0));
  boat.add(
    at(
      mesh(
        sphere(0.06, 10),
        paint('#ffe7a8', { emissive: new Color('#ffd27a'), emissiveIntensity: dark ? 2 : 0 }),
      ),
      0.75,
      deck + 2.02,
      0,
    ),
  );

  // The funnel, raked aft, in the line's red with a white band and a black top.
  const funnel = new Group();
  funnel.add(
    at(mesh(cylinder(0.24, 0.28, 0.8, 18), paint('#e94f37', { roughness: 0.45 })), 0, 0.4, 0),
  );
  funnel.add(at(mesh(cylinder(0.27, 0.275, 0.14, 18), white), 0, 0.48, 0));
  funnel.add(at(mesh(cylinder(0.245, 0.245, 0.1, 18), paint('#1d1f24')), 0, 0.84, 0));
  funnel.scale.set(1.35, 1, 1);
  funnel.rotation.z = 0.14;
  funnel.position.set(-1.25, deck + 0.92, 0);
  boat.add(funnel);

  // Orange lifeboats in pairs along the upper deck.
  const orange = paint('#f28c28', { roughness: 0.5 });
  for (const side of [-1, 1]) {
    for (const x of [-1.15, -0.1]) {
      const lifeboat = mesh(lifeboatGeometry, orange);
      lifeboat.rotation.z = Math.PI / 2;
      boat.add(at(lifeboat, x, deck + 0.64, side * 0.78));
    }
  }
  return boat;
}
