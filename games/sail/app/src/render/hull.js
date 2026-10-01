// Procedural hulls: lofted from cross-sections, painted at run time, with
// gun-port rows derived from the ship's class and gun count in the engine's
// data (sail/globals.c specs[]). Model space: bow toward -z, starboard +x,
// waterline at y = 0.

import * as THREE from 'three';

const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// Principal dimensions (m) by sail class (1 first rate ... 6 brig).
const CLASS_DIM = {
  1: { L: 62, B: 16.4, F: 12.8, D: 7.6, decks: 3 },
  2: { L: 54, B: 14.6, F: 9.8, D: 6.8, decks: 2 },
  3: { L: 46, B: 12.0, F: 7.0, D: 5.4, decks: 1 },
  4: { L: 39, B: 10.2, F: 6.0, D: 4.6, decks: 1 },
  5: { L: 33, B: 9.0, F: 5.2, D: 4.0, decks: 1 },
  6: { L: 30, B: 8.4, F: 4.8, D: 3.8, decks: 1 },
};
const TYPICAL_GUNS = { 1: 100, 2: 74, 3: 38, 4: 26, 5: 18, 6: 14 };

// Paint schemes by nation index (sail/globals.c:512): wale, band, bulwark.
const PAINT = {
  0: { wale: '#16140f', band: '#ddd4bd', lid: '#16140f', inner: '#8a2a1e', trim: '#b89a5a' }, // American: black, cream band
  1: { wale: '#17140f', band: '#c99c45', lid: '#17140f', inner: '#9a2c1f', trim: '#c9a257' }, // British: Nelson chequer
  2: { wale: '#1a1411', band: '#8f2a22', lid: '#1a1411', inner: '#8f2a22', trim: '#d8cfb4' }, // Spanish: black and red
  3: { wale: '#161412', band: '#a8452c', lid: '#161412', inner: '#8a2a1e', trim: '#b89a5a' }, // French: black, red ochre
  default: { wale: '#1b1b1d', band: '#7b7f86', lid: '#1b1b1d', inner: '#5c1f1a', trim: '#999' },
};

export function shipDimensions(spec) {
  const d = { ...(CLASS_DIM[spec.class] || CLASS_DIM[3]) };
  const typical = TYPICAL_GUNS[spec.class] || 40;
  const s = 1 + Math.max(-0.14, Math.min(0.16, (spec.guns - typical) / typical)) * 0.5;
  d.L *= s; d.B *= s; d.F *= Math.sqrt(s); d.D *= Math.sqrt(s);
  d.masts = spec.rig4 === -1 ? 3 : 4;
  return d;
}

// Hull form as functions of u (0 stern .. 1 bow) and t (0 keel .. 1 rail).
export function hullForm(dim) {
  const { L, B, F, D } = dim;
  const hb = (u) => {
    if (u < 0.2) return (B / 2) * (0.8 + 0.2 * smooth(u / 0.2));
    if (u < 0.56) return B / 2;
    const x = (u - 0.56) / 0.44;
    return (B / 2) * Math.pow(Math.max(0, 1 - x * x), 0.55);
  };
  // sheer: the deck line sweeps up toward both ends, more at the stern
  const top = (u) => F * (1 + 0.16 * Math.pow((u - 0.47) / 0.53, 2)) + (u < 0.22 ? F * 0.12 * smooth(1 - u / 0.22) : 0);
  const bottom = (u) => {
    if (u > 0.8) {
      const x = (u - 0.8) / 0.2;
      return -D * (1 - x * x * 0.8);
    }
    return -D;
  };
  const endness = (u) => Math.min(1, Math.max(0, (0.3 - u) / 0.3, (u - 0.62) / 0.38));
  const zOf = (u) => (0.5 - u) * L;
  function section(u, t) {
    const b = bottom(u);
    const tp = top(u);
    const y = b + (tp - b) * t;
    const tw = -b / (tp - b);
    const tMax = Math.min(0.92, tw + 1.2 / (tp - b));
    let f;
    if (t <= tMax) {
      const s = t / tMax;
      const e = lerp(0.35, 1.25, endness(u));
      f = Math.pow(Math.sin((Math.PI / 2) * s), e);
    } else {
      // tumblehome: the topsides lean inboard above the widest point
      const s = (t - tMax) / (1 - tMax);
      f = 1 - 0.2 * Math.pow(s, 1.3) * (1 - 0.5 * endness(u));
    }
    if (u < 0.3) {
      // the run: the underwater body narrows toward the sternpost
      const k = smooth(u / 0.3);
      f *= lerp(lerp(0.2, 1, k), 1, smooth(t / (tw + 0.12)));
    }
    let z = zOf(u);
    // raked stem (the bow overhangs forward as it rises) and raked transom
    if (u > 0.9) z -= smooth((u - 0.9) / 0.1) * Math.max(0, y + D * 0.6) * 0.32;
    if (u < 0.05) z += smooth((0.05 - u) / 0.05) * Math.max(0, y + D * 0.3) * 0.16;
    return { x: hb(u) * f, y, z };
  }
  return { hb, top, bottom, section, zOf, L, B, F, D };
}

