// What a ship leaves on the water when she is lost: her boats, pulled away by the crew who have
// abandoned her, and a field of wreckage (planks, spars, casks, gratings) that floats, drifts
// downwind and at last sinks. Everyone leaves in the boats: nobody is ever shown in the water
// (all-ages content). Cosmetic only, in world space, cleared with each new battle.

import * as THREE from 'three';

const BOAT_SPEED = 1.5; // m/s under oars
const BOAT_LIFE = 150; // s before a boat rows out of the picture
const DEBRIS_LIFE = 110; // s afloat before the wreckage sinks
const rnd = (a, b) => a + Math.random() * (b - a);

const wood = new THREE.MeshStandardMaterial({ color: '#6b4e33', roughness: 0.9 });
const darkWood = new THREE.MeshStandardMaterial({ color: '#4a3524', roughness: 0.9 });
const paleWood = new THREE.MeshStandardMaterial({ color: '#8f7350', roughness: 0.9 });
// the boats are open shells, seen from inside and out
const boatWood = new THREE.MeshStandardMaterial({ color: '#4a3524', roughness: 0.85, side: THREE.DoubleSide });
const shirtMats = ['#e9e4d6', '#3b4f73', '#cfc8b2', '#8a2f25'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
const skinMats = ['#f1c7a5', '#a8704a', '#7a4b2c', '#e8b68f'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));

const hullGeo = (() => {
  // an open half-round boat, 6.5 m long, pointed at both ends
  const g = new THREE.CylinderGeometry(1.0, 1.0, 6.5, 12, 6, true, Math.PI / 2, Math.PI);
  g.rotateX(Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i) / 3.25;
    const taper = 1 - z * z * 0.85;
    pos.setX(i, pos.getX(i) * taper);
    pos.setY(i, pos.getY(i) * (0.55 + 0.45 * taper));
  }
  g.computeVertexNormals();
  return g;
})();
const torsoGeo = new THREE.BoxGeometry(0.42, 0.55, 0.28);
const headGeo = new THREE.BoxGeometry(0.22, 0.24, 0.22);
const oarGeo = (() => {
  const g = new THREE.CylinderGeometry(0.04, 0.04, 4.2, 5);
  g.rotateZ(Math.PI / 2);
  g.translate(1.6, 0, 0); // pivots at the gunwale, the blade out over the water
  return g;
})();

function makeBoat(rowers) {
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(hullGeo, boatWood);
  hull.rotation.z = Math.PI; // the open side up
  hull.castShadow = true;
  boat.add(hull);
  const oars = [];
  for (let i = 0; i < rowers; i++) {
    const z = -2.0 + (i * 4) / Math.max(1, rowers - 1);
    const shirt = shirtMats[(i * 3 + rowers) % shirtMats.length];
    const torso = new THREE.Mesh(torsoGeo, shirt);
    torso.position.set(0, 0.35, z);
    const head = new THREE.Mesh(headGeo, skinMats[(i * 5 + rowers) % skinMats.length]);
    head.position.set(0, 0.75, z);
    boat.add(torso, head);
    for (const side of [1, -1]) {
      const oar = new THREE.Mesh(oarGeo, paleWood);
      oar.position.set(side * 0.85, 0.2, z);
      oar.rotation.y = side > 0 ? 0 : Math.PI;
      boat.add(oar);
      oars.push({ oar, side, torso });
    }
  }
  return { boat, oars };
}

function debrisField(center, size, burnt) {
  const count = Math.round(14 + size * 0.35);
  const pieces = [];
  const geos = [
    new THREE.BoxGeometry(2.6, 0.14, 0.38), // planks
    new THREE.CylinderGeometry(0.22, 0.18, 7, 7).rotateZ(Math.PI / 2), // a spar
    new THREE.CylinderGeometry(0.42, 0.42, 0.95, 9).rotateZ(Math.PI / 2), // casks
    new THREE.BoxGeometry(1.5, 0.12, 1.5), // hatch gratings
  ];
  const mats = burnt ? [darkWood, darkWood, wood, darkWood] : [paleWood, wood, wood, darkWood];
  const meshes = geos.map((g, i) => {
    const m = new THREE.InstancedMesh(g, mats[i], count);
    m.count = 0;
    m.frustumCulled = false;
    return m;
  });
  for (let i = 0; i < count; i++) {
    const kind = i % 10 === 0 ? 1 : i % 4 === 1 ? 2 : i % 5 === 2 ? 3 : 0;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * size * 0.45;
    pieces.push({
      kind,
      slot: meshes[kind].count++,
      x: center.x + Math.cos(a) * r,
      z: center.z + Math.sin(a) * r,
      vx: Math.cos(a) * rnd(0.6, 2.2),
      vz: Math.sin(a) * rnd(0.6, 2.2),
      yaw: Math.random() * Math.PI * 2,
      spin: rnd(-0.2, 0.2),
      phase: Math.random() * 10,
      sink: 0,
    });
  }
  return { meshes, pieces, age: 0 };
}

