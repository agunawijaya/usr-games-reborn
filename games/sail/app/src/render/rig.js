// Masts, yards, sails and rigging, generated from the ship's dimensions.
//
// Mast count comes from the engine's rigging data: specs.rig4 === -1 means
// three masts, otherwise four (ADR-005). Masts are indexed like the engine's
// rigging counters: rig1 = fore, rig2 = main, rig3 = mizzen, rig4 = jigger.
// Each mast is its own pivot group, so it can topple when its counter hits 0.

import * as THREE from 'three';

const lerp = (a, b, t) => a + (b - a) * t;

// --- sail material ------------------------------------------------------------

export function sailMaterial(seed) {
  const mat = new THREE.MeshStandardMaterial({ color: '#e7dfca', roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  const u = {
    uTime: { value: 0 },
    uBillow: { value: 0.8 }, // signed: + fills toward the bow, - aback
    uFlutter: { value: 0.1 },
    uTear: { value: 0 },
    uGlow: { value: 0 },
    uSeed: { value: seed },
    uSoot: { value: 0 },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uTime; uniform float uBillow; uniform float uFlutter; uniform float uSeed;
attribute vec3 sailInfo; // x: depth scale (m per unit billow), y: fore-and-aft sail (1) or square (0)
attribute vec2 suv;
varying vec2 vSailUv;
float sailDz(vec2 q) {
  q = clamp(q, 0.0, 1.0);
  float sx = 1.0 - pow(abs(q.x * 2.0 - 1.0), 2.0);
  float sy = pow(max(sin(1.5707963 * (1.0 - q.y)), 0.0), 0.7) * (1.0 - 0.3 * (1.0 - q.y));
  float bulge = sx * sy;
  float fl = sin(uTime * 7.0 + q.x * 9.0 + q.y * 5.0 + uSeed) * sin(uTime * 3.1 + q.y * 3.0) * uFlutter;
  return (uBillow * bulge + fl * (0.3 + bulge)) * sailInfo.x;
}`)
      .replace('#include <beginnormal_vertex>', `
vec2 q0 = suv;
float e = 0.02;
float d0 = sailDz(q0);
float gx = (sailDz(q0 + vec2(e, 0.0)) - d0) / e * 0.08;
float gy = (sailDz(q0 + vec2(0.0, e)) - d0) / e * 0.08;
// square sails lie in x-y and billow along -z; fore-and-aft sails lie in
// y-z (u runs aft along z) and billow along +x
vec3 objectNormal = sailInfo.y > 0.5 ? normalize(vec3(1.0, -gy, -gx)) : normalize(vec3(gx, gy, 1.0));
#ifdef USE_TANGENT
vec3 objectTangent = vec3( tangent.xyz );
#endif`)
      .replace('#include <begin_vertex>', `
vSailUv = suv;
vec3 transformed = vec3(position);
float dz = sailDz(suv);
if (sailInfo.y > 0.5) transformed.x += dz; else transformed.z -= dz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uTear; uniform float uGlow; uniform float uSeed; uniform float uSoot; uniform float uTime;
varying vec2 vSailUv;
float sh1(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }
float sn(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sh1(i), sh1(i + vec2(1, 0)), f.x), mix(sh1(i + vec2(0, 1)), sh1(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
{
  // shot holes and rents grow with rigging damage (chain shot shreds sails)
  float n = sn(vSailUv * vec2(7.0, 5.0)) * 0.6 + sn(vSailUv * vec2(19.0, 13.0)) * 0.4;
  float holes = step(n, uTear * 0.85 - 0.08);
  float rent = step(0.985 - uTear * 0.25, sn(vec2(vSailUv.x * 40.0, vSailUv.y * 2.0)));
  if (uTear > 0.0 && (holes > 0.5 || rent * step(0.25, uTear) > 0.5)) discard;
}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  // seams (vertical cloths) and a little weathering
  float seam = smoothstep(0.93, 1.0, abs(sin(vSailUv.x * 3.14159 * 14.0)));
  diffuseColor.rgb *= 1.0 - seam * 0.08;
  diffuseColor.rgb *= 0.93 + 0.07 * sn(vSailUv * 4.0);
  diffuseColor.rgb *= 1.0 - uSoot * 0.6 * smoothstep(0.3, 0.8, sn(vSailUv * 3.0 + 7.0));
  float edge = 1.0 - smoothstep(0.0, 0.03, min(min(vSailUv.x, 1.0 - vSailUv.x), min(vSailUv.y, 1.0 - vSailUv.y)));
  diffuseColor.rgb *= 1.0 - edge * 0.12;
}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * uGlow;`);
  };
  mat.userData.u = u;
  return mat;
}

// A square sail (trapezoid) hanging from y = 0 down to -h in the x-y plane.
function squareSailGeo(topW, botW, h, set, depth) {
  const NX = 10;
  const NY = 8;
  const pos = [];
  const uv = [];
  const info = [];
  const idx = [];
  for (let j = 0; j <= NY; j++) {
    const v = j / NY; // 0 bottom .. 1 top
    const w = lerp(botW, topW, v);
    for (let i = 0; i <= NX; i++) {
      const u = i / NX;
      pos.push((u - 0.5) * w, -(1 - v) * h, 0);
      uv.push(u, v);
      info.push(depth, 0, set);
    }
  }
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i;
      idx.push(a, a + 1, a + NX + 1, a + 1, a + NX + 2, a + NX + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('suv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('sailInfo', new THREE.Float32BufferAttribute(info, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A fore-and-aft sail in the y-z plane from four corners (z aft positive).
function foreAftSailGeo(corners, depth) {
  const [tl, tr, br, bl] = corners; // [z, y] pairs: throat, peak, clew, tack
  const NX = 8;
  const NY = 8;
  const pos = [];
  const uv = [];
  const info = [];
  const idx = [];
  for (let j = 0; j <= NY; j++) {
    const v = j / NY;
    for (let i = 0; i <= NX; i++) {
      const u = i / NX;
      const top = [lerp(tl[0], tr[0], u), lerp(tl[1], tr[1], u)];
      const bot = [lerp(bl[0], br[0], u), lerp(bl[1], br[1], u)];
      pos.push(0, lerp(bot[1], top[1], v), lerp(bot[0], top[0], v));
      uv.push(u, v);
      info.push(depth, 1, 1);
    }
  }
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i;
      idx.push(a, a + NX + 1, a + 1, a + 1, a + NX + 1, a + NX + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('suv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('sailInfo', new THREE.Float32BufferAttribute(info, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function spar(r0, r1, len, mat) {
  const g = new THREE.CylinderGeometry(r1, r0, len, 10);
  g.translate(0, len / 2, 0);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
}

const woodMat = () => new THREE.MeshStandardMaterial({ color: '#6f5638', roughness: 0.75 });
const blackMat = () => new THREE.MeshStandardMaterial({ color: '#1d1a17', roughness: 0.7 });
const lineMat = (opacity = 0.85) => new THREE.LineBasicMaterial({ color: '#241c14', transparent: true, opacity });

// Build all masts. Returns { masts: [...], bowsprit, lines }.
export function buildRig(h) {
  const { dim, form, deckY, railX } = h;
  const L = dim.L;
  const four = dim.masts === 4;
  const us = four ? [0.8, 0.585, 0.37, 0.17] : [0.765, 0.5, 0.245];
  const hRel = four ? [0.9, 1.0, 0.78, 0.56] : [0.93, 1.0, 0.77];
  const yRel = four ? [0.92, 1.0, 0.74, 0.5] : [0.92, 1.0, 0.72];
  const wood = woodMat();
  const black = blackMat();
  const masts = [];
  const hMain = L * 1.02;
  const yMain = dim.B * 2.05;

  for (let i = 0; i < us.length; i++) {
    const u = us[i];
    const H = hMain * hRel[i];
    const Y = yMain * yRel[i];
    const r0 = Math.max(0.24, H * 0.0112);
    const pivot = new THREE.Group(); // at the mast step on deck
    pivot.position.set(0, deckY(u), form.zOf(u));
    const body = new THREE.Group(); // everything that falls with the mast
    pivot.add(body);
    // spars
    body.add(spar(r0, r0 * 0.82, H * 0.56, wood));
    const topmast = spar(r0 * 0.66, r0 * 0.5, H * 0.36, wood);
    topmast.position.y = H * 0.47;
    body.add(topmast);
    const tg = spar(r0 * 0.42, r0 * 0.25, H * 0.24, wood);
    tg.position.y = H * 0.78;
    body.add(tg);
    const top = new THREE.Mesh(new THREE.BoxGeometry(Y * 0.17, 0.3, Y * 0.12), black);
    top.position.set(0, H * 0.5, Y * 0.01);
    body.add(top);
    const xt = new THREE.Mesh(new THREE.BoxGeometry(Y * 0.08, 0.2, Y * 0.05), black);
    xt.position.y = H * 0.8;
    body.add(xt);
    // truck
    const truck = new THREE.Mesh(new THREE.CylinderGeometry(r0 * 0.4, r0 * 0.4, 0.4, 8), wood);
    truck.position.y = H * 1.02;
    body.add(truck);

    const mat = sailMaterial(i * 3.7 + L);
    const sails = [];
    const yards = [];
    const isMizzen = four ? i >= 2 : i === 2;
    const isJigger = four && i === 3;
    const levels = [
      { name: 'course', y: H * 0.45, w: Y, bottom: H * 0.17, botW: Y * 1.02, set: 'full', skip: isMizzen },
      { name: 'topsail', y: H * 0.71, w: Y * 0.74, bottom: H * 0.475, botW: Y * 0.96, set: 'battle', skip: false },
      { name: 'topgallant', y: H * 0.9, w: Y * 0.5, bottom: H * 0.725, botW: Y * 0.7, set: 'full', skip: isJigger },
    ];
    for (const lv of levels) {
      const yard = new THREE.Group(); // braces rotate this about the mast
      yard.position.y = lv.y;
      body.add(yard);
      const ys = new THREE.Mesh(new THREE.CylinderGeometry(r0 * 0.28, r0 * 0.28, lv.w, 8), black);
      ys.rotation.z = Math.PI / 2;
      ys.castShadow = true;
      yard.add(ys);
      yards.push(yard);
      if (lv.skip) continue;
      const hgt = lv.y - lv.bottom;
      const depth = Math.max(1.2, hgt * 0.2);
      const geo = squareSailGeo(lv.w * 0.95, lv.botW * 0.95, hgt, 1, depth);
      const sail = new THREE.Mesh(geo, mat);
      sail.castShadow = true;
      sail.position.z = -r0 * 0.6;
      yard.add(sail);
      // the furled bundle along the yard, shown when the sail is not set
      const bundle = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, lv.w * 0.9, 8), new THREE.MeshStandardMaterial({ color: '#d6cdb6', roughness: 1 }));
      bundle.rotation.z = Math.PI / 2;
      bundle.position.set(0, -0.35, -r0 * 0.4);
      yard.add(bundle);
      sails.push({ mesh: sail, bundle, level: lv.name, when: lv.set, set: 1, geo });
    }
    // spanker on the aftermost masts
    if (isMizzen && (!four || i === 3 || i === 2)) {
      const gaffLen = L * (four ? 0.22 : 0.3);
      const g = new THREE.Mesh(new THREE.CylinderGeometry(r0 * 0.25, r0 * 0.25, gaffLen, 6), black);
      g.rotation.x = Math.PI / 2 - 0.35;
      g.position.set(0, H * 0.42 + Math.sin(0.35) * gaffLen * 0.5, gaffLen * 0.47);
      body.add(g);
      const geo = foreAftSailGeo([[0.6, H * 0.4], [gaffLen * 0.95, H * 0.4 + Math.sin(0.35) * gaffLen], [gaffLen * 1.05, 3.0], [0.6, 3.0]], 1.4);
      const sp = new THREE.Mesh(geo, mat);
      sp.castShadow = true;
      body.add(sp);
      sails.push({ mesh: sp, bundle: null, level: 'spanker', when: 'battle', set: 1, geo, foreAft: true });
    }

    // shrouds + ratlines (fall with the mast)
    const seg = [];
    const rat = [];
    const chanY = form.top(u) - deckY(u) - 0.4;
    const chanX = railX(u) + 0.6;
    const topY = H * 0.5;
    const topX = Y * 0.085;
    const nS = Math.max(4, Math.round(H / 9));
    const low = [];
    for (const side of [1, -1]) {
      const pts = [];
      for (let k = 0; k < nS; k++) {
        const z = lerp(-L * 0.015, L * 0.05, k / (nS - 1));
        const a = new THREE.Vector3(side * chanX, chanY, z);
        const b = new THREE.Vector3(side * topX, topY, lerp(-0.4, 0.8, k / (nS - 1)));
        seg.push(a, b);
        pts.push([a, b]);
      }
      low.push(pts);
      // ratlines every ~0.9 m between neighbouring shrouds
      for (let k = 0; k < nS - 1; k++) {
        const [a0, b0] = pts[k];
        const [a1, b1] = pts[k + 1];
        const n = Math.floor((topY - chanY) / 0.9);
        for (let r = 1; r < n; r++) {
          const t = r / n;
          rat.push(a0.clone().lerp(b0, t), a1.clone().lerp(b1, t));
        }
      }
      // topmast shrouds and topgallant shrouds
      for (let k = 0; k < 3; k++) {
        seg.push(new THREE.Vector3(side * topX * (0.7 + k * 0.1), topY, lerp(0, 0.8, k / 2)), new THREE.Vector3(side * Y * 0.03, H * 0.8, 0.1));
      }
      seg.push(new THREE.Vector3(side * Y * 0.04, H * 0.8, 0.2), new THREE.Vector3(side * 0.3, H * 0.97, 0));
      // backstays to the hull side, aft of the shrouds
      seg.push(new THREE.Vector3(side * 0.4, H * 0.8, 0.2), new THREE.Vector3(side * chanX, chanY, L * 0.12));
      seg.push(new THREE.Vector3(side * 0.3, H * 0.97, 0.1), new THREE.Vector3(side * chanX, chanY, L * 0.16));
    }
    // lifts and braces (yard arms to mast / to the deck aft)
    for (const yard of yards) {
      const yw = yard.children[0].geometry.parameters.height / 2;
      for (const side of [1, -1]) {
        seg.push(new THREE.Vector3(side * yw * 0.95, yard.position.y, 0), new THREE.Vector3(0, yard.position.y + 3.5, 0));
      }
    }
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg), lineMat(0.85));
    body.add(lines);
    // ratlines are thin tarred cord: at a distance they read as a haze
    body.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(rat), lineMat(0.28)));
    // channels: the platforms outboard that spread the shrouds
    for (const side of [1, -1]) {
      const ch = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, L * 0.075), black);
      ch.position.set(side * (railX(u) + 0.3), form.top(u) - 0.9, form.zOf(u) + L * 0.018);
      h.group.add(ch);
    }

    masts.push({
      index: i, u, H, Y, r0, pivot, body, yards, sails, mat, lines,
      fallen: false, fall: 0, fallDir: 1, stump: null, jury: false,
    });
  }

  // --- bowsprit, jib-boom, jibs and stays (ship-level) ---------------------------
  const bow = new THREE.Group();
  const stemY = form.top(1) - 0.6;
  const stemZ = form.zOf(1) + 0.5;
  bow.position.set(0, stemY, stemZ);
  bow.rotation.x = -(Math.PI / 2 - 0.36); // point forward-and-up
  const bsLen = L * 0.42;
  bow.add(spar(masts[0].r0 * 0.9, masts[0].r0 * 0.6, bsLen, wood));
  const jb = spar(masts[0].r0 * 0.5, masts[0].r0 * 0.3, L * 0.3, wood);
  jb.position.y = bsLen * 0.8;
  bow.add(jb);
  // head: a small beakhead wedge
  const head = new THREE.Mesh(new THREE.ConeGeometry(1.2, 4.5, 4), new THREE.MeshStandardMaterial({ color: h.paint.trim, roughness: 0.7 }));
  head.rotation.x = -Math.PI / 2;
  head.position.set(0, form.top(1) - 2.2, form.zOf(1) - 1.4);
  const fore = masts[0];
  const foreTopHead = new THREE.Vector3(0, deckY(fore.u) + fore.H * 0.8, form.zOf(fore.u));
  const tip = new THREE.Vector3(0, stemY + Math.cos(0.36) * (bsLen + L * 0.24), stemZ - Math.sin(0.36) * (bsLen + L * 0.24));
  const mid = new THREE.Vector3(0, stemY + Math.cos(0.36) * bsLen * 0.95, stemZ - Math.sin(0.36) * bsLen * 0.95);
  const jibMat = sailMaterial(99 + L);
  const jibs = [];
  for (const [a, heightF] of [[tip, 0.8], [mid, 0.62]]) {
    const top = new THREE.Vector3(0, deckY(fore.u) + fore.H * heightF, form.zOf(fore.u) - 0.5);
    const foot = new THREE.Vector3(0, deckY(fore.u) + 4, form.zOf(fore.u) - fore.Y * 0.1);
    // triangle as a degenerate fore-and-aft quad in ship space
    const geo = foreAftSailGeo([[top.z, top.y], [top.z + 0.01, top.y], [foot.z, foot.y], [a.z, a.y]], 1.2);
    const m = new THREE.Mesh(geo, jibMat);
    m.castShadow = true;
    jibs.push(m);
  }
  const staySeg = [
    foreTopHead, tip,
    new THREE.Vector3(0, deckY(fore.u) + fore.H * 0.5, form.zOf(fore.u)), mid,
  ];
  for (let i = 1; i < masts.length; i++) {
    const a = masts[i];
    const b = masts[i - 1];
    staySeg.push(
      new THREE.Vector3(0, deckY(a.u) + a.H * 0.5, form.zOf(a.u)), new THREE.Vector3(0, deckY(b.u) + 2, form.zOf(b.u) + 0.5),
      new THREE.Vector3(0, deckY(a.u) + a.H * 0.8, form.zOf(a.u)), new THREE.Vector3(0, deckY(b.u) + b.H * 0.5, form.zOf(b.u)),
    );
  }
  const stays = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(staySeg), lineMat());
  return { masts, bow, head, jibs, jibMat, stays };
}

