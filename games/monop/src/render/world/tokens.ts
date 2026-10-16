import { Color, CylinderGeometry, DoubleSide, Group, type Object3D, TorusGeometry } from 'three';
import { type HullSpec, hullGeometry } from './hulls';
import { at, box, cylinder, mesh, paint, roundedBox, sphere } from './kit3d';

/**
 * The players' tokens: toy figures on a round base in the seat's colour, so a token reads by
 * shape and by colour at once. Each is a handful of primitives in glossy toy paint. Every
 * figure is our own; none is a piece from a published game.
 */

const toy = (colour: string) => paint(colour, { roughness: 0.32, metalness: 0.05 });
const metal = (colour: string) => paint(colour, { roughness: 0.28, metalness: 0.75 });

function base(colour: string): Group {
  const group = new Group();
  group.add(at(mesh(cylinder(0.62, 0.68, 0.18, 28), toy(colour)), 0, 0.09, 0));
  group.add(at(mesh(cylinder(0.5, 0.5, 0.04, 28), toy(lighten(colour, 0.35))), 0, 0.2, 0));
  return group;
}

function lighten(colour: string, amount: number): string {
  return `#${new Color(colour).lerp(new Color('#ffffff'), amount).getHexString()}`;
}

const TUG_HULL: HullSpec = {
  length: 1.3,
  beam: 0.64,
  freeboard: 0.28,
  draught: 0.14,
  sheer: 0.14,
  shoulder: 0.52,
  transom: 0.72,
  bands: [
    { colour: '#2b2f3a', to: 0.03 },
    { colour: '#d8312b', belowDeck: 0.07 },
    // The thick rubbing strake a tug pushes with.
    { colour: '#1d1f24' },
  ],
  deck: '#e8dcc4',
};

/** A harbour tug: a high bow with a fender on its nose, a tall wheelhouse and a funnel aft. */
function tugboat(colour: string): Object3D {
  const g = new Group();
  const hull = mesh(
    hullGeometry(TUG_HULL),
    paint('#ffffff', { roughness: 0.32, metalness: 0.05, vertexColors: true }),
  );
  g.add(at(hull, 0, 0.2 + TUG_HULL.draught, 0));
  const deck = 0.2 + TUG_HULL.draught + TUG_HULL.freeboard;
  const cream = toy('#f4efe4');
  const dark = toy('#2b2f3a');
  g.add(at(mesh(roundedBox(0.6, 0.2, 0.44, 0.05), cream), 0.04, deck + 0.08, 0));
  g.add(at(mesh(roundedBox(0.36, 0.24, 0.4, 0.05), cream), 0.14, deck + 0.3, 0));
  const glass = paint('#24364a', { roughness: 0.12, metalness: 0.3 });
  g.add(at(mesh(roundedBox(0.375, 0.1, 0.415, 0.02), glass), 0.14, deck + 0.34, 0));
  g.add(at(mesh(roundedBox(0.46, 0.05, 0.48, 0.02), dark), 0.14, deck + 0.445, 0));
  g.add(at(mesh(cylinder(0.015, 0.015, 0.2, 6), metal('#c9ced6')), 0.14, deck + 0.57, 0));
  g.add(at(mesh(cylinder(0.09, 0.11, 0.34), toy(colour)), -0.17, deck + 0.35, 0));
  g.add(at(mesh(cylinder(0.095, 0.095, 0.06), dark), -0.17, deck + 0.54, 0));
  const fender = mesh(sphere(0.1, 14), toy('#1d1f24'));
  fender.scale.set(0.7, 0.9, 1.25);
  g.add(at(fender, 0.64, deck + 0.02, 0));
  g.add(at(mesh(cylinder(0.04, 0.05, 0.1, 10), dark), -0.46, deck + 0.04, 0));
  for (const side of [-1, 1]) {
    for (const x of [-0.34, -0.06, 0.22]) {
      const tyre = mesh(new TorusGeometry(0.065, 0.028, 8, 16), toy('#1d1f24'));
      g.add(at(tyre, x, deck - 0.12, side * 0.335));
    }
  }
  return g;
}

