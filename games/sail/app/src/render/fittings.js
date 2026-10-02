// Hull fittings that make a hull read as a warship of the period at a glance: raised wales that
// catch the light along the sheer, catheads with their anchors at the bow, head rails sweeping up
// to a gilded figurehead, and deadeyes along the channels. All geometry, no textures; built once
// per ship from the hull's own form, so every class gets fittings in proportion.

import * as THREE from 'three';

const lerp = (a, b, t) => a + (b - a) * t;

/** A point on the hull side at fraction u along the length and height y, pushed out by `out`. */
function sidePoint(form, u, y, side, out = 0) {
  const b = form.bottom(u);
  const t = Math.min(1, Math.max(0, (y - b) / (form.top(u) - b)));
  const p = form.section(u, t);
  return new THREE.Vector3(side * (p.x + out), p.y, p.z);
}

/** Heights follow the sheer the way the gun-port rows do. */
const sheered = (form, dim, u, y) => y + (form.top(u) - dim.F) * (y / dim.F);

function tube(points, radius, mat, segments = 48) {
  const curve = new THREE.CatmullRomCurve3(points);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 6, false), mat);
  mesh.castShadow = true;
  return mesh;
}

/** Thick strakes standing proud of the planking: the main wale below the guns, a second above. */
function wales(h, mat) {
  const { form, dim, ports } = h;
  const lowest = Math.min(...ports.map((p) => p.y));
  const heights = [lowest - 0.85, lowest + 0.75 + (dim.decks - 1) * 2.35];
  const group = new THREE.Group();
  for (const y0 of heights) {
    for (const side of [1, -1]) {
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const u = lerp(0.03, 0.965, i / 24);
        pts.push(sidePoint(form, u, sheered(form, dim, u, y0), side, 0.06));
      }
      group.add(tube(pts, 0.17, mat));
    }
  }
  return group;
}

function anchor(mat, woodMat) {
  const g = new THREE.Group();
  const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3.4, 8), mat);
  shank.position.y = -1.7;
  g.add(shank);
  // the arms: an arc at the crown with a fluke at each end
  const arms = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.12, 6, 14, Math.PI * 0.75), mat);
  arms.rotation.z = Math.PI + Math.PI * 0.125;
  arms.position.y = -2.45;
  g.add(arms);
  for (const s of [1, -1]) {
    const fluke = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.6, 4), mat);
    fluke.position.set(s * 0.98, -2.15, 0);
    fluke.rotation.z = s * 0.4;
    g.add(fluke);
  }
  // the wooden stock across the top, at right angles to the arms
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 3.0), woodMat);
  stock.position.y = -0.25;
  g.add(stock);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 12), mat);
  ring.position.y = 0.1;
  g.add(ring);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** Catheads projecting from the bow, each with its anchor hung ready. */
function groundTackle(h, ironMat, woodMat) {
  const { form, railX } = h;
  const group = new THREE.Group();
  const u = 0.915;
  const scale = Math.max(0.7, Math.min(1.25, h.dim.L / 46));
  for (const side of [1, -1]) {
    const x = railX(u);
    const y = form.top(u) - 0.5;
    const z = form.zOf(u);
    const cat = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.42, 0.42), woodMat);
    cat.position.set(side * (x + 0.7), y, z - 0.4);
    cat.rotation.y = side * 0.35;
    cat.castShadow = true;
    group.add(cat);
    // catted: hung from the cathead with the shank down the bow and the flukes against the hull
    const a = anchor(ironMat, woodMat);
    a.scale.setScalar(scale);
    a.position.set(side * (x + 1.1), y - 0.2, z - 0.7);
    a.rotation.set(0.05, side * 0.35, side * 0.16);
    group.add(a);
  }
  return group;
}

/** Head rails sweeping from the stem to the bow, and a gilded figure under the bowsprit. */
function head(h, trimMat, gildMat) {
  const { form } = h;
  const group = new THREE.Group();
  const stemZ = form.zOf(1);
  const stemTop = form.top(1);
  for (const side of [1, -1]) {
    for (const k of [0, 1]) {
      const start = new THREE.Vector3(side * 0.25, stemTop - 2.6 + k * 0.9, stemZ - 1.6);
      const mid = sidePoint(form, 0.975, stemTop - 1.8 + k * 0.7, side, 0.05);
      const end = sidePoint(form, 0.925, form.top(0.925) - 1.2 + k * 0.6, side, 0.05);
      group.add(tube([start, mid, end], 0.09, trimMat, 16));
    }
  }
  // the figure: a body leaning out along the stem, head up, gilt catching the sun
  const figure = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.5, 4, 10), gildMat);
  body.rotation.x = -1.05;
  figure.add(body);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), gildMat);
  face.position.set(0, 0.75, -0.55);
  figure.add(face);
  figure.position.set(0, stemTop - 2.5, stemZ - 1.9);
  figure.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  group.add(figure);
  return group;
}

/** A row of deadeyes along each channel, where the shrouds are set up. */
function deadeyes(h, mat) {
  const { form, railX } = h;
  const geo = new THREE.CylinderGeometry(0.2, 0.2, 0.12, 10);
  geo.rotateZ(Math.PI / 2);
  const count = h.mastUs.length * 2 * 5;
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  let k = 0;
  for (const u of h.mastUs) {
    for (const side of [1, -1]) {
      for (let i = 0; i < 5; i++) {
        const uu = u + lerp(-0.02, 0.035, i / 4);
        m.makeTranslation(side * (railX(uu) + 0.72), form.top(uu) - 0.55, form.zOf(uu));
        mesh.setMatrixAt(k++, m);
      }
    }
  }
  mesh.count = k;
  return mesh;
}

/**
 * Adds the fittings to `h.group`. `h.mastUs` are the mast positions along the hull (rig.js).
 */
export function addFittings(h) {
  const tar = new THREE.MeshStandardMaterial({ color: h.paint.wale, roughness: 0.45 });
  const wood = new THREE.MeshStandardMaterial({ color: '#4a3524', roughness: 0.85 });
  const iron = new THREE.MeshStandardMaterial({ color: '#202124', roughness: 0.55, metalness: 0.7 });
  const trim = new THREE.MeshStandardMaterial({ color: h.paint.trim, roughness: 0.6 });
  const gild = new THREE.MeshStandardMaterial({ color: '#c9a24a', roughness: 0.35, metalness: 0.75 });
  h.group.add(wales(h, tar), groundTackle(h, iron, wood), head(h, trim, gild), deadeyes(h, tar));
}