// Brace the yards and fill the sails for the apparent wind.
// relWind: angle (rad) of the wind's travel direction relative to the ship's
// heading (0 = from dead astern, pi = in irons), signed (+ = toward starboard).
export function trimSails(rig, relWind, windSpeed, time, opts = {}) {
  const a = Math.abs(relWind);
  const sign = Math.sign(relWind) || 1;
  // square yards brace round up to ~40 deg; beyond ~135 deg they cannot fill
  const brace = Math.min(0.72, a * 0.55) * sign;
  const fill = a < 2.2 ? 1 : a < 2.6 ? lerp(1, -0.3, (a - 2.2) / 0.4) : -0.45; // aback in irons
  const strength = windSpeed <= 0 ? 0.08 : Math.min(1.35, 0.35 + windSpeed * 0.17);
  for (const m of rig.masts) {
    for (const y of m.yards) y.rotation.y = brace;
    const uu = m.mat.userData.u;
    uu.uTime.value = time;
    uu.uBillow.value = fill * strength;
    uu.uFlutter.value = 0.05 + (fill < 0.5 ? 0.35 : 0) + windSpeed * 0.02;
    uu.uGlow.value = opts.glow || 0;
  }
  const j = rig.jibMat.userData.u;
  j.uTime.value = time;
  j.uBillow.value = strength * 0.9 * -sign;
  j.uFlutter.value = 0.08 + windSpeed * 0.02;
  j.uGlow.value = opts.glow || 0;
}
