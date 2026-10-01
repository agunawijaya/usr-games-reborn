// trek/procedural-web — procedural geometry helpers for hulls.
//
// Ships are built from three primitives, all in a local frame where the
// bow points +X, width runs along Z and height along Y:
//   loft()        a hull skinned over cross-sections placed along X
//   plate()       a flat plan-view outline (blade, wing, fin) with thickness
//   bell()        an engine nozzle turned on a lathe, opening towards −X
// plus helpers to sample points on a loft (for windows and greebles).

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Cross-section profiles: closed loops of [lateral, vertical] in [-1, 1].
// ---------------------------------------------------------------------------

export const PROFILE = {
  /** Rectangle with chamfered corners — armoured, faceted. */
  chamfer(c = 0.45) {
    return [[1, -c], [1, c], [c, 1], [-c, 1], [-1, c], [-1, -c], [-c, -1], [c, -1]];
  },
  /** Flat keel, peaked spine: reads as a warship from above. */
  keel(peak = 1, shoulder = 0.45) {
    return [[1, -0.35], [1, shoulder], [0.35, peak], [-0.35, peak], [-1, shoulder], [-1, -0.35], [-0.5, -0.8], [0.5, -0.8]];
  },
  diamond() {
    return [[1, 0], [0.35, 0.8], [0, 1], [-0.35, 0.8], [-1, 0], [-0.35, -0.7], [0, -0.85], [0.35, -0.7]];
  },
  /** Thin lens — for wings lofted along their chord. */
  lens(n = 10, thin = 1) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.cos(a), y = Math.sin(a);
      pts.push([x, y * thin * (0.35 + 0.65 * (1 - Math.abs(x)))]);
    }
    return pts;
  },
  circle(n = 16) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push([Math.cos(a), Math.sin(a)]);
    }
    return pts;
  },
};

/**
 * Skin a hull over stations along +X.
 * @param stations [{ x, w, h, y = 0, z = 0 }] ordered bow→stern or stern→bow
 * @param profile  closed loop from PROFILE
 * @param opts     { tile: world units per texture repeat, capStart, capEnd }
 */
export function loft(stations, profile, { tile = 0.5, capStart = true, capEnd = true } = {}) {
  const n = profile.length;
  const pos = [];
  const uv = [];
  const idx = [];
  // Perimeter (normalised profile, scaled per station) for u.
  let vAcc = 0;
  for (let i = 0; i < stations.length; i++) {
    const s = stations[i];
    if (i > 0) {
      const p = stations[i - 1];
      vAcc += Math.hypot(s.x - p.x, (s.y ?? 0) - (p.y ?? 0), ((s.w + s.h) - (p.w + p.h)) * 0.25);
    }
    let uAcc = 0;
    for (let j = 0; j <= n; j++) {
      const [px, py] = profile[j % n];
      if (j > 0) {
        const [qx, qy] = profile[(j - 1) % n];
        uAcc += Math.hypot((px - qx) * s.w * 0.5, (py - qy) * s.h * 0.5);
      }
      pos.push(s.x, (s.y ?? 0) + py * s.h * 0.5, (s.z ?? 0) + px * s.w * 0.5);
      uv.push(uAcc / tile, vAcc / tile);
    }
  }
  const row = n + 1;
  for (let i = 0; i < stations.length - 1; i++) {
    for (let j = 0; j < n; j++) {
      const a = i * row + j, b = (i + 1) * row + j, c = i * row + j + 1, d = (i + 1) * row + j + 1;
      idx.push(a, b, c, c, b, d);
    }
  }
  const addCap = (i, flip) => {
    const s = stations[i];
    const centre = pos.length / 3;
    pos.push(s.x, s.y ?? 0, s.z ?? 0);
    uv.push(0.5, 0.5);
    for (let j = 0; j < n; j++) {
      const a = i * row + j, b = i * row + j + 1;
      if (flip) idx.push(centre, b, a); else idx.push(centre, a, b);
    }
  };
  if (capStart) addCap(0, false);
  if (capEnd) addCap(stations.length - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  orientOutward(g);
  g.computeVertexNormals();
  g.userData.loft = { stations, profile };
  return g;
}

/** Flip every triangle if the geometry's winding points inward. */
function orientOutward(g) {
  const p = g.attributes.position;
  const index = g.index.array;
  const c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) c.add(new THREE.Vector3().fromBufferAttribute(p, i));
  c.divideScalar(p.count);
  let score = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nrm = new THREE.Vector3(), mid = new THREE.Vector3();
  for (let t = 0; t < index.length; t += 3) {
    a.fromBufferAttribute(p, index[t]); b.fromBufferAttribute(p, index[t + 1]); d.fromBufferAttribute(p, index[t + 2]);
    e1.subVectors(b, a); e2.subVectors(d, a); nrm.crossVectors(e1, e2);
    mid.copy(a).add(b).add(d).divideScalar(3).sub(c);
    score += Math.sign(nrm.dot(mid)) * nrm.length();
  }
  if (score < 0) {
    for (let t = 0; t < index.length; t += 3) {
      const tmp = index[t + 1]; index[t + 1] = index[t + 2]; index[t + 2] = tmp;
    }
  }
}

