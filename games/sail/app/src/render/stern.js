// The stern's carved work, painted once per ship on a runtime canvas: a gilded taffrail with
// scrolls round a shell cartouche, gilt frames and pilasters round the stern windows, the ship's
// name on a board below them, a rope moulding and the nation's band. The same picture is the
// bump map, so the gilt stands proud of the dark ground and catches a low sun; no files, no
// carved geometry, one texture per ship.

import * as THREE from 'three';

const W = 512;
const H = 768;

/** Gilt with its own light: bright on the upper left, deep in the hollows. */
function gilt(g, x0, y0, x1, y1, base) {
  const grad = g.createLinearGradient(x0, y0, x1, y1);
  grad.addColorStop(0, '#fff1b8');
  grad.addColorStop(0.35, base);
  grad.addColorStop(1, '#5a4214');
  return grad;
}

function scroll(g, cx, cy, r, dir, fill) {
  // a carved volute: a spiral of shrinking arcs, ending in a leaf
  g.save();
  g.translate(cx, cy);
  g.scale(dir, 1);
  g.strokeStyle = fill;
  g.lineCap = 'round';
  let rr = r;
  let a = 0;
  g.beginPath();
  g.moveTo(rr, 0);
  for (let i = 0; i < 40; i++) {
    a += 0.28;
    rr *= 0.965;
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.lineWidth = r * 0.28;
  g.stroke();
  g.beginPath();
  g.moveTo(r, 0);
  g.quadraticCurveTo(r * 2.2, -r * 0.2, r * 3.1, r * 0.6);
  g.quadraticCurveTo(r * 2.2, r * 0.3, r, r * 0.45);
  g.fillStyle = fill;
  g.fill();
  g.restore();
}

function shell(g, cx, cy, r, fill) {
  // a scallop shell: ribs fanning up from a hinge, the cartouche at the taffrail's heart
  g.save();
  g.translate(cx, cy);
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(0, r * 0.35);
  g.arc(0, r * 0.35, r, Math.PI * 1.05, Math.PI * 1.95);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(40,26,6,0.65)';
  g.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI * (1.08 + (0.84 * i) / 8);
    g.beginPath();
    g.moveTo(0, r * 0.35);
    g.lineTo(Math.cos(a) * r * 0.95, r * 0.35 + Math.sin(a) * r * 0.95);
    g.stroke();
  }
  g.restore();
}

function ropeMoulding(g, y, h, fill) {
  g.fillStyle = 'rgba(30,20,6,0.8)';
  g.fillRect(0, y, W, h);
  g.fillStyle = fill;
  for (let x = -h; x < W + h; x += h * 0.9) {
    g.beginPath();
    g.moveTo(x, y + h);
    g.lineTo(x + h * 0.45, y + h);
    g.lineTo(x + h * 1.05, y);
    g.lineTo(x + h * 0.6, y);
    g.closePath();
    g.fill();
  }
}

/**
 * @param {{ sternX: number, bottom: number, top: number, rows: { y: number, xs: number[] }[],
 *   name: string, paint: object }} layout  sternX is the half-width the texture spans, bottom and
 *   top the stern's heights; rows the stern windows (their heights and centres), as hull.js
 *   places the glazing.
 * @returns {{ texture: THREE.CanvasTexture, uvOf: (x: number, y: number) => [number, number] }}
 */
