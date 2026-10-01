// Kit dispatch + the steps shared by every biome: dressing the room with the
// objects and people the engine says are there, and darkness.

import * as THREE from 'three';
import { C } from '../../engine/battlestar.js';
import { rng } from '../geo.js';
import { prop, LARGE } from '../props.js';
import { person } from '../people.js';
import { buildShip } from './ship.js';
import { buildSpace } from './space.js';
import { buildAir } from './air.js';
import { buildCoast } from './coast.js';
import { buildForest } from './forest.js';
import { buildCave } from './cave.js';

const KITS = { ship: buildShip, space: buildSpace, air: buildAir, coast: buildCoast, forest: buildForest, cave: buildCave };

export function buildView(spec, ctx) {
  const kit = KITS[spec.biome] || buildCoast;
  const view = kit(spec, ctx);
  view.ticks = view.ticks || [];
  dress(view, spec, ctx);
  lighting(view, spec);
  const inner = view.update;
  view.update = (t, dt, cam) => {
    if (inner) inner.call(view, t, dt, cam);
    for (const f of view.ticks) f(t, dt, cam);
  };
  return view;
}

/** Places the room's objects and people. Their lights take free rig slots. */
function dress(view, spec, ctx) {
  if (view.noDress) return;
  const r = rng(spec.seed ^ 0x5bd1e995);
  const anchor = view.propAnchor || { x: 0, y: 0, z: -2.2, spread: 1.3, radius: 1.8 };
  const small = spec.props.filter((p) => !LARGE.has(p.obj) && !view.handles?.has(p.obj));
  const large = spec.props.filter((p) => LARGE.has(p.obj) && !view.handles?.has(p.obj));
  const lightsWanted = [];
  small.forEach((p, i) => {
    const { object, light, update } = prop(p.obj, { night: spec.night, quality: ctx.quality, seed: spec.seed + i });
    const n = small.length;
    const a = (n === 1 ? 0 : (i / (n - 1) - 0.5) * anchor.spread) + r.range(-0.1, 0.1);
    const rad = anchor.radius * r.range(0.85, 1.2);
    object.position.set(anchor.x + Math.sin(a) * rad, anchor.y + (view.groundAt ? view.groundAt(Math.sin(a) * rad, anchor.z - Math.cos(a) * rad * 0.7) : 0), anchor.z - Math.cos(a) * rad * 0.7);
    object.rotation.y = r.range(0, Math.PI * 2);
    view.group.add(object);
    if (update) view.ticks.push(update);
    if (light) lightsWanted.push({ ...light, pos: object.position.clone().add(new THREE.Vector3(...(light.offset || [0, 0.3, 0]))) });
  });
  large.forEach((p, i) => {
    const { object, light, update } = prop(p.obj, { night: spec.night, quality: ctx.quality, seed: spec.seed + 50 + i });
    const spot = (view.largeSpots || [[4, 0, -7], [-4.5, 0, -8], [0, 0, -11]])[i % 3];
    object.position.x += spot[0];
    object.position.z += spot[2];
    object.position.y += spot[1] + (view.groundAt ? view.groundAt(spot[0], spot[2]) : 0);
    if (p.obj === C.VIPER) object.rotation.y = -0.6;
    view.group.add(object);
    if (update) view.ticks.push(update);
    if (light) lightsWanted.push({ ...light, pos: object.position.clone().add(new THREE.Vector3(...(light.offset || [0, 0.5, 0]))) });
  });
  spec.people.forEach((o, i) => {
    const { object, light, update } = person(o, { night: spec.night, quality: ctx.quality, seed: spec.seed + 90 + i, seated: !!view.seated });
    const spots = view.peopleSpots || [[0, 0, -4.2], [-1.8, 0, -5.2], [1.9, 0, -5.4]];
    const s = spots[i % spots.length];
    object.position.set(s[0], s[1] + (view.groundAt && o !== C.BATHGOD ? view.groundAt(s[0], s[2]) : 0), s[2]);
    if (o === C.BATHGOD && view.waterLevel !== undefined) object.position.y = view.waterLevel;
    object.rotation.y = Math.atan2(-s[0], 4 - s[2]) * 0.8;
    view.group.add(object);
    if (update) view.ticks.push(update);
    if (light) lightsWanted.push({ ...light, pos: object.position.clone().add(new THREE.Vector3(0, 1.4, 0.6)) });
  });
  const pts = view.lights.points || (view.lights.points = []);
  for (const l of lightsWanted) {
    if (pts.length < 4) pts.push({ pos: [l.pos.x, l.pos.y, l.pos.z], color: l.color, intensity: l.intensity, distance: l.distance, flicker: l.flicker || 0 });
    else pts[pts.length - 1] = { pos: [l.pos.x, l.pos.y, l.pos.z], color: l.color, intensity: l.intensity, distance: l.distance, flicker: l.flicker || 0 };
  }
}

/** Darkness (CANTSEE): the room's own lights go out; only carried or lying light remains. */
function lighting(view, spec) {
  const L = spec.light;
  if (!L.cantsee && !L.dark) return;
  const cam = new THREE.Vector3(...view.camera.pos);
  if (L.dark) {
    view.lights = { hemi: { sky: 0x000000, ground: 0x000000, intensity: 0 }, key: null, points: [] };
    view.fog = { color: 0x000000, density: 0.4 };
    view.background = 0x000000;
    view.dark = true;
    view.group.visible = false;
    view.grade = { ...(view.grade || {}), exposure: 0.2, bloom: 0 };
    return;
  }
  // lit only by a lantern (held or lying here) or a match
  const pts = [];
  // a kerosene lantern throws light a long way in a dark cave
  if (L.lanternHeld) pts.push({ pos: [cam.x + 0.35, cam.y - 0.25, cam.z - 0.6], color: 0xffa050, intensity: 65, distance: 0, decay: 1.6, flicker: 0.25 });
  else if (L.lantern) {
    const lp = (view.lights.points || []).find((p) => p.color === 0xffa050);
    pts.push(lp ? { ...lp, intensity: 110, distance: 0 } : { pos: [0.5, 0.5, -2.2], color: 0xffa050, intensity: 110, distance: 0, flicker: 0.3 });
  }
  if (L.match) pts.push({ pos: [cam.x + 0.25, cam.y - 0.2, cam.z - 0.5], color: 0xffb070, intensity: 14, distance: 0, flicker: 0.8 });
  // keep glowing things that belong to the room (Dark Lord's blade, artifacts, the fire below the abyss)
  for (const p of view.lights.points || []) {
    if (pts.length < 4 && (p.color === 0xa060ff || p.color === 0xffcf70 || p.color === 0x9ad8ff || p.color === 0xffd9a0 || p.color === 0xff6a20)) pts.push(p);
  }
  view.lights = { hemi: { sky: 0x2a1a10, ground: 0x000000, intensity: 0.06 }, key: null, points: pts };
  view.fog = { color: 0x000000, density: 0.06 };
  view.background = 0x000000;
  // no ambient image-based light either: polished things (the gold throne)
  // would mirror a lit environment that is not there
  view.envIntensity = 0.06;
  view.grade = { ...(view.grade || {}), exposure: (view.grade?.exposure ?? 1) * 1.1 };
}
