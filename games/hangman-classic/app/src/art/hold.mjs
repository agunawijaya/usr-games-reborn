import { brushes, f1, grain, linear, paint, radial, seeded, svg } from './kit.mjs';

/**
 * The Pirate's Hold: the plank wall of a galleon's hold, an iron wall torch, a barrel that
 * floats when the water rises, a treasure chest, and the flotsam left when the hold floods.
 */

const W = {
  ink: '#140b05',
  plank: '#5a3a20',
  plankHi: '#8a6038',
  plankLo: '#2e1c0e',
  seam: '#0b0502',
  beam: '#3a2412',
  iron: '#2f3136',
  ironHi: '#7a7f88',
  rust: '#6b3a1c',
  gold: '#e7b44a',
  goldHi: '#fff1b2',
  goldLo: '#8c5c18',
  warm: '#ffb45a',
};

/** The wall behind everything, 1600 × 900, drawn to be cropped (`slice`) to the stage. */
export function holdWall({ id = 'hw' } = {}) {
  const rand = seeded(31);
  const p = id;
  const rowH = 126;
  const rows = Math.ceil(900 / rowH) + 1;
  const tones = ['#5b3b20', '#523419', '#634226', '#4c311b', '#5e3d22', '#563820', '#4f321c', '#603f24'];

  const planks = [];
  for (let r = 0; r < rows; r++) {
    const y = r * rowH - 6;
    // Plank ends staggered row by row, like real strakes.
    let x = -((r * 337) % 520);
    while (x < 1600) {
      const len = 420 + Math.floor(rand() * 360);
      const tone = tones[Math.floor(rand() * tones.length)];
      planks.push(plank(p, rand, x, y, len, rowH, tone));
      x += len;
    }
  }

  const posts = [380, 1210].map((x) => post(p, x)).join('');
  const beam = `<g>
    <rect x="0" y="0" width="1600" height="54" fill="url(#${p}-beam)"/>
    <rect x="0" y="50" width="1600" height="8" fill="#000" opacity="0.55" filter="url(#${p}-b4)"/>
    <path d="M0,46 L1600,46" stroke="#7a5230" stroke-width="2" opacity="0.5"/>
    ${[120, 520, 980, 1420].map((x) => `<rect x="${x}" y="8" width="26" height="40" rx="3" fill="url(#${p}-ironv)" stroke="${W.ink}" stroke-width="2"/><circle cx="${x + 13}" cy="18" r="3" fill="${W.ironHi}"/><circle cx="${x + 13}" cy="38" r="3" fill="${W.ironHi}"/>`).join('')}
  </g>`;

  // Torchlight pools where the two sconces hang; the porthole spills moonlight below itself.
  const light = `<g style="mix-blend-mode:screen">
    <ellipse cx="171" cy="200" rx="330" ry="300" fill="url(#${p}-pool)"/>
    <ellipse cx="1429" cy="214" rx="300" ry="280" fill="url(#${p}-pool)" opacity="0.85"/>
    <ellipse cx="880" cy="470" rx="220" ry="120" fill="url(#${p}-moon)" opacity="0.5"/>
  </g>`;
  const vignette = `<rect width="1600" height="900" fill="url(#${p}-vignette)"/>`;

  const defs = `<defs>
    ${brushes(p)}
    ${linear(`${p}-beam`, [[0, '#4a2e16'], [0.6, '#2c190b'], [1, '#160b04']])}
    ${linear(`${p}-post`, [[0, '#3c2614'], [0.25, '#6a4526'], [0.6, '#3a2412'], [1, '#1c1008']], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${linear(`${p}-ironv`, [[0, W.ironHi], [0.5, W.iron], [1, '#121316']], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${radial(`${p}-pool`, [[0, W.warm, 0.42], [0.45, '#ff8c3a', 0.14], [1, '#ff7a20', 0]])}
    ${radial(`${p}-moon`, [[0, '#9fb6e8', 0.35], [1, '#9fb6e8', 0]])}
    ${radial(`${p}-vignette`, [[0, '#000', 0], [0.6, '#000', 0.15], [1, '#000', 0.7]], { r: 0.75 })}
    ${grain(`${p}-wood`, { frequency: '0.004 0.09', octaves: 3, strength: 0.45, seed: 5 })}
  </defs>`;

  return svg('0 0 1600 900', `${defs}<rect width="1600" height="900" fill="#1a0e06"/>${planks.join('')}${posts}${beam}${light}${vignette}`, {
    ratio: 'xMidYMid slice',
  });
}

