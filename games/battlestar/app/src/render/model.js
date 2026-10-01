// Procedural modelling toolkit: the shapes furniture and fittings are made
// of, so that nothing in a room is a bare box. Everything is generated
// geometry (ADR-002):
//   roundedBoxGeo  a box whose every edge and corner is rounded (exact normals)
//   cushionGeo     a rounded box inflated like an upholstered cushion or pillow
//   drapeGeo       a cloth (duvet, throw, tablecloth) lying on a block and
//                  hanging over its sides with folds
//   tuftedGeo      a buttoned upholstery panel (headboards, chair backs)
//   latheGeo       a turned profile (legs, lamp bases, vases, knobs)
//   profileRun     a moulding profile extruded along a run (skirting, cornice,
//                  architraves, frames)
//   blobGeo        a flat organic outline with a rounded rim (rugs, pelts)
// Scene convention (geo.js): -Z ahead, +X right, Y up; sizes in metres.

import * as THREE from 'three';
import { mesh } from './geo.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Level of detail. On the Low rung (ADR-011, a CPU rasteriser) every rounded
// edge gets one segment instead of three, cushions and cloths a coarser grid:
// the scenes keep their shapes at roughly half the triangles. The stage sets
// it before each room is built.
let LOW = false;
/** 'low' or 'high': how finely the pieces built from now on are tessellated. */
export function setDetail(quality) { LOW = quality === 'low'; }
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Recomputes normals and averages them across coincident vertices (no seams on smooth shapes). */
export function weldNormals(geo, eps = 1e-4) {
  geo.computeVertexNormals();
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  const groups = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${Math.round(p.getX(i) / eps)},${Math.round(p.getY(i) / eps)},${Math.round(p.getZ(i) / eps)}`;
    let g = groups.get(k);
    if (!g) groups.set(k, (g = [0, 0, 0, []]));
    g[0] += n.getX(i); g[1] += n.getY(i); g[2] += n.getZ(i); g[3].push(i);
  }
  for (const [x, y, z, ids] of groups.values()) {
    const l = Math.hypot(x, y, z) || 1;
    for (const i of ids) n.setXYZ(i, x / l, y / l, z / l);
  }
  n.needsUpdate = true;
  return geo;
}

/**
 * A box with every edge rounded to radius r. `seg` steps per rounded edge,
 * `mid` subdivisions across each flat face (for later displacement).
 * Normals are exact (the direction from the inner box), so shading is smooth.
 */
export function roundedBoxGeo(w, h, d, r = 0.03, seg = 3, mid = 1) {
  if (LOW) { seg = Math.min(seg, 1); mid = Math.min(mid, 5); }
  r = Math.min(r, w / 2, h / 2, d / 2) * 0.999;
  const n = seg * 2 + mid;
  const g = new THREE.BoxGeometry(1, 1, 1, n, n, n);
  const p = g.attributes.position;
  const nm = g.attributes.normal;
  const half = [w / 2, h / 2, d / 2];
  const remap = (u, hw) => {
    const i = Math.round((u + 0.5) * n);
    if (i <= seg) return -hw + r * (i / seg);
    if (i >= n - seg) return hw - r * ((n - i) / seg);
    return -hw + r + ((i - seg) / mid) * (2 * hw - 2 * r);
  };
  const v = new THREE.Vector3();
  const inner = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(remap(p.getX(i), half[0]), remap(p.getY(i), half[1]), remap(p.getZ(i), half[2]));
    inner.set(clamp(v.x, -half[0] + r, half[0] - r), clamp(v.y, -half[1] + r, half[1] - r), clamp(v.z, -half[2] + r, half[2] - r));
    const dx = v.x - inner.x;
    const dy = v.y - inner.y;
    const dz = v.z - inner.z;
    const L = Math.hypot(dx, dy, dz);
    if (L > 1e-7) {
      v.set(inner.x + (dx / L) * r, inner.y + (dy / L) * r, inner.z + (dz / L) * r);
      nm.setXYZ(i, dx / L, dy / L, dz / L);
    }
    p.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}

/** Mesh helper: a rounded box sitting with its base at y = 0 unless `center`. */
export function rbox(w, h, d, r, material, o = {}) {
  const g = roundedBoxGeo(w, h, d, r, o.seg ?? 3);
  if (!o.center) g.translate(0, h / 2, 0);
  return mesh(g, material, o);
}

/**
 * An upholstered cushion: a rounded box whose top (and less the bottom)
 * swells toward the middle, with slightly pinched corners.
 * puff: extra height at the centre as a fraction of h.
 */
export function cushionGeo(w, h, d, { r = 0.05, puff = 0.35, under = 0.3, pinch = 0.12, seg = 4, mid = 10 } = {}) {
  const g = roundedBoxGeo(w, h, d, r, seg, mid);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (w / 2);
    const z = p.getZ(i) / (d / 2);
    const y = p.getY(i);
    const bulge = (1 - x * x * x * x) * (1 - z * z * z * z);
    const k = y > 0 ? puff : puff * under;
    p.setY(i, y + Math.sign(y) * k * h * bulge * Math.min(1, Math.abs(y) / (h / 2)));
    // pinched corners: pull the corner regions in a little
    const c = Math.max(0, Math.abs(x) + Math.abs(z) - 1.3) * pinch;
    p.setX(i, p.getX(i) * (1 - c));
    p.setZ(i, p.getZ(i) * (1 - c));
  }
  return weldNormals(g);
}

/**
 * A cloth lying on a block (w × d, top surface at y = top) and hanging over
 * the two long sides and the foot (+z), with an open head edge at -d/2.
 * The part over an edge wraps a radius `r`, then falls `drop` metres.
 * folds: hanging folds per metre; foldAmp: their depth; wrinkle: small
 * creases on top; puff: body thickness at the middle (a duvet).
 */
export function drapeGeo({ w, d, top, drop = 0.35, r = 0.07, res = 72, folds = 3.2, foldAmp = 0.03, wrinkle = 0.006, puff = 0.05, flare = 0.12, foot = true, seed = 1 }) {
  if (LOW) res = Math.max(16, Math.round(res * 0.5));
  const arc = (r * Math.PI) / 2;
  const L = arc + drop;
  const x0 = -(w / 2 + L);
  const x1 = w / 2 + L;
  const z0 = -d / 2;
  const z1 = foot ? d / 2 + L : d / 2;
  const nx = res;
  const nz = Math.round(res * ((z1 - z0) / (x1 - x0)) * 1.2) + 8;
  const pos = [];
  const uv = [];
  const idx = [];
  const ph = seed * 1.7;
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const a = x0 + (x1 - x0) * (i / nx);
      const b = z0 + (z1 - z0) * (j / nz);
      const ex = Math.max(0, Math.abs(a) - w / 2);
      const ez = foot ? Math.max(0, b - d / 2) : 0;
      // corners fall like a cone; cap them so they do not reach the floor
      const s0 = Math.hypot(ex, ez);
      const s = Math.min(s0, L * 1.08);
      const dx = s0 > 0 ? (Math.sign(a) * ex) / s0 : 0;
      const dz = s0 > 0 ? ez / s0 : 0;
      let out;
      let down;
      if (s <= arc) { const th = s / r; out = r * Math.sin(th); down = r * (1 - Math.cos(th)); } else { out = r + (s - arc) * flare; down = r + (s - arc); }
      let x = clamp(a, -w / 2, w / 2) + dx * out;
      let z = Math.min(b, d / 2) + dz * out;
      let y = top - down;
      // body: thicker in the middle, thinner at the edges
      if (s === 0) {
        const u = a / (w / 2);
        const v = (b - z0) / d;
        y += puff * (1 - u * u) * smooth(0, 0.08, v) + wrinkle * (Math.sin(a * 23 + b * 7 + ph) * Math.sin(b * 17 - a * 5 + ph * 0.7) + 0.5 * Math.sin(a * 41 - b * 29));
      } else {
        // hanging folds: along the edge they swing out and in, growing toward the hem
        const t = ez > ex ? a : b;
        const hang = smooth(arc * 0.5, arc + drop * 0.6, s);
        const f = Math.sin(t * folds * Math.PI * 2 + ph) + 0.45 * Math.sin(t * folds * 4.7 + ph * 2.3) + 0.25 * Math.sin(t * folds * 9.1 + ph);
        x += dx * foldAmp * f * hang;
        z += dz * foldAmp * f * hang;
        // along the edge the cloth bunches a little
        x += dz * foldAmp * 0.3 * Math.cos(t * folds * 6.28 + ph) * hang;
        z += dx * foldAmp * 0.3 * Math.cos(t * folds * 6.28 + ph) * hang;
        // uneven hem
        y += foldAmp * 0.4 * Math.sin(t * folds * 3.1 + ph) * smooth(arc, L, s);
      }
      pos.push(x, y, z);
      uv.push(i / nx, j / nz);
    }
  }
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + nx + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * A buttoned (tufted) upholstery panel, w × h, facing +z, depth `depth`.
 * Buttons sit on a diamond lattice (cols × rows); the fabric puffs between
 * them and rolls over the edges.
 */
export function tuftedGeo(w, h, { cols = 6, rows = 3, depth = 0.08, edge = 0.05, res = 90 } = {}) {
  if (LOW) res = Math.max(30, Math.round(res * 0.5));
  const nx = res;
  const ny = Math.max(12, Math.round(res * (h / w)));
  const pos = [];
  const uv = [];
  const idx = [];
  const sx = w / cols;
  const sy = h / (rows + 0.5);
  const buttons = [];
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const x = -w / 2 + (i + (j % 2 ? 0.5 : 0)) * sx;
      const y = -h / 2 + (j + 0.25) * sy + sy * 0.25;
      if (x > -w / 2 + edge && x < w / 2 - edge && y > -h / 2 + edge && y < h / 2 - edge) buttons.push([x, y]);
    }
  }
  const rad = Math.min(sx, sy) * 0.75;
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = -w / 2 + (w * i) / nx;
      const y = -h / 2 + (h * j) / ny;
      let dmin = 9;
      for (const [bx, by] of buttons) dmin = Math.min(dmin, Math.hypot((x - bx) * 0.9, (y - by) * 1.1));
      const pad = Math.pow(smooth(0, rad, dmin), 0.7);
      const rim = Math.min(x + w / 2, w / 2 - x, y + h / 2, h / 2 - y);
      const roll = Math.sqrt(clamp(rim / edge, 0, 1));
      pos.push(x, y, depth * (0.35 + 0.65 * pad) * roll);
      uv.push(i / nx, j / ny);
    }
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + nx + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.userData.buttons = buttons.map(([x, y]) => [x, y, depth * 0.35]);
  return g;
}

/** A turned profile: points [[radius, y], ...] from bottom to top. */
export function latheGeo(profile, seg = 24) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r), y));
  const g = new THREE.LatheGeometry(pts, seg);
  g.computeVertexNormals();
  return g;
}

/**
 * A moulding: a 2-D profile [[out, up], ...] (out = distance from the wall,
 * up = height) extruded along a run of length `len`. The result runs along
 * local x (centred) and projects toward -z; place it with rotation.y so that
 * -z points into the room (near wall 0, far wall π, left wall -π/2, right π/2).
 */
export function profileRun(profile, len, material, o = {}) {
  // profiles start and end on the wall (out = 0); the wall edge closes the shape
  const shape = new THREE.Shape(profile.map(([out, up]) => new THREE.Vector2(out, up)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -len / 2);
  g.rotateY(Math.PI / 2);
  g.computeVertexNormals();
  return mesh(g, material, o);
}

/** Classic profiles (metres). */
export const PROFILES = {
  skirting: [[0.0, 0.0], [0.018, 0.0], [0.018, 0.1], [0.014, 0.115], [0.016, 0.125], [0.008, 0.14], [0.004, 0.15], [0.0, 0.15]],
  cornice: [[0.0, -0.18], [0.012, -0.18], [0.02, -0.165], [0.03, -0.15], [0.06, -0.11], [0.09, -0.06], [0.11, -0.03], [0.12, -0.012], [0.12, 0.0], [0.0, 0.0]],
  rail: [[0.0, -0.03], [0.012, -0.03], [0.02, -0.018], [0.022, 0.0], [0.02, 0.018], [0.012, 0.03], [0.0, 0.03]],
  architrave: [[0.0, 0.0], [0.02, 0.0], [0.028, 0.02], [0.025, 0.05], [0.03, 0.07], [0.022, 0.09], [0.012, 0.1], [0.0, 0.1]],
  roundSkirting: [[0.0, 0.0], [0.03, 0.0], [0.04, 0.02], [0.04, 0.08], [0.03, 0.1], [0.0, 0.11]],
  cove: [[0.0, -0.25], [0.02, -0.2], [0.07, -0.12], [0.14, -0.05], [0.22, -0.01], [0.25, 0.0], [0.0, 0.0]],
};

/**
 * A flat organic outline (rug, pelt): a noisy ellipse rx × rz with a
 * rounded rim of thickness t, lying at y = 0.
 */
export function blobGeo(rx, rz, { t = 0.02, wobble = 0.12, lobes = 5, seed = 1, seg = 64 } = {}) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const k = 1 + wobble * (Math.sin(a * lobes + seed) * 0.6 + Math.sin(a * (lobes + 3) + seed * 2.1) * 0.4);
    const x = Math.cos(a) * rx * k;
    const z = Math.sin(a) * rz * k;
    if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: t * 0.4, bevelEnabled: true, bevelThickness: t * 0.3, bevelSize: t * 0.8, bevelSegments: 3, curveSegments: 4 });
  g.rotateX(Math.PI / 2);
  g.translate(0, t, 0);
  g.computeVertexNormals();
  return g;
}

/** A tube along points (rails, piping, cables). */
export function tubeGeo(points, radius = 0.02, seg = 48, closed = false) {
  const c = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed);
  return new THREE.TubeGeometry(c, seg, radius, 10, closed);
}
