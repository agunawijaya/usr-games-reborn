// Outdoor layout: what lies on each side of the player (from the room's own
// text and its neighbours), a heightfield shaped by it, and paths along the
// real exits. Scene space: -Z ahead, +X right.

import * as THREE from 'three';
import { mat } from './materials.js';

export const DIRS = { ahead: [0, -1], right: [1, 0], back: [0, 1], left: [-1, 0] };

const WATERY = new Set(['sea', 'water', 'lagoon']);
const WATER_PLACES = new Set(['lagoon', 'lagoon-mouth', 'drowning', 'dock']);
const BEACHY = new Set(['beach', 'beach-wide', 'beach-rocky', 'beach-palms', 'tidepools', 'shore-cliff', 'dunes']);

/**
 * Decides what each side holds: 'sea' | 'lagoon' | 'cliff' | 'forest' | 'grove' |
 * 'field' | 'building' | 'hills' | 'open'.
 */
export function sides(spec) {
  const out = {};
  const a = spec.around;
  const place = spec.place;
  for (const k of ['ahead', 'right', 'back', 'left']) {
    const s = a[k];
    const m = new Set(s.marks);
    let kind = 'open';
    if (m.has('sea') || m.has('beach') && !s.exit) kind = 'sea';
    else if (m.has('lagoon') || m.has('water')) kind = spec.features.includes('lagoon') || place.startsWith('lagoon') ? 'lagoon' : 'sea';
    else if (m.has('cliff') || m.has('hills')) kind = 'cliff';
    else if (m.has('forest') || m.has('ferns') || m.has('canyon')) kind = 'forest';
    else if (m.has('grove')) kind = 'grove';
    else if (m.has('field')) kind = 'field';
    else if (m.has('house') || m.has('village') || m.has('door')) kind = 'building';
    else if (s.biome === 'forest') kind = 'forest';
    else if (s.place && WATER_PLACES.has(s.place) && !s.exit) kind = 'lagoon';
    else if (s.place === 'grove' || s.place === 'orchard') kind = 'grove';
    else if (s.place === 'field') kind = 'field';
    out[k] = { kind, exit: s.exit, loop: s.loop, road: m.has('road') || m.has('path') || s.place === 'road' || s.place === 'coast-road' };
  }
  // Beaches need the sea somewhere: prefer a side without an exit, visible first.
  const hasWater = Object.values(out).some((v) => v.kind === 'sea' || v.kind === 'lagoon');
  if (!hasWater && (BEACHY.has(place) || place === 'cliff-lookout')) {
    const pick = ['left', 'right', 'ahead', 'back'].find((k) => !out[k].exit) || 'back';
    out[pick].kind = 'sea';
  }
  if (!hasWater && WATER_PLACES.has(place)) {
    const pick = ['ahead', 'left', 'right', 'back'].find((k) => !out[k].exit) || 'ahead';
    out[pick].kind = place === 'lagoon-mouth' ? 'sea' : 'lagoon';
  }
  return out;
}

