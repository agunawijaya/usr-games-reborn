// The game's key art for the Hall: the Pirate's Hold, its captain lantern-lit right of centre (the
// Console Home hero writes the title bottom-left), drawn from the same pictures as the room and
// painted onto a 1280 × 720 canvas.

import { captain } from './art/captain.mjs';
import { barrel, chest, holdWall, wallTorch } from './art/hold.mjs';

const WIDTH = 1280;
const HEIGHT = 720;

/** Puts a picture's <svg> at (x, y) in a w × h box of the poster. */
function place(markup, x, y, w, h) {
  return markup.replace('<svg ', `<svg x="${x}" y="${y}" width="${w}" height="${h}" overflow="visible" `);
}

/** A torch flame, still: three tongues of fire and a glow on the wall. */
function flame(cx, cy, size) {
  return `<ellipse cx="${cx}" cy="${cy - size * 0.4}" rx="${size * 1.6}" ry="${size * 1.8}" fill="url(#poster-glow)"/>
    <path d="M${cx},${cy} C${cx - size * 0.55},${cy - size * 0.2} ${cx - size * 0.45},${cy - size * 0.9} ${cx},${cy - size * 1.5} C${cx + size * 0.45},${cy - size * 0.9} ${cx + size * 0.55},${cy - size * 0.2} ${cx},${cy} Z" fill="#ff7a24"/>
    <path d="M${cx},${cy} C${cx - size * 0.32},${cy - size * 0.2} ${cx - size * 0.26},${cy - size * 0.7} ${cx},${cy - size * 1.1} C${cx + size * 0.26},${cy - size * 0.7} ${cx + size * 0.32},${cy - size * 0.2} ${cx},${cy} Z" fill="#ffc45a"/>
    <path d="M${cx},${cy} C${cx - size * 0.14},${cy - size * 0.2} ${cx - size * 0.1},${cy - size * 0.5} ${cx},${cy - size * 0.7} C${cx + size * 0.1},${cy - size * 0.5} ${cx + size * 0.14},${cy - size * 0.2} ${cx},${cy} Z" fill="#fff4cc"/>`;
}

/** The porthole with its night sea, as the room shows it. */
function porthole(cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#0a1220" stroke="#1a0e08" stroke-width="${r * 0.14}"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.92}" fill="none" stroke="#3a2410" stroke-width="3" opacity="0.6"/>
    <clipPath id="poster-port"><circle cx="${cx}" cy="${cy}" r="${r * 0.86}"/></clipPath>
    <g clip-path="url(#poster-port)">
      <circle cx="${cx + r * 0.42}" cy="${cy - r * 0.52}" r="${r * 0.14}" fill="#d8d0b0" opacity="0.7"/>
      <path d="M${cx - r},${cy + r * 0.2} q${r * 0.3},-${r * 0.1} ${r * 0.6},0 t${r * 0.6},0 t${r * 0.6},0 V${cy + r} H${cx - r} Z" fill="#1a2540"/>
      <path d="M${cx - r},${cy + r * 0.42} q${r * 0.3},-${r * 0.1} ${r * 0.6},0 t${r * 0.6},0 t${r * 0.6},0 V${cy + r} H${cx - r} Z" fill="#2a3550"/>
    </g>
    ${Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return `<circle cx="${(cx + Math.cos(a) * r * 1.07).toFixed(1)}" cy="${(cy + Math.sin(a) * r * 1.07).toFixed(1)}" r="${r * 0.04}" fill="#0a0503"/>`;
    }).join('')}`;
}

/** The flood at the foot of the poster, its surface catching the torchlight. */
function flood() {
  return `<rect x="0" y="652" width="${WIDTH}" height="${HEIGHT - 652}" fill="url(#poster-water)"/>
    <path d="M0,656 ${Array.from({ length: 33 }, (_, i) => `Q${i * 40 + 20},${648 + (i % 2) * 3} ${i * 40 + 40},656`).join(' ')} L${WIDTH},664 L0,664 Z" fill="#d6e2ee" opacity="0.75"/>
    ${Array.from({ length: 10 }, (_, i) => `<path d="M${60 + i * 128},${668 + (i % 3) * 8} l${18 + (i % 4) * 6},0" stroke="#fff6e0" stroke-width="2" opacity="0.6" stroke-linecap="round"/>`).join('')}`;
}

export async function paintPoster() {
  const scene = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <radialGradient id="poster-glow"><stop offset="0" stop-color="#ffb45a" stop-opacity="0.45"/><stop offset="1" stop-color="#ff7a20" stop-opacity="0"/></radialGradient>
      <linearGradient id="poster-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3c5a7a" stop-opacity="0.85"/><stop offset="1" stop-color="#0a1432"/></linearGradient>
    </defs>
    ${place(holdWall({ id: 'poster-wall' }), 0, 0, WIDTH, HEIGHT)}
    ${porthole(470, 270, 82)}
    ${place(wallTorch({ id: 'poster-torch-l' }), 96, 76, 90, 242)}${flame(141, 156, 34)}
    ${place(wallTorch({ id: 'poster-torch-r' }), 1110, 90, 82, 220)}${flame(1151, 162, 30)}
    ${place(chest({ id: 'poster-chest' }), 120, 470, 270, 220)}
    ${place(barrel({ id: 'poster-barrel' }), 1000, 430, 190, 233)}
    ${place(captain({ id: 'poster-captain' }), 640, 92, 330, 628)}
    ${flood()}
  </svg>`;
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(scene)}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.getContext('2d').drawImage(image, 0, 0, WIDTH, HEIGHT);
  return canvas;
}