function kite(colour: string): Object3D {
  const g = new Group();
  g.add(at(mesh(cylinder(0.025, 0.025, 1.0), metal('#c9ced6')), 0, 0.7, 0));
  const sail = new Group();
  const quarter = (x: number, y: number, tone: string) =>
    at(mesh(roundedBox(0.42, 0.42, 0.04, 0.02), toy(tone)), x, y, 0);
  sail.add(quarter(-0.15, 0.15, colour), quarter(0.15, 0.15, '#fff4d8'));
  sail.add(quarter(-0.15, -0.15, '#fff4d8'), quarter(0.15, -0.15, colour));
  sail.rotation.z = Math.PI / 4;
  sail.position.set(0, 1.25, 0);
  g.add(sail);
  for (let i = 0; i < 3; i++) {
    g.add(
      at(
        mesh(roundedBox(0.16, 0.08, 0.05, 0.02), toy(i % 2 ? colour : '#ffd166')),
        0.12 + i * 0.06,
        0.78 - i * 0.16,
        0,
      ),
    );
  }
  return g;
}

function gull(colour: string): Object3D {
  const g = new Group();
  const body = mesh(sphere(0.32, 20), toy('#f7f5ef'));
  body.scale.set(1.35, 0.85, 0.9);
  g.add(at(body, 0, 0.72, 0));
  g.add(at(mesh(sphere(0.2, 18), toy('#f7f5ef')), 0.36, 0.98, 0));
  const beak = mesh(cylinder(0.0, 0.06, 0.22, 10), toy('#f2b21b'));
  beak.rotation.z = -Math.PI / 2;
  g.add(at(beak, 0.6, 0.97, 0));
  for (const z of [-0.11, 0.11]) g.add(at(mesh(sphere(0.035, 8), toy('#1d1f24')), 0.47, 1.04, z));
  for (const z of [-0.26, 0.26]) {
    const wing = mesh(roundedBox(0.62, 0.08, 0.26, 0.04), toy('#9aa3ad'));
    wing.rotation.x = z > 0 ? 0.35 : -0.35;
    g.add(at(wing, -0.08, 0.82, z));
  }
  g.add(at(mesh(roundedBox(0.3, 0.06, 0.24, 0.03), toy('#3b4048')), -0.5, 0.78, 0));
  for (const z of [-0.1, 0.1])
    g.add(at(mesh(cylinder(0.025, 0.025, 0.36), toy('#f2b21b')), 0, 0.38, z));
  g.add(at(mesh(roundedBox(0.4, 0.05, 0.3, 0.02), toy(colour)), 0.0, 0.25, 0));
  return g;
}

function bike(colour: string): Object3D {
  const g = new Group();
  for (const x of [-0.42, 0.42]) {
    const wheel = mesh(new TorusGeometry(0.27, 0.045, 10, 28), toy('#1d1f24'));
    g.add(at(wheel, x, 0.5, 0));
    const hub = at(mesh(cylinder(0.05, 0.05, 0.08), metal('#c9ced6')), x, 0.5, 0);
    hub.rotation.x = Math.PI / 2;
    g.add(hub);
  }
  const tube = (x: number, y: number, length: number, angle: number) => {
    const part = mesh(cylinder(0.035, 0.035, length), toy(colour));
    part.rotation.z = angle;
    return at(part, x, y, 0);
  };
  g.add(
    tube(-0.18, 0.62, 0.55, -1.05),
    tube(0.12, 0.66, 0.5, 0.9),
    tube(0.0, 0.84, 0.5, Math.PI / 2),
  );
  g.add(tube(-0.32, 0.78, 0.36, 0.35), tube(0.38, 0.84, 0.42, -0.3));
  g.add(at(mesh(roundedBox(0.26, 0.06, 0.12, 0.03), toy('#2b2f3a')), -0.3, 0.98, 0));
  g.add(at(mesh(roundedBox(0.06, 0.04, 0.42, 0.02), metal('#c9ced6')), 0.44, 1.06, 0));
  g.add(at(mesh(roundedBox(0.34, 0.3, 0.34, 0.05), toy('#ffd166')), 0.5, 1.1, 0));
  return g;
}

function balloon(colour: string): Object3D {
  const g = new Group();
  const envelope = new Group();
  for (let i = 0; i < 8; i++) {
    const gore = mesh(sphere(0.48, 24), toy(i % 2 ? colour : '#fff4d8'));
    gore.scale.set(0.38, 1.1, 1);
    gore.rotation.y = (i / 8) * Math.PI;
    envelope.add(gore);
  }
  envelope.add(mesh(sphere(0.47, 24), toy(colour)));
  envelope.scale.set(1, 1.08, 1);
  g.add(at(envelope, 0, 1.25, 0));
  g.add(at(mesh(roundedBox(0.3, 0.24, 0.3, 0.05), toy('#9a6a3c')), 0, 0.42, 0));
  for (const [x, z] of [
    [-0.12, -0.12],
    [0.12, -0.12],
    [-0.12, 0.12],
    [0.12, 0.12],
  ] as const) {
    const rope = mesh(cylinder(0.012, 0.012, 0.42), toy('#3b3026'));
    rope.rotation.set(z * 1.1, 0, -x * 1.1);
    g.add(at(rope, x * 1.3, 0.72, z * 1.3));
  }
  return g;
}