export class Wreckage {
  constructor(world) {
    this.world = world;
    this.boats = [];
    this.fields = [];
  }

  /** The crew abandon a ship that is sinking or on fire: her boats pull away from both sides. */
  launchBoats(visual) {
    // from the root down: a ship just loaded has not been drawn yet, so its world matrices are stale
    visual.root.updateMatrixWorld(true);
    const m = visual.body.matrixWorld;
    const count = visual.L > 50 ? 3 : visual.L > 36 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? -1 : 1;
      const along = (i - (count - 1) / 2) * visual.L * 0.22;
      const start = new THREE.Vector3(side * (visual.B / 2 + 2.6), 0, along).applyMatrix4(m);
      const away = new THREE.Vector3(side, 0, 0).transformDirection(m).setY(0).normalize();
      const { boat, oars } = makeBoat(visual.L > 40 ? 5 : 4);
      boat.position.copy(start);
      this.world.scene.add(boat);
      this.boats.push({ boat, oars, dir: away, age: -i * 1.5, phase: Math.random() * 6 });
    }
  }

  /** Wreckage where a ship went down or blew up. `size` is her length. */
  scatter(center, size, { burnt = false } = {}) {
    const field = debrisField(center, size, burnt);
    for (const mesh of field.meshes) this.world.scene.add(mesh);
    this.fields.push(field);
  }

  update(dt, time, windVec) {
    const w = this.world;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const one = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();
    for (let i = this.boats.length - 1; i >= 0; i--) {
      const b = this.boats[i];
      b.age += dt;
      if (b.age < 0) {
        b.boat.visible = false; // still being lowered on the far side of the hull
        continue;
      }
      b.boat.visible = true;
      // pull clear of the ship, a stroke at a time
      const stroke = Math.sin(time * 2.4 + b.phase);
      const surge = BOAT_SPEED * (0.75 + 0.25 * Math.max(0, stroke));
      b.boat.position.addScaledVector(b.dir, surge * dt * Math.min(1, b.age / 3));
      const x = b.boat.position.x;
      const z = b.boat.position.z;
      // the hull is a half-round a metre deep: about half of it sits below the water
      b.boat.position.y = w.waterHeight(x, z) + 0.5;
      const fwd = b.dir;
      const pitch = Math.atan2(w.waterHeight(x + fwd.x * 3, z + fwd.z * 3) - w.waterHeight(x - fwd.x * 3, z - fwd.z * 3), 6);
      b.boat.rotation.set(-pitch, Math.atan2(fwd.x, fwd.z), 0, 'YXZ');
      for (const o of b.oars) {
        o.oar.rotation.z = o.side * (0.25 + 0.2 * stroke);
        o.oar.rotation.y = (o.side > 0 ? 0 : Math.PI) + 0.45 * Math.cos(time * 2.4 + b.phase);
        o.torso.rotation.x = 0.25 * stroke;
      }
      if (b.age > BOAT_LIFE) {
        w.scene.remove(b.boat);
        this.boats.splice(i, 1);
      }
    }
    for (let f = this.fields.length - 1; f >= 0; f--) {
      const field = this.fields[f];
      field.age += dt;
      const drift = 0.25;
      for (const piece of field.pieces) {
        // spread from where she went down, then drift downwind; at the end, sink
        piece.vx *= 1 - Math.min(1, dt * 0.35);
        piece.vz *= 1 - Math.min(1, dt * 0.35);
        piece.x += (piece.vx + windVec.x * drift) * dt;
        piece.z += (piece.vz + windVec.y * drift) * dt;
        piece.yaw += piece.spin * dt;
        if (field.age > DEBRIS_LIFE) piece.sink += dt * 0.3;
        p.set(piece.x, w.waterHeight(piece.x, piece.z) + 0.05 - piece.sink, piece.z);
        e.set(0.12 * Math.sin(time * 1.3 + piece.phase), piece.yaw, 0.12 * Math.cos(time * 1.1 + piece.phase), 'YXZ');
        q.setFromEuler(e);
        m.compose(p, q, one);
        field.meshes[piece.kind].setMatrixAt(piece.slot, m);
      }
      for (const mesh of field.meshes) mesh.instanceMatrix.needsUpdate = true;
      if (field.age > DEBRIS_LIFE + 12) {
        for (const mesh of field.meshes) {
          w.scene.remove(mesh);
          mesh.geometry.dispose();
        }
        this.fields.splice(f, 1);
      }
    }
  }

  clear() {
    for (const b of this.boats) this.world.scene.remove(b.boat);
    for (const f of this.fields) for (const mesh of f.meshes) this.world.scene.remove(mesh);
    this.boats = [];
    this.fields = [];
  }
}
