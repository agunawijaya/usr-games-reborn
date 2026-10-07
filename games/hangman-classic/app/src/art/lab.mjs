import { blur, brushes, f1, grain, linear, paint, radial, seeded, svg } from './kit.mjs';

/**
 * The Alchemist's Laboratory: a tiled wall, a chart of the elements, a sketch of the
 * proportions of man pinned to the wall, a glowing atom, a Tesla coil, a distilling train and a
 * dropping funnel over a spirit lamp. Glass and metal catch the lab's sickly green light.
 */

const L = {
  ink: '#08110f',
  tile: '#1d3a36',
  tileHi: '#3f6f66',
  tileLo: '#0c1d1b',
  grout: '#06100e',
  green: '#8aff7e',
  greenHi: '#e4ffd8',
  copper: '#c06a2c',
  copperHi: '#f2a66a',
  copperLo: '#5e2a0c',
  brass: '#c9a24a',
  brassHi: '#fff0b0',
  brassLo: '#6e5216',
  chrome: '#c9d3d8',
  chromeLo: '#4b5a62',
  wood: '#5a3a20',
  woodHi: '#9a6a3c',
  woodLo: '#22140a',
  iron: '#2c3438',
  ironHi: '#7f8d94',
  paper: '#e6dcbc',
  paperLo: '#b9a97c',
  sepia: '#5a3a1c',
  glass: '#cfeee6',
};

/** The tiled wall, 1600 × 900, cropped to the stage: glazed subway tiles over painted panelling. */
export function labWall({ id = 'lw' } = {}) {
  const rand = seeded(41);
  const p = id;
  const tiles = [];
  const tw = 72;
  const th = 36;
  const tones = ['#1f3d39', '#1c3834', '#22433e', '#1a3531', '#20403b', '#244741'];
  for (let row = 0; row * th < 600; row++) {
    const offset = row % 2 ? -tw / 2 : 0;
    for (let col = 0; col * tw + offset < 1600; col++) {
      const x = col * tw + offset;
      const y = row * th;
      const tone = tones[Math.floor(rand() * tones.length)];
      const stained = rand() < 0.12;
      tiles.push(`<rect x="${f1(x + 1.5)}" y="${y + 1.5}" width="${tw - 3}" height="${th - 3}" rx="2.5" fill="${tone}"/>
        <path d="M${f1(x + 3)},${y + th - 4} L${f1(x + 3)},${y + 3} L${f1(x + tw - 4)},${y + 3}" stroke="#5c8f84" stroke-width="1.4" fill="none" opacity="${f1(0.25 + rand() * 0.2)}"/>
        <path d="M${f1(x + 3)},${y + th - 2} L${f1(x + tw - 2)},${y + th - 2} L${f1(x + tw - 2)},${y + 3}" stroke="#000" stroke-width="1.8" fill="none" opacity="0.5"/>
        ${stained ? `<rect x="${f1(x + 2)}" y="${y + 2}" width="${tw - 4}" height="${th - 4}" fill="#3a3416" opacity="${f1(0.2 + rand() * 0.25)}"/>` : ''}
        ${rand() < 0.04 ? `<path d="M${f1(x + 8 + rand() * 40)},${y + 2} l${f1(rand() * 8)},${f1(10 + rand() * 6)} l${f1(-6 + rand() * 12)},${f1(8 + rand() * 6)}" stroke="#020605" stroke-width="1.2" fill="none"/>` : ''}`);
    }
  }
  const panels = Array.from({ length: 8 }, (_, i) => {
    const x = i * 200 + 14;
    return `<rect x="${x}" y="630" width="172" height="176" rx="4" fill="#102420" stroke="#06100e" stroke-width="3"/>
      <rect x="${x + 10}" y="640" width="152" height="156" rx="3" fill="none" stroke="#2c4f48" stroke-width="2" opacity="0.6"/>
      <path d="M${x + 12},642 L${x + 160},642" stroke="#4f7a70" stroke-width="1.2" opacity="0.4"/>`;
  }).join('');
  const grime = Array.from({ length: 12 }, () => {
    const x = 40 + rand() * 1520;
    const len = 120 + rand() * 420;
    return `<path d="M${f1(x)},84 q${f1(rand() * 16 - 8)},${f1(len / 2)} ${f1(rand() * 20 - 10)},${f1(len)}" stroke="#2c2610" stroke-width="${f1(10 + rand() * 18)}" opacity="${f1(0.25 + rand() * 0.25)}" fill="none" filter="url(#${p}-b7)"/>`;
  }).join('');
  const body = `<defs>${brushes(p)}
      ${radial(`${p}-glow`, [[0, L.green, 0.3], [0.5, L.green, 0.08], [1, L.green, 0]])}
      ${radial(`${p}-vignette`, [[0, '#000', 0], [0.6, '#000', 0.25], [1, '#000', 0.78]], { r: 0.75 })}
      ${linear(`${p}-gloss`, [[0, '#cfffee', 0.1], [0.4, '#cfffee', 0.02], [1, '#cfffee', 0]], { x1: 0, y1: 0, x2: 0.6, y2: 1 })}
      ${grain(`${p}-grain`, { frequency: 0.7, octaves: 2, strength: 0.28, seed: 3 })}
    </defs>
    <rect width="1600" height="900" fill="#081412"/>
    <g filter="url(#${p}-grain)">${tiles.join('')}</g>
    <rect width="1600" height="600" fill="url(#${p}-gloss)"/>
    ${grime}
    <rect x="0" y="600" width="1600" height="230" fill="#0b1b18"/>
    ${panels}
    <rect x="0" y="596" width="1600" height="22" fill="#14231f" stroke="#050c0b" stroke-width="2"/>
    <rect x="0" y="598" width="1600" height="3" fill="#5c8f84" opacity="0.45"/>
    <rect x="0" y="618" width="1600" height="8" fill="#000" opacity="0.55" filter="url(#${p}-b4)"/>
    <ellipse cx="224" cy="450" rx="520" ry="420" fill="url(#${p}-glow)" style="mix-blend-mode:screen"/>
    <ellipse cx="1300" cy="560" rx="420" ry="300" fill="url(#${p}-glow)" opacity="0.6" style="mix-blend-mode:screen"/>
    <rect width="1600" height="900" fill="url(#${p}-vignette)"/>`;
  return svg('0 0 1600 900', body, { ratio: 'xMidYMid slice' });
}

