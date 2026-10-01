// Tactical overlay drawn on the water: chart grid, range contours for each
// loaded broadside (the engine's distance metric is "long axis + half the
// short one", so the contours are octagons, not circles), firing arcs, and
// the ghost path of the helm order being composed.

import * as THREE from 'three';
import { CELL } from './world.js';
import { RANGE_OF_SHOT } from '../engine/index.js';

const DR = [0, 1, 1, 0, -1, -1, -1, 0, 1];
const DC = [0, 0, -1, -1, -1, 0, 1, 1, 1];
const Y = 1.2;

// Nationality colours: Okabe-Ito, safe for the common colour-vision
// deficiencies, and always paired with the glyph letter.
export const NATION_COLOR = ['#009E73', '#D55E00', '#E69F00', '#0072B2', '#CC79A7', '#56B4E9', '#F0E442', '#999999'];

function lineMat(color, opacity, dashed = false) {
  const m = dashed
    ? new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: 8, gapSize: 6, depthTest: false })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false });
  return m;
}

// Points on the engine's range contour distance == r (in cells).
function contour(r, n = 96) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a);
    const y = Math.sin(a);
    const ax = Math.abs(x);
    const ay = Math.abs(y);
    const t = r / (Math.max(ax, ay) + Math.min(ax, ay) / 2);
    pts.push(new THREE.Vector3(x * t * CELL, Y, y * t * CELL));
  }
  return pts;
}