export function paintStern({ sternX, bottom, top, rows, name, paint }) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const px = (x) => ((x + sternX) / (2 * sternX)) * W;
  const py = (y) => H - ((y - bottom) / (top - bottom)) * H;
  const m = H / (top - bottom); // pixels per metre, up the stern
  const gold = paint.trim;

  // ground: copper below the waterline, the dark wale above with its seams
  g.fillStyle = paint.wale;
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#9a5c34';
  g.fillRect(0, py(0), W, H - py(0));
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let y = 0.3; y < top; y += 0.3) g.fillRect(0, py(y), W, 1);

  // the nation's band across the counter, edged with rope moulding
  const counterY = rows.length ? rows[rows.length - 1].y - 2.1 : top - 3.5;
  g.fillStyle = paint.band;
  g.fillRect(0, py(counterY + 0.45), W, 0.9 * m);
  ropeMoulding(g, py(counterY + 0.62), 0.17 * m, gilt(g, 0, py(counterY + 0.62), 0, py(counterY + 0.45), gold));
  ropeMoulding(g, py(counterY - 0.45), 0.17 * m, gilt(g, 0, py(counterY - 0.45), 0, py(counterY - 0.62), gold));

  // gilt frames and pilasters round each row of windows
  for (const row of rows) {
    const yTop = py(row.y + 0.95);
    const yBot = py(row.y - 0.95);
    g.fillStyle = gilt(g, 0, yTop, 0, yBot, gold);
    g.fillRect(px(-sternX * 0.92), yTop, px(sternX * 0.92) - px(-sternX * 0.92), yBot - yTop);
    g.fillStyle = 'rgba(25,16,4,0.85)';
    for (const x of row.xs) g.fillRect(px(x - 0.55), py(row.y + 0.6), 1.1 * (W / (2 * sternX)), 1.2 * m);
    // pilasters between the lights, with a capital and a base
    const half = (row.xs[1] - row.xs[0]) / 2 || 0.8;
    for (let i = 0; i <= row.xs.length; i++) {
      const x = i === 0 ? row.xs[0] - half : row.xs[i - 1] + half;
      const pw = 0.18 * (W / (2 * sternX));
      g.fillStyle = gilt(g, px(x) - pw, yTop, px(x) + pw, yBot, gold);
      g.fillRect(px(x) - pw / 2, yTop - 4, pw, yBot - yTop + 8);
      g.fillRect(px(x) - pw, yTop - 6, pw * 2, 5);
      g.fillRect(px(x) - pw, yBot + 1, pw * 2, 5);
    }
  }

  // the name board under the windows
  const boardY = counterY - 1.15;
  const bw = W * 0.62;
  const bh = 0.7 * m;
  g.fillStyle = '#1a120a';
  g.fillRect((W - bw) / 2, py(boardY) - bh / 2, bw, bh);
  g.strokeStyle = gilt(g, 0, py(boardY) - bh / 2, 0, py(boardY) + bh / 2, gold);
  g.lineWidth = 4;
  g.strokeRect((W - bw) / 2, py(boardY) - bh / 2, bw, bh);
  g.fillStyle = gilt(g, 0, py(boardY) - bh / 3, 0, py(boardY) + bh / 3, gold);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const label = name.toUpperCase();
  let size = Math.min(bh * 0.72, 46);
  g.font = `700 ${size}px Georgia, "Times New Roman", serif`;
  while (g.measureText(label).width > bw * 0.88 && size > 10) {
    size -= 2;
    g.font = `700 ${size}px Georgia, "Times New Roman", serif`;
  }
  g.fillText(label, W / 2, py(boardY) + 1);

  // the taffrail: a carved band of scrolls meeting at a shell
  const tafTop = py(top);
  const tafBot = py(top - 1.3);
  g.fillStyle = gilt(g, 0, tafTop, 0, tafBot, gold);
  g.fillRect(0, tafTop, W, 0.22 * m);
  const fill = gilt(g, 0, tafTop, W * 0.3, tafBot, gold);
  const r = 0.32 * m;
  for (const dir of [1, -1]) {
    for (let k = 0; k < 3; k++) scroll(g, W / 2 + dir * (W * 0.16 + k * W * 0.13), tafTop + 0.75 * m, r * (1 - k * 0.15), dir, fill);
  }
  shell(g, W / 2, tafTop + 0.95 * m, 0.62 * m, gilt(g, W / 2, tafTop, W / 2, tafBot, gold));

  // leafy quarter-pieces down the stern's sides
  for (const side of [0, W]) {
    for (let k = 0; k < 6; k++) {
      const y = tafBot + k * 0.55 * m;
      g.fillStyle = gilt(g, side, y, side + (side ? -40 : 40), y + 30, gold);
      g.beginPath();
      g.ellipse(side + (side ? -14 : 14), y, 10, 0.28 * m, side ? -0.4 : 0.4, 0, Math.PI * 2);
      g.fill();
    }
  }

  // salt and weather
  g.globalAlpha = 0.07;
  for (let i = 0; i < 900; i++) {
    g.fillStyle = i % 2 ? '#ffffff' : '#000000';
    g.fillRect((i * 97) % W, (i * 233) % H, 2 + (i % 5), 1 + (i % 3));
  }
  g.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, uvOf: (x, y) => [(x + sternX) / (2 * sternX), (y - bottom) / (top - bottom)] };
}

/** The stern's material: the painting as colour, and the same texture as the bump that raises the
 *  gilt (one upload; read through its colour space the heights only bend a little). */
export function sternMaterial(texture) {
  return new THREE.MeshStandardMaterial({ map: texture, bumpMap: texture, bumpScale: 2.2, roughness: 0.55, metalness: 0.15, side: THREE.DoubleSide });
}