/** Builds the height function for a set of sides. */
export function heightFunction(sd, r, { base = 1.0, rough = 1, shore = 14, cliffH = 18, flatRadius = 7, basin = null } = {}) {
  const phase = [r.range(0, 100), r.range(0, 100)];
  const n2 = (x, z) => Math.sin(x * 0.11 + phase[0]) * Math.cos(z * 0.13 + phase[1]) + 0.5 * Math.sin(x * 0.27 - z * 0.21 + phase[1]);
  const ents = Object.entries(sd);
  return (x, z) => {
    let h = base + n2(x, z) * 0.35 * rough;
    const d0 = Math.hypot(x, z);
    for (const [k, v] of ents) {
      const [dx, dz] = DIRS[k];
      const along = x * dx + z * dz;
      const across = Math.abs(x * dz - z * dx);
      const cone = Math.max(0, 1 - across / (Math.abs(along) + 30));
      if (v.kind === 'sea' || v.kind === 'lagoon') {
        const t = (along - shore) / 10;
        // the drop always goes well below sea level, whatever the base height
        h -= Math.max(0, Math.min(1, t)) * (base + (v.kind === 'sea' ? 4.5 : 3)) * cone + Math.max(0, t - 1) * 0.6 * cone;
      } else if (v.kind === 'cliff') {
        const t = (along - 18) / 14;
        h += Math.max(0, Math.min(1, t)) * cliffH * cone * (0.8 + 0.2 * Math.sin(x * 0.3 + z * 0.2));
      } else if (v.kind === 'hills') {
        h += Math.max(0, (along - 30) / 40) * 10 * cone;
      }
    }
    if (basin) {
      const bd = Math.hypot(x - basin.x, z - basin.z);
      h -= Math.max(0, Math.min(1, (basin.r - bd) / 6)) * (base + basin.depth);
    }
    // keep the player's patch flat
    const flat = Math.max(0, 1 - d0 / flatRadius);
    return h * (1 - flat * 0.8) + base * flat * 0.8;
  };
}

/** Path polylines for the exits: from the player's spot out along each side. */
export function exitPaths(sd, r) {
  const paths = [];
  for (const [k, v] of Object.entries(sd)) {
    if (!v.exit || k === 'back') continue;
    const [dx, dz] = DIRS[k];
    const bend = r.range(-0.35, 0.35);
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const d = 1 + t * 70;
      const off = Math.sin(t * 2.2) * bend * d * 0.25;
      pts.push([dx * d - dz * off, dz * d + dx * off]);
    }
    paths.push({ side: k, pts, road: v.road });
  }
  // behind the camera, so the player stands on a path
  if (sd.back.exit) paths.push({ side: 'back', pts: [[0, 1], [0, 40]], road: sd.back.road });
  return paths;
}

function distToPaths(x, z, paths) {
  let best = 1e9;
  for (const p of paths) {
    for (let i = 0; i < p.pts.length - 1; i++) {
      const [ax, az] = p.pts[i];
      const [bx, bz] = p.pts[i + 1];
      const vx = bx - ax;
      const vz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
      const d = Math.hypot(x - ax - vx * t, z - az - vz * t);
      if (d < best) best = d;
    }
  }
  return best;
}

/**
 * Terrain mesh with a mask attribute (r path, g wet, b rock, a sand).
 * @returns {{ mesh, groundAt, pathDist }}
 */
export function makeTerrain({ size = 170, res = 110, heightAt, paths = [], pathWidth = 1.6, sandAll = false, sandLevel = 1.1, rockSlope = 0.9, colors, seed = 1, quality = 'high' }) {
  const n = quality === 'low' ? Math.round(res * 0.6) : res;
  const g = new THREE.PlaneGeometry(size, size, n, n);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, -size * 0.32);
  const pos = g.attributes.position;
  const mask = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
  }
  g.computeVertexNormals();
  const nrm = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = pos.getY(i);
    const pd = paths.length ? distToPaths(x, z, paths) : 99;
    const path = Math.max(0, 1 - pd / pathWidth);
    const slope = 1 - nrm.getY(i);
    const sand = sandAll ? 1 : Math.max(0, Math.min(1, (sandLevel - y) / 0.8));
    const wet = Math.max(0, Math.min(1, (0.35 - y) / 0.5));
    const rock = Math.max(0, Math.min(1, (slope - rockSlope * 0.25) / 0.2));
    mask[i * 4] = path;
    mask[i * 4 + 1] = wet;
    mask[i * 4 + 2] = rock;
    mask[i * 4 + 3] = sand;
  }
  g.setAttribute('mask', new THREE.BufferAttribute(mask, 4));
  const m = mat('terrain', { c1: colors.grass, c2: colors.dirt, c3: colors.rock, q: [...new THREE.Color(colors.sand).toArray(), 0], mask: true, seed });
  const mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = true;
  return { mesh, groundAt: heightAt, pathDist: (x, z) => (paths.length ? distToPaths(x, z, paths) : 99) };
}