/** Point + outward normal on a loft at fraction f ∈ [0,1] along its
 *  stations and profile angle index j (fractional allowed). */
export function loftPoint(geo, f, j) {
  const { stations, profile } = geo.userData.loft;
  const n = profile.length;
  const fi = Math.min(stations.length - 1.0001, Math.max(0, f * (stations.length - 1)));
  const i0 = Math.floor(fi), t = fi - i0;
  const s0 = stations[i0], s1 = stations[i0 + 1];
  const lerp = (a, b) => a + (b - a) * t;
  const s = { x: lerp(s0.x, s1.x), y: lerp(s0.y ?? 0, s1.y ?? 0), z: lerp(s0.z ?? 0, s1.z ?? 0), w: lerp(s0.w, s1.w), h: lerp(s0.h, s1.h) };
  const j0 = Math.floor(j) % n, j1 = (j0 + 1) % n, tj = j - Math.floor(j);
  const px = profile[j0][0] + (profile[j1][0] - profile[j0][0]) * tj;
  const py = profile[j0][1] + (profile[j1][1] - profile[j0][1]) * tj;
  const position = new THREE.Vector3(s.x, s.y + py * s.h * 0.5, s.z + px * s.w * 0.5);
  // Normal of the profile edge, in the YZ plane.
  const ex = profile[j1][0] - profile[j0][0], ey = profile[j1][1] - profile[j0][1];
  const normal = new THREE.Vector3(0, -ex * s.w, ey * s.h).normalize();
  const toOut = new THREE.Vector3(0, position.y - s.y, position.z - s.z);
  if (normal.dot(toOut) < 0) normal.negate();
  return { position, normal, width: s.w, height: s.h };
}

/**
 * Plan-view outline extruded along Y (thickness) with a bevel.
 * @param outline [[x, z], ...] in plan (x forward, z starboard)
 */
export function plate(outline, thickness = 0.04, { bevel = 0.012, tile = 0.4 } = {}) {
  const shape = new THREE.Shape();
  outline.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, z) : shape.lineTo(x, z)));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, thickness - bevel * 2), bevelEnabled: bevel > 0,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, steps: 1,
  });
  // Shape lives in XY; lay it in the XZ plane and centre the thickness.
  g.rotateX(Math.PI / 2);
  g.translate(0, thickness * 0.5 - bevel, 0);
  // Planar UVs from the plan view.
  const p = g.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = p.getX(i) / tile;
    uv[i * 2 + 1] = p.getZ(i) / tile;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** Mirror a plan outline across the centreline (z → −z), reversing winding. */
export function mirrorOutline(outline) {
  return outline.map(([x, z]) => [x, -z]).reverse();
}

/** Engine bell: lathe around +X, opening aft (towards −X). */
export function bell(radius = 0.1, length = 0.12, segments = 20) {
  const pts = [
    new THREE.Vector2(radius * 0.55, length),
    new THREE.Vector2(radius * 0.7, length * 0.7),
    new THREE.Vector2(radius * 0.92, length * 0.25),
    new THREE.Vector2(radius, 0),
    new THREE.Vector2(radius * 0.86, 0),
    new THREE.Vector2(radius * 0.6, length * 0.5),
  ];
  const g = new THREE.LatheGeometry(pts, segments);
  g.rotateZ(-Math.PI / 2);  // lathe axis Y → X: mouth at x=0, throat inside the hull at +x
  g.computeVertexNormals();
  return g;
}

/** Axis-aligned box helper with the bow along +X. */
export function box(lx, ly, lz) {
  return new THREE.BoxGeometry(lx, ly, lz);
}

/** Bounding radius in the XZ plane (for shields and explosion size). */
export function planRadius(object) {
  const box3 = new THREE.Box3().setFromObject(object);
  const sx = (box3.max.x - box3.min.x) * 0.5;
  const sz = (box3.max.z - box3.min.z) * 0.5;
  return { rx: sx, rz: sz, ry: (box3.max.y - box3.min.y) * 0.5, centre: box3.getCenter(new THREE.Vector3()) };
}
