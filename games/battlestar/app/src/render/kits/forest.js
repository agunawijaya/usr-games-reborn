// Biome 4 — the rainforest and the mountain valleys: woods and thickets,
// clearings and trails, Fern Canyon and its waterfall, the chasm, the dry
// wash under its fog, the thermal pools, and the steaming cave fissure.

import * as THREE from 'three';
import { mat, glowMat } from '../materials.js';
import { cyl, mesh } from '../geo.js';
import { outdoorBase, addLight } from '../outdoor.js';
import { broadleaf, groundCover, scatterPoints, flowers } from '../flora.js';
import { particles, lightShafts, glowSprite } from '../fx.js';
import { makeWater } from '../water.js';
import * as F from '../cave-furnish.js';

const rock = () => mat('stone', { c1: 0x5a554c, c2: 0x2e2a26, c3: 0x3a6a2a, p: [0.7, 0.6, 0.55, 0] });
const wetRock = () => mat('stone', { c1: 0x4a4640, c2: 0x22201e, c3: 0x2e5a26, p: [0.9, 0.9, 0.7, 0] });
const cobble = () => mat('stone', { c1: 0x8a8274, c2: 0x5a5448, c3: 0x6a6a4a, p: [2.2, 0.1, 0.1, 0] });

function vines(r, count, area, top = 16) {
  const g = new THREE.Group();
  const m = mat('bark', { c1: 0x3a5a2a, c2: 0x1e3218, p: [4, 20, 0, 0], sway: 0.4 });
  const leaves = [];
  for (let i = 0; i < count; i++) {
    const [x, z] = area(r);
    const len = r.range(4, 11);
    const v = cyl(0.025, 0.02, len, m, { pos: [x, top - len / 2, z], shadow: false }, 5);
    v.rotation.z = r.range(-0.05, 0.05);
    g.add(v);
    for (let k = 0; k < 6; k++) leaves.push([x + r.range(-0.2, 0.2), top - r.range(0, len), z + r.range(-0.2, 0.2)]);
  }
  const lm = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.3), mat('leaf', { c1: 0x2e6a26, c2: 0x4a8a30, c3: 0x8ac060, p: [0.9, 0, 0.05, 0], side: THREE.DoubleSide, alphaTest: 0.5, sway: 0.5 }), leaves.length);
  const m4 = new THREE.Matrix4();
  leaves.forEach(([x, y, z], i) => { m4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r.range(-1, 1), r.range(0, 6), 0)), new THREE.Vector3(1, 1, 1)); lm.setMatrixAt(i, m4); });
  g.add(lm);
  return g;
}

function boulders(r, pts, m) {
  const im = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 1), m, pts.length);
  const m4 = new THREE.Matrix4();
  pts.forEach((p, i) => { const s = p.s ?? r.range(0.4, 1.4); m4.compose(new THREE.Vector3(p.x, p.y - s * 0.3, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r.range(0, 3), r.range(0, 3), 0)), new THREE.Vector3(s * 1.3, s * 0.8, s)); im.setMatrixAt(i, m4); });
  im.castShadow = true;
  im.receiveShadow = true;
  return im;
}

/** A waterfall: a sheet of falling water with mist at the foot. */
function waterfall(r, h, w, { quality, night }) {
  const g = new THREE.Group();
  const m = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: /* glsl */ `uniform float uT; uniform float uN; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){ float x = vUv.x * 40.0; float streak = h(vec2(floor(x), 1.0)); float y = fract(vUv.y * 3.0 + uT * (1.2 + streak));
        float a = smoothstep(0.0, 0.2, y) * (0.35 + 0.65 * streak) * smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
        vec3 c = mix(vec3(0.75, 0.88, 0.95), vec3(0.3, 0.45, 0.6), uN);
        gl_FragColor = vec4(c * (0.8 + 0.4 * a), 0.25 + 0.55 * a); }`,
    uniforms: { uT: { value: 0 }, uN: { value: night ? 1 : 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, 1), m);
  sheet.position.y = h / 2;
  g.add(sheet);
  const mist = particles('mist', 14, { quality, seed: 3, pos: [0, 0.5, 0.8], spread: [w * 2, 1, 2], size: 500, alpha: 0.08, color: 0xffffff });
  const spray = particles('steam', 40, { quality, seed: 4, pos: [0, 0.2, 0.3], spread: [w, 0.2, 0.5], vel: [0, 1.2, 0.4], size: 120, alpha: 0.18, color: 0xffffff });
  g.add(mist, spray);
  g.userData.tick = (t) => { m.uniforms.uT.value = t; mist.userData.tick(t); spray.userData.tick(t); };
  return g;
}