const PERIODS = [
  ['H', ...Array(16).fill(''), 'He'],
  ['Li', 'Be', ...Array(10).fill(''), 'B', 'C', 'N', 'O', 'F', 'Ne'],
  ['Na', 'Mg', ...Array(10).fill(''), 'Al', 'Si', 'P', 'S', 'Cl', 'Ar'],
  ['K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr'],
  ['Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn', 'Sb', 'Te', 'I', 'Xe'],
  ['Cs', 'Ba', '*', 'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg', 'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn'],
  ['Fr', 'Ra', '*', 'Rf', 'Db', 'Sg', 'Bh', 'Hs', 'Mt', 'Ds', 'Rg', 'Cn', 'Nh', 'Fl', 'Mc', 'Lv', 'Ts', 'Og'],
];
const LANTHANIDES = ['La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu'];
const ACTINIDES = ['Ac', 'Th', 'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf', 'Es', 'Fm', 'Md', 'No', 'Lr'];
const NONMETALS = new Set(['H', 'C', 'N', 'O', 'P', 'S', 'Se']);
const HALOGENS = new Set(['F', 'Cl', 'Br', 'I', 'At', 'Ts']);
const METALLOIDS = new Set(['B', 'Si', 'Ge', 'As', 'Sb', 'Te', 'Po']);
const POST = new Set(['Al', 'Ga', 'In', 'Sn', 'Tl', 'Pb', 'Bi', 'Nh', 'Fl', 'Mc', 'Lv']);

function family(symbol, col) {
  if (col === 17) return '#9b8bc9';
  if (col === 0 && symbol !== 'H') return '#d27a62';
  if (col === 1) return '#d9a25e';
  if (NONMETALS.has(symbol)) return '#8fc79a';
  if (HALOGENS.has(symbol)) return '#77b8c9';
  if (METALLOIDS.has(symbol)) return '#a9c27a';
  if (POST.has(symbol)) return '#a7b3b0';
  return '#e0cc7c';
}

/** A framed chart of the elements, the paper yellowed and stained. */
export function periodicChart({ id = 'pc' } = {}) {
  const p = id;
  const cell = 19;
  const x0 = 22;
  const y0 = 44;
  const cells = [];
  PERIODS.forEach((row, r) => {
    row.forEach((symbol, c) => {
      if (!symbol) return;
      const x = x0 + c * cell;
      const y = y0 + r * cell;
      const fill = symbol === '*' ? '#c8d88a' : family(symbol, c);
      cells.push(`<rect x="${x}" y="${y}" width="${cell - 2}" height="${cell - 2}" rx="1.5" fill="${fill}" stroke="#3a3222" stroke-width="0.6"/>${symbol === '*' ? '' : `<text x="${x + (cell - 2) / 2}" y="${y + 12}" font-size="7.4" text-anchor="middle" font-family="Georgia, serif" font-weight="700" fill="#2a2214">${symbol}</text>`}`);
    });
  });
  [LANTHANIDES, ACTINIDES].forEach((row, r) => {
    row.forEach((symbol, c) => {
      const x = x0 + (c + 3) * cell;
      const y = y0 + 7 * cell + 8 + r * cell;
      cells.push(`<rect x="${x}" y="${y}" width="${cell - 2}" height="${cell - 2}" rx="1.5" fill="${r ? '#a8cf7a' : '#c8d88a'}" stroke="#3a3222" stroke-width="0.6"/><text x="${x + (cell - 2) / 2}" y="${y + 12}" font-size="7.4" text-anchor="middle" font-family="Georgia, serif" font-weight="700" fill="#2a2214">${symbol}</text>`);
    });
  });
  const body = `<defs>${brushes(p)}
      ${linear(`${p}-paper`, [[0, '#efe6c8'], [0.6, L.paper], [1, '#c9b98c']], { x1: 0, y1: 0, x2: 1, y2: 1 })}
      ${linear(`${p}-frame`, [[0, L.woodHi], [0.5, L.wood], [1, L.woodLo]], { x1: 0, y1: 0, x2: 1, y2: 1 })}
      ${radial(`${p}-stain`, [[0, '#8a6a2a', 0.35], [1, '#8a6a2a', 0]])}
      ${grain(`${p}-grain`, { frequency: 0.9, octaves: 3, strength: 0.3, seed: 6 })}
    </defs>
    <rect x="6" y="8" width="380" height="250" rx="4" fill="#000" opacity="0.5" filter="url(#${p}-b7)"/>
    <rect x="2" y="2" width="380" height="250" rx="4" fill="url(#${p}-frame)" stroke="${L.ink}" stroke-width="2"/>
    <rect x="12" y="12" width="360" height="230" fill="url(#${p}-paper)" filter="url(#${p}-grain)"/>
    <ellipse cx="300" cy="200" rx="60" ry="40" fill="url(#${p}-stain)"/>
    <ellipse cx="70" cy="40" rx="40" ry="24" fill="url(#${p}-stain)"/>
    <text x="192" y="32" font-size="12" text-anchor="middle" font-family="Georgia, serif" letter-spacing="3" fill="#3a2a14">TABULA ELEMENTORUM</text>
    <path d="M110,36 L274,36" stroke="#3a2a14" stroke-width="0.8"/>
    ${cells.join('')}
    <rect x="12" y="12" width="360" height="230" fill="none" stroke="#000" stroke-width="6" opacity="0.25"/>
    <path d="M330,12 L372,12 L372,48 Z" fill="#c9b98c" opacity="0.8"/>`;
  return svg('0 0 388 260', body, { ratio: 'xMidYMid meet', label: 'A chart of the elements' });
}

