// Ensigns drawn with Canvas 2D at load time (ADR-002: runtime-generated
// textures are allowed; no image files). Period-appropriate naval ensigns
// for the nations in sail's data (sail/globals.c:512-515).

import * as THREE from 'three';

const cache = new Map();

function stripes(g, w, h, colors) {
  const n = colors.length;
  colors.forEach((c, i) => {
    g.fillStyle = c;
    g.fillRect(0, Math.floor((i * h) / n), w, Math.ceil(h / n) + 1);
  });
}

function star(g, cx, cy, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.4 : r;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

// A simplified Union flag of 1801: blue field, white saltire, red saltire,
// white-fimbriated red cross.
function union(g, x, y, w, h) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.fillStyle = '#1f2f6b';
  g.fillRect(x, y, w, h);
  const diag = (width, color) => {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(x, y); g.lineTo(x + w, y + h);
    g.moveTo(x + w, y); g.lineTo(x, y + h);
    g.stroke();
  };
  diag(h * 0.2, '#f2efe6');
  diag(h * 0.07, '#b3202c');
  g.fillStyle = '#f2efe6';
  g.fillRect(x + w / 2 - h * 0.17, y, h * 0.34, h);
  g.fillRect(x, y + h / 2 - h * 0.17, w, h * 0.34);
  g.fillStyle = '#b3202c';
  g.fillRect(x + w / 2 - h * 0.1, y, h * 0.2, h);
  g.fillRect(x, y + h / 2 - h * 0.1, w, h * 0.2);
  g.restore();
}

const PAINTERS = {
  // 0 American — 15 stars, 15 stripes (1795-1818)
  0(g, w, h) {
    stripes(g, w, h, Array.from({ length: 15 }, (_, i) => (i % 2 ? '#f2efe6' : '#b5212e')));
    const cw = w * 0.42;
    const ch = (h * 8) / 15;
    g.fillStyle = '#23305f';
    g.fillRect(0, 0, cw, ch);
    g.fillStyle = '#f2efe6';
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) star(g, cw * (0.2 + c * 0.3), ch * (0.12 + r * 0.19), ch * 0.07);
  },
  // 1 British — red ensign with the Union in the canton
  1(g, w, h) {
    g.fillStyle = '#b3202c';
    g.fillRect(0, 0, w, h);
    union(g, 0, 0, w * 0.5, h * 0.5);
  },
  // 2 Spanish — naval ensign of 1785: red-yellow-red (1:2:1)
  2(g, w, h) {
    g.fillStyle = '#b4212c';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f0c228';
    g.fillRect(0, h * 0.25, w, h * 0.5);
    g.fillStyle = '#9a1b24';
    g.fillRect(w * 0.18, h * 0.38, w * 0.08, h * 0.24);
  },
  // 3 French — tricolore
  3(g, w, h) {
    ['#26357a', '#f2efe6', '#c42a33'].forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect((i * w) / 3, 0, w / 3 + 1, h);
    });
  },
  // 4 Japanese (scenario 30's joke fleet)
  4(g, w, h) {
    g.fillStyle = '#f2efe6';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#c42a33';
    g.beginPath();
    g.arc(w / 2, h / 2, h * 0.3, 0, Math.PI * 2);
    g.fill();
  },
  5(g, w, h) { stripes(g, w, h, ['#23305f', '#8fb0e0', '#23305f']); },
  6(g, w, h) { stripes(g, w, h, ['#3b0f0f', '#b3202c', '#3b0f0f']); },
  7(g, w, h) { stripes(g, w, h, ['#0f3b1f', '#2fa05a', '#0f3b1f']); },
  // white flag of truce/surrender
  white(g, w, h) {
    g.fillStyle = '#ece8dc';
    g.fillRect(0, 0, w, h);
  },
};

export function flagTexture(nation) {
  if (cache.has(nation)) return cache.get(nation);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const g = c.getContext('2d');
  (PAINTERS[nation] || PAINTERS[1])(g, c.width, c.height);
  // bunting weave + weathering
  const img = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const px = (i / 4) % c.width;
    const py = Math.floor(i / 4 / c.width);
    const weave = ((px + py) % 2 ? 0.96 : 1.0) * (0.92 + 0.08 * Math.sin(px * 0.13) * Math.sin(py * 0.21));
    img.data[i] *= weave;
    img.data[i + 1] *= weave;
    img.data[i + 2] *= weave;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(nation, tex);
  return tex;
}

// Waving flag material: vertex displacement travelling from the hoist.
export function flagMaterial(nation) {
  const mat = new THREE.MeshStandardMaterial({
    map: flagTexture(nation), side: THREE.DoubleSide, roughness: 0.9, metalness: 0,
  });
  const u = { uTime: { value: 0 }, uWave: { value: 1 } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWave;')
      .replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        float fly = uv.x;
        float ph = fly * 9.0 - uTime * (5.0 + 5.0 * uWave);
        transformed.z += sin(ph) * fly * (0.12 + 0.18 * uWave) * 1.5;
        transformed.y += sin(ph * 0.7 + 1.3) * fly * 0.08;
      `);
  };
  mat.userData.u = u;
  return mat;
}