function plank(p, rand, x, y, len, h, tone) {
  const grainLines = [];
  for (let k = 0; k < 7; k++) {
    const gy = y + 10 + k * (h - 20) / 6 + (rand() - 0.5) * 6;
    const amp = 2 + rand() * 4;
    let d = `M${f1(x)},${f1(gy)}`;
    for (let sx = 40; sx <= len; sx += 40) d += ` Q${f1(x + sx - 20)},${f1(gy + (rand() - 0.5) * amp * 2)} ${f1(x + sx)},${f1(gy + (rand() - 0.5) * amp)}`;
    grainLines.push(`<path d="${d}" stroke="${k % 2 ? '#2a170a' : '#8a6038'}" stroke-width="${f1(0.8 + rand() * 1.4)}" fill="none" opacity="${f1(0.25 + rand() * 0.3)}"/>`);
  }
  const knots = [];
  if (rand() < 0.7) {
    const kx = x + 60 + rand() * (len - 120);
    const ky = y + 24 + rand() * (h - 48);
    const rx = 8 + rand() * 10;
    knots.push(`<ellipse cx="${f1(kx)}" cy="${f1(ky)}" rx="${f1(rx)}" ry="${f1(rx * 0.55)}" fill="#2a170a" opacity="0.8"/>
      <ellipse cx="${f1(kx)}" cy="${f1(ky)}" rx="${f1(rx * 1.9)}" ry="${f1(rx * 0.9)}" fill="none" stroke="#2a170a" stroke-width="1.4" opacity="0.45"/>
      <ellipse cx="${f1(kx)}" cy="${f1(ky)}" rx="${f1(rx * 2.8)}" ry="${f1(rx * 1.2)}" fill="none" stroke="#2a170a" stroke-width="1" opacity="0.3"/>`);
  }
  const nails = [x + 14, x + len - 14]
    .map((nx) => [y + 22, y + h - 22].map((ny) => `<circle cx="${f1(nx)}" cy="${f1(ny)}" r="4.4" fill="#141010"/><circle cx="${f1(nx - 1.2)}" cy="${f1(ny - 1.2)}" r="1.6" fill="#6a6058"/>`).join(''))
    .join('');
  const wet = rand() < 0.35 ? `<path d="M${f1(x + 30 + rand() * (len - 60))},${y + h} q${f1(rand() * 10)},${f1(-30 - rand() * 40)} ${f1(-4 + rand() * 8)},${f1(-60 - rand() * 30)}" stroke="#000" stroke-width="10" opacity="0.18" fill="none" filter="url(#${p}-b4)"/>` : '';
  return `<g>
    <rect x="${f1(x)}" y="${f1(y)}" width="${len}" height="${h}" fill="${tone}" filter="url(#${p}-wood)"/>
    <rect x="${f1(x)}" y="${f1(y)}" width="${len}" height="10" fill="#9a6c40" opacity="0.18"/>
    <rect x="${f1(x)}" y="${f1(y + h - 16)}" width="${len}" height="16" fill="#000" opacity="0.25"/>
    ${grainLines.join('')}${knots.join('')}${wet}${nails}
    <path d="M${f1(x)},${f1(y)} L${f1(x)},${f1(y + h)}" stroke="${W.seam}" stroke-width="4"/>
    <path d="M${f1(x)},${f1(y + h)} L${f1(x + len)},${f1(y + h)}" stroke="${W.seam}" stroke-width="5"/>
  </g>`;
}