// Gun-port layout: per deck, the (u, y) of each port on one side.
export function portLayout(dim, spec, form) {
  const perSide = Math.max(2, Math.round(spec.guns / 2));
  const decks = dim.decks;
  const counts = [];
  let left = perSide;
  for (let k = 0; k < decks; k++) {
    // lower decks carry the most guns
    const c = k === decks - 1 ? left : Math.round(perSide / decks + (decks - 1 - k) * 0.6);
    counts.push(Math.max(2, Math.min(left, c)));
    left -= counts[k];
  }
  const ports = [];
  const firstY = decks === 1 ? Math.max(1.8, dim.F - 2.6) : 1.9;
  for (let k = 0; k < decks; k++) {
    const y0 = firstY + k * 2.35;
    const n = counts[k];
    const u0 = 0.14 + k * 0.02;
    const u1 = 0.84 - k * 0.04;
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0.5 : lerp(u0, u1, i / (n - 1));
      const sheer = (form.top(u) - dim.F) * (y0 / dim.F);
      ports.push({ deck: k, u, y: y0 + sheer });
    }
  }
  return ports;
}

// Paint the side texture: copper bottom, wales, gun-deck bands, ports,
// planking, weathering. Painted per column so every line follows the sheer.
function paintSide(dim, form, ports, nation) {
  const P = PAINT[nation] || PAINT.default;
  const W = 2048;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const rnd = mulberry(nation * 97 + Math.round(dim.L * 10));
  const col = 2;
  const vOf = (u, y) => {
    const b = form.bottom(u);
    const tp = form.top(u);
    return (y - b) / (tp - b);
  };
  const py = (v) => H - v * H; // canvas y (v = 0 at the keel, at the bottom)
  for (let x = 0; x < W; x += col) {
    const u = x / W;
    const wl = vOf(u, 0);
    // copper sheathing
    g.fillStyle = '#9a5c34';
    g.fillRect(x, py(wl), col, H);
    // black wale from the waterline to the rail
    g.fillStyle = P.wale;
    g.fillRect(x, 0, col, py(wl) + 1);
    // boot-top: a pale line at the waterline
    g.fillStyle = '#d9d2c0';
    g.fillRect(x, py(wl + 0.012), col, Math.max(2, 0.012 * H));
    // gun-deck bands
    for (let k = 0; k < dim.decks; k++) {
      const p = ports.find((q) => q.deck === k);
      if (!p) continue;
      const sheer = (form.top(u) - dim.F) * (p.y / dim.F);
      const yc = p.y - (form.top(p.u) - dim.F) * (p.y / dim.F) + sheer;
      g.fillStyle = P.band;
      g.fillRect(x, py(vOf(u, yc + 0.62)), col, (vOf(u, yc + 0.62) - vOf(u, yc - 0.62)) * H);
    }
    // a thin trim line under the rail
    g.fillStyle = P.trim;
    g.fillRect(x, py(0.965), col, 3);
  }
  // copper plates
  g.globalAlpha = 0.18;
  g.fillStyle = '#3d2413';
  for (let x = 0; x < W; x += 14) g.fillRect(x, H * 0.55, 1, H * 0.45);
  for (let y = H - 6; y > H * 0.5; y -= 9) g.fillRect(0, y, W, 1);
  // verdigris patches
  g.globalAlpha = 0.35;
  for (let i = 0; i < 180; i++) {
    const x = rnd() * W;
    const u = x / W;
    const y = py(vOf(u, -rnd() * dim.D * 0.9));
    g.fillStyle = rnd() < 0.5 ? '#4f8a73' : '#6a9a80';
    g.beginPath();
    g.ellipse(x, y, 6 + rnd() * 30, 3 + rnd() * 10, 0, 0, Math.PI * 2);
    g.fill();
  }
  // planking seams above the waterline
  g.globalAlpha = 0.22;
  g.fillStyle = '#000';
  for (let x = 0; x < W; x += col) {
    const u = x / W;
    for (let y = 0.3; y < form.top(u); y += 0.3) g.fillRect(x, py(vOf(u, y)), col, 1);
  }
  // butt joints
  g.globalAlpha = 0.12;
  for (let i = 0; i < 900; i++) {
    const x = rnd() * W;
    const u = x / W;
    const y = rnd() * form.top(u);
    g.fillRect(x, py(vOf(u, y)) - 5, 1, 5);
  }
  // gun ports: dark openings with a lid-coloured frame
  g.globalAlpha = 1;
  for (const p of ports) {
    const x = p.u * W;
    const pw = (0.82 / dim.L) * W;
    const v0 = vOf(p.u, p.y - 0.42);
    const v1 = vOf(p.u, p.y + 0.42);
    // the opening is written with alpha 0.5: the hull shader reads that as
    // "port" (where fire inside a burning ship shows through)
    g.fillStyle = '#060504';
    g.fillRect(x - pw / 2, py(v1), pw, (v1 - v0) * H);
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(x - pw / 2, py(v1), pw, (v1 - v0) * H);
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 2;
    g.strokeRect(x - pw / 2 - 1, py(v1) - 1, pw + 2, (v1 - v0) * H + 2);
    // grime streak dripping from the port sill
    const grad = g.createLinearGradient(0, py(v0), 0, py(v0) + 40);
    grad.addColorStop(0, 'rgba(20,14,8,0.35)');
    grad.addColorStop(1, 'rgba(20,14,8,0)');
    g.fillStyle = grad;
    g.fillRect(x - pw * 0.3, py(v0), pw * 0.6, 40);
  }
  // weathering: salt bloom + soot speckle
  g.globalAlpha = 0.08;
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = rnd() < 0.5 ? '#ffffff' : '#000000';
    g.fillRect(rnd() * W, rnd() * H * 0.7, 2 + rnd() * 6, 1 + rnd() * 3);
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  return tex;
}

