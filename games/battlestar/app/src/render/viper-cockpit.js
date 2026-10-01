// The Viper's cockpit frame (canopy struts, dashboard, gauges), shared by the
// dogfight and by every room flown through (space, orbit, airspace).
// Gauges are painted at runtime into a canvas (ADR-002: runtime canvas is code).

import * as THREE from 'three';
import { mat, glowMat } from './materials.js';
import { mesh } from './geo.js';
import { rbox, latheGeo } from './model.js';

export function gaugeCanvas() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { c, tex };
}

export function paintGauges(g, { torps = 10, fuel = 250, clock = 120, heading = '', alert = false, msg = '' }) {
  const ctx = g.c.getContext('2d');
  const W = g.c.width;
  const H = g.c.height;
  ctx.fillStyle = '#05080c';
  ctx.fillRect(0, 0, W, H);
  const dial = (x, label, v, max, color) => {
    const cx = x;
    const cy = 128;
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#18222c';
    ctx.beginPath(); ctx.arc(cx, cy, 78, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
    ctx.strokeStyle = color;
    const f = Math.max(0, Math.min(1, v / max));
    ctx.beginPath(); ctx.arc(cx, cy, 78, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * f); ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = '700 54px Rajdhani, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(v), cx, cy + 18);
    ctx.font = '600 22px Rajdhani, "Segoe UI", sans-serif';
    ctx.fillStyle = '#8fb8d8';
    ctx.fillText(label, cx, cy + 62);
  };
  dial(170, 'TORPEDOES', torps, 10, torps > 2 ? '#7fe6ff' : '#ff6a5a');
  dial(512, 'FUEL', fuel, 250, fuel > 40 ? '#9fe07a' : '#ff6a5a');
  dial(854, 'TIME', clock, 120, clock > 20 ? '#ffc86a' : '#ff6a5a');
  if (alert) {
    ctx.fillStyle = 'rgba(255,60,40,.85)';
    ctx.fillRect(360, 8, 304, 30);
    ctx.fillStyle = '#fff';
    ctx.font = '700 22px Rajdhani, sans-serif';
    ctx.fillText(msg || 'WARNING', 512, 31);
  } else if (heading) {
    ctx.fillStyle = '#6f8fb0';
    ctx.font = '600 20px Rajdhani, sans-serif';
    ctx.fillText(heading, 512, 30);
  }
  g.tex.needsUpdate = true;
}

/**
 * Builds the cockpit frame (modelled, ADR-013): a canopy bow and rails of
 * rounded section, sills, a glare shield over a bezelled instrument panel,
 * round standby dials, toggle switches, a throttle and a flight stick.
 * Attach it to the camera.
 */
export function buildCockpitFrame(quality = 'high') {
  const g = new THREE.Group();
  const frameM = mat('panel', { c1: 0x2e343c, c2: 0x0c0e11, c3: 0xff9a40, p: [0.25, 0, 0, 0], q: [0.3, 0.6, 0, 0], seed: 31 });
  const dashM = mat('panel', { c1: 0x1b1f25, c2: 0x06070a, c3: 0x5ad8ff, p: [0.12, 0.004, 0, 0], q: [0.4, 0.6, 0, 0], seed: 32 });
  const metal = mat('metal', { c1: 0x9aa2ac, c2: 0x4a5058, p: [0.3, 0.2, 0, 0] });
  const rubber = mat('matte', { c1: 0x121316, p: [0.85, 0, 0, 0] });
  const no = { shadow: false };
  const seg = quality === 'low' ? 10 : 24;
  // canopy frame: a bow just ahead of the pilot and three rails converging on the nose
  const prof = new THREE.Shape();
  const pw = 0.026;
  const ph = 0.02;
  prof.moveTo(-pw, -ph + 0.008);
  prof.quadraticCurveTo(-pw, -ph, -pw + 0.008, -ph);
  prof.lineTo(pw - 0.008, -ph);
  prof.quadraticCurveTo(pw, -ph, pw, -ph + 0.008);
  prof.lineTo(pw, ph - 0.008);
  prof.quadraticCurveTo(pw, ph, pw - 0.008, ph);
  prof.lineTo(-pw + 0.008, ph);
  prof.quadraticCurveTo(-pw, ph, -pw, ph - 0.008);
  const run = (pts) => mesh(new THREE.ExtrudeGeometry(prof, { steps: seg, bevelEnabled: false, curveSegments: 3, extrudePath: new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))) }), frameM, no);
  g.add(run([[-0.72, -0.12, -0.36], [-0.66, 0.2, -0.36], [-0.4, 0.44, -0.36], [0, 0.52, -0.36], [0.4, 0.44, -0.36], [0.66, 0.2, -0.36], [0.72, -0.12, -0.36]]));
  g.add(run([[-0.62, 0.32, -0.36], [-0.36, 0.41, -0.95], [-0.1, 0.42, -1.6]]));
  g.add(run([[0.62, 0.32, -0.36], [0.36, 0.41, -0.95], [0.1, 0.42, -1.6]]));
  g.add(run([[0, 0.52, -0.36], [0, 0.49, -0.95], [0, 0.44, -1.5]]));
  // canopy sills
  for (const s of [-1, 1]) g.add(rbox(0.12, 0.07, 1.5, 0.025, frameM, { ...no, pos: [s * 0.76, -0.16, -0.75], center: true }));
  // canopy glass tint with a faint reflection
  const glass = mesh(new THREE.SphereGeometry(1.6, 32, 16, Math.PI * 0.62, Math.PI * 0.76, 0.3, 1.1),
    new THREE.MeshBasicMaterial({ color: 0x3a6a8a, transparent: true, opacity: 0.035, side: THREE.BackSide, depthWrite: false }), no);
  g.add(glass);
  // the instrument panel under a glare shield with a rounded lip
  g.add(rbox(1.5, 0.26, 0.5, 0.04, dashM, { ...no, pos: [0, -0.4, -0.66], rot: [-0.35, 0, 0], center: true }));
  // (it overhangs the display from above and beyond, never across it)
  g.add(rbox(1.32, 0.04, 0.3, 0.02, frameM, { ...no, pos: [0, -0.09, -0.99], rot: [0.06, 0, 0], center: true }));
  const lip = new THREE.CatmullRomCurve3([[-0.66, -0.095, -0.87], [0, -0.083, -0.84], [0.66, -0.095, -0.87]].map((p) => new THREE.Vector3(...p)));
  g.add(mesh(new THREE.TubeGeometry(lip, 24, 0.018, 8, false), rubber, no));
  // knee panel and cockpit tub closing the view below the dashboard
  g.add(rbox(1.7, 0.5, 0.08, 0.03, dashM, { ...no, pos: [0, -0.72, -0.62], center: true }));
  for (const s of [-1, 1]) g.add(rbox(0.08, 0.6, 1.2, 0.03, frameM, { ...no, pos: [s * 0.8, -0.55, -0.4], center: true }));
  const gauges = gaugeCanvas();
  const face = new THREE.Group();
  face.position.set(0, -0.205, -0.8);
  face.rotation.x = -0.45;
  face.add(mesh(new THREE.PlaneGeometry(0.84, 0.21), new THREE.MeshBasicMaterial({ map: gauges.tex, toneMapped: false }), no));
  // the display's bezel
  for (const y of [-0.117, 0.117]) face.add(rbox(0.9, 0.024, 0.02, 0.008, frameM, { ...no, pos: [0, y, 0.004], center: true }));
  for (const x of [-0.442, 0.442]) face.add(rbox(0.024, 0.258, 0.02, 0.008, frameM, { ...no, pos: [x, 0, 0.004], center: true }));
  g.add(face);
  // side consoles: standby dials, toggle switches, status lights
  const bezel = latheGeo([[0.034, 0], [0.042, 0], [0.044, 0.008], [0.036, 0.012], [0.034, 0.012]], 24);
  bezel.rotateX(Math.PI / 2);
  for (const s of [-1, 1]) {
    const con = new THREE.Group();
    con.position.set(s * 0.62, -0.38, -0.5);
    con.rotation.y = -s * 0.2;
    con.add(rbox(0.3, 0.2, 0.6, 0.03, dashM, { ...no, center: true }));
    const top = new THREE.Group();
    top.position.y = 0.1;
    top.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 2; i++) {
      const d = new THREE.Group();
      d.position.set(-0.06 + i * 0.12, 0.16, 0.002);
      d.add(mesh(bezel, metal, no));
      d.add(mesh(new THREE.CircleGeometry(0.034, 24), glowMat(i ? 0x2a4a3a : 0x3a3a2a, 1), { ...no, pos: [0, 0, 0.004] }));
      d.add(rbox(0.004, 0.028, 0.002, 0.001, glowMat(0xf0e0b0, 1.6), { ...no, pos: [0, 0.008, 0.007], rot: [0, 0, 0.6 + i * 1.3], center: true }));
      top.add(d);
    }
    for (let i = 0; i < 4; i++) {
      const sw = new THREE.Group();
      sw.position.set(-0.09 + i * 0.06, -0.02, 0);
      sw.add(rbox(0.03, 0.04, 0.008, 0.003, metal, { ...no, center: true }));
      sw.add(mesh(new THREE.CylinderGeometry(0.005, 0.004, 0.035, 8), metal, { ...no, pos: [0, 0.006, 0.018], rot: [Math.PI / 2 + (i % 2 ? 0.4 : -0.4), 0, 0] }));
      top.add(sw);
    }
    for (let i = 0; i < 6; i++) top.add(rbox(0.03, 0.02, 0.012, 0.004, glowMat([0xff4040, 0x40ff80, 0xffc040][i % 3], 2.2), { ...no, pos: [-0.06 + (i % 3) * 0.06, -0.14 - Math.floor(i / 3) * 0.05, 0], center: true }));
    con.add(top);
    g.add(con);
  }
  // throttle on the left console, flight stick between the knees
  const thr = new THREE.Group();
  thr.position.set(-0.6, -0.27, -0.42);
  thr.add(rbox(0.05, 0.02, 0.2, 0.008, metal, { ...no, center: true }));
  thr.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.12, 8), metal, { ...no, pos: [0, 0.06, 0], rot: [0.25, 0, 0] }));
  thr.add(rbox(0.05, 0.06, 0.08, 0.02, rubber, { ...no, pos: [0, 0.125, -0.015], center: true }));
  g.add(thr);
  const stick = new THREE.Group();
  stick.position.set(0, -0.66, -0.4);
  stick.rotation.x = 0.3;
  stick.add(mesh(latheGeo([[0, 0], [0.06, 0], [0.05, 0.02], [0.02, 0.06], [0.012, 0.08], [0, 0.08]], 16), rubber, no));
  stick.add(mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.2, 10), metal, { ...no, pos: [0, 0.17, 0] }));
  stick.add(mesh(latheGeo([[0, 0], [0.02, 0], [0.024, 0.03], [0.022, 0.08], [0.026, 0.1], [0.018, 0.12], [0, 0.125]], 16), rubber, { ...no, pos: [0, 0.26, 0] }));
  stick.add(mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.012, 10), glowMat(0xff3020, 1.4), { ...no, pos: [0, 0.387, 0] }));
  g.add(stick);
  g.traverse((o) => { o.renderOrder = 10; if (o.material) o.material.depthTest = true; });
  return { group: g, gauges };
}
