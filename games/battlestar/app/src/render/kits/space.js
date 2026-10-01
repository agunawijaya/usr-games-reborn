// Biome 2 — deep space and the two orbits (rooms 32-68), seen from the Viper.
// Composition from data: the tropical planet's size comes from the room's
// true graph distance to the orbit (68); the battlestar's from the distance to
// the launch point (32); after turn 30 the carrier is a burning debris field.

import * as THREE from 'three';
import { DAYFILE } from '../../engine/battlestar.js';
import { makeSpace, makePlanet, bearingDir } from '../sky.js';
import { makeCarrier, makeRaider } from '../craft.js';
import { rng } from '../geo.js';
import { particles, glowSprite } from '../fx.js';
import { buildCockpitFrame, paintGauges } from '../viper-cockpit.js';

function distances(target) {
  const d = new Map([[target, 0]]);
  const q = [target];
  // reverse BFS over space links (who can reach target)
  while (q.length) {
    const u = q.shift();
    for (let r = 32; r <= 68; r++) {
      if (d.has(r)) continue;
      const l = DAYFILE[r].link;
      if ([0, 1, 2, 3, 4, 6].some((i) => l[i] === u)) { d.set(r, d.get(u) + 1); q.push(r); }
    }
  }
  return d;
}
const TO_ORBIT = distances(68);
const FROM_LAUNCH = (() => {
  const d = new Map([[32, 0]]);
  const q = [32];
  while (q.length) {
    const u = q.shift();
    const l = DAYFILE[u].link;
    for (const i of [0, 1, 2, 3, 4, 6]) {
      const v = l[i];
      if (v >= 32 && v <= 68 && !d.has(v)) { d.set(v, d.get(u) + 1); q.push(v); }
    }
  }
  return d;
})();

export function buildSpace(spec, ctx) {
  const r = rng(spec.seed);
  const group = new THREE.Group();
  const ticks = [];
  const n = spec.room;
  const facing = ctx.facingDeg;
  const backdrop = makeSpace((n * 0.37) % 13, n % 3);
  group.add(backdrop);
  ticks.push((t, dt, cam) => { backdrop.material.uniforms.uTime.value = t; if (cam) backdrop.position.copy(cam.position); });

  const sunDir = bearingDir(110, 25, facing);
  // the tropical planet
  const dist = TO_ORBIT.get(n) ?? 8;
  const planet = makePlanet(n === 67 ? 'blue' : 'tropical');
  const orbit = n === 68 || n === 67;
  if (orbit) {
    planet.scale.setScalar(900);
    planet.position.set(0, -960, -300);
    planet.rotation.set(Math.PI / 2, 0, 0.4); // look down on the tropics, not the ice cap
  } else {
    const size = 60 + 260 / (1 + dist * 0.9);
    const dir = bearingDir(200 + (n % 5) * 20, -18 - dist, facing);
    planet.scale.setScalar(size);
    planet.position.copy(dir.multiplyScalar(900));
  }
  planet.children.forEach((m) => { m.material.uniforms.uSunV.value.copy(sunDir); });
  group.add(planet);
  ticks.push((t) => { planet.userData.u.uTime.value = t; });
  // a second, blue planet far away (and vice versa at 67)
  const far = makePlanet(n === 67 ? 'tropical' : 'blue');
  far.scale.setScalar(orbit ? 30 : 18);
  far.position.copy(bearingDir(40 + (n % 7) * 8, 12, facing).multiplyScalar(900));
  far.children.forEach((m) => { m.material.uniforms.uSunV.value.copy(sunDir); });
  group.add(far);

  // sun
  const sun = glowSprite(0xfff0d8, 70, 1.1);
  sun.position.copy(sunDir.clone().multiplyScalar(880));
  group.add(sun);

  // the battlestar receding behind you, burning; gone after turn 30
  const fromLaunch = FROM_LAUNCH.get(n) ?? 9;
  if (fromLaunch <= 5 && !orbit) {
    // the battlestar hangs off to one side, receding as you fly away from the launch point
    const side = n % 2 ? 1 : -1;
    const pos = new THREE.Vector3(side * (380 + fromLaunch * 120), -40 - fromLaunch * 20, -800 - fromLaunch * 420);
    if (spec.flight.time <= 30) {
      const carrier = makeCarrier();
      carrier.position.copy(pos);
      carrier.lookAt(0, 0, 0);
      carrier.rotateY(0.9);
      group.add(carrier);
      for (let i = 0; i < 4; i++) {
        const f = glowSprite(0xff7a30, 60, 0);
        f.position.copy(pos).add(new THREE.Vector3(r.range(-80, 80), r.range(-30, 30), r.range(-200, 200)));
        group.add(f);
        const ph = r.range(0, 10);
        ticks.push((t) => { f.material.uniforms.uI.value = Math.pow(Math.max(0, Math.sin(t * 1.3 + ph)), 18) * 2.5; });
      }
    } else {
      const debris = particles('embers', 220, { quality: ctx.quality, seed: 5, spread: [600, 200, 600], vel: [0, 0, 0], swirl: 20, size: 14, life: 12, color: 0xff9a50, color2: 0x442222 });
      debris.position.copy(pos);
      group.add(debris);
      ticks.push(debris.userData.tick);
      const cloud = glowSprite(0xff6a30, 700, 0.5);
      cloud.position.copy(pos);
      group.add(cloud);
    }
  }
  // a surviving Cylon circling (after you broke off)
  if (spec.props.some((p) => p.obj === 14)) {
    const raider = makeRaider();
    raider.scale.setScalar(1.4);
    group.add(raider);
    ticks.push((t) => { raider.position.set(Math.cos(t * 0.4) * 90, 20 + Math.sin(t * 0.7) * 10, -160 + Math.sin(t * 0.4) * 60); raider.rotation.z = t; });
  }
  // cockpit frame and live gauges
  const cockpit = buildCockpitFrame(ctx.quality);
  paintGauges(cockpit.gauges, { torps: spec.flight.torps, fuel: spec.flight.fuel, clock: spec.flight.clock, heading: orbit ? 'ORBIT' : 'CRUISE', alert: spec.flight.fuel < 30, msg: 'FUEL LOW' });

  return {
    group,
    ticks,
    noDress: true,
    cameraAttach: cockpit.group,
    camera: { pos: [0, 0, 0], look: orbit ? [0, -0.35, -1] : [0, 0, -1], fov: 62 },
    lights: { hemi: { sky: 0x6a7aa8, ground: 0x0a0806, intensity: 0.35 }, key: { dir: sunDir.toArray(), color: 0xfff0dd, intensity: 2.2 }, points: [] },
    fog: null,
    background: 0x000000,
    sky: null,
    env: 'space',
    envIntensity: 0.9,
    sway: 0.4,
    grade: { exposure: 0.95, saturation: 1.05, contrast: 1.05, vignette: 0.5, bloom: 0.5, threshold: 1.6 },
  };
}
