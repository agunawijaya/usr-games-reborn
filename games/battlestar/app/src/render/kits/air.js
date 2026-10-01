// Biome 2b — airspace over the island (rooms 69-104 with flyhere). One
// deterministic island shared by every air room, seen from the Viper's
// cockpit; the camera is placed by what the room says you are flying over.

import * as THREE from 'three';
import { mat } from '../materials.js';
import { rng } from '../geo.js';
import { makeWater } from '../water.js';
import { particles, glowSprite } from '../fx.js';
import { celestial } from '../sky.js';
import { buildCockpitFrame, paintGauges } from '../viper-cockpit.js';

const SIZE = 5200;

/** The island: a mountainous interior, a lagoon on the east, a reef. */
function islandHeight(x, z) {
  const d = Math.hypot(x / 1.25, z) / 1500;
  const mask = Math.max(0, 1 - d * d);
  const ridge = Math.max(0, 1 - Math.abs(x * 0.6 + z * 0.3) / 700) * 260;
  const n = Math.sin(x * 0.004 + 1.3) * Math.cos(z * 0.005 - 0.7) * 60 + Math.sin(x * 0.013 - z * 0.011) * 25 + Math.sin(x * 0.041 + z * 0.037) * 8;
  let h = (mask * (40 + ridge * mask + n)) - (1 - mask) * 60 - 6;
  // the lagoon: a basin on the eastern shore behind a reef
  const lg = Math.hypot(x - 900, z + 200) / 420;
  if (lg < 1) h = Math.min(h, -3 + lg * lg * 8);
  return h;
}

const VIEWS = {
  approach: { at: [0, 0, 2600], alt: 220, look: [0, 60, 0] },
  mountains: { at: [-200, 0, 300], alt: 420, look: [300, 100, -500] },
  ocean: { at: [-2000, 0, 1400], alt: 140, look: [-1000, 0, 0] },
  beach: { at: [-600, 0, 1450], alt: 120, look: [-200, 0, 900] },
  lagoon: { at: [1500, 0, 300], alt: 180, look: [900, 0, -200] },
  plain: { at: [-500, 0, 400], alt: 200, look: [0, 30, -300] },
  gorge: { at: [120, 0, 600], alt: 90, look: [200, 60, -200] },
  plantation: { at: [300, 0, 900], alt: 160, look: [500, 20, 300] },
  coast: { at: [-1700, 0, -200], alt: 160, look: [-900, 0, -500] },
  village: { at: [1300, 0, 700], alt: 140, look: [900, 10, 200] },
  clearing: { at: [700, 0, 1100], alt: 150, look: [500, 20, 500] },
  shore: { at: [-1400, 0, 900], alt: 130, look: [-800, 0, 500] },
  valley: { at: [-300, 0, -300], alt: 260, look: [200, 40, -900] },
  tip: { at: [-2100, 0, 0], alt: 170, look: [-1500, 0, 200] },
  cottages: { at: [800, 0, -900], alt: 150, look: [500, 20, -500] },
  crest: { at: [100, 0, 0], alt: 380, look: [-600, 40, -800] },
  'wide-beach': { at: [300, 0, -1700], alt: 140, look: [100, 0, -1100] },
  fog: { at: [0, 0, 1200], alt: 200, look: [0, 200, 0] },
};