/**
 * A study of the proportions of man in the old manner: one figure, arms and legs in two positions,
 * the circle centred on the navel and the square as wide as the arms spread, in sepia ink on a
 * pinned sheet with notes in mirror script. Our own drawing, eight heads tall.
 */
export function proportions({ id = 'vm' } = {}) {
  const p = id;
  const rand = seeded(23);
  const ink = L.sepia;
  const stroke = (d, w = 1.25, o = 0.95) =>
    `<path d="${d}" stroke="${ink}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${o}"/>`;
  // The left half of the figure; the right half is its mirror about x = 150.
  const half = [
    // neck and the slope of the shoulder
    'M144,100 L143,107 C136,108 130,110 124,112',
    'M124,112 C120,116 121,122 126,126',
    // flank: armpit, ribs, waist, hip
    'M131,124 C129,138 130,150 134,160 C131,168 130,174 132,180',
    // chest, ribs and belly
    'M134,127 C139,134 145,135 149,131',
    'M136,141 C140,143 144,144 147,143 M137,149 C141,151 145,151 147,150',
    'M136,170 C140,176 145,181 150,184',
    // arm held level
    'M124,112 C110,110 96,110 82,111 L67,113 L49,114',
    'M131,124 C118,122 104,120 90,119 L67,117 L50,118',
    'M49,114 C45,114 44,118 50,118 M67,113 C64,111 61,111 59,113',
    'M98,111 C96,114 96,117 98,119',
    // arm raised
    'M127,110 C110,103 82,94 60,88 L48,84',
    'M132,121 C112,112 86,103 63,95 L49,90',
    'M48,84 C43,85 44,90 49,90 M62,89 C59,86 56,86 54,88',
    // leg straight
    'M132,180 C131,200 134,216 137,228 C136,240 138,256 141,272 L141,278',
    'M149,186 C146,204 146,218 146,228 C148,244 147,262 146,277',
    'M138,226 C140,230 144,231 146,228 M139,244 C141,250 142,258 141,266',
    'M141,278 C137,281 133,283 128,285 L147,285 L147,278',
    // leg spread
    'M133,178 C124,200 112,222 102,240 C95,250 89,257 84,262',
    'M148,186 C138,205 126,225 116,244 C108,254 98,262 91,267',
    'M100,236 C103,239 107,240 110,238',
    'M84,262 C78,266 74,270 71,275 L88,272 L91,267',
  ];
  const mirror = (d) => d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${f1(300 - Number(x))},${y}`);
  const figure = [...half, ...half.map(mirror)].map((d) => stroke(d)).join('');
  // Shading: fine parallel hatching on the side away from the light (the figure's left).
  const hatch = (x0, y0, x1, y1, n, dx = 5, dy = 3.4) =>
    Array.from({ length: n }, (_, i) => {
      const t = i / Math.max(1, n - 1);
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      return stroke(`M${f1(x)},${f1(y)} l${dx},${dy}`, 0.6, 0.55);
    }).join('');
  const shading = [
    hatch(161, 128, 164, 170, 14),
    hatch(156, 190, 160, 226, 11, 4, 3),
    hatch(155, 236, 157, 270, 10, 3, 3),
    hatch(170, 116, 196, 120, 8, 2, 4),
    hatch(146, 92, 156, 99, 4, 3, 2),
  ].join('');
  const head = `
    ${stroke('M150,74 C160,74 162,84 161,90 C160,97 156,101 150,101 C144,101 140,97 139,90 C138,84 140,74 150,74 Z', 1.3)}
    ${stroke('M143,86 C145,85 147,85 148,86 M152,86 C153,85 155,85 157,86', 1)}
    ${stroke('M142,83 C144,81 147,81 149,82 M151,82 C153,81 156,81 158,83', 1.1)}
    ${stroke('M150,86 L149,93 C150,94 151,94 152,93', 0.9)}
    ${stroke('M146,97 C148,96.5 152,96.5 154,97', 1)}
    ${[
      'M141,78 C135,84 137,92 133,99 C131,104 133,108 129,111',
      'M144,75 C138,80 139,88 136,94 C134,99 136,104 133,108',
      'M140,86 C137,92 139,98 136,104',
      'M159,78 C165,84 163,92 167,99 C169,104 167,108 171,111',
      'M156,75 C162,80 161,88 164,94 C166,99 164,104 167,108',
      'M160,86 C163,92 161,98 164,104',
      'M144,75 C147,72 153,72 156,75',
    ].map((d) => stroke(d, 1.1, 0.9)).join('')}`;
  // Notes in mirror script: loops and stems that read as a hand, not as letters.
  const script = (x0, y0, width, lines) =>
    Array.from({ length: lines }, (_, l) => {
      let x = x0 + rand() * 6;
      const y = y0 + l * 9;
      let d = `M${f1(x)},${y}`;
      while (x < x0 + width - 8) {
        const w = 2.4 + rand() * 2.4;
        const h = rand() < 0.2 ? 6 : 2.6 + rand() * 1.4;
        d += ` c${f1(w * 0.3)},${f1(-h)} ${f1(w)},${f1(-h)} ${f1(w)},0 c${f1(-w * 0.2)},${f1(h * 0.6)} ${f1(w * 0.4)},${f1(h * 0.6)} ${f1(w * 0.6)},0`;
        x += w * 1.6;
        if (rand() < 0.12) {
          x += 4 + rand() * 4;
          d += ` m${f1(4 + rand() * 4)},0`;
        }
      }
      return stroke(d, 0.7, 0.62);
    }).join('');
  const levels = [112, 131, 158, 179, 232]
    .map((y) => `<path d="M${y === 158 || y === 179 ? 120 : 126},${y} L${y === 158 || y === 179 ? 180 : 174},${y}" stroke="${ink}" stroke-width="0.5" opacity="0.45"/>`)
    .join('');
  const ticks = Array.from({ length: 9 }, (_, i) => stroke(`M${f1(45 + i * 26.25)},284 L${f1(45 + i * 26.25)},${i % 2 ? 289 : 292}`, 0.7, 0.7)).join('');
  const foxing = Array.from({ length: 14 }, () => `<circle cx="${f1(20 + rand() * 260)}" cy="${f1(20 + rand() * 300)}" r="${f1(1 + rand() * 3)}" fill="#8a5a20" opacity="${f1(0.12 + rand() * 0.15)}"/>`).join('');
  const body = `<defs>${brushes(p)}
      ${linear(`${p}-paper`, [[0, '#f1e6c6'], [0.6, '#e4d4a8'], [1, '#c9b07e']], { x1: 0, y1: 0, x2: 1, y2: 1 })}
      ${radial(`${p}-age`, [[0, '#000', 0], [0.7, '#6a4a1a', 0.12], [1, '#5a3a10', 0.5]], { r: 0.72 })}
      ${grain(`${p}-grain`, { frequency: 0.8, octaves: 3, strength: 0.32, seed: 13 })}
    </defs>
    <path d="M14,14 L286,10 L292,322 L18,330 Z" fill="#000" opacity="0.5" filter="url(#${p}-b7)" transform="translate(5 6)"/>
    <path d="M14,14 L60,12 L64,16 L120,11 L180,13 L230,10 L286,10 L289,90 L285,160 L291,240 L292,322 L240,326 L180,323 L120,328 L60,325 L18,330 L16,250 L20,170 L13,90 Z" fill="url(#${p}-paper)" filter="url(#${p}-grain)"/>
    <path d="M14,14 L60,12 L64,16 L120,11 L180,13 L230,10 L286,10 L289,90 L285,160 L291,240 L292,322 L240,326 L180,323 L120,328 L60,325 L18,330 L16,250 L20,170 L13,90 Z" fill="url(#${p}-age)"/>
    ${foxing}
    <path d="M150,12 L151,328" stroke="#8a6a3a" stroke-width="0.8" opacity="0.25"/>
    ${script(36, 22, 228, 4)}
    <circle cx="150" cy="158" r="126" fill="none" stroke="${ink}" stroke-width="1.4" opacity="0.9"/>
    <rect x="45" y="74" width="210" height="210" fill="none" stroke="${ink}" stroke-width="1.4" opacity="0.9"/>
    ${levels}${ticks}
    ${head}${figure}${shading}
    <circle cx="150" cy="158" r="1.3" fill="${ink}" opacity="0.8"/>
    ${script(40, 300, 220, 3)}
    <circle cx="40" cy="22" r="5" fill="#3a3a3a" stroke="#111" stroke-width="1"/><circle cx="262" cy="20" r="5" fill="#3a3a3a" stroke="#111" stroke-width="1"/>
    <circle cx="39" cy="21" r="1.6" fill="#999"/><circle cx="261" cy="19" r="1.6" fill="#999"/>`;
  return svg('0 0 300 340', body, { ratio: 'xMidYMid meet', label: 'A study of the proportions of man' });
}

/** An atom glowing green: a cluster of a nucleus and three orbits with their electrons. */
export function atom({ id = 'at' } = {}) {
  const p = id;
  const rand = seeded(5);
  const nucleus = Array.from({ length: 9 }, (_, i) => {
    const a = i * 2.4;
    const r = i === 0 ? 0 : 7 + (i % 3) * 3;
    const x = 150 + Math.cos(a) * r;
    const y = 150 + Math.sin(a) * r;
    const proton = i % 2 === 0;
    return `<circle cx="${f1(x)}" cy="${f1(y)}" r="9" fill="url(#${p}-${proton ? 'proton' : 'neutron'})" stroke="#0a1a0c" stroke-width="1"/>`;
  }).join('');
  const orbits = [0, 60, 120]
    .map((angle, k) => {
      const e = 30 + k * 115 + rand() * 40;
      const rad = (e * Math.PI) / 180;
      const ex = 150 + Math.cos(rad) * 130;
      const ey = 150 + Math.sin(rad) * 46;
      return `<g transform="rotate(${angle} 150 150)">
        <ellipse cx="150" cy="150" rx="130" ry="46" fill="none" stroke="${L.green}" stroke-width="5" opacity="0.25" filter="url(#${p}-b4)"/>
        <ellipse cx="150" cy="150" rx="130" ry="46" fill="none" stroke="#c9ffbf" stroke-width="1.8"/>
        <circle cx="${f1(ex)}" cy="${f1(ey)}" r="14" fill="url(#${p}-halo)"/>
        <circle cx="${f1(ex)}" cy="${f1(ey)}" r="6" fill="url(#${p}-electron)"/>
      </g>`;
    })
    .join('');
  const body = `<defs>${brushes(p)}
      ${radial(`${p}-proton`, [[0, '#ffe0c8'], [0.4, '#f06a3a'], [1, '#6a1a08']], { cx: 0.35, cy: 0.3 })}
      ${radial(`${p}-neutron`, [[0, '#f0fff0'], [0.4, '#7aa88a'], [1, '#203a2a']], { cx: 0.35, cy: 0.3 })}
      ${radial(`${p}-electron`, [[0, '#ffffff'], [0.4, '#b6ffa8'], [1, '#2a9a3a']], { cx: 0.35, cy: 0.3 })}
      ${radial(`${p}-halo`, [[0, L.green, 0.7], [1, L.green, 0]])}
      ${radial(`${p}-core`, [[0, L.green, 0.5], [1, L.green, 0]])}
    </defs>
    <circle cx="150" cy="150" r="70" fill="url(#${p}-core)"/>
    ${orbits}${nucleus}`;
  return svg('0 0 300 300', body, { ratio: 'xMidYMid meet' });
}

/** Where the toroid sits in the coil's 200 × 450 box: the streamers spring from its rim. */
export const TESLA_TOROID = { x: 100, y: 206, rx: 78, ry: 20 };

/**
 * A Tesla coil in the grand manner: a mahogany cabinet with a voltmeter, knobs, a switch and a
 * pilot lamp; two Leyden jars and a brass spark gap; a flat spiral primary of copper tube; a
 * tall secondary wound with fine wire; and a polished toroid catching the lab's light.
 */
export function teslaCoil({ id = 'tc' } = {}) {
  const p = id;
  const ink = L.ink;
  const { x: tx, y: ty } = TESLA_TOROID;
  const windings = Array.from({ length: 118 }, (_, i) => {
    const y = 244 + i * 1.02;
    return `<path d="M87,${f1(y)} C94,${f1(y + 1.4)} 106,${f1(y + 1.4)} 113,${f1(y)}" stroke="${i % 3 === 0 ? '#e9a05a' : i % 3 === 1 ? '#b9662a' : '#8a4818'}" stroke-width="0.9" fill="none"/>`;
  }).join('');
  // The primary: a flat spiral of copper tube; its back half is drawn behind the secondary.
  const turns = [34, 44, 54, 64, 74];
  const primary = (half) =>
    turns
      .map((rx, i) => {
        const ry = 5 + i * 1.9;
        const cy = 360 - i * 0.6;
        const arc = half === 'back'
          ? `M${100 - rx},${f1(cy)} A${rx},${f1(ry)} 0 0 1 ${100 + rx},${f1(cy)}`
          : `M${100 - rx},${f1(cy)} A${rx},${f1(ry)} 0 0 0 ${100 + rx},${f1(cy)}`;
        return `<path d="${arc}" stroke="${ink}" stroke-width="5.4" fill="none"/>
          <path d="${arc}" stroke="url(#${p}-copper)" stroke-width="3.6" fill="none"/>
          <path d="${arc}" stroke="#ffd2a0" stroke-width="0.9" fill="none" opacity="${half === 'front' ? 0.85 : 0.35}" transform="translate(0 -0.9)"/>`;
      })
      .join('');
  const leyden = (x) => `<g>
    ${paint(p, `jar${x}`, `M${x - 11},318 L${x + 11},318 L${x + 11},372 C${x + 11},376 ${x - 11},376 ${x - 11},372 Z`, {
      fill: `url(#${p}-glass)`,
      ink,
      line: 1.4,
      after: `<path d="M${x - 11},334 L${x + 11},334 L${x + 11},372 C${x + 11},376 ${x - 11},376 ${x - 11},372 Z" fill="url(#${p}-foil)" opacity="0.92"/>
        <path d="M${x - 8},338 L${x - 8},370" stroke="#ffffff" stroke-width="2" opacity="0.7"/>`,
    })}
    <ellipse cx="${x}" cy="318" rx="11" ry="3" fill="#2a1a10" stroke="${ink}" stroke-width="1.2"/>
    <path d="M${x},318 L${x},304" stroke="url(#${p}-brass)" stroke-width="3"/>
    <circle cx="${x}" cy="300" r="5" fill="url(#${p}-ball)" stroke="${ink}" stroke-width="1"/>
  </g>`;
  const body = `<defs>${brushes(p)}
      ${linear(`${p}-copper`, [[0, L.copperHi], [0.5, L.copper], [1, L.copperLo]], { x1: 0, y1: 0, x2: 0, y2: 1 })}
      ${linear(`${p}-tube`, [[0, '#1c0f06'], [0.18, '#5a3412'], [0.38, '#9a5c26'], [0.55, '#5a3412'], [1, '#120904']], { x1: 0, y1: 0, x2: 1, y2: 0 })}
      ${linear(`${p}-chrome`, [[0, '#ffffff'], [0.18, '#e4eef2'], [0.42, '#8a9aa2'], [0.52, '#2a363c'], [0.62, '#6a8a84'], [0.8, '#cfe0e0'], [1, '#3a464c']])}
      ${linear(`${p}-mahogany`, [[0, '#8a3e22'], [0.4, '#5a2210'], [1, '#2a0e06']], { x1: 0, y1: 0, x2: 1, y2: 1 })}
      ${linear(`${p}-brass`, [[0, L.brassHi], [0.45, L.brass], [1, L.brassLo]], { x1: 0, y1: 0, x2: 1, y2: 0 })}
      ${radial(`${p}-ball`, [[0, '#fff6d0'], [0.4, L.brass], [1, L.brassLo]], { cx: 0.35, cy: 0.3 })}
      ${radial(`${p}-knob`, [[0, '#5a5a62'], [0.5, '#16161a'], [1, '#000000']], { cx: 0.35, cy: 0.3 })}
      ${linear(`${p}-glass`, [[0, '#ffffff', 0.5], [0.3, L.glass, 0.18], [0.7, L.glass, 0.1], [1, '#ffffff', 0.35]], { x1: 0, y1: 0, x2: 1, y2: 0 })}
      ${linear(`${p}-foil`, [[0, '#f2f4f6'], [0.35, '#a8b0b6'], [0.7, '#e0e4e8'], [1, '#6a7278']], { x1: 0, y1: 0, x2: 1, y2: 0 })}
      ${radial(`${p}-corona`, [[0, '#cbbcff', 0.5], [0.45, '#8affd8', 0.18], [1, '#8affd8', 0]])}
      ${radial(`${p}-lamp`, [[0, '#ffd0c0'], [0.4, '#ff3a2a'], [1, '#6a0a04']], { cx: 0.4, cy: 0.35 })}
      ${grain(`${p}-grain`, { frequency: '0.03 0.5', octaves: 2, strength: 0.4, seed: 15 })}
    </defs>
    <ellipse cx="${tx}" cy="${ty}" rx="110" ry="80" fill="url(#${p}-corona)" opacity="0.6"/>
    <ellipse cx="100" cy="445" rx="92" ry="7" fill="#000" opacity="0.65" filter="url(#${p}-b4)"/>
    ${paint(p, 'cabinet', 'M22,386 L178,386 L176,438 L24,438 Z', {
      fill: `url(#${p}-mahogany)`,
      ink,
      filter: `url(#${p}-grain)`,
      strokes: [
        { d: 'M26,390 L174,390', c: '#c0704a', w: 3, o: 0.6, b: 1 },
        { d: 'M168,388 L166,436', c: '#000', w: 16, o: 0.55, b: 7 },
      ],
    })}
    <rect x="32" y="394" width="136" height="38" rx="3" fill="none" stroke="url(#${p}-brass)" stroke-width="1.8"/>
    ${[[24, 386], [176, 386], [24, 436], [176, 436]].map(([x, y]) => `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" rx="1.5" fill="url(#${p}-brass)" stroke="${ink}" stroke-width="0.8"/>`).join('')}
    <path d="M26,438 L34,446 L42,438 M158,438 L166,446 L174,438" fill="url(#${p}-brass)" stroke="${ink}" stroke-width="1"/>
    <circle cx="56" cy="413" r="14" fill="url(#${p}-brass)" stroke="${ink}" stroke-width="1.2"/>
    <circle cx="56" cy="413" r="11" fill="#f2ead2" stroke="${ink}" stroke-width="0.8"/>
    ${Array.from({ length: 9 }, (_, i) => {
      const a = Math.PI * (1.1 + i * 0.1);
      return `<path d="M${f1(56 + Math.cos(a) * 9)},${f1(415 + Math.sin(a) * 9)} L${f1(56 + Math.cos(a) * 7)},${f1(415 + Math.sin(a) * 7)}" stroke="#2a1a10" stroke-width="0.8"/>`;
    }).join('')}
    <path d="M56,415 L64,406" stroke="#c0281a" stroke-width="1.2"><animateTransform attributeName="transform" type="rotate" values="0 56 415;-14 56 415;6 56 415;0 56 415" dur="2.6s" repeatCount="indefinite"/></path>
    <circle cx="56" cy="415" r="1.6" fill="#2a1a10"/>
    ${[96, 122].map((x) => `<circle cx="${x}" cy="414" r="9" fill="url(#${p}-knob)" stroke="${ink}" stroke-width="1"/><circle cx="${x}" cy="414" r="3.6" fill="url(#${p}-ball)"/><path d="M${x},405 L${x},409" stroke="#e8e0d0" stroke-width="1.4"/>`).join('')}
    <rect x="142" y="400" width="14" height="10" rx="2" fill="#16161a" stroke="url(#${p}-brass)" stroke-width="1.2"/>
    <path d="M149,405 L154,397" stroke="#d8d0c0" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="149" cy="423" r="5" fill="url(#${p}-lamp)" stroke="${ink}" stroke-width="1"><animate attributeName="opacity" values="1;0.6;1;0.85;1" dur="1.3s" repeatCount="indefinite"/></circle>
    <path d="M22,386 L178,386 L170,374 L30,374 Z" fill="#a0583a" stroke="${ink}" stroke-width="1.6"/>
    <path d="M32,377 L168,377" stroke="#d48a62" stroke-width="1.4" opacity="0.7"/>
    ${leyden(41)}${leyden(159)}
    <path d="M41,300 C41,282 62,286 70,344 M159,300 C159,282 138,286 130,344" stroke="url(#${p}-copper)" stroke-width="2.2" fill="none"/>
    <ellipse cx="100" cy="366" rx="80" ry="14" fill="#141418" stroke="${ink}" stroke-width="1.4"/>
    <ellipse cx="100" cy="364" rx="78" ry="12" fill="#22222a"/>
    ${primary('back')}
    ${paint(p, 'secondary', 'M86,240 L114,240 L114,358 L86,358 Z', {
      fill: `url(#${p}-tube)`,
      ink,
      line: 1.4,
      after: `${windings}<rect x="92" y="242" width="3" height="114" fill="#ffffff" opacity="0.35"/><rect x="96" y="242" width="1.2" height="114" fill="#ffffff" opacity="0.25"/>`,
      strokes: [{ d: 'M110,244 L110,356', c: '#8affd8', w: 4, o: 0.25, b: 2 }],
    })}
    <ellipse cx="100" cy="358" rx="16" ry="4" fill="url(#${p}-brass)" stroke="${ink}" stroke-width="1"/>
    <ellipse cx="100" cy="240" rx="16" ry="4" fill="url(#${p}-brass)" stroke="${ink}" stroke-width="1"/>
    ${primary('front')}
    <rect x="84" y="364" width="6" height="12" fill="#1a1a1e" stroke="${ink}" stroke-width="0.8"/><rect x="110" y="364" width="6" height="12" fill="#1a1a1e" stroke="${ink}" stroke-width="0.8"/>
    <circle cx="87" cy="362" r="5" fill="url(#${p}-ball)" stroke="${ink}" stroke-width="1"/><circle cx="113" cy="362" r="5" fill="url(#${p}-ball)" stroke="${ink}" stroke-width="1"/>
    <path d="M92,362 L96,359 L100,364 L104,360 L108,362" stroke="#f4f0ff" stroke-width="1.4" fill="none"><animate attributeName="opacity" values="1;0;0.8;0;1;0;0" dur="0.5s" repeatCount="indefinite"/></path>
    <path d="M97,240 L97,228 M103,240 L103,228" stroke="url(#${p}-chrome)" stroke-width="4"/>
    ${paint(p, 'toroid', `M${tx - 80},${ty} C${tx - 80},${ty - 22} ${tx - 40},${ty - 28} ${tx},${ty - 28} C${tx + 40},${ty - 28} ${tx + 80},${ty - 22} ${tx + 80},${ty} C${tx + 80},${ty + 22} ${tx + 40},${ty + 28} ${tx},${ty + 28} C${tx - 40},${ty + 28} ${tx - 80},${ty + 22} ${tx - 80},${ty} Z`, {
      fill: `url(#${p}-chrome)`,
      ink,
      line: 1.6,
      strokes: [
        { d: `M${tx - 66},${ty - 12} C${tx - 36},${ty - 22} ${tx + 36},${ty - 22} ${tx + 66},${ty - 12}`, c: '#ffffff', w: 6, o: 0.9, b: 2 },
        { d: `M${tx - 70},${ty + 8} C${tx - 36},${ty + 18} ${tx + 36},${ty + 18} ${tx + 70},${ty + 8}`, c: '#0e1a1c', w: 7, o: 0.6, b: 2 },
        { d: `M${tx + 48},${ty - 4} C${tx + 60},${ty} ${tx + 70},${ty + 4} ${tx + 74},${ty + 2}`, c: '#8affd8', w: 6, o: 0.55, b: 2 },
        { d: `M${tx - 74},${ty + 2} C${tx - 64},${ty + 6} ${tx - 54},${ty + 6} ${tx - 46},${ty + 2}`, c: '#cbbcff', w: 5, o: 0.5, b: 2 },
      ],
    })}
    <ellipse cx="${tx}" cy="${ty - 8}" rx="40" ry="7" fill="#1c262a" stroke="#0a1012" stroke-width="1"/>
    <ellipse cx="${tx}" cy="${ty - 9}" rx="34" ry="4.4" fill="#2e3c42"/>
    <path d="M${tx - 52},${ty - 18} C${tx - 44},${ty - 22} ${tx - 30},${ty - 24} ${tx - 18},${ty - 24}" stroke="#ffffff" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M${tx + 78},${ty - 2} L${tx + 92},${ty - 6}" stroke="url(#${p}-chrome)" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="${tx + 93}" cy="${ty - 6}" r="2.4" fill="#ffffff"/>`;
  return svg('0 0 200 450', body, { ratio: 'xMidYMax meet' });
}

/** A distilling train: flask over a spirit lamp, a condenser and a receiving flask. */
export function distillation({ id = 'ds' } = {}) {
  const p = id;
  const ink = L.ink;
  const bubbles = [[62, 214, 3], [74, 206, 2.4], [80, 222, 2], [56, 226, 1.6], [70, 196, 1.8]]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#eaffe4" stroke-width="1"/>`)
    .join('');
  const body = `<defs>${brushes(p)}
      ${linear(`${p}-iron`, [[0, L.ironHi], [0.5, L.iron], [1, '#0a0d0e']], { x1: 0, y1: 0, x2: 1, y2: 0 })}
      ${linear(`${p}-brew`, [[0, '#c6ff9a'], [0.5, '#5ad04a'], [1, '#1e6a1e']])}
      ${linear(`${p}-amber`, [[0, '#ffd88a'], [0.6, '#d8892a'], [1, '#7a3a0a']])}
      ${linear(`${p}-glass`, [[0, '#ffffff', 0.5], [0.3, L.glass, 0.18], [0.7, L.glass, 0.1], [1, '#ffffff', 0.35]], { x1: 0, y1: 0, x2: 1, y2: 0 })}
      ${linear(`${p}-brass`, [[0, L.brassHi], [0.45, L.brass], [1, L.brassLo]])}
      ${radial(`${p}-flame`, [[0, '#ffffff'], [0.3, '#9ad8ff'], [0.7, '#3a7aff', 0.7], [1, '#3a7aff', 0]], { cy: 0.75 })}
      ${radial(`${p}-glow`, [[0, L.green, 0.5], [1, L.green, 0]])}
    </defs>
    <ellipse cx="96" cy="294" rx="88" ry="6" fill="#000" opacity="0.6" filter="url(#${p}-b4)"/>
    <rect x="14" y="284" width="96" height="10" rx="2" fill="url(#${p}-iron)" stroke="${ink}" stroke-width="1.4"/>
    <rect x="32" y="40" width="6" height="246" fill="url(#${p}-iron)" stroke="${ink}" stroke-width="1"/>
    <path d="M38,150 L58,150 M38,96 L118,96" stroke="url(#${p}-iron)" stroke-width="5"/>
    <rect x="54" y="144" width="20" height="12" rx="2" fill="url(#${p}-brass)" stroke="${ink}" stroke-width="1"/>
    <circle cx="68" cy="212" r="56" fill="url(#${p}-glow)"/>
    ${paint(p, 'flask', 'M60,150 L76,150 L76,176 C98,182 108,198 106,218 C104,240 88,254 68,254 C48,254 32,240 30,218 C28,198 38,182 60,176 Z', {
      fill: `url(#${p}-glass)`,
      ink,
      line: 1.6,
      after: `<path d="M32,214 C44,220 92,220 104,214 C104,240 88,254 68,254 C48,254 32,240 32,214 Z" fill="url(#${p}-brew)" opacity="0.9"/>${bubbles}`,
      strokes: [{ d: 'M42,196 C40,206 40,222 44,232', c: '#ffffff', w: 4, o: 0.7, b: 1 }],
    })}
    <rect x="58" y="142" width="20" height="10" rx="2" fill="#7a4a2a" stroke="${ink}" stroke-width="1"/>
    <path d="M68,142 L68,120 C68,112 74,108 82,110 L146,150" stroke="${ink}" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M68,142 L68,120 C68,112 74,108 82,110 L146,150" stroke="${L.glass}" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.8"/>
    <path d="M96,112 L162,156 L156,166 L90,122 Z" fill="url(#${p}-glass)" stroke="${ink}" stroke-width="1.6"/>
    <path d="M100,116 L158,155" stroke="#9ad8ff" stroke-width="2" opacity="0.6"/>
    <path d="M146,150 L160,170" stroke="${ink}" stroke-width="6" stroke-linecap="round"/><path d="M146,150 L160,170" stroke="${L.glass}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="160" cy="180" r="2.4" fill="#ffc35a"><animate attributeName="cy" values="174;196" dur="1.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="1.2s" repeatCount="indefinite"/></circle>
    ${paint(p, 'receiver', 'M152,200 L168,200 L168,214 L186,266 C188,272 184,276 178,276 L142,276 C136,276 132,272 134,266 L152,214 Z', {
      fill: `url(#${p}-glass)`,
      ink,
      line: 1.6,
      after: `<path d="M140,252 L180,252 L186,266 C188,272 184,276 178,276 L142,276 C136,276 132,272 134,266 Z" fill="url(#${p}-amber)" opacity="0.9"/>`,
      strokes: [{ d: 'M146,222 L140,262', c: '#ffffff', w: 3, o: 0.7, b: 1 }],
    })}
    <path d="M44,284 L52,262 L84,262 L92,284 Z" fill="url(#${p}-brass)" stroke="${ink}" stroke-width="1.4"/>
    <rect x="62" y="254" width="12" height="10" fill="#d8d2c4" stroke="${ink}" stroke-width="1"/>
    <path d="M68,254 C60,246 62,236 68,228 C70,236 76,240 72,248 C74,246 76,244 76,240 C80,246 76,254 68,254 Z" fill="url(#${p}-flame)"/>`;
  return svg('0 0 190 300', body, { ratio: 'xMidYMax meet' });
}

/** A dropping funnel over a round flask on a tripod, warmed by a burner. */
export function droppingFunnel({ id = 'df' } = {}) {
  const p = id;
  const ink = L.ink;
  const body = `<defs>${brushes(p)}
      ${linear(`${p}-iron`, [[0, L.ironHi], [0.5, L.iron], [1, '#0a0d0e']], { x1: 0, y1: 0, x2: 1, y2: 0 })}
      ${linear(`${p}-glass`, [[0, '#ffffff', 0.5], [0.3, L.glass, 0.18], [0.7, L.glass, 0.1], [1, '#ffffff', 0.35]], { x1: 0, y1: 0, x2: 1, y2: 0 })}
      ${linear(`${p}-teal`, [[0, '#b8fff0'], [0.5, '#3ac0b0'], [1, '#0a5a54']])}
      ${linear(`${p}-violet`, [[0, '#e6c8ff'], [0.5, '#9a5ad8'], [1, '#3a1a6a']])}
      ${radial(`${p}-flame`, [[0, '#ffffff'], [0.3, '#9ad8ff'], [0.7, '#3a7aff', 0.7], [1, '#3a7aff', 0]], { cy: 0.75 })}
      ${radial(`${p}-glow`, [[0, '#3ac0b0', 0.45], [1, '#3ac0b0', 0]])}
    </defs>
    <ellipse cx="80" cy="250" rx="70" ry="5" fill="#000" opacity="0.6" filter="url(#${p}-b4)"/>
    <rect x="102" y="240" width="52" height="9" rx="2" fill="url(#${p}-iron)" stroke="${ink}" stroke-width="1.2"/>
    <rect x="126" y="20" width="5" height="222" fill="url(#${p}-iron)" stroke="${ink}" stroke-width="0.8"/>
    <path d="M128,60 L92,60 M128,120 L98,120" stroke="url(#${p}-iron)" stroke-width="4"/>
    <ellipse cx="86" cy="120" rx="14" ry="4" fill="none" stroke="url(#${p}-iron)" stroke-width="3"/>
    ${paint(p, 'funnel', 'M80,34 L88,34 L88,44 C104,56 108,84 96,100 L90,108 L90,124 L78,124 L78,108 L72,100 C60,84 64,56 80,44 Z', {
      fill: `url(#${p}-glass)`,
      ink,
      line: 1.5,
      after: `<path d="M66,72 C74,76 94,76 104,72 C106,86 102,96 96,100 L90,108 L78,108 L72,100 C66,94 64,82 66,72 Z" fill="url(#${p}-violet)" opacity="0.88"/>`,
      strokes: [{ d: 'M72,56 C68,66 68,80 72,92', c: '#ffffff', w: 3, o: 0.7, b: 1 }],
    })}
    <rect x="80" y="26" width="8" height="9" rx="1.5" fill="#7a4a2a" stroke="${ink}" stroke-width="1"/>
    <rect x="72" y="112" width="24" height="5" rx="2" fill="#d8d2c4" stroke="${ink}" stroke-width="0.8"/>
    <circle cx="84" cy="136" r="2.4" fill="#c49aff"><animate attributeName="cy" values="128;160" dur="1.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="1.4s" repeatCount="indefinite"/></circle>
    <circle cx="84" cy="184" r="48" fill="url(#${p}-glow)"/>
    ${paint(p, 'flask', 'M76,140 L92,140 L92,158 C110,164 118,178 116,194 C114,212 100,222 84,222 C68,222 54,212 52,194 C50,178 58,164 76,158 Z', {
      fill: `url(#${p}-glass)`,
      ink,
      line: 1.5,
      after: `<path d="M54,190 C66,196 104,196 116,190 C116,210 102,222 84,222 C66,222 52,210 54,190 Z" fill="url(#${p}-teal)" opacity="0.9"/><circle cx="74" cy="204" r="2.2" fill="none" stroke="#eafffa" stroke-width="1"/><circle cx="92" cy="208" r="1.6" fill="none" stroke="#eafffa" stroke-width="1"/>`,
      strokes: [{ d: 'M62,174 C58,186 58,200 62,210', c: '#ffffff', w: 3, o: 0.7, b: 1 }],
    })}
    <path d="M48,224 L120,224" stroke="url(#${p}-iron)" stroke-width="4"/>
    <path d="M54,224 L44,250 M84,224 L84,250 M114,224 L124,250" stroke="url(#${p}-iron)" stroke-width="3"/>
    <path d="M76,250 L78,238 L90,238 L92,250 Z" fill="${L.brass}" stroke="${ink}" stroke-width="1"/>
    <path d="M84,238 C78,232 80,226 84,220 C86,226 90,230 87,236 C89,234 90,232 90,229 C93,234 90,238 84,238 Z" fill="url(#${p}-flame)"/>`;
  return svg('0 0 160 256', body, { ratio: 'xMidYMax meet' });
}
