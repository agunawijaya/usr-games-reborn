// The shared outdoor base for the island biomes: terrain shaped by what the
// room's text and neighbours say lies on each side, water, vegetation per
// side, light from the engine clock. Place kits dress it further.

import * as THREE from 'three';
import { rng } from './geo.js';
import { sides, heightFunction, exitPaths, makeTerrain, DIRS } from './terrain.js';
import { makeWater } from './water.js';
import { palms, broadleaf, groundCover, scatterPoints, flowers } from './flora.js';
import { celestial } from './sky.js';
import { particles } from './fx.js';

export const PALETTE = {
  day: { grass: 0x4a6e2a, dirt: 0x7a5a3a, rock: 0x5e564c, sand: 0xc9b287 },
  night: { grass: 0x2a3a24, dirt: 0x3a3028, rock: 0x3a3632, sand: 0x6a6252 },
};

/** Angular sector helper: a random point in the wedge around a side. */
export function sector(side, r, rMin, rMax, spread = 0.6) {
  const [dx, dz] = DIRS[side];
  const base = Math.atan2(dz, dx);
  const a = base + r.range(-spread, spread);
  const d = r.range(rMin, rMax);
  return [Math.cos(a) * d, Math.sin(a) * d];
}

export function outdoorBase(spec, ctx, o = {}) {
  const r = rng(spec.seed);
  const night = spec.night;
  const pal = night ? PALETTE.night : PALETTE.day;
  const group = new THREE.Group();
  const ticks = [];
  const sd = o.sides || sides(spec);
  const heightAt = o.heightAt || heightFunction(sd, r, o.height || {});
  const paths = o.paths ?? exitPaths(sd, r);
  const terrain = makeTerrain({
    heightAt, paths, pathWidth: o.pathWidth ?? 1.7, sandAll: !!o.sandAll, sandLevel: o.sandLevel ?? 0.55,
    colors: { ...pal, ...(o.colors || {}) }, seed: spec.seed % 1000, quality: ctx.quality,
  });
  group.add(terrain.mesh);
  const groundAt = terrain.groundAt;
  const pathDist = terrain.pathDist;

  // water on sea/lagoon sides, or always for water places
  let water = null;
  const wet = Object.values(sd).some((v) => v.kind === 'sea' || v.kind === 'lagoon') || o.water;
  if (wet) {
    const lagoon = Object.values(sd).some((v) => v.kind === 'lagoon') && !Object.values(sd).some((v) => v.kind === 'sea');
    water = makeWater({
      size: 420, res: 150, level: 0, quality: ctx.quality, offset: [0, 0, -60],
      depthAt: (x, z) => -heightAt(x, z),
      deep: lagoon ? 0x0a3a40 : 0x04303e, shallow: lagoon ? 0x2a9a8a : 0x30c0b0,
      calm: lagoon ? 0.25 : (o.surf ?? 1), foam: lagoon ? 0.4 : 1, ...(o.waterOpts || {}),
    });
    group.add(water);
    ticks.push(water.userData.tick);
  }

  // sky + light from the engine clock
  const cel = celestial(spec.light, ctx.facingDeg);
  const sunUp = !cel.night && cel.sunElev > -2;
  const dusk = !cel.night && cel.sunElev < 14;
  if (water) {
    water.userData.setSky({
      sun: cel.night ? cel.moon : cel.sun,
      sunCol: cel.night ? 0xb8c8ff : dusk ? 0xffa060 : 0xfff2dd,
      top: cel.night ? 0x0a1020 : 0x3a6ad0, horizon: cel.night ? 0x1c2840 : dusk ? 0xffa878 : 0xb8d0e8, night: cel.night,
    });
  }

  // vegetation per side
  const avoid = (x, z, y) => y > 0.35 && pathDist(x, z) > 2.2 && Math.hypot(x, z - 6) > 5;
  for (const [side, v] of Object.entries(sd)) {
    if (v.kind === 'forest') {
      const trees = scatterPoints(o.forestTrees ?? 16, r, (rr) => sector(side, rr, 9, 60, 0.7), groundAt, avoid);
      group.add(broadleaf(trees, r, { kind: 'rain', night, quality: ctx.quality }));
      const under = scatterPoints(40, r, (rr) => sector(side, rr, 5, 30, 0.8), groundAt, avoid);
      group.add(groundCover('fern', under, r, { night }));
    } else if (v.kind === 'grove') {
      const pts = [];
      const [dx, dz] = DIRS[side];
      for (let i = 0; i < 5; i++) for (let k = -3; k <= 3; k++) {
        const d = 10 + i * 8;
        const x = dx * d - dz * k * 8 + r.range(-1, 1);
        const z = dz * d + dx * k * 8 + r.range(-1, 1);
        const y = groundAt(x, z);
        if (avoid(x, z, y)) pts.push({ x, y, z });
      }
      group.add(palms(pts, r, { night }));
    } else if (v.kind === 'field') {
      const pts = scatterPoints(120, r, (rr) => sector(side, rr, 6, 34, 0.6), groundAt, avoid);
      group.add(groundCover('pineapple', pts, r, { night }));
    } else if (v.kind === 'cliff') {
      const rocks = scatterPoints(10, r, (rr) => sector(side, rr, 16, 40, 0.8), groundAt, () => true);
      const rm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), o.rockMat, rocks.length);
      const m4 = new THREE.Matrix4();
      rocks.forEach((p, i) => { m4.compose(new THREE.Vector3(p.x, p.y, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r.range(0, 3), r.range(0, 3), 0)), new THREE.Vector3(r.range(2, 5), r.range(1.5, 4), r.range(2, 5))); rm.setMatrixAt(i, m4); });
      rm.castShadow = true;
      if (o.rockMat) group.add(rm);
    }
  }
  // grass around the player (not on sand or paths)
  if (!o.noGrass) {
    const gp = scatterPoints(ctx.quality === 'low' ? 160 : 420, r, (rr) => [rr.range(-26, 26), rr.range(-40, 8)], groundAt,
      (x, z, y) => y > (o.sandAll ? 99 : 1.3) && pathDist(x, z) > 1.1 && Math.hypot(x, z - 6) > 1.2);
    if (gp.length) group.add(groundCover('grass', gp, r, { night }));
  }

  // night life
  if (night && !o.noFireflies) {
    const ff = particles('fireflies', 60, { quality: ctx.quality, seed: spec.seed % 97, pos: [0, 1.4, -10], spread: [30, 2.5, 30] });
    group.add(ff);
    ticks.push(ff.userData.tick);
  }
  const hemi = cel.night
    // moonlit night: blue-grey and readable, not black (the palette already darkens)
    ? { sky: 0x7890c0, ground: 0x283040, intensity: 2.2 }
    : { sky: dusk ? 0xffb89a : 0x9ab8f0, ground: dusk ? 0x4a3020 : 0x3a3a24, intensity: sunUp ? 0.5 : 0.5 };
  const view = {
    group,
    ticks,
    groundAt,
    heightAt,
    pathDist,
    sides: sd,
    water,
    r,
    camera: { pos: [0, groundAt(0, 6) + 1.65, 6], look: [0, groundAt(0, -20) + 1.3, -20], fov: 62 },
    lights: { hemi, key: { fromSky: true, shadow: true, scale: 0.8 }, points: [] },
    envIntensity: cel.night ? 0.35 : 0.55,
    fog: cel.night ? { color: 0x080c16, density: 0.012 } : { color: dusk ? 0xd8a888 : 0xb8cce0, density: 0.006 },
    sky: { cloud: o.cloud ?? 0.45, haze: cel.night ? [0.06, 0.08, 0.14] : dusk ? [0.9, 0.62, 0.5] : [0.72, 0.82, 0.92] },
    grade: cel.night
      ? { exposure: 1.45, saturation: 0.75, contrast: 1.05, tint: [0.85, 0.95, 1.15], vignette: 0.45, bloom: 0.6, threshold: 1.2 }
      : { exposure: 0.82, saturation: 1.18, contrast: 1.1, tint: dusk ? [1.08, 0.98, 0.9] : [1.0, 1.0, 0.98], vignette: 0.32, bloom: 0.35, threshold: 1.6 },
    propAnchor: { x: 0, y: 0, z: 1.5, spread: 1.4, radius: 2.4 },
    peopleSpots: [[1.5, 0, -2.5], [-2.5, 0, -4], [3.5, 0, -5]],
    largeSpots: [[5, 0, -6], [-6, 0, -9], [0, 0, -14]],
    celestial: cel,
  };
  return view;
}

/** Adds a point light request (max 4 in the rig; later ones replace the last). */
export function addLight(view, l) {
  const pts = view.lights.points;
  if (pts.length < 4) pts.push(l);
}

export { flowers };