export function createTactical(scene) {
  const root = new THREE.Group();
  root.renderOrder = 30;
  scene.add(root);

  // chart grid (re-centred on demand)
  const gridGroup = new THREE.Group();
  root.add(gridGroup);
  function buildGrid(center, halfCells = 70) {
    gridGroup.clear();
    const seg = [];
    const cx = Math.round(center.x / CELL);
    const cz = Math.round(center.z / CELL);
    for (let i = -halfCells; i <= halfCells; i++) {
      seg.push(new THREE.Vector3((cx + i) * CELL, Y, (cz - halfCells) * CELL), new THREE.Vector3((cx + i) * CELL, Y, (cz + halfCells) * CELL));
      seg.push(new THREE.Vector3((cx - halfCells) * CELL, Y, (cz + i) * CELL), new THREE.Vector3((cx + halfCells) * CELL, Y, (cz + i) * CELL));
    }
    const g = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg), lineMat('#e8dcc0', 0.22));
    g.renderOrder = 30;
    gridGroup.add(g);
  }

  const arcs = new THREE.Group();
  const rings = new THREE.Group();
  const ghost = new THREE.Group();
  const pieces = new THREE.Group();
  root.add(arcs, rings, ghost, pieces);

  // a dark wash over the sea so the chart reads cleanly from above
  const wash = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), new THREE.MeshBasicMaterial({ color: '#0b1a26', transparent: true, opacity: 0.62, depthTest: false }));
  wash.rotation.x = -Math.PI / 2;
  wash.position.y = Y - 0.2;
  wash.renderOrder = 28;
  root.add(wash);

  // chart pieces: a nation-coloured chevron per ship, bow along the heading
  const chevron = new THREE.Shape();
  chevron.moveTo(0, 30);
  chevron.lineTo(9, -6);
  chevron.lineTo(7, -26);
  chevron.lineTo(-7, -26);
  chevron.lineTo(-9, -6);
  chevron.closePath();
  const chevGeo = new THREE.ShapeGeometry(chevron);
  chevGeo.rotateX(-Math.PI / 2);

  function sector(center, yaw, from, to, radius, color) {
    const shape = [];
    shape.push(new THREE.Vector3(0, 0, 0));
    for (let i = 0; i <= 24; i++) {
      const a = from + (to - from) * (i / 24);
      const x = Math.sin(a);
      const y = -Math.cos(a);
      const ax = Math.abs(x);
      const ay = Math.abs(y);
      const t = radius / (Math.max(ax, ay) + Math.min(ax, ay) / 2);
      shape.push(new THREE.Vector3(x * t * CELL, 0, y * t * CELL));
    }
    const pos = [];
    for (let i = 1; i < shape.length - 1; i++) pos.push(shape[0], shape[i], shape[i + 1]);
    const g = new THREE.BufferGeometry().setFromPoints(pos);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.13, depthTest: false, side: THREE.DoubleSide }));
    m.position.set(center.x, Y, center.z);
    m.rotation.y = yaw;
    m.renderOrder = 29;
    return m;
  }

  const api = {
    root,
    visible: true,
    setVisible(v, tacticalMode) {
      root.visible = v;
      gridGroup.visible = tacticalMode;
      pieces.visible = tacticalMode;
      wash.visible = tacticalMode;
      // arcs and range contours are chart furniture; in the 3D view they
      // would read as sheets lying on the waves. The ghost path stays.
      arcs.visible = tacticalMode;
      rings.visible = tacticalMode;
    },

    // chart pieces follow the ships' animated positions
    pieces(visuals, display) {
      while (pieces.children.length < visuals.length) {
        const m = new THREE.Mesh(chevGeo, new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.95, depthTest: false }));
        const edge = new THREE.LineLoop(new THREE.EdgesGeometry(chevGeo), lineMat('#0b1016', 0.9));
        m.add(edge);
        m.renderOrder = 33;
        pieces.add(m);
      }
      visuals.forEach((v, i) => {
        const m = pieces.children[i];
        const sp = display.ships[i];
        m.visible = !v.v.hidden;
        if (!m.visible) return;
        const nat = sp.captured >= 0 ? display.ships[sp.captured].nationality : sp.nationality;
        m.material.color.set(sp.struck ? '#8a8a8a' : NATION_COLOR[nat]);
        const s = (v.L / 56) * 1.6; // a little larger than life, for legibility
        m.scale.set(s, 1, s);
        // the chevron's point lies along -z after rotateX, like the model's bow
        m.position.set(v.root.position.x, Y + 0.6, v.root.position.z);
        m.rotation.y = v.root.rotation.y;
      });
    },

    // me: engine ship; st: engine state; helmPoses: tracePath output
    update(st, me, helmPoses, center) {
      if (!me || me.dir === 0) {
        arcs.clear();
        rings.clear();
        ghost.clear();
        return;
      }
      if (!gridGroup.children.length || gridGroup.userData.cx !== Math.round(center.x / CELL / 20)) {
        buildGrid(center);
        gridGroup.userData.cx = Math.round(center.x / CELL / 20);
      }
      arcs.clear();
      rings.clear();
      const bow = new THREE.Vector3(me.col * CELL, 0, me.row * CELL);
      const mid = new THREE.Vector3((me.col + DC[me.dir] * 0.5) * CELL, 0, (me.row + DR[me.dir] * 0.5) * CELL);
      const yaw = -((me.dir - 1) * Math.PI) / 4;
      const heading = ((me.dir - 1) * Math.PI) / 4;
      // arcs: bearings 2-4 (starboard) and 6-8 (port), each 3 octants
      const oct = Math.PI / 4;
      const loadR = RANGE_OF_SHOT[me.loadR] || 0;
      const loadL = RANGE_OF_SHOT[me.loadL] || 0;
      if (loadR) arcs.add(sector(mid, 0, heading + oct * 0.5, heading + oct * 3.5, loadR, '#ffd27a'));
      if (loadL) arcs.add(sector(mid, 0, heading - oct * 3.5, heading - oct * 0.5, loadL, '#9fd3ff'));
      // range contours for the distinct loaded ranges, plus the 6-square
      // line beyond which only rigging can be aimed at
      const ranges = new Set([loadL, loadR, 6].filter(Boolean));
      for (const r of ranges) {
        const pts = contour(r);
        const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat(r === 6 ? '#ffffff' : '#ffe7b0', r === 6 ? 0.25 : 0.5, r === 6));
        l.computeLineDistances();
        l.position.copy(mid);
        l.renderOrder = 31;
        rings.add(l);
      }
      api.helm(helmPoses, me);
      void bow;
      void yaw;
    },

    helm(poses, me) {
      ghost.clear();
      if (!poses || poses.length < 2) return;
      const pts = poses.map((p) => new THREE.Vector3((p.col + DC[p.dir] * 0.5) * CELL, Y + 0.3, (p.row + DR[p.dir] * 0.5) * CELL));
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat('#fff4d6', 0.9, true));
      line.computeLineDistances();
      line.renderOrder = 32;
      ghost.add(line);
      // a ghost hull at the end pose: an arrow-shaped outline
      const end = poses[poses.length - 1];
      const len = 46;
      const beam = 12;
      const shape = [
        new THREE.Vector3(0, 0, -len / 2), new THREE.Vector3(beam / 2, 0, -len * 0.2), new THREE.Vector3(beam / 2, 0, len / 2),
        new THREE.Vector3(-beam / 2, 0, len / 2), new THREE.Vector3(-beam / 2, 0, -len * 0.2), new THREE.Vector3(0, 0, -len / 2),
      ];
      const outline = new THREE.Line(new THREE.BufferGeometry().setFromPoints(shape), lineMat('#fff4d6', 0.95));
      outline.position.set((end.col + DC[end.dir] * 0.5) * CELL, Y + 0.4, (end.row + DR[end.dir] * 0.5) * CELL);
      outline.rotation.y = -((end.dir - 1) * Math.PI) / 4;
      outline.renderOrder = 32;
      ghost.add(outline);
      const fill = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(shape.map((v) => new THREE.Vector2(v.x, -v.z)))), new THREE.MeshBasicMaterial({ color: '#fff4d6', transparent: true, opacity: 0.18, depthTest: false, side: THREE.DoubleSide }));
      fill.rotation.x = -Math.PI / 2;
      const holder = new THREE.Group();
      holder.add(fill);
      holder.position.copy(outline.position);
      holder.rotation.y = outline.rotation.y;
      holder.renderOrder = 31;
      ghost.add(holder);
      void me;
    },
  };
  return api;
}