export function buildAir(spec, ctx) {
  const r = rng(spec.seed);
  const group = new THREE.Group();
  const ticks = [];
  const night = spec.night;
  const v = VIEWS[spec.place] || VIEWS.coast;
  // vary by room so rooms sharing a place do not look identical
  const jitter = [r.range(-250, 250), r.range(-250, 250)];
  const cam = new THREE.Vector3(v.at[0] + jitter[0], 0, v.at[2] + jitter[1]);
  cam.y = Math.max(islandHeight(cam.x, cam.z), 0) + v.alt;
  const look = new THREE.Vector3(v.look[0] + jitter[0] * 0.5, v.look[1], v.look[2] + jitter[1] * 0.5);
  // island terrain
  const res = ctx.quality === 'low' ? 110 : 200;
  const g = new THREE.PlaneGeometry(SIZE, SIZE, res, res);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const mask = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = islandHeight(x, z);
    pos.setY(i, h);
  }
  g.computeVertexNormals();
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i);
    const slope = 1 - g.attributes.normal.getY(i);
    mask[i * 4] = Math.max(0, Math.min(1, (h - 180) / 60)) * 0.6; // high meadows
    mask[i * 4 + 1] = Math.max(0, Math.min(1, (1.5 - h) / 3));
    mask[i * 4 + 2] = Math.max(0, Math.min(1, (slope - 0.18) / 0.12));
    mask[i * 4 + 3] = Math.max(0, Math.min(1, (9 - h) / 6)) * (h > -4 ? 1 : 0.4);
  }
  g.setAttribute('mask', new THREE.BufferAttribute(mask, 4));
  const land = new THREE.Mesh(g, mat('terrain', { c1: night ? 0x14240f : 0x2a5a1c, c2: night ? 0x2a3a1a : 0x6a8a3a, c3: night ? 0x2a2622 : 0x5a5248, q: [...new THREE.Color(night ? 0x5a5446 : 0xe8d8b0).toArray(), 0], mask: true, seed: 3 }));
  land.receiveShadow = true;
  group.add(land);
  const water = makeWater({ size: SIZE * 1.6, res: 120, level: 0, quality: ctx.quality, depthAt: (x, z) => -islandHeight(x, z) * 0.15, calm: 1, scale: 6, foam: 1, deep: 0x042a3a, shallow: 0x2ac0b0 });
  group.add(water);
  ticks.push(water.userData.tick);
  const cel = celestial(spec.light, ctx.facingDeg);
  water.userData.setSky({ sun: cel.night ? cel.moon : cel.sun, sunCol: cel.night ? 0xb8c8ff : 0xfff2dd, top: cel.night ? 0x0c1424 : 0x3a6ad0, horizon: cel.night ? 0x26324c : 0xb8d0e8, night: cel.night });
  // village lights at night
  if (night) {
    for (let i = 0; i < 12; i++) {
      const lp = glowSprite(0xffa050, 18, 0.9);
      lp.position.set(1000 + r.range(-120, 120), 14, 500 + r.range(-120, 120));
      group.add(lp);
    }
  }
  // clouds below and around
  const clouds = particles('mist', ctx.quality === 'low' ? 20 : 40, { quality: ctx.quality, seed: spec.seed % 71, pos: [cam.x, cam.y - 60, cam.z - 600], spread: [2400, 120, 2400], vel: [6, 0, 0], size: 9000, alpha: night ? 0.04 : 0.1, color: 0xffffff, color2: 0xf0f0f0, life: 60 });
  group.add(clouds);
  ticks.push(clouds.userData.tick);
  if (spec.place === 'fog') {
    const fog = particles('mist', 60, { quality: ctx.quality, seed: 5, pos: [cam.x, cam.y, cam.z - 200], spread: [900, 300, 900], vel: [0, 0, 20], size: 9000, alpha: 0.25, color: 0xd0d4d8, color2: 0xa8b0b8, life: 30 });
    group.add(fog);
    ticks.push(fog.userData.tick);
  }
  // cockpit: gauges from the engine
  const cockpit = buildCockpitFrame(ctx.quality);
  paintGauges(cockpit.gauges, { torps: spec.flight.torps, fuel: spec.flight.fuel, clock: spec.flight.clock, heading: spec.place === 'fog' ? 'NO VISIBILITY' : 'ATMOSPHERE', alert: spec.flight.fuel < 30, msg: 'FUEL LOW' });
  // Local frame: the stage camera sits at the origin; move the world instead.
  group.position.set(-cam.x, -cam.y, -cam.z);
  const lookLocal = look.clone().sub(cam).normalize();
  const fogColor = spec.place === 'fog' ? (night ? 0x2a2e34 : 0xc8ccd0) : cel.night ? 0x0a1020 : 0xa8c0d8;
  return {
    group,
    ticks,
    noDress: true,
    cameraAttach: cockpit.group,
    camera: { pos: [0, 0, 0], look: lookLocal.toArray(), fov: 62 },
    lights: { hemi: cel.night ? { sky: 0x7890c0, ground: 0x1a2030, intensity: 1.6 } : { sky: 0x9ab8f0, ground: 0x3a3a24, intensity: 0.55 }, key: { fromSky: true, shadow: false, scale: 0.9 }, points: [] },
    fog: { color: fogColor, density: spec.place === 'fog' ? 0.012 : 0.00032 },
    sky: { cloud: 0.55, haze: cel.night ? [0.06, 0.08, 0.14] : [0.72, 0.82, 0.92] },
    envIntensity: 0.6,
    sway: 0.7,
    grade: cel.night
      ? { exposure: 1.2, saturation: 0.8, contrast: 1.05, tint: [0.85, 0.95, 1.15], vignette: 0.5, bloom: 0.55, threshold: 1.2 }
      : { exposure: 0.85, saturation: 1.12, contrast: 1.08, vignette: 0.45, bloom: 0.35, threshold: 1.6 },
  };
}
