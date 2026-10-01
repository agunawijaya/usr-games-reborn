// trek/procedural-web — hull skins drawn on a runtime <canvas>.
//
// Each faction gets one tileable plating pattern: albedo, a
// roughness/metalness map (G = roughness, B = metalness, the channels
// MeshStandardMaterial reads), a normal map derived from a height field
// (panel seams sink, plates bulge slightly) and a faint emissive map for
// glowing seams. Everything is drawn once at load from a seeded RNG —
// computed pixels, never shipped files (port ADR 002). Mipmaps +
// anisotropy keep the panelling from shimmering at game zoom.

import * as THREE from 'three';
import { mulberry32 } from './rng.js';

const SIZE = 512;

function canvas2d(size = SIZE) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d', { willReadFrequently: true })];
}

/** Draw a rectangle wrapped on a torus so the texture tiles seamlessly. */
function wrapRect(ctx, x, y, w, h, size = SIZE) {
  for (const dx of [0, -size, size]) for (const dy of [0, -size, size]) {
    if (x + dx + w < 0 || x + dx > size || y + dy + h < 0 || y + dy > size) continue;
    ctx.fillRect(x + dx, y + dy, w, h);
  }
}
function wrapStroke(ctx, x, y, w, h, size = SIZE) {
  for (const dx of [0, -size, size]) for (const dy of [0, -size, size]) {
    if (x + dx + w < 0 || x + dx > size || y + dy + h < 0 || y + dy > size) continue;
    ctx.strokeRect(x + dx + 0.5, y + dy + 0.5, w - 1, h - 1);
  }
}

const shade = (base, k) => base.map(v => Math.max(0, Math.min(255, Math.round(v * k))));
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

/**
 * Plate layout: rows of plates with random widths, the classic
 * "hull plating" rhythm. Returns plate rects for all maps to share.
 */
function layoutPlates(rand, { rowMin = 18, rowMax = 44, wMin = 24, wMax = 110 }) {
  const plates = [];
  let y = 0;
  while (y < SIZE) {
    let h = Math.round(rowMin + rand() * (rowMax - rowMin));
    if (SIZE - y - h < rowMin) h = SIZE - y;
    let x = Math.floor(rand() * wMax);
    const start = x;
    while (x < start + SIZE) {
      let w = Math.round(wMin + rand() * (wMax - wMin));
      if (start + SIZE - x - w < wMin) w = start + SIZE - x;
      plates.push({ x: x % SIZE, y, w, h, r: rand(), r2: rand(), r3: rand() });
      x += w;
    }
    y += h;
  }
  return plates;
}

const FACTIONS = {
  // Player + starbase: pale ceramic plating, blue-grey accents.
  federation: {
    base: [178, 186, 196], vary: 0.07, seam: [70, 78, 92], accentChance: 0.07, accent: [96, 116, 140],
    rough: [0.38, 0.62], metal: [0.15, 0.35], glow: null, hatch: 0.18, plates: {},
  },
  // Enemy warships: dark gunmetal with bronze plates and hot seams.
  raider: {
    base: [72, 66, 62], vary: 0.06, seam: [24, 20, 18], accentChance: 0.07, accent: [112, 78, 50],
    rough: [0.45, 0.78], metal: [0.55, 0.85], glow: [255, 70, 30], glowChance: 0.05, hatch: 0.1,
    plates: { rowMin: 22, rowMax: 60, wMin: 30, wMax: 140 },
  },
  // The warbird's faction: jade lacquer, fine scale-like plating.
  jade: {
    base: [44, 84, 78], vary: 0.1, seam: [12, 26, 26], accentChance: 0.12, accent: [70, 122, 110],
    rough: [0.3, 0.55], metal: [0.45, 0.7], glow: [60, 255, 200], glowChance: 0.04, hatch: 0.05,
    plates: { rowMin: 14, rowMax: 26, wMin: 20, wMax: 60 },
  },
};

const cache = new Map();

/**
 * @returns { map, roughMetal, normal, emissive } THREE.CanvasTexture set
 */