function post(p, x) {
  return `<g>
    <rect x="${x - 34}" y="0" width="12" height="900" fill="#000" opacity="0.45" filter="url(#${p}-b7)"/>
    <rect x="${x - 26}" y="0" width="56" height="900" fill="url(#${p}-post)" filter="url(#${p}-wood)"/>
    <path d="M${x - 26},0 L${x - 26},900 M${x + 30},0 L${x + 30},900" stroke="${W.ink}" stroke-width="3"/>
    <path d="M${x - 18},0 L${x - 18},900" stroke="#8a5e34" stroke-width="2" opacity="0.4"/>
    ${[150, 470, 780]
      .map((y) => `<rect x="${x - 30}" y="${y}" width="64" height="22" rx="3" fill="url(#${p}-ironv)" stroke="${W.ink}" stroke-width="2"/>
        <circle cx="${x - 18}" cy="${y + 11}" r="3.4" fill="${W.ironHi}"/><circle cx="${x + 22}" cy="${y + 11}" r="3.4" fill="${W.ironHi}"/>
        <path d="M${x - 28},${y + 22} q4,26 0,46" stroke="${W.rust}" stroke-width="5" opacity="0.4" fill="none"/>`)
      .join('')}
  </g>`;
}

/** An iron wall sconce holding a pitch torch; its head sits where the animated flame burns. */
export function wallTorch({ id = 'wt' } = {}) {
  const p = id;
  const defs = `<defs>${brushes(p)}
    ${linear(`${p}-iron`, [[0, W.ironHi], [0.45, W.iron], [1, '#0e0f12']], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${linear(`${p}-shaft`, [[0, '#a7743f'], [0.4, '#7a4f28'], [1, '#331c0b']], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${linear(`${p}-pitch`, [[0, '#4a2a16'], [0.5, '#24130a'], [1, '#0c0603']], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${radial(`${p}-ember`, [[0, '#ffdf8a', 0.95], [0.5, '#ff7a1a', 0.6], [1, '#ff4a10', 0]])}
  </defs>`;
  const ink = W.ink;
  const body = `${defs}
    <ellipse cx="41" cy="172" rx="22" ry="30" fill="#000" opacity="0.35" filter="url(#${p}-b7)" transform="translate(3 4)"/>
    ${paint(p, 'plate', 'M41,140 C53,140 62,150 62,164 C62,182 51,190 41,202 C31,190 20,182 20,164 C20,150 29,140 41,140 Z', {
      fill: `url(#${p}-iron)`,
      ink,
      strokes: [
        { d: 'M26,152 C24,164 26,178 34,188', c: W.ironHi, w: 5, o: 0.5, b: 2 },
        { d: 'M56,156 C58,170 54,182 46,192', c: '#000', w: 7, o: 0.6, b: 4 },
        { d: 'M34,190 C36,196 40,200 42,202', c: W.rust, w: 6, o: 0.45, b: 2 },
      ],
    })}
    <path d="M41,146 C49,146 55,154 55,164 C55,176 48,182 41,190 C34,182 27,176 27,164 C27,154 33,146 41,146 Z" fill="none" stroke="${ink}" stroke-width="1.2" opacity="0.7"/>
    ${[[41, 148], [29, 166], [53, 166], [41, 188]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="${W.ironHi}" stroke="${ink}" stroke-width="1"/>`).join('')}
    <path d="M30,136 C22,132 20,124 26,120 C30,118 34,122 32,126 M52,136 C60,132 62,124 56,120 C52,118 48,122 50,126" fill="none" stroke="${ink}" stroke-width="4.4" stroke-linecap="round"/>
    <path d="M30,136 C22,132 20,124 26,120 C30,118 34,122 32,126 M52,136 C60,132 62,124 56,120 C52,118 48,122 50,126" fill="none" stroke="url(#${p}-iron)" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M41,146 L41,128" stroke="${ink}" stroke-width="7"/><path d="M41,146 L41,128" stroke="url(#${p}-iron)" stroke-width="4.4"/>
    ${paint(p, 'shaft', 'M36,104 L46,104 L44,206 C44,212 38,212 38,206 Z', {
      fill: `url(#${p}-shaft)`,
      ink,
      strokes: [
        { d: 'M38,110 L39.5,204', c: '#e0a866', w: 2, o: 0.6, b: 0 },
        { d: 'M44,110 L43,204', c: '#2a1608', w: 3, o: 0.5, b: 1 },
      ],
    })}
    <ellipse cx="41" cy="128" rx="13" ry="4.6" fill="none" stroke="${ink}" stroke-width="6"/>
    <ellipse cx="41" cy="128" rx="13" ry="4.6" fill="none" stroke="url(#${p}-iron)" stroke-width="3.6"/>
    ${paint(p, 'pitch', 'M30,90 C30,84 52,84 52,90 L50,112 C50,118 32,118 32,112 Z', {
      fill: `url(#${p}-pitch)`,
      ink,
      strokes: [
        { d: 'M31,96 C38,92 46,94 52,98', c: '#000', w: 3, o: 0.75, b: 0 },
        { d: 'M31,104 C38,100 46,102 51,106', c: '#000', w: 3, o: 0.75, b: 0 },
        { d: 'M34,90 L34,114', c: '#8a5a30', w: 2.4, o: 0.5, b: 1 },
        { d: 'M48,92 L47,114', c: '#ff8a3a', w: 3, o: 0.35, b: 2 },
      ],
    })}
    <ellipse cx="41" cy="88" rx="12" ry="5" fill="url(#${p}-ember)"/>`;
  return svg('0 0 82 220', body, { ratio: 'xMidYMid meet' });
}

/** A water barrel, staves, three iron hoops and a bung; it floats when the hold floods. */
export function barrel({ id = 'br' } = {}) {
  const p = id;
  const ink = W.ink;
  const defs = `<defs>${brushes(p)}
    ${linear(`${p}-body`, [[0, '#4e2f17'], [0.18, '#a26d3c'], [0.42, '#7d5129'], [0.75, '#4a2c14'], [1, '#1e1108']], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${linear(`${p}-hoop`, [[0, '#2a2b30'], [0.2, '#8b9099'], [0.45, '#3f4148'], [1, '#101114']], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${radial(`${p}-top`, [[0, '#9b6a3a'], [1, '#4e2f17']], { cx: 0.35, cy: 0.4, r: 0.8 })}
    ${grain(`${p}-wood`, { frequency: '0.25 0.012', octaves: 3, strength: 0.4, seed: 8 })}
  </defs>`;
  const outline = 'M30,52 C18,96 18,186 30,236 C60,252 160,252 190,236 C202,186 202,96 190,52 C160,40 60,40 30,52 Z';
  const staves = [];
  for (let i = 1; i < 9; i++) {
    const t = i / 9;
    const xTop = 30 + t * 160;
    const bulge = Math.sin(t * Math.PI) * 0 + (t - 0.5) * 22;
    staves.push(`<path d="M${f1(xTop)},${f1(44 + Math.abs(t - 0.5) * 16)} Q${f1(xTop + bulge)},144 ${f1(xTop)},${f1(244 - Math.abs(t - 0.5) * 12)}" stroke="#1d1007" stroke-width="2" fill="none" opacity="0.75"/>
      <path d="M${f1(xTop + 3)},${f1(48 + Math.abs(t - 0.5) * 16)} Q${f1(xTop + bulge + 3)},144 ${f1(xTop + 3)},${f1(240 - Math.abs(t - 0.5) * 12)}" stroke="#c48d55" stroke-width="1" fill="none" opacity="${t < 0.5 ? 0.35 : 0.12}"/>`);
  }
  const hoop = (y, bulge) =>
    `<path d="M${f1(26 - bulge)},${y} C${f1(60)},${y + 14} ${f1(160)},${y + 14} ${f1(194 + bulge)},${y} L${f1(194 + bulge)},${y + 14} C160,${y + 28} 60,${y + 28} ${f1(26 - bulge)},${y + 14} Z" fill="url(#${p}-hoop)" stroke="${ink}" stroke-width="2"/>
     <path d="M${f1(30 - bulge)},${y + 3} C60,${y + 16} 160,${y + 16} ${f1(190 + bulge)},${y + 3}" stroke="#c9ced6" stroke-width="1.2" fill="none" opacity="0.6"/>
     ${[48, 92, 128, 172].map((x) => `<circle cx="${x}" cy="${f1(y + 10 + Math.sin(((x - 26) / 168) * Math.PI) * 9)}" r="2" fill="#a9aeb6"/>`).join('')}`;
  const body = `${defs}
    <ellipse cx="110" cy="252" rx="92" ry="12" fill="#000" opacity="0.5" filter="url(#${p}-b7)"/>
    ${paint(p, 'body', outline, {
      fill: `url(#${p}-body)`,
      ink,
      line: 2.6,
      filter: `url(#${p}-wood)`,
      strokes: [
        { d: 'M60,60 C52,110 52,180 60,236', c: '#e2a868', w: 14, o: 0.45, b: 7 },
        { d: 'M176,60 C186,110 186,180 176,236', c: '#000', w: 24, o: 0.5, b: 12 },
        { d: 'M30,200 C80,226 140,226 190,200', c: '#0b1a22', w: 40, o: 0.35, b: 12 },
      ],
      after: staves.join(''),
    })}
    ${hoop(66, 0)}${hoop(132, 8)}${hoop(206, 2)}
    <ellipse cx="110" cy="50" rx="80" ry="16" fill="url(#${p}-top)" stroke="${ink}" stroke-width="2.4"/>
    <ellipse cx="110" cy="52" rx="70" ry="12" fill="none" stroke="#2a170a" stroke-width="2"/>
    <path d="M58,46 L162,46 M54,54 L166,54" stroke="#2a170a" stroke-width="1.4" opacity="0.7"/>
    <ellipse cx="88" cy="47" rx="26" ry="4" fill="#d79c5c" opacity="0.35"/>
    <ellipse cx="96" cy="164" rx="10" ry="7" fill="#1a0d05" stroke="${ink}" stroke-width="1.6"/>
    <ellipse cx="96" cy="163" rx="7" ry="4.6" fill="#a87b4f"/>
    <path d="M90,162 L102,162" stroke="#6b4626" stroke-width="1.2"/>`;
  return svg('0 0 220 270', body, { ratio: 'xMidYMax meet' });
}

/** An open treasure chest heaped with coins, a ruby, an emerald and a string of pearls. */
export function chest({ id = 'ch' } = {}) {
  const rand = seeded(17);
  const p = id;
  const ink = W.ink;
  const defs = `<defs>${brushes(p)}
    ${linear(`${p}-wood`, [[0, '#8a5a30'], [0.5, '#5a3618'], [1, '#2a1708']], { x1: 0, y1: 0, x2: 1, y2: 0.3 })}
    ${linear(`${p}-lidIn`, [[0, '#2a1708'], [1, '#5a3618']])}
    ${linear(`${p}-band`, [[0, '#8b9099'], [0.4, '#3f4148'], [1, '#141518']])}
    ${linear(`${p}-gold`, [[0, W.goldHi], [0.45, W.gold], [1, W.goldLo]])}
    ${radial(`${p}-shine`, [[0, '#fff2b0', 0.75], [0.4, '#ffcc55', 0.3], [1, '#ffb030', 0]])}
    ${radial(`${p}-ruby`, [[0, '#ffb0b0'], [0.4, '#d81b3a'], [1, '#5a0414']], { cx: 0.35, cy: 0.3 })}
    ${radial(`${p}-emerald`, [[0, '#c8ffd8'], [0.4, '#1bb860'], [1, '#05401c']], { cx: 0.35, cy: 0.3 })}
    ${grain(`${p}-grain`, { frequency: '0.02 0.3', octaves: 2, strength: 0.4, seed: 12 })}
  </defs>`;

  const coins = [];
  for (let i = 0; i < 46; i++) {
    const t = rand();
    const x = 54 + rand() * 192;
    const heap = 104 - Math.sin(((x - 54) / 192) * Math.PI) * 40;
    const y = heap + rand() * 30 + t * 8;
    const r = 8 + rand() * 3;
    coins.push(`<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(r)}" ry="${f1(r * (0.45 + rand() * 0.35))}" fill="url(#${p}-gold)" stroke="#6a440f" stroke-width="1.2" transform="rotate(${f1((rand() - 0.5) * 40)} ${f1(x)} ${f1(y)})"/>`);
  }
  const spill = [
    [36, 214], [52, 222], [262, 218], [276, 210], [248, 228],
  ]
    .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="10" ry="4.4" fill="url(#${p}-gold)" stroke="#6a440f" stroke-width="1.2"/>`)
    .join('');
  const pearls = Array.from({ length: 13 }, (_, i) => {
    const t = i / 12;
    const x = 220 + t * 48;
    const y = 128 + Math.sin(t * Math.PI) * 26 + t * 60;
    return `<circle cx="${f1(x)}" cy="${f1(y)}" r="4" fill="#f4f0e6" stroke="#8a8478" stroke-width="0.8"/><circle cx="${f1(x - 1.2)}" cy="${f1(y - 1.2)}" r="1.2" fill="#fff"/>`;
  }).join('');
  const sparkles = [
    [96, 88], [170, 72], [206, 96], [132, 110],
  ]
    .map(([x, y]) => `<path d="M${x},${y - 9} L${x + 2},${y - 2} L${x + 9},${y} L${x + 2},${y + 2} L${x},${y + 9} L${x - 2},${y + 2} L${x - 9},${y} L${x - 2},${y - 2} Z" fill="#fffbe6" opacity="0.9"/>`)
    .join('');

  const body = `${defs}
    <ellipse cx="150" cy="232" rx="140" ry="12" fill="#000" opacity="0.5" filter="url(#${p}-b7)"/>
    ${paint(p, 'lid', 'M40,96 C40,40 90,14 150,14 C210,14 260,40 260,96 L246,100 C244,50 204,30 150,30 C96,30 56,50 54,100 Z', {
      fill: `url(#${p}-wood)`,
      ink,
      line: 2.4,
      filter: `url(#${p}-grain)`,
      strokes: [{ d: 'M60,40 C90,22 130,18 150,18', c: '#c08850', w: 6, o: 0.5, b: 2 }],
    })}
    <path d="M100,22 C100,40 100,70 100,98 M200,22 C200,40 200,70 200,98" stroke="url(#${p}-band)" stroke-width="12"/>
    ${paint(p, 'lidIn', 'M54,100 C56,50 96,30 150,30 C204,30 244,50 246,100 Z', {
      fill: `url(#${p}-lidIn)`,
      ink,
      line: 2,
      strokes: [{ d: 'M70,90 C80,56 120,40 150,40', c: '#000', w: 16, o: 0.5, b: 7 }],
    })}
    <circle cx="150" cy="150" r="140" fill="url(#${p}-shine)"/>
    ${coins.join('')}
    <path d="M116,78 L126,62 L138,78 L126,92 Z" fill="url(#${p}-ruby)" stroke="#3a0208" stroke-width="1.4"/>
    <path d="M180,92 L192,80 L204,92 L192,104 Z" fill="url(#${p}-emerald)" stroke="#022410" stroke-width="1.4"/>
    <path d="M150,88 C146,70 166,62 172,74 C176,84 166,96 150,88 Z" fill="url(#${p}-gold)" stroke="#6a440f" stroke-width="1.4"/>
    ${pearls}
    ${paint(p, 'box', 'M34,110 L266,110 L258,224 L42,224 Z', {
      fill: `url(#${p}-wood)`,
      ink,
      line: 2.6,
      filter: `url(#${p}-grain)`,
      strokes: [
        { d: 'M40,116 L260,116', c: '#c08850', w: 6, o: 0.5, b: 2 },
        { d: 'M246,112 L240,222', c: '#000', w: 30, o: 0.5, b: 12 },
        { d: 'M40,150 L262,150 M42,188 L260,188', c: '#1e1006', w: 2, o: 0.7, b: 0 },
      ],
    })}
    <path d="M30,108 L270,108 L268,122 L32,122 Z" fill="url(#${p}-band)" stroke="${ink}" stroke-width="2"/>
    <path d="M38,214 L262,214 L260,226 L40,226 Z" fill="url(#${p}-band)" stroke="${ink}" stroke-width="2"/>
    <path d="M96,108 L104,108 L102,226 L94,226 Z M196,108 L204,108 L206,226 L198,226 Z" fill="url(#${p}-band)" stroke="${ink}" stroke-width="1.6"/>
    ${paint(p, 'lock', 'M136,126 L164,126 L162,162 C156,170 144,170 138,162 Z', {
      fill: `url(#${p}-gold)`,
      ink,
      line: 1.8,
      strokes: [{ d: 'M158,128 L156,164', c: W.goldLo, w: 6, o: 0.6, b: 2 }],
    })}
    <path d="M150,140 C146,140 145,146 148,148 L147,156 L153,156 L152,148 C155,146 154,140 150,140 Z" fill="${ink}"/>
    ${[46, 254].map((x) => [116, 220].map((y) => `<circle cx="${x}" cy="${y}" r="3" fill="#a9aeb6" stroke="${ink}" stroke-width="0.8"/>`).join('')).join('')}
    ${spill}${sparkles}`;
  return svg('0 0 300 244', body, { ratio: 'xMidYMax meet' });
}

/**
 * What the flooded hold leaves floating: the captain's hat, a spar, a bottle with a message,
 * a crate, a coil of rope and the snuffed lantern. Each piece is its own small picture.
 */
export function flotsam(kind, { id = `fl-${kind}` } = {}) {
  const p = id;
  const ink = W.ink;
  const defs = `<defs>${brushes(p)}
    ${linear(`${p}-wood`, [[0, '#9a6a3a'], [0.5, '#6a4322'], [1, '#33200e']])}
    ${linear(`${p}-felt`, [[0, '#3a3850'], [0.6, '#22202c'], [1, '#0b0a10']])}
    ${linear(`${p}-glass`, [[0, '#9ae0b0', 0.85], [0.5, '#2f8a58', 0.75], [1, '#0f3a22', 0.9]], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${linear(`${p}-iron`, [[0, W.ironHi], [0.5, W.iron], [1, '#0e0f12']], { x1: 0, y1: 0, x2: 1, y2: 0 })}
  </defs>`;
  const pieces = {
    hat: [
      '0 0 160 80',
      `${paint(p, 'hat', 'M8,46 C14,28 34,22 52,26 C62,12 98,10 110,24 C128,20 148,30 152,46 C140,58 118,66 80,68 C42,66 20,58 8,46 Z', {
        fill: `url(#${p}-felt)`,
        ink,
        strokes: [
          { d: 'M20,40 C34,30 48,30 56,32', c: '#55557a', w: 6, o: 0.6, b: 2 },
          { d: 'M52,26 C62,40 72,52 80,66 M110,24 C100,40 92,52 82,66', c: '#000', w: 6, o: 0.6, b: 2 },
        ],
      })}
      <path d="M10,48 C24,60 50,68 80,70 C112,68 138,60 150,48" fill="none" stroke="${W.gold}" stroke-width="3.4"/>`,
    ],
    spar: [
      '0 0 220 40',
      `${paint(p, 'spar', 'M6,16 C40,10 180,10 214,16 L212,28 C180,32 40,32 8,28 Z', {
        fill: `url(#${p}-wood)`,
        ink,
        strokes: [
          { d: 'M10,14 L210,14', c: '#d0a068', w: 3, o: 0.6, b: 1 },
          { d: 'M40,22 L80,21 M120,23 L170,22', c: '#2a170a', w: 1.4, o: 0.7, b: 0 },
        ],
      })}
      <path d="M150,10 L160,2 L164,12" stroke="${ink}" stroke-width="2" fill="none"/>
      <rect x="60" y="11" width="8" height="20" fill="url(#${p}-iron)" stroke="${ink}" stroke-width="1.2"/>`,
    ],
    bottle: [
      '0 0 120 60',
      `<g transform="rotate(-14 60 30)">${paint(p, 'bottle', 'M14,20 C14,12 22,10 40,10 L76,12 C82,12 86,16 90,18 L104,20 L104,30 L90,32 C86,34 82,38 76,38 L40,40 C22,40 14,38 14,30 Z', {
        fill: `url(#${p}-glass)`,
        ink,
        strokes: [{ d: 'M22,16 L74,16', c: '#e8fff0', w: 3, o: 0.8, b: 1 }],
        after: `<rect x="28" y="18" width="40" height="14" rx="2" fill="#efe3c0" opacity="0.9"/><path d="M32,22 L62,22 M32,27 L56,27" stroke="#8a7a5a" stroke-width="1"/>`,
      })}
      <rect x="102" y="20" width="10" height="10" rx="2" fill="#a57a4a" stroke="${ink}" stroke-width="1.2"/></g>`,
    ],
    crate: [
      '0 0 110 90',
      `${paint(p, 'crate', 'M8,14 L102,8 L104,82 L10,86 Z', {
        fill: `url(#${p}-wood)`,
        ink,
        strokes: [
          { d: 'M8,14 L102,8 M10,48 L104,44 M10,86 L104,82', c: '#2a170a', w: 3, o: 0.8, b: 0 },
          { d: 'M10,16 L102,10', c: '#d0a068', w: 3, o: 0.6, b: 1 },
          { d: 'M96,12 L98,82', c: '#000', w: 14, o: 0.4, b: 4 },
        ],
      })}
      <path d="M12,16 L100,82 M100,12 L14,84" stroke="#4a2c14" stroke-width="5"/>`,
    ],
    rope: [
      '0 0 120 60',
      Array.from({ length: 4 }, (_, i) => `<ellipse cx="60" cy="30" rx="${52 - i * 11}" ry="${22 - i * 4.6}" fill="none" stroke="${ink}" stroke-width="9"/><ellipse cx="60" cy="30" rx="${52 - i * 11}" ry="${22 - i * 4.6}" fill="none" stroke="#b38a52" stroke-width="6" stroke-dasharray="4 3"/>`).join(''),
    ],
    lantern: [
      '0 0 70 90',
      `<g transform="rotate(68 35 45)"><path d="M18,20 L52,20 L48,30 L22,30 Z" fill="url(#${p}-iron)" stroke="${ink}" stroke-width="1.6"/>
        <rect x="20" y="30" width="30" height="40" fill="#2a3a2a" opacity="0.8" stroke="${ink}" stroke-width="1.6"/>
        <path d="M20,30 L20,70 M50,30 L50,70 M35,30 L35,70" stroke="url(#${p}-iron)" stroke-width="3"/>
        <path d="M16,70 L54,70 L50,80 L20,80 Z" fill="url(#${p}-iron)" stroke="${ink}" stroke-width="1.6"/>
        <circle cx="35" cy="12" r="7" fill="none" stroke="${W.iron}" stroke-width="3"/></g>`,
    ],
  };
  const [viewBox, art] = pieces[kind];
  return svg(viewBox, defs + art, { ratio: 'xMidYMid meet' });
}

export const FLOTSAM = ['hat', 'spar', 'bottle', 'crate', 'rope', 'lantern'];
