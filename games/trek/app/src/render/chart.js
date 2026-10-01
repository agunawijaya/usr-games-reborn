// trek/procedural-web — holographic galaxy chart (the V view).
//
// A tilted 8×8 hologram floating over the current quadrant's sky:
//   • floor shader: cell grid, scanned cells glow faint cyan, unscanned
//     cells crawl with fog-of-war static, a scan wave rolls out from your
//     position, a radar wedge sweeps around it, hover highlight for the
//     Captain's Override instant warp
//   • red holo-columns + stacked diamonds for Klingon counts
//   • gold rotating ring gizmos for starbases, amber pips for stars
//   • a cyan beacon and chevron for the Enterprise
//   • crisp DOM labels projected from 3D (coordinates, K counts, SB, YOU)
// Per-cell state lives in an 8×8 DataTexture read by the floor shader.

import * as THREE from 'three';
import { GALAXY_SIZE } from '../galaxy.js';
import { HASH, NOISE } from './glsl.js';
import { glowSprite } from './parts.js';

const CELL = 1.25;
const SPAN = CELL * GALAXY_SIZE;
const cellCentre = (qx, qy, y = 0, out = new THREE.Vector3()) =>
  out.set((qx - (GALAXY_SIZE - 1) / 2) * CELL, y, (qy - (GALAXY_SIZE - 1) / 2) * CELL);

const FLOOR_VERT = /* glsl */ `
varying vec2 vG;     // grid coords 0..8
void main() {
  vG = (position.xy / ${SPAN.toFixed(3)} + 0.5) * ${GALAXY_SIZE.toFixed(1)};
  vG.y = ${GALAXY_SIZE.toFixed(1)} - vG.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const FLOOR_FRAG = NOISE + /* glsl */ `
uniform sampler2D tState;   // r visible, g klingons/3, b starbase, a stars/9
uniform vec2 uYou, uHover;
uniform float uTime, uScanT, uArmed, uReduced;
varying vec2 vG;
void main() {
  vec2 cell = floor(vG);
  vec2 f = fract(vG);
  vec4 st = texture2D(tState, (cell + 0.5) / 8.0);
  float visible = st.r;
  float kl = st.g;
  // Cell borders + fine sub-grid.
  vec2 e = min(f, 1.0 - f);
  float border = 1.0 - smoothstep(0.0, 0.014, min(e.x, e.y));
  vec2 sf = fract(vG * 4.0);
  vec2 se = min(sf, 1.0 - sf);
  float sub = (1.0 - smoothstep(0.0, 0.04, min(se.x, se.y))) * 0.18;
  vec3 cyan = vec3(0.2, 0.75, 1.0);
  vec3 col = cyan * (border * 0.38 + sub * visible * 0.35);
  col += cyan * visible * 0.05;
  col += vec3(1.0, 0.2, 0.15) * kl * visible * 0.12;
  col += vec3(1.0, 0.8, 0.35) * st.b * visible * 0.07;
  // Fog of war: crawling static on unscanned cells.
  float stat = hash12(floor(vG * 26.0) + floor(uTime * (uReduced > 0.5 ? 0.0 : 5.0)));
  float bands = 0.5 + 0.5 * sin(vG.y * 18.0 + uTime * 1.5 * (1.0 - uReduced));
  float murk = vnoise(vG * 1.3 + uTime * 0.05);
  col += vec3(0.05, 0.09, 0.14) * (1.0 - visible) * (stat * 0.22 + bands * 0.1 + murk * 0.25);
  // Your quadrant.
  float you = step(abs(cell.x - uYou.x), 0.1) * step(abs(cell.y - uYou.y), 0.1);
  col += cyan * you * (0.2 + 0.1 * sin(uTime * 3.0));
  // Scan wave from your position + radar wedge.
  vec2 d = vG - (uYou + 0.5);
  float r = length(d);
  float wave = exp(-pow((r - uScanT * 9.0) / 0.35, 2.0)) * (1.0 - uScanT) * step(0.0, uScanT) * step(uScanT, 1.0);
  col += cyan * wave * 0.9;
  float ang = atan(d.y, d.x);
  float sweep = fract((ang / 6.2831853) - uTime * 0.18);
  col += cyan * pow(sweep, 18.0) * smoothstep(3.2, 0.0, r) * 0.35 * (1.0 - uReduced);
  // Hover (instant warp armed).
  float hov = step(abs(cell.x - uHover.x), 0.1) * step(abs(cell.y - uHover.y), 0.1) * uArmed;
  col += vec3(1.0, 0.75, 0.3) * hov * (0.25 + border * 1.5);
  // Outer frame.
  vec2 o = min(vG, 8.0 - vG);
  float frame = 1.0 - smoothstep(0.0, 0.06, min(o.x, o.y));
  col += cyan * frame * 1.2;
  // Holographic scanlines.
  col *= 0.85 + 0.15 * sin(gl_FragCoord.y * 1.4);
  gl_FragColor = vec4(col, 1.0);
}
`;

const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
varying vec2 vUv;
void main() {
  float x = abs(vUv.x - 0.5) * 2.0;
  float a = exp(-x * x * 6.0) * pow(1.0 - vUv.y, 1.5);
  a *= 0.8 + 0.2 * sin(vUv.y * 30.0 - uTime * 6.0);
  gl_FragColor = vec4(uColor * a, 1.0);
}
`;
const BEAM_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  // Cylindrical billboard around the vertical axis.
  vec3 c = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 toCam = cameraPosition - c;
  toCam.y = 0.0;
  vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), normalize(toCam + vec3(1e-4, 0.0, 0.0))));
  float sx = length(modelMatrix[0].xyz), sy = length(modelMatrix[1].xyz);
  vec3 p = c + side * position.x * sx + vec3(0.0, position.y * sy, 0.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;
const beamGeo = (() => { const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0); return g; })();