/** Streams and pools reflect the engine's sky, like the sea does. `shade` < 1 where walls hide the sun or moon. */
function skyWater(w, cel, shade = 1) {
  w.userData.setSky({ sun: cel.night ? cel.moon : cel.sun, sunCol: new THREE.Color(cel.night ? 0xb8c8ff : 0xfff2dd).multiplyScalar(shade),
    top: cel.night ? 0x05080f : 0x3a6ad0, horizon: cel.night ? 0x101828 : 0xb8d0e8, night: cel.night });
}

export function buildForest(spec, ctx) {
  const place = spec.place;
  const night = spec.night;
  const feat = new Set(spec.features);
  const opts = { rockMat: rock(), height: { base: 1.2, rough: 1.6 }, cloud: 0.6, forestTrees: ctx.quality === 'low' ? 8 : 22 };
  // canyons: rock walls on both sides of the way through
  if (place === 'canyon' || place === 'chasm' || place === 'falls') {
    const s = {};
    for (const k of ['ahead', 'right', 'back', 'left']) s[k] = { kind: 'open', exit: spec.around[k].exit, road: false };
    const walls = spec.room === 188 ? 5 : spec.room === 189 ? 7 : 9;
    // a canyon runs along its exits: when they lie left and right the viewer faces a wall
    opts.across = place !== 'chasm' && !s.ahead.exit && !s.back.exit && !!(s.left.exit || s.right.exit);
    for (const k of opts.across ? ['ahead', 'back'] : ['left', 'right']) if (!s[k].exit) s[k].kind = 'cliff';
    if (place === 'chasm') s.ahead.kind = 'sea';
    opts.sides = s;
    opts.height = { base: 1, rough: 0.6, cliffH: 16, shore: place === 'chasm' ? 7 : 14 };
    // "the gravel floor": no lawn between the walls
    opts.noGrass = true;
    opts.colors = { grass: 0x5e5c4a, dirt: 0x6e6452 };
    opts.forestTrees = 0;
    opts.walls = walls;
  }
  if (place === 'wash') opts.colors = { grass: 0x5a6a3a, dirt: 0x8a8070 };
  const view = outdoorBase(spec, ctx, opts);
  const { group, ticks, groundAt, r } = view;
  // at the cave mouth the cliff closes one side: nothing grows in front of it or beyond it
  const cliffSide = place === 'cave-mouth' ? (['left', 'back', 'ahead', 'right'].find((k) => spec.around[k].exit === 230) || 'ahead') : null;
  const cliffAxis = cliffSide && { ahead: [0, -1], left: [-1, 0], right: [1, 0], back: [0, 1] }[cliffSide];
  const byCliff = (x, z) => {
    if (!cliffAxis) return false;
    const along = x * cliffAxis[0] + z * cliffAxis[1];
    const across = Math.abs(x * cliffAxis[1] - z * cliffAxis[0]);
    return along > 10 || (along > 0 && across < 6);
  };
  const pitAt = spec.room === 146 || feat.has('firepit') ? [1.0, -1.2] : null;
  const clearOfPit = (x, z) => !pitAt || Math.hypot(x - pitAt[0], z - pitAt[1]) > 2.4;
  const clearOfPath = (x, z, y) => view.pathDist(x, z) > 2.4 && Math.hypot(x, z - 6) > 5 && !byCliff(x, z) && clearOfPit(x, z);

  // ---- the forest itself: canopy, mid-storey, floor
  const dense = ['woods', 'thicket', 'trail', 'road', 'stream', 'clearing', 'cave-mouth', 'pools', 'wash'].includes(place);
  if (dense) {
    const openCentre = place === 'clearing' ? 12 : place === 'pools' ? 10 : 5;
    const conifer = feat.has('conifers');
    const low = ctx.quality === 'low';
    const nTrees = Math.round((place === 'thicket' ? 26 : place === 'wash' ? 12 : 34) * (low ? 0.55 : 1));
    const trees = scatterPoints(nTrees, r, (rr) => [rr.range(-40, 40), rr.range(-60, 12)], groundAt,
      (x, z, y) => clearOfPath(x, z, y) && Math.hypot(x, z + 4) > openCentre);
    group.add(broadleaf(trees, r, { kind: conifer ? 'conifer' : 'rain', night, quality: ctx.quality }));
    if (!conifer) {
      const mid = scatterPoints(low ? 8 : 24, r, (rr) => [rr.range(-24, 24), rr.range(-36, 8)], groundAt, clearOfPath);
      group.add(broadleaf(mid, r, { kind: 'mango', night, quality: ctx.quality, fruitless: true, leafColor: night ? 0x0f2414 : 0x24541c, leafColor2: night ? 0x163418 : 0x3a7026 }));
      // a closed roof of leaves overhead, with gaps where the light comes through
      // (on Low the roof is a darker, closer fog instead: leaves overhead cost the most fill)
      if (place !== 'clearing' && place !== 'wash' && place !== 'cave-mouth' && !low) {
        const roof = [];
        for (let x = -36; x <= 36; x += 9) for (let z = -54; z <= 12; z += 9) {
          if (r.chance(0.18)) continue;
          roof.push({ x: x + r.range(-3, 3), y: groundAt(x, z) + r.range(13, 18), z: z + r.range(-3, 3), s: r.range(0.9, 1.2) });
        }
        group.add(broadleaf(roof, r, { kind: 'canopy', night, quality: ctx.quality }));
      }
    }
    const bushes = scatterPoints(Math.round((place === 'thicket' ? 40 : 22) * (low ? 0.5 : 1)), r, (rr) => [rr.range(-18, 18), rr.range(-28, 7)], groundAt, clearOfPath);
    group.add(broadleaf(bushes, r, { kind: 'bush', night, quality: ctx.quality }));
    const ferns = scatterPoints(ctx.quality === 'low' ? 30 : 180, r, (rr) => [rr.range(-20, 20), rr.range(-30, 7)], groundAt, (x, z, y) => view.pathDist(x, z) > 1.3 && Math.hypot(x, z - 6) > 1.5 && clearOfPit(x, z) && !(cliffAxis && x * cliffAxis[0] + z * cliffAxis[1] > 10));
    group.add(groundCover('fern', ferns, r, { night }));
    if (!low && (feat.has('vines') || place === 'woods' || place === 'thicket')) {
      const v = vines(r, 26, (rr) => [rr.range(-14, 14), rr.range(-26, 2)], 15);
      group.add(v);
    }
    if (feat.has('berries') || feat.has('thorns')) {
      const b = scatterPoints(70, r, (rr) => [rr.range(-10, 10), rr.range(-16, 5)], groundAt, (x, z) => view.pathDist(x, z) > 1.2);
      group.add(flowers(b.map((p) => ({ ...p, y: p.y + r.range(0.4, 1.1) })), r, feat.has('berries') ? [0x3a2a8a, 0xb01a3a, 0x2a1a5a] : [0x6a2a1a, 0x8a3a1a]));
    }
    // fallen logs (broken ends, moss, branch stubs), old stumps and mossy stones
    for (let i = 0; i < 4; i++) {
      const [x, z] = [r.range(-12, 12), r.range(-22, -2)];
      if (view.pathDist(x, z) < 2.4 || !clearOfPit(x, z)) continue;
      const rad = r.range(0.26, 0.4);
      const lg = F.log(r.range(3, 6), rad, i + spec.seed);
      lg.position.set(x, groundAt(x, z) + rad * 0.8, z);
      lg.rotation.y = r.range(0, 3);
      group.add(lg);
    }
    for (let i = 0; i < 3; i++) {
      const [x, z] = [r.range(-10, 10), r.range(-18, 0)];
      if (view.pathDist(x, z) < 2.2 || !clearOfPit(x, z)) continue;
      const st = F.stump(r.range(0.25, 0.42), i + spec.seed);
      st.position.set(x, groundAt(x, z) - 0.04, z);
      st.rotation.y = r.range(0, 6);
      group.add(st);
    }
    group.add(boulders(r, scatterPoints(10, r, (rr) => [rr.range(-16, 16), rr.range(-26, 4)], groundAt, clearOfPath), wetRock()));
    // light through the canopy by day, spores and fireflies by night
    if (!night && !view.celestial.night && !low) {
      const shafts = lightShafts(0xfff2c0, { count: place === 'clearing' ? 10 : 7, len: 22, width: 2.2, spread: 9, alpha: 0.05, seed: spec.seed % 50 });
      shafts.position.y = groundAt(0, -8);
      group.add(shafts);
      ticks.push(shafts.userData.tick);
    } else {
      const sp = particles('spores', 70, { quality: ctx.quality, seed: spec.seed % 31, pos: [0, 1.2, -8], spread: [26, 2, 26] });
      group.add(sp);
      ticks.push(sp.userData.tick);
    }
    // the canopy closes the sky: more fog, darker, greener light
    view.fog = night ? { color: 0x071010, density: 0.028 } : place === 'cave-mouth' ? { color: 0x6a7a6a, density: 0.016 } : { color: 0x4a6a4a, density: 0.026 };
    view.lights.hemi = night ? { sky: 0x5a8080, ground: 0x0a100a, intensity: 1.3 } : { sky: 0x7aa880, ground: 0x2a3a1a, intensity: 0.42 };
    view.lights.key.scale = 0.75;
    view.env = night ? 'night' : 'forest';
    view.sky.cloud = 0.7;
    view.grade = night
      ? { exposure: 1.3, saturation: 0.8, contrast: 1.06, tint: [0.85, 1.0, 1.0], vignette: 0.5, bloom: 0.7, threshold: 1.0 }
      : { exposure: 0.95, saturation: 1.1, contrast: 1.08, tint: [0.96, 1.03, 0.95], vignette: 0.42, bloom: 0.45, threshold: 1.4 };
  }

  if (place === 'clearing' && feat.has('fowl')) {
    // "a flock of wild chicken like fowl" darting among tussocks in the marsh:
    // each wanders a loop, head down to peck, facing the way it goes
    const birds = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const b = F.fowl(i);
      birds.add(b);
      const ph = r.range(0, 10);
      const cx = r.range(-6, 6);
      const cz = r.range(-10, -3);
      const sp = r.range(0.35, 0.6);
      const neck = b.userData.neck;
      ticks.push((t) => {
        const a = t * sp + ph;
        const x = cx + Math.sin(a) * 1.5;
        const z = cz + Math.sin(a * 0.7) * 1.2;
        b.position.set(x, groundAt(x, z), z);
        b.rotation.y = Math.atan2(Math.cos(a) * 1.5, Math.cos(a * 0.7) * 0.84);
        const peck = Math.max(0, Math.sin(t * 2.3 + ph * 3)) ** 6;
        neck.rotation.x = 0.9 * peck;
        b.children[0].rotation.x = 0.15 * peck;
      });
    }
    group.add(birds);
    group.add(groundCover('sedge', scatterPoints(80, r, (rr) => [rr.range(-12, 12), rr.range(-16, 3)], groundAt, () => true), r, { night }));
  }
  if (pitAt) {
    // "It looks like someone has camped here. There is a fire pit with some dry sticks and grass nearby."
    const [px, pz] = pitAt;
    const pit = F.firePit({ lit: night, quality: ctx.quality, seed: 9, particlesFn: particles, glowFn: glowSprite });
    pit.position.set(px, groundAt(px, pz) - 0.02, pz);
    pit.rotation.y = 0.6;
    group.add(pit);
    if (pit.userData.tick) ticks.push(pit.userData.tick);
    // a log dragged up to sit on, its bark rubbed smooth
    const seat = F.log(2.2, 0.19, 7);
    seat.position.set(px - 1.5, groundAt(px - 1.5, pz - 0.3) + 0.16, pz - 0.3);
    seat.rotation.y = 1.2;
    group.add(seat);
    if (night) addLight(view, { pos: [px, groundAt(px, pz) + 0.8, pz], color: 0xff8a3a, intensity: 16, distance: 0, flicker: 0.45 });
  }

  // ---- canyons, chasm, falls
  if (place === 'canyon' || place === 'chasm' || place === 'falls') {
    const w = view.walls ?? opts.walls ?? 9;
    // Everything here is laid out with the canyon running along -z through the
    // viewer's spot (0, 6). When the canyon's exits are to the left and right
    // (the viewer faces a wall) the whole layout is turned a quarter round it.
    const across = !!opts.across;
    const cg = new THREE.Group();
    cg.position.set(0, 0, 6);
    if (across) cg.rotation.y = -Math.PI / 2;
    group.add(cg);
    const cw = (x, z) => (across ? [-(z - 6), 6 + x] : [x, z]);
    const gA = (x, z) => groundAt(...cw(x, z));
    const put = (o, x, y, z) => { o.position.set(x, y, z - 6); cg.add(o); return o; };
    const z0 = across ? -24 : -52;
    const z1 = across ? 30 : 12;
    const wallM = mat('stone', { c1: 0x5a554c, c2: 0x2e2a26, c3: 0x2e5a26, p: [0.7, 0.8, 0.75, 0], side: THREE.DoubleSide });
    for (const sgn of [-1, 1]) {
      const side = across ? (sgn < 0 ? 'ahead' : 'back') : (sgn < 0 ? 'left' : 'right');
      if (spec.around[side].exit) continue;
      // a sheer, fern-hung rock face: a vertical grid displaced by noise
      const L = z1 - z0;
      const face = new THREE.PlaneGeometry(L, 26, Math.round(L), 26);
      const fp = face.attributes.position;
      for (let i = 0; i < fp.count; i++) {
        const u = fp.getX(i);
        const v = fp.getY(i);
        fp.setZ(i, Math.sin(u * 0.35 + v * 0.2) * 0.9 + Math.sin(u * 1.3 - v * 0.9) * 0.35 + Math.sin(v * 2.1 + u * 0.4) * 0.25);
      }
      face.computeVertexNormals();
      const m = mesh(face, wallM, { rot: [0, -sgn * Math.PI / 2, 0], shadow: true });
      put(m, sgn * w / 2, 11, (z0 + z1) / 2);
    }
    // skylight bounces between the walls: the floor of a canyon is never black by day
    view.lights.hemi = night ? { sky: 0x6a80a8, ground: 0x141814, intensity: 1.4 } : { sky: 0xc0d4c8, ground: 0x5a5444, intensity: 0.95 };
    addLight(view, { pos: [0, 9, across ? 4 : -12], color: night ? 0x6a80b0 : 0xeef4ff, intensity: night ? 25 : 140, distance: 0 });
    // the moon only grazes the floor between walls ten metres high
    if (night) view.lights.key.scale = 0.35;
    const ferns = scatterPoints(120, r, (rr) => [rr.range(-w, w), rr.range(z0 + 12, z1 - 6)], gA, () => true);
    // ferns on the floor, and in the wet crevices low on the walls
    const fernG = groundCover('fern', ferns.map((p) => ({ ...p, y: p.y + (Math.abs(p.x) > w / 2 ? r.range(0.3, 2.4) : 0), x: Math.abs(p.x) > w / 2 ? Math.sign(p.x) * (w / 2 - 0.1) : p.x })), r, { night });
    put(fernG, 0, 0, 6);
    // the freshet along the floor: a shallow, clear rivulet over gravel
    if (place === 'canyon') {
      let lvl = -Infinity;
      for (let z = -8; z <= 8; z += 2) lvl = Math.max(lvl, gA(0, z));
      const stream = makeWater({ size: 30, res: 30, level: lvl + 0.03, quality: ctx.quality, depthAt: () => 0.8, calm: 0.2, scale: 0.35, foam: 0.08, shallow: 0x3a5a4e, deep: 0x16302a, offset: [0, 0, across ? 6 : -4] });
      stream.scale.x = 0.028;
      // between the walls the water mirrors wet rock and ferns, not the open sky
      const cel = view.celestial;
      stream.userData.setSky({ sun: cel.night ? cel.moon : cel.sun, sunCol: new THREE.Color(cel.night ? 0xb8c8ff : 0xfff2dd).multiplyScalar(0.12),
        top: cel.night ? 0x05080c : 0x3a4a44, horizon: cel.night ? 0x080c10 : 0x2e3a32, night: cel.night });
      stream.position.z = -6;
      cg.add(stream);
      ticks.push(stream.userData.tick);
      const gravel = scatterPoints(ctx.quality === 'low' ? 70 : 160, r, (rr) => [rr.range(-w / 2 + 0.4, w / 2 - 0.4), rr.range(z0 + 14, z1 - 8)], gA, () => true);
      const gm = new THREE.InstancedMesh(F.rockGeo(4, 0, 0.35, true), mat('stone', { c1: 0x8a8274, c2: 0x4e483e, c3: 0x5a6a4a, p: [0.9, 0.5, 0.2, 0] }), gravel.length);
      const m4 = new THREE.Matrix4();
      gravel.forEach((p, i) => { const s = r.range(0.04, 0.16); m4.compose(new THREE.Vector3(p.x, p.y + s * 0.2, p.z - 6), new THREE.Quaternion().setFromEuler(new THREE.Euler(r.range(0, 3), r.range(0, 3), 0)), new THREE.Vector3(s * 1.3, s * 0.7, s)); gm.setMatrixAt(i, m4); });
      gm.receiveShadow = true;
      cg.add(gm);
    }
    if (feat.has('waterfall') || place === 'falls') {
      if (place === 'falls') {
        const f = waterfall(r, 10, 2.2, { quality: ctx.quality, night });
        put(f, 0, gA(0, -16) - 9, -16);
        ticks.push(f.userData.tick);
      } else {
        // "A slender waterfall careens away from the face of the rock high above and
        // showers the gravel floor with sparkling raindrops": it leaves a lip at the top
        // of the wall, falls clear of the face and bursts on the gravel
        const zf = across ? 2.5 : -10;
        const xf = -w / 2 + 1.1;
        const h = 10.5;
        const f = waterfall(r, h, 1.1, { quality: ctx.quality, night });
        // the sheet turns to the viewer (a falling column looks alike from any side)
        f.rotation.y = Math.atan2(-xf, 6 - zf);
        put(f, xf, gA(xf, zf), zf);
        ticks.push(f.userData.tick);
        const lip = mesh(F.ledgeGeo(1.6, 2.2, 3), mat('stone', { c1: 0x4e4a42, c2: 0x26241f, c3: 0x2e5a26, p: [0.8, 0.9, 0.7, 0] }), { rot: [0, 0, 0] });
        put(lip, -w / 2 + 0.45, gA(xf, zf) + h + 0.1, zf);
        const drops = particles('drips', 60, { quality: ctx.quality, seed: 23, pos: [0, 0, 0], spread: [1.2, 0.3, 1.6] });
        put(drops, xf + 0.3, gA(xf, zf) + h * 0.6, zf);
        ticks.push(drops.userData.tick);
        const sparkle = particles('glitter', 30, { quality: ctx.quality, seed: 24, pos: [0, 0, 0], spread: [1.4, 0.6, 1.4], size: 3, alpha: night ? 0.3 : 0.9, color: 0xffffff, color2: 0xd8f0ff });
        put(sparkle, xf + 0.5, gA(xf, zf) + 0.5, zf);
        ticks.push(sparkle.userData.tick);
        // the splash pool among wet boulders at its foot
        [[0.6, 0.35, 0.9, 0.5], [1.2, 0.3, -0.7, 0.4], [0.2, 0.25, -1.3, 0.35], [1.5, 0.28, 0.6, 0.3]].forEach(([dx, s, dz, sy], i) => {
          const b = mesh(F.rockGeo(i + 9, 1, 0.3), wetRock(), { scale: [s * 1.4, sy, s * 1.2], rot: [0, i, 0] });
          put(b, xf + dx, gA(xf + dx, zf + dz) + sy * 0.3, zf + dz);
        });
      }
    }
    if (feat.has('stone-door') || spec.room === 189) {
      // "There is a stone door in the wall +" — the north wall (the first placeholder)
      const rel = ((((-(ctx.facingDeg ?? 0)) % 360) + 540) % 360) - 180;
      const sgn = across ? (Math.abs(rel) < 90 ? -1 : 1) : (rel < 0 ? -1 : 1);
      const openDoor = spec.exits.ahead === 231 || spec.exits.left === 231 || spec.exits.right === 231;
      const zd = across ? 4.4 : -6;
      const door = F.kit(openDoor ? 'stoneDoorOpen' : 'stoneDoor', () => F.stoneDoor({ open: openDoor }));
      door.rotation.y = -sgn * Math.PI / 2;
      put(door, sgn * (w / 2 - 0.3), gA(sgn * (w / 2 - 0.6), zd) - 0.05, zd);
      // the threshold is worn; moss and ferns crowd the jambs
      const tuft = groundCover('fern', [{ x: sgn * (w / 2 - 0.5), y: gA(sgn * (w / 2 - 0.5), zd - 1.7), z: zd - 1.7 }, { x: sgn * (w / 2 - 0.5), y: gA(sgn * (w / 2 - 0.5), zd + 1.8), z: zd + 1.8 }], r, { night });
      put(tuft, 0, 0, 6);
    }
    if (place === 'chasm') {
      view.camera.look = [0, -6, -30];
      const glim = glowSprite(0x7ab8d8, 30, 0.35);
      glim.position.set(0, -60, -50);
      group.add(glim);
    }
    view.fog = night ? { color: 0x060a0c, density: 0.03 } : { color: 0x9ab0a8, density: 0.018 };
    view.env = night ? 'night' : 'forest';
  }

  // ---- the dry wash under its fog
  if (place === 'wash') {
    const cobbles = scatterPoints(160, r, (rr) => [rr.range(-5, 5), rr.range(-40, 6)], groundAt, () => true);
    group.add(boulders(r, cobbles.map((p) => ({ ...p, s: r.range(0.15, 0.45) })), cobble()));
    const fog = particles('mist', 26, { quality: ctx.quality, seed: 11, pos: [0, 6, -14], spread: [40, 3, 40], size: 900, alpha: 0.12, color: 0xf4f4f0, color2: 0xe0e0dc });
    group.add(fog);
    ticks.push(fog.userData.tick);
    view.fog = { color: spec.room === 178 ? 0x9a8a6a : 0xd8dcd8, density: 0.03 };
    if (spec.room === 178) {
      // "the lurid sun glows brown through a strange mist" over the noisome morass
      view.grade = { ...view.grade, tint: [1.08, 0.98, 0.8], saturation: 0.85 };
      view.camera.look = [0, -3, -30];
    }
  }

  // ---- thermal pools: steam, geysers, a waterfall; the goddess is only light
  if (place === 'pools') {
    const level = groundAt(0, -7) - 0.4;
    const pools = [];
    for (let i = 0; i < 6; i++) pools.push([r.range(-8, 8), r.range(-14, -3), r.range(1.6, 3.2)]);
    for (const [px, pz, pr] of pools) {
      const pool = makeWater({ size: pr * 2.1, res: 24, level, quality: ctx.quality, depthAt: () => 1.2, calm: 0.06, scale: 0.12, foam: 0, shallow: 0x5ad8c8, deep: 0x1a8a8a, glow: night ? 0.9 : 0.08, glowCol: 0x4affd0 });
      const disc = new THREE.CircleGeometry(pr * 1.02, 32);
      disc.rotateX(-Math.PI / 2);
      disc.setAttribute('depth', new THREE.BufferAttribute(new Float32Array(disc.attributes.position.count).fill(1.2), 1));
      pool.geometry.dispose();
      pool.geometry = disc;
      skyWater(pool, view.celestial);
      pool.position.x = px;
      pool.position.z = pz;
      group.add(pool);
      ticks.push(pool.userData.tick);
      group.add(mesh(new THREE.TorusGeometry(pr, 0.35, 8, 24), wetRock(), { pos: [px, level + 0.1, pz], rot: [Math.PI / 2, 0, 0], scale: [1, 1, 0.5] }));
      const st = particles('steam', 36, { quality: ctx.quality, seed: Math.round(px * 10), pos: [px, level + 0.2, pz], spread: [pr * 1.5, 0.2, pr * 1.5], size: 150, alpha: 0.22 });
      group.add(st);
      ticks.push(st.userData.tick);
    }
    // a spluttering geyser
    const gey = particles('steam', 60, { quality: ctx.quality, seed: 77, pos: [6, level, -12], spread: [0.4, 0.2, 0.4], vel: [0, 4.5, 0], size: 180, alpha: 0.3 });
    group.add(gey);
    ticks.push((t) => { gey.userData.tick(t); gey.visible = Math.sin(t * 0.7) > 0.2; });
    const f = waterfall(r, 14, 3, { quality: ctx.quality, night });
    f.position.set(-10, level, -20);
    group.add(f);
    ticks.push(f.userData.tick);
    view.peopleSpots = [[pools[0][0], 0, pools[0][1]], [-2, 0, -6]];
    view.waterLevel = level + 0.35;
    if (night) addLight(view, { pos: [0, level + 1, -8], color: 0x3affd0, intensity: 40, distance: 0 });
  }

  // ---- the fissure breathing steam
  if (place === 'cave-mouth') {
    const side = ['left', 'back', 'ahead', 'right'].find((k) => spec.around[k].exit === 230) || 'ahead';
    const d = { ahead: [0, -12], left: [-12, 0], right: [12, 0], back: [0, 12] }[side];
    // a rock cliff with a tall narrow fissure, a hoof-beaten path leading in
    const face = new THREE.PlaneGeometry(40, 16, 60, 24);
    const fp = face.attributes.position;
    for (let i = 0; i < fp.count; i++) {
      const u = fp.getX(i);
      const v = fp.getY(i);
      const gap = Math.max(0, 1 - Math.abs(u) / 1.2) * (v < 5 ? 1 : 0.4);
      fp.setZ(i, Math.sin(u * 0.5 + v * 0.3) * 0.8 + Math.sin(u * 1.7 - v * 1.1) * 0.3 - gap * 4);
    }
    face.computeVertexNormals();
    const cliff = mesh(face, mat('stone', { c1: 0x6a6258, c2: 0x34302a, c3: 0x3a5a2a, p: [0.6, 0.4, 0.45, 0], side: THREE.DoubleSide }), { pos: [d[0], groundAt(d[0], d[1]) + 7, d[1] - 1], rot: [0, { ahead: 0, left: Math.PI / 2, right: -Math.PI / 2, back: Math.PI }[side], 0] });
    group.add(cliff);
    const dark = mesh(new THREE.PlaneGeometry(1.4, 6), glowMat(0x000000, 0), { pos: [d[0], groundAt(d[0], d[1]) + 3, d[1] + 0.9], shadow: false });
    group.add(dark);
    // skylight falls on the open cliff face where the canopy breaks
    const toward = [d[0] * 0.45, d[1] * 0.45];
    addLight(view, { pos: [toward[0], groundAt(toward[0], toward[1]) + 9, toward[1]], color: night ? 0x8aa0d0 : 0xfff0d8, intensity: night ? 30 : 160, distance: 0 });
    const st = particles('steam', 50, { quality: ctx.quality, seed: 31, pos: [d[0] + 0.5, groundAt(d[0], d[1]) + 1.5, d[1] + 1.2], spread: [0.6, 1, 0.3], vel: [0.3, 0.9, 0.4], size: 170, alpha: 0.25 });
    group.add(st);
    ticks.push(st.userData.tick);
  }
  return view;
}