function buoy(colour: string): Object3D {
  const g = new Group();
  g.add(at(mesh(cylinder(0.32, 0.42, 0.34, 24), toy(colour)), 0, 0.42, 0));
  g.add(at(mesh(cylinder(0.24, 0.32, 0.3, 24), toy('#fff4d8')), 0, 0.74, 0));
  g.add(at(mesh(cylinder(0.14, 0.24, 0.3, 24), toy(colour)), 0, 1.04, 0));
  g.add(at(mesh(sphere(0.14, 16), toy('#ffd166')), 0, 1.3, 0));
  g.add(at(mesh(cylinder(0.02, 0.02, 0.3), metal('#c9ced6')), 0, 1.5, 0));
  return g;
}

// —— Ring Colony ——

const glowing = (colour: string, intensity = 1.4) =>
  paint(colour, { roughness: 0.3, emissive: new Color(colour), emissiveIntensity: intensity });

function rover(colour: string): Object3D {
  const g = new Group();
  g.add(at(mesh(roundedBox(1.1, 0.34, 0.66, 0.1), toy('#e8ecf2')), 0, 0.6, 0));
  g.add(at(mesh(roundedBox(1.0, 0.05, 0.7, 0.02), toy('#2b3a6a')), -0.1, 0.8, 0));
  for (const x of [-0.42, 0, 0.42]) {
    for (const z of [-0.38, 0.38]) {
      const wheel = mesh(cylinder(0.15, 0.15, 0.12, 14), toy('#2b2f3a'));
      wheel.rotation.x = Math.PI / 2;
      g.add(at(wheel, x, 0.36, z));
    }
  }
  g.add(at(mesh(cylinder(0.02, 0.02, 0.6, 6), metal('#c9ced6')), 0.38, 1.1, 0.2));
  g.add(at(mesh(sphere(0.09, 10), glowing(colour)), 0.38, 1.42, 0.2));
  g.add(at(mesh(roundedBox(0.28, 0.2, 0.3, 0.05), toy(colour)), 0.42, 0.86, -0.12));
  return g;
}