export function hullSkin(faction, anisotropy = 4) {
  const key = `${faction}:${anisotropy}`;
  if (cache.has(key)) return cache.get(key);
  const F = FACTIONS[faction];
  const rand = mulberry32(faction.length * 7919 + faction.charCodeAt(0));
  const plates = layoutPlates(rand, F.plates);

  const [albedo, a] = canvas2d();
  const [rm, r] = canvas2d();
  const [height, hctx] = canvas2d();
  const [emis, e] = canvas2d();
  e.fillStyle = '#000'; e.fillRect(0, 0, SIZE, SIZE);
  hctx.fillStyle = 'rgb(128,128,128)'; hctx.fillRect(0, 0, SIZE, SIZE);

  for (const p of plates) {
    const isAccent = p.r < F.accentChance;
    const col = shade(isAccent ? F.accent : F.base, 1 - F.vary + p.r2 * F.vary * 2);
    a.fillStyle = rgb(col);
    wrapRect(a, p.x, p.y, p.w, p.h);
    // Subtle vertical gradient across each plate: reads as curvature.
    const g = a.createLinearGradient(0, p.y, 0, p.y + p.h);
    g.addColorStop(0, 'rgba(255,255,255,0.05)');
    g.addColorStop(1, 'rgba(0,0,0,0.07)');
    a.fillStyle = g;
    wrapRect(a, p.x, p.y, p.w, p.h);

    const rough = F.rough[0] + (F.rough[1] - F.rough[0]) * p.r3;
    const metal = F.metal[0] + (F.metal[1] - F.metal[0]) * p.r2;
    r.fillStyle = `rgb(0,${Math.round(rough * 255)},${Math.round(metal * 255)})`;
    wrapRect(r, p.x, p.y, p.w, p.h);

    // Plates bulge a touch; seams are cut into the height field below.
    const hv = 132 + Math.round(p.r * 14);
    hctx.fillStyle = `rgb(${hv},${hv},${hv})`;
    wrapRect(hctx, p.x + 1, p.y + 1, p.w - 2, p.h - 2);

    // Hatches / access panels: an inset rectangle with a darker rim.
    if (p.r3 < F.hatch && p.w > 30 && p.h > 16) {
      const hx = p.x + 5 + Math.floor(p.r2 * (p.w - 24)), hy = p.y + 4;
      const hw = Math.min(18 + Math.floor(p.r * 16), p.w - 10), hh = p.h - 8;
      a.strokeStyle = rgb(shade(F.seam, 1.3));
      a.lineWidth = 1;
      wrapStroke(a, hx, hy, hw, hh);
      hctx.fillStyle = 'rgb(118,118,118)';
      wrapRect(hctx, hx, hy, hw, hh);
    }
    // Glowing seams (enemy factions): a thin hot line along one edge.
    if (F.glow && p.r2 < F.glowChance) {
      e.fillStyle = `rgba(${F.glow[0]},${F.glow[1]},${F.glow[2]},0.9)`;
      wrapRect(e, p.x + 2, p.y + p.h - 2, p.w - 4, 1);
    }
  }
  // Seams: dark 1-px lines around every plate, cut into the height field.
  a.strokeStyle = rgb(F.seam);
  hctx.strokeStyle = 'rgb(70,70,70)';
  a.lineWidth = hctx.lineWidth = 1;
  for (const p of plates) {
    wrapStroke(a, p.x, p.y, p.w + 1, p.h + 1);
    wrapStroke(hctx, p.x, p.y, p.w + 1, p.h + 1);
  }
  // Rivet dots and weathering streaks.
  for (let i = 0; i < 900; i++) {
    const x = rand() * SIZE, y = rand() * SIZE;
    a.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.08})`;
    wrapRect(a, x, y, 1, 1);
  }
  for (let i = 0; i < 40; i++) {
    const x = rand() * SIZE, y = rand() * SIZE, len = 20 + rand() * 60;
    a.fillStyle = `rgba(0,0,0,${0.03 + rand() * 0.04})`;
    wrapRect(a, x, y, 1 + rand() * 2, len);
  }

  const normal = heightToNormal(hctx, 2.2);
  const make = (c, srgb) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = anisotropy;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };
  const skin = {
    map: make(albedo, true),
    roughMetal: make(rm, false),
    normal: make(normal, false),
    emissive: make(emis, true),
    hasGlow: !!F.glow,
  };
  cache.set(key, skin);
  return skin;
}

/** Sobel-free central differences on a wrapped height field → RGB normal map. */
function heightToNormal(hctx, strength) {
  const src = hctx.getImageData(0, 0, SIZE, SIZE).data;
  const [out, o] = canvas2d();
  const img = o.createImageData(SIZE, SIZE);
  const H = (x, y) => src[(((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)) * 4] / 255;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * SIZE + x) * 4;
      img.data[i] = Math.round((-dx / len * 0.5 + 0.5) * 255);
      img.data[i + 1] = Math.round((dy / len * 0.5 + 0.5) * 255);
      img.data[i + 2] = Math.round((1 / len * 0.5 + 0.5) * 255);
      img.data[i + 3] = 255;
    }
  }
  o.putImageData(img, 0, 0);
  return out;
}

/** Solar-panel cells for the starbase arrays (tileable). */
export function solarSkin(anisotropy = 4) {
  const key = `solar:${anisotropy}`;
  if (cache.has(key)) return cache.get(key);
  const [c, g] = canvas2d(256);
  g.fillStyle = '#0c1830';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 16) for (let x = 0; x < 256; x += 16) {
    const k = 0.8 + ((x * 7 + y * 13) % 17) / 60;
    g.fillStyle = `rgb(${Math.round(24 * k)},${Math.round(52 * k)},${Math.round(104 * k)})`;
    g.fillRect(x + 1, y + 1, 14, 14);
    g.fillStyle = 'rgba(140,180,255,0.18)';
    g.fillRect(x + 1, y + 1, 14, 1);
  }
  g.fillStyle = '#8a96a8';
  for (let i = 0; i < 256; i += 64) { g.fillRect(i, 0, 2, 256); g.fillRect(0, i, 256, 2); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  cache.set(key, t);
  return t;
}