function beamMesh(color, width, height) {
  const m = new THREE.Mesh(beamGeo, new THREE.ShaderMaterial({
    vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
    uniforms: { uColor: { value: new THREE.Color(...color) }, uTime: { value: 0 } },
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  m.scale.set(width, height, 1);
  m.frustumCulled = false;
  return m;
}

export class Chart {
  constructor(renderer, profile, nebula) {
    this.renderer = renderer;
    this.profile = profile;
    this.scene = new THREE.Scene();
    this.bg = new THREE.Mesh(nebula.fsGeo, nebula.bgMat);
    this.bg.frustumCulled = false;
    this.bg.renderOrder = -1000;
    this.scene.add(this.bg);
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.5, 200);
    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.stateData = new Uint8Array(8 * 8 * 4);
    this.stateTex = new THREE.DataTexture(this.stateData, 8, 8, THREE.RGBAFormat);
    this.stateTex.magFilter = this.stateTex.minFilter = THREE.NearestFilter;
    this.floorMat = new THREE.ShaderMaterial({
      vertexShader: FLOOR_VERT, fragmentShader: FLOOR_FRAG,
      uniforms: {
        tState: { value: this.stateTex }, uYou: { value: new THREE.Vector2() }, uHover: { value: new THREE.Vector2(-9, -9) },
        uTime: { value: 0 }, uScanT: { value: -1 }, uArmed: { value: 0 }, uReduced: { value: 0 },
      },
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(SPAN, SPAN), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.floor = floor;
    this.root.add(floor);

    this.markers = new THREE.Group();
    this.root.add(this.markers);
    this.animated = [];
    this.stateKey = '';
    this.scanT0 = -99;
    this.time = 0;
    this.labelsEl = null;
    this.labels = [];
    this.raycaster = new THREE.Raycaster();
    this.hover = null;
    this.armed = false;
    this.css = { w: 1, h: 1 };

    // Enterprise beacon.
    this.you = new THREE.Group();
    const chevShape = new THREE.Shape();
    chevShape.moveTo(0.34, 0); chevShape.lineTo(-0.22, 0.22); chevShape.lineTo(-0.1, 0); chevShape.lineTo(-0.22, -0.22); chevShape.closePath();
    const chev = new THREE.Mesh(new THREE.ShapeGeometry(chevShape), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.9, 1.3).multiplyScalar(2.2), side: THREE.DoubleSide }));
    chev.rotation.x = -Math.PI / 2;
    chev.position.y = 0.55;
    this.chev = chev;
    const beam = beamMesh([0.3, 0.85, 1.2], 0.35, 1.6);
    const glow = glowSprite(0x59d8ff, 0.5, 1.6, { core: 2, falloff: 5 });
    glow.position.y = 0.55;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.46, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.85, 1.2).multiplyScalar(1.6), side: THREE.DoubleSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    this.youRing = ring;
    this.you.add(beam, chev, glow, ring);
    this.youBeam = beam;
    this.root.add(this.you);
  }

  attachLabels(el) { this.labelsEl = el; }

  resize(W, H, cssW, cssH) {
    this.css = { w: cssW, h: cssH };
    const cam = this.camera;
    cam.aspect = cssW / cssH;
    const tilt = THREE.MathUtils.degToRad(46);
    // Fit the 8×8 floor into ~80 % of the viewport height (like the painted
    // chart's 900×700 canvas capped at 80vh).
    let dist = 16;
    for (let i = 0; i < 6; i++) {
      cam.position.set(0, Math.cos(tilt) * dist, Math.sin(tilt) * dist);
      cam.lookAt(0, 0, 0.3);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
      const a = new THREE.Vector3(0, 0, -SPAN / 2).project(cam);
      const b = new THREE.Vector3(0, 0, SPAN / 2).project(cam);
      const c = new THREE.Vector3(SPAN / 2, 0, SPAN / 2).project(cam);
      const hFrac = (a.y - b.y) / 2;
      const wFrac = c.x;   // half-width of near edge in NDC
      // Keep the hologram between the HUD columns (near edge ≈ 42 % of the
      // half-width, depth ≈ 58 % of the half-height).
      const k = Math.max(hFrac / 0.58, wFrac / 0.42);
      dist *= k;
    }
    this.baseCam = cam.position.clone();
  }

  /** Rebuild markers when the visible galaxy changes. */
  setState(snap, isVisible) {
    const G = snap.galaxy;
    let key = `${snap.ship.qx},${snap.ship.qy}|`;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const q = G.quadrants[y][x];
      const v = isVisible(x, y);
      key += v ? `${q.klingons}${q.starbases}${Math.min(9, q.stars)}` : '-';
      const i = (y * 8 + x) * 4;
      this.stateData[i] = v ? 255 : 0;
      this.stateData[i + 1] = v ? Math.round(Math.min(3, q.klingons) / 3 * 255) : 0;
      this.stateData[i + 2] = v && q.starbases > 0 ? 255 : 0;
      this.stateData[i + 3] = v ? Math.round(Math.min(9, q.stars) / 9 * 255) : 0;
    }
    this.stateTex.needsUpdate = true;
    this.floorMat.uniforms.uYou.value.set(snap.ship.qx, snap.ship.qy);
    cellCentre(snap.ship.qx, snap.ship.qy, 0, this.you.position);
    this.you.position.x += 0; // centred
    if (key === this.stateKey) return;
    this.stateKey = key;
    // Rebuild markers.
    for (const c of [...this.markers.children]) {
      this.markers.remove(c);
      c.traverse(o => { o.geometry && o.geometry !== beamGeo && o.geometry.dispose(); o.material?.dispose?.(); });
    }
    this.animated = [];
    const labels = [];
    const diamond = new THREE.OctahedronGeometry(0.09, 0);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const c = cellCentre(x, y);
      labels.push({ kind: 'coord', text: `${x + 1}-${y + 1}`, pos: c.clone().add(new THREE.Vector3(-CELL * 0.33, 0, -CELL * 0.36)) });
      if (!isVisible(x, y)) continue;
      const q = G.quadrants[y][x];
      if (q.klingons > 0) {
        const grp = new THREE.Group();
        grp.position.copy(c).add(new THREE.Vector3(-CELL * 0.18, 0, CELL * 0.12));
        const h = 0.35 + q.klingons * 0.28;
        grp.add(beamMesh([1.2, 0.2, 0.15], 0.13, h));
        const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.18, 0.12).multiplyScalar(2.6) });
        for (let i = 0; i < q.klingons; i++) {
          const d = new THREE.Mesh(diamond, mat);
          d.position.y = 0.22 + i * 0.24;
          grp.add(d);
          this.animated.push((t) => { d.rotation.y = t * 1.6 + i; });
        }
        const g = glowSprite(0xff3a2a, 0.2, 0.55, { core: 1.2, falloff: 6 });
        g.position.y = 0.1;
        grp.add(g);
        this.markers.add(grp);
        labels.push({ kind: 'k', text: `K${q.klingons}`, pos: grp.position.clone().add(new THREE.Vector3(0.16, h + 0.12, 0)) });
      }
      if (q.starbases > 0) {
        const grp = new THREE.Group();
        grp.position.copy(c).add(new THREE.Vector3(CELL * 0.22, 0.32, -CELL * 0.05));
        const gold = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.78, 0.3).multiplyScalar(2.2), side: THREE.DoubleSide });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 8, 32), gold);
        const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.014, 8, 24), gold);
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), gold);
        grp.add(ring, ring2, core, beamMesh([1.1, 0.8, 0.3], 0.14, 0.32).translateY(-0.32));
        this.animated.push((t) => { ring.rotation.x = t * 0.9; ring.rotation.y = t * 0.5; ring2.rotation.y = -t * 1.3; ring2.rotation.x = Math.PI / 2; });
        this.markers.add(grp);
        labels.push({ kind: 'sb', text: 'SB', pos: grp.position.clone().add(new THREE.Vector3(0, 0.28, 0)) });
      }
      if (q.stars > 0) {
        const n = Math.min(4, q.stars);
        for (let i = 0; i < n; i++) {
          const s = glowSprite(0xffd28a, 0.06, 2.2, { core: 3, falloff: 7 });
          s.position.copy(c).add(new THREE.Vector3(CELL * (0.3 - i * 0.09), 0.05, CELL * 0.36));
          this.markers.add(s);
        }
      }
    }
    labels.push({ kind: 'you', text: 'YOU', pos: null });
    this._buildLabels(labels);
  }

  _buildLabels(labels) {
    if (!this.labelsEl) return;
    this.labelsEl.innerHTML = '';
    this.labels = labels.map(l => {
      const el = document.createElement('div');
      el.className = `chart-label ${l.kind}`;
      el.textContent = l.text;
      this.labelsEl.appendChild(el);
      return { ...l, el };
    });
  }

  pulseScan() { this.scanT0 = this.time; }

  setArmed(v) {
    this.armed = v;
    this.floorMat.uniforms.uArmed.value = v ? 1 : 0;
    if (!v) this.floorMat.uniforms.uHover.value.set(-9, -9);
  }

  /** Quadrant under a client-space point, or null. */
  pick(clientX, clientY) {
    const ndc = new THREE.Vector2((clientX / this.css.w) * 2 - 1, -(clientY / this.css.h) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.floor, false)[0];
    if (!hit) return null;
    const qx = Math.floor(hit.point.x / CELL + GALAXY_SIZE / 2);
    const qy = Math.floor(hit.point.z / CELL + GALAXY_SIZE / 2);
    if (qx < 0 || qy < 0 || qx >= 8 || qy >= 8) return null;
    return { qx, qy };
  }

  /** CSS-pixel position of a quadrant's centre (tests, tooltips). */
  screenPoint(qx, qy) {
    const v = cellCentre(qx, qy).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.css.w, y: (-v.y * 0.5 + 0.5) * this.css.h };
  }

  setHover(q) {
    this.hover = q;
    this.floorMat.uniforms.uHover.value.set(q ? q.qx : -9, q ? q.qy : -9);
  }

  update(t, dt, reduced) {
    this.time = t;
    const u = this.floorMat.uniforms;
    u.uTime.value = t;
    u.uReduced.value = reduced ? 1 : 0;
    const sk = (t - this.scanT0) / 1.6;
    u.uScanT.value = sk >= 0 && sk <= 1 ? sk : -1;
    for (const a of this.animated) a(reduced ? 0 : t);
    this.youBeam.material.uniforms.uTime.value = t;
    this.youRing.scale.setScalar(1 + 0.15 * Math.sin(t * 3));
    this.chev.position.y = 0.55 + (reduced ? 0 : Math.sin(t * 1.5) * 0.05);
    // Slow idle orbit.
    const cam = this.camera;
    const sway = reduced ? 0 : 1;
    if (this.baseCam) {
      cam.position.copy(this.baseCam);
      cam.position.x += Math.sin(t * 0.13) * 0.6 * sway;
      cam.lookAt(0, 0, 0.3);
    }
    this._placeLabels();
  }

  _placeLabels() {
    if (!this.labels.length) return;
    const v = new THREE.Vector3();
    for (const l of this.labels) {
      if (l.kind === 'you') v.copy(this.you.position).setY(1.05);
      else v.copy(l.pos);
      v.project(this.camera);
      const x = (v.x * 0.5 + 0.5) * this.css.w;
      const y = (-v.y * 0.5 + 0.5) * this.css.h;
      l.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    }
  }

  render(gl) {
    gl.render(this.scene, this.camera);
  }
}