function paintDeck(len) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 128;
  const g = c.getContext('2d');
  const rnd = mulberry(Math.round(len * 13));
  g.fillStyle = '#9d8563';
  g.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < c.height; y += 6) {
    g.fillStyle = `rgba(${60 + rnd() * 30},${45 + rnd() * 20},${25 + rnd() * 15},0.25)`;
    g.fillRect(0, y, c.width, 5);
    g.fillStyle = 'rgba(20,14,8,0.45)';
    g.fillRect(0, y + 5, c.width, 1);
    for (let x = rnd() * 80; x < c.width; x += 60 + rnd() * 90) g.fillRect(x, y, 1, 5);
  }
  g.globalAlpha = 0.1;
  for (let i = 0; i < 300; i++) {
    g.fillStyle = rnd() < 0.5 ? '#fff' : '#000';
    g.fillRect(rnd() * c.width, rnd() * c.height, 3 + rnd() * 20, 1 + rnd() * 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Damage-aware standard material: up to MAX_HITS shot holes (charred core,
// raw splintered rim) and overall soot, driven by uniforms from the engine.
export const MAX_HITS = 24;
export function hullMaterial(map, extra = {}) {
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.78, metalness: 0.0, side: THREE.DoubleSide, ...extra });
  const u = {
    uHits: { value: Array.from({ length: MAX_HITS }, () => new THREE.Vector4(0, -999, 0, 0)) },
    uSoot: { value: 0 },
    uBurn: { value: 0 },
    uTime: { value: 0 },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vLocal;
uniform vec4 uHits[${MAX_HITS}];
uniform float uSoot;
uniform float uBurn;
uniform float uTime;
float hh(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float nn(vec3 x) { vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hh(i), hh(i + vec3(1,0,0)), f.x), mix(hh(i + vec3(0,1,0)), hh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hh(i + vec3(0,0,1)), hh(i + vec3(1,0,1)), f.x), mix(hh(i + vec3(0,1,1)), hh(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
// gun-port openings carry alpha 0.5 in the painted texture: a burning
// ship's fire shows there
float portGlow = 0.0;
#ifdef USE_MAP
portGlow = 1.0 - smoothstep(0.6, 0.85, diffuseColor.a);
diffuseColor.a = 1.0;
#endif
{
  float n = nn(vLocal * 2.3) * 0.6 + nn(vLocal * 7.1) * 0.4;
  for (int i = 0; i < ${MAX_HITS}; i++) {
    vec4 h = uHits[i];
    if (h.w <= 0.0) continue;
    float d = distance(vLocal, h.xyz) / h.w + (n - 0.5) * 0.55;
    float hole = 1.0 - smoothstep(0.28, 0.42, d);
    float rim = smoothstep(0.3, 0.45, d) * (1.0 - smoothstep(0.5, 0.85, d));
    float soot = 1.0 - smoothstep(0.5, 1.6, d);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.48, 0.3), rim * 0.75);
    diffuseColor.rgb *= 1.0 - soot * 0.55;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.015, 0.01, 0.008), hole);
  }
  float s = smoothstep(0.55, 0.85, nn(vLocal * 0.35 + 3.0) * 0.7 + nn(vLocal * 1.7) * 0.3 + uSoot * 0.5 - 0.35);
  diffuseColor.rgb *= 1.0 - s * uSoot * 0.8;
  // weathering: salt-dulled topsides, darker and wetter toward the waterline
  diffuseColor.rgb *= mix(0.78, 1.04, smoothstep(-0.5, 6.0, vLocal.y));
  diffuseColor.rgb *= 0.92 + 0.12 * nn(vec3(vLocal.z * 0.25, vLocal.y * 2.5, vLocal.x * 0.1));
}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  float f = nn(vLocal * 0.9 + vec3(0.0, -uTime * 2.0, uTime * 0.7));
  float flick = 0.6 + 0.4 * nn(vec3(uTime * 6.0, vLocal.z * 0.2, 0.0));
  // firelight through the open ports, and a few scorched seams glowing near the rail
  float seam = smoothstep(0.82, 0.95, f) * smoothstep(3.0, 0.0, abs(vLocal.y - 9.0) * 0.35);
  totalEmissiveRadiance += vec3(1.0, 0.38, 0.08) * uBurn * flick * (portGlow * 3.5 + seam * 0.8);
}`);
  };
  mat.userData.u = u;
  return mat;
}

// Build the hull meshes. Returns { group, form, ports, deckY(u), railX(u) }.
export function buildHull(spec, nation) {
  const dim = shipDimensions(spec);
  const form = hullForm(dim);
  const ports = portLayout(dim, spec, form);
  const NU = 56;
  const NT = 22;
  const group = new THREE.Group();

  // --- outer sides (both) --------------------------------------------------
  const pos = [];
  const uv = [];
  const idx = [];
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= NU; i++) {
      const u = i / NU;
      for (let j = 0; j <= NT; j++) {
        const t = j / NT;
        const p = form.section(u, t);
        pos.push(p.x * side, p.y, p.z);
        uv.push(u, t);
      }
    }
    for (let i = 0; i < NU; i++) {
      for (let j = 0; j < NT; j++) {
        const a = base + i * (NT + 1) + j;
        const b = a + NT + 1;
        if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1);
        else idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const sideGeo = new THREE.BufferGeometry();
  sideGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  sideGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  sideGeo.setIndex(idx);
  sideGeo.computeVertexNormals();
  const sideTex = paintSide(dim, form, ports, nation);
  // blacked (tarred) topsides have a soft sheen that shows the hull's curves
  const hullMat = hullMaterial(sideTex, { roughness: 0.5 });
  const hull = new THREE.Mesh(sideGeo, hullMat);
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);

  // --- deck -------------------------------------------------------------------
  const P = PAINT[nation] || PAINT.default;
  const bulwark = 1.15;
  const deckY = (u) => form.top(u) - bulwark;
  const railX = (u) => form.section(u, 1).x;
  const deckT = (u) => (deckY(u) - form.bottom(u)) / (form.top(u) - form.bottom(u));
  const deckX = (u) => form.section(u, deckT(u)).x * 0.98;
  const deckZ = (u) => form.section(u, deckT(u)).z;
  const railZ = (u) => form.section(u, 1).z;
  const dp = [];
  const duv = [];
  const di = [];
  for (let i = 0; i <= NU; i++) {
    const u = i / NU;
    const z = deckZ(u);
    const x = Math.max(0.05, deckX(u));
    dp.push(-x, deckY(u), z, x, deckY(u), z);
    duv.push(u, 0, u, 1);
    if (i < NU) {
      const a = i * 2;
      di.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const deckGeo = new THREE.BufferGeometry();
  deckGeo.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
  deckGeo.setAttribute('uv', new THREE.Float32BufferAttribute(duv, 2));
  deckGeo.setIndex(di);
  deckGeo.computeVertexNormals();
  const deck = new THREE.Mesh(deckGeo, new THREE.MeshStandardMaterial({ map: paintDeck(dim.L), roughness: 0.9, side: THREE.DoubleSide }));
  deck.receiveShadow = true;
  deck.castShadow = true;
  group.add(deck);

  // --- inner bulwarks (painted red, as the Navy did) --------------------------
  const bp = [];
  const bi = [];
  for (const side of [1, -1]) {
    const base = bp.length / 3;
    for (let i = 0; i <= NU; i++) {
      const u = i / NU;
      bp.push(side * deckX(u), deckY(u), deckZ(u), side * railX(u) * 0.985, form.top(u), railZ(u));
    }
    for (let i = 0; i < NU; i++) {
      const a = base + i * 2;
      bi.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const bulGeo = new THREE.BufferGeometry();
  bulGeo.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
  bulGeo.setIndex(bi);
  bulGeo.computeVertexNormals();
  group.add(new THREE.Mesh(bulGeo, new THREE.MeshStandardMaterial({ color: P.inner, roughness: 0.85, side: THREE.DoubleSide })));

  // --- deck furniture: hammock nettings, boats, capstan, wheel, lanterns ------
  const canvasMat = new THREE.MeshStandardMaterial({ color: '#a79d86', roughness: 1 });
  const darkWood = new THREE.MeshStandardMaterial({ color: '#4a3524', roughness: 0.85 });
  for (const side of [1, -1]) {
    // rolled hammocks stowed in nettings along the rails: a pale band that
    // gives period warships their unmistakable silhouette
    const NN = 18;
    const hp = [];
    const hi = [];
    for (let i = 0; i <= NN; i++) {
      const u = lerp(0.1, 0.86, i / NN);
      const x = side * railX(u) * 0.96;
      const y = form.top(u);
      const z = railZ(u);
      // lumpy: stowed hammocks never lie in a perfectly even roll
      const hh = 0.42 + 0.12 * Math.sin(i * 2.3) * Math.sin(i * 0.7 + side);
      hp.push(x - side * 0.4, y, z, x + side * 0.05, y, z, x + side * 0.02, y + hh, z, x - side * 0.36, y + hh * 0.9, z);
      if (i < NN) {
        const a = i * 4;
        for (let q = 0; q < 4; q++) {
          const q1 = (q + 1) % 4;
          hi.push(a + q, a + 4 + q, a + q1, a + q1, a + 4 + q, a + 4 + q1);
        }
      }
    }
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3));
    hg.setIndex(hi);
    hg.computeVertexNormals();
    const nets = new THREE.Mesh(hg, canvasMat);
    nets.material.side = THREE.DoubleSide;
    nets.castShadow = true;
    group.add(nets);
  }
  // ship's boats nested in the waist
  for (let b = 0; b < (dim.L > 40 ? 2 : 1); b++) {
    const boat = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.7, 6.5 + b, 10, 1, false, 0, Math.PI), darkWood);
    boat.rotation.set(Math.PI / 2, 0, Math.PI);
    boat.scale.set(1, 1, 0.8);
    boat.position.set(0, deckY(0.56) + 1.3 + b * 0.5, form.zOf(0.56 - b * 0.05));
    boat.castShadow = true;
    group.add(boat);
  }
  const capstan = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.3, 12), darkWood);
  capstan.position.set(0, deckY(0.36) + 0.65, form.zOf(0.36));
  group.add(capstan);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.08, 6, 16), darkWood);
  wheel.position.set(0, deckY(0.14) + 1.3, form.zOf(0.14));
  group.add(wheel);
  const lanternMat = new THREE.MeshStandardMaterial({ color: '#3a2a12', emissive: '#ffb55a', emissiveIntensity: 1.8, roughness: 0.4 });
  const lanterns = [];
  for (const x of [-1, 0, 1]) {
    const lan = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.28, 1.3, 8), lanternMat);
    lan.position.set(x * form.section(0, 1).x * 0.6, form.top(0) + (x === 0 ? 1.8 : 1.2), form.section(0, 1).z - 0.3);
    group.add(lan);
    lanterns.push(lan);
  }

  // --- transom with stern windows -----------------------------------------------
  const tp = [];
  const ti = [];
  const center = form.section(0, 0.55);
  tp.push(0, center.y, center.z);
  for (let j = 0; j <= NT; j++) {
    const p = form.section(0, j / NT);
    tp.push(p.x, p.y, p.z);
  }
  for (let j = NT; j >= 0; j--) {
    const p = form.section(0, j / NT);
    tp.push(-p.x, p.y, p.z);
  }
  const n = (tp.length / 3) - 1;
  for (let k = 1; k < n; k++) ti.push(0, k + 1, k);
  const trGeo = new THREE.BufferGeometry();
  trGeo.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
  trGeo.setIndex(ti);
  trGeo.computeVertexNormals();
  const transom = new THREE.Mesh(trGeo, hullMaterial(null, { color: P.wale }));
  group.add(transom);
  // stern gallery windows: warm lamplight, one row per gun deck + the cabin
  const winMat = new THREE.MeshStandardMaterial({ color: '#2a1d10', emissive: '#ffb45c', emissiveIntensity: 0.6, roughness: 0.3 });
  const trimMat = new THREE.MeshStandardMaterial({ color: P.trim, roughness: 0.6 });
  const rows = Math.max(1, dim.decks);
  const sternX = form.section(0, 0.9).x;
  for (let r = 0; r < rows; r++) {
    const y = form.top(0) - 1.5 - r * 2.2;
    if (y < 1.2) break;
    const nW = Math.max(4, Math.round(sternX * 2 / 1.6));
    // the transom rakes aft: follow it
    const tz = form.section(0, (y - form.bottom(0)) / (form.top(0) - form.bottom(0))).z;
    const band = new THREE.Mesh(new THREE.BoxGeometry(sternX * 1.9, 1.5, 0.3), trimMat);
    band.position.set(0, y, tz + 0.35);
    group.add(band);
    for (let w = 0; w < nW; w++) {
      const x = lerp(-sternX * 0.8, sternX * 0.8, nW === 1 ? 0.5 : w / (nW - 1));
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.0), winMat);
      win.position.set(x, y, tz + 0.52);
      win.rotation.y = Math.PI;
      group.add(win);
    }
  }
  // quarter galleries: a glazed bay on each quarter, tapered into the hull
  for (const side of [1, -1]) {
    const hgt = Math.min(3.2, dim.F * 0.3);
    const qg = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.5, hgt, 6, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: P.wale, roughness: 0.6 }));
    const u = 0.075;
    qg.rotation.y = side > 0 ? 0 : Math.PI;
    qg.scale.set(1, 1, 2.2);
    qg.position.set(side * (railX(u) - 0.25), form.top(u) - hgt * 0.8, form.zOf(u));
    group.add(qg);
    const glaze = new THREE.Mesh(new THREE.PlaneGeometry(2.4, hgt * 0.35), winMat);
    glaze.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    glaze.position.set(side * (railX(u) + 0.62), form.top(u) - hgt * 0.75, form.zOf(u));
    group.add(glaze);
  }

  // --- gun barrels and port lids (instanced) --------------------------------------
  const barrelGeo = new THREE.CylinderGeometry(0.16, 0.24, 2.4, 8);
  barrelGeo.rotateZ(Math.PI / 2);
  barrelGeo.translate(1.0, 0, 0);
  const barrels = new THREE.InstancedMesh(barrelGeo, new THREE.MeshStandardMaterial({ color: '#191a1c', roughness: 0.55, metalness: 0.6 }), ports.length * 2);
  const lidGeo = new THREE.BoxGeometry(0.1, 0.85, 0.85);
  lidGeo.translate(0.05, 0.42, 0);
  const lids = new THREE.InstancedMesh(lidGeo, new THREE.MeshStandardMaterial({ color: P.lid, roughness: 0.7 }), ports.length * 2);
  barrels.castShadow = true;
  const muzzles = [];
  const m = new THREE.Matrix4();
  let k = 0;
  for (const side of [1, -1]) {
    for (const p of ports) {
      const b = form.bottom(p.u);
      const t = (p.y - b) / (form.top(p.u) - b);
      const s = form.section(p.u, t);
      const z = form.zOf(p.u);
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), side > 0 ? 0 : Math.PI);
      m.compose(new THREE.Vector3(side * (s.x - 0.4), p.y, z), q, new THREE.Vector3(1, 1, 1));
      barrels.setMatrixAt(k, m);
      muzzles.push({ side: side > 0 ? 'R' : 'L', deck: p.deck, u: p.u, pos: new THREE.Vector3(side * (s.x + 1.9), p.y, z), index: k });
      k++;
    }
  }
  barrels.count = k;
  lids.count = k;
  group.add(barrels);
  group.add(lids);

  return {
    group, form, dim, ports, muzzles, barrels, lids, hullMat, transomMat: transom.material,
    deckY, railX, deckX, railZ, paint: P, lanterns, winMat, lanternMat,
  };
}

// Place/rotate port lids: open (hinged up) or closed; hide barrels behind
// closed lids. closedDecks: set of deck indices whose ports are shut.
export function setPorts(h, closedDecks) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  let k = 0;
  for (const side of [1, -1]) {
    for (const p of h.ports) {
      const closed = closedDecks.has(p.deck);
      const b = h.form.bottom(p.u);
      const t = (p.y - b) / (h.form.top(p.u) - b);
      const s = h.form.section(p.u, t);
      const z = h.form.zOf(p.u);
      // lid hinge at the top edge of the port; open = swung up and out
      e.set(0, side > 0 ? 0 : Math.PI, closed ? 0 : -1.15);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(side * (s.x + 0.02), p.y + (closed ? -0.42 : 0.42), z), q, new THREE.Vector3(1, 1, 1));
      h.lids.setMatrixAt(k, m);
      // barrel: hidden (scaled to 0) when closed
      h.barrels.getMatrixAt(k, m);
      const pos = new THREE.Vector3();
      const qq = new THREE.Quaternion();
      const sc = new THREE.Vector3();
      m.decompose(pos, qq, sc);
      m.compose(pos, qq, closed ? new THREE.Vector3(0.001, 0.001, 0.001) : new THREE.Vector3(1, 1, 1));
      h.barrels.setMatrixAt(k, m);
      k++;
    }
  }
  h.lids.instanceMatrix.needsUpdate = true;
  h.barrels.instanceMatrix.needsUpdate = true;
}