function drone(colour: string): Object3D {
  const g = new Group();
  g.add(at(mesh(cylinder(0.32, 0.36, 0.2, 20), toy('#e8ecf2')), 0, 1.0, 0));
  g.add(at(mesh(sphere(0.16, 12), glowing('#5fd3ff', 1.2)), 0, 0.88, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const arm = mesh(roundedBox(0.62, 0.06, 0.08, 0.02), toy('#2b2f3a'));
    arm.rotation.y = -a;
    g.add(at(arm, Math.cos(a) * 0.36, 1.02, Math.sin(a) * 0.36));
    g.add(
      at(
        mesh(cylinder(0.2, 0.2, 0.025, 18), toy(colour)),
        Math.cos(a) * 0.64,
        1.1,
        Math.sin(a) * 0.64,
      ),
    );
  }
  g.add(at(mesh(cylinder(0.025, 0.025, 0.6, 6), metal('#c9ced6')), 0, 0.5, 0));
  return g;
}

function robot(colour: string): Object3D {
  const g = new Group();
  g.add(at(mesh(roundedBox(0.56, 0.6, 0.44, 0.1), toy('#e8ecf2')), 0, 0.68, 0));
  g.add(at(mesh(roundedBox(0.3, 0.16, 0.05, 0.03), toy(colour)), 0, 0.72, 0.23));
  g.add(at(mesh(roundedBox(0.46, 0.36, 0.4, 0.1), toy('#e8ecf2')), 0, 1.22, 0));
  g.add(at(mesh(roundedBox(0.36, 0.12, 0.05, 0.03), glowing('#5fd3ff', 1.6)), 0, 1.24, 0.21));
  g.add(at(mesh(cylinder(0.02, 0.02, 0.24, 6), metal('#c9ced6')), 0, 1.5, 0));
  g.add(at(mesh(sphere(0.06, 10), glowing(colour)), 0, 1.64, 0));
  for (const x of [-0.36, 0.36])
    g.add(at(mesh(roundedBox(0.12, 0.44, 0.14, 0.05), toy('#9aa3b5')), x, 0.66, 0));
  for (const x of [-0.14, 0.14])
    g.add(at(mesh(roundedBox(0.14, 0.2, 0.16, 0.04), toy('#2b2f3a')), x, 0.3, 0));
  return g;
}

function satellite(colour: string): Object3D {
  const g = new Group();
  g.add(at(mesh(cylinder(0.025, 0.025, 0.5, 6), metal('#c9ced6')), 0, 0.45, 0));
  const craft = new Group();
  craft.add(mesh(roundedBox(0.4, 0.4, 0.4, 0.06), metal('#d4a63a')));
  for (const x of [-0.62, 0.62]) {
    craft.add(
      at(
        mesh(box(0.7, 0.03, 0.36), paint('#22336a', { roughness: 0.25, metalness: 0.6 })),
        x,
        0,
        0,
      ),
    );
  }
  const dish = mesh(new TorusGeometry(0.16, 0.03, 6, 18), toy(colour));
  craft.add(at(dish, 0, 0.3, 0));
  craft.position.y = 1.05;
  craft.rotation.z = 0.25;
  g.add(craft);
  return g;
}

function helmet(colour: string): Object3D {
  const g = new Group();
  g.add(at(mesh(cylinder(0.36, 0.42, 0.16, 24), toy(colour)), 0, 0.34, 0));
  g.add(at(mesh(sphere(0.5, 28), toy('#f4f6fa')), 0, 0.86, 0));
  const visor = mesh(sphere(0.42, 24), paint('#e2a63a', { roughness: 0.1, metalness: 0.9 }));
  visor.scale.set(0.9, 0.7, 0.72);
  g.add(at(visor, 0, 0.88, 0.16));
  g.add(at(mesh(sphere(0.07, 10), glowing('#ff4a4a', 1.4)), 0.36, 1.18, 0));
  return g;
}

function comet(colour: string): Object3D {
  const g = new Group();
  g.add(at(mesh(cylinder(0.025, 0.025, 0.5, 6), metal('#c9ced6')), 0, 0.45, 0));
  g.add(at(mesh(sphere(0.3, 20), glowing('#bfe9ff', 1.1)), 0.2, 1.05, 0));
  for (let i = 0; i < 3; i++) {
    const tail = mesh(
      cylinder(0.0, 0.2 - i * 0.04, 1.1 - i * 0.2, 12),
      glowing(i === 0 ? colour : '#9fd8ff', 1.2),
    );
    tail.rotation.z = Math.PI / 2 + 0.35 - i * 0.18;
    g.add(at(tail, -0.4, 1.1 + i * 0.06, (i - 1) * 0.12));
  }
  return g;
}

// —— Pop-up 1904: little pewter figures, as old metal playing pieces were, but our own ——

const pewter = () => paint('#b3b1b8', { roughness: 0.34, metalness: 0.85 });

function pennyfarthing(): Object3D {
  const g = new Group();
  const big = mesh(new TorusGeometry(0.46, 0.075, 10, 32), pewter());
  g.add(at(big, -0.1, 0.72, 0));
  const small = mesh(new TorusGeometry(0.17, 0.06, 8, 20), pewter());
  g.add(at(small, 0.52, 0.42, 0));
  const frame = mesh(cylinder(0.06, 0.06, 0.9, 8), pewter());
  frame.rotation.z = -1.05;
  g.add(at(frame, 0.22, 0.86, 0));
  g.add(at(mesh(roundedBox(0.22, 0.05, 0.12, 0.02), pewter()), -0.02, 1.22, 0));
  g.add(at(mesh(roundedBox(0.05, 0.04, 0.42, 0.02), pewter()), -0.1, 1.28, 0));
  return g;
}

function teapot(): Object3D {
  const g = new Group();
  const body = mesh(sphere(0.38, 20), pewter());
  body.scale.y = 0.82;
  g.add(at(body, 0, 0.62, 0));
  g.add(at(mesh(cylinder(0.14, 0.2, 0.1, 16), pewter()), 0, 0.95, 0));
  g.add(at(mesh(sphere(0.07, 10), pewter()), 0, 1.04, 0));
  const spout = mesh(cylinder(0.04, 0.08, 0.42, 10), pewter());
  spout.rotation.z = -0.9;
  g.add(at(spout, 0.42, 0.72, 0));
  const handle = mesh(new TorusGeometry(0.16, 0.04, 8, 18), pewter());
  g.add(at(handle, -0.38, 0.66, 0));
  return g;
}

function crane(): Object3D {
  // A folded paper bird, in pewter: two wings, a neck and a tail.
  const g = new Group();
  const wing = (z: number) => {
    const w = mesh(new CylinderGeometry(0.0, 0.42, 0.06, 3), pewter());
    w.rotation.set(z * 0.5, 0, Math.PI / 2);
    w.scale.set(1, 1, 1.8);
    return at(w, 0, 0.82, z * 0.22);
  };
  g.add(wing(1), wing(-1));
  g.add(at(mesh(roundedBox(0.5, 0.18, 0.18, 0.04), pewter()), 0, 0.7, 0));
  const neck = mesh(cylinder(0.02, 0.05, 0.6, 4), pewter());
  neck.rotation.z = -0.7;
  g.add(at(neck, 0.38, 0.95, 0));
  const tail = mesh(cylinder(0.02, 0.05, 0.5, 4), pewter());
  tail.rotation.z = 0.8;
  g.add(at(tail, -0.36, 0.9, 0));
  g.add(at(mesh(cylinder(0.03, 0.03, 0.42, 6), pewter()), 0, 0.42, 0));
  return g;
}

function watch(): Object3D {
  const g = new Group();
  const face = mesh(cylinder(0.4, 0.4, 0.1, 28), pewter());
  face.rotation.x = Math.PI / 2;
  g.add(at(face, 0, 0.78, 0));
  const dial = mesh(cylinder(0.33, 0.33, 0.02, 28), paint('#f4f1ea', { roughness: 0.4 }));
  dial.rotation.x = Math.PI / 2;
  g.add(at(dial, 0, 0.78, 0.06));
  g.add(at(mesh(box(0.03, 0.22, 0.02), paint('#2b2b2b')), 0, 0.86, 0.075));
  g.add(at(mesh(cylinder(0.06, 0.06, 0.12, 10), pewter()), 0, 1.24, 0));
  g.add(at(mesh(new TorusGeometry(0.08, 0.025, 6, 14), pewter()), 0, 1.36, 0));
  g.add(at(mesh(cylinder(0.04, 0.04, 0.4, 6), pewter()), 0, 0.3, 0));
  return g;
}

function umbrella(): Object3D {
  const g = new Group();
  g.add(
    at(
      mesh(
        new CylinderGeometry(0.03, 0.62, 0.42, 8, 1, true),
        paint('#b3b1b8', { roughness: 0.34, metalness: 0.85, side: DoubleSide }),
      ),
      0,
      1.15,
      0,
    ),
  );
  g.add(at(mesh(cylinder(0.025, 0.025, 1.1, 6), pewter()), 0, 0.82, 0));
  g.add(at(mesh(new TorusGeometry(0.1, 0.03, 6, 14, Math.PI), pewter()), 0.1, 0.3, 0));
  g.add(at(mesh(sphere(0.04, 8), pewter()), 0, 1.38, 0));
  return g;
}

function gramophone(): Object3D {
  const g = new Group();
  g.add(at(mesh(roundedBox(0.66, 0.34, 0.56, 0.04), pewter()), 0, 0.42, 0));
  const horn = mesh(
    new CylinderGeometry(0.42, 0.04, 0.8, 18, 1, true),
    paint('#b3b1b8', { roughness: 0.34, metalness: 0.85, side: DoubleSide }),
  );
  horn.rotation.z = -0.9;
  g.add(at(horn, 0.32, 0.98, 0));
  g.add(at(mesh(cylinder(0.025, 0.025, 0.4, 6), pewter()), -0.02, 0.72, 0));
  g.add(at(mesh(cylinder(0.24, 0.24, 0.03, 20), paint('#2b2b2b', { roughness: 0.3 })), 0, 0.6, 0));
  return g;
}

const FIGURES: Readonly<Record<string, (colour: string) => Object3D>> = {
  pennyfarthing,
  teapot,
  crane,
  watch,
  umbrella,
  gramophone,
  tugboat,
  kite,
  gull,
  bike,
  balloon,
  buoy,
  rover,
  drone,
  robot,
  satellite,
  helmet,
  comet,
};

/** A token: its figure standing on a base in the seat's colour. */
export function tokenModel(id: string, colour: string): Group {
  const token = base(colour);
  const figure = FIGURES[id]?.(colour) ?? buoy(colour);
  figure.position.y = 0.04;
  token.add(figure);
  token.scale.setScalar(1.6);
  token.traverse((child) => {
    child.castShadow = true;
  });
  return token;
}

export function registerFigures(
  figures: Readonly<Record<string, (colour: string) => Object3D>>,
): void {
  Object.assign(FIGURES as Record<string, (colour: string) => Object3D>, figures);
}
